/*
  First deploy, end to end.

    npm run deploy:setup

  NO SHEBANG on this file, unlike its siblings in this directory. It is the one
  script the test suite imports, and Vitest's transform does not strip `#!` the
  way Node does — so a shebang here fails at load with "SyntaxError: Invalid or
  unexpected token", reported against the importing test rather than this file,
  which is a genuinely horrible half hour. It is always run as
  `node scripts/deploy.mjs` via npm, so the shebang bought nothing.

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
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = resolve(root, 'wrangler.jsonc');
/*
  Still the old name after the rename to FidesHunt, and deliberately so: D1
  databases cannot be renamed, and recreating one to relabel it would mean
  migrating every listing and every vote for no user-visible gain. It must keep
  matching `database_name` in wrangler.jsonc, which is what wrangler looks up.
*/
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

/** Migration filenames not yet in D1's ledger, in the order they must run. */
export function pendingMigrations(files, applied) {
  const done = new Set(applied);
  return files
    .filter((f) => f.endsWith('.sql') && !done.has(f))
    .sort((a, b) => a.localeCompare(b, 'en'));
}

/**
 * Pulls result rows out of `wrangler d1 execute --json` output.
 *
 * Returns nothing rather than throwing when the output is not JSON at all —
 * which is the normal case on a brand-new database, where the ledger table does
 * not exist yet and the query errors. "No rows" is the right reading of that,
 * and note that an error message is not safely distinguishable by looking for a
 * bracket: `[ERROR]` has one.
 */
export function parseD1Rows(output) {
  const start = output?.indexOf('[') ?? -1;
  if (start < 0) return [];
  try {
    const parsed = JSON.parse(output.slice(start));
    return (Array.isArray(parsed) ? parsed : [parsed]).flatMap((r) => r?.results ?? []);
  } catch {
    return [];
  }
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

  /*
    Run wrangler's script with this same Node binary, rather than shelling out
    to `npx`.

    On Windows there is no `npx.exe` — only `npx.cmd` — and Node refuses to
    spawn a .cmd without `shell: true`, so `execFileSync('npx', …)` throws
    before wrangler ever starts. Caught by the wrapper below, that surfaced as
    "you are not logged in" to someone who had just logged in successfully.

    `process.execPath` is a real executable on every platform, and calling the
    package's own entry point skips shell quoting entirely.
  */
  const WRANGLER = resolve(root, 'node_modules/wrangler/bin/wrangler.js');

  if (!existsSync(WRANGLER)) {
    console.error(`
   Dependencies are not installed — wrangler is missing from node_modules.

   Run:  npm install

   (Using \`npx wrangler\` instead would download a second copy of wrangler on
   every call, and a different version from the one this project pins.)
`);
    process.exit(1);
  }

  const run = (args, stdio) =>
    execFileSync(process.execPath, [WRANGLER, ...args], { cwd: root, encoding: 'utf8', stdio });

  /** Runs wrangler, streaming its output. */
  const wrangler = (args) => run(args, 'inherit');

  /** Runs wrangler and captures stdout, even on failure. */
  const tryWrangler = (args) => {
    try {
      return { ok: true, out: run(args, ['inherit', 'pipe', 'pipe']) ?? '' };
    } catch (error) {
      return {
        ok: false,
        out: `${error.stdout ?? ''}${error.stderr ?? ''}` || String(error.message ?? error),
      };
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

  /*
    Not `d1 migrations apply --remote`, which fails on this schema with
    "incomplete input: SQLITE_ERROR". The cause is CREATE TRIGGER: 0001 has
    three, and that command cannot apply a migration containing one. Proven the
    slow way — every one of 0001's 19 statements applies individually, the
    trigger-free migrations 0002-0005 apply through that command without
    complaint, and `d1 execute --file` applies the whole of 0001 happily.

    So we drive it ourselves through the path that works, keeping D1's own
    ledger table so `wrangler d1 migrations list` still tells the truth and a
    later `apply` still skips what is done.
  */
  // Bookkeeping runs captured rather than streamed — nobody needs to read D1's
  // JSON envelope for a CREATE TABLE IF NOT EXISTS.
  const ledger = tryWrangler([
    'd1', 'execute', DB_NAME, '--remote', '--command',
    `CREATE TABLE IF NOT EXISTS d1_migrations (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT UNIQUE,
       applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
     )`,
  ]);
  if (!ledger.ok) {
    console.error(`   Could not reach the database:\n${ledger.out}`);
    process.exit(1);
  }

  const applied = parseD1Rows(
    tryWrangler(['d1', 'execute', DB_NAME, '--remote', '--json', '--command',
                 'SELECT name FROM d1_migrations']).out,
  ).map((row) => row.name);

  const pending = pendingMigrations(readdirSync(resolve(root, 'migrations')), applied);

  if (pending.length === 0) {
    note('nothing pending');
  } else {
    for (const name of pending) {
      if (!/^[\w.-]+\.sql$/.test(name)) throw new Error(`odd migration filename: ${name}`);
      note(`applying ${name}`);
      wrangler(['d1', 'execute', DB_NAME, '--remote', '--file', `migrations/${name}`]);
      // Recorded only once the file has actually applied, so a failure part way
      // through leaves the migration pending rather than silently skipped.
      const recorded = tryWrangler(['d1', 'execute', DB_NAME, '--remote', '--command',
        `INSERT INTO d1_migrations (name) VALUES ('${name}')`]);
      if (!recorded.ok) {
        console.error(`   Applied ${name} but could not record it:\n${recorded.out}`);
        process.exit(1);
      }
    }
    note(`${pending.length} applied`);
  }

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
    // Same Node binary, same reason as `run` above — `npx` is not spawnable
    // without a shell on Windows. stdin carries the secret, so it cannot be
    // 'inherit' here and the call cannot go through `run`.
    execFileSync(process.execPath, [WRANGLER, 'secret', 'put', name], {
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
