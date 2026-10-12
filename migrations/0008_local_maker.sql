-- Local-only maker preview. Independent tables never affect directory votes.
CREATE TABLE maker_accounts (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT 'Local maker',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE maker_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES maker_accounts(id),
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0,1)),
  expires_at INTEGER NOT NULL
);
CREATE TABLE maker_launches (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES maker_accounts(id),
  action_key TEXT NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  homepage_url TEXT NOT NULL,
  description TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','paid_mock','scheduled')),
  launch_date TEXT,
  price_cents INTEGER NOT NULL DEFAULT 2900 CHECK (price_cents = 2900),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(owner_id, action_key)
);
CREATE TABLE maker_checkouts (
  id TEXT PRIMARY KEY,
  launch_id TEXT NOT NULL UNIQUE REFERENCES maker_launches(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents = 2900),
  currency TEXT NOT NULL CHECK (currency = 'USD'),
  mode TEXT NOT NULL DEFAULT 'simulation' CHECK (mode = 'simulation'),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE maker_services (
  id TEXT PRIMARY KEY,
  launch_id TEXT NOT NULL REFERENCES maker_launches(id),
  kind TEXT NOT NULL CHECK(kind IN ('editorial','video')),
  state TEXT NOT NULL DEFAULT 'requested' CHECK(state IN ('requested','reviewing','completed','declined')),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(launch_id,kind)
);
CREATE TABLE maker_ad_inventory (
  month TEXT NOT NULL,
  placement TEXT NOT NULL CHECK(placement IN ('sidebar','newsletter')),
  capacity INTEGER NOT NULL CHECK(capacity BETWEEN 0 AND 20),
  PRIMARY KEY(month,placement)
);
CREATE TABLE maker_ad_requests (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES maker_accounts(id),
  action_key TEXT NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  target_url TEXT NOT NULL,
  month TEXT NOT NULL,
  placement TEXT NOT NULL CHECK(placement IN ('sidebar','newsletter')),
  state TEXT NOT NULL DEFAULT 'requested' CHECK(state IN ('requested','approved','declined')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(owner_id,action_key),
  FOREIGN KEY(month,placement) REFERENCES maker_ad_inventory(month,placement)
);
CREATE INDEX maker_ad_requests_slot ON maker_ad_requests(month,placement,state);
CREATE TABLE maker_ad_clicks (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES maker_ad_requests(id),
  action_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE maker_newsletter (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  state TEXT NOT NULL DEFAULT 'queued_mock' CHECK(state = 'queued_mock'),
  consent_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE maker_feedback_access (
  account_id TEXT PRIMARY KEY REFERENCES maker_accounts(id),
  state TEXT NOT NULL CHECK(state IN ('requested','invited','active','revoked')),
  invite_expires_at INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE maker_feedback_requests (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES maker_accounts(id),
  action_key TEXT NOT NULL,
  name TEXT NOT NULL,
  target_url TEXT NOT NULL,
  question TEXT NOT NULL,
  audience TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','closed','hidden')),
  closure_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(owner_id,action_key)
);
CREATE TABLE maker_feedback_reviews (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES maker_feedback_requests(id),
  reviewer_id TEXT NOT NULL REFERENCES maker_accounts(id),
  context TEXT NOT NULL,
  worked TEXT NOT NULL,
  friction TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  useful INTEGER NOT NULL DEFAULT 0 CHECK(useful IN (0,1)),
  state TEXT NOT NULL DEFAULT 'visible' CHECK(state IN ('visible','hidden')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(request_id,reviewer_id)
);
CREATE TABLE maker_feedback_reports (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES maker_feedback_reviews(id),
  reporter_id TEXT NOT NULL REFERENCES maker_accounts(id),
  reason TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','resolved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(review_id,reporter_id)
);
