import type { FC } from 'hono/jsx';
import type { Listing } from '../types';

export const About: FC<{ siteUrl: string }> = ({ siteUrl }) => (
  <div class="wrap narrow page prose">
    <h1>About this directory</h1>

    <p class="lede">
      Catholic software gets built over and over by people who never find out the data they need
      already exists. This is a list of what exists, ranked by the developers who have actually
      used it.
    </p>

    <h2>What gets listed</h2>
    <p>
      Anything a developer can build on: hosted APIs, open datasets, client libraries, and MCP
      servers for AI agents. Free and paid both qualify — a service that charges honestly is more
      useful than an abandoned free one. What doesn't qualify: apps with no programmatic access,
      scrapers of sites that forbid scraping, and endpoints that quietly re-serve someone else's
      copyrighted translation.
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
      Vote on whether an API is <em>good to build on</em>: does it work, is it maintained, is it
      documented, does it do what it claims? Not on whether you like the project's theology.
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
      It would be a poor showing not to. Everything on this site is available as JSON at{' '}
      <a href="/api/v1">
        <code>{siteUrl}/api/v1</code>
      </a>
      , CORS open, no key required.
    </p>
  </div>
);

export const ApiDocs: FC<{ siteUrl: string }> = ({ siteUrl }) => (
  <div class="wrap narrow page prose">
    <h1>The Catholic APIs API</h1>
    <p class="lede">
      A directory of APIs ought to be one. Read-only, no authentication, CORS open, JSON
      throughout.
    </p>

    <h2>Endpoints</h2>

    <h3>
      <code>GET /api/v1/apis</code>
    </h3>
    <p>Every published listing, with vote tallies and ranking scores.</p>
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
          <td>Free-text search across name, summary, description and categories.</td>
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
            <code>api</code>, <code>dataset</code>, <code>library</code> or <code>mcp</code>.
            Repeatable.
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
      <code>GET /api/v1/apis/:slug</code>
    </h3>
    <p>A single listing, plus related listings that share its categories.</p>

    <h3>
      <code>GET /api/v1/categories</code>
    </h3>
    <p>Every category with a listing count — useful for building your own navigation.</p>

    <h2>Example</h2>
    <pre>
      <code>{`curl '${siteUrl}/api/v1/apis?pricing=free&no_auth=1&sort=top'`}</code>
    </pre>

    <h2>Fair use</h2>
    <p>
      No key and no hard rate limit; please cache rather than polling in a loop. If you need a
      bulk snapshot, pull <code>/api/v1/apis</code> once and store it — it changes slowly.
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
  reports: Array<{ id: number; kind: string; message: string; created_at: string; slug: string; name: string }>;
  token: string;
}> = ({ pending, reports, token }) => (
  <div class="wrap page">
    <h1>Moderation</h1>

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
                  <a href={`/apis/${report.slug}`}>{report.name}</a>
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
