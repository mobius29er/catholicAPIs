import type { FC } from 'hono/jsx';
import type { Filters, Track } from '../types';
import type { DirectoryResult, Stats } from '../db';
import {
  FilterPanel,
  ListingCard,
  Pagination,
  SortTabs,
  TrackTabs,
  buildQuery,
} from './components';

const COPY: Record<Track, { kicker: string; headline: string; sub: string; search: string }> = {
  product: {
    kicker: 'The Catholic software index',
    headline: 'What Catholics\nare actually\nbuilding.',
    sub: 'Prayer apps, breviaries, formation, parish tools, journalism, AI that cites its sources. Upvote what earned a place on your phone. Downvote what wasted your evening.',
    search: 'Search apps, services, media…',
  },
  api: {
    kicker: 'For developers',
    headline: 'Every Catholic API,\nranked by the people\nwho use them.',
    sub: 'Liturgical calendars, daily readings, scripture, the Catechism, canon law, prayers and saints — free and paid. Upvote what works, downvote what\'s abandoned, and add anything we\'re missing.',
    search: 'Search for readings, calendar, Vulgate, Catechism…',
  },
};

export const Home: FC<{
  result: DirectoryResult;
  filters: Filters;
  stats: Stats;
}> = ({ result, filters, stats }) => {
  const copy = COPY[filters.track];

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
          <div class="wrap hero-inner">
            <p class="kicker">{copy.kicker}</p>
            <h1>
              {copy.headline.split('\n').map((line, i) => (
                <>
                  {i > 0 && <br />}
                  {line}
                </>
              ))}
            </h1>
            <p class="hero-sub">{copy.sub}</p>

            <dl class="hero-stats">
              <div>
                <dt>Listings</dt>
                <dd>{stats.total}</dd>
              </div>
              <div>
                <dt>Free to start</dt>
                <dd>{stats.free}</dd>
              </div>
              <div>
                <dt>Votes cast</dt>
                <dd>{stats.votes}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      <div class="wrap directory">
        <TrackTabs active={filters.track} counts={{ apis: stats.apis, products: stats.products }} />

        <form class="searchbar" method="get" action={filters.track === 'product' ? '/' : '/apis'} role="search">
          <label class="visually-hidden" for="q">
            Search the directory
          </label>
          <input
            type="search"
            id="q"
            name="q"
            value={filters.q}
            placeholder={copy.search}
            autocomplete="off"
          />
          {filters.sort !== 'top' && <input type="hidden" name="sort" value={filters.sort} />}
          {filters.pricing.map((p) => (
            <input type="hidden" name="pricing" value={p} />
          ))}
          {filters.kind.map((k) => (
            <input type="hidden" name="kind" value={k} />
          ))}
          {filters.platforms.map((p) => (
            <input type="hidden" name="platform" value={p} />
          ))}
          {filters.categories.map((c) => (
            <input type="hidden" name="category" value={c} />
          ))}
          {filters.languages.map((l) => (
            <input type="hidden" name="lang" value={l} />
          ))}
          {filters.openSource && <input type="hidden" name="open_source" value="1" />}
          {filters.noAuth && <input type="hidden" name="no_auth" value="1" />}
          <button type="submit" class="btn btn-primary">
            Search
          </button>
        </form>

        <div class="directory-grid">
          <FilterPanel filters={filters} facets={result.facets} />

          <section class="results" aria-label="Results">
            <div class="results-head">
              <p class="results-count">
                <strong>{result.total}</strong> {result.total === 1 ? 'listing' : 'listings'}
                {filters.q && (
                  <>
                    {' for '}
                    <em>{filters.q}</em>
                  </>
                )}
              </p>
              <SortTabs filters={filters} />
            </div>

            {result.listings.length === 0 ? (
              <div class="empty">
                <p class="empty-title">Nothing matches.</p>
                <p>
                  If you know of something that belongs here,{' '}
                  <a href="/submit">add it to the directory</a> — that's how the list grows.
                </p>
                <a
                  class="btn btn-quiet"
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
              <ul class="cards">
                {result.listings.map((listing, index) => (
                  <ListingCard
                    listing={listing}
                    rank={
                      filters.sort === 'name'
                        ? undefined
                        : (result.page - 1) * result.listings.length + index + 1
                    }
                  />
                ))}
              </ul>
            )}

            <Pagination filters={filters} page={result.page} pageCount={result.pageCount} />
          </section>
        </div>

        {isLanding && (
          <aside class="crossover">
            {filters.track === 'product' ? (
              <>
                <h2>Building one of these?</h2>
                <p>
                  The other half of this directory is {stats.apis} APIs, datasets and libraries —
                  liturgical calendars, scripture, the Catechism — so you don't have to scrape a
                  diocesan website at 2am.
                </p>
                <a class="btn btn-primary" href="/apis">
                  Browse the APIs →
                </a>
              </>
            ) : (
              <>
                <h2>Shipped something with these?</h2>
                <p>
                  The product side of the directory lists {stats.products} Catholic apps and
                  services. Add yours, and let people vote on whether it earned a place on their
                  phone.
                </p>
                <a class="btn btn-primary" href="/submit?track=product">
                  Submit a product →
                </a>
              </>
            )}
          </aside>
        )}
      </div>
    </>
  );
};
