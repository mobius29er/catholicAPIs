#!/usr/bin/env node
/*
  First deploy, end to end.

    npm run deploy:setup

  Everything here can be done by hand with five wrangler commands. The one that
  actually trips people is the third: `d1 create` prints a UUID that has to be
  pasted into wrangler.jsonc before anything else will work, and if you miss it
  the failure arrives several steps later as an unhelpful binding error. So the
  script does the pasting.

  Safe to re-run. It creates nothing that already exists, never overwrites a
  secret that is already set, and applies only the migrations D1 has not seen.
*/

import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = resolve(root, 'wrangler.jsonc');
const DB_NAME = 'catholic-apis';
const PLACEHOLDER = 'REPLACE_WITH_YOUR_D1_DATABASE_ID';

const step = (n, text) => console.log(`\n\x1b[1m${n}. ${text}\x1b[0m`);
const note = (text) => console.log(`   ${text}`);

/** Runs wrangler, streaming its output; returns nothing. */
function wrangler(args, { quiet = false } = {}) {
  return execFileSync('npx', ['wrangler', ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: quiet ? ['inherit', 'pipe', 'pipe'] : 'inherit',
  });
}

/** Runs wrangler and captures stdout, even on failure. */
function tryWrangler(args) {
  try {
    return { ok: true, out: wrangler(args, { quiet: true }) ?? '' };
  } catch (error) {
    return { ok: false, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

// ---------------------------------------------------------------- 1. account

step(1, 'Checking you are logged in');

const who = tryWrangler(['whoami']);
if (!who.ok || /not authenticated/i.test(who.out)) {
  console.error(`
   Not logged in to Cloudflare.

   Run:  npx wrangler login          (opens a browser)

   Or, on a machine with no browser, create an API token at
   https://dash.cloudflare.com/profile/api-tokens with the
   "Edit Cloudflare Workers" template plus D1:Edit, then:

     export CLOUDFLARE_API_TOKEN=...
     export CLOUDFLARE_ACCOUNT_ID=...
`);
  process.exit(1);
}
note(who.out.split('\n').find((l) => /@|account/i.test(l))?.trim() ?? 'authenticated');

// --------------------------------------------------------------- 2. database

step(2, `Making sure the D1 database "${DB_NAME}" exists`);

let config = readFileSync(CONFIG, 'utf8');
let databaseId = config.match(/"database_id":\s*"([^"]+)"/)?.[1] ?? '';

if (databaseId && databaseId !== PLACEHOLDER) {
  note(`already configured: ${databaseId}`);
} else {
  // `d1 create` fails if the database is already there, which is a fine
  // outcome — we only need its id, and `d1 info` will tell us.
  const created = tryWrangler(['d1', 'create', DB_NAME]);
  const found = created.ok ? created.out : tryWrangler(['d1', 'info', DB_NAME]).out;

  databaseId = found.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? '';

  if (!databaseId) {
    console.error(`   Could not work out the database id. Output was:\n${found}`);
    process.exit(1);
  }

  config = config.replace(`"${PLACEHOLDER}"`, `"${databaseId}"`);
  writeFileSync(CONFIG, config);
  note(`${created.ok ? 'created' : 'found existing'}: ${databaseId}`);
  note('written into wrangler.jsonc — commit that.');
}

// ---------------------------------------------------------------- 3. secrets

step(3, 'Setting secrets');

/*
  Only set what is missing. Rotating VOTE_SECRET on every deploy would
  invalidate every existing voter cookie, which silently resets everyone's
  votes-cast history and lets one person vote again from the same browser.
*/
const existing = tryWrangler(['secret', 'list']).out;
const generate = () => randomBytes(32).toString('base64');

for (const [name, why] of [
  ['VOTE_SECRET', 'signs anonymous voter cookies'],
  ['ADMIN_TOKEN', 'unlocks /admin'],
]) {
  if (existing.includes(`"${name}"`) || existing.includes(name)) {
    note(`${name} already set — left alone (${why})`);
    continue;
  }

  const value = generate();
  execFileSync('npx', ['wrangler', 'secret', 'put', name], {
    cwd: root,
    input: value,
    encoding: 'utf8',
    stdio: ['pipe', 'ignore', 'inherit'],
  });

  note(`${name} generated — ${why}`);
  if (name === 'ADMIN_TOKEN') {
    console.log(`\n   \x1b[1mYour admin token — save it now, it is not shown again:\x1b[0m`);
    console.log(`   ${value}\n`);
  }
}

// ------------------------------------------------------------- 4. migrations

step(4, 'Applying migrations to the remote database');
wrangler(['d1', 'migrations', 'apply', DB_NAME, '--remote']);

// ----------------------------------------------------------------- 5. deploy

step(5, 'Deploying');
wrangler(['deploy']);

console.log(`
\x1b[1mDone.\x1b[0m The URL printed above is live.

  /admin?token=<the admin token above>   moderation queue
  /api/v1                                JSON API

SITE_URL is intentionally unset, so the site describes itself using whatever
hostname it is reached on. Set it in wrangler.jsonc once a custom domain is
the one canonical address, and redeploy.
`);
