import type { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { Env } from './types';

const COOKIE_NAME = 'cav';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // ~13 months, the Chrome cap.

/**
 * Voting is anonymous — requiring a login to say "this API is good" would kill
 * participation on a directory this small. So identity is a random ID in an
 * HMAC-signed cookie, which stops anyone from hand-crafting other people's IDs
 * but obviously cannot stop someone clearing cookies. A per-IP throttle
 * (`checkRateLimit`) covers the rest: enough friction that ballot-stuffing is
 * tedious, not so much that a parish office behind one NAT can't vote.
 */

const encoder = new TextEncoder();
const keyCache = new Map<string, Promise<CryptoKey>>();

function importKey(secret: string): Promise<CryptoKey> {
  let key = keyCache.get(secret);
  if (!key) {
    key = crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    keyCache.set(secret, key);
  }
  return key;
}

function toBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hmac(secret: string, message: string): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', await importKey(secret), encoder.encode(message));
  return toBase64Url(signature);
}

/** Constant-time string compare, so signature checks don't leak by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function secretOf(env: Env): string {
  // A missing secret must not take the site down, but it must be loud in logs:
  // cookies signed with the fallback are forgeable.
  if (!env.VOTE_SECRET) {
    console.warn('VOTE_SECRET is not set — voter cookies are using a well-known dev key.');
    return 'dev-only-insecure-vote-secret';
  }
  return env.VOTE_SECRET;
}

/** Reads a valid voter ID from the request, or null if absent/tampered. */
export async function readVoterId(c: Context<{ Bindings: Env }>): Promise<string | null> {
  const raw = getCookie(c, COOKIE_NAME);
  if (!raw) return null;

  const separator = raw.lastIndexOf('.');
  if (separator <= 0) return null;

  const id = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;

  const expected = await hmac(secretOf(c.env), id);
  return safeEqual(signature, expected) ? id : null;
}

/**
 * Returns the caller's voter ID, minting and setting one if they don't have a
 * valid cookie yet. Only called on write paths, so plain readers are never
 * given a cookie they didn't need.
 */
export async function requireVoterId(c: Context<{ Bindings: Env }>): Promise<string> {
  const existing = await readVoterId(c);
  if (existing) return existing;

  const id = crypto.randomUUID();
  const signature = await hmac(secretOf(c.env), id);

  setCookie(c, COOKIE_NAME, `${id}.${signature}`, {
    path: '/',
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    maxAge: COOKIE_MAX_AGE,
  });

  return id;
}

export function clientIp(c: Context<{ Bindings: Env }>): string {
  return (
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

/**
 * A salted hash of the caller's IP. We throttle on this and never store the
 * address itself — enough to spot abuse, not enough to be a log of who read
 * what.
 */
export async function ipHash(c: Context<{ Bindings: Env }>): Promise<string> {
  return (await hmac(secretOf(c.env), `ip:${clientIp(c)}`)).slice(0, 32);
}

export interface RateLimit {
  /** Max actions allowed inside one window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export const RATE_LIMITS = {
  vote: { limit: 60, windowSeconds: 3600 },
  submit: { limit: 5, windowSeconds: 3600 },
  report: { limit: 10, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimit>;

/**
 * Fixed-window counter in D1. Increments and reports whether the caller is
 * still under the limit. Fixed windows allow a burst across a boundary, which
 * is an acceptable trade for one round-trip and no extra binding.
 */
export async function checkRateLimit(
  env: Env,
  bucket: keyof typeof RATE_LIMITS,
  hash: string,
  now: number = Date.now(),
): Promise<{ allowed: boolean; remaining: number }> {
  const { limit, windowSeconds } = RATE_LIMITS[bucket];
  const windowKey = Math.floor(now / 1000 / windowSeconds);

  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (bucket, ip_hash, window_key, count)
     VALUES (?1, ?2, ?3, 1)
     ON CONFLICT(bucket, ip_hash, window_key)
       DO UPDATE SET count = count + 1
     RETURNING count`,
  )
    .bind(bucket, hash, windowKey)
    .first<{ count: number }>();

  const count = row?.count ?? 1;
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}

/**
 * Drops counters from windows that have rolled over. Each bucket sizes its own
 * window, so the cutoff is computed per bucket rather than globally — a shared
 * cutoff would wipe long-window buckets on their first tick.
 */
export async function pruneRateLimits(env: Env, now: number = Date.now()): Promise<void> {
  const statements = Object.entries(RATE_LIMITS).map(([bucket, { windowSeconds }]) =>
    env.DB.prepare('DELETE FROM rate_limits WHERE bucket = ?1 AND window_key < ?2').bind(
      bucket,
      Math.floor(now / 1000 / windowSeconds) - 2,
    ),
  );
  await env.DB.batch(statements);
}
