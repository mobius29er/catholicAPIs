import type { FC } from 'hono/jsx';
import type { Listing } from '../types';
import { AUTH_LABELS, Badges, KIND_LABELS, PRICING_LABELS, VoteWidget, languageName } from './components';

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const hostOf = (url: string): string => {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const Row: FC<{ label: string; children?: unknown }> = ({ label, children }) => (
  <div class="spec-row">
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);

export const Detail: FC<{ listing: Listing; related: Listing[] }> = ({ listing, related }) => (
  <article class="wrap detail">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Directory</a>
      <span aria-hidden="true">/</span>
      <a href={`/?category=${encodeURIComponent(listing.categories[0] ?? '')}`}>
        {listing.categories[0] ?? 'Listing'}
      </a>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{listing.name}</span>
    </nav>

    <header class="detail-head">
      <VoteWidget listing={listing} large />

      <div>
        <h1>{listing.name}</h1>
        <p class="detail-tagline">{listing.tagline}</p>
        <Badges listing={listing} />
      </div>
    </header>

    <div class="detail-grid">
      <div class="detail-main">
        <section>
          <h2 class="visually-hidden">Description</h2>
          <p class="prose">{listing.description || listing.tagline}</p>
        </section>

        <section class="cta-row">
          <a class="btn btn-primary" href={listing.homepage_url} rel="nofollow noopener" target="_blank">
            Open {hostOf(listing.homepage_url)} ↗
          </a>
          {listing.docs_url && (
            <a class="btn btn-quiet" href={listing.docs_url} rel="nofollow noopener" target="_blank">
              Documentation ↗
            </a>
          )}
          {listing.repo_url && (
            <a class="btn btn-quiet" href={listing.repo_url} rel="nofollow noopener" target="_blank">
              Source code ↗
            </a>
          )}
        </section>

        <section class="vote-explainer">
          <h2>Is this API any good?</h2>
          <p class="muted">
            {listing.upvotes + listing.downvotes === 0
              ? 'Nobody has voted on this listing yet. If you have used it, you are the best person to say whether it works.'
              : `${listing.upvotes} up, ${listing.downvotes} down. Upvote if it works and is maintained; downvote if it is dead, undocumented or not what it claims.`}
          </p>
        </section>

        <section class="report">
          <h2>Something wrong?</h2>
          <p class="muted">
            Links rot and projects get abandoned. Tell us and we'll fix or unpublish the listing.
          </p>
          <form method="post" action={`/apis/${listing.slug}/report`} class="report-form">
            <div class="field">
              <label for="report-kind">What's wrong</label>
              <select id="report-kind" name="kind" required>
                <option value="dead-link">The link is dead</option>
                <option value="wrong-info">Details are wrong or out of date</option>
                <option value="duplicate">Duplicate of another listing</option>
                <option value="other">Something else</option>
              </select>
            </div>
            <div class="field">
              <label for="report-message">Details (optional)</label>
              <textarea id="report-message" name="message" rows={3} maxlength={2000} />
            </div>
            <button type="submit" class="btn btn-quiet">
              Send report
            </button>
          </form>
        </section>
      </div>

      <aside class="detail-side">
        <h2 class="side-title">At a glance</h2>
        <dl class="specs">
          <Row label="Cost">
            {PRICING_LABELS[listing.pricing]}
            {listing.pricing_note && <p class="muted small">{listing.pricing_note}</p>}
          </Row>
          <Row label="Type">{KIND_LABELS[listing.kind]}</Row>
          <Row label="Auth">{AUTH_LABELS[listing.auth]}</Row>
          <Row label="CORS">
            {listing.cors === 'unknown' ? 'Not confirmed' : listing.cors === 'yes' ? 'Enabled' : 'Not enabled'}
          </Row>
          <Row label="Open source">{listing.open_source ? `Yes${listing.license ? ` (${listing.license})` : ''}` : 'No'}</Row>
          <Row label="Categories">
            <ul class="tag-list">
              {listing.categories.map((category) => (
                <li>
                  <a class="tag" href={`/?category=${encodeURIComponent(category)}`}>
                    {category}
                  </a>
                </li>
              ))}
            </ul>
          </Row>
          {listing.languages.length > 0 && (
            <Row label="Languages">
              <ul class="tag-list">
                {listing.languages.map((code) => (
                  <li>
                    <a class="tag" href={`/?lang=${encodeURIComponent(code)}`}>
                      {languageName(code)}
                    </a>
                  </li>
                ))}
              </ul>
            </Row>
          )}
          <Row label="Added">{formatDate(listing.created_at)}</Row>
          <Row label="Last verified">
            {listing.verified_at ? (
              formatDate(listing.verified_at)
            ) : (
              <span class="muted">Not yet verified by a maintainer</span>
            )}
          </Row>
        </dl>

        <p class="muted small">
          Machine-readable version:{' '}
          <a href={`/api/v1/apis/${listing.slug}`}>
            <code>/api/v1/apis/{listing.slug}</code>
          </a>
        </p>
      </aside>
    </div>

    {related.length > 0 && (
      <section class="related">
        <h2>Related listings</h2>
        <ul class="related-list">
          {related.map((item) => (
            <li>
              <a href={`/apis/${item.slug}`}>
                <strong>{item.name}</strong>
                <span class="muted">{item.tagline}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    )}
  </article>
);
