import { describe, expect, it } from 'vitest';
import { gravityScore, hoursSince, sortListings, wilsonLowerBound } from '../src/ranking';
import type { Listing } from '../src/types';

const listing = (overrides: Partial<Listing>): Listing =>
  ({
    id: 1,
    slug: 'x',
    name: 'X',
    tagline: '',
    description: '',
    homepage_url: 'https://example.org',
    docs_url: null,
    repo_url: null,
    kind: 'api',
    track: 'api',
    launched_at: null,
    platforms: [],
    pricing: 'free',
    pricing_note: null,
    open_source: false,
    license: null,
    auth: 'none',
    cors: 'unknown',
    official: false,
    categories: [],
    languages: [],
    status: 'published',
    submitter: null,
    submitter_note: null,
    moderator_note: null,
    upvotes: 0,
    downvotes: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    verified_at: null,
    score: 0,
    confidence: 0,
    recent: 0,
    myVote: 0,
    isNew: false,
    ...overrides,
  }) as Listing;

/** Convenience: build a listing whose derived fields agree with its tallies. */
const voted = (name: string, up: number, down: number, extra: Partial<Listing> = {}): Listing =>
  listing({
    name,
    slug: name.toLowerCase(),
    upvotes: up,
    downvotes: down,
    score: up - down,
    confidence: wilsonLowerBound(up, down),
    ...extra,
  });

describe('wilsonLowerBound', () => {
  it('is zero with no votes', () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it('never exceeds the observed rate', () => {
    // The lower bound is always a pessimistic estimate of the true rate.
    expect(wilsonLowerBound(10, 0)).toBeLessThan(1);
    expect(wilsonLowerBound(5, 5)).toBeLessThan(0.5);
  });

  it('tightens toward the observed rate as votes accumulate', () => {
    const few = wilsonLowerBound(3, 0);
    const many = wilsonLowerBound(300, 0);
    expect(many).toBeGreaterThan(few);
    expect(many).toBeLessThan(1);
  });

  it('ranks a small unanimous listing above a large contested one', () => {
    // The whole reason we do not sort by upvotes - downvotes: raw net score
    // would put 400/380 (net +20) above 40/1 (net +39)... and even where net
    // agrees, it does so for the wrong reason.
    const contested = wilsonLowerBound(400, 380);
    const clean = wilsonLowerBound(40, 1);
    expect(clean).toBeGreaterThan(contested);
  });

  it('treats a downvoted listing worse than an unvoted one', () => {
    expect(wilsonLowerBound(0, 5)).toBeLessThanOrEqual(wilsonLowerBound(0, 0));
  });

  it('is monotonic in upvotes and in downvotes', () => {
    expect(wilsonLowerBound(11, 2)).toBeGreaterThan(wilsonLowerBound(10, 2));
    expect(wilsonLowerBound(10, 3)).toBeLessThan(wilsonLowerBound(10, 2));
  });
});

describe('gravityScore', () => {
  it('decays with age', () => {
    expect(gravityScore(10, 0)).toBeGreaterThan(gravityScore(10, 100));
  });

  it('lets a fresh modest score beat a stale large one', () => {
    expect(gravityScore(5, 1)).toBeGreaterThan(gravityScore(40, 24 * 30));
  });

  it('keeps zero at zero regardless of age', () => {
    expect(gravityScore(0, 5)).toBe(0);
  });
});

describe('hoursSince', () => {
  const now = Date.parse('2025-06-01T12:00:00Z');

  it('reads the SQLite timestamp format', () => {
    expect(hoursSince('2025-06-01T10:00:00Z', now)).toBe(2);
  });

  it('assumes UTC when the trailing Z is missing', () => {
    expect(hoursSince('2025-06-01T10:00:00', now)).toBe(2);
  });

  it('never goes negative for a future timestamp', () => {
    expect(hoursSince('2026-01-01T00:00:00Z', now)).toBe(0);
  });

  it('returns 0 rather than NaN for junk', () => {
    expect(hoursSince('not a date', now)).toBe(0);
  });
});

describe('sortListings', () => {
  it('sorts "top" by confidence, not by net score', () => {
    const contested = voted('Contested', 400, 380); // net +20
    const clean = voted('Clean', 40, 1); // net +39
    const [first] = sortListings([contested, clean], 'top');
    expect(first.name).toBe('Clean');
  });

  it('breaks confidence ties by volume, then alphabetically', () => {
    const a = voted('Zeta', 0, 0);
    const b = voted('Alpha', 0, 0);
    expect(sortListings([a, b], 'top').map((l) => l.name)).toEqual(['Alpha', 'Zeta']);
  });

  it('sorts "trending" by recent votes with an age discount', () => {
    const now = Date.parse('2025-06-01T00:00:00Z');
    const old = voted('Established', 100, 0, {
      recent: 3,
      created_at: '2023-01-01T00:00:00Z',
    });
    const fresh = voted('Newcomer', 3, 0, { recent: 3, created_at: '2025-05-30T00:00:00Z' });

    // Same recent votes, so the younger listing should surface first.
    expect(sortListings([old, fresh], 'trending', now)[0].name).toBe('Newcomer');
  });

  it('does not let trending resurrect a listing with no recent votes', () => {
    const now = Date.parse('2025-06-01T00:00:00Z');
    const quiet = voted('Quiet', 500, 0, { recent: 0, created_at: '2025-05-31T00:00:00Z' });
    const busy = voted('Busy', 4, 0, { recent: 4, created_at: '2024-01-01T00:00:00Z' });

    expect(sortListings([quiet, busy], 'trending', now)[0].name).toBe('Busy');
  });

  it('sorts "new" by descending creation date', () => {
    const older = voted('Older', 0, 0, { created_at: '2024-01-01T00:00:00Z' });
    const newer = voted('Newer', 0, 0, { created_at: '2025-01-01T00:00:00Z' });
    expect(sortListings([older, newer], 'new').map((l) => l.name)).toEqual(['Newer', 'Older']);
  });

  it('sorts "name" alphabetically', () => {
    const items = [voted('Zeta', 9, 0), voted('Alpha', 0, 9), voted('Mu', 3, 3)];
    expect(sortListings(items, 'name').map((l) => l.name)).toEqual(['Alpha', 'Mu', 'Zeta']);
  });

  it('does not mutate the input array', () => {
    const items = [voted('Zeta', 0, 0), voted('Alpha', 0, 0)];
    const before = items.map((l) => l.name);
    sortListings(items, 'name');
    expect(items.map((l) => l.name)).toEqual(before);
  });
});
