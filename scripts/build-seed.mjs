#!/usr/bin/env node
// Turns a listings JSON file into a D1 migration.
//
//   node scripts/build-seed.mjs                                          -> both defaults
//   node scripts/build-seed.mjs data/products.json migrations/0009_x.sql -> one file
//
// D1 runs each migration exactly once, so editing an already-applied migration
// does nothing. To correct a listing after launch, point the generator at a new
// migration number: the statements are upserts keyed on `slug`, so they patch
// existing rows in place and leave votes, status and timestamps alone.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Each source file maps to exactly one migration. */
const DEFAULT_JOBS = [
  { input: 'data/seed.json', output: 'migrations/0002_seed.sql' },
  { input: 'data/products.json', output: 'migrations/0003_products.sql' },
  { input: 'data/imported.json', output: 'migrations/0004_imported.sql' },
  { input: 'data/cdcf.json', output: 'migrations/0005_cdcf.sql' },
];

const KINDS = new Set(['api', 'dataset', 'library', 'mcp']);
const TRACKS = new Set(['api', 'product']);
const PRICING = new Set(['free', 'freemium', 'paid']);
const AUTH = new Set(['none', 'api-key', 'oauth', 'unknown']);
const CORS = new Set(['yes', 'no', 'unknown']);
const PLATFORMS = new Set(['ios', 'android', 'web', 'desktop', 'parish']);

/** Single-quote a value for SQLite, or emit a bare NULL. */
function sql(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function validate(listing, index, source) {
  const where = `${source}[${index}] (${listing.slug ?? 'no slug'})`;
  const fail = (msg) => {
    throw new Error(`${where}: ${msg}`);
  };

  for (const field of ['slug', 'name', 'tagline', 'homepage_url', 'pricing']) {
    if (!listing[field]) fail(`missing required field "${field}"`);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(listing.slug)) fail('slug must be lowercase kebab-case');
  if (!PRICING.has(listing.pricing)) fail(`pricing must be one of ${[...PRICING].join(', ')}`);
  if (listing.kind && !KINDS.has(listing.kind)) fail(`kind must be one of ${[...KINDS].join(', ')}`);
  if (listing.track && !TRACKS.has(listing.track)) fail(`track must be one of ${[...TRACKS].join(', ')}`);
  if (listing.auth && !AUTH.has(listing.auth)) fail(`auth must be one of ${[...AUTH].join(', ')}`);
  if (listing.cors && !CORS.has(listing.cors)) fail(`cors must be one of ${[...CORS].join(', ')}`);

  for (const platform of listing.platforms ?? []) {
    if (!PLATFORMS.has(platform)) fail(`unknown platform "${platform}"`);
  }
  if (listing.launched_at && !/^\d{4}-\d{2}-\d{2}/.test(listing.launched_at)) {
    fail('launched_at must start with YYYY-MM-DD');
  }

  for (const field of ['homepage_url', 'docs_url', 'repo_url']) {
    const url = listing[field];
    if (url && !/^https?:\/\//.test(url)) fail(`${field} must be an absolute http(s) URL`);
  }
  if (!Array.isArray(listing.categories) || listing.categories.length === 0) {
    fail('categories must be a non-empty array');
  }
  if (!Array.isArray(listing.languages ?? [])) fail('languages must be an array');
}

const COLUMNS = [
  'slug',
  'name',
  'tagline',
  'description',
  'homepage_url',
  'docs_url',
  'repo_url',
  'kind',
  'track',
  'launched_at',
  'platforms',
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
  'deprecated',
  'deprecated_note',
  'source',
  'source_url',
];

// Everything except identity and moderation state gets refreshed on conflict.
// Vote tallies are never touched: a correction must not cost a listing its votes.
const UPDATABLE = COLUMNS.filter((c) => c !== 'slug' && c !== 'status');

function buildMigration(job) {
  const inputPath = resolve(root, job.input);
  const outPath = resolve(root, job.output);

  if (!existsSync(inputPath)) {
    console.log(`   skipped ${job.input} (not present)`);
    return;
  }

  const parsed = JSON.parse(readFileSync(inputPath, 'utf8'));
  // `apis` is the original key; `listings` is the general one. Accept either.
  const listings = parsed.listings ?? parsed.apis ?? [];

  const seen = new Set();
  listings.forEach((listing, i) => {
    validate(listing, i, job.input);
    if (seen.has(listing.slug)) throw new Error(`${job.input}: duplicate slug "${listing.slug}"`);
    seen.add(listing.slug);
  });

  const statements = listings.map((listing) => {
    const row = {
      slug: listing.slug,
      name: listing.name,
      tagline: listing.tagline,
      description: listing.description ?? '',
      homepage_url: listing.homepage_url,
      docs_url: listing.docs_url ?? null,
      repo_url: listing.repo_url ?? null,
      kind: listing.kind ?? 'api',
      track: listing.track ?? 'api',
      launched_at: listing.launched_at ?? null,
      platforms: JSON.stringify(listing.platforms ?? []),
      pricing: listing.pricing,
      pricing_note: listing.pricing_note ?? null,
      open_source: listing.open_source ? 1 : 0,
      license: listing.license ?? null,
      auth: listing.auth ?? 'unknown',
      cors: listing.cors ?? 'unknown',
      official: listing.official ? 1 : 0,
      categories: JSON.stringify(listing.categories),
      languages: JSON.stringify(listing.languages ?? []),
      status: 'published',
      deprecated: listing.deprecated ? 1 : 0,
      deprecated_note: listing.deprecated_note ?? null,
      source: listing.source ?? null,
      source_url: listing.source_url ?? null,
    };

    const values = COLUMNS.map((c) => sql(row[c])).join(', ');
    const updates = UPDATABLE.map((c) => `  ${c} = excluded.${c}`).join(',\n');

    return `INSERT INTO apis (${COLUMNS.join(', ')})\nVALUES (${values})\nON CONFLICT(slug) DO UPDATE SET\n${updates},\n  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');`;
  });

  const header = `-- GENERATED FILE — do not edit by hand.
-- Source: ${job.input}
-- Regenerate: npm run seed:build
--
-- ${listings.length} listings. Upserts on slug; votes and moderation status are preserved.
`;

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${header}\n${statements.join('\n\n')}\n`);

  console.log(`${String(listings.length).padStart(3)} listings -> ${relative(root, outPath)}`);
}

const jobs =
  process.argv.length > 2
    ? [{ input: process.argv[2], output: process.argv[3] ?? 'migrations/0002_seed.sql' }]
    : DEFAULT_JOBS;

for (const job of jobs) buildMigration(job);
