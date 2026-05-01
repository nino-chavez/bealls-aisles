# ADR 006: Surface-typed schemas (split single LayoutSchema → per-surface schemas)

Status: Accepted
Date: 2026-04-30
Deciders: Nino Chavez, Claude (Opus 4.7)

## Context

The engine currently has a single `LayoutSchema` (a discriminated union over a `StorefrontSectionSchema` or `ContentSectionSchema` based on brand mode). The same schema applies regardless of surface — home, PLP, PDP, cart, checkout, search, account, empty — because there is no surface dimension in the schema.

This is the correct shape for V0 of the artifact, where AI composition is only used on home and PLP (both wide-latitude surfaces). It is **not** the correct shape for V1, where composition extends to PDP (narrow latitude — fixed scaffold with named insertion zones), cart (very narrow — scaffold + upsells), and checkout (fixed — copy + last-chance only).

The composition latitude principle from [`composition-taxonomy.md`](../engine/composition-taxonomy.md) §2 requires that each surface enforce different rules:

| Surface | Latitude |
|---|---|
| Home | Wide — AI composes ordered array of 6–10 sections |
| PLP | Medium — AI composes within scaffold (header + body + insertions) |
| PDP | Narrow — fixed scaffold + AI inserts at named zones |
| Cart | Fixed — scaffold + AI personalizes upsells/copy only |
| Checkout | Very narrow — fixed steps + assurance copy variants |
| Empty/404 | Wide — AI composes rescue surface |

A single union schema cannot enforce these rules. Without surface-typed schemas, the AI prompt is the only constraint preventing free-form composition on PDP/Cart/Checkout. Prompts drift; merchants get inconsistent composition; the V invariant degrades from "every layout is structurally valid" to "every layout is structurally valid for some surface."

## Decision

Split the single `LayoutSchema` into **six surface-typed schemas**, each with appropriate latitude:

- `HomeLayoutSchema` — wide latitude; ordered array of sections.
- `PLPLayoutSchema` — medium latitude; scaffold of header zone + body zones + insertion zones.
- `PDPLayoutSchema` — narrow latitude; fixed scaffold (gallery, title, variants, ATC, description, reviews) + named insertion zones (`pdp.below-description`, `pdp.cross-sell`, `pdp.recently-viewed`).
- `CartLayoutSchema` — fixed scaffold + AI-composed upsell row + AI-personalized copy variants.
- `CheckoutLayoutSchema` — fixed scaffold + AI assurance copy variant + AI last-chance upsell.
- `EmptyLayoutSchema` — wide latitude for rescue surfaces (404, empty cart, empty search, empty wishlist).

Block (component) schemas are **shared** across surface schemas — they live in `src/lib/schema/blocks.ts`. Surface schemas reference blocks but constrain which blocks are valid where.

Surface schemas are addressed via a `getLayoutSchemaForSurface(surface, mode)` helper that replaces the existing `getLayoutSchema(mode)`. The mode dimension (storefront vs. content) remains; it now composes with the surface dimension.

The existing single `LayoutSchema` export is kept as an alias for `StorefrontLayoutSchema` for backwards compatibility during the migration. New code targets surface-typed schemas; old code continues to work.

## Alternatives considered

### Option A: Keep the single schema; constrain via prompt only

- Pros: zero refactor; today's code keeps working.
- Cons: prompt drift is the failure mode that motivated this ADR. Without schema-level enforcement, AI can emit a `cart-line-items` block in a home composition or vice versa. Bug observable in early V0 development; would worsen at PDP/Cart scale.
- Verdict: rejected. The whole point is schema-level enforcement.

### Option B: Per-component schemas (each block is its own top-level schema)

- Pros: maximum granularity; every block fully isolatable.
- Cons: loses the surface-level latitude rules. Latitude is a per-surface property, not a per-block property — for example, `editorial-hero` is wide-latitude on home but doesn't appear at all on PDP. Per-component schemas can't express this without an explicit surface dimension layered on top, which is exactly what this ADR provides.
- Verdict: rejected. Doesn't solve the problem.

### Option C: Surface × mode matrix (12+ schemas: 6 surfaces × 2 modes)

- Pros: most explicit; every cell in the matrix is its own schema.
- Cons: schema explosion. Most surface×mode cells are similar (storefront PDP and content PDP both use the same PDP scaffold). Maintaining 12+ schemas creates duplication and divergence risk.
- Verdict: rejected. Mode is better expressed as a constraint applied per surface (e.g., content-mode PDP omits ATC and stock signal) rather than a separate schema axis.

### Option D (chosen): 6 surface-typed schemas, mode applied as a constraint

- Pros: enforces surface-level latitude; mode is a per-surface filter on which blocks are valid; back-compat alias preserves existing code.
- Cons: requires migrating existing imports; introduces a small helper API (`getLayoutSchemaForSurface`).
- Verdict: chosen. Best balance of expressiveness and maintainability.

## Consequences

### Positive

- **Per-surface latitude enforced at the schema layer**, not just the prompt layer. The V invariant strengthens from "any valid storefront layout" to "any valid layout for *this* surface."
- **PDP composition becomes safe.** Phase 3 (per [STRATEGY §7](../../strategic/STRATEGY.md)) implements PDP as a fixed scaffold with named insertion zones. Without surface-typed schemas, this is impossible — the AI can always emit any block. With surface-typed schemas, PDP composition is constrained at the schema layer; the AI cannot compose a `category-header` on PDP because `PDPLayoutSchema` doesn't include it.
- **Decisions Inspector explainability sharpens.** Per [PRD-ADM-003](../../functional/PRD.md), the Inspector surfaces "why this composition." With surface-typed schemas, the Inspector can also explain "what compositions were *possible* on this surface" — a much sharper merchant explanation.
- **Schema-level testing is now per-surface.** Tests can validate "is the AI emitting a valid PDP layout?" without conflating with home/PLP latitude.
- **Future surfaces drop in cleanly.** Adding a `SearchLayoutSchema` or `AccountLayoutSchema` is purely additive; doesn't disturb existing surface schemas.

### Negative

- **Migration cost.** Every existing import of `LayoutSchema` must eventually migrate to the surface-typed equivalent. Mitigation: keep `LayoutSchema` as an alias during migration; migrate call sites one at a time.
- **API endpoints need surface awareness.** `/api/layout` and `/api/layout/stream` currently take a `categorySlug`; they now need an explicit `surface` parameter (or infer it). Mitigation: add `surface` to the request shape with a default of `'plp'` (the most common case).
- **Prompt construction becomes per-surface.** `buildLayoutPrompt()` needs surface-specific guidance blocks. Already partially addressed via the `isHome` branch; this ADR formalizes per-surface prompts as the long-term shape.

### Reversibility cost

**Moderate-high.** After PDP, Cart, and Checkout schemas are populated with surface-specific blocks (image-gallery, variant-selector, cart-line-items, etc.) that don't exist in home/PLP, reverting to a single schema requires reconciling 6 latitude rules into one. Doable but expensive — estimated 1–2 weeks of refactor work to revert vs. ~2 days of effort to migrate forward into surface-typed schemas now.

The reversibility cost grows with each subsequent phase. Splitting now (when only home and PLP exist) is the cheapest possible time to make this change.

## Trace IDs

- **PRD-ENG-013** (surface-typed schemas) — this ADR is the architectural decision behind that capability
- **PRD-ENG-014** (PDP composition with fixed scaffold + named insertion zones) — depends on this ADR
- **PRD-ENG-015** (cart composition) — depends on this ADR
- **PRD-ENG-016** (checkout composition) — depends on this ADR
- **PRD-XLAYER-001** (Engine ↔ Foundation contract — typed JSON) — refined by this ADR; the contract is now surface-typed

## Implementation outline

This ADR's accepting commit (the same commit that creates this file) introduces the structural split:

1. New `src/lib/schema/blocks.ts` — all block schemas extracted (shared across surface schemas)
2. New `src/lib/schema/layouts/home.ts` — `HomeLayoutSchema` (wide latitude, currently equivalent to existing `StorefrontLayoutSchema`)
3. New `src/lib/schema/layouts/plp.ts` — `PLPLayoutSchema` (medium latitude, currently equivalent to existing `StorefrontLayoutSchema`)
4. Stubs for `layouts/pdp.ts`, `layouts/cart.ts`, `layouts/checkout.ts`, `layouts/empty.ts` — defined but currently equivalent to `StorefrontLayoutSchema`; populate with surface-specific blocks in subsequent phases (Phase 3+ per STRATEGY §7)
5. `src/lib/schema/layout.ts` — re-exports for backwards compatibility; new `getLayoutSchemaForSurface(surface, mode)` helper
6. API endpoints (`/api/layout`, `/api/layout/stream`) accept a `surface` field in the request body; default `'plp'` if not specified
7. Layout prompt builder accepts a `surface` argument; selects per-surface guidance

The home and PLP schemas are intentionally identical at first. They will diverge in subsequent phases as PLP gets a header zone + body zones + insertion zones, while home stays wide-latitude. The split today is structural; latitude divergence ships per-phase.

## Related

- [`composition-taxonomy.md`](../engine/composition-taxonomy.md) — block × surface × latitude rules (the conceptual underpinning)
- [`STRATEGY.md`](../../strategic/STRATEGY.md) §7 Phase 3 — when surface schemas get populated with surface-specific blocks
- [`PRD.md`](../../functional/PRD.md) PRD-ENG-013 through PRD-ENG-016 — capabilities this ADR enables
- ADR-004 (vocabulary constraint invariant) — the V invariant this ADR strengthens
- ADR-005 (storefront vs. content modes) — mode dimension this ADR composes with
