# FidesHunt local preview

This checkout is an independent rebuild of the repository source. All preview data stays in the local SQLite/D1 store. Nothing in these instructions deploys or connects to the live Cloudflare database.

## Run

Requires Node 22+ and the dependencies installed by `npm ci`.

```sh
npx wrangler d1 migrations apply catholic-apis --local --config wrangler.local.jsonc
node scripts/local-preview.mjs
```

Open `http://127.0.0.1:8787/` in a browser on the same computer/network namespace as the process. The optional `bash scripts/local-preview.sh` wrapper locates the installed Node runtime on this task computer when Node is absent from the desktop terminal PATH.

The script runs the real Worker using Miniflare/workerd, binds only to `127.0.0.1`, and watches `src` and `public` changes. Refresh the browser after a rebuild. Restart the process after changing the preview runner itself. `LOCAL_PREVIEW_PORT` can choose another loopback port.

The local store is `.wrangler/state/v3`; migrations 0001–0008 are applied in this checkout. The migration namespace uses the configured database ID only as a local identifier. Do not add `--remote` to these commands.

## Local-only safeguards

- The runner never loads `.dev.vars`, production environment secrets, or the deployment configuration.
- External Worker fetches return a local 503. Email, payment, provider requests, and health probes cannot reach external services through this runner.
- The local maker feature is explicitly enabled. Checkout and newsletter delivery remain simulated.
- Local admin demo token: `local-preview-admin`. This is a deliberately public local-only demo value, never a production credential.
- The local-only vote signing value is equally unsuitable for production.
- No cron triggers, deployment command, public tunnel, remote D1, or live payment integration is configured.

## Verification

```sh
node scripts/local-preview.mjs --smoke
npm run typecheck
npm test
```

The smoke command starts workerd in its own process, runs 18 HTTP/D1 checks, and exits. It writes a report and rendered home HTML under `.wrangler/local-preview/`. Its vote test toggles the vote off again, restoring the listing score. It does not claim to test JavaScript, visual layout, keyboard focus, or browser history.

See `PREVIEW_QA.md` for results and remaining verification.
