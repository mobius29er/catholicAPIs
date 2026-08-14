import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { html, raw } from 'hono/html';

import type { Auth, Env, Filters, Kind, Listing, Platform, Pricing, Sort, Track } from './types';
import { listingPath } from './types';
import {
  PAGE_SIZE,
  castVote,
  createReport,
  createSubmission,
  deprecationSignals,
  getListing,
  getRelated,
  listByStatus,
  listOpenReports,
  markVerified,
  queryDirectory,
  recentlyAdded,
  resolveReport,
  setDeprecated,
  setStatus,
  stats,
} from './db';
import { runHealthCheck } from './health';
import { checkRateLimit, ipHash, pruneRateLimits, readVoterId, requireVoterId } from './voter';
import { Layout } from './views/layout';
import { Home } from './views/home';
import { Detail } from './views/detail';
import type { DetailNotice } from './views/detail';
import { Submit } from './views/submit';
import { About, Admin, ApiDocs, Message } from './views/pages';

const app = new Hono<{ Bindings: Env }>();

app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      // The only inline script is the pre-paint theme setter in the layout; it
      // is fixed text, never user input, so a hash would be tidier but this
      // stays legible. Turnstile needs its own origin when enabled.
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://challenges.cloudflare.com'],
      frameSrc: ['https://challenges.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
    xFrameOptions: 'DENY',
  }),
);

// The public JSON API is meant to be called from other people's pages.
app.use('/api/v1/*', cors({ origin: '*', allowMethods: ['GET', 'OPTIONS'], maxAge: 86_400 }));

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const PRICING_VALUES = new Set<Pricing>(['free', 'freemium', 'paid']);
const KIND_VALUES = new Set<Kind>(['api', 'dataset', 'library', 'mcp']);
const AUTH_VALUES = new Set<Auth>(['none', 'api-key', 'oauth', 'unknown']);
const SORT_VALUES = new Set<Sort>(['top', 'trending', 'new', 'name']);
const PLATFORM_VALUES = new Set<Platform>(['ios', 'android', 'web', 'desktop', 'parish']);

function parseFilters(url: URL, track: Track = 'api'): Filters {
  const params = url.searchParams;
  const many = <T extends string>(key: string, allowed?: Set<T>): T[] =>
    params
      .getAll(key)
      .flatMap((value) => value.split(',').map((v) => v.trim()))
      .filter((value): value is T => value.length > 0 && (!allowed || allowed.has(value as T)));

  const sort = params.get('sort') as Sort | null;
  const page = Number.parseInt(params.get('page') ?? '1', 10);

  return {
    q: (params.get('q') ?? '').slice(0, 100),
    track,
    pricing: many<Pricing>('pricing', PRICING_VALUES),
    kind: many<Kind>('kind', KIND_VALUES),
    platforms: many<Platform>('platform', PLATFORM_VALUES),
    auth: many<Auth>('auth', AUTH_VALUES),
    categories: many('category').map((c) => c.slice(0, 60)),
    languages: many('lang').map((l) => l.slice(0, 12)),
    openSource: params.get('open_source') === '1',
    noAuth: params.get('no_auth') === '1',
    sort: sort && SORT_VALUES.has(sort) ? sort : 'top',
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1,
  };
}

/**
 * Where this site says it lives.
 *
 * `SITE_URL` wins when set, because production has exactly one canonical
 * hostname and requests arriving on any other one must still point home. But a
 * deploy that has not been given a SITE_URL is not therefore lost: it is
 * serving this request from somewhere, and that somewhere is the honest
 * answer.
 *
 * Which is what makes a bare `*.workers.dev` preview correct with no
 * configuration at all — canonical tags, the sitemap, the feed and the JSON-LD
 * all point at the preview, instead of at a production domain that may not be
 * serving anything yet.
 */
const siteOrigin = (c: Context<{ Bindings: Env }>): string =>
  (c.env.SITE_URL || new URL(c.req.url).origin).replace(/\/$/, '');

const absolute = (c: Context<{ Bindings: Env }>, path: string): string =>
  `${siteOrigin(c)}${path}`;

/** Public shape of a listing in the JSON API — stable, unlike the DB row. */
function publicListing(c: Context<{ Bindings: Env }>, listing: Listing) {
  return {
    slug: listing.slug,
    name: listing.name,
    tagline: listing.tagline,
    description: listing.description,
    url: listing.homepage_url,
    docs_url: listing.docs_url,
    repo_url: listing.repo_url,
    track: listing.track,
    kind: listing.track === 'api' ? listing.kind : undefined,
    platforms: listing.track === 'product' ? listing.platforms : undefined,
    pricing: listing.pricing,
    pricing_note: listing.pricing_note,
    open_source: listing.open_source,
    license: listing.license,
    auth: listing.track === 'api' ? listing.auth : undefined,
    cors: listing.track === 'api' ? listing.cors : undefined,
    official: listing.official,
    categories: listing.categories,
    languages: listing.languages,
    votes: {
      up: listing.upvotes,
      down: listing.downvotes,
      score: listing.score,
      confidence: Number(listing.confidence.toFixed(6)),
    },
    deprecated: listing.deprecated,
    deprecated_note: listing.deprecated_note,
    health: {
      state: listing.health_state,
      status_code: listing.health_code,
      checked_at: listing.health_checked_at,
    },
    listed_via: listing.source ? { name: listing.source, url: listing.source_url } : null,
    added_at: listing.created_at,
    launched_at: listing.launched_at,
    verified_at: listing.verified_at,
    permalink: absolute(c, listingPath(listing)),
  };
}

const escapeXml = (value: string): string =>
  value.replace(/[<>&'"]/g, (ch) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[ch]!,
  );

function wantsJson(c: { req: { header: (name: string) => string | undefined } }): boolean {
  return (c.req.header('accept') ?? '').includes('application/json');
}

// ---------------------------------------------------------------------------
// directory
// ---------------------------------------------------------------------------

/**
 * Both tracks render through the same handler — same filters, same ranking,
 * same markup. Only the copy, the canonical URL and the schema.org type differ.
 */
function directoryRoute(track: Track) {
  return async (c: Context<{ Bindings: Env }>) => {
    const url = new URL(c.req.url);
    const filters = parseFilters(url, track);
    const voterId = await readVoterId(c);

    const [result, counts] = await Promise.all([
      queryDirectory(c.env, filters, voterId),
      stats(c.env),
    ]);

    const root = track === 'product' ? '/' : '/apis';
    const isLanding = url.search === '';

    /*
      The brand leads, but the searchable words stay: nobody types "FidesHunt"
      until they already know it exists, and "Catholic apps" is what they
      actually search. The track labels below stay descriptive for the same
      reason — they describe the catalogue, not the company.
    */
    const title = isLanding
      ? track === 'product'
        ? 'FidesHunt — Catholic apps and services, ranked by the people who use them'
        : 'FidesHunt — free and paid APIs for Catholic software, ranked by developers'
      : `${filters.q ? `${filters.q} — ` : ''}${track === 'product' ? 'Catholic products' : 'Catholic APIs'}`;

    const description =
      track === 'product'
        ? 'A community-ranked directory of Catholic software: prayer apps, breviaries, formation, parish tools, media and AI. Free and paid, upvoted by the people who use them.'
        : 'A community-ranked directory of Catholic APIs, datasets and libraries: liturgical calendars, daily readings, scripture, the Catechism, canon law, prayers and saints. Free and paid.';

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: track === 'product' ? 'Catholic products' : 'Catholic APIs',
      numberOfItems: result.total,
      itemListElement: result.listings.map((listing, index) => ({
        '@type': 'ListItem',
        position: (result.page - 1) * PAGE_SIZE + index + 1,
        url: absolute(c, listingPath(listing)),
        name: listing.name,
        description: listing.tagline,
      })),
    };

    return c.html(
      <Layout
        title={title}
        description={description}
        canonical={absolute(c, isLanding ? root : `${root}${url.search}`)}
        siteName={c.env.SITE_NAME ?? 'FidesHunt'}
        jsonLd={jsonLd}
        noindex={!isLanding && result.total === 0}
        active={root}
        searchAction={root}
      >
        <Home result={result} filters={filters} stats={counts} />
      </Layout>,
    );
  };
}

app.get('/', directoryRoute('product'));
app.get('/apis', directoryRoute('api'));

function detailRoute(track: Track) {
  return async (c: Context<{ Bindings: Env }>) => {
    const voterId = await readVoterId(c);
    const listing = await getListing(c.env, c.req.param('slug') ?? '', voterId);

    if (!listing) return notFound(c);

    // A listing has exactly one canonical URL. Reaching it under the other
    // track's prefix redirects rather than serving a duplicate.
    if (listing.track !== track) return c.redirect(listingPath(listing), 301);

    const related = await getRelated(c.env, listing);

    const reported = c.req.query('reported');
    const notice: DetailNotice =
      c.req.query('error') === 'rate-limited'
        ? 'rate-limited'
        : reported === 'deprecated'
          ? 'reported-deprecated'
          : reported === 'revived'
            ? 'reported-revived'
            : reported
              ? 'reported'
              : null;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': listing.track === 'api' ? 'WebAPI' : 'SoftwareApplication',
      name: listing.name,
      description: listing.tagline,
      url: listing.homepage_url,
      ...(listing.track === 'api'
        ? { documentation: listing.docs_url ?? undefined }
        : {
            applicationCategory: listing.categories[0],
            operatingSystem: listing.platforms.join(', ') || undefined,
          }),
      isAccessibleForFree: listing.pricing === 'free',
      ...(listing.upvotes + listing.downvotes > 0 && {
        aggregateRating: {
          '@type': 'AggregateRating',
          // Votes are up/down, so the rating is expressed on a 1-2 scale rather
          // than pretending to be five stars.
          ratingValue: Number(
            (1 + listing.upvotes / (listing.upvotes + listing.downvotes)).toFixed(2),
          ),
          bestRating: 2,
          worstRating: 1,
          ratingCount: listing.upvotes + listing.downvotes,
        },
      }),
    };

    return c.html(
      <Layout
        title={`${listing.name} — ${listing.tagline}`}
        description={listing.tagline}
        canonical={absolute(c, listingPath(listing))}
        siteName={c.env.SITE_NAME ?? 'FidesHunt'}
        jsonLd={jsonLd}
      >
        <Detail listing={listing} related={related} notice={notice} />
      </Layout>,
    );
  };
}

app.get('/apis/:slug', detailRoute('api'));
app.get('/products/:slug', detailRoute('product'));

// ---------------------------------------------------------------------------
// voting
// ---------------------------------------------------------------------------

const voteHandler = async (c: Context<{ Bindings: Env }>) => {
  const slug = c.req.param('slug') ?? '';
  const body = await c.req.parseBody();
  const rawValue = Number(body.value);
  const value: -1 | 1 | null = rawValue === 1 ? 1 : rawValue === -1 ? -1 : null;

  const listing = await getListing(c.env, slug, null);
  const back = listing ? listingPath(listing) : '/';

  if (value === null) {
    return wantsJson(c) ? c.json({ error: 'value must be 1 or -1' }, 400) : c.redirect(back, 303);
  }

  const hash = await ipHash(c);
  const { allowed } = await checkRateLimit(c.env, 'vote', hash);
  if (!allowed) {
    return wantsJson(c)
      ? c.json({ error: 'Too many votes from this address. Try again later.' }, 429)
      : c.redirect(`${back}?error=rate-limited`, 303);
  }

  if (!listing) return notFound(c);

  const voterId = await requireVoterId(c);
  const result = await castVote(c.env, listing.id, voterId, value, hash);
  if (!result) return notFound(c);

  if (wantsJson(c)) return c.json(result);

  // Without JavaScript, come back to where the vote was cast.
  const referer = c.req.header('referer');
  const target = referer?.startsWith(absolute(c, '/')) ? referer : back;
  return c.redirect(target, 303);
};

app.post('/apis/:slug/vote', voteHandler);
app.post('/products/:slug/vote', voteHandler);

// ---------------------------------------------------------------------------
// reports
// ---------------------------------------------------------------------------

/**
 * Must stay in step with the CHECK constraint on `reports.kind`. Exported so a
 * test can hold the two against each other — drift here fails at INSERT time,
 * in production, on a form a reader just submitted.
 */
export const REPORT_KINDS = new Set([
  'dead-link',
  'deprecated',
  'moved',
  'wrong-info',
  'duplicate',
  'revived',
  'other',
]);

const reportHandler = async (c: Context<{ Bindings: Env }>) => {
  const slug = c.req.param('slug') ?? '';
  const body = await c.req.parseBody();

  const listing = await getListing(c.env, slug, null);
  if (!listing) return notFound(c);

  const back = listingPath(listing);

  const hash = await ipHash(c);
  const { allowed } = await checkRateLimit(c.env, 'report', hash);
  if (!allowed) return c.redirect(`${back}?error=rate-limited`, 303);

  const kind = String(body.kind ?? 'other');
  const valid = REPORT_KINDS.has(kind) ? kind : 'other';

  await createReport(c.env, listing.id, valid, String(body.message ?? ''), hash);

  // The two one-click reports get their own confirmation, because "thanks,
  // logged" reads oddly when what you just said was "this one is fine again".
  const acknowledgement =
    valid === 'deprecated' || valid === 'revived' ? valid : '1';
  return c.redirect(`${back}?reported=${acknowledgement}`, 303);
};

app.post('/apis/:slug/report', reportHandler);
app.post('/products/:slug/report', reportHandler);

// ---------------------------------------------------------------------------
// submissions
// ---------------------------------------------------------------------------

app.get('/submit', (c) => {
  const track: Track = c.req.query('track') === 'product' ? 'product' : 'api';

  return c.html(
    <Layout
      title="Submit to FidesHunt"
      description="Add an app, service, API, dataset or library to the directory. Reviewed by hand before publishing."
      canonical={absolute(c, '/submit')}
      siteName={c.env.SITE_NAME ?? 'FidesHunt'}
      active="/submit"
    >
      <Submit values={{ track }} turnstileSiteKey={c.env.TURNSTILE_SITEKEY} />
    </Layout>,
  );
});

async function verifyTurnstile(env: Env, token: string, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true;

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
  });

  const outcome = (await response.json()) as { success?: boolean };
  return outcome.success === true;
}

const splitList = (value: string, limit: number): string[] =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, limit);

app.post('/submit', async (c) => {
  const body = await c.req.parseBody();
  const values = Object.fromEntries(
    Object.entries(body).map(([k, v]) => [k, typeof v === 'string' ? v : '']),
  ) as Record<string, string>;

  const errors: string[] = [];

  // Honeypot: a real browser leaves this empty. Fail silently-ish so the bot
  // learns nothing from the response.
  if (values.website) {
    return c.html(
      <Layout
        title="Thank you"
        description="Submission received."
        canonical={absolute(c, '/submit')}
        siteName={c.env.SITE_NAME ?? 'FidesHunt'}
        noindex
      >
        <Message title="Thank you" body="Your submission has been received for review." />
      </Layout>,
    );
  }

  const hash = await ipHash(c);
  const { allowed } = await checkRateLimit(c.env, 'submit', hash);
  if (!allowed) errors.push('Too many submissions from this address in the last hour.');

  if (
    !(await verifyTurnstile(
      c.env,
      String(body['cf-turnstile-response'] ?? ''),
      c.req.header('CF-Connecting-IP') ?? '',
    ))
  ) {
    errors.push('The anti-spam check did not pass. Please try again.');
  }

  const name = (values.name ?? '').trim();
  const tagline = (values.tagline ?? '').trim();
  const homepage = (values.homepage_url ?? '').trim();
  const categories = splitList(values.categories ?? '', 6);

  if (name.length < 2) errors.push('A name is required.');
  if (tagline.length < 10) errors.push('The one-line summary is too short to be useful.');
  if (categories.length === 0) errors.push('Give it at least one category.');

  for (const [field, label] of [
    ['homepage_url', 'Homepage URL'],
    ['docs_url', 'Documentation URL'],
    ['repo_url', 'Source repository'],
  ] as const) {
    const value = (values[field] ?? '').trim();
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('scheme');
    } catch {
      errors.push(`${label} must be a valid http(s) URL.`);
    }
  }
  if (!homepage) errors.push('A homepage URL is required.');

  if (errors.length > 0) {
    return c.html(
      <Layout
        title="Submit a Catholic API"
        description="Add an API to the FidesHunt directory."
        canonical={absolute(c, '/submit')}
        siteName={c.env.SITE_NAME ?? 'FidesHunt'}
        noindex
        active="/submit"
      >
        <Submit errors={errors} values={values} turnstileSiteKey={c.env.TURNSTILE_SITEKEY} />
      </Layout>,
      422,
    );
  }

  const track: Track = values.track === 'product' ? 'product' : 'api';

  await createSubmission(c.env, {
    track,
    name: name.slice(0, 120),
    tagline: tagline.slice(0, 160),
    description: (values.description ?? '').trim().slice(0, 2000),
    homepage_url: homepage,
    docs_url: (values.docs_url ?? '').trim() || null,
    repo_url: (values.repo_url ?? '').trim() || null,
    kind: KIND_VALUES.has(values.kind as Kind) ? values.kind : 'api',
    platforms:
      track === 'product'
        ? splitList((values.platforms ?? '').toLowerCase(), 5).filter((p) =>
            PLATFORM_VALUES.has(p as Platform),
          )
        : [],
    // Only accept a launch date the submitter actually supplied. A guessed date
    // would light up the "just launched" flash for something years old.
    launched_at: /^\d{4}-\d{2}-\d{2}$/.test(values.launched_at ?? '')
      ? values.launched_at
      : null,
    pricing: PRICING_VALUES.has(values.pricing as Pricing) ? values.pricing : 'free',
    open_source: values.open_source === '1',
    auth: track === 'api' && AUTH_VALUES.has(values.auth as Auth) ? values.auth : 'unknown',
    categories,
    languages: splitList((values.languages ?? '').toLowerCase(), 12),
    submitter: (values.submitter ?? '').trim().slice(0, 80) || null,
    submitter_note: (values.submitter_note ?? '').trim().slice(0, 500) || null,
  });

  return c.html(
    <Layout
      title="Submission received"
      description="Thank you for adding to the directory."
      canonical={absolute(c, '/submit')}
      siteName={c.env.SITE_NAME ?? 'FidesHunt'}
      noindex
    >
      <Message
        title="Received — thank you"
        body="A maintainer will check the links and details before it goes live. If we have questions and you left a name, we'll try to reach you."
        cta={{ href: '/', label: 'Back to the directory' }}
      />
    </Layout>,
  );
});

// ---------------------------------------------------------------------------
// static pages
// ---------------------------------------------------------------------------

app.get('/about', (c) =>
  c.html(
    <Layout
      title="About FidesHunt"
      description="What gets listed, how the Wilson-score ranking works, how voting works, and how to correct a listing."
      canonical={absolute(c, '/about')}
      siteName={c.env.SITE_NAME ?? 'FidesHunt'}
      active="/about"
    >
      <About siteUrl={siteOrigin(c)} />
    </Layout>,
  ),
);

app.get('/api/v1', (c) =>
  c.html(
    <Layout
      title="JSON API — FidesHunt"
      description="The directory is itself a free JSON API: list, filter and sort every Catholic API listing. No key, CORS open."
      canonical={absolute(c, '/api/v1')}
      siteName={c.env.SITE_NAME ?? 'FidesHunt'}
      active="/api/v1"
    >
      <ApiDocs siteUrl={siteOrigin(c)} />
    </Layout>,
  ),
);

// ---------------------------------------------------------------------------
// JSON API
// ---------------------------------------------------------------------------

/** GET /api/v1/apis and /api/v1/products share one implementation. */
function listEndpoint(track: Track) {
  return async (c: Context<{ Bindings: Env }>) => {
    const filters = parseFilters(new URL(c.req.url), track);
    const result = await queryDirectory(c.env, filters, null);

    c.header('cache-control', 'public, max-age=60, stale-while-revalidate=600');

    return c.json({
      meta: {
        track,
        total: result.total,
        page: result.page,
        page_count: result.pageCount,
        page_size: PAGE_SIZE,
        sort: filters.sort,
        docs: absolute(c, '/api/v1'),
      },
      data: result.listings.map((listing) => publicListing(c, listing)),
    });
  };
}

app.get('/api/v1/apis', listEndpoint('api'));
app.get('/api/v1/products', listEndpoint('product'));

/**
 * Slugs are unique across both tracks, so a single lookup endpoint serves
 * either. The older /api/v1/apis/:slug path stays as an alias.
 */
const lookupEndpoint = async (c: Context<{ Bindings: Env }>) => {
  const listing = await getListing(c.env, c.req.param('slug') ?? '', null);
  if (!listing) return c.json({ error: 'not_found' }, 404);

  const related = await getRelated(c.env, listing);

  c.header('cache-control', 'public, max-age=60, stale-while-revalidate=600');

  return c.json({
    data: publicListing(c, listing),
    related: related.map((item) => ({
      slug: item.slug,
      name: item.name,
      tagline: item.tagline,
      permalink: absolute(c, listingPath(item)),
    })),
  });
};

app.get('/api/v1/listings/:slug', lookupEndpoint);
app.get('/api/v1/apis/:slug', lookupEndpoint);
app.get('/api/v1/products/:slug', lookupEndpoint);

app.get('/api/v1/categories', async (c) => {
  const [apis, products] = await Promise.all([
    queryDirectory(c.env, parseFilters(new URL('https://x/'), 'api'), null),
    queryDirectory(c.env, parseFilters(new URL('https://x/'), 'product'), null),
  ]);

  c.header('cache-control', 'public, max-age=300, stale-while-revalidate=3600');

  return c.json({
    data: {
      api: apis.facets.categories.map((facet) => ({
        name: facet.value,
        count: facet.count,
        url: absolute(c, `/apis?category=${encodeURIComponent(facet.value)}`),
      })),
      product: products.facets.categories.map((facet) => ({
        name: facet.value,
        count: facet.count,
        url: absolute(c, `/?category=${encodeURIComponent(facet.value)}`),
      })),
    },
  });
});

// ---------------------------------------------------------------------------
// feeds and crawlers
// ---------------------------------------------------------------------------

app.get('/feed.xml', async (c) => {
  // Both tracks in one feed, newest first — a subscriber wants to know what
  // joined the directory, not which half it joined.
  const [apis, products] = await Promise.all([
    recentlyAdded(c.env, 'api', 20),
    recentlyAdded(c.env, 'product', 20),
  ]);

  const items = [...apis, ...products]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 30);

  const site = siteOrigin(c);

  const body = html`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>FidesHunt — newest listings</title>
    <link>${site}/</link>
    <atom:link href="${site}/feed.xml" rel="self" type="application/rss+xml" />
    <description>New Catholic apps, services, APIs and datasets, as they are added.</description>
    <language>en</language>
    ${raw(
      items
        .map(
          (listing) => `<item>
      <title>${escapeXml(listing.name)}</title>
      <link>${site}${listingPath(listing)}</link>
      <guid isPermaLink="true">${site}${listingPath(listing)}</guid>
      <pubDate>${new Date(`${listing.created_at.replace(/Z?$/, 'Z')}`).toUTCString()}</pubDate>
      <description>${escapeXml(listing.tagline)}</description>
      <category>${escapeXml(listing.categories[0] ?? 'Catholic software')}</category>
    </item>`,
        )
        .join('\n    '),
    )}
  </channel>
</rss>`;

  c.header('content-type', 'application/rss+xml; charset=utf-8');
  c.header('cache-control', 'public, max-age=900');
  return c.body(body.toString());
});

app.get('/sitemap.xml', async (c) => {
  const site = siteOrigin(c);

  /** Walks every page of a track so no listing is left out of the sitemap. */
  async function allOf(track: Track) {
    const first = await queryDirectory(c.env, parseFilters(new URL('https://x/'), track), null);
    const listings: Listing[] = [...first.listings];

    for (let page = 2; page <= first.pageCount; page++) {
      const chunk = await queryDirectory(
        c.env,
        { ...parseFilters(new URL('https://x/'), track), page },
        null,
      );
      listings.push(...chunk.listings);
    }

    return { listings, facets: first.facets };
  }

  const [apiTrack, productTrack] = await Promise.all([allOf('api'), allOf('product')]);

  const urls = [
    { loc: `${site}/`, priority: '1.0' },
    { loc: `${site}/apis`, priority: '0.9' },
    { loc: `${site}/about`, priority: '0.5' },
    { loc: `${site}/submit`, priority: '0.5' },
    { loc: `${site}/api/v1`, priority: '0.6' },
    ...productTrack.facets.categories.map((facet) => ({
      loc: `${site}/?category=${encodeURIComponent(facet.value)}`,
      priority: '0.4',
    })),
    ...apiTrack.facets.categories.map((facet) => ({
      loc: `${site}/apis?category=${encodeURIComponent(facet.value)}`,
      priority: '0.4',
    })),
  ];

  const listings = [...productTrack.listings, ...apiTrack.listings];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((url) => `  <url><loc>${escapeXml(url.loc)}</loc><priority>${url.priority}</priority></url>`)
  .join('\n')}
${listings
  .map(
    (listing) =>
      `  <url><loc>${site}${listingPath(listing)}</loc><lastmod>${listing.updated_at.slice(0, 10)}</lastmod><priority>0.8</priority></url>`,
  )
  .join('\n')}
</urlset>`;

  c.header('content-type', 'application/xml; charset=utf-8');
  c.header('cache-control', 'public, max-age=3600');
  return c.body(body);
});

app.get('/robots.txt', (c) => {
  const site = siteOrigin(c);
  c.header('content-type', 'text/plain; charset=utf-8');
  return c.body(
    [
      'User-agent: *',
      'Allow: /',
      // Faceted URLs are near-infinite and near-duplicate; keep crawlers on the
      // canonical pages.
      'Disallow: /*?*category=',
      'Disallow: /*?*lang=',
      'Disallow: /*?*page=',
      'Disallow: /admin',
      '',
      `Sitemap: ${site}/sitemap.xml`,
      '',
    ].join('\n'),
  );
});

// ---------------------------------------------------------------------------
// moderation
// ---------------------------------------------------------------------------

function adminToken(c: { req: { header: (n: string) => string | undefined; query: (n: string) => string | undefined } }): string {
  return (
    c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? c.req.query('token') ?? ''
  );
}

function adminOk(env: Env, token: string): boolean {
  // Without ADMIN_TOKEN configured the queue stays shut rather than open.
  if (!env.ADMIN_TOKEN) return false;
  if (token.length !== env.ADMIN_TOKEN.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ env.ADMIN_TOKEN.charCodeAt(i);
  return diff === 0;
}

app.get('/admin', async (c) => {
  const token = adminToken(c);
  if (!adminOk(c.env, token)) return c.text('Not authorised', 401);

  const [pending, reports, signals, counts] = await Promise.all([
    listByStatus(c.env, 'pending'),
    listOpenReports(c.env),
    deprecationSignals(c.env),
    stats(c.env),
  ]);

  return c.html(
    <Layout
      title="Moderation"
      description="Moderation queue"
      canonical={absolute(c, '/admin')}
      siteName={c.env.SITE_NAME ?? 'FidesHunt'}
      noindex
    >
      <Admin
        pending={pending}
        reports={reports}
        signals={signals}
        stats={counts}
        token={token}
      />
    </Layout>,
  );
});

app.post('/admin/moderate', async (c) => {
  const body = await c.req.parseBody();
  const token = String(body.token ?? '') || adminToken(c);
  if (!adminOk(c.env, token)) return c.text('Not authorised', 401);

  const status = String(body.status ?? '');
  if (status !== 'published' && status !== 'rejected') return c.text('Bad status', 400);

  await setStatus(c.env, String(body.slug ?? ''), status);
  return c.redirect(`/admin?token=${encodeURIComponent(token)}`, 303);
});

app.post('/admin/verify', async (c) => {
  const body = await c.req.parseBody();
  const token = String(body.token ?? '') || adminToken(c);
  if (!adminOk(c.env, token)) return c.text('Not authorised', 401);

  await markVerified(c.env, String(body.slug ?? ''));
  return c.redirect(`/admin?token=${encodeURIComponent(token)}`, 303);
});

app.post('/admin/deprecate', async (c) => {
  const body = await c.req.parseBody();
  const token = String(body.token ?? '') || adminToken(c);
  if (!adminOk(c.env, token)) return c.text('Not authorised', 401);

  await setDeprecated(
    c.env,
    String(body.slug ?? ''),
    body.deprecated === '1',
    String(body.note ?? '').slice(0, 500) || null,
  );
  return c.redirect(`/admin?token=${encodeURIComponent(token)}`, 303);
});

/** Runs a batch of uptime probes on demand; the cron does the same on a timer. */
app.post('/admin/health', async (c) => {
  const body = await c.req.parseBody();
  const token = String(body.token ?? '') || adminToken(c);
  if (!adminOk(c.env, token)) return c.text('Not authorised', 401);

  const outcome = await runHealthCheck(c.env);
  if (wantsJson(c)) return c.json(outcome);
  return c.redirect(`/admin?token=${encodeURIComponent(token)}`, 303);
});

app.post('/admin/resolve', async (c) => {
  const body = await c.req.parseBody();
  const token = String(body.token ?? '') || adminToken(c);
  if (!adminOk(c.env, token)) return c.text('Not authorised', 401);

  await resolveReport(c.env, Number(body.id));
  await pruneRateLimits(c.env);
  return c.redirect(`/admin?token=${encodeURIComponent(token)}`, 303);
});

// ---------------------------------------------------------------------------
// errors
// ---------------------------------------------------------------------------

function notFound(c: Context<{ Bindings: Env }>) {
  return c.html(
    <Layout
      title="Not found — FidesHunt"
      description="That page doesn't exist."
      canonical={absolute(c, '/')}
      siteName={c.env.SITE_NAME ?? 'FidesHunt'}
      noindex
    >
      <Message
        title="Not found"
        body="That listing doesn't exist, or it was unpublished after a report."
        cta={{ href: '/', label: 'Browse the directory' }}
      />
    </Layout>,
    404,
  );
}

app.notFound((c) => notFound(c));

app.onError((err, c) => {
  console.error('Unhandled error:', err);

  if (c.req.path.startsWith('/api/')) return c.json({ error: 'internal_error' }, 500);

  return c.html(
    <Layout
      title="Something went wrong — FidesHunt"
      description="An unexpected error occurred."
      canonical={absolute(c, '/')}
      siteName={c.env.SITE_NAME ?? 'FidesHunt'}
      noindex
    >
      <Message
        title="Something went wrong"
        body="That's on us. Try again in a moment."
        cta={{ href: '/', label: 'Back to the directory' }}
      />
    </Layout>,
    500,
  );
});

export default {
  fetch: app.fetch,

  /**
   * Cron entry point. Probes a batch of listings so the directory notices when
   * something it points at stops answering — see src/health.ts for why one
   * failed probe is not treated as an outage.
   */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const outcome = await runHealthCheck(env);
        console.log(
          `health: checked ${outcome.checked}, up ${outcome.up}, down ${outcome.down}, unknown ${outcome.unknown}`,
        );
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
