#!/usr/bin/env node
/*
  Imports the Catholic Digital Commons Foundation's own projects.

  The CDCF publishes under the CatholicOS GitHub organisation — the same org
  behind the awesome-catholic list we already import. That list catalogues
  *other people's* work; this brings in the foundation's first-party projects,
  which are mostly not on it: a family of canonical-identifier data
  repositories for the things Catholic software keeps having to re-key by hand
  (dioceses, popes, councils, Doctors, liturgical books, magisterial
  documents), plus the APIs and tools built on them.

  Why a manifest rather than "list the org's repos":

    Classification is a judgement call — which track, which kind, which
    categories — exactly as it was for the awesome lists' section headings.
    No API returns that. What the script *can* do is verify the manifest
    against reality, and it does: every repo is probed, its default branch
    resolved, its licence read off the repository, and a missing or renamed
    repo is a loud failure rather than a silently stale row.

  Three kinds of repo in the org are deliberately left out, and the script
  records why in `EXCLUDED` so the decision is reviewable rather than implicit:
  forks (the upstream deserves the listing, not the mirror), the foundation's
  own governance and infrastructure, and repositories whose README says they
  are still a brainstorm.
*/

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'data/cdcf.json');
const WRITE = process.argv.includes('--write');

const ORG = 'CatholicOS';

const SOURCE = {
  name: 'Catholic Digital Commons Foundation',
  url: 'https://github.com/CatholicOS',
  site: 'https://catholicdigitalcommons.org/',
};

/* --------------------------------------------------------------- manifest -- */

/*
  Taglines and descriptions are written from each repository's own README.
  `repo` is the only field the script trusts itself to verify; everything else
  is curation, and is meant to be edited by hand as these projects mature.
*/
const MANIFEST = [
  // ------------------------------------------------------------ APIs and tools
  {
    repo: 'martyrology-api',
    name: 'Roman Martyrology API',
    tagline: 'The eulogies of the Roman Martyrology for any liturgical day.',
    description:
      "Serves the elogia of the Martyrologium Romanum — the short notices read for the saints and blesseds commemorated on each day — keyed to the canonical identifiers in CRMEDR. Built as a companion to the Liturgical Calendar API, so the two answer 'what is celebrated today' and 'what does the Martyrology say about it' with the same identifiers. The copyrighted edition texts stay in a private repository; what is public is the API and the identifier scheme.",
    track: 'api',
    kind: 'api',
    categories: ['Saints', 'Liturgical Calendar'],
    languages: ['la', 'en'],
    auth: 'unknown',
  },
  {
    repo: 'liturgical-calendar-mcp',
    name: 'Liturgical Calendar MCP Server',
    tagline: 'Lets an AI agent query the Roman Catholic liturgical calendar.',
    description:
      "A Model Context Protocol server in front of the Liturgical Calendar API, exposing liturgical dates, seasons, feasts, saints and rankings as a structured toolset for any MCP client — so an assistant can answer 'what colour are the vestments on the third Sunday of Advent 2027?' by calling a tool instead of guessing, which unaided models reliably do badly.",
    track: 'api',
    kind: 'mcp',
    categories: ['Liturgical Calendar', 'AI & Search', 'Developer Tools'],
    languages: ['en'],
    auth: 'none',
  },
  {
    repo: 'ontokit-api',
    name: 'OntoKit API',
    tagline: 'Collaborative OWL ontology curation, as a FastAPI service.',
    description:
      'A Python service for curating OWL ontologies collaboratively, published on PyPI as `ontokit`. It is the machinery behind the foundation\'s semantic work rather than a Catholic dataset in itself, but it is the piece you would reuse if you were modelling any structured body of doctrine or church data.',
    track: 'api',
    kind: 'api',
    categories: ['Developer Tools', 'AI & Search'],
    languages: ['en'],
    auth: 'unknown',
  },
  {
    repo: 'mediawiki-extensions-SemanticSearch',
    name: 'SemanticSearch for MediaWiki',
    tagline: 'Hybrid keyword and semantic search for MediaWiki — early scaffold.',
    description:
      "Adds sentence-transformer embeddings alongside CirrusSearch's BM25 keyword retrieval and rank-fuses the two, using OpenSearch k-NN. Its own README calls the current release a scaffold, so treat it as a project to watch rather than one to deploy — but the approach is the right one for searching a wiki of magisterial texts, where the wording a reader knows is rarely the wording on the page.",
    track: 'api',
    kind: 'library',
    categories: ['AI & Search', 'Developer Tools'],
    languages: ['en'],
    auth: 'none',
  },

  // ------------------------------------------- canonical identifier registries
  /*
    The heart of the foundation's technical programme, and the reason it is
    worth listing repository by repository rather than as one entry: each is a
    separate registry with its own identifier scheme, and a developer needs the
    specific one. They exist because every Catholic project otherwise invents
    its own keys for the same fixed sets of things, and then cannot exchange
    data with any other project.
  */
  {
    repo: 'cecdr',
    name: 'CECDR — Ecclesiastical Circumscriptions',
    tagline: 'Canonical IDs for every diocese, eparchy and prelature.',
    description:
      'The Common Ecclesiastical Circumscription Data Repository: stable identifiers for the circumscriptions of the Catholic Church — Latin dioceses and archdioceses, Eastern eparchies, archeparchies and exarchates, territorial prelatures and abbacies, apostolic vicariates and prefectures, military and personal ordinariates, personal prelatures and missions. If you have ever tried to join two datasets on diocese name, this is the thing that was missing.',
    track: 'api',
    kind: 'dataset',
    categories: ['Church Data'],
    languages: ['la', 'en'],
  },
  {
    repo: 'cesidr',
    name: 'CESIDR — Churches sui iuris',
    tagline: 'Canonical IDs for the 24 Churches sui iuris.',
    description:
      'The Common Ecclesiae Sui Iuris Data Repository: identifiers for the Latin Church and the 23 Eastern Catholic Churches, across the six liturgical traditions — Latin, Byzantine, Alexandrian, Antiochene, Chaldean and Armenian. Small, fixed, and exactly the sort of list every application re-types slightly differently.',
    track: 'api',
    kind: 'dataset',
    categories: ['Church Data'],
    languages: ['la', 'en'],
  },
  {
    repo: 'crpdr',
    name: 'CRPDR — Roman Pontiffs',
    tagline: 'Canonical IDs for the popes, from Peter to the reigning pope.',
    description:
      'The Common Roman Pontiff Data Repository. Papal lists are a classic source of quiet disagreement — regnal numbering, antipopes, disputed dates — so a shared identifier set matters more here than the size of the data suggests.',
    track: 'api',
    kind: 'dataset',
    categories: ['Church Data'],
    languages: ['la', 'en'],
  },
  {
    repo: 'coecdr',
    name: 'COECDR — Ecumenical Councils',
    tagline: 'Canonical IDs for the 21 ecumenical councils.',
    description:
      'The Common Oecumenical Council Data Repository: identifiers for the councils the Catholic Church recognises as ecumenical, from Nicaea I to Vatican II.',
    track: 'api',
    kind: 'dataset',
    categories: ['Church Data'],
    languages: ['la', 'en'],
  },
  {
    repo: 'cdoctdr',
    name: 'CDOCTDR — Doctors of the Church',
    tagline: 'Canonical IDs for the 38 Doctors of the Church.',
    description:
      'The Common Doctors of the Church Data Repository: stable identifiers for the Doctors, from the four great Latin and Greek Fathers to the most recent declarations.',
    track: 'api',
    kind: 'dataset',
    categories: ['Church Data', 'Saints'],
    languages: ['la', 'en'],
  },
  {
    repo: 'cmddr',
    name: 'CMDDR — Magisterial Documents',
    tagline: 'Canonical IDs for magisterial and papal documents.',
    description:
      'The Common Magisterial Document Data Repository: identifiers for encyclicals, exhortations, constitutions, papal speeches and homilies, with semantic distinctions between the document types — which is the part that makes citation across projects possible.',
    track: 'api',
    kind: 'dataset',
    categories: ['Church Documents', 'Church Data'],
    languages: ['la', 'en'],
  },
  {
    repo: 'clbdr',
    name: 'CLBDR — Liturgical Books',
    tagline: 'Canonical IDs for the liturgical books of the Roman Rite and their editions.',
    description:
      'The Common Liturgical Books Data Repository: each book — Missal, Lectionary, Liturgy of the Hours, Martyrology, the Pontifical and Ritual ordines, the Book of Blessings, the Ceremonial of Bishops — as a book identity, with its Latin typical editions and approved vernacular editions underneath. Supersedes the per-book registries the foundation started with.',
    track: 'api',
    kind: 'dataset',
    categories: ['Liturgy', 'Church Data'],
    languages: ['la', 'en'],
  },
  {
    repo: 'cledr',
    name: 'CLEDR — Liturgical Events',
    tagline: 'Canonical IDs for the celebrations of the Roman Missal.',
    description:
      'The Common Liturgical Events Data Repository: identifiers for the celebrations defined by the Roman Missal editio typica, across both the Temporale and the Sanctorale. The natural key to join a calendar API to a lectionary, a martyrology or a set of propers.',
    track: 'api',
    kind: 'dataset',
    categories: ['Liturgical Calendar', 'Church Data'],
    languages: ['la', 'en'],
  },
  {
    repo: 'crmedr',
    name: 'CRMEDR — Martyrology Eulogies',
    tagline: 'Canonical IDs for the eulogies of the Roman Martyrology.',
    description:
      'The Common Roman Martyrology Eulogy Data Repository: identifiers for the elogia of the Martyrologium Romanum, and thereby for the saints, blesseds and commemorations they are addressed to. The registry is public; the copyrighted edition texts are not.',
    track: 'api',
    kind: 'dataset',
    categories: ['Saints', 'Church Data'],
    languages: ['la', 'en'],
  },
  {
    repo: 'ciclsaldr',
    name: 'CICLSALDR — Consecrated Life',
    tagline: 'Canonical IDs for religious orders, congregations and societies.',
    description:
      'The Common Institutes of Consecrated Life and Societies of Apostolic Life Data Repository: identifiers for religious and monastic orders, congregations, secular institutes and societies of apostolic life, grouped into the religious families they belong to.',
    track: 'api',
    kind: 'dataset',
    categories: ['Church Data'],
    languages: ['la', 'en'],
  },
  {
    repo: 'ontology-semantic-canon',
    name: 'Catholic Semantic Canon',
    tagline: 'A formal ontology of Scripture, Tradition and the Magisterium.',
    description:
      'Models the Deposit of Faith as a machine-readable structure: not a bibliography but a map of how the sources relate in authority, chronology and theological weight. The formal backbone the identifier registries hang from.',
    track: 'api',
    kind: 'dataset',
    categories: ['Catechism & Doctrine', 'Church Data'],
    languages: ['la', 'en'],
  },
  {
    repo: 'crmetdr',
    name: 'CRMETDR — Roman Missal Editions',
    tagline: 'Canonical IDs for the editions of the Latin Roman Missal.',
    description:
      'Proposed identifiers for the Missal edition line, 1474–2008. Its work was carried into the CLBDR, which covers every liturgical book of the Roman Rite rather than one, and this repository was archived.',
    track: 'api',
    kind: 'dataset',
    categories: ['Liturgy', 'Church Data'],
    languages: ['la', 'en'],
    deprecated: 1,
    deprecated_note:
      'Archived by its maintainers and absorbed into CLBDR, the Common Liturgical Books Data Repository, which covers all the books of the Roman Rite. Use CLBDR for new work; everything here was carried over.',
  },

  // -------------------------------------------------------------- finished apps
  {
    repo: 'outwardsign',
    name: 'Outward Sign',
    tagline: 'Plan, communicate and celebrate sacraments in a parish.',
    description:
      'A sacrament and sacramental management tool for Catholic parishes: preparing, scheduling and running baptisms, marriages, confirmations and the rest, with the paperwork and the people kept in one place. Free and open source, aimed at parishes that cannot buy a diocesan platform.',
    track: 'product',
    platforms: ['web', 'parish'],
    categories: ['Parish Tools'],
    languages: ['en'],
  },
  {
    repo: 'ontokit-web',
    name: 'OntoKit Web',
    tagline: 'Browser front end for collaborative ontology curation.',
    description:
      'The Next.js interface to the OntoKit API — where the curation of the foundation\'s ontologies actually happens. Of interest mainly if you are contributing to that work rather than consuming it.',
    track: 'product',
    platforms: ['web'],
    categories: ['Developer Tools', 'Church Data'],
    languages: ['en'],
  },
  {
    repo: 'martyrology-frontend',
    name: 'Martyrology Curation Frontend',
    tagline: 'Review tool for the Roman Martyrology identifier pipeline.',
    description:
      'Lets a curator compare how a canonical eulogy ID is placed across Martyrology editions and accept, reject or edit proposed corrections against the live text. It holds no copyrighted text itself — everything it shows comes from the public CRMEDR registry or the API at request time.',
    track: 'product',
    platforms: ['web'],
    categories: ['Church Data'],
    languages: ['la', 'en'],
  },
];

/*
  Left out on purpose. Kept in the file because "why isn't X here?" is a real
  question a reviewer will ask, and an answer in code beats an answer in
  someone's memory.
*/
const EXCLUDED = {
  'liturgical-calendar-api':
    'Mirror of Liturgical-Calendar/LiturgicalCalendarAPI. The upstream is listed instead; a fork should not take the credit.',
  cardinals:
    'Fork of ChrisVo/cardinals — the data is fetched from the upstream releases page.',
  'foundation-aggregator':
    'Its README describes a brainstorming area for ideas, not software you can use.',
  'foundation-docs': 'Foundation governance, not a software listing.',
  'foundation-bylaws': 'Foundation governance, not a software listing.',
  'foundation-manifesto': 'Foundation governance, not a software listing.',
  'foundation-logo': 'Brand assets.',
  'cdcf-website': "The foundation's own website.",
  'cdcf-infra': 'Internal deployment infrastructure.',
  'awesome-catholic': 'Imported as a source in its own right by import-awesome.mjs.',
  '.github': 'Organisation profile.',
};

/* ------------------------------------------------------------- verification -- */

const BRANCHES = ['main', 'master'];

async function head(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

/** Resolves a repo's default branch by finding which one serves its README. */
async function resolveBranch(repo) {
  for (const branch of BRANCHES) {
    const res = await head(`https://raw.githubusercontent.com/${ORG}/${repo}/${branch}/README.md`);
    if (res) return { branch, readme: await res.text() };
  }
  return { branch: null, readme: null };
}

const LICENCES = [
  [/MIT License/i, 'MIT'],
  [/Apache License\s*\n?\s*Version 2\.0/i, 'Apache-2.0'],
  [/GNU AFFERO GENERAL PUBLIC LICENSE/i, 'AGPL-3.0'],
  [/GNU LESSER GENERAL PUBLIC LICENSE/i, 'LGPL-3.0'],
  [/GNU GENERAL PUBLIC LICENSE/i, 'GPL-3.0'],
  [/BSD 3-Clause/i, 'BSD-3-Clause'],
  [/Creative Commons Legal Code\s*\n?\s*CC0/i, 'CC0-1.0'],
  [/Attribution 4\.0 International/i, 'CC-BY-4.0'],
  [/Attribution-ShareAlike 4\.0/i, 'CC-BY-SA-4.0'],
  [/The Unlicense/i, 'Unlicense'],
];

/** Reads the licence off the repository rather than guessing from the README. */
async function detectLicence(repo, branch) {
  for (const file of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING']) {
    const res = await head(`https://raw.githubusercontent.com/${ORG}/${repo}/${branch}/${file}`);
    if (!res) continue;
    const text = (await res.text()).slice(0, 4000);
    for (const [pattern, name] of LICENCES) if (pattern.test(text)) return name;
    return 'other';
  }
  return null;
}

/*
  Slugs default to the repository name rather than the display name. The
  registries are titled "CECDR — Ecclesiastical Circumscriptions" for a reader,
  which would slugify into something nobody would type, and the acronym is what
  these projects are actually called in conversation.
*/
const slugFor = (entry) => entry.slug ?? entry.repo.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/* --------------------------------------------------------------------- run -- */

console.log(`Verifying ${MANIFEST.length} repositories in the ${ORG} organisation…\n`);

const listings = [];
const problems = [];

for (const entry of MANIFEST) {
  const { branch, readme } = await resolveBranch(entry.repo);

  if (!branch) {
    problems.push(`${entry.repo}: no README on any of ${BRANCHES.join(', ')} — renamed or removed?`);
    continue;
  }

  const licence = await detectLicence(entry.repo, branch);
  const repoUrl = `https://github.com/${ORG}/${entry.repo}`;

  /*
    An archived repository states it at the top of its own README. Trusting
    that beats trusting the manifest, which is a snapshot of the day it was
    written — and it means a project archived next month gets flagged the next
    time anyone runs this.
  */
  const readmeSaysArchived = /this repository (has been|is) (archived|absorbed)|⚠️.*archived|— superseded by/i.test(
    readme.slice(0, 800),
  );
  const deprecated = entry.deprecated === 1 || readmeSaysArchived ? 1 : 0;

  if (readmeSaysArchived && entry.deprecated !== 1) {
    problems.push(`${entry.repo}: README says archived but the manifest does not — flagged anyway.`);
  }

  listings.push({
    slug: slugFor(entry),
    name: entry.name,
    tagline: entry.tagline,
    description: entry.description,
    homepage_url: repoUrl,
    docs_url: null,
    repo_url: repoUrl,
    kind: entry.kind ?? 'api',
    track: entry.track,
    platforms: entry.platforms ?? [],
    pricing: 'free',
    pricing_note: 'Open source; self-hosted or run from the repository.',
    open_source: 1,
    license: licence,
    auth: entry.auth ?? 'none',
    cors: 'unknown',
    // The foundation publishes these itself, so they are official in the sense
    // the directory means it: the body that owns the work is the publisher.
    official: 1,
    categories: entry.categories,
    languages: entry.languages,
    deprecated,
    deprecated_note: deprecated === 1 ? (entry.deprecated_note ?? null) : null,
    source: SOURCE.name,
    source_url: SOURCE.url,
  });

  const flags = [branch, licence ?? 'no licence', deprecated ? 'DEPRECATED' : ''].filter(Boolean);
  console.log(`  ${entry.repo.padEnd(36)} ${flags.join(' · ')}`);
}

console.log(`\n${listings.length} listings (${listings.filter((l) => l.deprecated).length} deprecated)`);
console.log(`${Object.keys(EXCLUDED).length} repositories excluded on purpose`);

if (problems.length) {
  console.log('\nProblems:');
  for (const p of problems) console.log(`  ! ${p}`);
}

// Guard against a listing colliding with one we already have.
const existing = new Set();
for (const file of ['data/seed.json', 'data/products.json', 'data/imported.json']) {
  try {
    const parsed = JSON.parse(readFileSync(resolve(root, file), 'utf8'));
    for (const item of parsed.apis ?? parsed.products ?? parsed.listings ?? []) {
      existing.add(item.slug);
      if (item.repo_url) existing.add(item.repo_url.toLowerCase().replace(/\/+$/, ''));
    }
  } catch {
    /* a source file we have not written yet is not an error */
  }
}

const clashes = listings.filter(
  (l) => existing.has(l.slug) || existing.has(l.repo_url.toLowerCase()),
);
if (clashes.length) {
  console.log(`\nAlready in the directory, skipping: ${clashes.map((c) => c.slug).join(', ')}`);
}
const fresh = listings.filter((l) => !clashes.includes(l));

if (!WRITE) {
  console.log('\nDry run. Pass --write to update data/cdcf.json.');
} else {
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        $comment:
          `First-party projects of the ${SOURCE.name}, published under the ${ORG} GitHub ` +
          `organisation (${SOURCE.site}). Generated by scripts/import-cdcf.mjs — classification ` +
          `is curated in that script's MANIFEST; branch, licence and archived status are read ` +
          `from the repositories themselves. Edit the script, not this file.`,
        source: SOURCE,
        excluded: EXCLUDED,
        listings: fresh,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`\nWrote ${fresh.length} listings to data/cdcf.json`);
}
