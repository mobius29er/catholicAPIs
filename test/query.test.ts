import { describe, expect, it } from 'vitest';
import { buildQuery } from '../src/views/components';
import { slugify } from '../src/db';
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
