# FidesHunt — adversarial UI/UX review

**Date:** 2026-08-14
**Reviewed:** `main` @ `13f25c6`, plus the live deploy at fideshunt.com
**Scope:** directory surface (home, `/apis`, filters, rows, rail, masthead, footer), with a lighter pass over the detail page. Submit/about/admin not audited in depth.
**Method:** source read of [styles.css](public/styles.css), [components.tsx](src/views/components.tsx), [home.tsx](src/views/home.tsx), [layout.tsx](src/views/layout.tsx), [app.js](public/app.js) + fetched and parsed the live HTML for `/` and `/?pricing=free`. Numbers below are measured from the stylesheet and rendered DOM unless marked *estimated*.

---

## Status: all six phases implemented

The findings below are the original review, kept as the record of what was wrong. Everything in §8 has since been built. Measured after:

| Signal | Before | After |
|---|---|---|
| Distinct `font-size` values | 43 | **9 tokens** (+ 2 display `clamp()`s and one `em`) |
| Distinct spacing values | 49 | **11 tokens** (+ hairline `1/2/3px` and `em`-relative) |
| Breakpoints | 12 | **4** (640, 900, 1080, 1240) |
| `border-radius` values | 5 + a 6th in SVG | **3 tokens** + `50%` |
| `!important` | 6 | **2** (both the reduced-motion overrides) |
| Palette declarations | 3 duplicated blocks | **1**, via `light-dark()` |
| WCAG AA failures listed in §4 | 7 | **0** |
| Filter pushdown | ~600px | **0** — anchored popover |
| Hero on a filtered URL | deleted | **kept** |

### Where the mockup overruled the review

The mockup settled the open question in §8, and in two places contradicted what I recommended. The mockup won:

- **Rows stay cards.** They are cards in the mockup. What the mockup does *not* have is the `.feed` panel wrapped around them — so the fix was to delete the outer surface, not the row borders. That removes one of the three nesting levels and leaves the mockup's own two.
- **The slogans stay.** §7 argued for cutting two of the four. The mockup has three of them (caption box, angled stamp, footer burst), so all three stayed. Only the hero's fourth voice was left alone.
- **The filter row goes entirely.** The mockup's control row is a heading and one `Today ▾` menu — no filter button, no track pills, no count. So the track pills were dropped (the masthead nav already switches tracks), the count moved into the applied-filter row, and filters became a second menu matching the sort menu's treatment.
- **The rail newsletter panel is newsprint.** It is the one inverted panel in the mockup and the only thing stopping the rail from being three identical dark boxes. It kept the treatment; the content is still RSS + JSON, because there is no mailing list to sign up to.

### Deliberately not done

- **`styles-v1.css` / `styles-v2.css` still ship.** [layout.tsx](src/views/layout.tsx) has a comment saying earlier design directions are kept there on purpose. Deleting 3,700 lines of someone's kept design history is not my call — say the word and they go.

---

## Verdict

The site is not amateur because of any one bad decision. It is amateur because **there is no design system underneath it** — every value in the stylesheet was chosen locally, by eye, for the component being written at that moment. The measured evidence:

| Signal | This codebase | Best-in-class |
|---|---|---|
| Distinct `font-size` values | **43** (30 of them between 0.55rem and 1.06rem) | 6–9 steps |
| Distinct spacing values | **49** | 6–10 (4/8px scale) |
| Distinct breakpoints | **12** (380, 520, 560, 620, 640, 720, 880, 900, 980, 1080, 1100, 1240) | 4–5, named |
| Distinct `border-radius` values | **5** (4px, 8px, 12px, 50%, 999px) + a 6th baked into the SVG logo tile | 3 |
| Accent hues carrying meaning | **4** (amber, orange, teal, green) + 6 topic colors + 16 logo gradient stops | 1–2 + semantic status |
| `!important` | 6 | 0 |

Thirty type sizes inside a half-rem band is the single loudest tell. When `0.82rem`, `0.84rem`, `0.85rem`, `0.86rem`, and `0.875rem` all appear on the same screen, the eye reads *noise*, not *hierarchy* — it cannot tell which of five near-identical sizes is meant to be more important, so it concludes none of them are. That is the difference between your render and the mockup. A mockup is internally consistent by construction; a hand-tuned stylesheet is not.

Everything in §2 below is downstream of that. The filter problem in §1 is separate and worse.

---

## 1. The filter system (P0 — this is the complaint, and it's worse than described)

### What actually happens

[components.tsx:444](src/views/components.tsx#L444) renders the filter as a `<details>` **inline in the normal document flow**, inside `.feed-controls` — a `flex-wrap` row that sits directly above the list ([home.tsx:120-129](src/views/home.tsx#L120-L129)).

The live page ships **27 facet options across 5 fieldsets** (Cost 3, Platform 5, Category 10, Language 8, Quick 1) into `.filter-body`, a `repeat(auto-fit, minmax(160px, 1fr))` grid ([styles.css:877](public/styles.css#L877)).

At a 1320px viewport the filter gets ~660px of row width → auto-fit resolves to **3 columns → 2 grid rows**. Tallest column in row 1 is Category (10 options × ~30px + legend ≈ 321px); row 2 is Language (8 × ~30px + legend ≈ 261px); plus 21.6px gap, 36.8px padding, 9.6px margin.

> **Opening the filter pushes the entire listing block down by roughly 600–650px.** *(estimated from the measured option count and the stylesheet's own metrics — more than a full screen of list, instantly, with no animation.)*

### Then it gets worse — the cascade

Four separate discontinuities fire on a **single** filter click:

1. **The hero disappears.** [home.tsx:56-65](src/views/home.tsx#L56-L65) gates the hero on `isLanding`, which is false the moment any filter is set. Verified live: `/` has `<section class="hero">`, `/?pricing=free` has none. The first filter click deletes ~400px of page above the list.
2. **Full page navigation.** Every facet is an `<a href>` ([components.tsx:396](src/views/components.tsx#L396)). The browser discards scroll position and lands you at the top of a page that no longer looks like the one you left.
3. **The panel re-opens on arrival.** `open={activeCount > 0}` ([components.tsx:444](src/views/components.tsx#L444)) — verified live, `/?pricing=free` renders `<details class="filter" open="">`. So you land at the top, with the 600px panel expanded, and the list starts ~700px down.
4. **The count wraps.** `.filter` is a flex item whose `max-content` width is the full grid; opening it consumes the row and forces `.feed-count` (`margin-left: auto`) onto a new line — a second, independent shift.

So: click "Free" → page reloads → hero gone → scrolled to top → filter panel open → list 700px below the fold. Repeat for every refinement. That is the "ridiculous" the complaint is pointing at, and it is four compounding problems, not one.

### Two more things wrong with it

**The counts lie.** [db.ts:236-245](src/db.ts#L236-L245) computes facet counts *before* any facet filter is applied. The comment argues this avoids "a dead end of zeroes" — but the actual consequence is that with `Free` selected, `iOS (33)` still claims 33 when the intersection might be 4. The user clicks a number and gets a different number. The correct pattern is **disjunctive faceting**: count each group with *all other groups'* filters applied (the group's own filter excluded). That gives honest, non-zero, non-dead-end counts. This is what Algolia/Elasticsearch facet APIs do by default; it is the industry-standard answer to exactly the problem that comment is trying to solve.

**Selected state is invisible to assistive tech.** The `✓` is `aria-hidden="true"` ([components.tsx:400](src/views/components.tsx#L400)); `is-on` adds only color and font-weight. A screen reader announces "link, Free 125" whether it is on or off. There is no `aria-pressed`, no `aria-current`, no visually-hidden state text. The filter is unusable non-visually.

### The fix

Structural, in order of impact:

1. **Take the panel out of flow.** Two valid patterns:
   - **Persistent left facet rail** (Amazon, Airbnb, Algolia demos, Vercel templates). Nothing ever expands; nothing ever shifts. Costs horizontal space, so it pairs with dropping the right rail to a narrower column or below the fold.
   - **Anchored popover** — `position: absolute` off the summary button. Zero layout shift by construction. Keep the `<details>` for the no-JS path but absolutely position `.filter-body`; add `<details>`-native `::backdrop`-free dismissal via a click-outside handler.
   My recommendation: **left rail on ≥1080px, bottom sheet below it.** A directory's whole value proposition is refinement; hiding the refinement controls behind a disclosure on the primary surface is fighting your own product.
2. **Never remove the hero as a side effect.** Either keep it, or replace it with a fixed-height filtered-results header so the swap is a content change, not a 400px collapse.
3. **Applied-filter chips in a reserved-height row** directly above the list — each with an `×`. Reserve the row height with `min-height` so adding the first chip does not shift. This is the piece that makes multi-facet filtering legible; right now the only way to see what's applied is to open the 600px panel.
4. **Stop full-page-navigating.** 241 listings is nothing. Either fetch-and-swap the `<ol class="listings">` with `history.pushState` (keeps scroll, keeps the hero, no flash), or ship the whole dataset and filter client-side. Keep the `<a href>`s exactly as they are for no-JS and SEO — intercept them in [app.js](public/app.js). This is a ~40-line progressive enhancement and it removes discontinuities 2, 3, and 4 at once.
5. **Real checkbox semantics** — `role="checkbox"` + `aria-checked`, or actual `<input type=checkbox>` in a GET form with a submit fallback.
6. **Disjunctive facet counts** in [db.ts](src/db.ts).

---

## 2. No design system (P0 — the root cause of "looks amateur")

### Type

43 sizes. The band from `0.55rem` (**8.8px**) to `1.06rem` contains 30 of them. Two further problems:

- **`body { font-size: 15px }`** ([styles.css:190](public/styles.css#L190)) while every other size is `rem` — which resolves against `html`'s 16px. So `0.9rem` is 14.4px, *not* 90% of your body text. The scale has no relationship to its own base. Every ratio in the stylesheet is accidental.
- **`0.55rem` = 8.8px and `0.58rem` = 9.28px** are below any legibility floor (Apple HIG: 11pt; Material: 12sp). `.brand-text small` — your tagline, in the masthead — is 9.28px uppercase with 0.13em tracking.

**Fix:** a 7-step scale on tokens, and set `html { font-size: 100% }` / `body { font-size: 1rem }` so rem means what it says.

```css
--text-2xs: 0.6875rem; /* 11px — absolute floor, labels only */
--text-xs:  0.75rem;   /* 12px */
--text-sm:  0.875rem;  /* 14px */
--text-md:  1rem;      /* 16px — body */
--text-lg:  1.125rem;
--text-xl:  1.5rem;
--text-2xl: 2rem;
/* display sizes stay on clamp() */
```
Then delete all 43 literals. Expect the page to look 60% more "designed" from this change alone.

### Spacing

49 values, including `0.26rem`, `0.28rem`, `0.52rem`, `1.15rem`, `1.35rem`. Nothing lands on a grid, so nothing optically aligns with anything else — the reason the page reads as "close but off" next to the mockup.

**Fix:** an 8px scale with a 4px half-step. `--space-1: 0.25rem` … `--space-10: 5rem`. Six of the 49 values survive; the rest snap.

### Radius

`4px` (kbd, code, vote-btn, facet-check), `8px`, `12px`, `50%`, `999px` — plus the logo tile's `rx="12"` on a 48-unit viewBox rendered at 66px, i.e. an **effective 16.5px radius sitting inside a 12px-radius row**. A rounder child inside a squarer parent is one of the most reliable visual tells of unsystematic design.

**Fix:** `--r-sm: 6px`, `--r-md: 10px`, `--r-full: 999px`. Set the logo tile's `rx` so its *rendered* radius equals `--r-sm`.

### Color

Four accent hues all carry semantic load simultaneously:

- **amber** — links, primary button, active sort, active track pill, hero caption, focus ring, toast, spotlight border, *and* the "freemium" price
- **orange** — brand mark, every vote box, rank #1, filter badge, deprecated stamp, active nav underline, footer burst, *and* the "paid" price
- **teal** — pills, tags, credit links, *and* the "official" badge
- **green** — "free" price, upvoted state, revive button

Plus 6 hardcoded topic-icon colors and 8 logo gradient pairs. **49 hardcoded hex values in the stylesheet.** On first paint you can see 12+ distinct hues. Amber means six unrelated things; orange means seven.

**Fix:** one accent (amber) for interaction only. One semantic ramp (success/warn/danger) for status only. Teal and green stop being decorative. Pricing becomes a neutral label with weight, not a third color axis. Route the topic and logo colors through a single generated ramp derived from the accent so they read as one family.

---

## 3. Hierarchy and layout

**Boxes inside boxes inside boxes.** `.feed` is a bordered, rounded `--panel` card. Inside it, each of 24 `.row`s is *another* bordered, rounded card on a *darker* `--sunken` fill. Inside each row, `.vote` is a *third* bordered, rounded box. That is triple nesting, 24 times, plus 4 more `.rail-panel` cards. First paint carries **~30 bordered rounded rectangles**.

Product Hunt, Linear, and Vercel all render dense lists as **one surface with hairline dividers**, elevation appearing only on hover. Card-per-row is what a list looks like before someone edits it.

**Three focal points per row, all fighting.** `.row-rank-number` at 2.3rem Anton, the 66px gradient logo tile, and an 88×86px orange-bordered vote box — none subordinate to the others, so the eye has no entry point and scans nothing. Compounding it, `.row:hover .vote` brightens the vote box when you hover *anywhere* on the row ([styles.css:1295](public/styles.css#L1295)), implying the whole row votes. It doesn't.

**The row isn't clickable.** The only route to a listing is the `1.06rem` name link ([components.tsx:297](src/views/components.tsx#L297)) — the logo is `aria-hidden` with `tabindex={-1}`. In a leaderboard, the row *is* the target. Straight Fitts's-law cost on the primary action of the entire site.

**Information is deleted, not reflowed.** Below 1240px `.row-by` is `display: none` ([styles.css:1249](public/styles.css#L1249)) — publisher, price, and health dot all vanish rather than moving into the body column. Every laptop at 1280px logical width is one step from losing three fields.

**Three magic numbers for one header.** `min-height: 72px` (masthead), `top: 92px` (sticky rail), `scroll-margin-top: 80px` (`#listings`). Should be one `--masthead-h`. Consequence: at 880–1080px the masthead wraps to two rows (~104px *estimated*) while `scroll-margin-top` stays 80px, so the "Explore top listings" CTA parks the feed heading **under** the sticky header.

**The hero's `text-shadow: 0 2px 26px rgb(0 0 0 / 45%)`** ([styles.css:621](public/styles.css#L621)) on display type muddies the letterforms. The `.hero-art::after` gradient scrim already separates headline from art; the shadow is doing nothing but softening your sharpest typographic asset.

---

## 4. Accessibility — measured failures

**Contrast.** `--faint` fails WCAG AA everywhere it is used, in both themes:

| Pair | Ratio | Needs | Used for |
|---|---|---|---|
| `--faint` on `--panel` (dark) | **3.41** | 4.5 | facet counts, footer titles, hints, spec labels |
| `--faint` on `--sunken` (dark) | **3.61** | 4.5 | `.row-by small`, breadcrumb |
| `--faint` on `--bg` (dark) | **3.72** | 4.5 | masthead tagline (at 9.28px) |
| `--faint` on `--panel` (light) | **3.31** | 4.5 | same |
| `--faint` on `--bg` (light) | **2.95** | 4.5 | same |
| `.vote-down` arrow on its box (dark) | **1.75** | 3.0 | **the downvote control** |
| `.pill` teal on `--sunken` (light) | **4.22** | 4.5 | category pills |

Every one of these is at 0.6–0.86rem, so the large-text exemption never applies. `--muted` is fine (6.04 / 5.95). **The downvote arrow at 1.75:1 is functionally invisible** — it's `color-mix(orange 45%, transparent)` ([styles.css:1318](public/styles.css#L1318)).

Also: `.is-disabled { opacity: 0.3 }` on pagination renders "Previous" at roughly 2:1 against its own background.

**Broken ARIA.** `.sorts` is `role="tablist"` with four `role="tab"` links, no `tabpanel`, no `aria-controls` ([components.tsx:343-356](src/views/components.tsx#L343-L356)). Screen readers announce "tab, 1 of 4" and expose arrow-key navigation that does not exist. These are links to URLs — mark them up as links in a `<nav>` with `aria-current`.

**Filter state not announced.** Covered in §1.

**Rank hidden from AT.** `.row-rank` is `aria-hidden="true"`, taking `rankNote` ("#1 most recommended") with it. The `<ol>` conveys ordinal position, but the editorial note is lost.

**Touch targets** (Apple 44×44, Material 48×48):

| Element | Height *(estimated)* |
|---|---|
| `.facet-option` | ~30px |
| `.theme-toggle` | 34px |
| `.tracks a` / `.filter-summary` | ~37px |
| `.vote-btn` | ~22px |

All fail. The vote buttons are the worst — a ~22px tap target for the primary interaction.

---

## 5. Mobile

**There is no search below 1100px.** `.masthead-search { display: none }` ([styles.css:508-512](public/styles.css#L508-L512)) and there is no other search input anywhere — confirmed: the only `name="q"` field in the codebase is [layout.tsx:142](src/views/layout.tsx#L142). On a phone or tablet, the primary discovery mechanism of a 241-item directory is simply absent. Nothing else in this review outranks this.

**The right rail lands below 24 rows.** At ≤1080px `.rail` goes static and stacks after the feed — so Spotlight, Trending topics, and the RSS panel appear after the reader has scrolled a full page of listings. Trending topics is a navigation aid; on mobile it is placed where nobody will reach it.

**The filter panel is worst on mobile.** Single-column auto-fit → all 27 options stack → *estimated* 900px+ of pushdown on a 700px viewport.

---

## 6. Defects found

| # | Defect | Location |
|---|---|---|
| 1 | **Dead live-search.** `app.js` binds `getElementById('q')`, but the input is `id="masthead-q"`. The debounced search-as-you-type has never run. | [app.js:163](public/app.js#L163) vs [layout.tsx:141](src/views/layout.tsx#L141) |
| 2 | **Duplicate DOM id.** Spotlight renders `LogoMark` for `listings[0]` — the same listing as row 1 — producing two `id="mark-<slug>"` gradients. Verified live: `mark-ascension` appears twice. Invalid HTML; the second `url(#…)` silently resolves to the first. | [art.tsx:47](src/views/art.tsx#L47), [home.tsx:176](src/views/home.tsx#L176) |
| 3 | **Rank color follows DOM position, not rank.** `.row:first-child .row-rank-number { color: var(--orange) }` paints rank 25 orange on page 2. | [styles.css:1009](public/styles.css#L1009) |
| 4 | **"See all" is a no-op.** Trending topics links to `buildQuery(filters, { page: 1 })` — the page you are already on. | [components.tsx:595](src/views/components.tsx#L595) |
| 5 | **Breadcrumb can emit an empty filter link.** With no categories, it renders `?category=` labelled "Listing". | [detail.tsx:78](src/views/detail.tsx#L78) |
| 6 | **Inconsistent clear-filters.** The empty state omits `auth: []`; the panel's clear includes it. | [home.tsx:140-150](src/views/home.tsx#L140-L150) vs [components.tsx:543](src/views/components.tsx#L543) |
| 7 | **`.detail-head` never wraps.** `display: flex` with a 92px `min-width` vote box and no `flex-wrap` or media query — the h1 gets crushed on narrow screens. | [styles.css:1760](public/styles.css#L1760) |
| 8 | **Webfont CLS.** Anton is `font-display: swap` with no `size-adjust`/`ascent-override` fallback face. On any platform without Haettenschweiler/Impact the fallback resolves to `ui-sans-serif` — far wider — so the h1, all 24 rank numbers, and all 24 vote scores reflow on font load. Preloading reduces but does not remove this. | [styles.css:8-16](public/styles.css#L8-L16) |
| 9 | **Two dead stylesheets deployed.** `styles-v1.css` (1866 lines) and `styles-v2.css` (1819 lines) ship as public assets. | [public/](public/) |
| 10 | **6× `!important`** in `.row-price`/`.price-*`, fighting `.row-by small`. | [styles.css:1100-1111](public/styles.css#L1100-L1111) |

---

## 7. Content and IA

**Spotlight duplicates row 1.** `<Spotlight listing={result.listings[0]} />` ([home.tsx:176](src/views/home.tsx#L176)) — on the default sort, the rail's featured item is the same listing sitting inches to its left at rank 1. It reads as a rendering bug. Make it a genuinely different pick (highest-velocity, editor's choice, recently revived, random from the top decile).

**Four slogans on one screen.** "New is worth finding." (caption box) · "Good work deserves users." (angled stamp) · "Vote honestly." (footer burst) · plus the hero sub. Each is a separate typographic device in a separate color. The mockup's noir-poster idea works when it appears *once*, as an accent. Four times, it's a ransom note. Keep the caption box; cut the stamp and the burst.

**The rail duplicates the footer.** "Stay in the loop" offers RSS + JSON API; the footer's Developers column offers JSON API + RSS + Submit. Same two links, 200px apart vertically.

**Redundant labels.** The heading says "Top products" while the adjacent active sort says "Top rated." Two different phrasings of the same fact, side by side.

**Pagination is prev/next only** at `PAGE_SIZE = 24` — 136 products = 6 pages with no way to jump. For a leaderboard, either numbered pages or "load more" is expected; prev/next makes the tail of the list effectively unreachable.

---

## 8. Fix plan, sequenced

Each phase is independently shippable and independently visible.

**Phase 1 — tokens (highest ratio of visual gain to risk).**
Add type, space, and radius scales as custom properties; replace all 43 font sizes, 49 spacings, and 5 radii. Fix `body` to `1rem`. Collapse the palette to one accent + a semantic status ramp. Raise `--faint` until it clears 4.5:1 in both themes, and raise `.vote-down` past 3:1. Purely mechanical, no markup changes, and it is the change that closes most of the gap to the mockup.

**Phase 2 — the filter.**
Move it out of flow (left rail ≥1080px, bottom sheet below). Add applied-filter chips in a reserved-height row. Stop deleting the hero. Add real checkbox semantics. Switch [db.ts](src/db.ts) to disjunctive counts.

**Phase 3 — the row.**
De-nest: one surface, hairline dividers, hover elevation. Pick one focal point (the name) and subordinate the rank, logo, and vote box to it. Make the whole row clickable. Reflow `.row-by` at ≤1240px instead of hiding it. Enlarge the vote buttons to ≥44px.

**Phase 4 — mobile.**
Restore search below 1100px. Move Trending topics above the feed on small screens. Consolidate the 12 breakpoints to 4 named tokens.

**Phase 5 — defects.**
Everything in §6. Each is a few lines.

**Phase 6 — content.**
Give Spotlight a distinct pick. Cut two of the four slogans. Merge the rail feed panel into the footer. Add numbered pagination.

### One thing to decide first

> **Answered by the mockup.** It is card-per-row, and it has no left facet rail — so the rows kept their borders, the `.feed` panel around them was deleted, and the filter became an anchored popover rather than a rail. See *Where the mockup overruled the review* at the top.

---

## What still isn't verified

No browser automation was available, so nothing here was measured in a real render:

- The ~600px pushdown figure and the touch-target heights are computed from the stylesheet's own metrics.
- The popover, the chip row and the swap-in-place behaviour were verified by fetching and parsing the rendered HTML from a local `wrangler dev` — the markup is confirmed correct (hero present on filtered URLs, no `open` on the filter, 27 `role="checkbox"` options, partial fragment carrying fresh facets, `is-top` only on rank 1, zero duplicate DOM ids). **What no one has done yet is look at it.** Worth a pass at 375px, 900px, 1280px and 1440px in both themes before this goes out.
- `light-dark()` is Baseline 2024 (Chrome 123, Safari 17.5, Firefox 120). Anything older gets the light palette regardless of theme. That is a deliberate trade for deleting two duplicated palette blocks — the ones that had already caused the light theme to keep a failing `--faint`.
