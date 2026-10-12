# Local preview QA

Verified 2026-10-12 against the local-only rebuild at `http://localhost:8787/`. No deployment, remote database, real charge, or email delivery occurred.

## Browser results

The supported cloud Chromium browser loaded the real Worker/D1 app. Final desktop viewport: **1181 × 757 CSS pixels**. Compact checks also ran at **500 × 757** and **400 × 606 CSS pixels**. The 400-pixel check used a normal 500-pixel desktop window at 125% browser zoom; this is responsive CSS coverage, not mobile-device or touch emulation.

Passed:

- Desktop, 500-pixel, and 400-pixel pages fit the viewport with no horizontal document overflow. At 400 pixels, both document `scrollWidth` and `clientWidth` were 388 pixels, accounting for the scrollbar.
- Search for Hallow returns exactly one product on desktop and compact layouts.
- Upvote toggles 0 → 1 → 0 and reflects the selected state.
- Product detail opens the correct Hallow page; Back returns to the Hallow search.
- Filters open, the free-price option updates the URL and result set, and Escape closes the menu and returns focus to its summary.
- Clearing search returns the full directory. The follow-on Hallow → Clear all → Recently added regression also passed: the final URL is `/?sort=new`, with no stale query and all 136 products.
- The maker launch flow completed in the browser: synthetic local draft → explicitly simulated $29 checkout → launch date 2026-10-20 → dashboard. Reload preserved the scheduled record.
- Back twice and reload preserved the completed schedule; the checkout action was no longer shown.
- Beginning another form, then leaving with Back before saving, created no extra draft. The dashboard still contained exactly one saved QA launch at that point.
- The final compact launch form was rechecked after its layout changed: all visible fields and the save action fit the desktop viewport, and submitting those fields saved a second synthetic draft successfully.

Final screenshots (viewport captures, not tall full-page renders):

- `fideshunt-desktop-final.jpg`: desktop directory with the final headline and subtitle.
- `fideshunt-mobile-final.jpg`: 400-pixel responsive directory.
- `fideshunt-launch-final.jpg`: final compact maker launch form, visible save action, and explicit simulated-checkout pricing disclosure.

The image files are in the task output directory, separate from the source repository.

## Real Worker and D1 integration

`node scripts/local-preview.mjs --smoke` passed all **18 checks**, using Miniflare/workerd and local D1 with 241 directory listings:

- Home and API-directory pages return populated HTML.
- `styles.css`, `clean.css`, and `app.js` load.
- Launch, maker dashboard, advertising, feedback, admin, and newsletter entry pages return populated HTML.
- Selected product detail includes the selected listing.
- Search returns the selected product.
- Free-pricing filter returns only free products.
- Live-filter endpoint returns the partial results region rather than a full page.
- Voting sets and removes the same user's vote, restoring the listing score.
- Invalid votes return HTTP 400.
- Maker mutation without CSRF returns HTTP 403.

Runtime scripts and `public/app.js` passed `node --check`. The complete suite passed **152 tests across 7 files**, both TypeScript configurations passed, and seed migrations matched the source data. This includes 15 SQLite-backed maker/security tests and 8 layout/navigation regression tests. The HTTP smoke checks are additional coverage, not a replacement.

## Scope and limits

- Detail uses normal page navigation; there is no product-detail modal in this version.
- Exact 1440 × 1000 capture, touch interaction, and device emulation were not tested. Browser DevTools is organization-disabled and was not bypassed.
- The supported browser required the `localhost` hostname. The numeric loopback URL produced an unclassified client block; no tunnel or external exposure was used.
- Browser console entries came from the browser's own extension metadata reporting, not the app's JavaScript.
- Two clearly named synthetic QA records remain in the local preview account: `Local preview QA`, scheduled for 2026-10-20, and `Local preview QA compact form`, a draft. Neither can publish automatically.
