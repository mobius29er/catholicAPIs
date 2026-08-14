import type { FC } from 'hono/jsx';
import type { Listing } from '../types';
import { listingPath } from '../types';
import {
  AUTH_LABELS,
  Badges,
  HealthDot,
  KIND_LABELS,
  PLATFORM_LABELS,
  PRICING_LABELS,
  SourceCredit,
  VoteWidget,
  languageName,
  timeAgo,
} from './components';

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

/** What just happened, if the visitor arrived here from a form post. */
export type DetailNotice =
  | 'reported'
  | 'reported-deprecated'
  | 'reported-revived'
  | 'rate-limited'
  | null;

const NOTICES: Record<Exclude<DetailNotice, null>, { tone: string; text: string }> = {
  reported: {
    tone: 'notice-ok',
    text: 'Thanks — the report is in the moderation queue.',
  },
  'reported-deprecated': {
    tone: 'notice-ok',
    text: "Thanks — we've logged this as deprecated. A moderator will check it and flag the listing.",
  },
  'reported-revived': {
    tone: 'notice-ok',
    text: "Thanks — we've logged that this one is working again. A moderator will check and lift the flag.",
  },
  'rate-limited': {
    tone: 'notice-warn',
    text: 'Too many requests from your address just now. Try again in a little while.',
  },
};

export const Detail: FC<{ listing: Listing; related: Listing[]; notice?: DetailNotice }> = ({
  listing,
  related,
  notice,
}) => {
  const isApi = listing.track === 'api';
  const root = isApi ? '/apis' : '/';
  const path = listingPath(listing);
  const noticeCopy = notice ? NOTICES[notice] : null;

  return (
  <article class="wrap detail">
    {/* The category crumb is only a crumb when there is a category. It used to
        render regardless, linking to `?category=` under the label "Listing". */}
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href={root}>{isApi ? 'APIs' : 'Products'}</a>
      <span aria-hidden="true">/</span>
      {listing.categories[0] && (
        <>
          <a href={`${root}?category=${encodeURIComponent(listing.categories[0])}`}>
            {listing.categories[0]}
          </a>
          <span aria-hidden="true">/</span>
        </>
      )}
      <span aria-current="page">{listing.name}</span>
    </nav>

    {noticeCopy && (
      <p class={`notice ${noticeCopy.tone}`} role="status">
        {noticeCopy.text}
      </p>
    )}

    <header class="detail-head">
      <VoteWidget listing={listing} large />

      <div>
        <h1>
          {listing.name}
          {listing.isNew && <span class="flash">Just launched</span>}
        </h1>
        <p class="detail-tagline">{listing.tagline}</p>
        <Badges listing={listing} />
      </div>
    </header>

    {/*
      Deprecated listings stay published on purpose. Someone searching for a
      project that died deserves to find out that it died, and what replaced it
      — deleting the page would just send them round the same loop again.
    */}
    {listing.deprecated && (
      <aside class="banner banner-dead" role="note">
        <p>
          <strong>Not live any more.</strong>{' '}
          {listing.deprecated_note ??
            'This project is no longer maintained. It is kept here so the trail does not go cold, but do not build anything new on it.'}
        </p>

        {/*
          The way back. Projects do come back — a maintainer returns, someone
          forks it, a domain gets renewed — and a directory that can mark
          things dead but never undo it is just a slower kind of wrong.
        */}
        <form method="post" action={`${path}/report`} class="banner-action">
          <input type="hidden" name="kind" value="revived" />
          <button type="submit" class="btn btn-revive">
            ↺ It's working again
          </button>
          <span class="muted small">
            One click. A moderator will check and lift the flag.
          </span>
        </form>
      </aside>
    )}

    {!listing.deprecated && listing.health_state === 'down' && (
      <aside class="banner banner-down" role="note">
        <strong>Not responding.</strong> The last {' '}
        {listing.health_fails === 1 ? 'check' : `${listing.health_fails} checks`} of{' '}
        {hostOf(listing.homepage_url)} failed
        {listing.health_code ? ` (HTTP ${listing.health_code})` : ''}
        {timeAgo(listing.health_checked_at) ? `, most recently ${timeAgo(listing.health_checked_at)}` : ''}
        . It may be a temporary outage — or the project may be gone.
      </aside>
    )}

    <div class="detail-grid">
      <div class="detail-main">
        {/*
          Imported listings often arrive with a one-line description identical
          to the tagline. Printing it twice reads as a rendering bug, so the
          section only appears when it has something new to say.
        */}
        {listing.description && listing.description !== listing.tagline && (
          <section>
            <h2 class="visually-hidden">Description</h2>
            <p class="prose">{listing.description}</p>
          </section>
        )}

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
          <h2>{isApi ? 'Is this API any good?' : 'Is this worth your time?'}</h2>
          <p class="muted">
            {listing.upvotes + listing.downvotes === 0
              ? 'Nobody has voted on this listing yet. If you have used it, you are the best person to say whether it works.'
              : `${listing.upvotes} up, ${listing.downvotes} down. Upvote if it works and is maintained; downvote if it is dead, undocumented or not what it claims.`}
          </p>
        </section>

        <section class="report">
          <h2>Something wrong?</h2>
          <p class="muted">
            Links rot and projects get abandoned. Tell us and we'll flag, fix or unpublish the
            listing.
          </p>

          {/*
            The one-click path. Knowing a project is dead is the single most
            common correction, and making someone fill in a form to say so is
            how directories end up full of ghosts.
          */}
          {!listing.deprecated && (
            <form method="post" action={`${path}/report`} class="report-quick">
              <input type="hidden" name="kind" value="deprecated" />
              <button type="submit" class="btn btn-warn">
                ⚑ Report as deprecated
              </button>
              <span class="muted small">
                One click. Use this if {listing.name} is abandoned, dead or has been superseded.
              </span>
            </form>
          )}

          <form method="post" action={`${path}/report`} class="report-form">
            <div class="field">
              <label for="report-kind">What's wrong</label>
              <select id="report-kind" name="kind" required>
                <option value="dead-link">The link is dead</option>
                <option value="deprecated">Abandoned or no longer maintained</option>
                <option value="moved">It has moved somewhere else</option>
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
          {isApi ? (
            <>
              <Row label="Type">{KIND_LABELS[listing.kind]}</Row>
              <Row label="Auth">{AUTH_LABELS[listing.auth]}</Row>
              <Row label="CORS">
                {listing.cors === 'unknown'
                  ? 'Not confirmed'
                  : listing.cors === 'yes'
                    ? 'Enabled'
                    : 'Not enabled'}
              </Row>
            </>
          ) : (
            listing.platforms.length > 0 && (
              <Row label="Runs on">
                <ul class="tag-list">
                  {listing.platforms.map((platform) => (
                    <li>
                      <a class="tag" href={`/?platform=${encodeURIComponent(platform)}`}>
                        {PLATFORM_LABELS[platform] ?? platform}
                      </a>
                    </li>
                  ))}
                </ul>
              </Row>
            )
          )}
          <Row label="Open source">{listing.open_source ? `Yes${listing.license ? ` (${listing.license})` : ''}` : 'No'}</Row>
          <Row label="Categories">
            <ul class="tag-list">
              {listing.categories.map((category) => (
                <li>
                  <a class="tag" href={`${root}?category=${encodeURIComponent(category)}`}>
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
                    <a class="tag" href={`${root}?lang=${encodeURIComponent(code)}`}>
                      {languageName(code)}
                    </a>
                  </li>
                ))}
              </ul>
            </Row>
          )}
          {listing.launched_at && <Row label="Launched">{formatDate(listing.launched_at)}</Row>}
          <Row label="Listed">{formatDate(listing.created_at)}</Row>
          <Row label="Last verified">
            {listing.verified_at ? (
              formatDate(listing.verified_at)
            ) : (
              <span class="muted">Not yet verified by a maintainer</span>
            )}
          </Row>
          <Row label="Status">
            {listing.deprecated ? (
              <span class="health health-down">
                <span class="health-dot" aria-hidden="true" />
                Deprecated
              </span>
            ) : (
              <HealthDot listing={listing} verbose />
            )}
          </Row>
          {listing.source && (
            <Row label="Found in">
              <SourceCredit listing={listing} />
            </Row>
          )}
        </dl>

        <p class="muted small">
          Machine-readable version:{' '}
          <a href={`/api/v1/listings/${listing.slug}`}>
            <code>/api/v1/listings/{listing.slug}</code>
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
              <a href={listingPath(item)}>
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
};
