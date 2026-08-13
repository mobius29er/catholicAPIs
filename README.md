# Catholic APIs

A community-ranked directory of Catholic software, in two tracks:

- **Products** (`/`) — what Catholics actually use: prayer apps, breviaries, formation
  programmes, parish tools, journalism, AI assistants.
- **APIs** (`/apis`) — what those get built from: liturgical calendars, scripture, the Catechism,
  canon law, datasets, libraries, MCP servers.

Both are free and paid, both are upvoted and downvoted by the people who use them, and both run
through one voting system, one moderation queue and one JSON API. A listing declares a `track`;
everything downstream is shared. That is the whole of the "two products in one site" complexity.

Runs entirely on Cloudflare: a Worker for server-rendered HTML, D1 for storage, static assets at
the edge. No origin server, no container, and it fits comfortably in the free tier.

```
Cloudflare Worker (Hono, SSR)  ──  D1 (SQLite)
        │                              ├─ apis         listings, both tracks + vote tallies
        ├─ /            products       ├─ votes        one row per (listing, voter)
        ├─ /apis        developer      ├─ reports      "this link is dead"
        ├─ /products/:slug  detail     └─ rate_limits  fixed-window per-IP counters
        ├─ /apis/:slug      detail
        ├─ /submit  moderated queue
        ├─ /admin   moderation
        └─ /api/v1  public JSON API
Cron (every 6h) ──────────────▶  uptime probes, oldest check first
Static assets (public/) served from the edge, never touching the Worker.
```

## Design

Built from a reference mockup — a Product Hunt style leaderboard in golden-age comic × neo-noir.
The page follows the mockup's anatomy top to bottom:

| Band | Contents |
| --- | --- |
| Masthead | Brand · nav · pill search · Submit, on one line |
| Hero | Yellow caption box, cream condensed headline, two CTAs, illustration at right, angled red stamp across its corner |
| Columns | Leaderboard left (~64%), rail right (~34%) |
| Row | Rank · coloured logo tile · details and tag pills · publisher · outlined orange vote box |
| Rail | Spotlight · trending topics · subscribe · cross-track link |
| Footer | Brand · link columns · red starburst |

Warm noir throughout: cream on blue-black, amber for action, orange-red for votes and ornament,
teal for tags. Light mode swaps the night for aged newsprint and keeps the same inks.

Two things the mockup has that we cannot honestly reproduce, and what stands in for them:

- **Product logos.** Real products have logos we can't host, so each listing gets a stable
  generated tile — initials on a colour derived from a hash of the slug. Same shape and weight in
  the layout, no invented branding.
- **Maker names and a newsletter.** We have neither. The "by <maker>" slot shows the publisher's
  own domain, which is real information in the same shape; the newsletter panel offers the RSS and
  JSON feeds that actually exist, because a signup field that goes nowhere is a lie.

The hero illustration is hand-authored inline SVG ([`src/views/art.tsx`](src/views/art.tsx)) — the
CSP blocks every external host, and painting it from the same custom properties as the page means
it re-inks itself for light mode instead of shipping two files.

Catholic identity stays out of the chrome and in the content: no crosses in the interface, no gold
leaf, no liturgical colour coding. The cathedral in the skyline is the one exception, and it is
scenery.

### Earlier directions

Kept as stylesheets rather than deleted. Point the `<link>` in
[`src/views/layout.tsx`](src/views/layout.tsx) at one to compare, and delete them once a direction
is settled.

| File | Direction |
| --- | --- |
| [`public/styles-v1.css`](public/styles-v1.css) | Comic *construction* — neubrutalist panels, hard offset shadows, caption boxes — in a cold noir *palette*. |
| [`public/styles-v2.css`](public/styles-v2.css) | The inverse: Scandinavian *structure* (hairlines, no boxes, no shadows) carrying a four-colour comic *palette* on newsprint. |

Neither matched the mockup, which is warmer than both, treats illustration as a primary component,
and wraps its ornament in ordinary rounded card UI.

## Quick start

```bash
npm install
npx wrangler d1 create catholic-apis     # paste the printed id into wrangler.jsonc
npm run db:migrate:local                 # schema + 218 seed listings across both tracks
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

Listings live in two source files — [`data/seed.json`](data/seed.json) for the API track and
[`data/products.json`](data/products.json) for products. Editing either and running
`npm run seed:build` regenerates a migration of upserts keyed on `slug`, which patch existing rows
while leaving votes and moderation state alone.

> D1 runs each migration exactly once, so editing an already-applied migration does nothing. To
> correct a listing after launch: edit the source file, then
> `node scripts/build-seed.mjs data/seed.json migrations/0005_fix.sql` and apply that.

`launched_at` is null on every seeded product. We know roughly when most of them appeared but not
precisely, and a launch feed built on invented dates is worse than one built on when a listing
joined the directory. Submitters state their own launch date; ours stay blank until confirmed.

Fields that haven't been confirmed are `null` rather than guessed — an honest blank beats a wrong
"free" label. `verified_at` records when a maintainer last checked a listing by hand; the detail
page shows it, and every listing has a report button because links rot.

```bash
npm run links:check   # probes every URL in both source files, exits 1 on any dead link
```

### Imported lists, and crediting them

Most of the directory did not start here. Two community lists were compiling Catholic software
long before this site existed, and 174 of the listings came from them:

| List | Entries used | Licence |
| --- | --- | --- |
| [CatholicOS/awesome-catholic](https://github.com/CatholicOS/awesome-catholic) | the larger share, incl. its "Attic" of retired projects | **none stated** |
| [servusdei2018/awesome-catholic](https://github.com/servusdei2018/awesome-catholic) | the remainder | CC0-1.0 |

CC0 makes reuse unambiguous. CatholicOS ships no `LICENSE`, so we took only the facts — name, URL,
which section it sat in — credited the list on every row it gave us, and wrote our own wording.
Worth asking them to add CC0; it would settle the question for everyone downstream.

```bash
node scripts/import-awesome.mjs           # fetch, parse, merge, report — writes nothing
node scripts/import-awesome.mjs --write   # write data/imported.json
npm run seed:build                        # -> migrations/0004_imported.sql
```

The importer keys entries by identity rather than by name (`gh:owner/repo` for GitHub, host+path
for app stores, host otherwise), so the same project listed twice under different titles merges
into one row. Where the lists disagree — one retiring a project the other still recommends — the
retirement wins and the disagreement is recorded in `deprecated_note`. A false *alive* costs a
reader more than a false *dead*.

### Deprecation and uptime

Two different questions, deliberately kept apart from `status`:

**`deprecated`** is a human judgement, and a deprecated listing stays **published**. Hiding it
would only send the next person round the same search that just brought them here; instead the row
is struck through in the list and the detail page opens with a banner saying what happened. The
idea is borrowed straight from the upstream "Attic". Readers flag candidates with a one-click
**report as deprecated** button; a moderator makes the call.

**`health_state`** is machine-measured. A cron trigger (`triggers.crons` in `wrangler.jsonc`, every
six hours) runs `runHealthCheck()` over a batch of 25 listings, least-recently-checked first, and
probes each homepage — `HEAD`, falling back to `GET`, since plenty of hosts reject `HEAD` outright.
Two rules keep it honest:

- **One failure is not an outage.** State only flips to `down` after three consecutive failures;
  below that it reads `unknown`, not `up` — we genuinely don't know, and saying "fine" would be the
  same overconfidence the threshold exists to prevent.
- **401/403/405/406/429 don't count.** That is a server refusing *us*, not a server that is down.
  Counting bot protection as an outage would paint healthy sites red.

In the list, the dot only appears once we know something; `unknown` stays silent rather than
printing a column of grey rings that claim nothing. The detail page says "not checked yet" out
loud. `POST /admin/health` runs a batch on demand.

## The directory is itself an API

It would be a poor showing otherwise. No key, CORS open, docs at `/api/v1`.

```bash
curl 'https://catholicapis.com/api/v1/apis?pricing=free&no_auth=1&sort=top'
curl 'https://catholicapis.com/api/v1/products?platform=ios&sort=trending'
curl 'https://catholicapis.com/api/v1/listings/church-calendar-api'
curl 'https://catholicapis.com/api/v1/categories'
```

## Moderation

Submissions land as `status = 'pending'` and are invisible everywhere public — the directory, the
JSON API, the sitemap, and their own detail page all 404. Review at `/admin?token=$ADMIN_TOKEN`:
publish, reject, mark verified, or dismiss a report.

The same screen carries a **possibly dead** queue — everything readers have reported as dead plus
everything the uptime probe has given up on — with a flag/un-flag button per row and a button to
run a batch of probes on the spot. The machine never flags anything on its own; three failed probes
and a pile of reports are evidence, not a verdict.

## Layout

| Path | What's in it |
| --- | --- |
| `src/index.tsx` | Every route: pages, voting, submissions, JSON API, feeds, moderation |
| `src/db.ts` | D1 queries, track filtering, faceting, vote transactions |
| `src/ranking.ts` | Wilson score, gravity decay, sort orders — pure and tested |
| `src/health.ts` | Uptime probing and the down/unknown escalation rule |
| `src/voter.ts` | Signed voter cookies, IP hashing, rate limits |
| `src/views/` | Server-rendered JSX, shared by both tracks |
| `public/styles.css` | The whole design system, hand-written |
| `migrations/` | D1 schema and seed |
| `data/*.json` | The listings themselves, incl. `imported.json` from the awesome lists |
| `scripts/import-awesome.mjs` | Fetches and merges the upstream awesome-catholic lists |

## Notes on the implementation

**Filtering and ranking happen in the Worker**, not in SQL. Wilson needs a square root and
faceting needs counts across the whole result set, both awkward in SQLite, and a curated directory
is hundreds of rows rather than millions. Past a few thousand listings, move ranking into a stored
`score` column refreshed on write and paginate in SQL.

**Everything works without JavaScript.** Votes are real form posts that redirect back; `app.js`
only intercepts them to avoid the reload. The filter panel ships open and is collapsed by script
on narrow screens, so a no-JS phone gets a verbose page rather than a broken one. The submit form
renders both tracks' fields and hides the irrelevant half by script for the same reason.

**One listing, one canonical URL.** Slugs are unique across both tracks, so reaching a product
under `/apis/:slug` 301s to `/products/:slug` rather than serving a duplicate page.

**CSS is hand-written.** A dozen components did not justify a build step. Light and dark are both
defined explicitly, including the `prefers-color-scheme` default and a manual override applied
before first paint so the theme never flashes.

## Development

```bash
npm run dev              # local Worker + local D1
npm test                 # vitest — ranking, query strings, uptime escalation
npm run typecheck        # tsc --noEmit
npm run db:reset:local   # wipe local D1 and re-migrate
npm run seed:build       # data/*.json -> migrations/0002-0004
npm run links:check      # check every seed URL still resolves
```

## Contributing a listing

Either open the [submit form](https://catholicapis.com/submit) or send a pull request against
`data/products.json` or `data/seed.json`. On the product side, anything a Catholic actually uses
that is software; on the developer side, anything you can build on — hosted APIs, open datasets,
client libraries, MCP servers. Paid is welcome as long as the pricing is stated plainly: an honest
paid service beats an abandoned free one.

Not affiliated with the Holy See, any bishops' conference, or any diocese. Every listing links to
its own publisher; check their terms before you ship, especially for scripture translations, where
the licensing is the hard part.
