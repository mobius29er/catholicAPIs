import type { FC } from 'hono/jsx';
import type { Filters, Track } from '../types';
import { PAGE_SIZE } from '../db';
import type { DirectoryResult, Stats } from '../db';
import {
  AppliedFilters,
  CLEARED,
  FeedPanel,
  FilterBody,
  FilterPanel,
  ListingRow,
  Pagination,
  SortMenu,
  Spotlight,
  TrendingTopics,
  activeFilterCount,
  buildQuery,
  sortLabel,
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
    sub: 'FidesHunt is a directory of the apps, services and tools people pray, study and run parishes with — ranked by the people who use them.',
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

/**
 * The part of the page a filter change replaces.
 *
 * Rendered on its own for `?partial=1`, which is what app.js fetches so a
 * refinement swaps the list in place instead of reloading the document. The
 * ids and the wrapper have to match what the script looks for.
 */
export const Results: FC<{ result: DirectoryResult; filters: Filters }> = ({ result, filters }) => (
  <div id="results" data-results>
    <AppliedFilters filters={filters} total={result.total} />

    {result.listings.length === 0 ? (
      <div class="empty">
        <p class="empty-title">Nothing matches.</p>
        <p>
          If you know of something that belongs here, <a href="/submit">add it to the directory</a>{' '}
          — that's how the list grows.
        </p>
        <a class="btn btn-outline" href={buildQuery(filters, CLEARED)}>
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
  </div>
);

/**
 * What `?partial=1` returns: the results region, plus fresh copies of the bits
 * of the control row that live outside it.
 *
 * The facet counts, the checked states and the toggle links all change with
 * every refinement, but they sit inside a popover the reader may still have
 * open. Shipping them here lets app.js replace the popover's *contents*,
 * leaving the <details> — and the reader's place in it — alone.
 */
export const ResultsPartial: FC<{ result: DirectoryResult; filters: Filters }> = ({
  result,
  filters,
}) => {
  const count = activeFilterCount(filters);

  return (
    <>
      <Results result={result} filters={filters} />

      <div hidden data-fresh>
        <span data-fresh-sort>{sortLabel(filters.sort)}</span>
        <span data-fresh-count>{count}</span>
        <div data-fresh-facets>
          <FilterBody filters={filters} facets={result.facets} />
        </div>
      </div>
    </>
  );
};

export const Home: FC<{
  result: DirectoryResult;
  filters: Filters;
  stats: Stats;
}> = ({ result, filters, stats }) => {
  const copy = COPY[filters.track];

  return (
    <>
      {/*
        The hero stays put in every state.

        It used to be gated on "no filters set", so the first facet click
        deleted ~400px from above the list and the page the reader landed on
        was not the page they had clicked in. Filtering narrows the list; it is
        not a different destination.
      */}
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

      <div class="shell" id="listings">
        <div class="columns">
          {/* ------------------------------------------------------ list --- */}
          <section class="feed" aria-label="Listings">
            {/*
              The mockup's whole control row: the heading, and two menus that
              open over the page. Nothing here changes height, so nothing below
              it moves.
            */}
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

              <div class="feed-controls">
                <SortMenu filters={filters} />
                <FilterPanel filters={filters} facets={result.facets} />
              </div>
            </div>

            <Results result={result} filters={filters} />
          </section>

          {/* ------------------------------------------------------ rail --- */}
          <aside class="rail" aria-label="More from the directory">
            {result.spotlight && <Spotlight listing={result.spotlight} />}
            <TrendingTopics filters={filters} categories={result.facets.categories} />
            <FeedPanel />
          </aside>
        </div>

        <p class="shell-note muted small">
          {stats.total} listings across both tracks — {stats.products} products and {stats.apis}{' '}
          APIs. <a href="/about">How ranking works</a>
        </p>
      </div>
    </>
  );
};
