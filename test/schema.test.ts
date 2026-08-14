import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPORT_KINDS } from '../src/index';

// Vitest roots at the project directory. If that ever stops being true the
// first read throws, which is a better failure than a silently empty parse.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

/**
 * Constants that live in two places at once.
 *
 * A CHECK constraint and the validation in front of it are the same decision
 * written twice, and the failure mode when they drift is nasty: everything
 * typechecks, every test that does not touch the database passes, and the
 * first person to hit the new code path gets a 500 from SQLite. Cheaper to
 * assert the two agree than to find out that way.
 */
describe('reports.kind', () => {
  const schema = read('migrations/0001_init.sql');

  const kindsInSchema = (() => {
    const table = schema.slice(schema.indexOf('CREATE TABLE reports'));
    const check = table.slice(table.indexOf('kind IN ('));
    const list = check.slice(check.indexOf('(') + 1, check.indexOf(')'));
    return new Set([...list.matchAll(/'([^']+)'/g)].map((m) => m[1]));
  })();

  it('parses the constraint at all', () => {
    // Guards the test itself: a reformatted migration must not quietly turn
    // this suite into an assertion about an empty set.
    expect(kindsInSchema.size).toBeGreaterThan(3);
  });

  it('accepts exactly what the database accepts', () => {
    expect([...REPORT_KINDS].sort()).toEqual([...kindsInSchema].sort());
  });

  it('carries both directions of the deprecation workflow', () => {
    expect(kindsInSchema.has('deprecated')).toBe(true);
    expect(kindsInSchema.has('revived')).toBe(true);
  });
});

/**
 * The seed generator writes these columns; the schema has to have them. Adding
 * a column to one side and not the other is the exact mistake that has already
 * been made twice on this project.
 */
describe('generated migrations', () => {
  const schema = read('migrations/0001_init.sql');
  const table = schema.slice(
    schema.indexOf('CREATE TABLE apis'),
    schema.indexOf('CREATE INDEX idx_apis_status_created'),
  );

  const generated = ['0002_seed', '0003_products', '0004_imported', '0005_cdcf'];

  it.each(generated)('%s only writes columns the schema declares', (name) => {
    const sql = read(`migrations/${name}.sql`);
    const columns = sql.slice(sql.indexOf('INSERT INTO apis (') + 'INSERT INTO apis ('.length);
    const names = columns.slice(0, columns.indexOf(')')).split(',').map((c) => c.trim());

    expect(names.length).toBeGreaterThan(10);
    for (const column of names) {
      expect(table, `column "${column}" is written but not declared`).toContain(column);
    }
  });

  it('seeds every source file the build script knows about', () => {
    const build = read('scripts/build-seed.mjs');
    for (const name of generated) expect(build).toContain(`migrations/${name}.sql`);
  });
});

/**
 * The deploy story, as asserted by the files that carry it.
 *
 * These are the settings whose failure mode is a *successful* deploy that is
 * quietly wrong — a preview whose canonical tags point at production, or a
 * `database_id` placeholder that fails several steps after the mistake.
 */
/**
 * The brand, in the three places that must agree.
 *
 * A rename is easy to do 90% of. What survives is the 10%: a stale fallback
 * that only appears when an env var is missing, or a config that disagrees
 * with the code and only shows up in production. These are those spots.
 */
describe('brand', () => {
  const BRAND = 'FidesHunt';

  it('is what the masthead and footer render', () => {
    const layout = read('src/views/layout.tsx');
    expect(layout).toContain(`<strong>${BRAND}</strong>`);
    expect(layout).not.toContain('Catholic APIs');
  });

  it('is the SITE_NAME fallback used when the env var is unset', () => {
    // The fallback is the one that shows up on a misconfigured deploy, which is
    // exactly when nobody is looking.
    const app = read('src/index.tsx');
    expect(app).toContain(`c.env.SITE_NAME ?? '${BRAND}'`);
    expect(app).not.toMatch(/SITE_NAME \?\? 'Catholic APIs'/);
  });

  it('is the SITE_NAME the config actually ships', () => {
    expect(read('wrangler.jsonc')).toContain(`"SITE_NAME": "${BRAND}"`);
  });

  /*
    Infrastructure names are NOT the brand, deliberately. The Worker, the
    package and the D1 database all stay `catholic-apis`: databases cannot be
    renamed at all, Workers can only be renamed by creating a new one and
    orphaning the old, and none of the three is ever seen by a visitor. Keeping
    them in step with each other is worth more than keeping them in step with
    the marketing.
  */
  it('keeps infrastructure names together, and separate from the brand', () => {
    const config = read('wrangler.jsonc');
    const worker = config.match(/"name":\s*"([^"]+)"/)?.[1];
    const database = config.match(/"database_name":\s*"([^"]+)"/)?.[1];
    const scripted = read('scripts/deploy.mjs').match(/const DB_NAME = '([^']+)'/)?.[1];

    expect(worker).toBe('catholic-apis');
    expect(database).toBe(worker);
    expect(scripted).toBe(database);
    expect(JSON.parse(read('package.json')).name).toBe(worker);
  });
});

describe('deploy configuration', () => {
  const config = read('wrangler.jsonc');

  it('does not pin SITE_URL, so a preview deploy describes itself', () => {
    // Commented-out guidance is fine; an active setting is not. Without this,
    // a *.workers.dev deploy emits canonical tags for a domain that may not be
    // serving anything yet.
    const active = config
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    expect(active).not.toMatch(/"SITE_URL"\s*:/);
  });

  it('runs the uptime cron', () => {
    expect(config).toMatch(/"crons"\s*:\s*\[/);
  });

  it('ships a one-command first deploy', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['deploy:setup']).toBe('node scripts/deploy.mjs');
  });

  it("does not overwrite a VOTE_SECRET that is already set", () => {
    // Rotating it invalidates every voter cookie, which silently lets everyone
    // vote again. The script must skip secrets that exist.
    const deploy = read('scripts/deploy.mjs');
    expect(deploy).toMatch(/already set/);
  });
});
