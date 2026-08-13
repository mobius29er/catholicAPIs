import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextHealth, probe } from '../src/health';
import { timeAgo } from '../src/views/components';

/**
 * The escalation rule is the whole point of this module: it decides when the
 * directory is willing to tell a reader "this is down". Getting it wrong in
 * either direction is expensive — too eager and every transient blip paints a
 * healthy project red, too shy and dead links sit there looking fine — so it
 * is pure and tested on its own.
 */
describe('nextHealth', () => {
  it('goes straight to up on a good probe', () => {
    expect(nextHealth(0, { ok: true, code: 200 })).toEqual({ state: 'up', fails: 0 });
  });

  it('clears the failure count when a site comes back', () => {
    expect(nextHealth(2, { ok: true, code: 200 })).toEqual({ state: 'up', fails: 0 });
  });

  it('does not call one failure an outage', () => {
    expect(nextHealth(0, { ok: false, code: 500 })).toEqual({ state: 'unknown', fails: 1 });
  });

  it('still withholds judgement on the second failure', () => {
    expect(nextHealth(1, { ok: false, code: null })).toEqual({ state: 'unknown', fails: 2 });
  });

  it('reports down on the third consecutive failure', () => {
    expect(nextHealth(2, { ok: false, code: 502 })).toEqual({ state: 'down', fails: 3 });
  });

  it('stays down and keeps counting', () => {
    expect(nextHealth(9, { ok: false, code: null })).toEqual({ state: 'down', fails: 10 });
  });

  /*
    'unknown' rather than 'up' below the threshold is deliberate. We genuinely
    do not know, and claiming the site is fine would be the same overconfidence
    the threshold exists to avoid.
  */
  it('never claims up while failures are accumulating', () => {
    for (let fails = 0; fails < 3; fails++) {
      expect(nextHealth(fails, { ok: false, code: 500 }).state).not.toBe('up');
    }
  });
});

describe('probe', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubFetch = (byMethod: Record<string, number | Error>) => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: { method: string }) => {
      calls.push(init.method);
      const outcome = byMethod[init.method];
      if (outcome instanceof Error) throw outcome;
      return { status: outcome } as Response;
    });
    return calls;
  };

  it('accepts a plain 200 from HEAD without falling back', async () => {
    const calls = stubFetch({ HEAD: 200 });
    expect(await probe('https://example.org')).toEqual({ ok: true, code: 200 });
    expect(calls).toEqual(['HEAD']);
  });

  // Plenty of hosts reject HEAD outright, so it is never the only evidence.
  it('retries with GET when HEAD is refused, and believes the GET', async () => {
    const calls = stubFetch({ HEAD: 405, GET: 200 });
    expect(await probe('https://example.org')).toEqual({ ok: true, code: 200 });
    expect(calls).toEqual(['HEAD', 'GET']);
  });

  it('retries with GET when HEAD throws', async () => {
    const calls = stubFetch({ HEAD: new Error('connection reset'), GET: 200 });
    expect(await probe('https://example.org')).toEqual({ ok: true, code: 200 });
    expect(calls).toEqual(['HEAD', 'GET']);
  });

  /*
    Bot protection is not an outage. A server that answers 403 is plainly
    running; it just will not talk to us. Counting these would fill the
    directory with false alarms against perfectly healthy sites.
  */
  it.each([401, 403, 405, 406, 429])('treats %i as reachable, not down', async (status) => {
    stubFetch({ HEAD: status, GET: status });
    expect(await probe('https://example.org')).toEqual({ ok: true, code: status });
  });

  it('fails on a genuine server error', async () => {
    stubFetch({ HEAD: 500, GET: 500 });
    expect(await probe('https://example.org')).toEqual({ ok: false, code: 500 });
  });

  it('fails on 404', async () => {
    stubFetch({ HEAD: 404, GET: 404 });
    expect(await probe('https://example.org')).toEqual({ ok: false, code: 404 });
  });

  it('reports no code at all when neither method connects', async () => {
    stubFetch({ HEAD: new Error('dns'), GET: new Error('dns') });
    expect(await probe('https://example.org')).toEqual({ ok: false, code: null });
  });
});

/** How the check time is rendered next to the dot. */
describe('timeAgo', () => {
  const NOW = Date.parse('2026-08-13T12:00:00Z');
  const ago = (iso: string) => timeAgo(iso, NOW);

  it('has nothing to say about a listing never checked', () => {
    expect(timeAgo(null, NOW)).toBeNull();
  });

  it('refuses to guess from an unparseable timestamp', () => {
    expect(timeAgo('not a date', NOW)).toBeNull();
  });

  it('rounds sub-minute gaps down to "just now"', () => {
    expect(ago('2026-08-13T11:59:31Z')).toBe('just now');
  });

  it.each([
    ['2026-08-13T11:59:00Z', '1 minute ago'],
    ['2026-08-13T11:20:00Z', '40 minutes ago'],
    ['2026-08-13T11:00:00Z', '1 hour ago'],
    ['2026-08-13T04:00:00Z', '8 hours ago'],
    ['2026-08-12T12:00:00Z', '1 day ago'],
    ['2026-08-08T12:00:00Z', '5 days ago'],
    ['2026-08-06T12:00:00Z', '1 week ago'],
    ['2026-07-01T12:00:00Z', '1 month ago'],
  ])('renders %s as %s', (iso, expected) => {
    expect(ago(iso)).toBe(expected);
  });

  // D1 hands back timestamps without a zone; reading them as local time would
  // shift every "checked N ago" by the server's offset.
  it('reads a zone-less timestamp as UTC', () => {
    expect(ago('2026-08-13T11:00:00')).toBe('1 hour ago');
  });

  // Clock skew between the probe and the render must not produce "in 3 hours".
  it('clamps a future timestamp rather than counting backwards', () => {
    expect(ago('2026-08-13T15:00:00Z')).toBe('just now');
  });
});
