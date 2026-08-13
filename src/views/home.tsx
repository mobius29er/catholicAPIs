import type { FC } from 'hono/jsx';
import type { Filters } from '../types';
import type { DirectoryResult } from '../db';
import { ApiCard, Filters_, Pagination, SortTabs, buildQuery } from './components';

export const Home: FC<{
  result: DirectoryResult;
  filters: Filters;
  stats: { total: number; free: number; votes: number };
}> = ({ result, filters, stats }) => {
  const isLanding =
    !filters.q &&
    filters.page === 1 &&
    filters.pricing.length === 0 &&
    filters.kind.length === 0 &&
    filters.categories.length === 0 &&
    filters.languages.length === 0 &&
    !filters.openSource &&
    !filters.noAuth;

  return (
    <>
      {isLanding && (
        <section class="hero">
          <div class="wrap">
            <h1>
              Every Catholic API,
              <br />
              ranked by the people who use them.
            </h1>
            <p class="hero-sub">
              Liturgical calendars, daily readings, scripture, the Catechism, canon law, prayers
              and saints — free and paid. Upvote what works, downvote what's abandoned, and add
              anything we're missing.
            </p>

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
        <form class="searchbar" method="get" action="/" role="search">
          <label class="visually-hidden" for="q">
            Search Catholic APIs
          </label>
          <input
            type="search"
            id="q"
            name="q"
            value={filters.q}
            placeholder="Search for readings, calendar, Vulgate, Catechism…"
            autocomplete="off"
          />
          {filters.sort !== 'top' && <input type="hidden" name="sort" value={filters.sort} />}
          {filters.pricing.map((p) => (
            <input type="hidden" name="pricing" value={p} />
          ))}
          {filters.kind.map((k) => (
            <input type="hidden" name="kind" value={k} />
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
          <Filters_ filters={filters} facets={result.facets} />

          <section class="results" aria-label="Search results">
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
                <p>Nothing matches those filters yet.</p>
                <p class="muted">
                  If you know of an API that belongs here,{' '}
                  <a href="/submit">add it to the directory</a> — that's how the list grows.
                </p>
                <a class="btn btn-quiet" href={buildQuery({ ...filters } as Filters, {
                  pricing: [],
                  kind: [],
                  category: [],
                  lang: [],
                  open_source: false,
                  no_auth: false,
                  q: '',
                  page: 1,
                })}>
                  Clear filters
                </a>
              </div>
            ) : (
              <ul class="cards">
                {result.listings.map((listing) => (
                  <ApiCard listing={listing} />
                ))}
              </ul>
            )}

            <Pagination filters={filters} page={result.page} pageCount={result.pageCount} />
          </section>
        </div>
      </div>
    </>
  );
};
