-- Catholic APIs directory — initial schema.
--
-- Vote tallies live denormalised on `apis` and are kept in sync by triggers, so
-- listing pages never have to aggregate the `votes` table.

CREATE TABLE apis (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  slug           TEXT    NOT NULL UNIQUE,
  name           TEXT    NOT NULL,
  tagline        TEXT    NOT NULL,
  description    TEXT    NOT NULL DEFAULT '',
  homepage_url   TEXT    NOT NULL,
  docs_url       TEXT,
  repo_url       TEXT,

  -- Two tracks share this table: developer building blocks ('api') and finished
  -- Catholic software people use ('product'). A second table would have meant a
  -- duplicate set of votes, reports, rate limits and moderation for no gain, so
  -- a listing simply declares which half it belongs to and everything
  -- downstream is shared.
  track          TEXT    NOT NULL DEFAULT 'api' CHECK (track IN ('api', 'product')),

  -- Not everything useful is a hosted endpoint. Keeping the distinction explicit
  -- means a reader filtering for "api" never gets handed an npm package.
  -- Meaningful only when track = 'api'; product rows keep the default and the
  -- UI never reads it for them.
  kind           TEXT    NOT NULL DEFAULT 'api' CHECK (kind IN ('api', 'dataset', 'library', 'mcp')),

  -- Where a product runs: JSON array of ios/android/web/desktop/parish. The API
  -- track answers the same question with `kind` instead.
  platforms      TEXT    NOT NULL DEFAULT '[]',

  -- When a product was released. Drives the "just launched" flash and is left
  -- NULL unless someone actually confirmed a date — a guessed one would light
  -- up the flash for something years old.
  launched_at    TEXT,

  -- What it costs to use. `open_source` is orthogonal: an API can be free to
  -- call without its server being open source, and vice versa.
  pricing        TEXT    NOT NULL CHECK (pricing IN ('free', 'freemium', 'paid')),
  pricing_note   TEXT,
  open_source    INTEGER NOT NULL DEFAULT 0 CHECK (open_source IN (0, 1)),
  license        TEXT,

  auth           TEXT    NOT NULL DEFAULT 'unknown' CHECK (auth IN ('none', 'api-key', 'oauth', 'unknown')),
  cors           TEXT    NOT NULL DEFAULT 'unknown' CHECK (cors IN ('yes', 'no', 'unknown')),

  -- 1 when the API is published by the body that owns the underlying content
  -- (a diocese, a publisher, the Holy See); 0 for community re-publications.
  official       INTEGER NOT NULL DEFAULT 0 CHECK (official IN (0, 1)),

  -- JSON arrays of strings.
  categories     TEXT    NOT NULL DEFAULT '[]',
  languages      TEXT    NOT NULL DEFAULT '[]',

  status         TEXT    NOT NULL DEFAULT 'published' CHECK (status IN ('pending', 'published', 'rejected')),

  -- Which upstream list a listing came from, if any, so credit travels with the
  -- row rather than living only on an About page.
  source         TEXT,
  source_url     TEXT,

  -- Deliberately separate from `status`. A deprecated listing stays *published*
  -- and visibly flagged rather than disappearing: someone searching for a
  -- project that died learns that it died, which is more use than a blank page.
  -- Borrowed from the "Attic" section the awesome-catholic lists keep.
  deprecated     INTEGER NOT NULL DEFAULT 0 CHECK (deprecated IN (0, 1)),
  deprecated_note TEXT,

  -- Filled in by the scheduled uptime check (src/health.ts).
  --   unknown  never probed, or the last probe could not complete
  --   up       last probe returned a non-error status
  --   down     `health_fails` probes in a row failed
  health_state   TEXT    NOT NULL DEFAULT 'unknown' CHECK (health_state IN ('unknown', 'up', 'down')),
  health_code    INTEGER,
  health_checked_at TEXT,
  -- Consecutive failures. One timeout is a blip; three is a dead site, so the
  -- state only flips to 'down' once this passes the threshold in src/health.ts.
  health_fails   INTEGER NOT NULL DEFAULT 0,

  submitter      TEXT,
  submitter_note TEXT,
  moderator_note TEXT,

  upvotes        INTEGER NOT NULL DEFAULT 0,
  downvotes      INTEGER NOT NULL DEFAULT 0,

  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  -- Last time a human confirmed the endpoint still answers. NULL = never checked.
  verified_at    TEXT
);

CREATE INDEX idx_apis_status_created ON apis (status, created_at DESC);
CREATE INDEX idx_apis_status_score   ON apis (status, (upvotes - downvotes) DESC);
CREATE INDEX idx_apis_track          ON apis (track, status);
CREATE INDEX idx_apis_launched       ON apis (track, launched_at DESC);
CREATE INDEX idx_apis_deprecated     ON apis (deprecated, status);
-- The uptime checker walks listings oldest-probe-first; this is that ordering.
CREATE INDEX idx_apis_health_checked ON apis (health_checked_at);

-- One row per (api, voter). Re-voting the same direction deletes the row,
-- voting the other way updates it in place.
CREATE TABLE votes (
  api_id     INTEGER NOT NULL REFERENCES apis (id) ON DELETE CASCADE,
  voter_id   TEXT    NOT NULL,
  value      INTEGER NOT NULL CHECK (value IN (-1, 1)),
  ip_hash    TEXT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (api_id, voter_id)
);

-- Powers the "trending" sort, which only counts votes cast in a recent window.
CREATE INDEX idx_votes_recent ON votes (updated_at DESC, api_id);
CREATE INDEX idx_votes_voter  ON votes (voter_id);
CREATE INDEX idx_votes_ip     ON votes (ip_hash, created_at DESC);

-- SQLite comparisons evaluate to 1/0, so these arithmetic updates are exact.
CREATE TRIGGER votes_after_insert AFTER INSERT ON votes BEGIN
  UPDATE apis
     SET upvotes   = upvotes   + (NEW.value = 1),
         downvotes = downvotes + (NEW.value = -1)
   WHERE id = NEW.api_id;
END;

CREATE TRIGGER votes_after_update AFTER UPDATE OF value ON votes BEGIN
  UPDATE apis
     SET upvotes   = upvotes   - (OLD.value = 1)  + (NEW.value = 1),
         downvotes = downvotes - (OLD.value = -1) + (NEW.value = -1)
   WHERE id = NEW.api_id;
END;

CREATE TRIGGER votes_after_delete AFTER DELETE ON votes BEGIN
  UPDATE apis
     SET upvotes   = upvotes   - (OLD.value = 1),
         downvotes = downvotes - (OLD.value = -1)
   WHERE id = OLD.api_id;
END;

-- Coarse per-IP throttle for writes (votes, submissions, reports).
-- `window_key` is an integer (epoch / window length) so pruning can compare it
-- numerically; each bucket defines its own window length in src/voter.ts.
CREATE TABLE rate_limits (
  bucket     TEXT    NOT NULL,
  ip_hash    TEXT    NOT NULL,
  window_key INTEGER NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, ip_hash, window_key)
);

CREATE INDEX idx_rate_limits_window ON rate_limits (bucket, window_key);

-- "Something's wrong with this listing" reports from readers. 'deprecated' and
-- 'moved' are the two this directory receives most, so both are first-class
-- rather than folded into 'other' where nobody would ever count them.
--
-- 'revived' runs the other way: a flagged project that turns out to be alive
-- again. Without it a listing could only ever rot, and a directory that can
-- mark things dead but never undo it is just a slower kind of wrong.
CREATE TABLE reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  api_id     INTEGER NOT NULL REFERENCES apis (id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL CHECK (
               kind IN (
                 'dead-link', 'deprecated', 'moved', 'wrong-info',
                 'duplicate', 'revived', 'other'
               )
             ),
  message    TEXT    NOT NULL DEFAULT '',
  ip_hash    TEXT,
  resolved   INTEGER NOT NULL DEFAULT 0 CHECK (resolved IN (0, 1)),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_reports_open ON reports (resolved, created_at DESC);
-- The moderation queue groups open reports by listing and kind.
CREATE INDEX idx_reports_api  ON reports (api_id, kind);
