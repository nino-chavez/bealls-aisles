# Aisles — Capabilities Demonstrated

**Version**: 0.6.0
**Last Updated**: 2026-05-01
**Audience**: commerce.com internal teams — product, engineering, customer success

> Per the experimental framing in [`STRATEGY.md`](../strategic/STRATEGY.md), this doc enumerates **capabilities the artifact demonstrates** — what it shows, which hypothesis each capability tests, which internal audience extracts what, and what acceptance looks like for the demonstration.
>
> Every capability binds to a trace ID in [`../../traceability.json`](../../traceability.json). Stories about how internal teams react to each capability live in [`BRD.md`](BRD.md). Design-time decisions with non-obvious rationale live in [`PRD-COMPANION.md`](PRD-COMPANION.md). ADRs for runtime architecture decisions live in [`../architecture/decisions/`](../architecture/decisions/).

---

## How to read this doc

Each capability is one row in the master table. Layer assignment (engine / foundation / admin / cross-layer) is mandatory. Hypothesis assignment maps to STRATEGY §3 (H1: schema-typed composition viable / H2: bundling changes outcomes / H3: BC-native reaches merchants). Status flags whether the capability is **demonstrated** today on the live Bealls artifact, **building** in the active phase sequence, or **planned** in a later phase.

The **acceptance** column describes what "we demonstrated this" looks like — what an internal team should be able to observe in a walk-through. It is not a product launch acceptance criterion.

---

## 1. Master capability table

### 1.1 Engine layer (PRD-ENG)

| Trace ID | Capability | Hypothesis | Status | Acceptance (demonstration) |
|---|---|---|---|---|
| **PRD-ENG-001** | Schema-typed AI layout output enforced by V invariant (`∀I, ∀P, f(I, P) → S ∈ V`) | H1 | demonstrated | Walk-through shows Zod schema, AI Gateway structured output call, validation cascade. Inject a malformed mock response — fallback to Sonnet engages; if Sonnet fails, static layout renders. No invalid layout ever reaches the renderer. |
| **PRD-ENG-002** | Persona inference from request + behavioral signals → 4-persona probability vector | H1 | demonstrated | Walk-through shows the inference pipeline: URL params, UTM, referrer, device, time, behavioral events feed `infer()`. Resulting `{gatherer, hunter, researcher, gifter}` distribution drives layout generation observably. |
| **PRD-ENG-003** | Multi-brand isolation via single codebase, `BRAND_ID` env var, per-brand config | H2, H3 | demonstrated | Three Vercel projects (`aisles-demo-1/2/3`) deploy from one repo. Same code, different config produces three visually + behaviorally distinct brands. Brand boundaries hold (no cross-brand cache, no cross-brand routing). |
| **PRD-ENG-004** | Layout cache keyed on `(brandId, surface, persona, picksHash)` with 1h TTL | H1 | demonstrated | Cache-hit response < 100ms; cold-start generation 5–10s; after fix on 2026-04-30, no cross-brand cache pollution observed. |
| **PRD-ENG-005** | Streaming layout generation (Server-Sent Events partial output) | H1 | demonstrated | Editorial header visible at ~1s; product grid fills in over the next 4–6s; no blank wait state. |
| **PRD-ENG-006** | Storefront vs. content brand-mode split | H2 | demonstrated | Bealls + BF run as storefront mode (transactional surfaces). HomeCentric runs as content mode (no cart, no PDP — locator-first). Engine selects different schema + prompt subset by mode. |
| **PRD-ENG-007** | AI Gateway model fallback cascade (Haiku 4.5 primary, Sonnet 4.6 fallback) | H1 | demonstrated | Cost dashboard shows ~94% Haiku resolution; Sonnet engaged on schema validation failure or rate limit; observable in generation logs. |
| **PRD-ENG-008** | AI-composed homepage with persona-aware section selection | H1, H2 | demonstrated | Same shopper visits all three brands with `?intent=hunter` — each brand surfaces a price-rail-led layout in its own voice. With `?intent=gatherer` — each surfaces editorial-hero-led. The latitude matrix is observable. |
| **PRD-ENG-009** | AI-composed PLP with persona-aware section selection | H1 | demonstrated | Hunter PLP: dense grid + filter chips. Gatherer PLP: editorial hero + sparse grid. Researcher PLP: spec-heavy cards. Gifter PLP: occasion-framed editorial header. Same products, different compositions. |
| **PRD-ENG-010** | Refinement chat — natural-language layout override | H1 | demonstrated | Shopper types "show me cheap stuff" — persona shifts toward hunter, layout recomposes to dense + price-rail. Natural language is converted to signal events, not raw filter params. |
| **PRD-ENG-011** | Product enrichment with persona-fit scoring (Haiku 4.5) | H1 | demonstrated | Each catalog item gets `personaFit: {gatherer, hunter, researcher, gifter}` scored 0.0–1.0. Layout composition orders products by persona-fit, not creation date. |
| **PRD-ENG-012** | URL/image generation constrained to known-good values (no hallucination) | H1 | demonstrated | Walk-through shows the prompt's "VALID URL PATHS" allowlist + product-image-only rule. No `images.beallsflorida.com/...` hallucinated paths; no `/c/women/tops?price=0-10` invented routes. |
| **PRD-ENG-013** | Surface-typed schemas (split single LayoutSchema → 6 surface schemas) | H1 | demonstrated (Phase 3, with PDP wiring caveat — see [Q-013](BRD-OPEN-QUESTIONS.md#q-013--pdplayoutschema-keep-vs-remove-schema-vs-wiring-divergence)) | Single `LayoutSchema` becomes `HomeLayoutSchema`, `PLPLayoutSchema`, `PDPLayoutSchema`, `CartLayoutSchema`, `CheckoutLayoutSchema`, `EmptyLayoutSchema`. Each enforces appropriate composition latitude (wide / medium / narrow / fixed). Five of six (home, PLP, cart, checkout, empty) are exercised by live routes; `PDPLayoutSchema` exists for future capability — PDP currently renders foundation primitives + tag-overlap aggregates per ADR-008 Phase B. |
| **PRD-ENG-014** | PDP composition with fixed scaffold + named insertion zones | H1 | demonstrated (Phase 3) | PDP renders fixed scaffold (gallery, title, variant, ATC, stock, description tabs, reviews summary/list) directly in [`src/routes/product/[slug]/+page.svelte`](../../src/routes/product/[slug]/+page.svelte); insertion zones (`pdp.below-description`, `pdp.cross-sell`, `pdp.related`, `pdp.recently-viewed`, `pdp.below-recs`) resolve via the three-source cascade. AI cannot reorder gallery or substitute ATC — those are not zone-targeted. |
| **PRD-ENG-015** | Cart composition with last-chance upsell + free-shipping-meter | H1, H2 | demonstrated (Phase 3) | Cart shows foundation-rendered scaffold (line items, summary, free-shipping meter, promo code entry, CTA) sourced from cart state; engine emits one optional `last-chance-upsell-row` per [`CartLayoutSchema`](../../src/lib/schema/layouts/cart.ts). [`CartDrawer.svelte`](../../src/lib/components/CartDrawer.svelte) routes upsells through `surface=cart`. |
| **PRD-ENG-016** | Checkout composition (very narrow — copy + upsell only) | H1 | demonstrated (Phase 3) | Checkout handoff page composes 0–2 blocks ([`assurance-strip-checkout`](../../src/lib/components/layouts/sections/AssuranceStripCheckout.svelte) + optional [`last-chance-upsell-row`](../../src/lib/components/layouts/sections/LastChanceUpsellRow.svelte)) per [`CheckoutLayoutSchema`](../../src/lib/schema/layouts/checkout.ts) before BC Optimized One-Page redirect. Engine cannot reorder steps or modify required fields. |
| **PRD-ENG-017** | BOPIS strip composition with proximity awareness | H2, H3 | demonstrated (Phase 6) | Shopper ZIP (`?zip=` or session) geocodes via [`src/lib/server/locator/proximity.ts`](../../src/lib/server/locator/proximity.ts); when nearest pickup-ready store is within 30 mi, PDP surfaces `BOPISStripSection` ("Free pickup at [store] · Ready in 2 hours") rendered directly from foundation logic ([`src/routes/product/[slug]/+page.svelte`](../../src/routes/product/[slug]/+page.svelte)). The block is also AI-composable on `home.below-fold` for engine-driven proximity messaging in brand voice. |
| **PRD-ENG-018** | Refinement chat tag-intent extraction (alongside persona-vector update) | H1 | demonstrated (Phase 3) | Refinement chat input produces TWO outputs: persona-vector update (existing) AND tag-intent vector (new). Engine reads both when composing. Example: "warm and casual for lounging" → `{ persona: shift toward gatherer, tagIntents: [cozy, casual, warm, loungewear] }`. Per ADR-008. |
| **PRD-ENG-019** | Tag-overlap product neighborhood query | H1 | demonstrated (Phase 3) | `getProductsByTagOverlap(brandId, seedEntityId, opts) → TagOverlapResult[]` returns ranked similar products by Jaccard tag overlap, with `sharedTags` + `overlapScore` exposed for the Decisions Inspector. Wired into `pdp.cross-sell` (minOverlap=2), `pdp.related` (minOverlap=3), `pdp.recently-viewed` (cold-start substrate per ADR-008 §"Cold-start safe"), and `cart.above-checkout-cta` (aggregated across cart line items). Cold-start safe (sparse seeds gracefully degrade). Per ADR-008 Phase B. |
| **PRD-ENG-020** | P0 marketing / capture / service block set (composition-taxonomy Appendix A) | H1, H2 | demonstrated (Phase 3) | Six P0 blocks added to the AI vocabulary so home + PLP compositions stop being product-only: `event-countdown` (time-bound urgency), `brand-spotlight` (featured-brand callout), `trend-shop` (themed seasonal destination), `email-capture-inline` (signup with offer reveal — wired to `/api/email-signup` stub), `service-callouts-grid` (icon trust strip, also home.below-fold fallback), `locator-strip` (store-locator CTA, also plp.banner fallback). Schemas live in `src/lib/schema/blocks.ts`; renderers in `src/lib/components/layouts/sections/`; zones updated in `src/lib/foundation/zone-schemas.ts`; AI prompt surfaces all 6 in both storefront + content guides. Visual fixture at `/test/p0-blocks`. |

### 1.2 Foundation layer (PRD-FND)

| Trace ID | Capability | Hypothesis | Status | Acceptance (demonstration) |
|---|---|---|---|---|
| **PRD-FND-001** | BigCommerce GraphQL Storefront catalog adapter | H3 | demonstrated | All catalog reads route through BC GraphQL. No internal product DB. Walk-through shows `getProductsByCategory()`, `getProducts()` resolving live BC data. |
| **PRD-FND-002** | Multi-brand routing — same SvelteKit app, different brands per Vercel project | H2, H3 | demonstrated | `aisles-demo-1` serves Bealls catalog/voice; `-demo-2` serves BF; `-demo-3` serves HC. Switch by env var, no code branch. |
| **PRD-FND-003** | Cart state primitive (session-cookie scoped) | H2 | demonstrated | Add-to-cart from any composed layout updates session cart. Persists across navigation; expires on session end. |
| **PRD-FND-004** | Picks / wishlist primitive | H2 | demonstrated | Shopper saves picks across categories; picks state feeds engine's `picksContext` signal for personalization. |
| **PRD-FND-005** | Brand-strip cross-banner navigation (real cross-domain URLs) | H2, H3 | demonstrated | Top brand strip on each Bealls family deployment links to the other two as real Vercel URLs. Clicking switches deployment. Active brand renders as non-navigating span. |
| **PRD-FND-006** | Photographic editorial hero with brand-specific imagery | H2 | demonstrated | Each brand has a `homepage.heroImage` URL surfaced as static photographic hero. AI body composes below. Hero is brand chrome, not AI-composed. |
| **PRD-FND-007** | Static fallback layouts when AI fails | H1, H2 | demonstrated | When AI Gateway is slow / fails, foundation renders persona-templated static layout. Walk-through can force this path. Site never blank. |
| **PRD-FND-008** | Prominent AI-building loading state | H1 | demonstrated | While engine generates, foundation shows `LayoutBuildingState` component: "AI Personalization in progress · Building your homepage for a [persona]-driven shopper" with rotating status + 8s progress bar. Communicates the AI work, not "site is slow." |
| **PRD-FND-009** | Account dashboard (orders / addresses / profile / loyalty) | H2 | demonstrated — partial (Phase 1; scaffold shipped 2026-04-30) | [`src/routes/account/+page.svelte`](../../src/routes/account/+page.svelte) renders the dashboard scaffold with engine-personalized [`ForYouRow`](../../src/lib/components/layouts/sections/ForYouRow.svelte) at `account.dashboard-pick`. Order history / saved addresses / loyalty balance UI surfaces are scaffolded as zones (`OrderHistoryListStub`, `WishlistGridStub`, `TierStatusCardStub` per `zone-schemas.ts`); real BC orders + addresses + Bealls Bucks data binding pending the merchant-data integration sprint. The personalization slot (engine → admin → static cascade) is fully wired. |
| **PRD-FND-010** | Real checkout via BC Optimized One-Page handoff | H2, H3 | demonstrated (Phase 1; shipped 2026-05-01) | Cart CTA hands off to BC Optimized Checkout. Server-side mints a short-lived signed redirect URL via `cart.createCartRedirectUrls` and 302s the shopper into BC's hosted checkout with cart contents + auth context attached ([`src/routes/checkout/+page.server.ts`](../../src/routes/checkout/+page.server.ts), [`src/lib/server/bigcommerce.ts`](../../src/lib/server/bigcommerce.ts) `getCheckoutRedirectUrl`). Demo splash fallback when the channel doesn't have Optimized Checkout configured — avoids dead-ending on a 404. Order flows to merchant's existing BC fulfillment; no custom payment integration. |
| **PRD-FND-011** | Search results page with facets | H2 | demonstrated (Phase 1) | [`/search`](../../src/routes/search/+page.svelte) accepts `?q=` query, returns enrichment-powered results with text fallback ([`src/lib/server/search.ts`](../../src/lib/server/search.ts)). Working filters wired via session signals + persona inference. Empty-state rescue routes through the `surface=empty` + `reason=empty-search` engine path (PRD-FND-012); zero-results falls back to category tile grid + popular searches per `search.zero-results-rescue` zone. |
| **PRD-FND-012** | Branded 404 / empty-state pages with engine rescue | H1, H2 | demonstrated (Phase 1; shipped 2026-04-30) | 404 pages render brand chrome + AI-composed rescue (alt CTAs, related categories, popular products). Empty cart, empty search, empty wishlist all share this pattern. Implemented as: `surface='empty'` + `reason` discriminator on the engine ([`src/routes/api/layout/+server.ts`](../../src/routes/api/layout/+server.ts), [`src/lib/server/layout-prompt.ts`](../../src/lib/server/layout-prompt.ts) `EMPTY_REASON_FRAMING`); branded route at [`src/routes/+error.svelte`](../../src/routes/+error.svelte); reusable rescue band at [`src/lib/components/EmptyRescue.svelte`](../../src/lib/components/EmptyRescue.svelte) wired into search zero-results, CartDrawer, PicksTray. Static fallback (categories grid + go-home CTA) ensures rescue always renders even if the engine fails. Mode-aware: HC (content) gets locator-led rescue, no products. |
| **PRD-FND-013** | Section authoring model — named insertion zones | H2 | demonstrated (Phase 2 scaffold + Phase 3 engine targeting; admin authoring deferred to Phase 5) | Foundation defines named zones across all surfaces in [`src/lib/foundation/zones.ts`](../../src/lib/foundation/zones.ts) (27 zone families). Three-source resolution cascade implemented in [`src/lib/foundation/resolve-zone.ts`](../../src/lib/foundation/resolve-zone.ts) (engine → admin → static fallback). Per-zone schemas in [`src/lib/foundation/zone-schemas.ts`](../../src/lib/foundation/zone-schemas.ts); per-surface fallbacks in [`src/lib/foundation/fallbacks/`](../../src/lib/foundation/fallbacks/); dispatch via [`ZoneRenderer.svelte`](../../src/lib/foundation/ZoneRenderer.svelte). Engine zone-targeting wired on home, PLP, PDP, cart, checkout, search, account, locator. Admin zone authoring (Phase 5) is the only outstanding piece. Full catalog spec in [`docs/architecture/foundation/section-authoring.md`](../architecture/foundation/section-authoring.md); design rationale in [ADR-007](../architecture/decisions/007-section-authoring-model.md). |
| **PRD-FND-014** | Store locator with BOPIS data | H2, H3 | demonstrated (Phase 6) | [`/store-locator`](../../src/routes/store-locator/+page.svelte) accepts `?zip=` query param, geocodes via [`proximity.ts`](../../src/lib/server/locator/proximity.ts) ZIP-prefix table, ranks brand stores by haversine distance, and renders hours / phone / pickup-readiness per store. Sample store data for bealls/beallsflorida/homecentric in [`src/lib/server/locator/stores.ts`](../../src/lib/server/locator/stores.ts). Powers `BOPISStripSection` proximity context (PRD-ENG-017) and `BOPISPicker` zone fallback for `pdp.below-recs`. The `locator.editorial-intro` zone is engine-composable in brand voice via the standard cascade. |

### 1.3 Admin layer (PRD-ADM)

| Trace ID | Capability | Hypothesis | Status | Acceptance (demonstration) |
|---|---|---|---|---|
| **PRD-ADM-001** | Generation log — every layout decision recorded | H1 | demonstrated | Each engine call logs: brand, surface, persona, model, input/output tokens, cache hit, latency, session ID. Searchable in admin Observe. |
| **PRD-ADM-002** | Observe dashboard — operational telemetry | H1 | demonstrated (Phase 4; AnalyticsTab in `aisles-admin`) | [`AnalyticsTab`](../../../aisles-admin/src/components/tabs/AnalyticsTab.tsx) reads `generation_logs` (shared Neon DB) and surfaces totals, per-persona breakdown, daily cost, cache hit rate. Embedded in BC admin via marketplace app — same data the storefront's `/observe` route shows, scoped to authenticated BC sessions. |
| **PRD-ADM-003** | Decisions Inspector — primary admin daily-driver | H1 | demonstrated (Phase 4; default tab in `aisles-admin`) | [`InspectorTab`](../../../aisles-admin/src/components/tabs/InspectorTab.tsx) lists recent generations from `generation_logs` filterable by persona/surface/cache; clicking Inspect drills into a single decision showing context, persona-distribution, generation metadata, and per-zone explainability narrative reading from `zone_retrieval_logs` ("Top match shared 4 tags at 67% overlap"). Wired as the first tab on the admin per the design rationale ("primary daily-driver"). |
| **PRD-ADM-004** | Per-decision audit trail with explainability | H1 | demonstrated (Phase 4) | [`/api/inspector/[id]`](../../../aisles-admin/src/app/stores/[storeHash]/api/inspector/[id]/route.ts) joins `generation_logs` with `zone_retrieval_logs` by `session_id` to render the full trace: persona inference → model + cost + latency → per-zone retrievals (sharedTags + overlapScore per product). Every cross-sell zone surfaces a human-readable explanation. |
| **PRD-ADM-005** | Brand voice editor (edit `voiceGuidance` without code deploy) | H2 | demonstrated (Phase 5; voice override schema + UI) | [`BrandVoiceTab`](../../../aisles-admin/src/components/tabs/BrandVoiceTab.tsx) writes to `brand_overrides` (voice_guidance, tone_keywords, forbidden_terms). Storefront reads at prompt-construction time. Editor+ role required; per-edit audit trail (`updated_by` + `updated_at`). Live category preview is the follow-up enhancement. |
| **PRD-ADM-006** | Persona-fit overrides per product | H2 | demonstrated (Phase 5; override CRUD + Inspector visibility) | [`PersonaFitTab`](../../../aisles-admin/src/components/tabs/PersonaFitTab.tsx) writes per-product overrides to `persona_fit_overrides` (per-persona 0.0–1.0 score + reason). Storefront catalog ranker reads overrides on top of enrichment-computed fit; Decisions Inspector surfaces the override in its trace when applied. |
| **PRD-ADM-007** | Rule weight tuning per channel | H2 | demonstrated (Phase 4; Rules tab + campaign field) | [`RulesTab`](../../../aisles-admin/src/components/tabs/RulesTab.tsx) writes to `merchandising_rules` with `campaign` field for per-campaign scoping. `utm_*`-tied rules assignable per persona/category/product. |
| **PRD-ADM-008** | Cache invalidation on demand | H2 | demonstrated (Phase 4; scoped invalidation) | [`/api/cache`](../../../aisles-admin/src/app/stores/[storeHash]/api/cache/route.ts) supports scoped flush: `?brand=bealls&surface=plp` flushes only that cell prefix. GET surfaces per-brand cache stats. Editor+ for scoped, developer+ for purge-all (RBAC enforced). Auto-invalidate on rule publish is the follow-up. |
| **PRD-ADM-009** | Multi-brand workspaces | H2, H3 | demonstrated (Phase 5; workspaces table + switcher) | `workspaces` table maps `(store_hash, channel_id) → brand_id + label`. [`WorkspaceSwitcher`](../../../aisles-admin/src/components/WorkspaceSwitcher.tsx) lists available workspaces; active workspace resolved from session JWT `channel_id` via `findByChannel()`. Workspace scoping is implicit through BC channel auth — BF brand manager's session JWT never grants HC channel access. |
| **PRD-ADM-010** | Role-based access control (5 roles, per Contentful taxonomy) | H2 | demonstrated (Phase 5; RBAC schema + enforcement) | [`rbac.ts`](../../../aisles-admin/src/lib/rbac.ts) defines 5 roles + capability map; `app_users` table (`store_hash, email → role`); `getRoleFor()` resolves at request time, `canDo()` gates capabilities at API + UI layer. UI hides tabs the role can't access; APIs return 403 when role insufficient. Bootstrap path: first user post-install gets `admin`. |

### 1.4 Cross-layer (PRD-XLAYER)

| Trace ID | Capability | Hypothesis | Status | Acceptance (demonstration) |
|---|---|---|---|---|
| **PRD-XLAYER-001** | Engine ↔ Foundation contract — typed layout JSON | H1, H2 | demonstrated | Foundation's `LayoutRenderer` consumes engine-emitted JSON. Schema is the contract. Renderer can be tested with mocked engine output; engine can be tested without renderer. |
| **PRD-XLAYER-002** | Signal pipeline — foundation emits events; engine consumes for inference | H1, H2 | demonstrated | Client emitter batches behavioral events (5s flush, immediate for high-priority); server-side request signals merge with behavioral; `infer()` consumes. |
| **PRD-XLAYER-003** | Admin ↔ Engine contract — rules schema | H2 | demonstrated (Phase 4; merchandising_rules table) | Rules authored in admin serialize to `merchandising_rules` (typed columns: rule_type, persona, category_slug, product_id, campaign, config JSONB). Storefront reads via `getActiveRules()`. Rule-firing observable in Decisions Inspector trace. |
| **PRD-XLAYER-004** | Admin ↔ Foundation contract — content authoring schema | H2 | demonstrated (Phase 5; zone_content table + ContentAuthoringTab) | Admin authors per-(brand, zone) JSON content via [`ContentAuthoringTab`](../../../aisles-admin/src/components/tabs/ContentAuthoringTab.tsx) → `zone_content` table. Storefront [`resolve-zone.ts`](../../src/lib/foundation/resolve-zone.ts) cascade picks up admin content when engine doesn't compose into the zone. Validation uses the storefront's `zone-schemas.ts` at render time (single source of truth). |

---

## 2. Audience-keyed views

The same capabilities, sliced by what each audience extracts.

### 2.1 What product teams see

The capabilities most relevant to "what should we adopt into our roadmap?":

- **Persona-aware composition pattern** (PRD-ENG-002, ENG-008, ENG-009) — observe how a 4-persona model expressed as a probability distribution drives different layouts on the same catalog. Decide if this model belongs in our roadmap as-is, modified, or differently.
- **Storefront/content mode split** (PRD-ENG-006) — a real product feature (HC has no online catalog) implemented as a single config flag. Decide whether mode-aware features belong in your roadmap for content-only / locator-only merchant tiers.
- **Refinement chat** (PRD-ENG-010) — natural-language layout override. Compare to keyword search and filter UX. Decide if conversational refinement is a roadmap capability.
- **The 80-block composition taxonomy** (`composition-taxonomy.md`) — what merchandising primitives the artifact catalogs that today's merchants assemble piecemeal. Bring back the gaps you observe vs. our current product.
- **Decisions Inspector pattern** (PRD-ADM-003) — explainability surface. Decide if any current AI feature in our product line should adopt this pattern (search ranking, recommendations, A/B variant assignment).

### 2.2 What engineering teams see

The capabilities most relevant to "what patterns should we copy into production?":

- **V invariant + structured output cascade** (PRD-ENG-001, ENG-007) — the schema → AI Gateway structured output → Sonnet fallback → static fallback pattern. Copy candidate for any service emitting structured AI output.
- **Layout cache key shape** (PRD-ENG-004) — `(brandId, surface, persona, picksHash)` as a personalization-aware cache key. Pattern is generalizable to any AI-personalized resource.
- **Multi-brand single-codebase** (PRD-ENG-003, FND-002) — one repo, three Vercel projects, env-var-discriminated config. Compare to per-tenant DB isolation; decide which pattern fits production multi-tenancy.
- **Signal pipeline shape** (PRD-XLAYER-002) — client emitter (5s batched, immediate for critical) → server-side merge with request signals → inference. Compare to your current event tracking infrastructure.
- **Vercel AI Gateway routing** (PRD-ENG-007) — model fallback as a config concern, not application code. Decide if this abstraction fits broader AI use.
- **Surface-typed schemas** (PRD-ENG-013, ENG-014) — splitting one big union type into 6 surface-typed schemas. Pattern is broadly applicable to any system that emits surface-shaped output (search results pages, ad units, email layouts, etc.).

### 2.3 What customer success teams see

The capabilities most relevant to "what merchant conversations does this enable?":

- **Decisions Inspector** (PRD-ADM-003, ADM-004) — answers "why did the AI do this?" with a clickable trace. Test in merchant walkthroughs whether this resolves the explainability anxiety incumbents punt on.
- **Voice editor + persona-fit overrides** (PRD-ADM-005, ADM-006) — merchandiser controls without code deploys. Test whether merchants engage with these or push them to dev teams.
- **Multi-brand workspaces** (PRD-ADM-009) — three Bealls brands in one tenant with workspace scoping. Test relevance to multi-banner merchants beyond Bealls.
- **Storefront/content mode split** (PRD-ENG-006) — Home Centric is content-only. Test whether merchants we serve who don't fully sell online (showroom retailers, store-locator-led brands) recognize this as their need.
- **Photographic hero + AI body** (PRD-FND-006, ENG-008) — the brand-chrome / AI-composed boundary. Test whether merchants are comfortable with "AI composes the body, brand owns the hero."

---

## 3. Capability summary — current state of the artifact

| Status | Engine | Foundation | Admin | Cross-layer | Total |
|---|---|---|---|---|---|
| **Demonstrated** today | 12 | 8 | 2 | 2 | **24** |
| **Building** in Phase 1–2 | 1 | 0 | 2 | 1 | **4** |
| **Planned** in Phases 3–6 | 4 | 6 | 6 | 1 | **17** |
| **Total** | 17 | 14 | 10 | 4 | **45** |

24 of 45 capabilities are observable on the live Bealls artifact today. The remaining 21 ship across Phases 1–6 over the demonstration sequence (per STRATEGY §7). The artifact's "completeness" for the experiment is measured by demonstrated coverage of the three hypotheses, not by capability count.

---

## 4. Hypothesis coverage matrix

| Hypothesis | Demonstrated capabilities testing it | Planned capabilities testing it |
|---|---|---|
| **H1 — Schema-typed generative composition is production-viable** | ENG-001, ENG-002, ENG-005, ENG-007, ENG-008, ENG-009, ENG-010, ENG-011, ENG-012, ENG-013, ENG-014, ENG-015, ENG-016, ENG-018, ENG-019, ENG-020, FND-007, FND-008, FND-012, ADM-001, ADM-002, ADM-003, ADM-004, XLAYER-001, XLAYER-002 (25 demonstrated) | — |
| **H2 — Bundling engine + foundation + admin changes outcomes** | ENG-003, ENG-006, ENG-015, ENG-017, FND-001, FND-002, FND-003, FND-004, FND-005, FND-006, FND-009, FND-010, FND-011, FND-012, FND-013, FND-014, ADM-005, ADM-006, ADM-007, ADM-008, ADM-009, ADM-010, XLAYER-001, XLAYER-003, XLAYER-004 (25 demonstrated) | — |
| **H3 — BC-native packaging reaches merchants** | ENG-003, ENG-017, FND-001, FND-002, FND-005, FND-010, FND-014, ADM-009 (8 demonstrated) | — |

As of 2026-05-01, all PRD capabilities across engine, foundation, admin, and cross-layer are demonstrated. Engine + foundation in [`bealls-aisles`](../../); admin + cross-layer contracts in [`aisles-admin`](../../../aisles-admin). H3 is materially tested by the full BC-native packaging path: catalog adapter, checkout handoff, multi-brand routing, locator surface, AND the marketplace-app admin (signed-payload-JWT install flow, embedded iframe, BC-issued session). The BC marketplace listing itself remains an exit-to-product activity (see [`../strategic/exit-criteria.md`](../strategic/exit-criteria.md) and Q-005).

**Open question for product:** does H3 need its own dedicated demonstration phase, or is the H3 evidence in the current artifact sufficient for now? See [`BRD-OPEN-QUESTIONS.md`](BRD-OPEN-QUESTIONS.md) Q-005.

---

## 5. Related documentation

- [`BRD.md`](BRD.md) — internal-team walk-through stories per audience
- [`PRD-COMPANION.md`](PRD-COMPANION.md) — design-time decisions with rationale
- [`BRD-OPEN-QUESTIONS.md`](BRD-OPEN-QUESTIONS.md) — open items for Task #44 follow-on
- [`../strategic/STRATEGY.md`](../strategic/STRATEGY.md) — three hypotheses and per-audience extraction guides
- [`../architecture/engine/composition-taxonomy.md`](../architecture/engine/composition-taxonomy.md) — block × surface × latitude detail
- [`../architecture/decisions/`](../architecture/decisions/) — runtime architecture ADRs
- [`../../traceability.json`](../../traceability.json) — trace ID registry
