import type { FC } from 'hono/jsx';
import type { Filters } from '../types';
import type { AdRequest } from '../maker-db';
import { PAGE_SIZE } from '../db';
import type { DirectoryResult, Stats } from '../db';
import {
  AppliedFilters,
  CLEARED,
  FilterBody,
  FilterPanel,
  ListingRow,
  Pagination,
  SortMenu,
  activeFilterCount,
  buildQuery,
  sortLabel,
} from './components';
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
        <span data-fresh-heading>{filters.q ? `Results for “${filters.q}”` : filters.categories.length ? filters.categories.join(', ') : filters.track === 'product' ? 'Explore products' : 'Explore APIs'}</span>
        <span data-fresh-count>{count}</span>
        <div data-fresh-facets>
          <FilterBody filters={filters} facets={result.facets} />
        </div>
      </div>
    </>
  );
};

export const Home: FC<{ result: DirectoryResult; filters: Filters; stats: Stats; sponsors?: AdRequest[]; sponsorCsrf?: string }> = ({ result, filters, stats, sponsors = [], sponsorCsrf = '' }) => {
  const isProduct = filters.track === 'product';
  const root = isProduct ? '/' : '/apis';
  const topics = isProduct ? ['Prayer', 'Bible & Study', 'Formation', 'Parish Tools', 'Media', 'Community', 'AI & Search'] : ['Liturgical Calendar', 'Bible', 'Daily Readings', 'Prayers', 'Saints', 'Developer Tools'];
  return (
    <div class="discovery-shell">
      <aside class="category-rail" aria-label="Browse categories">
        <p class="rail-label">EXPLORE</p>
        <a class={`category-link ${!filters.categories.length ? 'selected' : ''}`} href={root}><span aria-hidden="true">◈</span> All {isProduct ? 'products' : 'APIs'}</a>
        <a class="category-link" href={`${root}?sort=new`}><span aria-hidden="true">✧</span> Recently added</a>
        <p class="rail-label categories-label">CATEGORIES</p>
        {topics.map((topic, i) => <a class={`category-link ${filters.categories.includes(topic) ? 'selected' : ''}`} href={`${root}?category=${encodeURIComponent(topic)}`}><span class="category-symbol" aria-hidden="true">{['♡', '▤', '◎', '⌂', '▷', '◉', '✳'][i]}</span>{topic}</a>)}
        <div class="rail-bottom"><span class="small muted">Made something good?</span><a href="/launch">Share it with Catholics →</a></div>
      </aside>
      <div class="discover-content">
        <header class="discover-intro"><p class="eyebrow">THE CATHOLIC PRODUCT COMMUNITY</p><h1>{isProduct ? 'Discover products for Catholic life.' : 'Build something that matters.'}</h1><p>{isProduct ? 'Apps, tools, and resources to help you pray, learn, and build.' : 'Catholic APIs, datasets, and libraries, recommended by the developers who use them.'}</p></header>
        <div class="discovery-columns">
          <section class="feed" aria-label="Listings" id="listings">
            <div class="feed-head"><h2 class="feed-title" data-feed-heading>{filters.q ? `Results for “${filters.q}”` : filters.categories.length ? filters.categories.join(', ') : isProduct ? 'Explore products' : 'Explore APIs'}</h2><div class="feed-controls"><SortMenu filters={filters} /><FilterPanel filters={filters} facets={result.facets} /></div></div>
            <Results result={result} filters={filters} />
            <p class="feed-footnote">Community votes shape the rankings. <a href="/about">How it works</a></p>
          </section>
          <aside class="discovery-aside" aria-label="From FidesHunt">
            {sponsors.map(ad => <section class="sponsor-card"><span class="sponsor-label">Sponsored</span><h2>{ad.name}</h2><p>{ad.tagline}</p><form method="post" action={`/maker/ad-click/${ad.id}`}><input type="hidden" name="csrf" value={sponsorCsrf} /><input type="hidden" name="action_key" value={crypto.randomUUID()} /><button type="submit">Discover product →</button></form></section>)}
            <section class="newsletter-card"><span class="newsletter-icon" aria-hidden="true">✉</span><h2>A little discovery.<br />A lot of purpose.</h2><p>New Catholic products and useful finds, in your inbox.</p><form action="/maker/newsletter" method="get"><label for="newsletter-email" class="visually-hidden">Email address</label><input type="email" id="newsletter-email" name="email" placeholder="Your email address" required /><button class="btn btn-primary" type="submit">Join the newsletter</button></form><small>Choose your email preferences next.</small></section>
            <section class="maker-note"><span class="eyebrow">FOR THE BUILDERS</span><h2>Your work belongs here.</h2><p>Introduce your product to people who care about what you’re building.</p><a href="/launch">Plan your launch <span aria-hidden="true">→</span></a><span class="small muted">$29 launch · preview checkout</span></section>
            <p class="aside-meta">{stats.products} products · {stats.apis} developer tools<br /><a href="/about">A community built around faith.</a></p>
          </aside>
        </div>
      </div>
    </div>
  );
};
