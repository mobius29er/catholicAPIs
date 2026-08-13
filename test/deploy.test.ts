import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDER,
  configuredDatabaseId,
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

  it('matches the placeholder the real config actually contains', () => {
    // Guards against the placeholder being renamed in one file and not the other,
    // which would leave the script silently unable to patch anything.
    const real = readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8');
    expect(real).toContain(PLACEHOLDER);
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
