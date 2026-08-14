import { sortListings, wilsonLowerBound } from './ranking';
import type {
  ApiRow,
  Env,
  Filters,
  HealthState,
  Listing,
  Platform,
  Status,
  Track,
} from './types';

/** How far back "trending" looks when counting votes. */
const TRENDING_WINDOW_DAYS = 14;

/** How recently a product must have launched to still read as "just launched". */
const LAUNCH_WINDOW_DAYS = 14;

export const PAGE_SIZE = 24;

/**
 * Scale note: filtering, faceting and ranking all happen in the Worker over the
 * rows SQL hands back. That is deliberate — Wilson scoring needs a square root
 * and faceting needs counts across the whole result set, both awkward in
 * SQLite, and a curated directory is hundreds of rows, not millions. If this
 * ever passes a few thousand listings, move ranking into a stored `score`
 * column refreshed on write and paginate in SQL.
 */
const MAX_ROWS = 2000;

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function toListing(
  row: ApiRow,
  votes: { recent?: number; myVote?: -1 | 0 | 1 } = {},
  now: number = Date.now(),
): Listing {
  const launched = row.launched_at ? Date.parse(`${row.launched_at.slice(0, 10)}T00:00:00Z`) : NaN;

  return {
    ...row,
    categories: parseJsonArray(row.categories),
    languages: parseJsonArray(row.languages),
    platforms: parseJsonArray(row.platforms) as Platform[],
    open_source: row.open_source === 1,
    official: row.official === 1,
    deprecated: row.deprecated === 1,
    score: row.upvotes - row.downvotes,
    confidence: wilsonLowerBound(row.upvotes, row.downvotes),
    recent: votes.recent ?? 0,
    myVote: votes.myVote ?? 0,
    isNew: !Number.isNaN(launched) && now - launched <= LAUNCH_WINDOW_DAYS * 86_400_000,
  };
}

/** Net votes per listing inside the trending window. */
async function recentVoteMap(env: Env): Promise<Map<number, number>> {
  const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 86_400_000)
    .toISOString()
    .replace(/\.\d+Z$/, 'Z');

  const { results } = await env.DB.prepare(
    `SELECT api_id, SUM(value) AS net
       FROM votes
      WHERE updated_at >= ?1
      GROUP BY api_id`,
  )
    .bind(since)
    .all<{ api_id: number; net: number }>();

  return new Map(results.map((r) => [r.api_id, r.net]));
}

/** The current visitor's votes, keyed by api id. */
async function myVoteMap(env: Env, voterId: string | null): Promise<Map<number, -1 | 1>> {
  if (!voterId) return new Map();

  const { results } = await env.DB.prepare(
    'SELECT api_id, value FROM votes WHERE voter_id = ?1',
  )
    .bind(voterId)
    .all<{ api_id: number; value: -1 | 1 }>();

  return new Map(results.map((r) => [r.api_id, r.value]));
}

/** The fields a reader would expect a search to look at. */
const SEARCH_HAYSTACK =
  "lower(name || ' ' || tagline || ' ' || description || ' ' || categories)";

/**
 * A cap on terms, so a pasted paragraph cannot build a query with four hundred
 * LIKE clauses in it. Eight is far past the point where an AND search returns
 * anything anyway.
 */
const MAX_SEARCH_TERMS = 8;

/**
 * Splits a query into the terms a listing must *all* match.
 *
 * Quoted runs stay whole: `"liturgy of the hours"` is one term, which is the
 * escape hatch for the literal-phrase search this otherwise replaces.
 */
export function searchTerms(query: string): string[] {
  const terms: string[] = [];

  for (const match of query.toLowerCase().matchAll(/"([^"]*)"|(\S+)/g)) {
    const term = (match[1] ?? match[2]).trim();
    if (term) terms.push(term);
  }

  return terms.slice(0, MAX_SEARCH_TERMS);
}

/**
 * `%` and `_` are wildcards to LIKE, so a reader searching for "100%" or
 * "snake_case" would otherwise get a query that matches far more than they
 * asked for. Paired with `ESCAPE '\'` at the call site.
 */
const escapeLike = (term: string): string => term.replace(/[\\%_]/g, (c) => `\\${c}`);

async function loadListings(
  env: Env,
  {
    status = 'published',
    search = '',
    track,
  }: { status?: Status; search?: string; track?: Track },
  voterId: string | null,
): Promise<Listing[]> {
  const clauses = ['status = ?1'];
  const bindings: unknown[] = [status];

  if (track) {
    clauses.push(`track = ?${bindings.length + 1}`);
    bindings.push(track);
  }

  /*
    Every term must appear somewhere in the listing, in any order. Matching the
    query as one literal string meant "canonical identifiers" found a single
    listing while "canonical" found fifteen — the registries say "canonical IDs"
    in the tagline and "identifiers" in the description, and no single field
    contained the phrase. Nobody types a query expecting it to be matched
    verbatim against concatenated fields.

    Still substring matching per term, so "eucharis" finds "Eucharistic". Good
    enough for a curated list; swap in FTS5 if the corpus grows.
  */
  for (const term of searchTerms(search)) {
    clauses.push(`${SEARCH_HAYSTACK} LIKE ?${bindings.length + 1} ESCAPE '\\'`);
    bindings.push(`%${escapeLike(term)}%`);
  }

  const [{ results }, recent, mine] = await Promise.all([
    env.DB.prepare(
      `SELECT * FROM apis WHERE ${clauses.join(' AND ')} ORDER BY id LIMIT ${MAX_ROWS}`,
    )
      .bind(...bindings)
      .all<ApiRow>(),
    recentVoteMap(env),
    myVoteMap(env, voterId),
  ]);

  return results.map((row) =>
    toListing(row, { recent: recent.get(row.id) ?? 0, myVote: mine.get(row.id) ?? 0 }),
  );
}

export interface FacetCount {
  value: string;
  count: number;
}

export interface DirectoryResult {
  listings: Listing[];
  total: number;
  page: number;
  pageCount: number;
  facets: {
    pricing: FacetCount[];
    kind: FacetCount[];
    platforms: FacetCount[];
    categories: FacetCount[];
    languages: FacetCount[];
  };
  /**
   * One listing worth surfacing beside the leaderboard. Deliberately not the
   * top row — a "spotlight" that reprints whatever is already at #1 reads as a
   * rendering fault. This is the newest thing in the current result set.
   */
  spotlight: Listing | null;
}

function countBy(listings: Listing[], pick: (l: Listing) => string[]): FacetCount[] {
  const counts = new Map<string, number>();
  for (const listing of listings) {
    for (const value of pick(listing)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Facet groups that count disjunctively — each ignores its own selection. */
type FacetKey = 'pricing' | 'kind' | 'platforms' | 'categories' | 'languages';

/**
 * Disjunctive facet counting.
 *
 * A count is only useful if it predicts what you get by clicking it, so each
 * group is counted against every *other* group's filters with its own
 * selection lifted — otherwise "Free" and "iOS" both advertise their whole-
 * catalogue totals and the intersection lands somewhere neither promised.
 *
 * The option *list* still comes from the unfiltered catalogue, in unfiltered
 * order. That keeps the panel a fixed set of rows in a fixed order — nothing
 * appears, disappears or jumps under the pointer mid-refinement — and an
 * option that currently yields nothing says so with a zero instead of
 * vanishing and leaving a hole where the reader was about to click.
 */
function facetCounts(
  all: Listing[],
  filters: Filters,
  key: FacetKey,
  pick: (l: Listing) => string[],
): FacetCount[] {
  const scoped = new Map(
    countBy(
      all.filter((l) => matchesFilters(l, { ...filters, [key]: [] })),
      pick,
    ).map((f) => [f.value, f.count]),
  );

  return countBy(all, pick).map(({ value }) => ({ value, count: scoped.get(value) ?? 0 }));
}

/** Most recently launched, falling back to most recently added to the directory. */
function newest(listings: Listing[]): Listing | null {
  if (listings.length === 0) return null;
  const when = (l: Listing) => Date.parse(l.launched_at ?? l.created_at) || 0;
  return listings.reduce((best, l) => (when(l) > when(best) ? l : best));
}

function matchesFilters(listing: Listing, filters: Filters): boolean {
  if (filters.pricing.length && !filters.pricing.includes(listing.pricing)) return false;
  if (filters.kind.length && !filters.kind.includes(listing.kind)) return false;
  if (filters.platforms.length && !filters.platforms.some((p) => listing.platforms.includes(p))) {
    return false;
  }
  if (filters.auth.length && !filters.auth.includes(listing.auth)) return false;
  if (filters.openSource && !listing.open_source) return false;
  if (filters.noAuth && listing.auth !== 'none') return false;

  // Multi-select within a facet is OR (people want "free or freemium"), which
  // is what a checkbox group reads as.
  if (filters.categories.length && !filters.categories.some((c) => listing.categories.includes(c))) {
    return false;
  }
  if (filters.languages.length && !filters.languages.some((l) => listing.languages.includes(l))) {
    return false;
  }
  return true;
}

export async function queryDirectory(
  env: Env,
  filters: Filters,
  voterId: string | null,
): Promise<DirectoryResult> {
  const all = await loadListings(env, { search: filters.q, track: filters.track }, voterId);

  const facets = {
    pricing: facetCounts(all, filters, 'pricing', (l) => [l.pricing]),
    kind: facetCounts(all, filters, 'kind', (l) => [l.kind]),
    platforms: facetCounts(all, filters, 'platforms', (l) => l.platforms),
    categories: facetCounts(all, filters, 'categories', (l) => l.categories),
    languages: facetCounts(all, filters, 'languages', (l) => l.languages),
  };

  const matched = sortListings(all.filter((l) => matchesFilters(l, filters)), filters.sort);

  const pageCount = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), pageCount);
  const start = (page - 1) * PAGE_SIZE;
  const listings = matched.slice(start, start + PAGE_SIZE);

  // Never the row the reader is already looking at.
  const top = listings[0];
  const spotlight = newest(matched.filter((l) => l.id !== top?.id));

  return {
    listings,
    total: matched.length,
    page,
    pageCount,
    facets,
    spotlight,
  };
}

export async function getListing(
  env: Env,
  slug: string,
  voterId: string | null,
  status: Status = 'published',
): Promise<Listing | null> {
  const row = await env.DB.prepare('SELECT * FROM apis WHERE slug = ?1 AND status = ?2')
    .bind(slug, status)
    .first<ApiRow>();

  if (!row) return null;

  const [recent, mine] = await Promise.all([recentVoteMap(env), myVoteMap(env, voterId)]);

  return toListing(row, { recent: recent.get(row.id) ?? 0, myVote: mine.get(row.id) ?? 0 });
}

/** Same track and overlapping categories, ranked by confidence. */
export async function getRelated(env: Env, listing: Listing, limit = 4): Promise<Listing[]> {
  const all = await loadListings(env, { track: listing.track }, null);
  const scored = all
    .filter((l) => l.id !== listing.id)
    .map((l) => ({
      listing: l,
      overlap: l.categories.filter((c) => listing.categories.includes(c)).length,
    }))
    .filter((entry) => entry.overlap > 0)
    .sort(
      (a, b) => b.overlap - a.overlap || b.listing.confidence - a.listing.confidence,
    );

  return scored.slice(0, limit).map((entry) => entry.listing);
}

export interface VoteResult {
  upvotes: number;
  downvotes: number;
  score: number;
  myVote: -1 | 0 | 1;
}

/**
 * Casts, switches or retracts a vote.
 *
 * Clicking the arrow you already chose retracts it, which is the interaction
 * everyone has learned from Reddit and StackOverflow. Tallies on `apis` are
 * maintained by triggers, so the write is a single statement and the counts
 * cannot drift from the ledger.
 */
export async function castVote(
  env: Env,
  apiId: number,
  voterId: string,
  value: -1 | 1,
  ipHash: string,
): Promise<VoteResult | null> {
  const existing = await env.DB.prepare(
    'SELECT value FROM votes WHERE api_id = ?1 AND voter_id = ?2',
  )
    .bind(apiId, voterId)
    .first<{ value: -1 | 1 }>();

  if (existing?.value === value) {
    await env.DB.prepare('DELETE FROM votes WHERE api_id = ?1 AND voter_id = ?2')
      .bind(apiId, voterId)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO votes (api_id, voter_id, value, ip_hash)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(api_id, voter_id) DO UPDATE SET
         value = excluded.value,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
    )
      .bind(apiId, voterId, value, ipHash)
      .run();
  }

  const row = await env.DB.prepare('SELECT upvotes, downvotes FROM apis WHERE id = ?1')
    .bind(apiId)
    .first<{ upvotes: number; downvotes: number }>();

  if (!row) return null;

  return {
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    score: row.upvotes - row.downvotes,
    myVote: existing?.value === value ? 0 : value,
  };
}

export interface SubmissionInput {
  name: string;
  tagline: string;
  description: string;
  homepage_url: string;
  docs_url: string | null;
  repo_url: string | null;
  kind: string;
  track: Track;
  platforms: string[];
  launched_at: string | null;
  pricing: string;
  open_source: boolean;
  auth: string;
  categories: string[];
  languages: string[];
  submitter: string | null;
  submitter_note: string | null;
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // strip the accents NFKD just split off
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'api'
  );
}

/** Queues a submission for moderation. Returns the slug it was filed under. */
export async function createSubmission(env: Env, input: SubmissionInput): Promise<string> {
  const base = slugify(input.name);
  let slug = base;

  // Slugs are unique across every status, so a pending duplicate still gets its
  // own row for a moderator to compare against.
  for (let n = 2; n < 50; n++) {
    const clash = await env.DB.prepare('SELECT 1 FROM apis WHERE slug = ?1').bind(slug).first();
    if (!clash) break;
    slug = `${base}-${n}`;
  }

  await env.DB.prepare(
    `INSERT INTO apis (
       slug, name, tagline, description, homepage_url, docs_url, repo_url,
       kind, track, platforms, launched_at, pricing, open_source, auth,
       categories, languages, status, submitter, submitter_note
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, 'pending', ?17, ?18)`,
  )
    .bind(
      slug,
      input.name,
      input.tagline,
      input.description,
      input.homepage_url,
      input.docs_url,
      input.repo_url,
      input.kind,
      input.track,
      JSON.stringify(input.platforms),
      input.launched_at,
      input.pricing,
      input.open_source ? 1 : 0,
      input.auth,
      JSON.stringify(input.categories),
      JSON.stringify(input.languages),
      input.submitter,
      input.submitter_note,
    )
    .run();

  return slug;
}

export async function createReport(
  env: Env,
  apiId: number,
  kind: string,
  message: string,
  ipHash: string,
): Promise<void> {
  await env.DB.prepare(
    'INSERT INTO reports (api_id, kind, message, ip_hash) VALUES (?1, ?2, ?3, ?4)',
  )
    .bind(apiId, kind, message.slice(0, 2000), ipHash)
    .run();
}

export async function listByStatus(env: Env, status: Status): Promise<Listing[]> {
  return loadListings(env, { status }, null);
}

/** Newest products first — the front-page launches feed. */
export async function recentlyAdded(env: Env, track: Track, limit: number): Promise<Listing[]> {
  const all = await loadListings(env, { track }, null);
  return sortListings(all, 'new').slice(0, limit);
}

export interface OpenReport {
  id: number;
  kind: string;
  message: string;
  created_at: string;
  slug: string;
  name: string;
  track: Track;
  /** 1 when the listing is already flagged — so the queue can offer "un-flag". */
  deprecated: number;
}

export async function listOpenReports(env: Env): Promise<OpenReport[]> {
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.kind, r.message, r.created_at,
            a.slug, a.name, a.track, a.deprecated
       FROM reports r
       JOIN apis a ON a.id = r.api_id
      WHERE r.resolved = 0
      ORDER BY r.created_at DESC
      LIMIT 100`,
  ).all<OpenReport>();

  return results;
}

export async function setStatus(env: Env, slug: string, status: Status): Promise<void> {
  await env.DB.prepare(
    `UPDATE apis
        SET status = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE slug = ?1`,
  )
    .bind(slug, status)
    .run();
}

export async function markVerified(env: Env, slug: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE apis
        SET verified_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
            updated_at  = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE slug = ?1`,
  )
    .bind(slug)
    .run();
}

export async function resolveReport(env: Env, id: number): Promise<void> {
  await env.DB.prepare('UPDATE reports SET resolved = 1 WHERE id = ?1').bind(id).run();
}

/**
 * Flags a listing as dead or superseded — without hiding it — or lifts the
 * flag again.
 *
 * Acting on the evidence also clears it: the reports that argued for this
 * decision are resolved in the same breath, so the row drops out of the queue
 * instead of sitting there asking to be decided a second time. Reports arguing
 * the *other* way are left open on purpose — if someone still says it's dead
 * after a moderator called it alive, that disagreement should stay visible.
 */
export async function setDeprecated(
  env: Env,
  slug: string,
  deprecated: boolean,
  note: string | null,
): Promise<void> {
  const settled = deprecated ? ['deprecated', 'dead-link'] : ['revived'];

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE apis
          SET deprecated = ?2,
              deprecated_note = ?3,
              updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE slug = ?1`,
    ).bind(slug, deprecated ? 1 : 0, note),

    env.DB.prepare(
      `UPDATE reports
          SET resolved = 1
        WHERE resolved = 0
          AND kind IN (${settled.map((_, i) => `?${i + 2}`).join(', ')})
          AND api_id = (SELECT id FROM apis WHERE slug = ?1)`,
    ).bind(slug, ...settled),
  ]);
}

export interface DeprecationSignal {
  slug: string;
  name: string;
  track: Track;
  deprecated: number;
  health_state: HealthState;
  health_fails: number;
  /** Open reports saying this thing is dead. */
  dead_reports: number;
  /** Open reports saying a flagged listing is working again. */
  revive_reports: number;
}

/**
 * The evidence queue, pointing both ways: listings readers say are dead or the
 * probe cannot reach, and flagged listings readers say have come back. A
 * moderator works from this — the machine gathers signal, a human decides,
 * because "abandoned" is a judgement no status code can make.
 */
export async function deprecationSignals(env: Env, limit = 50): Promise<DeprecationSignal[]> {
  const { results } = await env.DB.prepare(
    `SELECT a.slug, a.name, a.track, a.deprecated, a.health_state, a.health_fails,
            COUNT(CASE WHEN r.kind IN ('deprecated', 'dead-link') THEN 1 END) AS dead_reports,
            COUNT(CASE WHEN r.kind = 'revived'                    THEN 1 END) AS revive_reports
       FROM apis a
       LEFT JOIN reports r
              ON r.api_id = a.id
             AND r.resolved = 0
             AND r.kind IN ('deprecated', 'dead-link', 'revived')
      WHERE a.status = 'published'
        AND (r.id IS NOT NULL OR a.health_state = 'down')
      GROUP BY a.id
      -- A project reported back from the dead is the most interesting row on
      -- the page: it is the one where the directory is currently wrong.
      ORDER BY revive_reports DESC, dead_reports DESC, a.health_fails DESC, a.name ASC
      LIMIT ?1`,
  )
    .bind(limit)
    .all<DeprecationSignal>();

  return results;
}

export interface Stats {
  total: number;
  apis: number;
  products: number;
  free: number;
  votes: number;
  down: number;
}

export async function stats(env: Env): Promise<Stats> {
  const row = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM apis WHERE status = 'published')                            AS total,
       (SELECT COUNT(*) FROM apis WHERE status = 'published' AND track = 'api')          AS apis,
       (SELECT COUNT(*) FROM apis WHERE status = 'published' AND track = 'product')      AS products,
       (SELECT COUNT(*) FROM apis WHERE status = 'published' AND pricing != 'paid')      AS free,
       (SELECT COUNT(*) FROM votes)                                                      AS votes,
       (SELECT COUNT(*) FROM apis WHERE status = 'published' AND health_state = 'down')   AS down`,
  ).first<Stats>();

  return row ?? { total: 0, apis: 0, products: 0, free: 0, votes: 0, down: 0 };
}
