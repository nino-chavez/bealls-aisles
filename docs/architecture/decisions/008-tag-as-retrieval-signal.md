# ADR 008: Semantic tags as a first-class retrieval signal

Status: Accepted
Date: 2026-05-01
Deciders: Nino Chavez, Claude (Opus 4.7)

## Context

The enrichment pipeline (per ADR-001) already scores each product on persona-fit and tags it with semantic labels (e.g., `cozy`, `statement-piece`, `dorm-friendly`, `breathable`, `vacation-ready`). These tags are stored alongside persona-fit scores in the Neon Postgres enrichment table. They flow into:

- **Persona-fit scoring** — tags inform the 4-persona vector during enrichment
- **Layout copy generation** — the AI prompt references tags when writing per-section copy

They do NOT flow into:

- **Search and filter** — tags aren't queryable from the storefront. A shopper searching "cozy" matches via keyword on title/description, not via the `cozy` tag.
- **Cross-sell / recommendations / "also bought" / "complete the look"** — these surfaces don't exist yet; when they ship in Phase 3, they need a substrate. We don't have co-purchase history (cold-start) and we'd rather not add a behavioral data warehouse for the experiment.
- **Refinement chat** — natural language like "warm and casual for lounging" updates persona probabilities but doesn't extract semantic-tag intents to filter/rerank against.

Google's "AI Max for Shopping" announcement (2026-04-30) made this gap explicit. Their framing — product context = enriched attributes (fabric softness, durability, fit) matched against conversational shopping intent — describes exactly what semantic tags are. They use it for retrieval; we use it for composition only. Our enrichment is a richer substrate than we currently consume.

The composition-taxonomy.md catalog includes ~10 P0 blocks (also-bought-carousel, complete-the-look, recently-viewed, for-you-row) that would naturally consume a retrieval signal. Phase 3 ships PDP and cart specialization, both of which include cross-sell zones. Without a defined substrate, those zones will land as ad-hoc heuristics or stubs.

## Decision

**Promote semantic tags from a copy-generation/scoring signal to a first-class retrieval signal.** Specifically:

1. **Tag intent extraction in refinement chat.** Refinement chat input produces TWO outputs: a persona-vector update (existing) AND a tag-intent vector (new). Engine reads both when composing. Example: "warm and casual for lounging" → `{ persona: shift toward gatherer, tagIntents: [cozy, casual, warm, loungewear] }`.

2. **Tag-overlap product neighborhoods.** Add a query in the enrichment data layer: given product P, return products with N or more overlapping tags, ordered by Jaccard similarity (or a similar overlap score). This becomes the substrate for `also-bought-carousel`, `complete-the-look`, `recently-viewed-similar`, and `for-you-row` — none of which require co-purchase history.

3. **Tag-aware layout consumption.** Foundation cross-sell zones (defined in ADR-007 zone catalog: `pdp.cross-sell`, `cart.cross-sell`, `pdp.recently-viewed`) call the tag-overlap query directly when populating their products array. The engine doesn't need to hold the whole catalog in prompt; it gets a pre-filtered, pre-scored slice.

The V invariant strengthens: products are typed by their tag set, and retrieval is a typed query over that type space. Explainability tightens — "we showed this product because it shares 4 of 5 tags with the one you're viewing" is a sentence the Decisions Inspector (Phase 4) can render verbatim.

## Alternatives considered

### Option A: Behavioral / co-purchase recommendations

- Pros: industry standard; what Amazon does
- Cons: requires behavioral data warehouse we don't have; cold-start problem for new products and brands; no first-day signal; misaligned with Aisles' competitive wedge ("reasoning-based, not statistical" per NORTH-STAR §7)
- Verdict: rejected. We deliberately bet against the statistical-co-purchase model in ADR-001.

### Option B: Embedding-based similarity (vector retrieval)

- Pros: more flexible than tag overlap; captures latent similarity without explicit tags
- Cons: less explainable (the Decisions Inspector can't say "this product was selected because vector position [0.12, 0.61, ...]"); requires an embedding pipeline + vector DB; loses the typed-vocabulary principle of the V invariant; more expensive per query
- Verdict: rejected for now. May revisit if tag-overlap proves insufficient. Embedding is a strictly *more* powerful technique but breaks the explainability story that's our admin-layer wedge (per STRATEGY §2.4).

### Option C: Keep tags as copy-generation only (status quo)

- Pros: zero new work
- Cons: doesn't close the gap Google's framing surfaced; Phase 3 cross-sell zones land without a defined substrate; competitive positioning ("we tag richly and use them for everything") stays narrower than it could be
- Verdict: rejected. The gap is real and the cost of closing it is bounded.

### Option D (chosen): Tag overlap as retrieval substrate, layered on existing enrichment

- Pros: builds on infrastructure we already have; cold-start safe (every product gets tags on day one of enrichment); explainable (tag overlap is human-readable); typed (tags are a finite, growing vocabulary); cheap (set operations on tag arrays); aligned with the V invariant philosophy
- Cons: tag vocabulary becomes a load-bearing dimension that needs governance (when tags change, neighborhoods need recomputation — see Consequences below)
- Verdict: chosen.

## Consequences

### Positive

- **Phase 3 cross-sell zones get a defined substrate.** PDP `also-bought-carousel`, cart `cross-sell`, PDP `recently-viewed` all consume tag-overlap queries. No ad-hoc heuristics; no waiting for co-purchase data.
- **Decisions Inspector explainability sharpens.** "Selected because 4 of 5 tags overlap" is concrete; "selected because [vector ranking]" is hand-wave.
- **Refinement chat unblocks conversational filter.** Natural language → tag intents → reranked product set. Closes the most direct gap from the Google AI Max framing.
- **Competitive wedge widens.** "We tag richly + we use the tags for composition AND retrieval AND recommendations" is tighter than "we tag richly and use them for composition." Per STRATEGY §3.4 steel-man, this responds to the "schema-typed AI is just typed composition" critique.
- **Cold-start safe.** New products get tags during enrichment; they have a retrieval profile on day one. New brands inherit the same property.

### Negative

- **Tag vocabulary becomes load-bearing.** Today, tags are emergent from Haiku-4.5 enrichment with light supervision. Once they're a retrieval substrate, the vocabulary needs governance: a tag-set drift between enrichment runs would invalidate neighborhood relationships. Mitigation: lock the tag vocabulary at enrichment time per product version; recompute neighborhoods only when vocabulary changes meaningfully. Open question Q-011 below.
- **Tag-coverage variance.** Some products have rich tag sets (15+); others have sparse sets (3–5). Sparse products will appear in fewer neighborhoods. Mitigation: enrichment quality flag; products with sparse tags get a lower-priority placement in cross-sell zones.
- **The "what's a good tag" question becomes a product question.** Today it's an enrichment-prompt question. When merchants see Decisions Inspector output saying "shown because 4 tag overlap," they may push back on which tags are or aren't applied to their products. This is downstream merchant-control work (Phase 5 admin); flagged here.

### Reversibility cost

**Low-moderate.** Tag-overlap is a query layer, not an architectural commitment. If it proves insufficient, switching to embedding-based retrieval (Option B) is a query-layer swap — the consuming surfaces (cross-sell zones) don't care which substrate populates their product array. Rip-and-replace ~3 days of work, none of it requiring schema migration.

If we revert tag-as-retrieval entirely, we lose the cross-sell zones' substrate and Phase 3 stalls. So this isn't reversible in the "delete and undo" sense; it's reversible in the "swap the implementation behind the same interface" sense.

## Trace IDs

- **PRD-ENG-018** (NEW) — Refinement chat tag-intent extraction (alongside persona-vector update). NL → `{ persona, tagIntents }`. Engine reads both during composition.
- **PRD-ENG-019** (NEW) — Tag-overlap product neighborhood query. `getProductsByTagOverlap(productId, minOverlap, limit) → Product[]`. Foundation cross-sell zones consume directly.
- **PRD-ENG-010** (refinement chat) — affected. Gains a second output dimension; existing persona-vector behavior unchanged.
- **PRD-ENG-011** (product enrichment with persona-fit scoring) — affected indirectly. Tag generation already happens; this ADR doesn't change enrichment, only consumption.
- **PRD-ENG-014** (PDP composition) — depends on PRD-ENG-019 for `pdp.cross-sell`, `pdp.recently-viewed` zones.
- **PRD-ENG-015** (Cart composition) — depends on PRD-ENG-019 for `cart.cross-sell` zone.
- **PRD-XLAYER-001** (Engine ↔ Foundation contract) — refined. Foundation zones now have a typed retrieval contract for product-set population, in addition to the layout-JSON contract.

## Implementation outline

Three phases, increasing in scope:

### Phase A — Tag-intent extraction in refinement chat (~1 day agent)

- Update refinement-chat handler to extract tag intents from NL alongside the persona update. Cheapest implementation: pass NL to a small Haiku call with the brand's tag vocabulary, return `string[]` of intended tags.
- Update `/api/layout` request shape to accept `tagIntents?: string[]`.
- Update `loadCategoryProducts()` and `loadHomeProducts()` to filter/rerank products when `tagIntents` is non-empty.

### Phase B — Tag-overlap neighborhood query (~1.5 days agent)

- Add `getProductsByTagOverlap(productId, opts)` to the enrichment query layer. Returns ranked similar products.
- Make it Phase 3-ready: cross-sell zones call this directly to populate their `products` array.
- Tag-overlap scoring: Jaccard similarity by default; consider weighted variants once the query is in production.

### Phase C — Tag vocabulary governance (~deferred)

- Document the tag vocabulary as an authoritative artifact in `docs/architecture/engine/tag-vocabulary.md`.
- Decide tag versioning policy (Q-011 below).
- Build merchant-side controls in admin to view + override tag assignments per product (Phase 5 admin work).

Phase A unblocks the refinement-chat improvement. Phase B unblocks Phase 3 cross-sell zones. Phase C is deferred until merchants raise the question (likely surfaced in walk-throughs).

## Open questions surfaced by this ADR

- **Q-011: Tag vocabulary versioning.** When the tag set changes (new tags added during enrichment, old tags deprecated), do existing tag-overlap neighborhoods invalidate? Options: (a) implicit versioning per enrichment run; (b) explicit `tagVocabulary@N` versioning with merchant-visible upgrades; (c) defer until first real divergence pressure. Recommend (a) plus a freshness flag on the neighborhood query, but not load-bearing for Phase A or B.

- **Q-012: Cold-start for tag intents.** When the refinement chat returns no tag intents (NL is too generic, e.g., "show me stuff"), does the engine fall back to persona-only ranking, or does it skip tag intents entirely? Recommend the former — tag intents are an additional signal, not a replacement for persona ranking.

These questions are added to BRD-OPEN-QUESTIONS.md in the same commit as this ADR.

## Related

- ADR-001 (enrichment vs. Feedonomics) — established the reasoning-based, not statistical enrichment philosophy this ADR extends
- ADR-004 (vocabulary-constraint invariant) — the V invariant; this ADR strengthens it by typing the retrieval space
- ADR-006 (surface-typed schemas) — surface schemas reference the cross-sell zones this ADR provides the substrate for
- ADR-007 (section authoring model) — zone catalog includes cross-sell zones; this ADR defines what populates them
- [`composition-taxonomy.md`](../engine/composition-taxonomy.md) — block catalog includes the cross-sell blocks this enables
- [`STRATEGY.md`](../../strategic/STRATEGY.md) §2.4, §3.4 — the explainability wedge this widens
- Google "AI Max for Shopping" announcement (2026-04-30) — external framing that surfaced the gap
