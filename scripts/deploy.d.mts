/*
  Types for the pure helpers in deploy.mjs, so the tests that exercise them are
  typechecked like everything else. The script itself stays plain JS: it runs
  under bare `node` during a deploy, with no build step in the way.
*/

/** The `database_id` value in wrangler.jsonc before a real one is written. */
export const PLACEHOLDER: string;

/** Pulls a database id out of `d1 create` or `d1 info` output. */
export function extractDatabaseId(text: string | undefined | null): string | null;

/** The id currently in the config, or null if it is still the placeholder. */
export function configuredDatabaseId(config: string): string | null;

/** Replaces the placeholder. Throws if `id` is not a UUID. */
export function withDatabaseId(config: string, id: string): string;

/** Whether `wrangler secret list` output shows a secret of that name. */
export function hasSecret(listOutput: string | undefined | null, name: string): boolean;

/** Migration filenames not yet in D1's ledger, in the order they must run. */
export function pendingMigrations(files: string[], applied: string[]): string[];

/** Pulls result rows out of `wrangler d1 execute --json` output. */
export function parseD1Rows(output: string | undefined | null): Array<Record<string, unknown>>;
