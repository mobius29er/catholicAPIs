import type { FC } from 'hono/jsx';
import type { Listing } from '../types';
import { listingPath } from '../types';
import type { DeprecationSignal, OpenReport, Stats } from '../db';

export const About: FC<{ siteUrl: string }> = ({ siteUrl }) => (
  <div class="wrap narrow page prose">
    <h1>About FidesHunt</h1>

    <p class="lede">
      Faith software gets built over and over by people who never find out that the thing they
      need already exists. This is a list of what exists, ranked by the people who have actually
      used it.
    </p>

    <h2>The name</h2>
    <p>
      <em>Fides</em> is faith — the word both halves of the Western church kept. Catholics have{' '}
      <em>fides et ratio</em>, faith and reason; the Reformation has <em>sola fide</em>, faith
      alone. It is one of the few pieces of Latin neither tradition concedes to the other, which
      makes it the right word for a directory that would like to be useful to both.
    </p>
    <p>
      And <em>hunt</em> because that is the actual activity. Anselm called it{' '}
      <em>fides quaerens intellectum</em> — faith seeking understanding — about a thousand years
      before anyone had a search box.
    </p>

    <h2>Two tracks</h2>
    <p>
      <a href="/">Products</a> are finished software: prayer apps, breviaries, formation
      programmes, parish tools, journalism, AI assistants. Things you use.
    </p>
    <p>
      <a href="/apis">APIs</a> are what those are built from: liturgical calendars, scripture,
      the Catechism, canon law, datasets, libraries, MCP servers. Things you build with.
    </p>
    <p>
      They share one voting system, one submission queue and one JSON API, because they are the
      same question asked twice — is this any good, and is it maintained?
    </p>

    <h2>What gets listed</h2>
    <p>
      On the product side: anything a believer actually uses that is software. On the developer
      side: anything you can build on. Free and paid both qualify — a service that charges
      honestly is more useful than an abandoned free one. What doesn't qualify: scrapers of sites
      that forbid scraping, endpoints that quietly re-serve someone else's copyrighted
      translation, and anything whose only real feature is a landing page.
    </p>

    {/*
      Said plainly rather than left for someone to discover and feel misled by.
      The catalogue is what it is today; the name does not overclaim it.
    */}
    <p>
      <strong>Where the catalogue actually stands:</strong> it is deepest by far on the Catholic
      side — liturgical calendars, the Catechism, canon law, the Roman Martyrology, canonical
      identifier registries. That is where the work has gone so far, and it is not a claim that
      nothing else belongs here. Anything a Christian builds or uses is in scope, and if the
      Protestant and Orthodox shelves look thin it is because nobody has filled them yet.{' '}
      <a href="/submit">Fix that</a>.
    </p>

    <h2>How ranking works</h2>
    <p>
      <strong>Top rated</strong> sorts by the lower bound of a Wilson confidence interval, not by
      upvotes minus downvotes. Raw net score would let a listing with 400 up and 380 down beat one
      with 40 up and 1 down, which is backwards — the second is plainly better, we are just less
      certain. Wilson asks the fairer question: given the votes so far, what is the lowest
      plausible approval rate? Small unanimous listings rank well, and rank better still as votes
      accumulate.
    </p>
    <p>
      <strong>Trending</strong> counts votes from the last two weeks, decayed by how long the
      listing has been here, so new arrivals get a chance to be seen. <strong>Newest</strong> and{' '}
      <strong>A–Z</strong> do what they say.
    </p>

    <h2>Voting</h2>
    <p>
      No account needed — an anonymous, signed cookie tracks your votes so you can change your
      mind. Click the same arrow twice to take a vote back. There's a per-IP rate limit to make
      ballot-stuffing tedious, though nothing here is fraud-proof and it isn't trying to be.
    </p>
    <p>
      Vote on whether the thing is <em>good</em>: does it work, is it maintained, is it
      documented, does it do what it claims? Not on whether you like the maker's theology.
    </p>

    <h2 id="sources">Sources and prior art</h2>
    <p>
      This directory did not start from nothing. Most of it came from people who were cataloguing
      Catholic software long before it existed, and every listing they gave us says so and links
      back.
    </p>
    <ul>
      <li>
        <a href="https://catholicdigitalcommons.org/" rel="noopener" target="_blank">
          The Catholic Digital Commons Foundation
        </a>{' '}
        publishes under the{' '}
        <a href="https://github.com/CatholicOS" rel="noopener" target="_blank">
          CatholicOS
        </a>{' '}
        organisation — including its canonical-identifier registries for the fixed sets Catholic
        software keeps re-keying by hand: dioceses, popes, councils, Doctors, liturgical books,
        magisterial documents. Those are here as first-party listings, mostly under Apache 2.0.
      </li>
      <li>
        <a href="https://github.com/CatholicOS/awesome-catholic" rel="noopener" target="_blank">
          CatholicOS/awesome-catholic
        </a>{' '}
        — the foundation's curated list of everyone else's work, and the source of the idea that
        dead projects belong in an &ldquo;Attic&rdquo; rather than the bin. No licence is stated on
        the repository, so we took only the facts — what a project is called, where it lives, which
        section it sat in — and wrote our own descriptions.
      </li>
      <li>
        <a href="https://github.com/servusdei2018/awesome-catholic" rel="noopener" target="_blank">
          servusdei2018/awesome-catholic
        </a>{' '}
        — released under{' '}
        <a href="https://creativecommons.org/publicdomain/zero/1.0/" rel="noopener" target="_blank">
          CC0 1.0
        </a>
        , which makes reuse unambiguous. More lists should do this.
      </li>
    </ul>
    <p>
      Where the two lists disagreed — one retiring a project the other still recommends — we kept
      the retirement and recorded the disagreement on the listing, because a false <em>alive</em>{' '}
      costs more than a false <em>dead</em>.
    </p>
    <p>
      If you maintain a list we've missed, or you'd rather your entries weren't here,{' '}
      <a href="/submit">tell us</a>.
    </p>

    <h2 id="status">Deprecation and uptime</h2>
    <p>
      A scheduled job walks the directory every few hours, least-recently-checked first, and asks
      each listing's homepage whether it is still there. One failure is not a verdict — sites time
      out and firewalls get twitchy — so a listing is only shown as <strong>not responding</strong>{' '}
      after three consecutive failures. A 403 or 405 doesn't count against it at all: that is a
      server refusing <em>us</em>, not a server that is down.
    </p>
    <p>
      Deprecation is a separate, human judgement. Anything abandoned, superseded or plainly dead is
      flagged <strong>not live any more</strong> — and then <em>stays published</em>. Deleting it
      would only send the next person round the same search you just finished. Every listing has a
      one-click <strong>report as deprecated</strong> button; enough reports and a moderator looks.
    </p>
    <p>
      It runs the other way too. Projects come back — a maintainer returns, someone forks it, a
      domain gets renewed — so every flagged listing carries an{' '}
      <strong>it's working again</strong> button, and a moderator can lift the flag. A directory
      that can mark things dead but never undo it is just a slower kind of wrong.
    </p>

    <h2 id="data">Data and corrections</h2>
    <p>
      Listings are compiled from public documentation and project READMEs. Fields we haven't
      confirmed say so rather than guessing — an unverified blank is more honest than a wrong
      label. Every listing shows when a maintainer last verified it, and every listing has a
      report button. Use it: links rot, projects get abandoned, and pricing changes.
    </p>
    <p>
      Nothing here is affiliated with the Holy See, any bishops' conference, or any diocese. Check
      each publisher's own terms before you ship — especially for scripture translations, where
      the licensing is the hard part.
    </p>

    <h2>The directory has an API</h2>
    <p>
      It would be a poor showing not to. Both tracks are available as JSON at{' '}
      <a href="/api/v1">
        <code>{siteUrl}/api/v1</code>
      </a>
      , CORS open, no key required.
    </p>
  </div>
);

export const ApiDocs: FC<{ siteUrl: string }> = ({ siteUrl }) => (
  <div class="wrap narrow page prose">
    <h1>The FidesHunt API</h1>
    <p class="lede">
      A directory of APIs ought to be one. Read-only, no authentication, CORS open, JSON
      throughout.
    </p>

    <h2>Endpoints</h2>

    <h3>
      <code>GET /api/v1/products</code> · <code>GET /api/v1/apis</code>
    </h3>
    <p>
      Every published listing on that track, with vote tallies and ranking scores. Both take the
      same parameters.
    </p>
    <table class="params">
      <thead>
        <tr>
          <th>Parameter</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <code>q</code>
          </td>
          <td>
            Free-text search across name, summary, description and categories. Every word must
            match, in any order; wrap words in double quotes to search for them as a phrase.
          </td>
        </tr>
        <tr>
          <td>
            <code>pricing</code>
          </td>
          <td>
            <code>free</code>, <code>freemium</code> or <code>paid</code>. Repeatable.
          </td>
        </tr>
        <tr>
          <td>
            <code>kind</code>
          </td>
          <td>
            API track only: <code>api</code>, <code>dataset</code>, <code>library</code> or{' '}
            <code>mcp</code>. Repeatable.
          </td>
        </tr>
        <tr>
          <td>
            <code>platform</code>
          </td>
          <td>
            Product track only: <code>ios</code>, <code>android</code>, <code>web</code>,{' '}
            <code>desktop</code> or <code>parish</code>. Repeatable.
          </td>
        </tr>
        <tr>
          <td>
            <code>category</code>, <code>lang</code>
          </td>
          <td>Filter by category name or two-letter language code. Repeatable.</td>
        </tr>
        <tr>
          <td>
            <code>open_source</code>, <code>no_auth</code>
          </td>
          <td>
            Set to <code>1</code> to keep only open-source listings, or only ones needing no key.
          </td>
        </tr>
        <tr>
          <td>
            <code>sort</code>
          </td>
          <td>
            <code>top</code> (default), <code>trending</code>, <code>new</code>, <code>name</code>.
          </td>
        </tr>
        <tr>
          <td>
            <code>page</code>
          </td>
          <td>1-based. Page size is in the response envelope.</td>
        </tr>
      </tbody>
    </table>

    <h3>
      <code>GET /api/v1/listings/:slug</code>
    </h3>
    <p>
      A single listing, plus related listings that share its categories. Slugs are unique across
      both tracks, so this one endpoint resolves either; <code>/api/v1/apis/:slug</code> and{' '}
      <code>/api/v1/products/:slug</code> are aliases.
    </p>

    <h3>
      <code>GET /api/v1/categories</code>
    </h3>
    <p>Every category with a listing count, grouped by track — enough to build your own nav.</p>

    <h2>Example</h2>
    <pre>
      <code>{`curl '${siteUrl}/api/v1/apis?pricing=free&no_auth=1&sort=top'
curl '${siteUrl}/api/v1/products?platform=ios&sort=trending'`}</code>
    </pre>

    <h2>Fair use</h2>
    <p>
      No key and no hard rate limit; please cache rather than polling in a loop. If you need a
      bulk snapshot, pull each track once and store it — the directory changes slowly.
    </p>
  </div>
);

export const Message: FC<{ title: string; body: string; cta?: { href: string; label: string } }> = ({
  title,
  body,
  cta,
}) => (
  <div class="wrap narrow page">
    <h1>{title}</h1>
    <p class="lede">{body}</p>
    {cta && (
      <a class="btn btn-primary" href={cta.href}>
        {cta.label}
      </a>
    )}
  </div>
);

export const Admin: FC<{
  pending: Listing[];
  reports: OpenReport[];
  signals: DeprecationSignal[];
  stats: Stats;
  token: string;
}> = ({ pending, reports, signals, stats, token }) => (
  <div class="wrap page">
    <h1>Moderation</h1>

    <p class="muted small">
      {stats.total} published · {stats.down} not responding · {reports.length} open reports
    </p>

    <section>
      <h2>Pending submissions ({pending.length})</h2>
      {pending.length === 0 ? (
        <p class="muted">Nothing waiting.</p>
      ) : (
        <ul class="admin-list">
          {pending.map((listing) => (
            <li>
              <div>
                <h3>{listing.name}</h3>
                <p>{listing.tagline}</p>
                <p class="muted small">
                  <a href={listing.homepage_url} rel="nofollow noopener" target="_blank">
                    {listing.homepage_url}
                  </a>
                  {' · '}
                  {listing.pricing} · {listing.kind} · {listing.categories.join(', ')}
                  {listing.submitter && ` · from ${listing.submitter}`}
                </p>
                {listing.submitter_note && <p class="muted small">Note: {listing.submitter_note}</p>}
                {listing.description && <p class="small">{listing.description}</p>}
              </div>
              <div class="admin-actions">
                <form method="post" action="/admin/moderate">
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="slug" value={listing.slug} />
                  <input type="hidden" name="status" value="published" />
                  <button class="btn btn-primary" type="submit">
                    Publish
                  </button>
                </form>
                <form method="post" action="/admin/moderate">
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="slug" value={listing.slug} />
                  <input type="hidden" name="status" value="rejected" />
                  <button class="btn btn-quiet" type="submit">
                    Reject
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>

    {/*
      Everything the evidence points at, in one place, pointing both ways. The
      machine never flags or un-flags on its own — failed probes and reader
      reports are evidence, not a verdict — so each row ends in a button a
      human presses.
    */}
    <section>
      <h2>Needs a decision ({signals.length})</h2>
      <form method="post" action="/admin/health" class="admin-inline">
        <input type="hidden" name="token" value={token} />
        <button class="btn btn-quiet" type="submit">
          Run uptime checks now
        </button>
        <span class="muted small">
          Probes a batch of the least-recently-checked listings. The cron does this every six hours.
        </span>
      </form>

      {signals.length === 0 ? (
        <p class="muted">Nothing to decide.</p>
      ) : (
        <ul class="admin-list">
          {signals.map((signal) => {
            const evidence = [
              signal.revive_reports > 0 &&
                `${signal.revive_reports} says it's back`,
              signal.dead_reports > 0 &&
                `${signal.dead_reports} open ${signal.dead_reports === 1 ? 'report' : 'reports'}`,
              signal.health_state === 'down' &&
                `${signal.health_fails} failed ${signal.health_fails === 1 ? 'probe' : 'probes'}`,
            ].filter(Boolean);

            return (
            <li class={signal.revive_reports > 0 ? 'is-contested' : undefined}>
              <div>
                <h3>
                  <a href={listingPath(signal)}>{signal.name}</a>
                  {signal.deprecated === 1 && <span class="flash flash-dead">Deprecated</span>}
                </h3>
                <p class="muted small">{evidence.join(' · ')}</p>
              </div>
              <div class="admin-actions">
                <form method="post" action="/admin/deprecate">
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="slug" value={signal.slug} />
                  <input
                    type="hidden"
                    name="deprecated"
                    value={signal.deprecated === 1 ? '0' : '1'}
                  />
                  <input
                    type="text"
                    name="note"
                    maxlength={500}
                    placeholder="Why, and what replaced it"
                    hidden={signal.deprecated === 1}
                  />
                  <button
                    class={signal.deprecated === 1 ? 'btn btn-revive' : 'btn btn-warn'}
                    type="submit"
                  >
                    {signal.deprecated === 1 ? '↺ Mark live again' : 'Flag deprecated'}
                  </button>
                </form>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </section>

    <section>
      <h2>Open reports ({reports.length})</h2>
      {reports.length === 0 ? (
        <p class="muted">Nothing reported.</p>
      ) : (
        <ul class="admin-list">
          {reports.map((report) => (
            <li>
              <div>
                <h3>
                  <a href={listingPath(report)}>{report.name}</a>
                </h3>
                <p>
                  <strong>{report.kind}</strong> · <span class="muted small">{report.created_at}</span>
                </p>
                {report.message && <p class="small">{report.message}</p>}
              </div>
              <div class="admin-actions">
                <form method="post" action="/admin/verify">
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="slug" value={report.slug} />
                  <button class="btn btn-quiet" type="submit">
                    Mark verified
                  </button>
                </form>
                <form method="post" action="/admin/moderate">
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="slug" value={report.slug} />
                  <input type="hidden" name="status" value="rejected" />
                  <button class="btn btn-quiet" type="submit">
                    Unpublish
                  </button>
                </form>
                <form method="post" action="/admin/resolve">
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="id" value={String(report.id)} />
                  <button class="btn btn-quiet" type="submit">
                    Dismiss
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  </div>
);
