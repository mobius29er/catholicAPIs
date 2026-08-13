import type { FC } from 'hono/jsx';
import type { Filters, Listing, Sort, Track } from '../types';
import { listingPath } from '../types';
import type { FacetCount } from '../db';
import { LogoMark, Monogram, SpotlightBeam } from './art';

export const KIND_LABELS: Record<string, string> = {
  api: 'Hosted API',
  dataset: 'Dataset',
  library: 'Library',
  mcp: 'MCP server',
};

export const PRICING_LABELS: Record<string, string> = {
  free: 'Free',
  freemium: 'Freemium',
  paid: 'Paid',
};

export const PLATFORM_LABELS: Record<string, string> = {
  ios: 'iOS',
  android: 'Android',
  web: 'Web',
  desktop: 'Desktop',
  parish: 'For parishes',
};

export const AUTH_LABELS: Record<string, string> = {
  none: 'No key needed',
  'api-key': 'API key',
  oauth: 'OAuth',
  unknown: 'Auth unknown',
};

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  la: 'Latin',
  pt: 'Portuguese',
  de: 'German',
  pl: 'Polish',
  cs: 'Czech',
  sk: 'Slovak',
  nl: 'Dutch',
  hu: 'Hungarian',
  ta: 'Tamil',
};

export const languageName = (code: string): string => LANGUAGE_NAMES[code] ?? code.toUpperCase();

/** The publisher, as far as we can honestly know it: the host it lives on. */
export const publisherOf = (url: string): string => {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** Where each track's index lives. Filter links must stay inside their track. */
export const trackRoot = (track: Track): string => (track === 'product' ? '/' : '/apis');

/** Rebuilds the current query string with one parameter changed. */
export function buildQuery(
  filters: Filters,
  overrides: Partial<Record<string, string | string[] | number | boolean>> = {},
): string {
  const params = new URLSearchParams();

  const base: Record<string, string | string[] | number | boolean> = {
    q: filters.q,
    sort: filters.sort,
    pricing: filters.pricing,
    kind: filters.kind,
    platform: filters.platforms,
    category: filters.categories,
    lang: filters.languages,
    auth: filters.auth,
    open_source: filters.openSource,
    no_auth: filters.noAuth,
    page: filters.page,
  };

  for (const [key, value] of Object.entries({ ...base, ...overrides })) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    if (key === 'sort' && value === 'top') continue;
    if (key === 'page' && Number(value) <= 1) continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.set(key, value === true ? '1' : String(value));
    }
  }

  const qs = params.toString();
  const root = trackRoot(filters.track);
  return qs ? `${root}?${qs}` : root;
}

/** Toggles one value inside a multi-select facet and returns the resulting URL. */
function toggleUrl(filters: Filters, key: string, current: string[], value: string): string {
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return buildQuery(filters, { [key]: next, page: 1 });
}

/* ----------------------------------------------------------------- vote --- */

export const VoteWidget: FC<{ listing: Listing; large?: boolean }> = ({ listing, large }) => {
  const noun = listing.track === 'product' ? 'this' : 'this API';

  return (
    <form
      class={large ? 'vote vote-large' : 'vote'}
      method="post"
      action={`${listingPath(listing)}/vote`}
      data-vote
    >
      <button
        type="submit"
        name="value"
        value="1"
        class="vote-btn vote-up"
        aria-pressed={listing.myVote === 1 ? 'true' : 'false'}
        aria-label={`Upvote ${listing.name}`}
        title={`Worth using — recommend ${noun}`}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M8 2.5 15 12H1z" />
        </svg>
      </button>

      <span
        class="vote-score"
        data-vote-score
        title={`${listing.upvotes} up · ${listing.downvotes} down`}
      >
        {listing.score}
      </span>

      <button
        type="submit"
        name="value"
        value="-1"
        class="vote-btn vote-down"
        aria-pressed={listing.myVote === -1 ? 'true' : 'false'}
        aria-label={`Downvote ${listing.name}`}
        title="Broken, abandoned or not what it claims"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M8 13.5 1 4h14z" />
        </svg>
      </button>

      <span class="visually-hidden" data-vote-status role="status" aria-live="polite" />
    </form>
  );
};

/* ---------------------------------------------------------------- badges -- */

export const Badges: FC<{ listing: Listing }> = ({ listing }) => (
  <ul class="badges">
    <li class={`badge badge-${listing.pricing}`}>{PRICING_LABELS[listing.pricing]}</li>

    {listing.track === 'api' ? (
      <>
        {listing.kind !== 'api' && <li class="badge">{KIND_LABELS[listing.kind]}</li>}
        {listing.auth === 'none' && <li class="badge">No key</li>}
      </>
    ) : (
      listing.platforms
        .slice(0, 3)
        .map((platform) => <li class="badge">{PLATFORM_LABELS[platform] ?? platform}</li>)
    )}

    {listing.open_source && <li class="badge">Open source</li>}
    {listing.official && <li class="badge badge-official">Official</li>}
  </ul>
);

/* ------------------------------------------------------------------ row --- */

/**
 * One row of the leaderboard: rank · logo · details · publisher · vote.
 *
 * The publisher column is the reference's "by <maker>" slot. We have no maker
 * names and will not invent them, so it shows the host the listing actually
 * lives on — real information in the same shape.
 */
export const ListingRow: FC<{ listing: Listing; rank: number; rankNote?: string }> = ({
  listing,
  rank,
  rankNote,
}) => {
  const href = listingPath(listing);
  const publisher = publisherOf(listing.homepage_url);

  return (
    <li class="row">
      <div class="row-rank" aria-hidden="true">
        <span class="row-rank-number">{rank}</span>
        {rankNote && <span class="row-rank-note">{rankNote}</span>}
      </div>

      <a class="row-logo" href={href} tabindex={-1} aria-hidden="true">
        <LogoMark name={listing.name} slug={listing.slug} />
      </a>

      <div class="row-body">
        <h3 class="row-name">
          <a href={href}>{listing.name}</a>
          {listing.isNew && <span class="flash">Just launched</span>}
        </h3>
        <p class="row-tagline">{listing.tagline}</p>

        <ul class="pills">
          {listing.categories.slice(0, 2).map((category) => (
            <li class="pill">{category}</li>
          ))}
          {listing.track === 'api' && listing.auth === 'none' && (
            <li class="pill pill-quiet">No key</li>
          )}
          {listing.open_source && <li class="pill pill-quiet">Open source</li>}
        </ul>
      </div>

      <div class="row-by">
        <Monogram label={publisher} />
        <span>
          <small>from</small>
          <a href={listing.homepage_url} rel="nofollow noopener" target="_blank">
            {publisher}
          </a>
          <small class={`row-price price-${listing.pricing}`}>
            {PRICING_LABELS[listing.pricing]}
          </small>
        </span>
      </div>

      <VoteWidget listing={listing} />
    </li>
  );
};

/* ----------------------------------------------------------- list header -- */

const SORTS: Array<{ value: Sort; label: string; hint: string }> = [
  { value: 'top', label: 'Top rated', hint: 'Highest confidence approval, not just raw votes' },
  { value: 'trending', label: 'Trending', hint: 'Most votes in the last two weeks' },
  { value: 'new', label: 'Newest', hint: 'Recently added to the directory' },
  { value: 'name', label: 'A–Z', hint: 'Alphabetical' },
];

/** The "Today ▾" control from the reference, as a row of links. */
export const SortTabs: FC<{ filters: Filters }> = ({ filters }) => (
  <div class="sorts" role="tablist" aria-label="Sort listings">
    {SORTS.map((sort) => (
      <a
        role="tab"
        aria-selected={filters.sort === sort.value ? 'true' : 'false'}
        title={sort.hint}
        href={buildQuery(filters, { sort: sort.value, page: 1 })}
      >
        {sort.label}
      </a>
    ))}
  </div>
);

/** The two-track switch, as a pair of pills above the list. */
export const TrackTabs: FC<{ active: Track; counts: { apis: number; products: number } }> = ({
  active,
  counts,
}) => (
  <nav class="tracks" aria-label="Directory section">
    <a href="/" aria-current={active === 'product' ? 'page' : undefined}>
      Products <span>{counts.products}</span>
    </a>
    <a href="/apis" aria-current={active === 'api' ? 'page' : undefined}>
      APIs <span>{counts.apis}</span>
    </a>
  </nav>
);

/* -------------------------------------------------------------- filters --- */

const FacetGroup: FC<{
  legend: string;
  filters: Filters;
  paramKey: string;
  selected: string[];
  options: FacetCount[];
  labels?: Record<string, string>;
  limit?: number;
}> = ({ legend, filters, paramKey, selected, options, labels, limit }) => {
  const shown = limit ? options.slice(0, limit) : options;
  if (shown.length === 0) return null;

  return (
    <fieldset class="facet">
      <legend>{legend}</legend>
      <ul>
        {shown.map((option) => {
          const isOn = selected.includes(option.value);
          return (
            <li>
              <a
                class={isOn ? 'facet-option is-on' : 'facet-option'}
                href={toggleUrl(filters, paramKey, selected, option.value)}
                rel="nofollow"
              >
                <span class="facet-check" aria-hidden="true">
                  {isOn ? '✓' : ''}
                </span>
                <span class="facet-label">{labels?.[option.value] ?? option.value}</span>
                <span class="facet-count">{option.count}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
};

export const FilterPanel: FC<{
  filters: Filters;
  facets: {
    pricing: FacetCount[];
    kind: FacetCount[];
    platforms: FacetCount[];
    categories: FacetCount[];
    languages: FacetCount[];
  };
}> = ({ filters, facets }) => {
  const isApiTrack = filters.track === 'api';

  const activeCount =
    filters.pricing.length +
    filters.kind.length +
    filters.platforms.length +
    filters.categories.length +
    filters.languages.length +
    (filters.openSource ? 1 : 0) +
    (filters.noAuth ? 1 : 0);

  /*
    A <details> collects everything after its <summary> into one anonymous box,
    so laying out the <details> itself gives you summary-plus-one-blob and any
    gap between the facet groups silently never happens. Hence `.filter-body`.

    Closed unless something is filtered: <summary> toggles natively, so this
    costs nothing with JavaScript off and keeps the list where the eye is.
  */
  return (
    <details class="filter" open={activeCount > 0}>
      <summary class="filter-summary">
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path
            d="M2 4h12M4.5 8h7M7 12h2"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            fill="none"
          />
        </svg>
        Filters
        {activeCount > 0 && <span class="filter-badge">{activeCount}</span>}
      </summary>

      <div class="filter-body">
        <FacetGroup
          legend="Cost"
          filters={filters}
          paramKey="pricing"
          selected={filters.pricing}
          options={facets.pricing}
          labels={PRICING_LABELS}
        />

        {isApiTrack ? (
          <FacetGroup
            legend="Type"
            filters={filters}
            paramKey="kind"
            selected={filters.kind}
            options={facets.kind}
            labels={KIND_LABELS}
          />
        ) : (
          <FacetGroup
            legend="Platform"
            filters={filters}
            paramKey="platform"
            selected={filters.platforms}
            options={facets.platforms}
            labels={PLATFORM_LABELS}
          />
        )}

        <FacetGroup
          legend="Category"
          filters={filters}
          paramKey="category"
          selected={filters.categories}
          options={facets.categories}
          limit={10}
        />

        <FacetGroup
          legend="Language"
          filters={filters}
          paramKey="lang"
          selected={filters.languages}
          options={facets.languages}
          labels={LANGUAGE_NAMES}
          limit={8}
        />

        <fieldset class="facet">
          <legend>Quick filters</legend>
          <ul>
            <li>
              <a
                class={filters.openSource ? 'facet-option is-on' : 'facet-option'}
                href={buildQuery(filters, { open_source: !filters.openSource, page: 1 })}
                rel="nofollow"
              >
                <span class="facet-check" aria-hidden="true">
                  {filters.openSource ? '✓' : ''}
                </span>
                <span class="facet-label">Open source only</span>
              </a>
            </li>
            {isApiTrack && (
              <li>
                <a
                  class={filters.noAuth ? 'facet-option is-on' : 'facet-option'}
                  href={buildQuery(filters, { no_auth: !filters.noAuth, page: 1 })}
                  rel="nofollow"
                >
                  <span class="facet-check" aria-hidden="true">
                    {filters.noAuth ? '✓' : ''}
                  </span>
                  <span class="facet-label">No API key required</span>
                </a>
              </li>
            )}
          </ul>
        </fieldset>

        {activeCount > 0 && (
          <p class="filter-clear">
            <a
              href={buildQuery(filters, {
                pricing: [],
                kind: [],
                platform: [],
                category: [],
                lang: [],
                auth: [],
                open_source: false,
                no_auth: false,
                page: 1,
              })}
              rel="nofollow"
            >
              Clear all filters
            </a>
          </p>
        )}
      </div>
    </details>
  );
};

/* ----------------------------------------------------------------- rail --- */

export const Spotlight: FC<{ listing: Listing }> = ({ listing }) => (
  <section class="rail-panel rail-spotlight">
    <SpotlightBeam />
    <p class="rail-title">Spotlight</p>

    <div class="spotlight-head">
      <LogoMark name={listing.name} slug={listing.slug} />
      <div>
        <p class="spotlight-name">{listing.name}</p>
        <p class="spotlight-from">{publisherOf(listing.homepage_url)}</p>
      </div>
    </div>

    <p class="spotlight-blurb">{listing.tagline}</p>

    <a class="rail-link" href={listingPath(listing)}>
      Read the details →
    </a>
  </section>
);

export const TrendingTopics: FC<{ filters: Filters; categories: FacetCount[] }> = ({
  filters,
  categories,
}) => (
  <section class="rail-panel">
    <div class="rail-head">
      <p class="rail-title">Trending topics</p>
      <a class="rail-see-all" href={buildQuery(filters, { page: 1 })}>
        See all
      </a>
    </div>

    <ul class="topics">
      {categories.slice(0, 6).map((category) => (
        <li>
          <a href={buildQuery(filters, { category: [category.value], page: 1 })}>
            <span class="topic-dot" aria-hidden="true" />
            <span class="topic-name">{category.value}</span>
            <span class="topic-count">{category.count}</span>
          </a>
        </li>
      ))}
    </ul>
  </section>
);

/**
 * The reference has a newsletter box here. There is no mailing list behind this
 * site, and a signup field that goes nowhere is a lie — so the same slot offers
 * the feeds that do exist.
 */
export const FeedPanel: FC = () => (
  <section class="rail-panel rail-feed">
    <p class="rail-title">Stay in the loop</p>
    <p>New listings as they are published. No account, no mailing list.</p>
    <div class="rail-actions">
      <a class="btn btn-primary" href="/feed.xml">
        RSS feed
      </a>
      <a class="btn btn-outline" href="/api/v1">
        JSON API
      </a>
    </div>
  </section>
);

/* ----------------------------------------------------------- pagination --- */

export const Pagination: FC<{ filters: Filters; page: number; pageCount: number }> = ({
  filters,
  page,
  pageCount,
}) => {
  if (pageCount <= 1) return null;

  return (
    <nav class="pagination" aria-label="Pagination">
      {page > 1 ? (
        <a class="btn btn-outline" href={buildQuery(filters, { page: page - 1 })} rel="prev">
          ← Previous
        </a>
      ) : (
        <span class="btn btn-outline is-disabled" aria-hidden="true">
          ← Previous
        </span>
      )}

      <span class="muted small">
        Page {page} of {pageCount}
      </span>

      {page < pageCount ? (
        <a class="btn btn-outline" href={buildQuery(filters, { page: page + 1 })} rel="next">
          Next →
        </a>
      ) : (
        <span class="btn btn-outline is-disabled" aria-hidden="true">
          Next →
        </span>
      )}
    </nav>
  );
};
