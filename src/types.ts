export type Kind = 'api' | 'dataset' | 'library' | 'mcp';
export type Pricing = 'free' | 'freemium' | 'paid';
export type Auth = 'none' | 'api-key' | 'oauth' | 'unknown';
export type Cors = 'yes' | 'no' | 'unknown';
export type Status = 'pending' | 'published' | 'rejected';
export type Sort = 'top' | 'trending' | 'new' | 'name';

/** A row of `apis` exactly as D1 returns it. JSON columns are still strings. */
export interface ApiRow {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  homepage_url: string;
  docs_url: string | null;
  repo_url: string | null;
  kind: Kind;
  pricing: Pricing;
  pricing_note: string | null;
  open_source: number;
  license: string | null;
  auth: Auth;
  cors: Cors;
  official: number;
  categories: string;
  languages: string;
  status: Status;
  submitter: string | null;
  submitter_note: string | null;
  moderator_note: string | null;
  upvotes: number;
  downvotes: number;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
}

/** An `ApiRow` with JSON columns parsed and derived vote figures attached. */
export interface Listing
  extends Omit<ApiRow, 'categories' | 'languages' | 'open_source' | 'official'> {
  categories: string[];
  languages: string[];
  open_source: boolean;
  official: boolean;
  score: number;
  /** Wilson lower bound; the "top" sort key. */
  confidence: number;
  /** Net votes in the trailing window; the "trending" sort key. */
  recent: number;
  /** The current visitor's vote on this listing, if any. */
  myVote: -1 | 0 | 1;
}

export interface Filters {
  q: string;
  pricing: Pricing[];
  kind: Kind[];
  categories: string[];
  languages: string[];
  auth: Auth[];
  openSource: boolean;
  noAuth: boolean;
  sort: Sort;
  page: number;
}

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SITE_URL: string;
  SITE_NAME: string;
  /** HMAC key for anonymous voter cookies. Falls back to a dev-only constant. */
  VOTE_SECRET?: string;
  /** When set, unlocks /admin via bearer token or ?token=. */
  ADMIN_TOKEN?: string;
  TURNSTILE_SITEKEY?: string;
  TURNSTILE_SECRET?: string;
}
