import type { Env } from './types';

/**
 * Uptime checking.
 *
 * A directory's worst failure is confidently pointing at something that no
 * longer exists, so a scheduled job walks the listings least-recently-checked
 * first and probes each homepage.
 *
 * Two judgement calls are baked in:
 *
 *   One failure is not "down". Sites time out, WAFs get twitchy, edge locations
 *   have bad minutes. The state only flips after FAIL_THRESHOLD consecutive
 *   failures, so a transient blip never shows a red dot to readers.
 *
 *   A 403 or 405 is not "down" either. Plenty of hosts reject HEAD, block
 *   unfamiliar user agents, or sit behind Cloudflare's own bot protection. The
 *   site is up; it just won't talk to us. Treating that as an outage would
 *   litter the directory with false alarms.
 */

/** Probes per scheduled run. Keeps a run well inside the Worker CPU budget. */
const BATCH_SIZE = 25;

/** Consecutive failures before a listing is shown as down. */
const FAIL_THRESHOLD = 3;

const TIMEOUT_MS = 10_000;

/**
 * Statuses that mean "the server answered, it just declined us". Bot
 * protection and HEAD-hostile hosts return these constantly.
 */
const NOT_AN_OUTAGE = new Set([401, 403, 405, 406, 429]);

export interface ProbeResult {
  ok: boolean;
  code: number | null;
}

export async function probe(url: string): Promise<ProbeResult> {
  const attempt = async (method: 'HEAD' | 'GET'): Promise<number | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent': 'fideshunt-healthcheck/1.0 (+https://fideshunt.com)',
          accept: '*/*',
        },
      });
      return response.status;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  let code = await attempt('HEAD');
  // Many hosts reject HEAD outright; never trust it as the only evidence.
  if (code === null || code >= 400) {
    const viaGet = await attempt('GET');
    if (viaGet !== null) code = viaGet;
  }

  if (code === null) return { ok: false, code: null };
  return { ok: code < 400 || NOT_AN_OUTAGE.has(code), code };
}

/**
 * Given the previous failure count and a fresh probe, work out what to store.
 * Pure, so the escalation rule is testable without a network or a database.
 */
export function nextHealth(
  previousFails: number,
  result: ProbeResult,
): { state: 'up' | 'down' | 'unknown'; fails: number } {
  if (result.ok) return { state: 'up', fails: 0 };

  const fails = previousFails + 1;
  // Below the threshold we say "unknown" rather than "up": we genuinely do not
  // know, and claiming it is fine would be the same overconfidence we are
  // trying to avoid.
  return { state: fails >= FAIL_THRESHOLD ? 'down' : 'unknown', fails };
}

export interface HealthRunResult {
  checked: number;
  up: number;
  down: number;
  unknown: number;
}

/**
 * Probes one batch, oldest check first. Runs from the cron trigger and from
 * the admin screen.
 */
export async function runHealthCheck(env: Env, limit = BATCH_SIZE): Promise<HealthRunResult> {
  const { results } = await env.DB.prepare(
    `SELECT id, homepage_url, health_fails
       FROM apis
      WHERE status = 'published'
      ORDER BY health_checked_at IS NOT NULL, health_checked_at ASC
      LIMIT ?1`,
  )
    .bind(limit)
    .all<{ id: number; homepage_url: string; health_fails: number }>();

  const outcome: HealthRunResult = { checked: 0, up: 0, down: 0, unknown: 0 };
  if (results.length === 0) return outcome;

  const probes = await Promise.all(
    results.map(async (row) => ({ row, result: await probe(row.homepage_url) })),
  );

  const statements = probes.map(({ row, result }) => {
    const next = nextHealth(row.health_fails, result);
    outcome.checked += 1;
    outcome[next.state] += 1;

    return env.DB.prepare(
      `UPDATE apis
          SET health_state      = ?2,
              health_code       = ?3,
              health_fails      = ?4,
              health_checked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?1`,
    ).bind(row.id, next.state, result.code, next.fails);
  });

  await env.DB.batch(statements);
  return outcome;
}
