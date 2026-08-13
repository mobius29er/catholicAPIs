# Catholic APIs

A community-ranked directory of the APIs, datasets and libraries you can build Catholic software
on — liturgical calendars, daily readings, scripture, the Catechism, canon law, prayers, saints —
free and paid. Anyone can upvote what works and downvote what's abandoned.

Runs entirely on Cloudflare: a Worker for server-rendered HTML, D1 for storage, static assets at
the edge. No origin server, no container, and it fits comfortably in the free tier.

```
Cloudflare Worker (Hono, SSR)  ──  D1 (SQLite)
        │                              ├─ apis         listings + denormalised vote tallies
        ├─ / directory + facets        ├─ votes        one row per (listing, voter)
        ├─ /apis/:slug detail          ├─ reports      "this link is dead"
        ├─ /submit  moderated queue    └─ rate_limits  fixed-window per-IP counters
        ├─ /admin   moderation
        └─ /api/v1  public JSON API
Static assets (public/) served from the edge, never touching the Worker.
```

## Quick start

```bash
npm install
npx wrangler d1 create catholic-apis     # paste the printed id into wrangler.jsonc
npm run db:migrate:local                 # schema + 28 seed listings
cp .dev.vars.example .dev.vars
npm run dev                              # http://127.0.0.1:8787
```

## Deploying

```bash
# 1. Create the database and put its id in wrangler.jsonc under d1_databases[0].database_id
npx wrangler d1 create catholic-apis

# 2. Set the secrets. Only VOTE_SECRET really matters; see .dev.vars.example.
openssl rand -base64 32 | npx wrangler secret put VOTE_SECRET
openssl rand -base64 32 | npx wrangler secret put ADMIN_TOKEN

# 3. Point SITE_URL at your domain (wrangler.jsonc "vars") — it feeds canonical
#    URLs, the sitemap, the RSS feed and JSON-LD, so a stale value costs you SEO.

# 4. Ship it
npm run db:migrate:remote
npm run deploy
```

Then add your domain under **Workers & Pages → your worker → Settings → Domains & Routes**, and
submit `https://yourdomain/sitemap.xml` to Search Console.

### Secrets

| Name | Required | Without it |
| --- | --- | --- |
| `VOTE_SECRET` | strongly recommended | Voter cookies are signed with a known dev key and can be forged. Logs a warning on every request. |
| `ADMIN_TOKEN` | for moderation | `/admin` returns 401; submissions can only be published with `wrangler d1 execute`. |
| `TURNSTILE_SITEKEY` / `TURNSTILE_SECRET` | optional | The submit form falls back to its honeypot and rate limit, which is usually enough at this scale. |

## How ranking works

**Top rated** sorts by the lower bound of a [Wilson score interval][wilson], not by
`upvotes - downvotes`. Raw net score would rank a listing with 400 up and 380 down above one with
40 up and 1 down — backwards, since the second is plainly better and we are merely less certain
about it. Wilson asks the fairer question: *given the votes so far, what is the lowest plausible
approval rate?* Small unanimous listings rank well and climb further as votes accumulate.

**Trending** takes net votes from the last 14 days and applies Hacker News style gravity decay on
the listing's age, with gravity 1.5 rather than HN's 1.8 — a directory turns over much more slowly
than a news feed. Confidence is a strict tiebreaker, never added into the score; blending them
lets an established listing with no recent activity outrank one that is genuinely moving.

Both live in [`src/ranking.ts`](src/ranking.ts) as pure functions with tests.

[wilson]: https://www.evanmiller.org/how-not-to-sort-by-average-rating.html

## How voting works

Voting is anonymous, because requiring an account to say "this API is good" would kill
participation on a directory this size. Identity is a random UUID in an HMAC-signed, `HttpOnly`,
`SameSite=Lax` cookie:

- **One vote per listing per voter.** Enforced by a composite primary key, not application logic.
- **Click the same arrow twice to retract**, click the other to switch — the Reddit convention.
- **Tallies are maintained by SQL triggers**, so `apis.upvotes` can never drift from the `votes`
  ledger even if a write path is added later that forgets to update it.
- **60 votes per hour per IP**, on a salted hash of the address. The raw IP is never stored.
- Tampering with the cookie fails the signature check and mints a *new* voter — you cannot
  impersonate an existing one, only become an anonymous new one, which the IP limit then governs.

None of this is fraud-proof and it isn't trying to be. It makes ballot-stuffing tedious enough
that it isn't worth doing to a list of Catholic APIs.

## Data

Listings live in [`data/seed.json`](data/seed.json) — the single source of truth. Editing that
file and running `npm run seed:build` regenerates a migration of upserts keyed on `slug`, which
patch existing rows while leaving votes and moderation state alone.

> D1 runs each migration exactly once, so editing an already-applied migration does nothing. To
> correct a listing after launch: edit `data/seed.json`, then
> `node scripts/build-seed.mjs migrations/0003_fix.sql` and apply that.

Fields that haven't been confirmed are `null` rather than guessed — an honest blank beats a wrong
"free" label. `verified_at` records when a maintainer last checked a listing by hand; the detail
page shows it, and every listing has a report button because links rot.

```bash
npm run links:check   # probes every URL in seed.json, exits 1 on any dead link
```

## The directory is itself an API

It would be a poor showing otherwise. No key, CORS open, docs at `/api/v1`.

```bash
curl 'https://catholicapis.com/api/v1/apis?pricing=free&no_auth=1&sort=top'
curl 'https://catholicapis.com/api/v1/apis/church-calendar-api'
curl 'https://catholicapis.com/api/v1/categories'
```

## Moderation

Submissions land as `status = 'pending'` and are invisible everywhere public — the directory, the
JSON API, the sitemap, and their own detail page all 404. Review at `/admin?token=$ADMIN_TOKEN`:
publish, reject, mark verified, or dismiss a report.

## Layout

| Path | What's in it |
| --- | --- |
| `src/index.tsx` | Every route: pages, voting, submissions, JSON API, feeds, moderation |
| `src/db.ts` | D1 queries, filtering, faceting, vote transactions |
| `src/ranking.ts` | Wilson score, gravity decay, sort orders — pure and tested |
| `src/voter.ts` | Signed voter cookies, IP hashing, rate limits |
| `src/views/` | Server-rendered JSX |
| `public/` | CSS, progressive-enhancement JS, favicon — served from the edge |
| `migrations/` | D1 schema and seed |
| `data/seed.json` | The listings themselves |

## Notes on the implementation

**Filtering and ranking happen in the Worker**, not in SQL. Wilson needs a square root and
faceting needs counts across the whole result set, both awkward in SQLite, and a curated directory
is hundreds of rows rather than millions. Past a few thousand listings, move ranking into a stored
`score` column refreshed on write and paginate in SQL.

**Everything works without JavaScript.** Votes are real form posts that redirect back; `app.js`
only intercepts them to avoid the reload. The filter panel ships open and is collapsed by script
on narrow screens, so a no-JS phone gets a verbose page rather than a broken one.

**CSS is hand-written.** A dozen components did not justify a build step. Light and dark are both
defined explicitly, including the `prefers-color-scheme` default and a manual override applied
before first paint so the theme never flashes.

## Development

```bash
npm run dev              # local Worker + local D1
npm test                 # vitest — ranking and query-string round-trips
npm run typecheck        # tsc --noEmit
npm run db:reset:local   # wipe local D1 and re-migrate
npm run seed:build       # data/seed.json -> migrations/0002_seed.sql
npm run links:check      # check every seed URL still resolves
```

## Contributing a listing

Either open the [submit form](https://catholicapis.com/submit) or send a pull request against
`data/seed.json`. Anything a developer can build on qualifies: hosted APIs, open datasets, client
libraries, MCP servers. Paid services are welcome as long as the pricing is stated plainly — an
honest paid service beats an abandoned free one.

Not affiliated with the Holy See, any bishops' conference, or any diocese. Every listing links to
its own publisher; check their terms before you ship, especially for scripture translations, where
the licensing is the hard part.
