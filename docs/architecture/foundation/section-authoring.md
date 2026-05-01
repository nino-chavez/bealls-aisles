# Section authoring model — zone catalog and contract

**Version:** 0.1.0 (Phase 2 design)
**Last Updated:** 2026-04-30
**Status:** designed (per [ADR-007](../decisions/007-section-authoring-model.md))
**Layer:** foundation + cross-layer
**Trace IDs:** PRD-FND-013, PRD-XLAYER-001, PRD-XLAYER-004

This is the per-zone spec ADR-007 commits to. It enumerates every zone in the initial catalog, names its surface, declares its schema shape, defines its static fallback, and specifies which authoring sources (engine / admin / static) can populate it.

For the design rationale, alternatives considered, and trade-offs, see [ADR-007](../decisions/007-section-authoring-model.md). This doc is the contract; the ADR is the why.

---

## 1. The contract in one paragraph

A **zone** is a stable, typed insertion point on a surface. Every zone has an ID like `home.hero` or `pdp.below-description`, a Zod schema for accepted content, and a static fallback that always renders. At request time, content for a zone is resolved through a three-source cascade: **engine output → admin-authored content → static fallback**. The first match wins. Every zone is reachable by at least one source; no zone can render empty.

---

## 2. Resolver semantics (precedence cascade)

```
fn resolveZone(zoneId, brandId, audienceCtx, engineOutput) -> ZoneContent {

  if (engineOutput?.zones[zoneId]) {
    return { source: 'engine', content: engineOutput.zones[zoneId] };
  }

  const adminContent = adminContentFor(brandId, zoneId, audienceCtx);
  if (adminContent) {
    return { source: 'admin', content: adminContent };
  }

  return { source: 'fallback', content: staticFallbackFor(brandId, zoneId) };
}
```

The resolver is a pure function. It is called once per zone per request. The result is logged for the Decisions Inspector (PRD-ADM-003) — every zone resolution is auditable.

**Implementation lives at:** `src/lib/foundation/resolve-zone.ts`

**Source priority is intentional, not configurable.** Engine output is freshest (composed for this exact request); admin content is merchant intent (authored deliberately); static fallback is the safety net (always present). Inverting the order — e.g., letting admin override engine — re-conflates layers that ADR-007 explicitly separates.

---

## 3. Zone catalog (initial set, v0.1)

The full enumeration. **All IDs in this section are stable contracts**; once published, removing or renaming a zone is a breaking change for admin-authored content.

### 3.1 Home (`home.*`)

| Zone ID | Schema (block ref) | Multiplicity | Engine? | Admin? | Static fallback |
|---|---|---|---|---|---|
| `home.hero` | `EditorialHeroSchema \| LifestylePriceHeroSchema \| EditorialHeaderSchema` | singleton | ✓ | ✓ | Brand-default photographic hero from `brand.config.ts:homepage.heroImage/heroHeadline/heroBody` |
| `home.featured-row.{1..6}` | `ProductGridSchema \| ProductCarouselSchema \| EditorialHeaderSchema` | indexed (1–6) | ✓ | ✓ | "Best Sellers" carousel from BC catalog top-N |
| `home.editorial-strip` | `EditorialArticleTeaserSchema \| BrandSpotlightSchema` | singleton | ✓ | ✓ | Hidden (renders nothing) |
| `home.brand-spotlight` | `BrandSpotlightSchema` | singleton | ✓ (gatherer/researcher only) | ✓ | Hidden |
| `home.below-fold` | `CategoryTileGridSchema \| PromoStripSchema \| BoPISStripSchema` | singleton | ✓ | ✓ | Brand category tile grid (top 6 categories from `brand.config.ts:categories`) |

**Notes:**
- `home.featured-row.{n}` is an indexed family, not an array. Each index is its own zone. Engine composes the count it wants (1 to 6); admin can author any subset; gaps fall through to static.
- `home.brand-spotlight` is engine-gated to specific personas; for hunter/gifter, the engine doesn't target it, and admin or static fills.

### 3.2 PLP (`plp.*`)

| Zone ID | Schema (block ref) | Multiplicity | Engine? | Admin? | Static fallback |
|---|---|---|---|---|---|
| `plp.banner` | `PromoStripSchema \| CouponStripSchema \| EditorialHeaderSchema` | singleton | ✓ | ✓ | Hidden |
| `plp.editorial-header` | `EditorialHeroSchema \| EditorialHeaderSchema` | singleton | ✓ (gatherer/gifter only) | ✓ | Hidden |
| `plp.between-thirds` | `EditorialArticleTeaserSchema \| PromoStripSchema` | singleton | ✓ | ✓ | Hidden |
| `plp.below-grid` | `CategoryTileGridSchema \| PaginationSchema` | singleton | ✗ (foundation-owned) | ✓ | `PaginationSchema` (foundation always renders pagination if results > page size) |
| `plp.empty-state` | `EmptyStateRescueSchema` | singleton | ✓ | ✓ | "No products in this category. Browse [top categories]" — auto-generated from sibling categories |

**Notes:**
- `plp.below-grid` is foundation-owned — pagination is mandatory and the foundation always emits it. Admin can add a `category-tile-grid` *above* pagination; engine doesn't target this zone.
- `plp.empty-state` is the rescue for empty result sets; engine can compose a richer rescue with `category-tile-grid`, `popular-searches-row`, etc.

### 3.3 PDP (`pdp.*`)

| Zone ID | Schema (block ref) | Multiplicity | Engine? | Admin? | Static fallback |
|---|---|---|---|---|---|
| `pdp.below-description` | `BrandSpotlightSchema \| EditorialArticleTeaserSchema \| ComparisonTableSchema` | singleton | ✓ | ✓ | Hidden |
| `pdp.related` | `ProductCarouselSchema` | singleton | ✓ | ✓ | BC native "related products" query |
| `pdp.cross-sell` | `CompleteTheLookSchema \| ProductCarouselSchema` | singleton | ✓ (gatherer/gifter favored) | ✓ | Hidden |
| `pdp.recently-viewed` | `RecentlyViewedRowSchema` | singleton | ✓ | ✗ | Foundation always renders if shopper has 3+ viewed products in session; otherwise hidden |
| `pdp.below-recs` | `BoPISStripSchema \| BucksEarnRowSchema` | singleton | ✓ (hunter favored) | ✓ | Brand `bopis-strip` if BOPIS-enabled brand and shopper has zip context |

**Notes:**
- PDP scaffold blocks (gallery, title, variants, ATC, description, reviews) are NOT zones — they are mandatory scaffold per `PDPLayoutSchema` (ADR-006). Zones are only the insertion points where composition is allowed.
- `pdp.recently-viewed` is admin-authoring-disabled — it's a behavioral surface, not editorial. Merchants can disable it via brand config but cannot author its content.

### 3.4 Cart (`cart.*`)

| Zone ID | Schema (block ref) | Multiplicity | Engine? | Admin? | Static fallback |
|---|---|---|---|---|---|
| `cart.above-checkout-cta` | `LastChanceUpsellRowSchema \| CouponStripSchema` | singleton | ✓ | ✓ | Hidden |
| `cart.below-fold` | `AlsoBoughtCarouselSchema \| RecentlyViewedRowSchema \| BeallsBucksCalloutSchema` | array (0–2) | ✓ | ✓ | `RecentlyViewedRowSchema` if 3+ viewed; else hidden |
| `cart.empty-state` | `EmptyStateRescueSchema` | singleton | ✓ | ✓ | "Your cart is empty. [Continue shopping]" with brand category links |

**Notes:**
- Cart line items, subtotal, free-shipping meter, promo entry, checkout CTA, trust strip — all mandatory scaffold, not zones.
- `cart.below-fold` is the only **array-multiplicity** zone in the catalog. Engine can compose 0–2 items; admin can author 0–2 items; static fallback is at most 1 item.

### 3.5 Checkout (`checkout.*`)

| Zone ID | Schema (block ref) | Multiplicity | Engine? | Admin? | Static fallback |
|---|---|---|---|---|---|
| `checkout.assurance-strip` | `AssuranceStripCheckoutSchema` | singleton | ✓ (variant by signal) | ✓ | Brand-default trust strip (returns / shipping / secure-checkout) |
| `checkout.last-chance-upsell` | `LastChanceUpsellRowSchema` | singleton | ✓ | ✓ | Hidden |

**Notes:**
- Checkout is the narrowest-latitude surface. Only two zones are exposed; everything else (steps, fields, place-order CTA) is mandatory scaffold and unauthorable.
- The assurance-strip variant is engine-driven by signal: first-time buyer → trust badges; returning shopper → "Welcome back, last-step rate"; gifter persona → gift-options shortcut.

### 3.6 Search (`search.*`)

| Zone ID | Schema (block ref) | Multiplicity | Engine? | Admin? | Static fallback |
|---|---|---|---|---|---|
| `search.empty-state` | `EmptyStateRescueSchema` | singleton | ✓ | ✓ | "No results for [query]. Try [popular-searches]" with brand top-search list |
| `search.zero-results-rescue` | `CategoryTileGridSchema \| PopularSearchesRowSchema \| ProductCarouselSchema` | array (0–3) | ✓ | ✓ | Top categories tile grid only |

**Notes:**
- `search.empty-state` is the headline rescue copy; `search.zero-results-rescue` is the body of the rescue (compositional).

### 3.7 Account (`account.*`)

| Zone ID | Schema (block ref) | Multiplicity | Engine? | Admin? | Static fallback |
|---|---|---|---|---|---|
| `account.welcome` | `AccountWelcomeCardSchema` | singleton | ✓ | ✓ | "Welcome back, {firstName}" with order-history link |
| `account.dashboard-pick.{1..4}` | `OrderHistoryListSchema \| WishlistGridSchema \| TierStatusCardSchema \| ForYouRowSchema \| BackInStockAlertCardSchema \| ReviewsToWriteRowSchema` | indexed (1–4) | ✓ | ✓ | Order history (1), wishlist preview (2), tier status (3), recently viewed (4) |

**Notes:**
- The dashboard is a 4-slot grid; engine selects which 4 cards from the schema union to fill. Admin can pin any slot. Static fallback fills remaining slots.

### 3.8 Locator (`locator.*`)

| Zone ID | Schema (block ref) | Multiplicity | Engine? | Admin? | Static fallback |
|---|---|---|---|---|---|
| `locator.editorial-intro` | `EditorialHeaderSchema` | singleton | ✓ (content-mode brands) | ✓ | "Find a [brand] near you" — brand-default headline |

**Notes:**
- Locator surface itself (map, store list, filters) is mandatory scaffold; the editorial-intro is the only zone.
- For content-mode brands (Home Centric), the engine targets this zone with seasonal copy (e.g., "Refreshed weekly — find your nearest store"). Storefront-mode brands receive the static fallback unless admin overrides.

### 3.9 Error / empty (`error-*`)

| Zone ID | Schema (block ref) | Multiplicity | Engine? | Admin? | Static fallback |
|---|---|---|---|---|---|
| `error-404.rescue` | `EmptyStateRescueSchema \| CategoryTileGridSchema \| ProductCarouselSchema` | array (0–3) | ✓ | ✓ | "Page not found" + top categories |
| `error-empty.rescue` | `EmptyStateRescueSchema \| EmailCaptureInlineSchema` | singleton | ✓ | ✓ | "Nothing here yet" + brand homepage link |

---

## 4. Zone schema definitions (where they live)

Block schemas (referenced above as `EditorialHeroSchema`, `ProductGridSchema`, etc.) are defined in [`src/lib/schema/blocks.ts`](../../src/lib/schema/blocks.ts) per ADR-006. Zone schemas are typed Zod unions of block schemas:

```ts
// src/lib/foundation/zone-schemas.ts (Phase 2 scaffold)
export const ZoneSchemas = {
  'home.hero': z.union([EditorialHeroSchema, LifestylePriceHeroSchema, EditorialHeaderSchema]),
  'home.featured-row': z.union([ProductGridSchema, ProductCarouselSchema, EditorialHeaderSchema]),
  'home.editorial-strip': z.union([EditorialArticleTeaserSchema, BrandSpotlightSchema]),
  // ... (full enumeration matches the catalog tables above)
} as const;

export type ZoneId = keyof typeof ZoneSchemas;
```

Indexed zones (`home.featured-row.1`, `account.dashboard-pick.3`, etc.) share the schema for their family — the index is bookkeeping for ordering, not a separate type.

---

## 5. Authoring source semantics

### 5.1 Engine targeting

Per ADR-006, surface schemas declare which zones the engine can target. For example:

```ts
// HomeLayoutSchema (illustrative; full def per ADR-006)
export const HomeLayoutSchema = z.object({
  zones: z.object({
    'home.hero': ZoneSchemas['home.hero'].optional(),
    'home.featured-row.1': ZoneSchemas['home.featured-row'].optional(),
    'home.featured-row.2': ZoneSchemas['home.featured-row'].optional(),
    // ...
  }),
});
```

The AI can omit a zone — it's optional. Omission means "let admin or static fill this." This is a deliberate engine affordance: composition is not all-or-nothing.

### 5.2 Admin authoring

Admin content is stored in the shared admin DB (separate `aisles-admin` repo per [STRATEGY §3.3](../../strategic/STRATEGY.md)) with this shape:

```ts
type AdminZoneRecord = {
  brandId: string;
  zoneId: ZoneId;            // matches the foundation zone-id
  audienceId: string | null;  // null = applies to all audiences
  content: ZoneContent;       // typed per ZoneSchemas[zoneId]
  validFrom: Date;
  validTo: Date | null;
  authoredBy: UserId;
  authoredAt: Date;
};
```

The resolver queries: "for `(brandId, zoneId, audienceCtx)` at `now`, is there a record with `validFrom ≤ now ≤ validTo` matching the audience?" If yes, that record's content fills the zone.

Audience matching is per [PRD-ADM-008](../../functional/PRD.md) (audience builder). For the v0.1 catalog, audience matching is unimplemented (always null) — pulls forward when Phase 5 ships.

### 5.3 Static fallback

Static fallbacks are declarative TypeScript per zone, brand-aware:

```ts
// src/lib/foundation/fallbacks/home.ts
import { getBrand } from '$lib/brand/config';

export const homeFallbacks = {
  'home.hero': () => ({
    type: 'editorial-header',
    headline: getBrand().homepage.heroHeadline,
    body: getBrand().homepage.heroBody,
  }),
  'home.featured-row.1': () => ({
    type: 'product-carousel',
    title: 'Best Sellers',
    productIds: getBrand().bestSellerIds.slice(0, 8),
  }),
  // ...
};
```

Static fallbacks must:
- Always return content (never throw, never return null).
- Be brand-aware via `getBrand()`.
- Not perform IO at request time — fallbacks are synchronous; data should be in `brand.config.ts`.
- Match the zone's Zod schema (validated in tests).

### 5.4 The "hidden" semantic

Several zones list "Hidden" as the static fallback. Hidden means **the foundation renders nothing for this zone** when no engine output and no admin content exist. Hidden ≠ empty: an empty product grid would still render an empty container; hidden returns no DOM at all.

The Decisions Inspector logs hidden resolution as `source: 'static', content: null`. This is a valid, observable outcome.

---

## 6. Render contract

The foundation's per-surface page component (`+page.svelte`) is responsible for rendering zones in their declared order. The order is **declared in the layout**, not in the zone catalog — the engine or admin determines order via the surface schema's array structure.

For surfaces with named singleton zones (PDP's `pdp.below-description`, etc.), order is fixed by the page template. For surfaces with array zones (home's `featured-row.{n}`, cart's `below-fold`), order is the array index.

```svelte
<!-- Conceptual: PDP page rendering -->
<ImageGallery />
<ProductTitle />
<VariantSelector />
<AddToCartBar />
<DescriptionTabs />
<ZoneRenderer zoneId="pdp.below-description" />  <!-- engine / admin / static -->
<RelatedProducts />  <!-- can be ZoneRenderer too if pdp.related is treated as zone -->
<ZoneRenderer zoneId="pdp.below-recs" />
<ReviewsList />
<ZoneRenderer zoneId="pdp.recently-viewed" />
```

`ZoneRenderer` is a single Svelte component that calls `resolveZone(zoneId, ...)`, dispatches on the resolved schema variant, and renders the matching block component. The page never branches on source — that's the resolver's job.

---

## 7. What this spec does NOT yet specify

The Phase 2 design intentionally leaves these for later phases:

1. **Audience matching algorithm.** The `audienceCtx` parameter is in the resolver signature but unimplemented in Phase 2. Phase 5 (admin Workspaces + RBAC) will define how audiences scope to zone records.
2. **A/B testing per zone.** Phase 5+ — the admin can author multiple variants per zone with traffic splits. Out of scope for Phase 2.
3. **Live preview.** Phase 5 — admin authors with a live preview that shows the resolved layout. Out of scope for Phase 2.
4. **Zone-level performance budgets.** Phase 4 (Decisions Inspector) — surface "this zone took 230ms to render." Tracked but not blocking Phase 2.
5. **Caching of admin content.** Phase 5 — admin records are cached at edge with invalidation on publish. Out of scope for Phase 2.
6. **Cross-brand zone sharing.** Open question. Should `Bealls` and `Bealls Florida` share a single zone record for `home.hero` if family-level merchandising is desired? Not yet decided; pulls forward when Bealls family-of-brands authoring scenarios surface in walk-throughs.

---

## 8. Open questions (carried into BRD-OPEN-QUESTIONS)

The Phase 2 design closes the architecture; it leaves these merchant-facing questions open:

- **Q-008 (new):** Should admin-authored content **override** engine output for a zone, or yield to it (current decision: yield)? Some merchants may want a "lock this zone to my content; ignore the AI" mode. Defer until walk-throughs surface a real merchant ask.
- **Q-009 (new):** Should the zone catalog be **versioned**? Adding a zone is additive but renaming/removing is a breaking change for admin content. Versioning the catalog (e.g., `aisles-zones@1.0`) lets us evolve without breaking authored content.
- **Q-010 (new):** What's the **maintenance owner** for static fallbacks across brands? Foundation team writes them initially; per-brand fallback overrides may be needed (e.g., Bealls Florida wants a different `home.hero` fallback than Bealls). Today: brand-aware via `getBrand()` is sufficient. Revisit if per-brand fallbacks diverge.

These move into [`BRD-OPEN-QUESTIONS.md`](../../functional/BRD-OPEN-QUESTIONS.md) on this commit.

---

## 9. Implementation outline (Phase 2 scaffold)

The minimum viable scaffold for the zone contract — work that can land per [STRATEGY §7 Phase 2](../../strategic/STRATEGY.md):

1. `src/lib/foundation/zones.ts` — exports `ZONES` (registry of zone IDs to metadata: surface, multiplicity, schema-ref, fallback-ref, `engineComposable: boolean`, `adminAuthorable: boolean`).
2. `src/lib/foundation/zone-schemas.ts` — Zod union per zone, references existing block schemas in `src/lib/schema/blocks.ts`.
3. `src/lib/foundation/fallbacks/{home,plp,pdp,cart,checkout,search,account,locator,error}.ts` — declarative fallbacks per zone, brand-aware.
4. `src/lib/foundation/resolve-zone.ts` — the cascade resolver function.
5. `src/lib/foundation/ZoneRenderer.svelte` — the dispatch component.
6. Tests: per-zone schema validation, fallback always returns valid content, resolver precedence cascade.
7. **Vertical slice (optional this session):** wire `home.hero` end-to-end so the home page resolves through the zone system; PLP/PDP/cart/etc. continue using existing direct rendering until subsequent phases.

Engine wiring (zone-targeted composition) and admin wiring (authoring DB + UI) are explicitly **not** in Phase 2. Those land in Phase 3 and Phase 5 respectively.

---

## 10. Related

- [`docs/architecture/decisions/007-section-authoring-model.md`](../decisions/007-section-authoring-model.md) — the ADR (decision rationale + alternatives).
- [`docs/architecture/decisions/006-surface-typed-schemas.md`](../decisions/006-surface-typed-schemas.md) — surface schemas declare zone targeting; this spec is the catalog they reference.
- [`docs/architecture/engine/composition-taxonomy.md`](../engine/composition-taxonomy.md) §5 — surface composition rules; zones derived from §5.3 (PDP), §5.4 (cart), §5.5 (checkout).
- [`docs/research/foundation/competitive-survey.md`](../../research/foundation/competitive-survey.md) §10 (open questions for Aisles) — the "named insertion zones" minimum set this spec implements.
- [`docs/functional/PRD.md`](../../functional/PRD.md) PRD-FND-013, PRD-XLAYER-001, PRD-XLAYER-004 — capabilities this spec implements.
- [`docs/functional/BRD-OPEN-QUESTIONS.md`](../../functional/BRD-OPEN-QUESTIONS.md) Q-008, Q-009, Q-010 — open questions surfaced by this spec.
