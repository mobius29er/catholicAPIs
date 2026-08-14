# FidesHunt

**[fideshunt.com](https://fideshunt.com)** — a community-ranked directory of faith software, in
two tracks:

- **Products** (`/`) — what believers actually use: prayer apps, breviaries, formation
  programmes, parish tools, journalism, AI assistants.
- **APIs** (`/apis`) — what those get built from: liturgical calendars, scripture, the Catechism,
  canon law, datasets, libraries, MCP servers.

> **On the name.** *Fides* is faith — the word both halves of the Western church kept. Catholics
> have *fides et ratio*; the Reformation has *sola fide*. It is one of the few pieces of Latin
> neither tradition concedes to the other. *Hunt* is the activity, and the nod to Product Hunt,
> whose shape this borrows: ranked listings, upvotes, a launch feed.
>
> **On the scope.** The catalogue is deepest by far on the Catholic side — that is where the work
> has gone, not a claim that nothing else belongs. The `/about` page says so in as many words
> rather than letting anyone discover it and feel misled.

Both are free and paid, both are upvoted and downvoted by the people who use them, and both run
through one voting system, one moderation queue and one JSON API. A listing declares a `track`;
everything downstream is shared. That is the whole of the "two products in one site" complexity.

Runs entirely on Cloudflare: a Worker for server-rendered HTML, D1 for storage, static assets at
the edge. No origin server, no container, and it fits comfortably in the free tier.

```
Cloudflare Worker (Hono, SSR)  ──  D1 (SQLite)
        │                              ├─ apis         listings, both tracks + vote tallies
        ├─ /            products       ├─ votes        one row per (listing, voter)
        ├─ /apis        developer      ├─ reports      "dead" / "alive again"
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
npm run db:migrate:local     # schema + 237 seed listings across both tracks
cp .dev.vars.example .dev.vars
npm run dev                  # http://127.0.0.1:8787
```

No Cloudflare account needed for this: local D1 is a SQLite file under `.wrangler/`, and the
placeholder `database_id` in `wrangler.jsonc` is only read when deploying. An account is needed
the first time you [deploy](#deploying).

## Deploying

```bash
npm install
npx wrangler login       # once, opens a browser
npm run deploy:setup
```

That creates the D1 database and writes its id into `wrangler.jsonc`, generates `VOTE_SECRET` and
`ADMIN_TOKEN` and prints the admin token once, applies the migrations remotely, and deploys. It
prints a `*.workers.dev` URL that is live immediately — no custom domain required. Re-running it
is safe: it creates nothing that exists, never rotates a secret that is already set, and applies
only migrations D1 has not seen.

On a machine with no browser, make an API token at
[dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) using the
**Edit Cloudflare Workers** template plus **D1:Edit**, then
`export CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=…` and run the same command.

The five steps are in [`scripts/deploy.mjs`](scripts/deploy.mjs) if you would rather run them
yourself. Three are worth knowing about:

- **`wrangler d1 migrations apply --remote` cannot apply this schema.** It fails with
  `incomplete input: SQLITE_ERROR` on `0001_init.sql`, because that migration contains
  `CREATE TRIGGER`. Established by bisecting against a real database: all 19 of 0001's statements
  apply individually, the trigger-free migrations 0002-0005 apply through that command fine, and
  `d1 execute --file` applies the whole of 0001 without complaint. So the script drives migrations
  itself through the path that works, keeping D1's own `d1_migrations` ledger so
  `wrangler d1 migrations list` still tells the truth. Local development is unaffected —
  `db:migrate:local` uses a different code path and has always worked.

- `wrangler d1 create` prints a UUID that must be pasted into `wrangler.jsonc` before anything else
  works. Skipping it fails several steps later as an unrelated-looking binding error. The script
  does that pasting — commit the result.
- **Secrets have to come after the first deploy.** `wrangler secret put` against a Worker that does
  not exist yet asks *"do you want to create a new Worker?"* on stdin — the same stdin the secret is
  being piped into, so the prompt swallows the secret. Deploy first and the Worker is there to
  receive them. This costs a few seconds where the site is live with a dev signing key and `/admin`
  shut, which on a brand-new deployment with no visitors is harmless.

### Attaching fideshunt.com

`SITE_URL` is **unset** until the domain is actually serving. Without it the Worker uses whatever
origin the request arrived on, so the `workers.dev` address is correct about itself — canonical
tags, sitemap, feed and JSON-LD all point at the live URL rather than at a domain that is not
answering yet. **Do not pin it early**, or the deployed site spends the gap telling search engines
to index a domain that 404s.

Order matters:

1. Add `fideshunt.com` to the account (Cloudflare dashboard → Add a domain), and point the
   registrar's nameservers at Cloudflare if they are not already.
2. **Workers & Pages → fideshunt → Settings → Domains & Routes → Add custom domain.** Add both
   `fideshunt.com` and `www.fideshunt.com`.
3. Confirm `https://fideshunt.com` serves the site.
4. *Then* pin it and redeploy — at this point you want it fixed, so a request arriving on the
   `workers.dev` hostname still points search engines home:

   ```jsonc
   "vars": { "SITE_URL": "https://fideshunt.com", "SITE_NAME": "FidesHunt" }
   ```

5. Submit `https://fideshunt.com/sitemap.xml` to Search Console.

`fidehunt.com` (no *s*) and `catholicapis.com` are held as redirects. Point them at
`fideshunt.com` with a Cloudflare Bulk Redirect rather than adding them as custom domains on the
Worker — a custom domain would serve the site under a second hostname and split its ranking, which
is the exact thing `SITE_URL` exists to prevent.

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
that it is not worth doing to a directory this size.

## Data

Listings live in two source files — [`data/seed.json`](data/seed.json) for the API track and
[`data/products.json`](data/products.json) for products. Editing either and running
`npm run seed:build` regenerates a migration of upserts keyed on `slug`, which patch existing rows
while leaving votes and moderation state alone.

> D1 runs each migration exactly once, so editing an already-applied migration does nothing. To
> correct a listing after launch: edit the source file, then
> `node scripts/build-seed.mjs data/seed.json migrations/0006_fix.sql` and apply that.

`launched_at` is null on every seeded product. We know roughly when most of them appeared but not
precisely, and a launch feed built on invented dates is worse than one built on when a listing
joined the directory. Submitters state their own launch date; ours stay blank until confirmed.

Fields that haven't been confirmed are `null` rather than guessed — an honest blank beats a wrong
"free" label. `verified_at` records when a maintainer last checked a listing by hand; the detail
page shows it, and every listing has a report button because links rot.

```bash
npm run links:check   # probes every URL in both source files, exits 1 on any dead link
```

### Where the listings come from

Most of the directory did not start here. 193 of the 237 listings came from people who were
cataloguing Catholic software long before this site existed, and each one credits its source on
the listing itself.

| Source | Entries | Licence |
| --- | --- | --- |
| [CatholicOS/awesome-catholic](https://github.com/CatholicOS/awesome-catholic) | 169, incl. its "Attic" of retired projects | **none stated** |
| [CatholicOS org](https://github.com/CatholicOS) — CDCF first-party projects | 19 | mostly Apache-2.0, read per repo |
| [servusdei2018/awesome-catholic](https://github.com/servusdei2018/awesome-catholic) | 5 not already covered | CC0-1.0 |
| Curated here | 44 | — |

Note that the first two are the same people: **CatholicOS is the GitHub organisation of the
[Catholic Digital Commons Foundation](https://catholicdigitalcommons.org/)**, incorporated
January 2026. `awesome-catholic` is their catalogue of everyone else's work; the org itself
publishes the foundation's own projects, which is a separate import.

CC0 makes reuse unambiguous. `awesome-catholic` ships no `LICENSE`, so we took only the facts —
name, URL, which section it sat in — credited the list on every row it gave us, and wrote our own
wording. Worth asking them to add CC0; it would settle the question for everyone downstream.

```bash
node scripts/import-awesome.mjs --write   # the two awesome lists -> data/imported.json
node scripts/import-cdcf.mjs --write      # CDCF's own projects   -> data/cdcf.json
npm run seed:build                        # -> migrations/0004, 0005
```

Both run dry by default and print what they would change.

**`import-awesome.mjs`** keys entries by identity rather than by name (`gh:owner/repo` for GitHub,
host+path for app stores, host otherwise), so the same project listed twice under different titles
merges into one row. Where the lists disagree — one retiring a project the other still recommends —
the retirement wins and the disagreement is recorded in `deprecated_note`. A false *alive* costs a
reader more than a false *dead*.

**`import-cdcf.mjs`** works from a manifest, because which track and kind a project belongs to is
a judgement no API returns. What the script does do is verify that manifest against reality on
every run: it resolves each repository's default branch, reads its licence off the repository
rather than guessing, notices when a README says the project has been archived, and fails loudly
on a repo that has been renamed or removed. Three kinds of repository are excluded on purpose and
the reasons are recorded in the script's `EXCLUDED` map — forks (the upstream deserves the
listing, not the mirror), foundation governance and infrastructure, and repositories whose own
README calls them a brainstorm.

The bulk of the CDCF import is their canonical-identifier registries — stable IDs for the fixed
sets Catholic software otherwise re-keys by hand: dioceses and eparchies (CECDR), the Churches
*sui iuris* (CESIDR), popes (CRPDR), ecumenical councils (COECDR), Doctors (CDOCTDR), magisterial
documents (CMDDR), liturgical books and their editions (CLBDR), Missal celebrations (CLEDR),
Martyrology eulogies (CRMEDR), institutes of consecrated life (CICLSALDR). If you have ever tried
to join two Catholic datasets on diocese name, that is the problem these solve.

### Deprecation and uptime

Two different questions, deliberately kept apart from `status`:

**`deprecated`** is a human judgement, and a deprecated listing stays **published**. Hiding it
would only send the next person round the same search that just brought them here; instead the row
is struck through in the list and the detail page opens with a **not live any more** banner saying
what happened. The idea is borrowed straight from the upstream "Attic". Readers flag candidates
with a one-click **report as deprecated** button; a moderator makes the call.

It runs both ways. Projects come back — a maintainer returns, someone forks it, a domain gets
renewed — so a flagged listing carries an **it's working again** button inside its banner, filed
as a `revived` report. A directory that can mark things dead but never undo it is just a slower
kind of wrong. Acting on either decision resolves the reports that argued for it, so a row leaves
the queue instead of asking to be decided twice; reports arguing the *other* way stay open, because
that disagreement is worth seeing.

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
curl 'https://fideshunt.com/api/v1/apis?pricing=free&no_auth=1&sort=top'
curl 'https://fideshunt.com/api/v1/products?platform=ios&sort=trending'
curl 'https://fideshunt.com/api/v1/listings/church-calendar-api'
curl 'https://fideshunt.com/api/v1/categories'
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
| `data/*.json` | The listings: `seed`/`products` curated here, `imported` from the awesome lists, `cdcf` from the foundation |
| `scripts/import-awesome.mjs` | Fetches and merges the upstream awesome-catholic lists |
| `scripts/import-cdcf.mjs` | Verifies and imports the CDCF's own projects from the CatholicOS org |
| `scripts/deploy.mjs` | First deploy end to end: database, secrets, migrations, ship |

## Notes on the implementation

**Search matches every term, in any order.** `canonical identifiers` finds anything whose name,
summary, description or categories contain both words, not the literal phrase — which is what a
reader means, and which one substring match over concatenated fields got wrong: `canonical` found
fifteen listings, `canonical identifiers` found one. Quoting a run of words searches it as a
phrase, which is the escape hatch that behaviour used to be. Terms are capped at eight, `%` and
`_` are escaped rather than treated as wildcards, and it is still substring matching per term —
swap in FTS5 if the corpus grows.

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
npm run deploy:setup     # first deploy: database, secrets, migrations, ship
npm test                 # vitest — ranking, query strings, uptime, schema drift
npm run typecheck        # tsc --noEmit
npm run db:reset:local   # wipe local D1 and re-migrate
npm run seed:build       # data/*.json -> migrations/0002-0005
npm run links:check      # check every seed URL still resolves
```

## Contributing a listing

Either open the [submit form](https://fideshunt.com/submit) or send a pull request against
`data/products.json` or `data/seed.json`. On the product side, anything a Catholic actually uses
that is software; on the developer side, anything you can build on — hosted APIs, open datasets,
client libraries, MCP servers. Paid is welcome as long as the pricing is stated plainly: an honest
paid service beats an abandoned free one.

Not affiliated with the Holy See, any bishops' conference, or any diocese. Every listing links to
its own publisher; check their terms before you ship, especially for scripture translations, where
the licensing is the hard part.
