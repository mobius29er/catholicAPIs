export type Kind = 'api' | 'dataset' | 'library' | 'mcp';
/**
 * Which half of the directory a listing lives in: developer building blocks
 * (`api`) or finished software people use (`product`). Everything else —
 * voting, reports, moderation, the JSON API — is shared between them.
 */
export type Track = 'api' | 'product';
export type Platform = 'ios' | 'android' | 'web' | 'desktop' | 'parish';
export type Pricing = 'free' | 'freemium' | 'paid';
export type Auth = 'none' | 'api-key' | 'oauth' | 'unknown';
export type Cors = 'yes' | 'no' | 'unknown';
export type Status = 'pending' | 'published' | 'rejected';
/** Result of the scheduled uptime probe. See src/health.ts. */
export type HealthState = 'unknown' | 'up' | 'down';
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
  /** Meaningful only when `track` is 'api'. */
  kind: Kind;
  track: Track;
  launched_at: string | null;
  platforms: string;
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
  /** Which upstream list this came from, if any. Credited on the listing. */
  source: string | null;
  source_url: string | null;
  /** Still published, but visibly flagged as dead or superseded. */
  deprecated: number;
  deprecated_note: string | null;
  health_state: HealthState;
  health_code: number | null;
  health_checked_at: string | null;
  health_fails: number;
}

/** An `ApiRow` with JSON columns parsed and derived vote figures attached. */
export interface Listing
  extends Omit<
    ApiRow,
    'categories' | 'languages' | 'platforms' | 'open_source' | 'official' | 'deprecated'
  > {
  deprecated: boolean;
  categories: string[];
  languages: string[];
  platforms: Platform[];
  open_source: boolean;
  official: boolean;
  score: number;
  /** Wilson lower bound; the "top" sort key. */
  confidence: number;
  /** Net votes in the trailing window; the "trending" sort key. */
  recent: number;
  /** The current visitor's vote on this listing, if any. */
  myVote: -1 | 0 | 1;
  /** Launched inside the recency window — drives the "just launched" flash. */
  isNew: boolean;
}

export interface Filters {
  q: string;
  track: Track;
  pricing: Pricing[];
  kind: Kind[];
  platforms: Platform[];
  categories: string[];
  languages: string[];
  auth: Auth[];
  openSource: boolean;
  noAuth: boolean;
  sort: Sort;
  page: number;
}

/** Where a listing's detail page lives. The two tracks get distinct URL spaces. */
export const listingPath = (listing: Pick<Listing, 'track' | 'slug'>): string =>
  listing.track === 'product' ? `/products/${listing.slug}` : `/apis/${listing.slug}`;

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Canonical origin. Unset is fine: the site falls back to the request's own
   * origin, which is what makes a bare *.workers.dev deploy correct. */
  SITE_URL?: string;
  SITE_NAME?: string;
  /** HMAC key for anonymous voter cookies. Falls back to a dev-only constant. */
  VOTE_SECRET?: string;
  /** When set, unlocks /admin via bearer token or ?token=. */
  ADMIN_TOKEN?: string;
  TURNSTILE_SITEKEY?: string;
  TURNSTILE_SECRET?: string;
}
