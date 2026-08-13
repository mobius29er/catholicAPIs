import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { html, raw } from 'hono/html';

import type { Auth, Env, Filters, Kind, Listing, Pricing, Sort } from './types';
import {
  PAGE_SIZE,
  castVote,
  createReport,
  createSubmission,
  getListing,
  getRelated,
  listByStatus,
  listOpenReports,
  markVerified,
  queryDirectory,
  resolveReport,
  setStatus,
  stats,
} from './db';
import { checkRateLimit, ipHash, pruneRateLimits, readVoterId, requireVoterId } from './voter';
import { Layout } from './views/layout';
import { Home } from './views/home';
import { Detail } from './views/detail';
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

function parseFilters(url: URL): Filters {
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
    pricing: many<Pricing>('pricing', PRICING_VALUES),
    kind: many<Kind>('kind', KIND_VALUES),
    auth: many<Auth>('auth', AUTH_VALUES),
    categories: many('category').map((c) => c.slice(0, 60)),
    languages: many('lang').map((l) => l.slice(0, 12)),
    openSource: params.get('open_source') === '1',
    noAuth: params.get('no_auth') === '1',
    sort: sort && SORT_VALUES.has(sort) ? sort : 'top',
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1,
  };
}

const absolute = (env: Env, path: string): string =>
  `${(env.SITE_URL ?? 'https://catholicapis.com').replace(/\/$/, '')}${path}`;

/** Public shape of a listing in the JSON API — stable, unlike the DB row. */
function publicListing(env: Env, listing: Listing) {
  return {
    slug: listing.slug,
    name: listing.name,
    tagline: listing.tagline,
    description: listing.description,
    url: listing.homepage_url,
    docs_url: listing.docs_url,
    repo_url: listing.repo_url,
    kind: listing.kind,
    pricing: listing.pricing,
    pricing_note: listing.pricing_note,
    open_source: listing.open_source,
    license: listing.license,
    auth: listing.auth,
    cors: listing.cors,
    official: listing.official,
    categories: listing.categories,
    languages: listing.languages,
    votes: {
      up: listing.upvotes,
      down: listing.downvotes,
      score: listing.score,
      confidence: Number(listing.confidence.toFixed(6)),
    },
    added_at: listing.created_at,
    verified_at: listing.verified_at,
    permalink: absolute(env, `/apis/${listing.slug}`),
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

app.get('/', async (c) => {
  const url = new URL(c.req.url);
  const filters = parseFilters(url);
  const voterId = await readVoterId(c);

  const [result, counts] = await Promise.all([
    queryDirectory(c.env, filters, voterId),
    stats(c.env),
  ]);

  const isLanding = url.search === '';
  const title = isLanding
    ? 'Catholic APIs — free and paid APIs for Catholic software, ranked by developers'
    : `${filters.q ? `${filters.q} — ` : ''}Catholic APIs directory`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Catholic APIs',
    numberOfItems: result.total,
    itemListElement: result.listings.map((listing, index) => ({
      '@type': 'ListItem',
      position: (result.page - 1) * PAGE_SIZE + index + 1,
      url: absolute(c.env, `/apis/${listing.slug}`),
      name: listing.name,
      description: listing.tagline,
    })),
  };

  return c.html(
    <Layout
      title={title}
      description="A community-ranked directory of Catholic APIs, datasets and libraries: liturgical calendars, daily readings, scripture, the Catechism, canon law, prayers and saints. Free and paid."
      canonical={absolute(c.env, isLanding ? '/' : `/${url.search}`)}
      siteName={c.env.SITE_NAME ?? 'Catholic APIs'}
      jsonLd={jsonLd}
      noindex={!isLanding && result.total === 0}
      active="/"
    >
      <Home result={result} filters={filters} stats={counts} />
    </Layout>,
  );
});

app.get('/apis/:slug', async (c) => {
  const voterId = await readVoterId(c);
  const listing = await getListing(c.env, c.req.param('slug'), voterId);

  if (!listing) return notFound(c);

  const related = await getRelated(c.env, listing);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebAPI',
    name: listing.name,
    description: listing.tagline,
    url: listing.homepage_url,
    documentation: listing.docs_url ?? undefined,
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
      canonical={absolute(c.env, `/apis/${listing.slug}`)}
      siteName={c.env.SITE_NAME ?? 'Catholic APIs'}
      jsonLd={jsonLd}
    >
      <Detail listing={listing} related={related} />
    </Layout>,
  );
});

// ---------------------------------------------------------------------------
// voting
// ---------------------------------------------------------------------------

app.post('/apis/:slug/vote', async (c) => {
  const slug = c.req.param('slug');
  const body = await c.req.parseBody();
  const raw = Number(body.value);
  const value: -1 | 1 | null = raw === 1 ? 1 : raw === -1 ? -1 : null;

  if (value === null) {
    return wantsJson(c)
      ? c.json({ error: 'value must be 1 or -1' }, 400)
      : c.redirect(`/apis/${slug}`, 303);
  }

  const hash = await ipHash(c);
  const { allowed } = await checkRateLimit(c.env, 'vote', hash);
  if (!allowed) {
    return wantsJson(c)
      ? c.json({ error: 'Too many votes from this address. Try again later.' }, 429)
      : c.redirect(`/apis/${slug}?error=rate-limited`, 303);
  }

  const voterId = await requireVoterId(c);
  const listing = await getListing(c.env, slug, voterId);
  if (!listing) return notFound(c);

  const result = await castVote(c.env, listing.id, voterId, value, hash);
  if (!result) return notFound(c);

  if (wantsJson(c)) return c.json(result);

  // Without JavaScript, come back to where the vote was cast.
  const referer = c.req.header('referer');
  const back = referer?.startsWith(absolute(c.env, '/')) ? referer : `/apis/${slug}`;
  return c.redirect(back, 303);
});

// ---------------------------------------------------------------------------
// reports
// ---------------------------------------------------------------------------

app.post('/apis/:slug/report', async (c) => {
  const slug = c.req.param('slug');
  const body = await c.req.parseBody();

  const hash = await ipHash(c);
  const { allowed } = await checkRateLimit(c.env, 'report', hash);
  if (!allowed) return c.redirect(`/apis/${slug}?error=rate-limited`, 303);

  const listing = await getListing(c.env, slug, null);
  if (!listing) return notFound(c);

  const kind = String(body.kind ?? 'other');
  const valid = ['dead-link', 'wrong-info', 'duplicate', 'other'].includes(kind) ? kind : 'other';

  await createReport(c.env, listing.id, valid, String(body.message ?? ''), hash);

  return c.redirect(`/apis/${slug}?reported=1`, 303);
});

// ---------------------------------------------------------------------------
// submissions
// ---------------------------------------------------------------------------

app.get('/submit', (c) =>
  c.html(
    <Layout
      title="Submit a Catholic API"
      description="Add an API, dataset, library or MCP server to the Catholic APIs directory. Reviewed by hand before publishing."
      canonical={absolute(c.env, '/submit')}
      siteName={c.env.SITE_NAME ?? 'Catholic APIs'}
      active="/submit"
    >
      <Submit turnstileSiteKey={c.env.TURNSTILE_SITEKEY} />
    </Layout>,
  ),
);

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
        canonical={absolute(c.env, '/submit')}
        siteName={c.env.SITE_NAME ?? 'Catholic APIs'}
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
        description="Add an API to the Catholic APIs directory."
        canonical={absolute(c.env, '/submit')}
        siteName={c.env.SITE_NAME ?? 'Catholic APIs'}
        noindex
        active="/submit"
      >
        <Submit errors={errors} values={values} turnstileSiteKey={c.env.TURNSTILE_SITEKEY} />
      </Layout>,
      422,
    );
  }

  await createSubmission(c.env, {
    name: name.slice(0, 120),
    tagline: tagline.slice(0, 160),
    description: (values.description ?? '').trim().slice(0, 2000),
    homepage_url: homepage,
    docs_url: (values.docs_url ?? '').trim() || null,
    repo_url: (values.repo_url ?? '').trim() || null,
    kind: KIND_VALUES.has(values.kind as Kind) ? values.kind : 'api',
    pricing: PRICING_VALUES.has(values.pricing as Pricing) ? values.pricing : 'free',
    open_source: values.open_source === '1',
    auth: AUTH_VALUES.has(values.auth as Auth) ? values.auth : 'unknown',
    categories,
    languages: splitList((values.languages ?? '').toLowerCase(), 12),
    submitter: (values.submitter ?? '').trim().slice(0, 80) || null,
    submitter_note: (values.submitter_note ?? '').trim().slice(0, 500) || null,
  });

  return c.html(
    <Layout
      title="Submission received"
      description="Thank you for adding to the directory."
      canonical={absolute(c.env, '/submit')}
      siteName={c.env.SITE_NAME ?? 'Catholic APIs'}
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
      title="About the Catholic APIs directory"
      description="What gets listed, how the Wilson-score ranking works, how voting works, and how to correct a listing."
      canonical={absolute(c.env, '/about')}
      siteName={c.env.SITE_NAME ?? 'Catholic APIs'}
      active="/about"
    >
      <About siteUrl={(c.env.SITE_URL ?? '').replace(/\/$/, '')} />
    </Layout>,
  ),
);

app.get('/api/v1', (c) =>
  c.html(
    <Layout
      title="JSON API — Catholic APIs"
      description="The directory is itself a free JSON API: list, filter and sort every Catholic API listing. No key, CORS open."
      canonical={absolute(c.env, '/api/v1')}
      siteName={c.env.SITE_NAME ?? 'Catholic APIs'}
      active="/api/v1"
    >
      <ApiDocs siteUrl={(c.env.SITE_URL ?? '').replace(/\/$/, '')} />
    </Layout>,
  ),
);

// ---------------------------------------------------------------------------
// JSON API
// ---------------------------------------------------------------------------

app.get('/api/v1/apis', async (c) => {
  const filters = parseFilters(new URL(c.req.url));
  const result = await queryDirectory(c.env, filters, null);

  c.header('cache-control', 'public, max-age=60, stale-while-revalidate=600');

  return c.json({
    meta: {
      total: result.total,
      page: result.page,
      page_count: result.pageCount,
      page_size: PAGE_SIZE,
      sort: filters.sort,
      docs: absolute(c.env, '/api/v1'),
    },
    data: result.listings.map((listing) => publicListing(c.env, listing)),
  });
});

app.get('/api/v1/apis/:slug', async (c) => {
  const listing = await getListing(c.env, c.req.param('slug'), null);
  if (!listing) return c.json({ error: 'not_found' }, 404);

  const related = await getRelated(c.env, listing);

  c.header('cache-control', 'public, max-age=60, stale-while-revalidate=600');

  return c.json({
    data: publicListing(c.env, listing),
    related: related.map((item) => ({
      slug: item.slug,
      name: item.name,
      tagline: item.tagline,
      permalink: absolute(c.env, `/apis/${item.slug}`),
    })),
  });
});

app.get('/api/v1/categories', async (c) => {
  const result = await queryDirectory(c.env, parseFilters(new URL('https://x/')), null);

  c.header('cache-control', 'public, max-age=300, stale-while-revalidate=3600');

  return c.json({
    data: result.facets.categories.map((facet) => ({
      name: facet.value,
      count: facet.count,
      url: absolute(c.env, `/?category=${encodeURIComponent(facet.value)}`),
    })),
  });
});

// ---------------------------------------------------------------------------
// feeds and crawlers
// ---------------------------------------------------------------------------

app.get('/feed.xml', async (c) => {
  const result = await queryDirectory(
    c.env,
    { ...parseFilters(new URL('https://x/')), sort: 'new' },
    null,
  );
  // One page of newest-first listings; a feed reader only needs the recent tail.
  const items = result.listings;
  const site = (c.env.SITE_URL ?? '').replace(/\/$/, '');

  const body = html`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Catholic APIs — newest listings</title>
    <link>${site}/</link>
    <atom:link href="${site}/feed.xml" rel="self" type="application/rss+xml" />
    <description>New APIs, datasets and libraries for building Catholic software.</description>
    <language>en</language>
    ${raw(
      items
        .map(
          (listing) => `<item>
      <title>${escapeXml(listing.name)}</title>
      <link>${site}/apis/${listing.slug}</link>
      <guid isPermaLink="true">${site}/apis/${listing.slug}</guid>
      <pubDate>${new Date(`${listing.created_at.replace(/Z?$/, 'Z')}`).toUTCString()}</pubDate>
      <description>${escapeXml(listing.tagline)}</description>
      <category>${escapeXml(listing.categories[0] ?? 'API')}</category>
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
  const result = await queryDirectory(
    c.env,
    { ...parseFilters(new URL('https://x/')), page: 1 },
    null,
  );
  const site = (c.env.SITE_URL ?? '').replace(/\/$/, '');

  const urls = [
    { loc: `${site}/`, priority: '1.0' },
    { loc: `${site}/about`, priority: '0.5' },
    { loc: `${site}/submit`, priority: '0.5' },
    { loc: `${site}/api/v1`, priority: '0.6' },
    ...result.facets.categories.map((facet) => ({
      loc: `${site}/?category=${encodeURIComponent(facet.value)}`,
      priority: '0.4',
    })),
  ];

  // queryDirectory paginates; walk every page so no listing is left out.
  const all: Listing[] = [];
  for (let page = 1; page <= result.pageCount; page++) {
    const chunk = await queryDirectory(
      c.env,
      { ...parseFilters(new URL('https://x/')), page },
      null,
    );
    all.push(...chunk.listings);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((url) => `  <url><loc>${escapeXml(url.loc)}</loc><priority>${url.priority}</priority></url>`)
  .join('\n')}
${all
  .map(
    (listing) =>
      `  <url><loc>${site}/apis/${listing.slug}</loc><lastmod>${listing.updated_at.slice(0, 10)}</lastmod><priority>0.8</priority></url>`,
  )
  .join('\n')}
</urlset>`;

  c.header('content-type', 'application/xml; charset=utf-8');
  c.header('cache-control', 'public, max-age=3600');
  return c.body(body);
});

app.get('/robots.txt', (c) => {
  const site = (c.env.SITE_URL ?? '').replace(/\/$/, '');
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

  const [pending, reports] = await Promise.all([
    listByStatus(c.env, 'pending'),
    listOpenReports(c.env),
  ]);

  return c.html(
    <Layout
      title="Moderation"
      description="Moderation queue"
      canonical={absolute(c.env, '/admin')}
      siteName={c.env.SITE_NAME ?? 'Catholic APIs'}
      noindex
    >
      <Admin pending={pending} reports={reports} token={token} />
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
      title="Not found — Catholic APIs"
      description="That page doesn't exist."
      canonical={absolute(c.env, '/')}
      siteName={c.env.SITE_NAME ?? 'Catholic APIs'}
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
      title="Something went wrong — Catholic APIs"
      description="An unexpected error occurred."
      canonical={absolute(c.env, '/')}
      siteName={c.env.SITE_NAME ?? 'Catholic APIs'}
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

export default app;
