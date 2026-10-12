# Original noir restoration QA

Verified 2026-10-12 against the original `main` baseline `16e132aec083b5f08d6668b89fd6b9546dd6d702` and the corrected local feature branch. No deployment, remote database, real charge, or email delivery occurred.

## Original identity

Before changing the feature branch, the unchanged original was rendered at `http://localhost:8788/` using its own local D1 copy. Both light and dark views were inspected and captured. The corrected branch runs at `http://localhost:8787/`.

- Original `public/styles.css`, favicon, Anton font file, illustration source, and listing components are byte-for-byte preserved. Tests pin their SHA-256 values to prevent another accidental replacement.
- Original hero copy, city/detective illustration, angled stamp, FH roundel, publisher attribution, spotlight, topic rail, RSS card, footer, and light/dark toggle are restored.
- Maker features use additive `public/maker.css`, scoped to new feature elements and referencing original tokens. There are no replacement global colors, typography resets, or overrides to directory components.
- The only preview navigation additions are Maker tools in the existing masthead and footer. One quiet Local preview badge appears when explicitly enabled on loopback. Production rendering excludes the badge, maker stylesheet and feature links.

## Local checks

- `npm test`: **160 tests across 7 files passed**, including 15 visual-identity/rendering regressions and 16 SQLite-backed maker/security tests.
- `npm run typecheck`: both application and test TypeScript configurations passed.
- `npm run preview:smoke`: **18 real Worker/D1 HTTP checks passed**, including populated directory and maker routes, assets, detail, search, filtering, partial responses, vote toggling and CSRF rejection.
- `node --check public/app.js`, `scripts/local-preview.mjs`, and `scripts/local-preview-smoke.mjs` passed.
- Seed generation was rerun and existing source migrations remained unchanged.
- `git diff --check` passed.

Remote CI is intentionally skipped by the `[skip ci]` commit prefix to avoid automatic Cloudflare builds. Local checks are not a remote CI pass.

## Browser checks

Supported cloud Chromium, real Worker + local D1:

- Original-versus-corrected dark homepage at **1180 × 757 CSS pixels**, with the same font, colors, layout, and content. Native screenshot output is 1165 × 747 pixels.
- Light toggle changes to the original newsprint palette and persists through reload; dark toggle restores the original noir palette and persists through reload.
- Desktop search for Hallow returns one row. Upvote toggles 0 → 1 → 0. Detail opens Hallow, and Back restores the query.
- Freemium filtering updates the URL and checkbox state. Escape closes the filter menu and returns focus to its summary.
- Hallow → Clear all → Newest ends at `/?sort=new`, with 24 rows on page one and no stale query.
- API navigation retains the original API hero and 105 local API listings.
- Launch draft → explicit simulated $29 checkout → 2026-10-22 shared listing/newsletter schedule succeeds. Reload and Back cannot restore the checkout action. Optional editorial review request persists.
- Monthly advertising request appears in maker tools with state `requested` and zero test clicks. No inventory is booked or charged.
- Explicit newsletter consent saves a mock opt-in and confirms that no email was sent.
- Free beta access request stays gated pending a local invitation.
- **500 × 757** and **400 × 606** CSS-pixel layouts fit with no horizontal document overflow. The 400-pixel check is a normal window at 125% browser zoom, not mobile-device or touch emulation.
- Original and corrected homepages were captured at the same 400-pixel width and dark theme. Phone-width search, keyboard voting, detail navigation and Back passed. The vote was removed afterward.
- Leaving an unsubmitted phone-width launch form with Back creates no draft.

## Screenshots

Separate task artifacts, outside the source repository:

- `fideshunt-original-noir.jpg` and `fideshunt-original-light.jpg`: unchanged original baseline before coding.
- `fideshunt-restored-noir-desktop.jpg`: corrected homepage in original noir style.
- `fideshunt-restored-noir-launch.jpg`: new launch feature using original design tokens, at 1267 × 844 CSS pixels.
- `fideshunt-original-noir-mobile.jpg` and `fideshunt-restored-noir-mobile.jpg`: original/corrected phone-width comparison.

## Limits before going live

This remains a local-only preview. Real authentication/account recovery, billing and billing cadence, live publishing, newsletter sending, ad prices, and operational review/approval are not implemented. Launch date records a shared directory/newsletter plan, not delivery. No production configuration or deploy workflow was changed.

Synthetic records from local browser QA remain only in the preview database, including `Noir restoration QA`, `Noir ad QA`, one example-domain newsletter opt-in, and a beta access request. They do not publish automatically.
