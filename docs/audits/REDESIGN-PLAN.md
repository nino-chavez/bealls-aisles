# Bealls Aisles — Reconciled Redesign Plan

**Date:** 2026-05-02 (revised)
**Author:** Claude (Opus 4.7) for Nino Chavez
**Supersedes:** the eight prior audit deliverables for *execution sequencing*. The originals
remain authoritative for evidence and methodology; this doc reconciles them.

> **Verification gate (added 2026-05-02 PM).** No item in §1 is ✅ until visually
> verified on the canonical Vercel deploy (`aisles-demo-{1,2,3}-signal-x-studio-labs.vercel.app`).
> The 2026-05-02 regression — where source-truth audits claimed brand-red CTAs / wine
> brand-strip / red logo / shipping-promo strip all shipped, but the canonical deploy
> rendered none of them — is the failure mode this gate prevents. See
> [`docs/design/SYSTEM.md`](../design/SYSTEM.md) §6 for the full protocol.
>
> **Until each ✅ item is re-verified against canonical URLs, treat the §1 status table
> as "code-confirmed, render-unverified."** The new V-00 item below is the immediate
> blocker.

---

## 0. What this plan reconciles

| Audit | Date | Lens | Status of its findings |
|---|---|---|---|
| `bealls.md` / `beallsflorida.md` / `homecentric.md` | 2026-04-30 | Per-banner pattern extraction | Folded into SYNTHESIS |
| `SYNTHESIS.md` | 2026-04-30 | Cross-banner component vocabulary | Tier 1+2 mostly shipped; deferrals stand |
| `BRAND-FIDELITY-COMPARISON.md` | 2026-04-30 | Live sites vs implementation, 5 axes | All 4 ❌ items shipped |
| `UI-UX-AUDIT.md` | 2026-04-30 | Deployed demos vs originals | 2 of 4 demo-blockers shipped; 2 open |
| `visual-design-2026-05-02/CATALYST-TRANSLATION.md` | 2026-05-02 | BC Catalyst → Bealls token + primitive map | ~6 of 17 items shipped |
| `visual-design-2026-05-02/REAL-BEALLS-REFERENCE.md` | 2026-05-02 | Faithful real-Bealls reproduction (path B) | Tokens + voice shipped; cluster-row shipped; IA pivot deferred |
| `perf/cold-start-baseline-2026-05-01.md` | 2026-05-01 | AI prompt latency optimization | Surface-aware vocab shipped; home/PLP wall-clock unchanged |
| `forge-site-2026-05-01/REPORT.md` | 2026-05-01 | Methodology fit (forge-site → Bealls) | Outcome is upstream archetype proposal, not Bealls work |

The eight inputs split into three lanes:

- **Visual + brand** — fidelity, tokens, primitives, photography (BRAND-FIDELITY, UI-UX-AUDIT, CATALYST-TRANSLATION, REAL-BEALLS-REFERENCE)
- **Composition vocabulary** — schema/zones/blocks the AI engine emits (SYNTHESIS, REAL-BEALLS §4.2)
- **System / operational** — prompt latency, image CDN, methodology fit, persona detection (perf, forge-site, UI-UX-AUDIT)

This plan organizes by lane, then collapses into a single priority list (§5) and execution
sequence (§6).

---

## 1. What's actually shipped (status as of 2026-05-02)

Cross-checked against the codebase + commit log. ✅ = in main; ⚠️ = partial; ❌ = open.

### 1.1 Visual + brand

| Item | Source audit(s) | Status | Evidence |
|---|---|---|---|
| Brand red migrated to real-Bealls `#aa182c` | REAL-BEALLS §3 | ✅ | `src/lib/brand/config.ts`, commit b6d2a8b |
| Brand cranberry secondary `#7d2540` | REAL-BEALLS §3 | ✅ | `config.ts:bealls.theme.secondary` |
| Brand wine accent `#330A3D` (was pure black) | REAL-BEALLS §3 | ✅ | `config.ts:bealls.theme.accent`; BrandStripNav uses `bg-accent` |
| Beallsflorida primary `#037cc2` + coral accent `#cf4a29` | REAL-BEALLS §3 | ✅ | `config.ts:beallsflorida` |
| HC primary `#328812` (was bright `#76b82a`) | REAL-BEALLS §2.2 | ✅ | `config.ts:homecentric` |
| Public Sans (body) + Oswald (display) | REAL-BEALLS §3.2/§3.3 | ✅ | `config.ts:bealls.fontBody/fontDisplay` |
| Forge-brand kit residue killed in `app.css` | CATALYST #2 | ✅ | DM Sans / DM Serif / `#a3522d` removed |
| Voice casing rules in layout-prompt.ts | REAL-BEALLS §4.1 | ✅ | `src/lib/server/layout-prompt.ts` voice block |
| Brand-strip cross-banner nav present | BRAND-FIDELITY ❌#2, UI-UX-AUDIT | ✅ | `BrandStripNav.svelte` |
| Logo wordmark in brand red (was black) | summary | ✅ | `Nav.svelte` |
| Off-price pricing language ("Comparable value · Save X%") | BRAND-FIDELITY ❌#1 | ✅ | ProductGrid + HeroProduct templates |
| Emoji icons replaced with named SVG keys (8 components) | summary | ✅ | ServiceCalloutsGrid, AssuranceStripCheckout, fallbacks |
| Brand-red CTAs across funnel (8 components) | CATALYST #4 | ✅ | AddToCartBar, CartDrawer, PicksTray, BOPISPicker, LocatorStrip, cart, checkout (×2) |

### 1.2 Composition vocabulary

| Item | Source audit(s) | Status | Evidence |
|---|---|---|---|
| Tier 1 components — promo-strip, category-tile-grid, price-rail, product-carousel, coupon-strip | SYNTHESIS | ✅ | `src/lib/schema/blocks.ts` + sections/ |
| Tier 2 components — editorial-hero, bealls-bucks-callout, lifestyle-price-hero | SYNTHESIS | ✅ | sections/ |
| Schema extensions — category-header.heroImage + subcategories, multi-badge, showRating, category-tile-grid description | SYNTHESIS | ✅ | `blocks.ts` |
| Content-mode platform capability (HC) | SYNTHESIS | ✅ | `brand.config.ts:mode` + ContentLayoutSchema |
| Surface-aware prompt vocabulary (cart 1 / checkout 2 / pdp 6 / home/plp/empty 18) | perf | ✅ | `layout-prompt.ts` SURFACE_BLOCKS_* |
| Cluster-chip-row block + dedicated `plp.cluster-row` zone | REAL-BEALLS §4.2 | ✅ | `blocks.ts:ClusterChipRowSection`, `zones.ts`, `ClusterChipRow.svelte` |

### 1.3 System / operational

| Item | Source audit(s) | Status | Evidence |
|---|---|---|---|
| Cart-page / checkout async fixes | UI-UX-AUDIT | ✅ | resolved post-Redis migration |
| Cart line item links populated | summary | ✅ | `decorateCartSlugs` helper |
| Cart-page layout context fixed (was using homepage) | summary | ✅ | cart `+page.server.ts` |
| AI loading inline progress states | summary | ✅ | `AILoadingInline.svelte` audit pass |
| Cache kill-switch hierarchy (env / `?fresh=1` / cookie) | summary | ✅ | dev panel toggle wired |
| Observe dashboard de-gated + linked from dev toolbar | summary | ✅ | `/observe` accessible |
| `/api/session/reset` for demo baseline | summary | ✅ | commit 9d8833b |
| Demo reel v3 (5:17, new voice) | summary | ✅ | commit 1cb35a1 |

---

## 2. What's still open across all audits

Reconciled, deduplicated, and conflict-resolved. Each item lists every audit that called it
out so the rationale chain is preserved.

### 2.1 Visual + brand (open)

| ID | Item | Source(s) | Resolved approach |
|---|---|---|---|
| **V-00** | Restore `--color-primary`, `--color-secondary`, `--color-accent`, `--color-surface-*` slots in `app.css` `@theme` block | 2026-05-02 regression incident | The cleanup that removed forge-brand-kit residue also removed the slots Tailwind v4 needs to generate `bg-primary` / `text-primary` / `bg-accent` / `bg-surface-fg` etc. utilities. Without slots, classes compile to no-ops; runtime injection sets vars no rule reads. Effect: cross-brand strip, persistent shipping promo, brand-red CTAs, brand-red logo all render invisible on canonical deploy. Fix: add slots back with placeholder values per [`SYSTEM.md`](../design/SYSTEM.md) §1.2; runtime injection continues to override per banner. ~5 minute change; demo-blocking until shipped. |
| **V-01** | Photographic editorial hero on home pages (currently text-on-white) | UI-UX-AUDIT critical, REAL-BEALLS §2.4 | Add brand-shot-style lifestyle hero asset; fall back to Unsplash captioned as demo asset. The `editorial-hero` block exists; assets + AI selection are the gap. |
| **V-02** | Photographic category tiles (currently plain text "Browse →") | UI-UX-AUDIT, BRAND-FIDELITY | Curate 6-8 tile images per banner. AI vocabulary already supports `category-tile-grid` with imagery. |
| **V-03** | `Button.svelte` primitive consolidation (5 variants × 4 sizes × pill default) | CATALYST #3 | Replace ad-hoc `<button class="bg-primary ...">` instances with one primitive. Colocates hover/active/disabled state. |
| **V-04** | `PriceLabel.svelte` primitive (current off-price markup is inline per-card) | CATALYST #8 | Extract; reused by ProductGrid, CartLineItems, PDP. Reduces drift. |
| **V-05** | `Chip.svelte` primitive | CATALYST #6 | New primitive. Blocks V-06 (filter strip) until landed. |
| **V-06** | PLP filter strip + sort selector | CATALYST #6/#7, UI-UX-AUDIT (called "out of scope" originally) | **Conflict:** UI-UX-AUDIT marked filters out-of-scope as AI vocabulary; CATALYST flagged P0. Resolution: filters are a real-shopping requirement and should be foundation primitives (deterministic UI), not AI-composed. Build as `FilterStrip.svelte` + `SortSelector.svelte` foundation components consumed above the AI grid. |
| **V-07** | `ProductCard.svelte` primitive consolidation + enforced aspect ratios | CATALYST #4.2 | Currently inconsistent image dimensions across cards. Enforce 5:6 aspect via `object-cover`. |
| **V-08** | `ImageGallery.svelte` for PDP (multi-image + thumbnails) | CATALYST #11 | Render placeholder thumbnails when SKU has 1 image. |
| **V-09** | `Toast.svelte` for "Added to bag" confirmation | CATALYST #12, UI-UX-AUDIT P1 | Trigger from AddToCartBar. Substitute or augment the cart-drawer-open behavior. |
| **V-10** | Shadow scale + radius rhythm on cards | CATALYST #15/#16 | Adopt `--shadow-sm` default + `--shadow-md` hover; `rounded-xl` on product cards. |
| **V-11** | Animated underline on nav links | CATALYST #17 | Subtle motion polish. |
| **V-12** | HC content-mode Nav (drop cart/search/account icons) | BRAND-FIDELITY ❌#3 | Mode-aware Nav.svelte. Currently shows storefront chrome on a content-mode brand. |
| **V-13** | Wrong persona detection on PLPs (Gatherer chosen where Hunter expected) | UI-UX-AUDIT | Tune signal weights so returning + women-category leans Hunter. |
| **V-14** | Hero red pill CTA at large size (52-56px tall) | summary, REAL-BEALLS §2.4, CATALYST #4.1 | Lands once V-03 ships. |

### 2.2 Composition vocabulary (open)

| ID | Item | Source(s) | Resolved approach |
|---|---|---|---|
| **C-01** | HC content-mode category routes (`/c/{slug}`) render content surfaces, not PLPs | BRAND-FIDELITY ❌#4 | Route guards in `+page.server.ts` for `mode === 'content'`. |
| **C-02** | Cluster-chip-row admin authoring | REAL-BEALLS §4.2 (path 1) | Extend aisles-admin with a `Themes` tab where merchandisers curate `{ label, productIds[] }`. Schema already accepts it; UI is the gap. |
| **C-03** | AI selection of editorial-hero + product-carousel for home pages (currently static fallback) | UI-UX-AUDIT | Either trigger AI layout generation on home, OR enrich brand fallback to include editorial-hero by default. |

### 2.3 System / operational (open)

| ID | Item | Source(s) | Resolved approach |
|---|---|---|---|
| **S-01** | BC product-image CDN warm pass (~80% empty placeholders on PLPs) | UI-UX-AUDIT critical | Script that hits each `imageUrl` from seeded products to force-cache. Operational, ~30 min. |
| **S-02** | Home/PLP cold-start latency (13-14s wall-clock) | perf doc | Out of scope per perf doc — needs model selection, schema-side block taxonomy, or streaming first-paint. Not addressed in this plan. |
| **S-03** | `seo-structured-data` for retail (Product / Offer / BreadcrumbList JSON-LD) | forge-site §3 | Wire ahead of any external launch. Smallest payoff is when demo is gated; large payoff if demo is later opened. |
| **S-04** | Credential rotation for leaked secrets in commit 02b32c8 | summary | User-action item; not code. Includes Neon DATABASE_URL, Upstash token, JWT_KEY, BC client secret. |

### 2.4 Methodology / upstream

| ID | Item | Source(s) | Resolved approach |
|---|---|---|---|
| **M-01** | Forge-site `transactional-retail` archetype | forge-site §6 | Optional. If pursued, copy §6 archetype draft + stub the 6 new modules in §7. Upstream improvement, not Bealls work. |

---

## 3. Conflict log

The eight audits were authored at different times against different baselines. The conflicts
below are resolved in this plan.

| # | Conflict | Resolution |
|---|----------|------------|
| 1 | CATALYST proposed brand red `#c8102e` (HSL `351 85% 42%`); REAL-BEALLS specified `#aa182c` (HSL `351 75% 38%`) | **Real-Bealls wins.** Path B was adopted. Catalyst's recommendation was based on demo-arbitrary tokens, not live-site capture. |
| 2 | CATALYST proposed Plus Jakarta Sans + Inter; REAL-BEALLS specified Public Sans + Oswald | **Real-Bealls wins.** Path B. Live site uses mr-eaves-xl-modern (paid Adobe Typekit); Public Sans is the open-license analogue. |
| 3 | UI-UX-AUDIT marked filter rail "out of scope" as AI vocabulary; CATALYST marked it P0 | **Build as foundation primitive, not AI block.** Filters are deterministic shopping UX, not composition. They render *above* the AI grid and don't compete for prompt budget. |
| 4 | SYNTHESIS deferred cluster-chip-row as Tier 3 (`one-off pattern`); REAL-BEALLS §4.2 reframed as critical brand signature | **Real-Bealls wins.** Cluster chips are real Bealls's PLP merchandising signature, not a one-off. Already shipped. |
| 5 | UI-UX-AUDIT recommended path (b) "richer static fallback per brand" for home; Aisles' AI engine philosophy says home should be AI-composed | **Both, sequenced.** Static fallback ships first as floor; AI generation triggered on home as enhancement. C-03 captures the AI-on-home delta. |
| 6 | SYNTHESIS treated HC as content-mode (no online catalog); BRAND-FIDELITY flagged HC Nav still shows storefront chrome | Both right; chrome simply hadn't been mode-gated yet. V-12 fixes. |
| 7 | REAL-BEALLS §4.3 called search-driven IA "highest-value reconciliation finding"; called out as out-of-scope | **Defer.** Pivoting Nav.svelte + BrandStripNav.svelte + PLP entry path is a separate engagement. Document for post-demo. |

---

## 4. Out of scope (consolidated deferrals)

These appear repeatedly across audits as "Phase 7 / future / Tier 3 / out of scope." Listing
them here so they don't resurface as new findings.

| Deferral | Rationale | Captured in |
|---|---|---|
| Custom wordmark logotypes (vs text rendering for all three banners) | Phase 7 polish; not demo-blocking | BRAND-FIDELITY, UI-UX-AUDIT |
| Per-card swatch dots on apparel banners | Tier 3 — high render complexity | SYNTHESIS, BRAND-FIDELITY |
| HC tri-image collage hero | Tier 3 — one-off pattern | SYNTHESIS, BRAND-FIDELITY |
| HC mixed sans+script wordmark register | Polish; Lora is closer than original Caveat-everywhere | BRAND-FIDELITY |
| IA pivot to search-driven nav (real Bealls IA) | Significant architectural move; not demo-essential | REAL-BEALLS §4.3 |
| Email-capture modal | Out of scope for AI demo | SYNTHESIS, UI-UX-AUDIT |
| `compare-drawer` from Catalyst | Off-price family retail doesn't comparison-shop within store | CATALYST §7 |
| Catalyst's `next-intl` translation infrastructure | Single-locale demo | CATALYST §7 |
| Catalyst's `@conform-to` form library | Native SvelteKit actions sufficient | CATALYST §7 |
| Home/PLP cold-start <11s target | Requires model selection / schema taxonomy / streaming — separate sessions | perf §post-optimization |
| `clearance-rail` separate from `price-rail` | Price-rail with "Clearance" tier label sufficient | SYNTHESIS Tier 3 |
| `comparison-table` block | Bealls shoppers don't comparison-shop | SYNTHESIS Tier 3 |
| `split-promo` wrapper | Compose with two `promo-strip` instances | SYNTHESIS Tier 3 |

---

## 5. Single reconciled priority list

Across all open items (§2). Priority bands defined by demo-blocking vs polish vs strategic.

### P0 — demo-blocking (ship before any external stakeholder demo)

| ID | Item | Estimate |
|---|---|---|
| **V-00** | Restore `@theme` color slots in `app.css` (Tailwind v4 utility-generation regression) | 5 min |
| **V-01** | Photographic editorial hero on home pages (asset + AI selection / brand fallback) | 1-2 hr |
| **V-02** | Photographic category tiles (curated imagery per banner) | 1 hr × 3 banners |
| **V-12** | HC content-mode Nav (drop cart/search/account) | 30 min |
| **C-01** | HC content-mode category routes render content surfaces, not PLPs | 30 min |
| **S-01** | BC product-image CDN warm pass | 30 min |
| **V-13** | Wrong-persona detection on PLPs (Gatherer→Hunter signal tune OR `?intent=hunter` on demo URLs) | 30-60 min |

**P0 subtotal:** ~5-7 hours.

### P1 — primitives + funnel polish (next sprint after P0)

| ID | Item | Estimate |
|---|---|---|
| **V-03** | `Button.svelte` primitive — 5 variants × 4 sizes, pill default | 3 hr |
| **V-14** | Hero red pill CTA (lands as part of V-03 rollout) | included in V-03 |
| **V-04** | `PriceLabel.svelte` primitive | 2 hr |
| **V-05** | `Chip.svelte` primitive | 1 hr |
| **V-06** | PLP filter strip + sort selector (depends on V-05) | 4-6 hr |
| **V-07** | `ProductCard.svelte` primitive + enforced aspect ratios | 3 hr |
| **V-08** | `ImageGallery.svelte` for PDP | 2 hr |
| **V-09** | `Toast.svelte` for "Added to bag" | 1.5 hr |
| **C-03** | AI selection of editorial-hero/carousel on home (wired beyond static fallback) | 1-2 hr |

**P1 subtotal:** ~18-21 hours.

### P2 — trend layer + system

| ID | Item | Estimate |
|---|---|---|
| **V-10** | Shadow scale + radius rhythm | 2.5 hr |
| **V-11** | Animated underline on nav links | 1 hr |
| **S-03** | `seo-structured-data` for retail (Product/Offer/BreadcrumbList JSON-LD) | 2-3 hr |
| **C-02** | Cluster-chip-row admin authoring (Themes tab in aisles-admin) | 1 day |

**P2 subtotal:** ~10-14 hours (mostly the admin work).

### P3 — strategic / upstream

| ID | Item | Estimate |
|---|---|---|
| **M-01** | Forge-site `transactional-retail` archetype + 6 module stubs | 0.5 day if extending |
| **S-04** | Credential rotation (user action) | not code |

---

## 6. Sequenced execution

The priority list above doesn't dictate sequencing. Two constraints shape order:

1. **Foundation primitives unblock everything else.** V-03 (Button), V-05 (Chip), V-04 (PriceLabel), V-07 (ProductCard) should land before the things that consume them.
2. **Visible-on-every-page wins ship first.** Hero photography, category tiles, persona-tuning have the highest demo-impact-per-hour.

Suggested sprint shape (one focused week, post-foundation pause):

### Day 0 — restore visual baseline (~5 min, must precede everything)

- V-00 (`@theme` slot restoration in `app.css`)
- Verify all three canonical URLs render brand colors per §10 protocol
- This is a hard prerequisite — every visual fix below assumes the brand-color
  utilities actually generate. Without V-00, all other ✅ marks remain "code-confirmed,
  render-unverified."

### Day 1 — demo-blocking visual

- Morning: V-01 (hero asset + brand fallback wiring), V-02 (category tile imagery for bealls + bf)
- Afternoon: V-12 (HC content-mode Nav), C-01 (HC content-mode category routes), V-13 (persona signal tune)
- End-of-day deploy: demo materially improves on visual character + HC fidelity

### Day 2 — primitives foundation

- V-03 (Button primitive) — morning
- V-05 (Chip primitive) — afternoon, fast
- V-04 (PriceLabel primitive) — afternoon
- These three unblock V-06, V-07, V-09 on Day 3

### Day 3 — primitives + filter UX

- V-07 (ProductCard primitive + aspect ratios) — morning
- V-06 (FilterStrip + SortSelector) — afternoon
- Visible: PLP gets shopping-grade filters and consistent product cards

### Day 4 — PDP + funnel polish

- V-08 (ImageGallery)
- V-09 (Toast)
- C-03 (AI selection on home — verify behavior across all three banners)

### Day 5 — trend layer + SEO + cleanup

- V-10 (shadow scale + radius rhythm)
- V-11 (animated underline)
- S-03 (seo-structured-data) — if time
- S-01 (CDN warm pass) — automated, can run in background

### Day 6+ — admin + strategic

- C-02 (Themes tab in aisles-admin)
- M-01 (forge-site archetype) — only if extending the methodology

**Parking lot (deliberately not sequenced):**
- All §4 deferrals
- S-02 (home/PLP cold-start latency) — separate engagement
- S-04 (credential rotation) — operational, not engineering

---

## 7. Decision points

The plan above assumes three "yes" decisions. Flagging so they can be confirmed before
sprinting:

1. **Filter strip as foundation primitive (not AI block).** V-06 reframes UI-UX-AUDIT's
   "out of scope" call. Confirm direction before building. *Recommended: yes — filters are
   shopping UX, not composition.*
2. **AI generation triggered on home (vs richer static fallback only).** C-03 is the
   architecturally consistent choice but adds a cold-start to the home page. Confirm whether
   home should pay AI cost or stay deterministic. *Recommended: AI on home, with the
   existing static fallback as the floor.*
3. **Cluster-chip-row admin authoring.** C-02 is a full day of admin work. Confirm whether
   merchandiser-authored themes are demo-essential or can wait. *Recommended: defer to P2
   unless the demo storyboard specifically calls for it.*

---

## 8. What this plan deliberately doesn't address

- **Architectural changes to the Aisles engine itself** (schema validation, surface-typed
  schemas, the V invariant). The audits don't surface engine-level issues; this is a UI/UX
  redesign plan, not an engine refactor.
- **BC platform integration changes.** Catalog enrichment, cart-session-cookie replay, BC
  marketplace app behavior — all working as intended per memory + commit history.
- **Demo reel narrative rewrite.** REAL-BEALLS §7 proposes a tighter framing; the demo reel
  v3 already shipped. Re-cut is a separate decision.
- **Production hardening for an actual merchant deployment.** This is a prototype demo.
  Production-grade observability, error handling, accessibility audit, performance budgets,
  legal review of brand assets are deferred to whatever engagement productizes Aisles.

---

## 9. Bottom line

**The §1 status table reads "shipped" but is actually "code-confirmed, render-unverified."**
The 2026-05-02 incident — where source-truth audits claimed the path-B brand-color
rollout shipped, but the canonical Vercel deploy rendered every brand-tinted element
invisible — proves the source-of-truth audit is necessary but not sufficient.
**V-00 unblocks every ✅ mark in §1.** Until the `@theme` slots are restored, those
items remain unverified at render-time.

After V-00 lands and §1 is re-verified per §10, what remains is a focused 5-day
primitive-consolidation + visual-character sprint — photographic hero, category tile
imagery, button/chip/price-label/product-card primitives, filter UX, PDP polish —
followed by optional admin + strategic work.

The single biggest demo-impact-per-hour item is **V-01 (photographic hero on home)**. The
demo currently leads with text-on-white where every reference (real Bealls, Old Navy,
Nordstrom Rack, Target) leads with full-bleed lifestyle imagery. Closing that gap is the
single change that most converts the demo from "AI engine works" to "looks legitimate."

---

## 10. Verification gate protocol

Per [`docs/design/SYSTEM.md`](../design/SYSTEM.md) §6. Restated here for plan context.

**Rule:** no §1 item is ✅ until visually verified on the canonical Vercel deploy.

**Canonical URLs (the only valid audit references):**

| Banner | URL |
|---|---|
| bealls | `https://aisles-demo-1-signal-x-studio-labs.vercel.app` |
| beallsflorida | `https://aisles-demo-2-signal-x-studio-labs.vercel.app` |
| homecentric | `https://aisles-demo-3-signal-x-studio-labs.vercel.app` |

Stale Vercel aliases (e.g., `prism-mu-five.vercel.app`) are not canonical. Audits
referencing them are invalid.

**Per-change-type verification matrix:** see `SYSTEM.md` §6.2 + §7. Token / chrome
changes require all three canonical URLs verified; primitive / AI-block changes
require at least bealls canonical URL verified.

**When verification fails:** root-cause first (stale deploy? wrong env var? Tailwind
slot regression? skipped Layer 2 injection?). Don't re-mark ✅ until the gap is real
and patched.

**Documentation-only changes are exempt** from the gate.

**Known regression patterns to check first** (from `SYSTEM.md` §8):
1. `@theme` slot removal silently disables Tailwind utilities
2. Stale Vercel aliases mislead audits
3. Source-of-truth audit mistaken for visual audit
4. Forge-brand kit residue in `app.css`
