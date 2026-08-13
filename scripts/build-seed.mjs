#!/usr/bin/env node
// Turns data/seed.json into a D1 migration.
//
//   node scripts/build-seed.mjs                       -> migrations/0002_seed.sql
//   node scripts/build-seed.mjs migrations/0007_x.sql -> that file instead
//
// D1 runs each migration exactly once, so editing an already-applied migration
// does nothing. To correct a listing after launch, point the generator at a new
// migration number: the statements are upserts keyed on `slug`, so they patch
// existing rows in place and leave votes, status and timestamps alone.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = resolve(root, process.argv[2] ?? 'migrations/0002_seed.sql');

const KINDS = new Set(['api', 'dataset', 'library', 'mcp']);
const PRICING = new Set(['free', 'freemium', 'paid']);
const AUTH = new Set(['none', 'api-key', 'oauth', 'unknown']);
const CORS = new Set(['yes', 'no', 'unknown']);

/** Single-quote a value for SQLite, or emit a bare NULL. */
function sql(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function validate(api, index) {
  const where = `apis[${index}] (${api.slug ?? 'no slug'})`;
  const fail = (msg) => {
    throw new Error(`${where}: ${msg}`);
  };

  for (const field of ['slug', 'name', 'tagline', 'homepage_url', 'pricing']) {
    if (!api[field]) fail(`missing required field "${field}"`);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(api.slug)) fail('slug must be lowercase kebab-case');
  if (!PRICING.has(api.pricing)) fail(`pricing must be one of ${[...PRICING].join(', ')}`);
  if (api.kind && !KINDS.has(api.kind)) fail(`kind must be one of ${[...KINDS].join(', ')}`);
  if (api.auth && !AUTH.has(api.auth)) fail(`auth must be one of ${[...AUTH].join(', ')}`);
  if (api.cors && !CORS.has(api.cors)) fail(`cors must be one of ${[...CORS].join(', ')}`);
  for (const field of ['homepage_url', 'docs_url', 'repo_url']) {
    const url = api[field];
    if (url && !/^https?:\/\//.test(url)) fail(`${field} must be an absolute http(s) URL`);
  }
  if (!Array.isArray(api.categories) || api.categories.length === 0) {
    fail('categories must be a non-empty array');
  }
  if (!Array.isArray(api.languages)) fail('languages must be an array');
}

const seed = JSON.parse(readFileSync(resolve(root, 'data/seed.json'), 'utf8'));
const apis = seed.apis ?? [];

const seen = new Set();
apis.forEach((api, i) => {
  validate(api, i);
  if (seen.has(api.slug)) throw new Error(`duplicate slug "${api.slug}"`);
  seen.add(api.slug);
});

const COLUMNS = [
  'slug',
  'name',
  'tagline',
  'description',
  'homepage_url',
  'docs_url',
  'repo_url',
  'kind',
  'pricing',
  'pricing_note',
  'open_source',
  'license',
  'auth',
  'cors',
  'official',
  'categories',
  'languages',
  'status',
];

// Everything except identity, vote tallies and moderation state gets refreshed
// on conflict.
const UPDATABLE = COLUMNS.filter((c) => c !== 'slug' && c !== 'status');

const statements = apis.map((api) => {
  const row = {
    slug: api.slug,
    name: api.name,
    tagline: api.tagline,
    description: api.description ?? '',
    homepage_url: api.homepage_url,
    docs_url: api.docs_url ?? null,
    repo_url: api.repo_url ?? null,
    kind: api.kind ?? 'api',
    pricing: api.pricing,
    pricing_note: api.pricing_note ?? null,
    open_source: api.open_source ? 1 : 0,
    license: api.license ?? null,
    auth: api.auth ?? 'unknown',
    cors: api.cors ?? 'unknown',
    official: api.official ? 1 : 0,
    categories: JSON.stringify(api.categories),
    languages: JSON.stringify(api.languages ?? []),
    status: 'published',
  };

  const values = COLUMNS.map((c) => sql(row[c])).join(', ');
  const updates = UPDATABLE.map((c) => `  ${c} = excluded.${c}`).join(',\n');

  return `INSERT INTO apis (${COLUMNS.join(', ')})\nVALUES (${values})\nON CONFLICT(slug) DO UPDATE SET\n${updates},\n  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');`;
});

const header = `-- GENERATED FILE — do not edit by hand.
-- Source: data/seed.json
-- Regenerate: npm run seed:build
--
-- ${apis.length} listings. Upserts on slug; votes and moderation status are preserved.
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${header}\n${statements.join('\n\n')}\n`);

console.log(`Wrote ${apis.length} listings to ${outPath.replace(`${root}/`, '')}`);
