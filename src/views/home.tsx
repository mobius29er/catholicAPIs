import type { FC } from 'hono/jsx';
import type { Filters, Track } from '../types';
import { PAGE_SIZE } from '../db';
import type { DirectoryResult, Stats } from '../db';
import {
  FeedPanel,
  FilterPanel,
  ListingRow,
  Pagination,
  SortTabs,
  Spotlight,
  TrackTabs,
  TrendingTopics,
  buildQuery,
} from './components';
import { NoirScene } from './art';

interface Copy {
  /** The yellow caption box above the headline. */
  caption: string;
  headline: string;
  sub: string;
  /** The angled stamp across the corner of the art. */
  stamp: string;
  listHeading: string;
  secondary: { href: string; label: string };
}

const COPY: Record<Track, Copy> = {
  product: {
    caption: 'New is worth finding.',
    headline: 'Discover the software\nCatholics actually use',
    sub: 'Catholic APIs is a directory of the apps, services and tools people pray, study and run parishes with — ranked by the people who use them.',
    stamp: 'Good work deserves users.',
    listHeading: 'Top products',
    secondary: { href: '/submit?track=product', label: 'Submit a product' },
  },
  api: {
    caption: 'Stop rebuilding the calendar.',
    headline: 'Every Catholic API\nin one place',
    sub: 'Liturgical calendars, daily readings, scripture, the Catechism, canon law, prayers and saints — free and paid, rated by the developers who ship on them.',
    stamp: 'Someone already solved this.',
    listHeading: 'Top APIs',
    secondary: { href: '/submit', label: 'Submit an API' },
  },
};

export const Home: FC<{
  result: DirectoryResult;
  filters: Filters;
  stats: Stats;
}> = ({ result, filters, stats }) => {
  const copy = COPY[filters.track];
  const root = filters.track === 'product' ? '/' : '/apis';

  const isLanding =
    !filters.q &&
    filters.page === 1 &&
    filters.pricing.length === 0 &&
    filters.kind.length === 0 &&
    filters.platforms.length === 0 &&
    filters.categories.length === 0 &&
    filters.languages.length === 0 &&
    !filters.openSource &&
    !filters.noAuth;

  return (
    <>
      {isLanding && (
        <section class="hero">
          <div class="hero-art" aria-hidden="true">
            <NoirScene />
          </div>

          <div class="hero-inner">
            <p class="caption-box">{copy.caption}</p>

            <h1>
              {copy.headline.split('\n').map((line, i) => (
                <>
                  {i > 0 && <br />}
                  {line}
                </>
              ))}
            </h1>

            <p class="hero-sub">{copy.sub}</p>

            <div class="hero-cta">
              <a class="btn btn-primary btn-lg" href="#listings">
                Explore top listings
              </a>
              <a class="btn btn-outline btn-lg" href={copy.secondary.href}>
                {copy.secondary.label}
              </a>
            </div>
          </div>

          <p class="stamp">{copy.stamp}</p>
        </section>
      )}

      <div class="shell" id="listings">
        <div class="columns">
          {/* ------------------------------------------------------ list --- */}
          <section class="feed" aria-label="Listings">
            <div class="feed-head">
              <h2 class="feed-title">
                {filters.q ? (
                  <>
                    Results for <em>{filters.q}</em>
                  </>
                ) : (
                  copy.listHeading
                )}
              </h2>
              <SortTabs filters={filters} />
            </div>

            <div class="feed-controls">
              <TrackTabs
                active={filters.track}
                counts={{ apis: stats.apis, products: stats.products }}
              />
              <FilterPanel filters={filters} facets={result.facets} />
              <p class="feed-count">
                {result.total} {result.total === 1 ? 'listing' : 'listings'}
              </p>
            </div>

            {result.listings.length === 0 ? (
              <div class="empty">
                <p class="empty-title">Nothing matches.</p>
                <p>
                  If you know of something that belongs here,{' '}
                  <a href="/submit">add it to the directory</a> — that's how the list grows.
                </p>
                <a
                  class="btn btn-outline"
                  href={buildQuery(filters, {
                    pricing: [],
                    kind: [],
                    platform: [],
                    category: [],
                    lang: [],
                    open_source: false,
                    no_auth: false,
                    q: '',
                    page: 1,
                  })}
                >
                  Clear filters
                </a>
              </div>
            ) : (
              <ol class="listings">
                {result.listings.map((listing, index) => (
                  <ListingRow
                    listing={listing}
                    rank={(result.page - 1) * PAGE_SIZE + index + 1}
                    rankNote={
                      filters.sort === 'top' && result.page === 1 && index === 0
                        ? '#1 most recommended'
                        : undefined
                    }
                  />
                ))}
              </ol>
            )}

            <Pagination filters={filters} page={result.page} pageCount={result.pageCount} />
          </section>

          {/* ------------------------------------------------------ rail --- */}
          <aside class="rail" aria-label="More from the directory">
            {result.listings.length > 0 && <Spotlight listing={result.listings[0]} />}
            <TrendingTopics filters={filters} categories={result.facets.categories} />
            <FeedPanel />

            <section class="rail-panel rail-cross">
              <p class="rail-title">
                {filters.track === 'product' ? 'For builders' : 'For everyone else'}
              </p>
              <p>
                {filters.track === 'product'
                  ? `The other half of this directory is ${stats.apis} APIs, datasets and libraries — so you don't have to scrape a diocesan website at 2am.`
                  : `The other half of this directory is ${stats.products} finished Catholic apps and services, ranked the same way.`}
              </p>
              <a class="rail-link" href={filters.track === 'product' ? '/apis' : '/'}>
                {filters.track === 'product' ? 'Browse the APIs →' : 'Browse the products →'}
              </a>
            </section>
          </aside>
        </div>

        <p class="shell-note muted small">
          Showing {result.total} of {stats.total} listings across both tracks.{' '}
          <a href={root}>Clear everything</a> · <a href="/about">How ranking works</a>
        </p>
      </div>
    </>
  );
};
