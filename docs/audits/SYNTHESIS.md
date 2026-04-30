# Phase 1 Synthesis — Cross-Banner Audit Findings

**Date**: 2026-04-30
**Inputs**: `docs/audits/bealls.md`, `docs/audits/beallsflorida.md`, `docs/audits/homecentric.md`
**Purpose**: Reconcile the three banner audits against the frozen Tier 1+2 component scope. Capture deltas without modifying frozen estimates (per dual-baseline discipline).

---

## Headline findings

1. **HomeCentric is brick-and-mortar only.** No e-commerce site exists. The demo strategy for that banner shifts from *mirror existing* to *synthesize from sister-banner catalog* — and this is actually the **strongest sales narrative of the three**.
2. **The Tier 1 + 2 component hypothesis was directionally right but mis-named one component.** What we called `editorial-lookbook` (multi-product hotspots) is actually `editorial-hero` (text-overlay on imagery). Cheaper to build (~0.5 day vs 1.5 day).
3. **Two new components are required that weren't in the plan.** `product-carousel` and `coupon-strip`. Both confirmed across multiple banners.
4. **Several schema extensions are needed on existing components** (rather than new components). These are cheap (~0.1–0.25 day each).

## Cross-banner pattern matrix

| Pattern | bealls.com | beallsflorida.com | homecentric.com | Component decision |
|---|---|---|---|---|
| Persistent shipping promo strip | ✅ | ✅ | ❌ (no shipping) | Keep `promo-strip` — Tier 1 |
| Email-capture modal | ✅ (5% off) | ❌ | ❌ | Out of layout vocab — global UX pattern |
| Brand-strip nav (3 banners) | ✅ | ✅ | ✅ | Static page chrome, not AI vocab. Implement in `Nav.svelte`. |
| Photographic hero (no overlay text) | ✅ | — | — | `hero-image` (rename of/extension to existing) |
| **Editorial hero with text overlay** | — | ✅ ("FLORIDA IS A *feeling*") | partial ("Get INSPIRED") | **`editorial-hero`** (rename from planned `editorial-lookbook`) |
| Tri-image collage hero | — | — | ✅ | Defer; static one-off |
| **Price-tier 2-up tiles** ("under $25 / $50") | ✅ | ✅ | — | **`price-rail`** with 2-up tile mode (refines from horizontal scroll only) |
| Themed category-tile-grid | ✅ (4-up, 5-up) | ✅ (4-up) | ✅ (2-up, 3-up with descriptions) | **`category-tile-grid`** + new `description` and `columns: 2|3|4|5` schema |
| Best Sellers product carousel | ✅ | ✅ | — | **NEW: `product-carousel`** — Tier 1 add |
| Customers Also Purchased carousel (PDP) | ✅ | ✅ | — (no PDP) | Same `product-carousel` |
| Lifestyle-price hero ("starting at $19.99") | ✅ | — | — | **`lifestyle-price-hero`** — Tier 2 add (only justified on bealls.com) |
| **Personalized coupon strip** | — | ✅ ($10 off PDP) | — | **NEW: `coupon-strip`** — Tier 1 add |
| Bealls Rewards / loyalty callout | ✅ | ✅ | ✅ | Keep `bealls-bucks-callout` — Tier 2 |
| Split promo (rewards + gift card row) | ✅ | ✅ | ✅ | Compose with two `promo-strip` instances; don't build a new component |
| 4-col dense PLP grid (sale badges, add-to-bag) | ✅ | — | — | Existing `product-grid` |
| 3-col editorial PLP grid (swatch dots, add-to-bag) | — | ✅ | — | Existing `product-grid` (different prop config) |
| PLP top hero banner (with category title overlay) | — | ✅ | — | **Schema extension to `category-header`**: optional `heroImage` |
| Sub-category nav strip (text-link row above grid) | — | ✅ | — | **Schema extension to `category-header`**: optional `subcategories[]` |
| Multi-badge stacking (e.g., "New" + "Deal") | — | ✅ | — | **Schema update**: `badges: Array` instead of single |
| Per-card star rating | — | ✅ | — | **Schema addition**: `showRating: boolean` on `product-grid` / `product-carousel` |
| Coupon-pricing language ("Comparable value", "You save X%") | ✅ | ✅ | — | Catalog data shape, not UI — already supported by `salePrice` field |

---

## Final Tier 1 + 2 component list (revised by audit)

### Tier 1 — confirmed required, all three banners benefit (5 components)

| Component | Originally planned? | Cost (human / agent) |
|---|---|---|
| `promo-strip` | ✅ Yes | 0.5 d / 0.15 d |
| `category-tile-grid` (with description, 2–5 cols) | ✅ Yes | 0.75 d / 0.25 d (small schema bump) |
| `price-rail` (2-up tile mode + scrolling rail mode) | ✅ Yes (refined) | 0.75 d / 0.25 d |
| `product-carousel` | ❌ **NEW** | 1.0 d / 0.3 d |
| `coupon-strip` | ❌ **NEW** | 0.5 d / 0.15 d |

**Tier 1 subtotal**: 3.5 d human / 1.1 d agent-assisted

### Tier 2 — banner-specific demo upside (3 components)

| Component | Originally planned? | Cost (human / agent) |
|---|---|---|
| `editorial-hero` (renamed from `editorial-lookbook`, simplified) | ⚠️ Renamed | 0.5 d / 0.15 d |
| `bealls-bucks-callout` | ✅ Yes | 0.5 d / 0.15 d |
| `lifestyle-price-hero` | ❌ **NEW** (bealls.com only) | 0.5 d / 0.15 d |

**Tier 2 subtotal**: 1.5 d human / 0.45 d agent-assisted

### Schema extensions (no new components, cheap)

| Extension | Cost (human / agent) |
|---|---|
| `category-header` adds `heroImage` and `subcategories[]` | 0.25 d / 0.1 d |
| `product-grid` / `product-carousel` add `showRating`, multi-badge | 0.25 d / 0.1 d |
| `category-tile-grid` adds `description` and column variants | 0.1 d / 0.05 d |

**Schema subtotal**: 0.6 d human / 0.25 d agent-assisted

### Tier 3 — explicitly deferred

| Component | Defer reason |
|---|---|
| `clearance-rail` (separate from `price-rail`) | `price-rail` with a "Clearance" tier label is sufficient |
| `swatch-grid` (interactive color/size variants) | High render complexity. PLP per-card swatch dots will render as static thumbnails for v1 |
| `comparison-table` | Researcher-heavy, but Bealls shoppers don't comparison-shop |
| `tri-image-hero` (HomeCentric collage) | One-off pattern, render as static section |
| `split-promo` wrapper | Compose with two `promo-strip` instances |

---

## Total component-work cost — frozen vs revised

| | Frozen (Phase 2) | Revised after audit |
|---|---|---|
| Human baseline | 5.0 d | **5.6 d** (+0.6 d, +12%) |
| Agent-assisted target | 1.5 d | **1.8 d** (+0.3 d, +20%) |
| Net-new components added | 5 | 8 (Tier 1: 5 + Tier 2: 3) |
| Components renamed/refined | 0 | 1 (lookbook → editorial-hero) |
| Schema-only extensions | 0 | 3 |

**Per the dual-baseline discipline, the frozen 5d / 1.5d numbers DO NOT change.** The +0.6d / +0.3d delta is captured here and will appear in the retro under "What we added that wasn't in the plan."

The delta is small enough that it does not threaten the engagement timeline; the audit spotted it before any code was written, which is exactly why Phase 1 exists.

---

## HomeCentric demo strategy: locked decision (revised 2026-04-30)

**Strategy revised from "synthesize an online HomeCentric" to "content-mode platform capability."** The earlier synthesis approach is preserved for context in `docs/audits/homecentric.md` but is no longer the chosen path.

**Adopt the content-mode platform approach**: extend Aisles to support two operating modes from a single engine:

| Mode | Banners | Drives | CTAs |
|---|---|---|---|
| **Storefront** | bealls.com, beallsflorida.com | Product selection, pricing, cross-sell | Cart, PDP, checkout |
| **Content / locator** | homecentric.com | Editorial framing, hero choice, category emphasis | Store locator, newsletter, in-store interest |

**Why this is sharper than synthesize-online**:
- Matches HomeCentric's real operational posture (likely intentional — off-price treasure-hunt models avoid central online catalogs by design). No implied fulfillment the merchant may not have.
- Demonstrates platform breadth — the same Aisles engine handles transactional and brand sites without forking the codebase.
- Unlocks a cross-banner persona-continuity demo: gatherer on `homecentric.com` → brand-strip switch to `bealls.com` → same persona, products surface. Stronger demo moment than three independent storefronts.
- Mode flag is a **permanent platform capability**, reusable for future engagements where a merchant has both site types.

**Net effort delta**: ~net-neutral vs synthesize-online (+0.4 d human / +0.1 d agent). HomeCentric catalog scrape (~1 day saved) is replaced by platform mode work (~1.4 d added):

| Work | Cost (human / agent) |
|---|---|
| `BrandConfig.mode: 'storefront' \| 'content'` flag | 0.1 d / 0.05 d |
| Mode-gated component vocabulary (Zod + prompt) | 0.4 d / 0.15 d |
| Content-mode CTA routing (locator, newsletter, RSVP intents) | 0.4 d / 0.15 d |
| Curated content items model — replaces catalog for content-mode brands | 0.5 d / 0.2 d |
| **Subtotal** | **~1.4 d / ~0.55 d** |

**Phase 4 plan for HomeCentric (revised)**:
- No catalog scrape required.
- Curate ~12–20 hand-authored content items per banner (store locations, brand pillars, categories, lifestyle scenes). These play the role catalog plays in storefront mode.
- Effort: covered within the platform mode-work allocation above.

**Captured in ADR**: `docs/decisions/005-storefront-vs-content-modes.md` (created with this revision).

---

## Open questions that should resolve before Phase 2 kickoff

1. **Has Bealls (the merchant) agreed to a private demo URL?** The audit confirms scraping is technically defensible since this is *their* catalog for *their* sales engagement, but the demo must remain password-gated or `noindex` until written sign-off. **Action**: confirm legal posture before Phase 4 scrape begins.
2. **Is the HomeCentric synthesis approach acceptable to the merchant?** Synthesizing an e-commerce HomeCentric from sister-banner inventory is the strongest demo, but the merchant may want stricter brand separation. **Action**: confirm with merchant stakeholders that this approach matches their brand-architecture intent. Fallback is Option A (drop HomeCentric).
3. **Do we lock per-card star ratings in?** The schema extension is cheap, but real ratings require BC reviews API access or seeded review data. **Decision recommended**: lock in for the demo, seed with synthetic ratings during catalog enrichment.
4. **`coupon-strip` data source?** The component is straightforward, but for the demo to land, the coupon shown should adapt to persona (Hunter sees "Spend $80, save $10"; Gifter sees "Free gift wrap on orders $50+"). **Decision recommended**: drive coupon content through the same persona-fit pipeline as layout, treating each coupon as a content asset with persona affinity scores.

---

## Recommendations for Phase 2 kickoff

1. **Build the lead banner end-to-end first** (bealls.com), proving the full Tier 1 + Tier 2 component stack before forking to the other two.
2. **Build components in dependency order**:
   - Schema extensions first (cheap, unblock everything else)
   - Tier 1 components in this order: `promo-strip` → `category-tile-grid` → `price-rail` → `product-carousel` → `coupon-strip`
   - Tier 2 components after Tier 1 lands: `editorial-hero` → `bealls-bucks-callout` → `lifestyle-price-hero`
3. **Write prompt routing rules per component as the component lands**, not in a separate phase. Routing rules are tested by generating real layouts and inspecting outputs — bundling that into each component's PR keeps the feedback loop tight.
4. **Defer all Tier 3** unless a specific demo moment surfaces a need. Track in a short "deferred capabilities" appendix at the end of the engagement so the merchant sees what's possible in v2.
