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
