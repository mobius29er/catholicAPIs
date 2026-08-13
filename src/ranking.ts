import type { Listing, Sort } from './types';

/**
 * Lower bound of the Wilson score interval for a Bernoulli parameter.
 *
 * This is what "top" sorts by, rather than `upvotes - downvotes`. Raw net score
 * lets a listing with 400 up and 380 down outrank one with 40 up and 1 down,
 * which is backwards — the second is plainly the better API, we are just less
 * certain about it. Wilson asks "given this sample, what is the lowest plausible
 * approval rate?", so a small unanimous set ranks above a large contested one
 * while still rewarding volume as the interval tightens.
 *
 * z = 1.96 is the 95% confidence bound.
 */
export function wilsonLowerBound(up: number, down: number, z = 1.96): number {
  const n = up + down;
  if (n === 0) return 0;

  const p = up / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const centre = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);

  return (centre - margin) / denominator;
}

/**
 * Hacker News style decay, used to keep new arrivals visible.
 *
 * Gravity of 1.5 is gentler than HN's 1.8 because a directory turns over far
 * more slowly than a news feed: a good API stays good for years, so a listing
 * should not fall off the front page in an afternoon.
 */
export function gravityScore(score: number, ageHours: number, gravity = 1.5): number {
  return score / Math.pow(ageHours + 2, gravity);
}

export function hoursSince(iso: string, now: number = Date.now()): number {
  const then = Date.parse(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
  if (Number.isNaN(then)) return 0;
  return Math.max(0, (now - then) / 3_600_000);
}

/**
 * Orders listings for a given sort tab. Sorting happens here rather than in SQL
 * because Wilson needs a square root and the trending key mixes two columns; at
 * directory scale (hundreds of rows, not millions) the difference is noise, and
 * the ranking stays testable and easy to reason about.
 */
export function sortListings<T extends Listing>(listings: T[], sort: Sort, now = Date.now()): T[] {
  const sorted = [...listings];

  switch (sort) {
    case 'top':
      // Confidence first, then volume, so ties among unvoted listings are stable.
      sorted.sort(
        (a, b) =>
          b.confidence - a.confidence ||
          b.score - a.score ||
          a.name.localeCompare(b.name),
      );
      break;

    case 'trending': {
      // Recent votes decayed by listing age: something added last week with a
      // handful of votes should beat a five-year-old entry with the same handful.
      //
      // Confidence is a strict tiebreaker, never an addend. Blending the two
      // into one number lets a well-established listing with no recent activity
      // outrank a genuinely moving one, because decay shrinks the trending term
      // far below the all-time term — which is the opposite of trending.
      const keys = new Map(
        sorted.map((l) => [l, gravityScore(l.recent, hoursSince(l.created_at, now))]),
      );

      sorted.sort((a, b) => {
        const delta = keys.get(b)! - keys.get(a)!;
        if (Math.abs(delta) > 1e-12) return delta;
        return b.confidence - a.confidence || a.name.localeCompare(b.name);
      });
      break;
    }

    case 'new':
      sorted.sort(
        (a, b) => b.created_at.localeCompare(a.created_at) || a.name.localeCompare(b.name),
      );
      break;

    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  return sorted;
}
