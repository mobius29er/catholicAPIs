import { describe, expect, it } from 'vitest';
import { buildQuery } from '../src/views/components';
import { slugify } from '../src/db';
import type { Filters } from '../src/types';

const base: Filters = {
  q: '',
  pricing: [],
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
  it('returns a bare / when nothing is selected', () => {
    expect(buildQuery(base)).toBe('/');
  });

  it('omits defaults so canonical URLs stay clean', () => {
    // sort=top and page=1 are the defaults; emitting them would create a
    // second URL for the same page and split its search ranking.
    expect(buildQuery({ ...base, sort: 'top', page: 1 })).toBe('/');
  });

  it('keeps non-default sort and page', () => {
    expect(buildQuery({ ...base, sort: 'new' })).toBe('?sort=new');
    expect(buildQuery({ ...base, page: 3 })).toBe('?page=3');
  });

  it('repeats a key for multi-select facets', () => {
    const qs = buildQuery({ ...base, pricing: ['free', 'freemium'] });
    expect(qs).toBe('?pricing=free&pricing=freemium');
  });

  it('carries the search term alongside filters', () => {
    const qs = buildQuery({ ...base, q: 'vulgate', pricing: ['free'] });
    expect(qs).toContain('q=vulgate');
    expect(qs).toContain('pricing=free');
  });

  it('applies overrides over the current filters', () => {
    const qs = buildQuery({ ...base, sort: 'new', page: 4 }, { page: 1 });
    expect(qs).toBe('?sort=new');
  });

  it('drops a facet when overridden with an empty list', () => {
    const qs = buildQuery({ ...base, pricing: ['paid'] }, { pricing: [] });
    expect(qs).toBe('/');
  });

  it('encodes categories containing spaces and ampersands', () => {
    const qs = buildQuery({ ...base, categories: ['Catechism & Doctrine'] });
    expect(qs).toBe('?category=Catechism+%26+Doctrine');
    expect(new URLSearchParams(qs.slice(1)).get('category')).toBe('Catechism & Doctrine');
  });

  it('renders booleans as 1 and omits them when false', () => {
    expect(buildQuery({ ...base, openSource: true })).toBe('?open_source=1');
    expect(buildQuery({ ...base, openSource: false })).toBe('/');
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
    const params = new URLSearchParams(buildQuery(filters).slice(1));
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
