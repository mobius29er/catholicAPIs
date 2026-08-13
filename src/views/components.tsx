import type { FC } from 'hono/jsx';
import type { Filters, Listing, Sort, Track } from '../types';
import { listingPath } from '../types';
import type { FacetCount } from '../db';

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

export const Badges: FC<{ listing: Listing }> = ({ listing }) => (
  <ul class="badges">
    <li class={`badge badge-${listing.pricing}`}>{PRICING_LABELS[listing.pricing]}</li>

    {listing.track === 'api' ? (
      <>
        {listing.kind !== 'api' && <li class="badge">{KIND_LABELS[listing.kind]}</li>}
        {listing.auth === 'none' && <li class="badge badge-quiet">No key</li>}
      </>
    ) : (
      listing.platforms.slice(0, 3).map((platform) => (
        <li class="badge badge-quiet">{PLATFORM_LABELS[platform] ?? platform}</li>
      ))
    )}

    {listing.open_source && <li class="badge badge-quiet">Open source</li>}
    {listing.official && <li class="badge badge-official">Official</li>}
  </ul>
);

export const ListingCard: FC<{ listing: Listing; rank?: number }> = ({ listing, rank }) => {
  const href = listingPath(listing);

  return (
    <li class="card">
      {rank !== undefined && (
        <span class="card-rank" aria-hidden="true">
          {String(rank).padStart(2, '0')}
        </span>
      )}

      <VoteWidget listing={listing} />

      <div class="card-body">
        <h3 class="card-title">
          <a href={href}>{listing.name}</a>
          {listing.isNew && <span class="flash">Just launched</span>}
        </h3>
        <p class="card-tagline">{listing.tagline}</p>

        <Badges listing={listing} />

        <p class="card-meta">
          {listing.categories.slice(0, 3).join(' · ')}
          {listing.languages.length > 0 && (
            <>
              {' · '}
              {listing.languages.slice(0, 4).map(languageName).join(', ')}
              {listing.languages.length > 4 && ` +${listing.languages.length - 4}`}
            </>
          )}
        </p>
      </div>

      <div class="card-actions">
        <a class="btn btn-quiet" href={listing.homepage_url} rel="nofollow noopener" target="_blank">
          Visit ↗
        </a>
        <a class="btn btn-link" href={href}>
          Details
        </a>
      </div>
    </li>
  );
};

const SORTS: Array<{ value: Sort; label: string; hint: string }> = [
  { value: 'top', label: 'Top rated', hint: 'Highest confidence approval, not just raw votes' },
  { value: 'trending', label: 'Trending', hint: 'Most votes in the last two weeks' },
  { value: 'new', label: 'Newest', hint: 'Recently added to the directory' },
  { value: 'name', label: 'A–Z', hint: 'Alphabetical' },
];

export const SortTabs: FC<{ filters: Filters }> = ({ filters }) => (
  <div class="sort-tabs" role="tablist" aria-label="Sort listings">
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

/** The two-track switch. Present on both index pages so neither is a dead end. */
export const TrackTabs: FC<{ active: Track; counts: { apis: number; products: number } }> = ({
  active,
  counts,
}) => (
  <nav class="track-tabs" aria-label="Directory section">
    <a href="/" aria-current={active === 'product' ? 'page' : undefined}>
      <span class="track-label">Products</span>
      <span class="track-desc">Catholic apps &amp; services</span>
      <span class="track-count">{counts.products}</span>
    </a>
    <a href="/apis" aria-current={active === 'api' ? 'page' : undefined}>
      <span class="track-label">APIs</span>
      <span class="track-desc">Developer building blocks</span>
      <span class="track-count">{counts.apis}</span>
    </a>
  </nav>
);

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

  const clearHref = buildQuery(filters, {
    pricing: [],
    kind: [],
    platform: [],
    category: [],
    lang: [],
    auth: [],
    open_source: false,
    no_auth: false,
    page: 1,
  });

  return (
    /*
      A <details> so narrow screens can collapse the whole panel behind one
      control instead of burying the results under two screens of checkboxes.
      It ships open: on desktop CSS hides the summary and it simply stays open,
      and on mobile app.js closes it at load. With JavaScript off, a mobile
      reader gets an expanded panel — verbose, but nothing is unreachable.
    */
    <details class="filters" open data-filters>
      <summary class="filters-summary">
        <span>Filters</span>
        {activeCount > 0 && <span class="filters-badge">{activeCount}</span>}
      </summary>

      {/*
        A real wrapper, not just the summary's siblings. A <details> puts
        everything after the summary into one anonymous box, so `display: flex`
        with a gap on the <details> itself lays out summary-plus-one-blob and
        the gap between the facet groups silently never happens. Laying out
        this div instead is the fix.
      */}
      <div class="filters-body">
      <div class="filters-head">
        <h2>Filters</h2>
        {activeCount > 0 && (
          <a class="btn btn-link" href={clearHref} rel="nofollow">
            Clear all
          </a>
        )}
      </div>

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

      <FacetGroup
        legend="Category"
        filters={filters}
        paramKey="category"
        selected={filters.categories}
        options={facets.categories}
        limit={14}
      />

      <FacetGroup
        legend="Language"
        filters={filters}
        paramKey="lang"
        selected={filters.languages}
        options={facets.languages}
        labels={LANGUAGE_NAMES}
        limit={10}
      />
      </div>
    </details>
  );
};

export const Pagination: FC<{ filters: Filters; page: number; pageCount: number }> = ({
  filters,
  page,
  pageCount,
}) => {
  if (pageCount <= 1) return null;

  return (
    <nav class="pagination" aria-label="Pagination">
      {page > 1 ? (
        <a class="btn btn-quiet" href={buildQuery(filters, { page: page - 1 })} rel="prev">
          ← Previous
        </a>
      ) : (
        <span class="btn btn-quiet is-disabled" aria-hidden="true">
          ← Previous
        </span>
      )}

      <span class="muted">
        Page {page} of {pageCount}
      </span>

      {page < pageCount ? (
        <a class="btn btn-quiet" href={buildQuery(filters, { page: page + 1 })} rel="next">
          Next →
        </a>
      ) : (
        <span class="btn btn-quiet is-disabled" aria-hidden="true">
          Next →
        </span>
      )}
    </nav>
  );
};
