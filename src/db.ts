import { sortListings, wilsonLowerBound } from './ranking';
import type { ApiRow, Env, Filters, Listing, Status } from './types';

/** How far back "trending" looks when counting votes. */
const TRENDING_WINDOW_DAYS = 14;

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
): Listing {
  return {
    ...row,
    categories: parseJsonArray(row.categories),
    languages: parseJsonArray(row.languages),
    open_source: row.open_source === 1,
    official: row.official === 1,
    score: row.upvotes - row.downvotes,
    confidence: wilsonLowerBound(row.upvotes, row.downvotes),
    recent: votes.recent ?? 0,
    myVote: votes.myVote ?? 0,
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

async function loadListings(
  env: Env,
  { status = 'published', search = '' }: { status?: Status; search?: string },
  voterId: string | null,
): Promise<Listing[]> {
  const clauses = ['status = ?1'];
  const bindings: unknown[] = [status];

  if (search.trim()) {
    // Cheap substring match over the fields a reader would search by. Good
    // enough for a curated list; swap in FTS5 if the corpus grows.
    clauses.push(
      `lower(name || ' ' || tagline || ' ' || description || ' ' || categories) LIKE ?${bindings.length + 1}`,
    );
    bindings.push(`%${search.trim().toLowerCase()}%`);
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
    categories: FacetCount[];
    languages: FacetCount[];
  };
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

function matchesFilters(listing: Listing, filters: Filters): boolean {
  if (filters.pricing.length && !filters.pricing.includes(listing.pricing)) return false;
  if (filters.kind.length && !filters.kind.includes(listing.kind)) return false;
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
  const all = await loadListings(env, { search: filters.q }, voterId);

  // Facet counts are computed before the facet filters are applied, so a
  // reader can always see (and reach) the other options instead of hitting a
  // dead end of zeroes.
  const facets = {
    pricing: countBy(all, (l) => [l.pricing]),
    kind: countBy(all, (l) => [l.kind]),
    categories: countBy(all, (l) => l.categories),
    languages: countBy(all, (l) => l.languages),
  };

  const matched = sortListings(all.filter((l) => matchesFilters(l, filters)), filters.sort);

  const pageCount = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), pageCount);
  const start = (page - 1) * PAGE_SIZE;

  return {
    listings: matched.slice(start, start + PAGE_SIZE),
    total: matched.length,
    page,
    pageCount,
    facets,
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

/** Same categories, ranked by confidence — the "you might also want" strip. */
export async function getRelated(env: Env, listing: Listing, limit = 4): Promise<Listing[]> {
  const all = await loadListings(env, {}, null);
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
       kind, pricing, open_source, auth, categories, languages,
       status, submitter, submitter_note
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 'pending', ?14, ?15)`,
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

export async function listOpenReports(
  env: Env,
): Promise<Array<{ id: number; kind: string; message: string; created_at: string; slug: string; name: string }>> {
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.kind, r.message, r.created_at, a.slug, a.name
       FROM reports r
       JOIN apis a ON a.id = r.api_id
      WHERE r.resolved = 0
      ORDER BY r.created_at DESC
      LIMIT 100`,
  ).all<{ id: number; kind: string; message: string; created_at: string; slug: string; name: string }>();

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

export async function stats(env: Env): Promise<{ total: number; free: number; votes: number }> {
  const row = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM apis WHERE status = 'published')                        AS total,
       (SELECT COUNT(*) FROM apis WHERE status = 'published' AND pricing != 'paid')  AS free,
       (SELECT COUNT(*) FROM votes)                                                  AS votes`,
  ).first<{ total: number; free: number; votes: number }>();

  return row ?? { total: 0, free: 0, votes: 0 };
}
