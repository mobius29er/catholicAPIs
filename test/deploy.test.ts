import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDER,
  configuredDatabaseId,
  pendingMigrations,
  parseD1Rows,
  extractDatabaseId,
  hasSecret,
  withDatabaseId,
} from '../scripts/deploy.mjs';

/**
 * The text handling inside the deploy script.
 *
 * This script runs against someone's real Cloudflare account, usually exactly
 * once, on a machine nobody is watching closely — and its inputs are the
 * free-form output of another CLI. That combination is why the parsing lives
 * in pure functions: it is the part most likely to be wrong and the part
 * hardest to exercise for real.
 */

const CREATE_OUTPUT = `
 ⛅️ wrangler 4.122.0
─────────────────────
✅ Successfully created DB 'catholic-apis' in region WEUR
Created your new D1 database.

[[d1_databases]]
binding = "DB"
database_name = "catholic-apis"
database_id = "b1f0a9c2-3d4e-4f5a-8b6c-7d8e9f0a1b2c"
`;

const INFO_OUTPUT = `
┌───────────────────┬──────────────────────────────────────┐
│ database_name     │ catholic-apis                        │
├───────────────────┼──────────────────────────────────────┤
│ database_id       │ b1f0a9c2-3d4e-4f5a-8b6c-7d8e9f0a1b2c │
└───────────────────┴──────────────────────────────────────┘
`;

describe('extractDatabaseId', () => {
  it('reads the id out of `d1 create` output', () => {
    expect(extractDatabaseId(CREATE_OUTPUT)).toBe('b1f0a9c2-3d4e-4f5a-8b6c-7d8e9f0a1b2c');
  });

  // The fallback path, taken when the database already exists and create fails.
  it('reads the id out of `d1 info` table output', () => {
    expect(extractDatabaseId(INFO_OUTPUT)).toBe('b1f0a9c2-3d4e-4f5a-8b6c-7d8e9f0a1b2c');
  });

  it('returns null rather than a wrong id when there is none', () => {
    expect(extractDatabaseId('✘ [ERROR] Authentication error [code: 10000]')).toBeNull();
    expect(extractDatabaseId('')).toBeNull();
    expect(extractDatabaseId(undefined)).toBeNull();
  });
});

describe('configuredDatabaseId', () => {
  it('treats the placeholder as not configured', () => {
    expect(configuredDatabaseId(`"database_id": "${PLACEHOLDER}"`)).toBeNull();
  });

  it('treats an empty id as not configured', () => {
    expect(configuredDatabaseId('"database_id": ""')).toBeNull();
  });

  it('reports a real id so a re-run does not create a second database', () => {
    expect(configuredDatabaseId('"database_id": "b1f0a9c2-3d4e-4f5a-8b6c-7d8e9f0a1b2c"')).toBe(
      'b1f0a9c2-3d4e-4f5a-8b6c-7d8e9f0a1b2c',
    );
  });
});

describe('withDatabaseId', () => {
  const config = readConfig();

  function readConfig() {
    return `{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "catholic-apis",
      // Replace with the id printed by \`wrangler d1 create catholic-apis\`.
      "database_id": "${PLACEHOLDER}",
      "migrations_dir": "migrations"
    }
  ]
}`;
  }

  it('substitutes the id and leaves the rest of the JSONC alone', () => {
    const next = withDatabaseId(config, 'b1f0a9c2-3d4e-4f5a-8b6c-7d8e9f0a1b2c');
    expect(next).toContain('"database_id": "b1f0a9c2-3d4e-4f5a-8b6c-7d8e9f0a1b2c"');
    expect(next).not.toContain(PLACEHOLDER);
    // Comments must survive: this file is JSONC and the comments are load-bearing.
    expect(next).toContain('// Replace with the id printed by');
    expect(next).toContain('"migrations_dir": "migrations"');
  });

  // Better to stop than to write an error message into the config as an id.
  it('refuses anything that is not a database id', () => {
    expect(() => withDatabaseId(config, 'Authentication error')).toThrow();
    expect(() => withDatabaseId(config, '')).toThrow();
  });

  /*
    The real config is in one of two legitimate states: freshly cloned, still
    holding the placeholder, or deployed, holding a real id. Both must be
    readable by the script — that is what stops a renamed or deleted
    `database_id` key from silently breaking the first deploy.
  */
  it('can read the database_id out of the real config, in either state', () => {
    const real = readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8');
    expect(real).toMatch(/"database_id"\s*:/);

    const id = configuredDatabaseId(real);
    if (real.includes(PLACEHOLDER)) {
      expect(id).toBeNull();
      expect(withDatabaseId(real, 'b1f0a9c2-3d4e-4f5a-8b6c-7d8e9f0a1b2c')).not.toContain(
        PLACEHOLDER,
      );
    } else {
      expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    }
  });
});

describe('hasSecret', () => {
  const list = JSON.stringify([
    { name: 'VOTE_SECRET', type: 'secret_text' },
    { name: 'ADMIN_TOKEN', type: 'secret_text' },
  ]);

  it('finds a secret that is set', () => {
    expect(hasSecret(list, 'VOTE_SECRET')).toBe(true);
    expect(hasSecret(list, 'ADMIN_TOKEN')).toBe(true);
  });

  it('does not find one that is absent', () => {
    expect(hasSecret(JSON.stringify([{ name: 'VOTE_SECRET' }]), 'ADMIN_TOKEN')).toBe(false);
    expect(hasSecret('[]', 'VOTE_SECRET')).toBe(false);
  });

  /*
    The failure that matters. On a first run `secret list` errors, and its
    message can easily contain the secret's own name. Reading that as "already
    set" would skip creating ADMIN_TOKEN and leave /admin permanently shut with
    no way in — so the match is against the JSON field, not the whole blob.
  */
  it('is not fooled by the name appearing inside an error message', () => {
    const error = '✘ [ERROR] Could not read ADMIN_TOKEN: worker "catholic-apis" not found';
    expect(hasSecret(error, 'ADMIN_TOKEN')).toBe(false);
  });

  it('copes with wrangler printing a banner before the JSON', () => {
    expect(hasSecret(`⛅️ wrangler 4.122.0\n${list}`, 'VOTE_SECRET')).toBe(true);
  });

  it('treats empty or missing output as nothing set', () => {
    expect(hasSecret('', 'VOTE_SECRET')).toBe(false);
    expect(hasSecret(undefined, 'VOTE_SECRET')).toBe(false);
  });
});

/*
  Migrations are applied by this script rather than by `wrangler d1 migrations
  apply --remote`, which fails on this schema with "incomplete input" because
  0001 contains CREATE TRIGGER. Establishing that took a statement-by-statement
  bisect against a real database; these cover the ordering and parsing that
  replaced it, so nobody has to repeat the bisect.
*/
describe('pendingMigrations', () => {
  const files = [
    '0003_products.sql',
    '0001_init.sql',
    '0005_cdcf.sql',
    '0002_seed.sql',
    '0004_imported.sql',
  ];

  it('returns everything, in order, against an empty ledger', () => {
    expect(pendingMigrations(files, [])).toEqual([
      '0001_init.sql',
      '0002_seed.sql',
      '0003_products.sql',
      '0004_imported.sql',
      '0005_cdcf.sql',
    ]);
  });

  // Order is the whole game: 0002 inserts rows into tables 0001 creates.
  it('sorts even when the directory listing arrives shuffled', () => {
    expect(pendingMigrations(files, [])[0]).toBe('0001_init.sql');
  });

  it('skips what the ledger already records', () => {
    expect(pendingMigrations(files, ['0001_init.sql', '0002_seed.sql'])).toEqual([
      '0003_products.sql',
      '0004_imported.sql',
      '0005_cdcf.sql',
    ]);
  });

  it('is empty when everything is applied, so a re-run is a no-op', () => {
    expect(pendingMigrations(files, files)).toEqual([]);
  });

  it('ignores non-SQL files sitting in the migrations directory', () => {
    expect(pendingMigrations(['0001_init.sql', 'README.md', '.DS_Store'], [])).toEqual([
      '0001_init.sql',
    ]);
  });

  /*
    Asserted as an invariant rather than a fixed list, because migrations get
    added — a test that has to be edited every time one is added teaches people
    to edit tests instead of reading them.
  */
  it('orders the migrations this repo actually ships', () => {
    const real = readdirSync(resolve(process.cwd(), 'migrations'));
    const pending = pendingMigrations(real, []);

    expect(pending.length).toBeGreaterThanOrEqual(5);
    expect(pending[0]).toBe('0001_init.sql');
    expect(pending).toEqual([...pending].sort());
    expect(pending.every((f) => /^\d{4}_[\w-]+\.sql$/.test(f))).toBe(true);
    // Nothing may sort before the schema that everything else writes into.
    expect(pending.filter((f) => f.startsWith('0001'))).toHaveLength(1);
  });
});

describe('parseD1Rows', () => {
  const envelope = JSON.stringify([
    { results: [{ name: '0001_init.sql' }, { name: '0002_seed.sql' }], success: true },
  ]);

  it('reads rows out of the envelope', () => {
    expect(parseD1Rows(envelope).map((r) => r.name)).toEqual(['0001_init.sql', '0002_seed.sql']);
  });

  it('copes with wrangler printing a banner first', () => {
    expect(parseD1Rows(`⛅️ wrangler 4.122.0\n${envelope}`)).toHaveLength(2);
  });

  it('returns nothing for an empty result set', () => {
    expect(parseD1Rows(JSON.stringify([{ results: [], success: true }]))).toEqual([]);
  });

  /*
    A brand-new database has no ledger table, so the query errors and there is
    no JSON at all. Reading that as "nothing applied" is exactly right — but it
    must not throw, or the first deploy dies before it starts.
  */
  it('treats unparseable output as nothing applied', () => {
    expect(parseD1Rows('')).toEqual([]);
    expect(parseD1Rows(undefined)).toEqual([]);
    expect(parseD1Rows('X [ERROR] no such table: d1_migrations')).toEqual([]);
  });
});
