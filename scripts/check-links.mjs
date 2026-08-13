#!/usr/bin/env node
// Checks every URL in data/seed.json and reports the ones that no longer answer.
//
//   node scripts/check-links.mjs
//
// A directory whose links rot is worse than no directory, so run this on a
// schedule (a GitHub Action on a cron works well) and fix or unpublish whatever
// it flags. Requires unrestricted outbound network access.
//
// Exits 1 if anything looks broken, so CI can fail on it.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SOURCES = ['data/seed.json', 'data/products.json'];

const listings = SOURCES.flatMap((source) => {
  const parsed = JSON.parse(readFileSync(resolve(root, source), 'utf8'));
  return parsed.listings ?? parsed.apis ?? [];
});

const TIMEOUT_MS = 20_000;
const CONCURRENCY = 6;

async function probe(url) {
  const attempt = async (method) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': 'catholicapis-linkcheck/1.0 (+https://catholicapis.com)' },
      });
      return { status: res.status };
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    // Plenty of hosts reject HEAD; fall back to GET before believing a failure.
    let result = await attempt('HEAD');
    if (result.status >= 400) result = await attempt('GET');
    return result;
  } catch (err) {
    return { status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

const targets = [];
for (const listing of listings) {
  for (const field of ['homepage_url', 'docs_url', 'repo_url']) {
    if (listing[field]) targets.push({ slug: listing.slug, field, url: listing[field] });
  }
}

const results = [];
let cursor = 0;
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, targets.length) }, async () => {
    while (cursor < targets.length) {
      const target = targets[cursor++];
      const result = await probe(target.url);
      results.push({ ...target, ...result });
      const mark = result.status > 0 && result.status < 400 ? 'ok  ' : 'FAIL';
      console.log(`${mark} ${String(result.status).padStart(3)} ${target.slug} ${target.field}`);
    }
  }),
);

const broken = results.filter((r) => !(r.status > 0 && r.status < 400));

console.log(`\n${targets.length - broken.length}/${targets.length} URLs OK`);

if (broken.length > 0) {
  console.log('\nNeeds attention:');
  for (const b of broken.sort((a, b2) => a.slug.localeCompare(b2.slug))) {
    console.log(`  ${b.slug} · ${b.field} · ${b.status || b.error}\n    ${b.url}`);
  }
  process.exit(1);
}
