import type { FC } from 'hono/jsx';
import type { Filters, HealthState, Listing, Sort, Track } from '../types';
import { listingPath } from '../types';
import type { FacetCount } from '../db';
import { LogoMark, Monogram, SpotlightBeam, TopicIcon } from './art';

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

/**
 * Every narrowing parameter, off. One constant because there are two "clear
 * everything" affordances — the panel's and the empty state's — and they had
 * drifted: the empty state left `auth` set, so clearing from there could still
 * return nothing and look broken.
 */
export const CLEARED: Partial<Record<string, string | string[] | number | boolean>> = {
  q: '',
  pricing: [],
  kind: [],
  platform: [],
  category: [],
  lang: [],
  auth: [],
  open_source: false,
  no_auth: false,
  page: 1,
};

/* --------------------------------------------------------------- health --- */

export const HEALTH_LABELS: Record<HealthState, string> = {
  up: 'Responding',
  down: 'Not responding',
  unknown: 'Not checked yet',
};

/** Coarse "N ago", in the largest unit that is still true. */
export function timeAgo(iso: string | null, now: number = Date.now()): string | null {
  if (!iso) return null;
  const then = new Date(iso.endsWith('Z') ? iso : `${iso}Z`).getTime();
  if (Number.isNaN(then)) return null;

  const seconds = Math.max(0, Math.round((now - then) / 1000));
  const units: Array<[number, string]> = [
    [86_400 * 30, 'month'],
    [86_400 * 7, 'week'],
    [86_400, 'day'],
    [3_600, 'hour'],
    [60, 'minute'],
  ];

  for (const [size, name] of units) {
    const n = Math.floor(seconds / size);
    if (n >= 1) return `${n} ${name}${n === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

/**
 * The uptime indicator.
 *
 * On a dense list we only draw the dot when we actually know something. Most
 * listings sit at `unknown` until the cron has walked round to them, and a
 * column of grey rings claiming nothing would be pure noise — so rows stay
 * silent and the detail page (`verbose`) is where "not checked yet" is said
 * out loud.
 */
export const HealthDot: FC<{ listing: Listing; verbose?: boolean }> = ({ listing, verbose }) => {
  const state = listing.health_state;
  if (!verbose && state !== 'down' && state !== 'up') return null;

  const checked = timeAgo(listing.health_checked_at);
  const detail =
    state === 'unknown'
      ? 'No successful check yet'
      : `${HEALTH_LABELS[state]}${listing.health_code ? ` · HTTP ${listing.health_code}` : ''}${
          checked ? ` · checked ${checked}` : ''
        }`;

  return (
    <span class={`health health-${state}`} title={detail}>
      <span class="health-dot" aria-hidden="true" />
      <span class={verbose ? undefined : 'visually-hidden'}>{HEALTH_LABELS[state]}</span>
      {verbose && checked && <small class="health-when">checked {checked}</small>}
    </span>
  );
};

/* ---------------------------------------------------------- attribution --- */

/**
 * Credit for the list a listing was imported from. These directories did the
 * legwork years before this site existed; the least we can do is say so on the
 * listing itself rather than burying it on an about page.
 */
export const SourceCredit: FC<{ listing: Listing }> = ({ listing }) => {
  if (!listing.source) return null;

  return (
    <span class="credit">
      Listed via{' '}
      {listing.source_url ? (
        <a href={listing.source_url} rel="nofollow noopener" target="_blank">
          {listing.source}
        </a>
      ) : (
        listing.source
      )}
    </span>
  );
};

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

  /*
    `is-top` rather than `:first-child`. The rank-1 treatment was keyed to
    position in the DOM, so on page two the row holding rank 25 was painted as
    the winner.
  */
  const className = [
    'row',
    rank === 1 ? 'is-top' : '',
    listing.deprecated ? 'is-deprecated' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li class={className}>
      <div class="row-rank">
        <span class="row-rank-number">{rank}</span>
        {rankNote && <span class="row-rank-note">{rankNote}</span>}
      </div>

      <span class="row-logo" aria-hidden="true">
        <LogoMark name={listing.name} slug={listing.slug} />
      </span>

      <div class="row-body">
        <h3 class="row-name">
          {/* Stretched by CSS to cover the row, so the whole card is the
              target rather than one line of 17px text. The publisher link and
              the vote control sit above it. */}
          <a class="row-link" href={href}>
            {listing.name}
          </a>
          {listing.isNew && <span class="flash">Just launched</span>}
          {listing.deprecated && <span class="flash flash-dead">Deprecated</span>}
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
            <HealthDot listing={listing} />
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

/** The label shown on the sort button for a given sort key. */
export const sortLabel = (sort: Sort): string =>
  (SORTS.find((s) => s.value === sort) ?? SORTS[0]).label;

const Chevron: FC = () => (
  <svg class="menu-chevron" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path
      d="M2.5 4.5 6 8l3.5-3.5"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

/**
 * The reference's "Today ▾" control: the current choice, a chevron, and a menu
 * that opens *over* the page.
 *
 * It was a row of four links with `role="tab"` on them — ARIA that promises
 * arrow-key navigation and a tabpanel, neither of which existed. These are
 * four URLs, so they are four links, and the current one is `aria-current`.
 */
export const SortMenu: FC<{ filters: Filters }> = ({ filters }) => {
  const active = SORTS.find((sort) => sort.value === filters.sort) ?? SORTS[0];

  return (
    <details class="menu menu-sort" data-menu>
      <summary class="menu-button">
        <span class="visually-hidden">Sort by: </span>
        <span class="menu-button-label" data-sort-label>
          {active.label}
        </span>
        <Chevron />
      </summary>

      <div class="menu-pop">
        <ul class="menu-list">
          {SORTS.map((sort) => (
            <li>
              <a
                href={buildQuery(filters, { sort: sort.value, page: 1 })}
                aria-current={filters.sort === sort.value ? 'true' : undefined}
              >
                <span class="menu-item-label">{sort.label}</span>
                <span class="menu-item-hint">{sort.hint}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
};

/* -------------------------------------------------------------- filters --- */

/**
 * One facet option.
 *
 * `role="checkbox"` with `aria-checked` rather than a bare link: selected state
 * used to be carried by a tick that was `aria-hidden`, plus a colour and a font
 * weight, so a screen reader heard "link, Free 125" whether the filter was on
 * or off. It is still an `<a href>` underneath, so it keeps working with
 * scripting off.
 *
 * An option whose disjunctive count is zero stays in place, dimmed and
 * unclickable, rather than disappearing — a facet list that changes length
 * mid-refinement moves the row out from under the pointer.
 */
const FacetOption: FC<{
  href: string;
  label: string;
  isOn: boolean;
  count?: number;
  /** Query parameter this option toggles — read by app.js. */
  paramKey: string;
  /** The value to toggle, or omitted for the boolean quick filters. */
  value?: string;
}> = ({ href, label, isOn, count, paramKey, value }) => {
  const empty = count === 0 && !isOn;
  const className = `facet-option${isOn ? ' is-on' : ''}${empty ? ' is-empty' : ''}`;

  return (
    <li>
      <a
        class={className}
        href={empty ? undefined : href}
        role="checkbox"
        aria-checked={isOn ? 'true' : 'false'}
        aria-disabled={empty ? 'true' : undefined}
        rel="nofollow"
        data-facet={paramKey}
        data-facet-value={value}
      >
        <span class="facet-check" aria-hidden="true" />
        <span class="facet-label">{label}</span>
        {count !== undefined && <span class="facet-count">{count}</span>}
      </a>
    </li>
  );
};

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
        {shown.map((option) => (
          <FacetOption
            href={toggleUrl(filters, paramKey, selected, option.value)}
            label={labels?.[option.value] ?? option.value}
            isOn={selected.includes(option.value)}
            count={option.count}
            paramKey={paramKey}
            value={option.value}
          />
        ))}
      </ul>
    </fieldset>
  );
};

export interface Facets {
  pricing: FacetCount[];
  kind: FacetCount[];
  platforms: FacetCount[];
  categories: FacetCount[];
  languages: FacetCount[];
}

/** How many separate things are currently narrowing the list. */
export const activeFilterCount = (filters: Filters): number =>
  filters.pricing.length +
  filters.kind.length +
  filters.platforms.length +
  filters.categories.length +
  filters.languages.length +
  (filters.openSource ? 1 : 0) +
  (filters.noAuth ? 1 : 0);

/**
 * The contents of the filter popover, on their own.
 *
 * Separate from the <details> that holds it so a refinement can re-render just
 * the options — fresh counts, fresh checked states, fresh links — while the
 * panel stays open and the reader carries on ticking boxes. Re-rendering the
 * <details> itself would slam it shut on every click.
 */
export const FilterBody: FC<{ filters: Filters; facets: Facets }> = ({ filters, facets }) => {
  const isApiTrack = filters.track === 'api';
  const activeCount = activeFilterCount(filters);

  return (
    <>
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
          <FacetOption
            href={buildQuery(filters, { open_source: !filters.openSource, page: 1 })}
            label="Open source only"
            isOn={filters.openSource}
            paramKey="open_source"
          />
          {isApiTrack && (
            <FacetOption
              href={buildQuery(filters, { no_auth: !filters.noAuth, page: 1 })}
              label="No API key required"
              isOn={filters.noAuth}
              paramKey="no_auth"
            />
          )}
        </ul>
      </fieldset>

      {activeCount > 0 && (
        <p class="filter-clear">
          <a href={buildQuery(filters, CLEARED)} rel="nofollow">
            Clear all filters
          </a>
        </p>
      )}
    </>
  );
};

export const FilterPanel: FC<{ filters: Filters; facets: Facets }> = ({ filters, facets }) => {
  const activeCount = activeFilterCount(filters);

  /*
    A popover, anchored to its own button, and *never* open on arrival.

    This used to be an inline <details> sitting in the flow directly above the
    list, holding 27 options in a three-column grid — opening it shoved the
    entire leaderboard down by something like 600px, and because it re-rendered
    `open` whenever a filter was set, every refinement landed the reader at the
    top of a page whose list now started below the fold. The panel is out of
    flow now, so opening and closing it moves nothing at all.

    Still a <details>: it toggles natively, so the whole thing works with
    scripting off. app.js only adds click-outside and Escape.
  */
  return (
    <details class="menu filter" data-menu>
      <summary class="menu-button">
        <svg class="filter-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path
            d="M2 4h12M4.5 8h7M7 12h2"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            fill="none"
          />
        </svg>
        <span class="menu-button-label">Filters</span>
        {/* Always in the DOM so a refinement can update it in place. */}
        <span class="filter-badge" data-filter-badge hidden={activeCount === 0}>
          {activeCount}
        </span>
        <Chevron />
      </summary>

      <div class="menu-pop filter-pop" data-filter-body>
        <FilterBody filters={filters} facets={facets} />
      </div>
    </details>
  );
};

/* -------------------------------------------------------- applied chips --- */

interface Applied {
  label: string;
  /** Where to go to drop just this one. */
  href: string;
  /** Query parameter it came from, so app.js can toggle it off in place. */
  paramKey: string;
  value?: string;
}

/** Everything currently narrowing the list, in the order the panel shows it. */
export function appliedFilters(filters: Filters): Applied[] {
  const chips: Applied[] = [];
  const group = (key: string, values: string[], labels?: Record<string, string>) => {
    for (const value of values) {
      chips.push({
        label: labels?.[value] ?? value,
        href: toggleUrl(filters, key, values, value),
        paramKey: key,
        value,
      });
    }
  };

  if (filters.q) {
    chips.push({
      label: `“${filters.q}”`,
      href: buildQuery(filters, { q: '', page: 1 }),
      paramKey: 'q',
    });
  }
  group('pricing', filters.pricing, PRICING_LABELS);
  group('kind', filters.kind, KIND_LABELS);
  group('platform', filters.platforms, PLATFORM_LABELS);
  group('category', filters.categories);
  group('lang', filters.languages, LANGUAGE_NAMES);
  if (filters.openSource) {
    chips.push({
      label: 'Open source',
      href: buildQuery(filters, { open_source: false, page: 1 }),
      paramKey: 'open_source',
    });
  }
  if (filters.noAuth) {
    chips.push({
      label: 'No API key',
      href: buildQuery(filters, { no_auth: false, page: 1 }),
      paramKey: 'no_auth',
    });
  }
  return chips;
}

/**
 * The applied-filter row: what is on, and one click to take any of it off.
 *
 * Fixed height whether or not anything is applied. It carries the result count
 * on its own, so the first chip appearing cannot shunt the list downward — the
 * row is already there, holding its space.
 */
export const AppliedFilters: FC<{ filters: Filters; total: number }> = ({ filters, total }) => {
  const chips = appliedFilters(filters);
  const noun = filters.track === 'product' ? 'product' : 'API';

  return (
    <div class="applied">
      <p class="applied-count" aria-live="polite">
        <strong>{total}</strong> {total === 1 ? noun : `${noun}s`}
      </p>

      {chips.length > 0 && (
        <ul class="chips">
          {chips.map((chip) => (
            <li>
              <a
                class="chip"
                href={chip.href}
                rel="nofollow"
                data-facet={chip.paramKey}
                data-facet-value={chip.value}
              >
                {chip.label}
                <span class="chip-x" aria-hidden="true">
                  ×
                </span>
                <span class="visually-hidden">— remove this filter</span>
              </a>
            </li>
          ))}
          <li>
            <a class="chip chip-clear" href={buildQuery(filters, CLEARED)} rel="nofollow">
              Clear all
            </a>
          </li>
        </ul>
      )}
    </div>
  );
};

/* ----------------------------------------------------------------- rail --- */

/**
 * The rail's featured listing.
 *
 * It used to be `listings[0]` — the row already sitting an inch to its left at
 * rank 1, which reads as a rendering fault rather than a recommendation. The
 * query picks the newest thing in the current result set instead, so the panel
 * says something the leaderboard does not.
 */
export const Spotlight: FC<{ listing: Listing }> = ({ listing }) => (
  <section class="rail-panel rail-spotlight">
    <SpotlightBeam />
    <p class="rail-title">Just added</p>

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
      {categories.slice(0, 6).map((category, index) => (
        <li>
          <a href={buildQuery(filters, { category: [category.value], page: 1 })}>
            <TopicIcon index={index} />
            <span class="topic-name">{category.value}</span>
            <span class="topic-count">
              {category.count} {category.count === 1 ? 'listing' : 'listings'}
            </span>
          </a>
        </li>
      ))}
    </ul>
  </section>
);

/**
 * The reference puts a newsletter box in this slot, inverted to newsprint so it
 * breaks the column of dark panels. There is no mailing list behind this site,
 * and a signup field that goes nowhere is a lie — so the panel keeps the
 * treatment and offers the feeds that do exist.
 */
export const FeedPanel: FC = () => (
  <section class="rail-panel rail-feed">
    <p class="rail-title">Stay in the loop</p>
    <p>New listings the moment they are published. No account, no mailing list.</p>
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

/**
 * A window of page numbers around the current one, always first and last, with
 * an ellipsis where the run breaks.
 *
 * Prev/next alone made the tail of a six-page list effectively unreachable —
 * five clicks to see the bottom of the directory, and no way to tell how far
 * away it was.
 */
export function pageWindow(page: number, pageCount: number): Array<number | 'gap'> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const pages = new Set([1, pageCount, page, page - 1, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((p) => pages.add(p));

  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);

  const out: Array<number | 'gap'> = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) out.push('gap');
    out.push(p);
    previous = p;
  }
  return out;
}

export const Pagination: FC<{ filters: Filters; page: number; pageCount: number }> = ({
  filters,
  page,
  pageCount,
}) => {
  if (pageCount <= 1) return null;

  return (
    <nav class="pagination" aria-label="Pagination">
      {page > 1 ? (
        <a class="page-step" href={buildQuery(filters, { page: page - 1 })} rel="prev">
          ← <span class="page-step-label">Previous</span>
        </a>
      ) : (
        <span class="page-step is-disabled">
          ← <span class="page-step-label">Previous</span>
        </span>
      )}

      <ol class="page-numbers">
        {pageWindow(page, pageCount).map((entry) =>
          entry === 'gap' ? (
            <li class="page-gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li>
              <a
                class={entry === page ? 'page-number is-current' : 'page-number'}
                href={buildQuery(filters, { page: entry })}
                aria-current={entry === page ? 'page' : undefined}
                aria-label={`Page ${entry}`}
              >
                {entry}
              </a>
            </li>
          ),
        )}
      </ol>

      {page < pageCount ? (
        <a class="page-step" href={buildQuery(filters, { page: page + 1 })} rel="next">
          <span class="page-step-label">Next</span> →
        </a>
      ) : (
        <span class="page-step is-disabled">
          <span class="page-step-label">Next</span> →
        </span>
      )}
    </nav>
  );
};
