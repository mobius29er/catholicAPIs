# Local preview QA

Checked 2026-10-12. This report covers the local-only rebuild, not the live site.

## Passed: real Worker and local D1

`node scripts/local-preview.mjs --smoke` passed all 18 checks against Miniflare/workerd and the existing local D1 store (241 directory listings):

- Home and API-directory pages return populated HTML.
- `styles.css`, `clean.css`, and `app.js` load.
- Launch, maker dashboard, advertising, feedback, admin, and newsletter entry pages return populated HTML.
- Selected product detail includes the selected listing.
- Search returns the selected product.
- Free-pricing filter returns only free products.
- Live-filter endpoint returns the partial results region rather than a full page.
- Voting sets and removes the same user's vote; the listing score is restored.
- Invalid votes return HTTP 400.
- Maker mutation without CSRF returns HTTP 403.

Runtime scripts and `public/app.js` also passed `node --check`.

Maker transition/security unit tests and the project's full typecheck/test suite are owned by the main implementation work; this report does not substitute the HTTP smoke checks for them.

## Browser verification: blocked, not passed

The installed Chromium could not start inside the restricted shell process because its local IPC socket was unavailable. The runner was instead started in the supported cloud desktop terminal, successfully binding loopback port 8787 with real local D1.

The supported cloud-browser operation was then attempted:

```js
cua.createBrowserTab('cdp', 'http://127.0.0.1:8787/')
```

It returned `net::ERR_BLOCKED_BY_CLIENT`, including after one exact retry with the user's local-preview authorization. The tool did not identify the cause. Browser documentation advertises no special development-preview capability. No access restriction, network path, or browser settings were bypassed, and the preview was not exposed publicly.

Not yet verified in a browser:

- Desktop and mobile appearance, including horizontal overflow.
- JavaScript search/filter/voting interactions.
- Details/modal behavior, Escape, Back/Forward, and focus restoration.
- Maker form transitions as rendered in the browser.

No successful UI screenshots have been produced. HTTP checks establish server behavior, not visual correctness.
