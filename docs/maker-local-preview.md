# Maker workflows: local test contract

These routes are intentionally available only with `LOCAL_PREVIEW=1` (or `true`) **and** a loopback request hostname. They use only the local D1 tables from `0008_local_maker.sql`. No payment, email, external publishing, or production credential is used.

## Pages

- `/maker`: local maker dashboard, launches and ad request status
- `/launch`: draft form, followed by `/maker/launch/:id` for test checkout and scheduling
- `/advertise`: monthly inventory, request form and labeled approved placement previews
- `/feedback`: free invite-only beta gate or feedback community
- `/feedback/:id`: structured reviews, useful marking and closure
- `/maker/newsletter`: explicit local opt-in
- `/maker/admin`: separate local admin login and queue tabs

The local runtime config supplies a test-only `LOCAL_ADMIN_TOKEN` of at least 16 characters. It is submitted in a CSRF-protected form, never a URL. Production `ADMIN_TOKEN` is not accepted here. Admin sessions last one hour; normal local sessions last seven days. Ending the local session destroys its server token. This preview has no account recovery, email login or persistent real-world identity.

Opening a form creates random browser cookies but no account. The first draft, ad request or beta access request creates a local account. The account ID is shown under “Local session” in the maker footer. Different browser profiles/cookie jars create distinct local makers. An admin sees the local accounts in Beta access, invites a requested account, and the member accepts the invitation in their original browser. Invitations expire after seven days. Revocation blocks content reads and writes immediately.

## State and scope

- Launch: `draft → paid_mock → scheduled`. The simulated amount is **USD 29**. Billing cadence is undecided. Scheduling records a shared UTC plan for the directory listing and newsletter feature from today through 180 days; it never creates or publishes a live listing or sends an email. Checkout replay cannot duplicate a receipt or rewind a scheduled launch.
- Manual help: editorial and video requests are optional, unique per launch, and reviewed by a local admin. Availability, inclusion, pricing and delivery timing are not promised.
- Ads: monthly directory/newsletter inventory defaults to one slot per placement. Requests do not reserve inventory. Admin approval atomically checks capacity. Prices are unset, with no subscriptions or charges. Approval is only a local test record.
- Sponsor clicks: `/maker/ad-click/:id` GET shows a sponsor handoff; POST records an idempotent placement click then redirects to the validated active destination. `/maker/advertise/:id/click` records a test click without leaving the preview. Neither route touches organic votes.
- Newsletter: explicit consent inserts one case-insensitive email into `queued_mock`. There is no send implementation or remote provider.
- Feedback: free access only. Invited members can create focused requests, add one structured review to another maker’s open request, report a review, and read beta-visible feedback. Owners alone mark reviews useful and close requests with a summary. Admins can hide requests/reviews and resolve reports. Revocation removes access without erasing feedback records. No paid club or membership is implemented.

## Directory integration

`listActiveAds(env, 'sidebar')` from `src/maker-db.ts` returns this UTC month’s approved local ads. `makerCsrf(c)` from `src/maker.tsx` supplies a CSRF cookie/token for a sponsor form. Post to `/maker/ad-click/:id` with `csrf` and a fresh UUID `action_key`. Always visibly label the card “Sponsored.” Keep it separate from ranked rows.

## Validation

`npm test -- test/maker.test.ts` runs actual SQLite constraints behind a D1 adapter. It covers origin/CSRF enforcement, local gates, session/admin isolation and expiry, ownership, safe URLs/dates, concurrent first-save idempotency, duplicate checkout/action behavior, inventory capacity, click deduplication, opt-in consent, invite acceptance/revocation, review/useful/closure rules, and report moderation. No network access is used by these tests.

## Original design contract

The original directory CSS, Anton font, FH mark, noir illustration, listing components, and light/dark behavior are preserved. Maker screens inherit those tokens and use only scoped styles in `public/maker.css`. `test/design.test.ts` pins the original assets and guards the public rendering. Live identity, payment, email delivery, pricing decisions and release approval remain separate prerequisites.
