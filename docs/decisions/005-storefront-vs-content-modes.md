# Decision Record: Storefront vs Content Operating Modes

**Date:** 2026-04-30
**Status:** Accepted — to be implemented in Phase 2 of the Bealls engagement
**Context:** Aisles must natively support both transactional storefronts and content-only brand/locator sites from a single platform, without forking the engine.

## Summary

Aisles introduces a `mode` flag on `BrandConfig` that selects between two operating modes:

- **`storefront`** — full e-commerce stack: products, cart, PDP, transactional CTAs, the existing component vocabulary
- **`content`** — editorial brand site / store-locator: curated content items instead of products, non-transactional CTAs (locator, newsletter, RSVP), a subset of the component vocabulary that excludes anything implying purchase

Both modes share the persona inference engine, the layout AI, the brand-config router, and the schema-constrained generation invariant (ADR 004). The persona's effect on the layout is preserved across modes — a *gatherer* on a content site still gets editorial framing and inspiration tiles; a *hunter* on a content site still gets fast-path navigation to the relevant store and category surface. Personalization is the through-line; the *output actions* are what differ.

This is the decision that makes Aisles a platform, not a storefront engine.

---

## The Problem

The Bealls engagement surfaced a class of merchant the original platform design did not account for: a brand under a parent company that **chooses not to sell online** for operational, supplier, or strategic reasons. HomeCentric (Bealls's home-decor banner) is brick-and-mortar only; off-price retail's treasure-hunt model intentionally avoids central online catalogs because per-store inventory unpredictability is the value prop, not a flaw.

The original engagement plan proposed **synthesizing** an online HomeCentric using a curated subset of `bealls.com`'s home category. This worked technically but introduced a recurring framing problem: every demo, every stakeholder conversation, every internal slide had to hedge with "this is what's *technically possible*, not what HomeCentric *should do*." That hedge undermined the pitch and risked merchant misalignment.

The deeper problem: **the platform did not have a way to express that a brand operates differently than a storefront.** Every brand was assumed transactional. The mode distinction had to be carried in supervision overhead and demo-script discipline rather than in code.

This is not a Bealls-specific concern. Many parent companies own brand sites that sit alongside transactional sites — flagship sites, magazine/editorial properties, store-locator sites, B2B brand pages. A platform that can only model the transactional case is half a platform.

---

## The Decision

`BrandConfig` gains a required `mode` field of type `'storefront' | 'content'`.

```ts
interface BrandConfig {
  id: string;
  mode: 'storefront' | 'content';   // ← new
  // ...rest unchanged
}
```

The mode is read at three points in the request pipeline:

1. **Layout schema validation** (the V invariant, per ADR 004). The Zod schema becomes mode-aware — content-mode brands generate from a strict subset of the component vocabulary that excludes anything transactional. The set V is now `V_storefront ∪ V_content`, and each request's effective set is one of those subsets, never their union.
2. **Layout prompt construction**. The `COMPONENT_GUIDE` block emitted to the LLM is mode-conditional — content-mode prompts describe content-mode components only and include content-mode persona routing rules. The AI never even sees the components it's not allowed to use.
3. **CTA routing** in renderers. Content-mode renderers produce locator / newsletter / interest CTAs; storefront-mode renderers produce cart / PDP / checkout CTAs. The same component (e.g., `category-tile-grid`) renders differently per mode.

### Mode → component vocabulary mapping

| Component | storefront | content |
|---|---|---|
| `editorial-header` | ✅ | ✅ |
| `editorial-hero` | ✅ | ✅ |
| `category-header` | ✅ | ✅ |
| `category-tile-grid` | ✅ | ✅ |
| `promo-strip` | ✅ | ✅ |
| `hero-product` | ✅ | ❌ (no products in content mode) |
| `product-grid` | ✅ | ❌ |
| `product-carousel` | ✅ | ❌ |
| `lifestyle-price-hero` | ✅ | ❌ (no prices) |
| `price-rail` | ✅ | ❌ |
| `coupon-strip` | ✅ | ❌ |
| `bealls-bucks-callout` | ✅ | ✅ (content mode shows tier/earning explainer; storefront mode shows "earn $X on this order") |
| `locator-strip` | ❌ | ✅ — new content-mode component (find-a-store CTA, ZIP search, "5 stores within 25 miles") |
| `interest-form` | ❌ | ✅ — new content-mode component (newsletter signup, in-store-pickup interest, brand engagement) |

### Content items vs products

In storefront mode, the catalog is a list of `Product` objects with prices, inventory, BC entity IDs, and persona-fit scores. In content mode, the equivalent unit is a `ContentItem`:

```ts
interface ContentItem {
  id: string;
  kind: 'category-pillar' | 'lifestyle-scene' | 'store-feature' | 'brand-story';
  title: string;
  subtitle?: string;
  body?: string;
  image: string;
  cta: { label: string; intent: 'locate' | 'subscribe' | 'rsvp' | 'browse'; href?: string };
  personaFit?: PersonaFitVector;
}
```

`ContentItem`s are hand-curated (~12–20 per content-mode brand, vs hundreds of products per storefront-mode brand) and stored in `brands/{brand}-content.json` rather than fetched from BC. The persona-fit pipeline still runs over them — a *gatherer* sees lifestyle scenes; a *hunter* sees the locator-strip first; a *gifter* sees brand-story content emphasizing universal appeal.

### Layout AI behavior

Same engine, mode-conditional prompt and schema. The AI never produces a layout that violates the mode's allowed component set, because the schema constraint forbids it (V invariant per ADR 004). If the AI somehow outputs a forbidden component, Zod rejects the layout and the fallback cascade kicks in — same enforcement as everything else.

### Persona effects across modes

The persona inference engine is unchanged. What changes is how the inferred persona is *used*:

| Persona | storefront effect | content effect |
|---|---|---|
| Gatherer | Editorial header, hero product, 2-col landscape grid, descriptions shown | Editorial hero, lifestyle-scene tiles, brand-story emphasis, soft CTAs (subscribe, browse) |
| Hunter | 4-col dense grid, square images, quickAdd | Locator-strip first ("nearest store, hours, directions"), category-pillar tiles, hard CTAs |
| Researcher | Specs-shown grid, no hero | Brand-story content with depth, "about our materials" / "how we curate", soft CTAs |
| Gifter | Hero product top pick, gift-tier framing | Lifestyle scenes, gift-occasion editorial, locator + registry-style intent CTAs |

The persona has the same *meaning* across modes. The output adapts.

---

## Consequences

### Positive

- **Aisles becomes a platform**, not a storefront engine. Future engagements with merchants that have brand sites alongside transactional sites can be served from one codebase.
- **HomeCentric's demo strategy aligns with the merchant's real operational posture.** No hedging caveats, no synthesized fulfillment, no risk of mis-framing.
- **Cross-banner persona continuity becomes a demo moment.** A user starts on `homecentric.com` (browses bedroom inspiration), switches to `bealls.com` via the brand strip, sees bedding products on sale — same persona maintained, same engine. The brand strip is not just navigation; it's a *mode boundary* the platform crosses smoothly.
- **The V invariant strengthens.** Two narrower subsets are easier to test than one broad union. Visual regression and prompt iteration both benefit from tighter scopes.
- **Locator-strip and interest-form** are reusable beyond this engagement — any merchant with brick-and-mortar presence wants these.

### Negative

- **More schema surface.** Two mode-specific component sets is more code than one universal vocabulary. The cost is bounded (~0.4 d for the schema work) but it does add ongoing maintenance.
- **Two prompt vocabularies to keep in sync.** Mode-conditional `COMPONENT_GUIDE` blocks must evolve together. Mitigation: the mode-specific portions are small; most of the prompt scaffolding is shared.
- **The CTA-routing layer is new.** Storefront mode's CTAs route to existing endpoints (`/api/cart`, `/product/{id}`); content mode's CTAs route to a new minimal set (`/locator`, `/subscribe`, `/interest`). The locator endpoint specifically requires either a static store list or a third-party lookup; for the Bealls demo, the existing `stores.bealls.com` URL pattern is sufficient.
- **Content-mode catalogs are hand-authored.** No enrichment pipeline runs on `ContentItem`s for v1. The persona-fit scores are written into the JSON by hand, calibrated by inspection. This is acceptable for ~12–20 items per brand but doesn't scale to hundreds without revisiting.

### Neutral

- The mode flag is **not** a feature flag in the experimental sense — it's a permanent architectural axis. Each brand picks one and stays there. There is no "AB test storefront vs content" workflow.
- No migration is required for existing brands (`haven`, `volt`, `ember`) — they all default to `mode: 'storefront'`.

---

## Alternatives Considered

### A. Synthesize an online HomeCentric

The original Phase 1 audit recommendation: pull a curated home-category subset from `bealls.com`, brand it as HomeCentric, ship a transactional storefront. **Rejected** because it required ongoing demo-script hedging ("this is capability, not prescription") and risked implying fulfillment the merchant may not have. Net effort was comparable to the chosen path; demo value was lower.

### B. Drop HomeCentric from the engagement

Reduce scope to two banners. **Rejected** because HomeCentric is the most brand-distinctive of the three (different color, different voice, different positioning), and dropping it would make the engagement a story about *replicating online stores* rather than *standing up agentic personalization across a brand portfolio*.

### C. Build HomeCentric as an in-store kiosk / mobile companion

Reframe HomeCentric as a digital extension of the in-store experience rather than a website. **Rejected** for v1 because the surface area (in-store UX patterns, mobile companion apps, BLE proximity, kiosk hardware) is too different from the existing platform to ship in the engagement timeline. Worth revisiting as a v2 for engagements that have a stronger in-store digital ask.

### D. Mode flag with content-mode platform capability (chosen)

Documented above.

---

## Implementation Plan

This ADR is implemented as part of Phase 2 of the Bealls engagement. The mode flag and content-mode capability are deliverable in ~1.4 d human / ~0.55 d agent-assisted, decomposed as:

1. **Add `BrandConfig.mode` field**, default `'storefront'` for existing brands. ~0.1 d.
2. **Update layout schema** to two discriminated mode-specific unions. The `LayoutSchema` either becomes mode-conditional (function of mode) or two separate `StorefrontLayoutSchema` / `ContentLayoutSchema` exports validated against the active mode. **Recommendation: two separate schemas with a small `LayoutSchemaForMode(mode)` selector.** ~0.2 d.
3. **Update layout prompt** to emit mode-conditional `COMPONENT_GUIDE`. ~0.2 d.
4. **Create `ContentItem` type and `brands/{brand}-content.json` loader.** ~0.3 d.
5. **Build content-mode renderers** for `locator-strip` and `interest-form`. ~0.4 d.
6. **Mode-aware CTA routing** in existing renderers (e.g., `category-tile-grid` in content mode produces a `browse` intent, not a category-page link). ~0.2 d.

The `homecentric` brand config will be the first content-mode brand. The `haven`, `volt`, `ember`, `bealls`, `beallsflorida` brand configs will be storefront-mode.

---

## References

- ADR 004 — Vocabulary Constraint Invariant (the V invariant this decision strengthens)
- `docs/audits/homecentric.md` — site audit that surfaced the operational reality
- `docs/audits/SYNTHESIS.md` — cross-banner audit synthesis
- `docs/BEALLS-ENGAGEMENT.md` — engagement plan and frozen estimates
