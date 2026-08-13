#!/usr/bin/env node
/*
  First deploy, end to end.

    npm run deploy:setup

  All of this can be done by hand with five wrangler commands. Two things make
  it worth a script.

  The first is a paste: `d1 create` prints a UUID that has to land in
  wrangler.jsonc before anything else works, and missing it fails several steps
  later as an unrelated-looking binding error.

  The second is an ordering trap. Secrets have to be set *after* the first
  deploy, because `wrangler secret put` against a Worker that does not exist yet
  asks "do you want to create a new Worker?" on stdin — which is the same stdin
  the secret is being piped into, so the prompt eats the secret. Deploy first,
  and the Worker is there to receive them.

  Safe to re-run: creates nothing that exists, never rotates a secret that is
  already set, applies only migrations D1 has not seen.
*/

import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = resolve(root, 'wrangler.jsonc');
const DB_NAME = 'catholic-apis';

export const PLACEHOLDER = 'REPLACE_WITH_YOUR_D1_DATABASE_ID';

/* ------------------------------------------------------------ pure helpers --
   Split out so the fiddly text handling can be tested without a Cloudflare
   account, which is the whole difficulty with a script like this: the parts
   most likely to be wrong are the parts hardest to exercise.
*/

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Pulls a database id out of `d1 create` or `d1 info` output, in any format. */
export function extractDatabaseId(text) {
  return text?.match(UUID)?.[0] ?? null;
}

/** The id currently in the config, or null if it is still the placeholder. */
export function configuredDatabaseId(config) {
  const id = config.match(/"database_id":\s*"([^"]*)"/)?.[1];
  return id && id !== PLACEHOLDER ? id : null;
}

/** Replaces the placeholder, leaving the rest of the JSONC untouched. */
export function withDatabaseId(config, id) {
  if (!UUID.test(id)) throw new Error(`not a database id: ${id}`);
  return config.replace(`"${PLACEHOLDER}"`, `"${id}"`);
}

/**
 * Whether `wrangler secret list` shows a secret.
 *
 * Matches the name as a JSON value rather than as a substring: "ADMIN_TOKEN"
 * appearing anywhere in an error message must not be read as "already set",
 * or the script would skip creating it and leave /admin permanently shut.
 */
export function hasSecret(listOutput, name) {
  if (!listOutput) return false;
  try {
    const parsed = JSON.parse(listOutput.slice(listOutput.indexOf('[')));
    return Array.isArray(parsed) && parsed.some((s) => s?.name === name);
  } catch {
    return new RegExp(`"name"\\s*:\\s*"${name}"`).test(listOutput);
  }
}

/* --------------------------------------------------------------- the script -- */

// Importing this file (from a test) must not deploy anything.
const RUN_DIRECTLY = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (!RUN_DIRECTLY) {
  // Loaded for its helpers; nothing else to do.
} else {
  const step = (n, text) => console.log(`\n\x1b[1m${n}. ${text}\x1b[0m`);
  const note = (text) => console.log(`   ${text}`);

  /** Runs wrangler, streaming its output. */
  const wrangler = (args) =>
    execFileSync('npx', ['wrangler', ...args], { cwd: root, encoding: 'utf8', stdio: 'inherit' });

  /** Runs wrangler and captures stdout, even on failure. */
  const tryWrangler = (args) => {
    try {
      const out = execFileSync('npx', ['wrangler', ...args], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['inherit', 'pipe', 'pipe'],
      });
      return { ok: true, out: out ?? '' };
    } catch (error) {
      return { ok: false, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
    }
  };

  // ------------------------------------------------------------- 1. account

  step(1, 'Checking you are logged in');

  const who = tryWrangler(['whoami']);
  if (!who.ok || /not authenticated/i.test(who.out)) {
    console.error(`
   Not logged in to Cloudflare.

   Run:  npx wrangler login          (opens a browser)

   Or, with no browser available, create an API token at
   https://dash.cloudflare.com/profile/api-tokens using the
   "Edit Cloudflare Workers" template plus D1:Edit, then:

     export CLOUDFLARE_API_TOKEN=...
     export CLOUDFLARE_ACCOUNT_ID=...
`);
    process.exit(1);
  }
  note(who.out.split('\n').find((l) => /@|account/i.test(l))?.trim() ?? 'authenticated');

  // ------------------------------------------------------------ 2. database

  step(2, `Making sure the D1 database "${DB_NAME}" exists`);

  const config = readFileSync(CONFIG, 'utf8');
  let databaseId = configuredDatabaseId(config);

  if (databaseId) {
    note(`already configured: ${databaseId}`);
  } else {
    // `d1 create` fails when the database already exists, which is a fine
    // outcome — we only want its id, and `d1 info` will report it.
    const created = tryWrangler(['d1', 'create', DB_NAME]);
    const source = created.ok ? created.out : tryWrangler(['d1', 'info', DB_NAME]).out;

    databaseId = extractDatabaseId(source);
    if (!databaseId) {
      console.error(`   Could not determine the database id. wrangler said:\n${source}`);
      process.exit(1);
    }

    writeFileSync(CONFIG, withDatabaseId(config, databaseId));
    note(`${created.ok ? 'created' : 'found existing'}: ${databaseId}`);
    note('written into wrangler.jsonc — commit that.');
  }

  // ---------------------------------------------------------- 3. migrations

  step(3, 'Applying migrations to the remote database');
  // Independent of the Worker, so this is safe before the first deploy.
  wrangler(['d1', 'migrations', 'apply', DB_NAME, '--remote']);

  // -------------------------------------------------------------- 4. deploy

  step(4, 'Deploying');
  note('Secrets come after this: `secret put` needs the Worker to exist first.');
  wrangler(['deploy']);

  // ------------------------------------------------------------- 5. secrets

  step(5, 'Setting secrets');

  /*
    Only what is missing. Rotating VOTE_SECRET invalidates every voter cookie
    in existence, which silently lets everyone vote a second time from the same
    browser — a re-run of this script must never do that.
  */
  const existing = tryWrangler(['secret', 'list', '--format', 'json']).out;
  let adminToken = null;

  for (const [name, why] of [
    ['VOTE_SECRET', 'signs anonymous voter cookies'],
    ['ADMIN_TOKEN', 'unlocks /admin'],
  ]) {
    if (hasSecret(existing, name)) {
      note(`${name} already set — left alone (${why})`);
      continue;
    }

    const value = randomBytes(32).toString('base64');
    execFileSync('npx', ['wrangler', 'secret', 'put', name], {
      cwd: root,
      input: value,
      encoding: 'utf8',
      stdio: ['pipe', 'ignore', 'inherit'],
    });

    note(`${name} generated — ${why}`);
    if (name === 'ADMIN_TOKEN') adminToken = value;
  }

  console.log(`
\x1b[1mDone.\x1b[0m The URL printed above is live.
`);

  if (adminToken) {
    console.log(`  \x1b[1mAdmin token — save it now, it is not shown again:\x1b[0m`);
    console.log(`  ${adminToken}\n`);
    console.log(`  /admin?token=${adminToken}\n`);
  } else {
    note('Admin token was already set; use the one you saved.\n');
  }

  console.log(`  /api/v1   JSON API

SITE_URL is intentionally unset, so the site describes itself using whichever
hostname it is reached on. Pin it in wrangler.jsonc once a custom domain is the
one canonical address, and redeploy.
`);
}
