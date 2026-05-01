# ADR 007: Section authoring model — named insertion zones with typed contract

Status: Accepted
Date: 2026-04-30
Deciders: Nino Chavez, Claude (Opus 4.7)
Layer: foundation + admin + cross-layer (engine ↔ foundation contract)

## Context

Per [foundation competitive research](../../research/foundation/competitive-survey.md) §1 and §10, every reference ecommerce theme (Shopify Dawn, BigCommerce Cornerstone, commercetools Frontend, Saleor, Magento Hyvä, Vue Storefront/Alokai, Spryker) ships a **section-or-region authoring model** on home / PLP / PDP. This is universally table-stakes: merchants cannot self-serve content placement without it, and the absence is a hard "this isn't a real ecomm platform" objection.

Aisles' foundation today does not have this contract. The single `LayoutSchema` (now split into surface-typed schemas per ADR-006) describes what the AI composition produces — but it does not describe **named, addressable zones the foundation reserves for content that may be authored by the engine, by the merchant via admin, or by neither (static fallback)**.

Without this contract:

- The engine has no stable target to compose into. Today the AI emits a full layout array; there is no "compose the `home.hero` zone, leave `home.featured-row.2` to the merchant" affordance.
- The admin (per [PRD-ADM-005](../../functional/PRD.md), brand-block library) has no stable target to author into either. Admin-authored content is currently shoehorned into the same array the AI emits, conflating two authoring sources.
- The merchant cannot reason about "what part of this page is mine, what part is the AI's, what part is platform-default." The Decisions Inspector ([PRD-ADM-003](../../functional/PRD.md)) cannot give a precise answer to "why did this content appear here?" because there is no zone-level attribution.
- AI composition cannot extend cleanly to PDP, cart, checkout, or account ([STRATEGY §7 Phase 3 onward](../../strategic/STRATEGY.md)), because narrow-latitude surfaces require **fixed scaffold + AI inserts at specific zones** — and "specific zones" is exactly what this ADR formalizes.

This ADR is the engine ↔ foundation ↔ admin contract that all of Phase 3+ depends on. ADR-006 split schemas by surface; ADR-007 splits each surface into named zones. Together they enforce per-surface latitude (ADR-006) and per-zone authoring source (this ADR).

## Decision

The foundation defines a finite, typed catalog of **named insertion zones** per surface. Each zone is identified by a stable string ID (e.g., `home.hero`, `pdp.below-description`), declares a typed Zod schema for its accepted content, and resolves at render time through a precedence cascade:

```
content for zone Z on surface S =
    engine-composed content (if engine targeted Z this request)
    ↓ falls through to
    admin-authored content (if merchant published content for Z)
    ↓ falls through to
    foundation static fallback (always defined; never absent)
```

The cascade is the heart of the contract. Every zone has a static fallback so the foundation always renders. Every zone is a stable identifier so engine and admin can both target it. Every zone is typed so the V invariant (ADR-004) extends to authored content, not just engine output.

### Zone identifier convention

`{surface}.{zone-name}[.{index}]`

Examples:
- `home.hero` (singleton zone)
- `home.featured-row.1`, `home.featured-row.2` (indexed zones — ordered, finite, declared in spec)
- `pdp.below-description` (singleton, surface-prefixed)
- `cart.above-checkout-cta` (singleton, surface-prefixed)
- `search.empty-state` (singleton, surface-prefixed)

The surface prefix prevents zone-ID collisions across surfaces and is parseable for the Decisions Inspector ("show all zones on PDP").

### Where zones live in code

- **Zone catalog:** `src/lib/foundation/zones.ts` — exports `ZONES` (the typed registry of all zones) and `ZoneId` (the discriminated string-literal union).
- **Zone schemas:** `src/lib/foundation/zone-schemas.ts` — Zod schemas per zone (often references existing block schemas from `src/lib/schema/blocks.ts`).
- **Zone resolver:** `src/lib/foundation/resolve-zone.ts` — implements the precedence cascade: engine output → admin content → static fallback.
- **Static fallbacks:** `src/lib/foundation/fallbacks/{surface}.ts` — declarative, brand-aware static content per zone.

The zone catalog is the spec. The full per-zone breakdown (which surfaces, which schemas, which fallbacks) is in [`docs/architecture/foundation/section-authoring.md`](../foundation/section-authoring.md).

### Authoring sources

Three sources can populate a zone:

1. **Engine** — AI composition emits content for the zone. Engine output is bound to the zone via the surface schema (ADR-006); the `PDPLayoutSchema`, for example, has fields like `belowDescription` that map 1:1 to zone IDs.
2. **Admin** — Merchant-authored content via the `aisles-admin` app (PRD-ADM-005, brand-block library). Admin authors content as typed zone records in the shared admin DB. Per zone, content is identified by `(brandId, zoneId, audienceId | null, validFrom, validTo)`.
3. **Static fallback** — Defined per zone in `src/lib/foundation/fallbacks/`. Brand-aware (uses `getBrand()`), but not personalized. Always present.

A zone resolves at request time by walking the cascade: engine first, admin second, static last. Each step can short-circuit. The Decisions Inspector logs which source was used per zone per request.

### What the engine sees

The engine's per-surface schema (ADR-006) declares which zones it can target on that surface. For example:

- `HomeLayoutSchema` declares wide-latitude composition over the `home.featured-row.{1..N}` array; the AI composes this entire array.
- `PDPLayoutSchema` declares narrow latitude: fixed scaffold blocks (gallery, title, ATC, etc.) **plus** zone-typed insertion fields (`belowDescription`, `belowRecs`) that map to `pdp.below-description` and `pdp.below-recs`.

The engine cannot compose into a zone not declared in its surface schema. This is the V invariant extended to zone targeting.

### What the admin sees

The admin app (separate repo, `aisles-admin`) lists zones per surface, lets merchants author content for any zone, schedules and audience-binds the content, and previews the resulting layout. The admin does not author into the surface schema directly — it writes typed zone records that the resolver picks up.

The admin authoring schema mirrors the foundation zone schema. PRD-XLAYER-004 (Admin ↔ Foundation contract) is implemented by this mirroring — the admin's authoring form for `home.hero` validates against the same Zod schema the foundation uses to resolve the zone.

### Zone catalog (initial set)

Per the Phase 2 spec, the initial zone catalog is finite:

| Surface | Zones |
|---|---|
| Home | `home.hero`, `home.featured-row.{1..6}`, `home.editorial-strip`, `home.brand-spotlight`, `home.below-fold` |
| PLP | `plp.banner`, `plp.empty-state`, `plp.editorial-header`, `plp.between-thirds`, `plp.below-grid` |
| PDP | `pdp.below-description`, `pdp.below-recs`, `pdp.cross-sell`, `pdp.related` |
| Cart | `cart.above-checkout-cta`, `cart.below-fold`, `cart.empty-state` |
| Checkout | `checkout.assurance-strip`, `checkout.last-chance-upsell` |
| Search | `search.empty-state`, `search.zero-results-rescue` |
| Account | `account.welcome`, `account.dashboard-pick.{1..4}` |
| Locator | `locator.editorial-intro` |
| 404 / empty | `error-404.rescue`, `error-empty.rescue` |

This is the catalog the spec ([`docs/architecture/foundation/section-authoring.md`](../foundation/section-authoring.md)) commits to. Adding a zone is an additive change — new zone-id, new schema, new fallback. Removing a zone requires consideration of admin content already authored for that zone.

## Alternatives considered

### Option A: BigCommerce Page Builder regions as the authoring contract

Use BC's existing `{{{region name="..."}}}` mechanism. Merchants author via BC's admin; foundation reads regions through the GraphQL Storefront API; engine composes by injecting widgets into regions.

- **Pros:** zero new authoring surface; merchants already know it; reuses BC's marketplace investment; aligns with BC-native packaging hypothesis (H3).
- **Cons:** BC regions are HTML widget blobs, not typed content. The V invariant (ADR-004) cannot extend to widget output; the Decisions Inspector loses precision ("the merchant put HTML here" is the most we can say). Engine composition into widget regions requires HTML emission, which is precisely the unsafe shape we're avoiding. Region semantics are BC-specific, blocking a clean abstraction for a future non-BC backend.
- **Verdict:** rejected as the primary contract. BC regions remain a *passthrough* — merchants can keep their BC widget content, and the foundation's static fallback for some zones can pull BC region HTML where it exists. But the typed Aisles zone catalog is the contract the engine and admin write against.

### Option B: Shopify Dawn-style JSON section schema

Adopt Dawn's `schema.json` model verbatim — section files declare presets, blocks, and settings; merchants edit via a theme editor.

- **Pros:** the deepest section primitive in the reference set (per [foundation research §3](../../research/foundation/competitive-survey.md)). Battle-tested. Mature merchant mental model.
- **Cons:** Dawn's section model is **template-time**, not request-time — sections don't compose dynamically per shopper. Merchants edit JSON in a theme editor, not in admin per audience or per persona. Adopting verbatim doesn't give us request-time engine composition; we'd be re-implementing a static authoring model and then bolting AI on top of it (which is Adobe AI Assistant's pattern — explicitly not the experiment we're running per [STRATEGY §3.1](../../strategic/STRATEGY.md)).
- **Verdict:** rejected as a verbatim adoption. We borrow Dawn's discipline (typed sections, declarative schemas, finite catalog) but apply it at request time with engine-aware composition.

### Option C: Contentful entries (or any headless CMS)

Use Contentful (or Sanity, Storyblok) to author content. Define content models per zone; foundation queries Contentful at request time; engine has no involvement in zone composition.

- **Pros:** mature CMS UX; localized authoring; preview/publish workflows; battle-tested. PRD-ADM-005 (brand-block library) shape aligns with this.
- **Cons:** introduces a third dependency to the experiment (CMS vendor) on top of BC + Vercel + Anthropic. The CMS becomes the authoring system of record, not the admin app. The admin's value (rule authoring, audience targeting, A/B, observability — per [STRATEGY §4 admin cluster](../../strategic/STRATEGY.md)) is undermined; the explainability story splits across two systems. Headless CMS pricing for typed zones at the granularity we need is non-trivial. Most importantly: the experiment is testing whether **bundling** (H2) materially changes outcomes; outsourcing authoring to a CMS is the opposite of bundling.
- **Verdict:** rejected. The admin app is the authoring system. Future integrations with CMS are possible (admin can read external CMS for block content) but the contract the foundation honors is the admin's, not the CMS's.

### Option D: Free-form (no zone contract)

The engine emits whatever it wants; merchants author at the surface level (one big "merchant override" block per page). No named zones.

- **Pros:** zero design work; status quo.
- **Cons:** the failure modes that motivated the ADR. Engine and admin conflate. PDP narrow-latitude unenforceable. Decisions Inspector cannot attribute. Phase 3+ cannot proceed.
- **Verdict:** rejected. This is the absence of the ADR.

### Option E (chosen): Aisles-native typed zone catalog with three-source precedence cascade

Define zones in foundation code (typed Zod schemas, discriminated union on `ZoneId`). Engine targets zones via per-surface schemas (ADR-006). Admin authors zones via mirrored schemas. Foundation resolves via the three-source cascade with always-present static fallback.

- **Pros:** typed end-to-end (extends V invariant to authored content). Engine ↔ foundation ↔ admin contract is one schema, three resolvers. Decisions Inspector can attribute every zone to a source. Survives backend swap (BC → other) because zone IDs are platform-agnostic. Compatible with Option A as a passthrough fallback for merchants with existing BC region content.
- **Cons:** all-new authoring surface — admin must build per-zone editors (Phase 5). Not a familiar Dawn/Contentful affordance for incoming merchants. Initial zone catalog is opinionated and may need iteration.
- **Verdict:** chosen.

## Consequences

### Positive

- **The engine ↔ foundation contract is now typed and addressable.** Engine output is bound to zone IDs via surface schema fields; foundation resolves zones via the cascade; the contract has a single source of truth (`ZoneId` union).
- **The admin ↔ foundation contract is the same contract.** The admin app authors content for zone IDs; the foundation resolver doesn't care whether content came from the engine or the admin — it walks the cascade. PRD-XLAYER-004 is implemented by this symmetry.
- **The Decisions Inspector can attribute every zone.** "This zone rendered engine-composed content because the AI's request targeted it" / "this zone rendered admin-authored content because rule X scoped audience Y to this zone" / "this zone rendered the static fallback because no engine output and no admin override." The explainability story (PRD-ADM-003) gets a sharper answer than incumbent platforms.
- **PDP / Cart / Checkout composition becomes safe.** Phase 3 can ship. The fixed scaffold is composed of mandatory blocks; the AI composes only into declared insertion zones; nothing else is reachable.
- **Static fallback is the default render path, not a degraded path.** Every zone has a fallback. The foundation never renders an empty zone. Engine outage, admin outage, missing content — all degrade to fallback content silently. This is the ADR-002 (streaming) and the fail-fast design principle (NORTH-STAR §1) extended to the zone layer.
- **Multi-brand scaling.** Static fallbacks are brand-aware; admin content is brand-scoped; engine composition is brand-aware. The zone catalog is brand-agnostic. Adding a brand reuses the catalog and supplies brand-specific fallbacks/admin content.

### Negative

- **The admin app must implement zone editors.** Per zone, the admin needs an authoring UI (form bound to the zone schema), preview, audience scoping, schedule. This is non-trivial work — sized as Phase 5 in [STRATEGY §7](../../strategic/STRATEGY.md). Until Phase 5 ships, admin-authored content is a stub; only engine output and static fallback resolve.
- **Initial zone catalog is opinionated.** The 25+ initial zones are derived from the composition-taxonomy and foundation research. Merchants we haven't talked to yet may want zones we didn't define. Mitigation: adding a zone is purely additive (new ID, new schema, new fallback). Not a v0.4 → v0.5 migration risk.
- **The cascade adds resolver complexity.** Three-source precedence with type validation per source. Mitigation: the resolver is a single ~50-line function; well-tested; per-zone type safety is checked at compile time.

### Reversibility cost

**Moderate.** Zones are foundation-owned; reverting to free-form composition (Option D) is mostly deletion — but admin-authored content (once Phase 5 ships) would need migration to whatever replaces zones. Reversing **before** Phase 5 is cheap; after Phase 5, it's a migration project per merchant.

The reversibility cost is asymmetric: cheap to add zones, moderate to remove zones with admin content, expensive to abandon the entire model after Phase 5. Decide deliberately.

## Trace IDs

- **PRD-FND-013** (Section authoring model — named insertion zones) — this ADR is the design.
- **PRD-XLAYER-004** (Admin ↔ Foundation contract — content authoring schema) — implemented by the zone-schema mirroring.
- **PRD-XLAYER-001** (Engine ↔ Foundation contract — typed JSON) — refined by this ADR; zones extend the per-surface contract.
- **PRD-ENG-014, PRD-ENG-015, PRD-ENG-016** (PDP, cart, checkout composition) — depend on this ADR for "named insertion zones."
- **PRD-ADM-003, PRD-ADM-004** (Decisions Inspector + per-decision audit trail) — depend on zone-level attribution.
- **PRD-ADM-005** (Brand-block library / authored content) — Phase 5 implementation against this ADR.

## Implementation outline

This ADR is the design. Phase 2 implementation (per [STRATEGY §7](../../strategic/STRATEGY.md)) is purely the contract surface; full engine and admin wiring lands in later phases.

Phase 2 (this design + scaffold work):

1. Author this ADR (done).
2. Author [`docs/architecture/foundation/section-authoring.md`](../foundation/section-authoring.md) — full per-zone spec.
3. Update PRD-FND-013 status: `planned (Phase 2)` → `designed`.
4. (Optional this session, scheduled for next-session if walk-through track returns nothing) Scaffold `src/lib/foundation/zones.ts` and stubbed resolver. Wire one surface (home) end-to-end as a vertical slice; PLP/PDP/cart follow per phase.

Phase 3 (engine extends to PDP / cart):

5. Surface schemas (ADR-006) gain zone-targeted fields.
6. Engine prompt builder receives the zone catalog for the requested surface; AI is instructed it can only target declared zones.
7. Layout API request shape includes which zones the engine should target this request (vs. which to leave to admin).

Phase 5 (admin authoring):

8. Admin app implements per-zone editors.
9. Admin DB schema for `(brandId, zoneId, audienceId, content, validFrom, validTo)`.
10. Resolver picks up admin content for matching `(brandId, zoneId, audienceId)` tuples.

Phase 4 (Decisions Inspector):

11. Inspector reads per-request zone resolution log and renders the cascade per zone.

## Related

- [`docs/architecture/foundation/section-authoring.md`](../foundation/section-authoring.md) — the per-zone spec this ADR commits to.
- [`docs/architecture/engine/composition-taxonomy.md`](../engine/composition-taxonomy.md) §5 — surface-by-surface composition rules; zones declared here.
- [`docs/research/foundation/competitive-survey.md`](../../research/foundation/competitive-survey.md) §3, §10 — the "section authoring is universal table-stakes" finding.
- [ADR-004 (V invariant)](004-vocabulary-constraint-invariant.md) — extended by zone-typed authored content.
- [ADR-005 (storefront vs. content modes)](005-storefront-vs-content-modes.md) — mode constrains which zones are valid; e.g., `cart.*` zones don't apply in content mode.
- [ADR-006 (surface-typed schemas)](006-surface-typed-schemas.md) — surface schemas declare zone targeting; this ADR builds the catalog the schemas reference.
- [`STRATEGY.md`](../../strategic/STRATEGY.md) §7 Phase 2 — when this design ships; Phase 3+ depend on it.
