import type { Env } from './types';
/** Pure validation shared by the local maker routes and their tests. */
export const AD_PLACEMENTS = { sidebar: 'Directory sponsor', newsletter: 'Newsletter sponsor' } as const;
export type AdPlacement = keyof typeof AD_PLACEMENTS;
export interface MakerSession { account_id: string; display_name: string; is_admin: number; token_hash: string }
export interface Launch { id: string; owner_id: string; name: string; tagline: string; homepage_url: string; description: string; state: 'draft' | 'paid_mock' | 'scheduled'; launch_date: string | null }
export interface AdRequest { id: string; owner_id: string; name: string; tagline: string; target_url: string; month: string; placement: AdPlacement; state: string; clicks?: number }
export interface FeedbackRequest { id: string; owner_id: string; name: string; target_url: string; question: string; audience: string; state: string; closure_note: string; display_name?: string; review_count?: number }
export interface FeedbackReview { id: string; request_id: string; reviewer_id: string; context: string; worked: string; friction: string; suggestion: string; useful: number; state: string; display_name?: string }
export interface FeedbackAccess { state: 'requested' | 'invited' | 'active' | 'revoked'; invite_expires_at: number | null }

export function localMakerEnabled(flag: string | undefined, requestUrl: string): boolean {
  return ['1', 'true'].includes(flag ?? '') && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(requestUrl).hostname);
}
export function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || value.length > 2000) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!host.includes('.') || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.endsWith('.localhost') || host.endsWith('.local') || host.includes(':')) return null;
    return url.href;
  } catch { return null; }
}
export function validLaunchDate(value: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && date >= today && date.getTime() <= today.getTime() + 180 * 86400000;
}
export function validAdMonth(value: string, now = new Date()): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  const [year, month] = value.split('-').map(Number);
  const distance = year * 12 + month - (now.getUTCFullYear() * 12 + now.getUTCMonth() + 1);
  return distance >= 0 && distance <= 12;
}
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
export async function tokenHash(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export const newToken = (): string => crypto.randomUUID() + crypto.randomUUID();
export function isActionKey(value: string): boolean { return /^[\da-f-]{36}$/.test(value); }

/** Approved local placements never modify, join, or sort the organic vote feed. */
export async function listActiveAds(env: Env, placement: AdPlacement = 'sidebar'): Promise<AdRequest[]> {
  if (!['1','true'].includes(env.LOCAL_PREVIEW ?? '')) return [];
  return (await env.DB.prepare("SELECT * FROM maker_ad_requests WHERE state='approved' AND placement=? AND month=? ORDER BY created_at").bind(placement,new Date().toISOString().slice(0,7)).all<AdRequest>()).results;
}
