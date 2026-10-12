#!/usr/bin/env node
/** Fully local Worker/D1 preview. Does not load production credentials or deploy. */
import { watch } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { context } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const port = Number(process.env.LOCAL_PREVIEW_PORT || 8787);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local preview port');
const origin = `http://127.0.0.1:${port}`;
const buildPath = resolve(root, '.wrangler/local-preview/worker.mjs');
await mkdir(dirname(buildPath), { recursive: true });
let runtime;
let closing = false;
let updates = Promise.resolve();
const options = () => convertV4MiniflareOptions({
  name: 'fideshunt-local-preview',
  host: '127.0.0.1', port, inspectorHost: '127.0.0.1', inspectorPort: 0,
  compatibilityDate: '2026-08-13', compatibilityFlags: ['nodejs_compat'],
  modules: true, scriptPath: buildPath,
  cf: false, logRequests: false, telemetry: { enabled: false },
  resourcePersistencePath: resolve(root, '.wrangler/state/v3'),
  d1Databases: { DB: '6b3c70bd-3424-4627-bc20-a6cc449f2848' },
  bindings: {
    SITE_URL: origin, SITE_NAME: 'FidesHunt', LOCAL_PREVIEW: '1',
    LOCAL_ADMIN_TOKEN: 'local-preview-admin', VOTE_SECRET: 'local-preview-only-not-a-production-secret',
  },
  assets: {
    directory: resolve(root, 'public'), binding: 'ASSETS',
    routerConfig: { has_user_worker: true },
    assetConfig: { not_found_handling: 'none' },
  },
  // No provider calls, email, payment, health probes, or production network requests.
  outboundService: () => new Response('External requests are disabled in local preview.', { status: 503 }),
});
function reload() {
  if (!runtime || closing) return;
  updates = updates.then(async () => {
    if (closing) return;
    await runtime.setOptions(options());
    console.log(`[preview] Updated ${new Date().toISOString()}`);
  }).catch(error => console.error('[preview] Reload failed:', error));
}
const bundler = await context({
  entryPoints: ['src/index.tsx'], outfile: buildPath,
  bundle: true, format: 'esm', platform: 'neutral', target: 'es2022',
  conditions: ['workerd', 'worker', 'browser'], sourcemap: 'inline',
  logLevel: 'info', plugins: [{ name: 'local-preview-reload', setup(build) {
    build.onEnd(result => { if (!result.errors.length) reload(); });
  } }],
});
await bundler.rebuild();
runtime = new Miniflare(options());
await runtime.ready;
const database = await runtime.getD1Database('DB');
const check = await database.prepare('SELECT COUNT(*) AS count FROM apis').first();
console.log(`[preview] ${origin} (${check.count} directory listings; local D1 only)`);
let timer;
let assetWatcher;
if (!process.argv.includes('--smoke')) {
  await bundler.watch();
  assetWatcher = watch(resolve(root, 'public'), { recursive: true }, () => {
    clearTimeout(timer); timer = setTimeout(reload, 100);
  });
}
async function close() {
  if (closing) return;
  closing = true;
  clearTimeout(timer); assetWatcher?.close();
  await bundler.dispose(); await updates; await runtime.dispose();
}
export { runtime, database, origin, close };
if (process.argv.includes('--smoke')) {
  try {
    const { runSmoke } = await import('./local-preview-smoke.mjs');
    await runSmoke(runtime, database, origin);
  } catch (error) {
    console.error(error); process.exitCode = 1;
  } finally { await close(); }
}
process.once('SIGINT', close);
process.once('SIGTERM', close);
