#!/usr/bin/env node
// Imports the awesome-catholic lists into data/imported.json.
//
//   node scripts/import-awesome.mjs            report only, writes nothing
//   node scripts/import-awesome.mjs --write    merge into data/imported.json
//
// Then `npm run seed:build` turns that into a migration like any other source.
//
// These lists are the curated canon; this directory is the queryable, ranked
// front end over them. Treating them as an upstream we re-read — rather than a
// one-off copy/paste — is what keeps the two from drifting apart.
//
// Licensing differs per list and is recorded in SOURCES below. servusdei2018's
// is CC0, so its text can be used freely. CatholicOS ships no licence file, so
// we take the facts (name, URL, what section it sits in), credit the list on
// every row it gave us, and treat its wording as a starting point a human
// should replace. Worth asking them to add CC0 — it would settle the question.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'data/imported.json');
const WRITE = process.argv.includes('--write');

const SOURCES = [
  {
    id: 'awesome-catholic-catholicos',
    name: 'Awesome-Catholic (CatholicOS)',
    url: 'https://github.com/CatholicOS/awesome-catholic',
    raw: 'https://raw.githubusercontent.com/CatholicOS/awesome-catholic/main/README.md',
    licence: 'none stated',
  },
  {
    id: 'awesome-catholic-servusdei',
    name: 'Awesome Catholic (servusdei2018)',
    url: 'https://github.com/servusdei2018/awesome-catholic',
    raw: 'https://raw.githubusercontent.com/servusdei2018/awesome-catholic/master/README.md',
    licence: 'CC0-1.0',
  },
];

/*
  Section → how we file it. `track` splits developer building blocks from
  finished software; `kind` only means anything on the API track.
*/
const SECTIONS = {
  apis: { track: 'api', kind: 'api', categories: ['Developer Tools'] },
  ai: { track: 'api', kind: 'api', categories: ['AI & Search'] },
  'ai-tools': { track: 'product', kind: 'api', categories: ['AI & Search'] },
  data: { track: 'api', kind: 'dataset', categories: ['Church Data'] },
  'command-line': { track: 'api', kind: 'library', categories: ['Developer Tools'] },
  'neovim-plugins': { track: 'api', kind: 'library', categories: ['Developer Tools'] },
  apps: { track: 'product', kind: 'api', categories: ['Apps'], platforms: ['desktop'] },
  'mobile-apps': { track: 'product', kind: 'api', categories: ['Apps'], platforms: ['ios', 'android'] },
  'web-apps': { track: 'product', kind: 'api', categories: ['Apps'], platforms: ['web'] },
  websites: { track: 'product', kind: 'api', categories: ['Media'], platforms: ['web'] },
  hardware: { track: 'product', kind: 'api', categories: ['Hardware'] },
  'catholic-adjacent': { track: 'product', kind: 'api', categories: ['Community'] },
  'christian-and-faith-related': { track: 'product', kind: 'api', categories: ['Community'] },
  // Everything the upstream lists have retired.
  attic: { track: 'api', kind: 'api', categories: ['Developer Tools'], deprecated: true },
  // Pointers to other lists, not projects — skipped.
  'related-awesome-lists': null,
  contents: null,
};

const slugKey = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Identity for de-duplication: a GitHub repo is owner/name, anything else its host. */
function identity(url) {
  const u = url.trim().replace(/\/+$/, '').toLowerCase();
  const gh = u.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/#?]+)/);
  if (gh) return `gh:${gh[1]}/${gh[2]}`;
  const web = u.match(/^https?:\/\/(?:www\.)?([^/]+)(\/[^?#]*)?/);
  if (!web) return u;
  // Store listings sit under a path, so keep one path segment for those.
  const path = (web[2] ?? '').split('/').filter(Boolean).slice(0, 2).join('/');
  return /apps\.apple\.com|play\.google\.com/.test(web[1]) ? `web:${web[1]}/${path}` : `web:${web[1]}`;
}

function slugify(name) {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'listing'
  );
}

/** Strip the trailing "By Someone." attribution the lists append. */
function cleanDescription(text) {
  return text
    .replace(/\s*[-–—]\s*$/, '')
    .replace(/\s+By\s+[^.]{1,40}\.?\s*$/i, '')
    .trim();
}

function parse(markdown, source) {
  const entries = [];
  let section = null;

  for (const line of markdown.split('\n')) {
    const heading = line.match(/^##+\s+(.+?)\s*$/);
    if (heading) {
      section = slugKey(heading[1]);
      continue;
    }
    if (!/^\s*[-*]\s/.test(line)) continue;

    const mapping = SECTIONS[section];
    if (!mapping) continue;

    // Badges come first on these lines; the entry is the first non-badge link.
    const links = [...line.matchAll(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)]
      .map((m) => [m[1], m[2]])
      .filter(([, url]) => !url.includes('shields.io') && !url.includes('img.shields'));
    if (links.length === 0) continue;

    const [name, url] = links[0];
    if (!name.trim()) continue;

    const after = line.slice(line.indexOf(`](${url})`) + url.length + 3);
    const description = cleanDescription(after.replace(/^\s*[-–—]\s*/, ''));

    entries.push({
      source,
      section,
      mapping,
      name: name.trim(),
      url,
      description,
      identity: identity(url),
    });
  }

  return entries;
}

async function fetchList(source) {
  const response = await fetch(source.raw, {
    headers: { 'user-agent': 'catholicapis-import/1.0 (+https://catholicapis.com)' },
  });
  if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
  return parse(await response.text(), source);
}

// ---------------------------------------------------------------- existing --

const existing = [];
for (const file of ['data/seed.json', 'data/products.json', 'data/imported.json']) {
  const path = resolve(root, file);
  if (!existsSync(path)) continue;
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  for (const listing of parsed.listings ?? parsed.apis ?? []) {
    existing.push({ file, ...listing });
  }
}

const known = new Map();
for (const listing of existing) {
  for (const field of ['homepage_url', 'repo_url']) {
    if (listing[field]) known.set(identity(listing[field]), listing);
  }
}
const usedSlugs = new Set(existing.map((l) => l.slug));

// ------------------------------------------------------------------- run ---

const all = (await Promise.all(SOURCES.map(fetchList))).flat();

// First list to mention something wins; later lists only add attribution.
const merged = new Map();
for (const entry of all) {
  const seen = merged.get(entry.identity);
  if (!seen) {
    merged.set(entry.identity, {
      ...entry,
      alsoIn: [],
      retiredBy: entry.mapping.deprecated ? [entry.source.name] : [],
    });
  } else {
    if (!seen.description && entry.description) seen.description = entry.description;
    // A live listing in either list outranks an Attic entry in the other — but
    // the disagreement is worth keeping, not discarding. One list retiring
    // something the other still carries is precisely the signal a reader wants.
    if (entry.mapping.deprecated) seen.retiredBy.push(entry.source.name);
    if (seen.mapping.deprecated && !entry.mapping.deprecated) {
      seen.mapping = entry.mapping;
      seen.section = entry.section;
    }
    seen.alsoIn.push(entry.source.id);
  }
}

const additions = [];
const retired = [];

for (const entry of merged.values()) {
  const match = known.get(entry.identity);

  if (match) {
    // Already listed. The one thing worth importing is a retirement notice.
    if (entry.retiredBy.length > 0 && !match.deprecated) {
      retired.push({
        slug: match.slug,
        name: match.name,
        file: match.file,
        sources: entry.retiredBy,
        alsoLive: !entry.mapping.deprecated,
      });
    }
    continue;
  }

  let slug = slugify(entry.name);
  for (let n = 2; usedSlugs.has(slug); n++) slug = `${slugify(entry.name)}-${n}`;
  usedSlugs.add(slug);

  const isRepo = entry.identity.startsWith('gh:');

  additions.push({
    slug,
    name: entry.name,
    tagline: (entry.description || `${entry.name}, from the awesome-catholic list.`).slice(0, 160),
    description: '',
    homepage_url: entry.url,
    docs_url: null,
    repo_url: isRepo ? entry.url : null,
    kind: entry.mapping.kind,
    track: entry.mapping.track,
    platforms: entry.mapping.platforms ?? [],
    launched_at: null,
    // Everything below is genuinely unknown until someone checks. Guessing
    // "free" because a project is on GitHub is exactly the kind of confident
    // wrong answer this directory is supposed to avoid.
    // Imported rows carry the schema's required `pricing`, but nobody has
    // checked it. For a public repo "free" is safe; for a hosted service it is
    // a guess, and the note says so rather than letting the badge imply
    // knowledge we do not have.
    pricing: 'free',
    pricing_note: isRepo
      ? 'Open-source repository. Hosting or commercial terms not checked.'
      : 'Cost not yet verified.',
    open_source: isRepo ? 1 : 0,
    license: null,
    auth: 'unknown',
    cors: 'unknown',
    official: 0,
    categories: entry.mapping.categories,
    languages: [],
    deprecated: entry.retiredBy.length > 0 && entry.mapping.deprecated ? 1 : 0,
    deprecated_note:
      entry.retiredBy.length > 0
        ? `Retired by ${entry.retiredBy.join(' and ')}${
            entry.mapping.deprecated ? '' : ', though still listed elsewhere'
          }.`
        : null,
    source: entry.source.name,
    source_url: entry.source.url,
  });
}

// ---------------------------------------------------------------- report ---

const bySection = additions.reduce((acc, a) => {
  const key = `${a.track}/${a.kind}${a.deprecated ? ' (deprecated)' : ''}`;
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

console.log(`Upstream entries after merge: ${merged.size}`);
console.log(`Already in the directory:     ${merged.size - additions.length}`);
console.log(`New:                          ${additions.length}`);
for (const [key, count] of Object.entries(bySection).sort()) {
  console.log(`   ${String(count).padStart(4)}  ${key}`);
}

if (retired.length > 0) {
  console.log(`\nListings of ours an upstream list has retired (${retired.length}):`);
  for (const r of retired) {
    const also = r.alsoLive ? ' (still live in the other list)' : '';
    console.log(`   ${r.slug} — per ${r.sources.join(', ')}${also}  [${r.file}]`);
  }
  console.log('   Set "deprecated": 1 and a "deprecated_note" on these.');
}

if (!WRITE) {
  console.log('\nReport only. Re-run with --write to merge into data/imported.json.');
  process.exit(0);
}

const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { listings: [] };
const listings = [...(previous.listings ?? []), ...additions].sort((a, b) =>
  a.slug.localeCompare(b.slug),
);

writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      $comment: [
        'GENERATED by scripts/import-awesome.mjs — but safe to hand-edit.',
        'Re-running the importer appends only listings it has not seen before,',
        'so corrections made here survive.',
        '',
        'Every entry carries the list it came from in `source`, which the site',
        'renders as a credit on the listing itself.',
        '',
        'pricing/auth/cors/languages are placeholders on these rows. They were',
        'imported as facts (name, URL, section), not as verified metadata, and',
        'verified_at stays null until a human checks.',
      ],
      sources: SOURCES.map(({ id, name, url, licence }) => ({ id, name, url, licence })),
      listings,
    },
    null,
    2,
  )}\n`,
);

console.log(`\nWrote ${listings.length} listings to data/imported.json`);
console.log('Next: npm run seed:build');
