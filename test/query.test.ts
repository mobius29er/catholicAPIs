import { describe, expect, it } from 'vitest';
import { CLEARED, appliedFilters, buildQuery, pageWindow } from '../src/views/components';
import { searchTerms, slugify } from '../src/db';
import type { Filters } from '../src/types';

const base: Filters = {
  q: '',
  track: 'api',
  pricing: [],
  platforms: [],
  kind: [],
  categories: [],
  languages: [],
  auth: [],
  openSource: false,
  noAuth: false,
  sort: 'top',
  page: 1,
};

describe('buildQuery', () => {
  it('returns the track root when nothing is selected', () => {
    expect(buildQuery(base)).toBe('/apis');
    expect(buildQuery({ ...base, track: 'product' })).toBe('/');
  });

  it('omits defaults so canonical URLs stay clean', () => {
    // sort=top and page=1 are the defaults; emitting them would create a
    // second URL for the same page and split its search ranking.
    expect(buildQuery({ ...base, sort: 'top', page: 1 })).toBe('/apis');
  });

  it('keeps non-default sort and page', () => {
    expect(buildQuery({ ...base, sort: 'new' })).toBe('/apis?sort=new');
    expect(buildQuery({ ...base, page: 3 })).toBe('/apis?page=3');
  });

  it('keeps a filter link inside its own track', () => {
    // A product filter must never navigate the reader into the API index.
    expect(buildQuery({ ...base, track: 'product', pricing: ['free'] })).toBe('/?pricing=free');
    expect(buildQuery({ ...base, track: 'api', pricing: ['free'] })).toBe('/apis?pricing=free');
  });

  it('repeats a key for multi-select facets', () => {
    const qs = buildQuery({ ...base, pricing: ['free', 'freemium'] });
    expect(qs).toBe('/apis?pricing=free&pricing=freemium');
  });

  it('carries the search term alongside filters', () => {
    const qs = buildQuery({ ...base, q: 'vulgate', pricing: ['free'] });
    expect(qs).toContain('q=vulgate');
    expect(qs).toContain('pricing=free');
  });

  it('applies overrides over the current filters', () => {
    const qs = buildQuery({ ...base, sort: 'new', page: 4 }, { page: 1 });
    expect(qs).toBe('/apis?sort=new');
  });

  it('drops a facet when overridden with an empty list', () => {
    const qs = buildQuery({ ...base, pricing: ['paid'] }, { pricing: [] });
    expect(qs).toBe('/apis');
  });

  it('encodes categories containing spaces and ampersands', () => {
    const qs = buildQuery({ ...base, categories: ['Catechism & Doctrine'] });
    expect(qs).toBe('/apis?category=Catechism+%26+Doctrine');
    expect(new URL(qs, 'https://x').searchParams.get('category')).toBe('Catechism & Doctrine');
  });

  it('renders booleans as 1 and omits them when false', () => {
    expect(buildQuery({ ...base, openSource: true })).toBe('/apis?open_source=1');
    expect(buildQuery({ ...base, openSource: false })).toBe('/apis');
  });

  it('round-trips through URLSearchParams', () => {
    const filters: Filters = {
      ...base,
      q: 'daily readings',
      pricing: ['free'],
      kind: ['api', 'dataset'],
      categories: ['Bible'],
      languages: ['la'],
      sort: 'trending',
      page: 2,
    };
    const params = new URL(buildQuery(filters), 'https://x').searchParams;
    expect(params.get('q')).toBe('daily readings');
    expect(params.getAll('kind')).toEqual(['api', 'dataset']);
    expect(params.get('sort')).toBe('trending');
    expect(params.get('page')).toBe('2');
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Church Calendar API')).toBe('church-calendar-api');
  });

  it('strips accents rather than dropping the letters', () => {
    expect(slugify('Liturgia Diária')).toBe('liturgia-diaria');
  });

  it('collapses punctuation and trims stray hyphens', () => {
    expect(slugify('  The Way — St. Josemaría!  ')).toBe('the-way-st-josemaria');
  });

  it('never returns an empty slug', () => {
    expect(slugify('!!!')).toBe('api');
    expect(slugify('')).toBe('api');
  });

  it('caps length so a pathological name cannot blow up the URL', () => {
    expect(slugify('a'.repeat(500)).length).toBeLessThanOrEqual(60);
  });
});

describe('searchTerms', () => {
  /*
    Every term has to match, in any order. The literal-phrase behaviour this
    replaced meant "canonical identifiers" found one listing while "canonical"
    found fifteen — the registries say "canonical IDs" in the tagline and
    "identifiers" in the description, and no one field held the phrase.
  */
  it('splits a query into terms', () => {
    expect(searchTerms('canonical identifiers')).toEqual(['canonical', 'identifiers']);
  });

  it('collapses whitespace of every kind', () => {
    expect(searchTerms('  daily \t readings\n')).toEqual(['daily', 'readings']);
  });

  it('lowercases, since the haystack is lowercased too', () => {
    expect(searchTerms('Liturgy CECDR')).toEqual(['liturgy', 'cecdr']);
  });

  it('has nothing to do with an empty or blank query', () => {
    expect(searchTerms('')).toEqual([]);
    expect(searchTerms('   ')).toEqual([]);
  });

  // The escape hatch for the exact-phrase search the AND change removes.
  it('keeps a quoted run together as one term', () => {
    expect(searchTerms('"liturgy of the hours"')).toEqual(['liturgy of the hours']);
  });

  it('mixes quoted phrases with bare terms', () => {
    expect(searchTerms('free "no key" api')).toEqual(['free', 'no key', 'api']);
  });

  it('ignores an empty pair of quotes', () => {
    expect(searchTerms('bible ""')).toEqual(['bible']);
  });

  // A pasted paragraph must not build a query with hundreds of LIKE clauses.
  it('caps the number of terms', () => {
    const many = Array.from({ length: 40 }, (_, i) => `term${i}`).join(' ');
    expect(searchTerms(many)).toHaveLength(8);
    expect(searchTerms(many)[0]).toBe('term0');
  });
});

describe('appliedFilters', () => {
  it('is empty when nothing narrows the list', () => {
    expect(appliedFilters(base)).toEqual([]);
  });

  it('offers one chip per selected value, each removing only itself', () => {
    const chips = appliedFilters({ ...base, pricing: ['free', 'paid'] });
    expect(chips.map((c) => c.label)).toEqual(['Free', 'Paid']);
    // Removing "Free" must leave "Paid" standing.
    expect(chips[0].href).toBe('/apis?pricing=paid');
    expect(chips[1].href).toBe('/apis?pricing=free');
  });

  it('covers the boolean quick filters and the search term', () => {
    const chips = appliedFilters({ ...base, q: 'psalms', openSource: true, noAuth: true });
    expect(chips.map((c) => c.paramKey)).toEqual(['q', 'open_source', 'no_auth']);
    expect(chips[0].href).toBe('/apis?open_source=1&no_auth=1');
  });
});

describe('CLEARED', () => {
  // Two different affordances clear filters; they had drifted apart, and the
  // one that forgot `auth` could leave the reader still looking at nothing.
  it('drops every narrowing parameter at once', () => {
    const busy: Filters = {
      ...base,
      q: 'psalms',
      pricing: ['free'],
      kind: ['dataset'],
      platforms: ['ios'],
      categories: ['Prayer'],
      languages: ['la'],
      auth: ['oauth'],
      openSource: true,
      noAuth: true,
      page: 4,
    };
    expect(buildQuery(busy, CLEARED)).toBe('/apis');
  });

  it('leaves the sort alone, which is not a filter', () => {
    expect(buildQuery({ ...base, sort: 'new', pricing: ['free'] }, CLEARED)).toBe('/apis?sort=new');
  });
});

describe('pageWindow', () => {
  it('lists every page when they all fit', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('always offers the first and last page', () => {
    const window = pageWindow(10, 20);
    expect(window[0]).toBe(1);
    expect(window[window.length - 1]).toBe(20);
  });

  it('keeps a run around the current page, with gaps marked', () => {
    expect(pageWindow(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20]);
  });

  it('does not open a gap for a single skipped page', () => {
    // 1 … 3 would hide exactly one page behind an ellipsis, which is worse
    // than just showing it.
    expect(pageWindow(3, 12)).toEqual([1, 2, 3, 4, 'gap', 12]);
  });

  it('runs the window against the near edges', () => {
    expect(pageWindow(1, 12)).toEqual([1, 2, 3, 4, 'gap', 12]);
    expect(pageWindow(12, 12)).toEqual([1, 'gap', 9, 10, 11, 12]);
  });

  it('never emits a page outside the range', () => {
    for (let count = 1; count <= 30; count++) {
      for (let page = 1; page <= count; page++) {
        const numbers = pageWindow(page, count).filter((p): p is number => p !== 'gap');
        expect(Math.min(...numbers)).toBeGreaterThanOrEqual(1);
        expect(Math.max(...numbers)).toBeLessThanOrEqual(count);
        expect(numbers).toContain(page);
        // Sorted, and never repeated.
        expect(numbers).toEqual([...new Set(numbers)].sort((a, b) => a - b));
      }
    }
  });
});
