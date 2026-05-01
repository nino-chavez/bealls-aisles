# Aisles — Internal-team Walk-through Stories

**Version**: 0.4.0
**Last Updated**: 2026-04-30
**Audience**: commerce.com internal teams — product, engineering, customer success

> Per the experimental framing in [`STRATEGY.md`](../strategic/STRATEGY.md), this doc captures **stories about how internal teams interact with the Bealls artifact** — not user stories about hypothetical merchant features.
>
> Every story binds to PRD capabilities (trace IDs in [`PRD.md`](PRD.md)) and to one of the three hypotheses in STRATEGY §3. Stories are grouped by audience.

---

## How to read this doc

Stories follow this shape:

```
ID: STORY-NNN
Trace IDs: [PRD-ENG-NNN, PRD-ADM-NNN]   ← capabilities the story exercises
Hypothesis: H1 / H2 / H3                ← which hypothesis the story tests
Audience: Product / Engineering / Customer Success / Bealls (observed)
Story: As a <role>, walking through <part of artifact>, I want to
       <observe something>, so I can <extract takeaway>.
Acceptance: <what successful walk-through looks like>
What they bring back: <concrete artifact: roadmap item / pattern doc / merchant transcript>
```

The "what they bring back" field is the key output — the experiment is only valuable if walk-throughs produce artifacts internal teams act on.

---

## 1. Stories — Product teams

### STORY-001 — Persona model fit

- **Trace IDs:** PRD-ENG-002, PRD-ENG-008, PRD-ENG-009
- **Hypothesis:** H1
- **Story:** As a product manager evaluating the persona model, walking through the same Bealls home page with `?intent=hunter`, `?intent=gatherer`, `?intent=researcher`, and `?intent=gifter` in sequence, I want to observe how a 4-persona probability vector drives different layouts, so I can decide whether this specific persona model belongs in our roadmap, whether we need a different model, or whether merchants want to author their own.
- **Acceptance:** Walk-through shows four distinct compositions of the same catalog. PM can name which persona maps to which layout pattern (hunter → price-rail + dense grid; gatherer → editorial-hero + lifestyle; etc.). PM can articulate the "why" for each layout.
- **What they bring back:** A recommendation to the broader product team — adopt as-is / modify / merchant-authored / skip — with reasoning bound to observed merchant scenarios.

### STORY-002 — Block catalog gaps

- **Trace IDs:** PRD-ENG-008, PRD-ENG-009 (consumes composition-taxonomy.md)
- **Hypothesis:** H2
- **Story:** As a product manager reviewing the 80-block composition taxonomy, comparing it against our current product's merchandising primitives, I want to identify which blocks are present in the artifact but absent from our roadmap, so I can surface gaps to the product team.
- **Acceptance:** PM produces a delta list — "artifact has X, our roadmap has Y, the delta is Z" — with merchant-value justifications attached.
- **What they bring back:** A delta document feeding the next roadmap planning cycle. Not commitments — observations.

### STORY-003 — Storefront vs. content mode

- **Trace IDs:** PRD-ENG-006
- **Hypothesis:** H2
- **Story:** As a product manager looking at Home Centric (no online catalog, locator-led, content-only), I want to walk through what makes the engine treat HC differently than the transactional brands, so I can decide whether mode-aware features belong in our roadmap for showroom retailers / locator-led brands / B2B catalogs.
- **Acceptance:** PM can explain the storefront/content split — different schema subset, different prompt, different engagement CTAs (locator instead of cart). PM can identify 2+ merchants in our existing portfolio who would benefit from this mode.
- **What they bring back:** A capability brief sized for product review — "should our product line support a content-mode tier?"

### STORY-004 — Refinement chat as alternative search/filter

- **Trace IDs:** PRD-ENG-010
- **Hypothesis:** H1
- **Story:** As a product manager comparing conversational refinement to keyword search and faceted filter, I want to use the refinement chat on a Bealls PLP and observe how natural language updates the layout, so I can decide whether conversational refinement is a roadmap capability or a UX dead-end.
- **Acceptance:** PM types 3+ refinements ("show me cheap stuff" / "I want more options" / "what works for outdoor?") and observes layout response. PM can articulate failure modes (ambiguous queries, conflicting refinements).
- **What they bring back:** Recommendation to product team on conversational refinement: roadmap-priority / explore-further / not-our-shape.

### STORY-005 — Decisions Inspector as a merchant-trust mechanism

- **Trace IDs:** PRD-ADM-003, PRD-ADM-004
- **Hypothesis:** H1
- **Story:** As a product manager reviewing the Decisions Inspector mockups (or the live capability once built in Phase 4), I want to understand what the explainability surface answers that incumbent personalization tools don't, so I can decide whether explainability investments are roadmap-worthy across our product line (search ranking, recommendations, A/B variants).
- **Acceptance:** PM can articulate what the Inspector answers (signal → inference → prompt → AI output → validated layout → render). PM can name 2+ existing product features that would benefit from an analogous explainability surface.
- **What they bring back:** Recommendation on whether to extend the Inspector pattern to other AI features in our product line.

---

## 2. Stories — Engineering teams

### STORY-006 — V invariant pattern adoption

- **Trace IDs:** PRD-ENG-001, PRD-ENG-007
- **Hypothesis:** H1
- **Story:** As an engineer evaluating Aisles' schema-typed AI output approach, walking through the validation cascade (Zod → AI Gateway structured output → Sonnet fallback → static fallback), I want to inject a malformed AI response and observe the cascade engaging, so I can decide whether the V invariant pattern is worth adopting in production services that emit structured AI output (search facets, recommendation cards, A/B variant assignments).
- **Acceptance:** Engineer triggers a deliberate schema violation (mock); observes Sonnet fallback engaging; observes static layout fallback as last resort. No invalid layout reaches the renderer at any point.
- **What they bring back:** A pattern document — "structured AI output with formal correctness invariant" — sized for adoption review at engineering all-hands.

### STORY-007 — Layout cache key shape

- **Trace IDs:** PRD-ENG-004
- **Hypothesis:** H1
- **Story:** As an engineer evaluating personalization-aware caching, looking at how `(brandId, surface, persona, picksHash)` keys interact with cache hit rate, TTL behavior, and invalidation, I want to understand whether this key shape generalizes to other personalized resources (search results, recommendations, email templates), so I can apply the pattern in other production services.
- **Acceptance:** Engineer can articulate the cache key dimensions, the hit-rate floor, and what triggers invalidation. Engineer identifies 2+ analogous production caches that could adopt this pattern.
- **What they bring back:** A cache-key-shape memo describing the pattern and identifying production candidates.

### STORY-008 — Multi-brand single-codebase pattern

- **Trace IDs:** PRD-ENG-003, PRD-FND-002
- **Hypothesis:** H2, H3
- **Story:** As an engineer evaluating multi-tenancy strategies, comparing the `BRAND_ID` env var + per-brand Vercel project pattern to per-tenant database isolation, I want to walk through how brand boundaries hold (cache, routing, config), so I can decide which multi-tenancy pattern fits production work.
- **Acceptance:** Engineer can identify the failure modes of each pattern (the Bealls cache pollution bug fixed 2026-04-30 is a specific learning). Engineer can articulate when env-var multi-tenancy is sufficient vs. when DB isolation is required.
- **What they bring back:** A multi-tenancy decision memo — when to use which pattern, with the Bealls cache-key fix as a concrete example.

### STORY-009 — Signal pipeline shape

- **Trace IDs:** PRD-XLAYER-002
- **Hypothesis:** H1
- **Story:** As an engineer evaluating the foundation-emits → engine-consumes signal pipeline (5s batched flush, immediate flush for high-priority events), I want to compare it to our current event tracking infrastructure, so I can decide whether to copy the pattern, integrate with it, or replace it.
- **Acceptance:** Engineer can articulate the pipeline's properties (batching, latency budget, conflict with browser privacy regs). Engineer maps the pipeline to comparable infrastructure (Segment, Snowplow, in-house) and identifies coexistence boundaries.
- **What they bring back:** Pipeline-comparison doc + recommendation to platform engineering.

### STORY-010 — Surface-typed schemas as a shippable pattern

- **Trace IDs:** PRD-ENG-013, PRD-ENG-014
- **Hypothesis:** H1
- **Story:** As an engineer evaluating the schema split (single LayoutSchema → 6 surface-typed schemas), I want to walk through the latitude rules per surface (wide on home, narrow on PDP, fixed on cart/checkout), so I can decide whether surface-typed schemas are a broadly applicable pattern for any system that emits surface-shaped output.
- **Acceptance:** Engineer can identify 2+ production systems where surface-typed output would replace stringly-typed JSON or generic discriminated unions (search result pages, ad units, email templates, in-app notifications).
- **What they bring back:** A schema-split adoption recommendation.

### STORY-011 — Vercel AI Gateway abstraction

- **Trace IDs:** PRD-ENG-007
- **Hypothesis:** H1
- **Story:** As an engineer evaluating AI abstraction layers, walking through how Vercel AI Gateway handles model routing + fallback + cost tagging vs. direct Anthropic/OpenAI clients, I want to decide if this abstraction is worth adopting more broadly or if it's premature.
- **Acceptance:** Engineer can name the gateway's load-bearing features (fallback, cost dashboarding, model-string format) and identify when they're worth the abstraction tax vs. when they're not.
- **What they bring back:** A platform-engineering memo on AI gateway adoption criteria.

---

## 3. Stories — Customer success teams

### STORY-012 — Merchant explainability demand

- **Trace IDs:** PRD-ADM-003, PRD-ADM-004
- **Hypothesis:** H1
- **Story:** As a CS member walking a prospective merchant through Aisles, demonstrating the Decisions Inspector for "why did the AI show this layout to this shopper?", I want to observe the merchant's reaction so I can decide if explainability is a winning conversation lever or a feature merchants ignore.
- **Acceptance:** CS member captures merchant's verbatim reaction. Did they engage with the trace? Did they ask follow-up questions? Or did they treat it as a developer feature and move on?
- **What they bring back:** Merchant transcripts (verbatim) plus a decision matrix — "for which merchant types does explainability close the deal vs. fall flat."

### STORY-013 — Bealls property generalizability

- **Trace IDs:** PRD-ENG-003, PRD-ENG-006, PRD-FND-005
- **Hypothesis:** H2 (and tests RISK-08: Bealls overfitting)
- **Story:** As a CS member who knows our merchant portfolio well, after seeing the Bealls demo, I want to map Bealls' properties (off-price, family-of-brands, BOPIS, content-mode HC, comparable-value pricing) against our top 20 merchants to identify which Bealls properties recur and which are Bealls-specific.
- **Acceptance:** CS member produces a property-recurrence table. For each Bealls property: does it apply to ≥10 of our top 20 merchants? Is it concentrated in a vertical?
- **What they bring back:** A merchant-property mapping that informs whether the artifact's findings generalize and where a second example merchant would be most informative (RISK-08 mitigation).

### STORY-014 — "AI authoring" vs. "AI assistance" merchant preference

- **Trace IDs:** PRD-ENG-008, PRD-ENG-009 (the generative composition itself)
- **Hypothesis:** H1, RISK-06
- **Story:** As a CS member walking merchants through Aisles' generative composition (the AI authors the layout, merchant approves at preview), versus the variant-authoring AI pattern (Adobe AI Assistant: AI helps the merchant author faster), I want to observe which merchants gravitate toward which pattern, so I can determine if "merchant rejects 'AI built something we didn't approve'" (RISK-06) is structural or addressable.
- **Acceptance:** CS member runs at least 5 merchant conversations; captures verbatim language merchants use ("can we approve every layout?" / "we want AI help, not AI doing it" / "we'd love this"). Identifies the inflection point (merchant tier? vertical? team size?).
- **What they bring back:** A merchant-preference memo informing whether generative composition is a viable wedge or whether a preview-and-approve workflow is mandatory.

### STORY-015 — Storefront vs. content mode merchant fit

- **Trace IDs:** PRD-ENG-006
- **Hypothesis:** H2
- **Story:** As a CS member walking merchants through Home Centric's content-only mode (no cart, no PDP, locator-led), I want to identify which merchants in our portfolio recognize this as their need (showroom retailers, in-store-led brands, etc.), so I can size the content-mode tier opportunity.
- **Acceptance:** CS member captures verbatim merchant reactions, identifies 3+ candidate merchants, and notes the value props that resonated.
- **What they bring back:** A content-mode prospect list + value-prop framing memo.

### STORY-016 — Multi-brand workspaces relevance

- **Trace IDs:** PRD-ADM-009
- **Hypothesis:** H2
- **Story:** As a CS member walking multi-banner merchants through the Bealls + BF + HC workspace setup (three brand workspaces under one tenant, RBAC scoping prevents cross-brand visibility), I want to see if this pattern matches their organizational reality, so I can decide whether multi-brand workspaces are a marketed feature or a Bealls-specific configuration.
- **Acceptance:** CS member confirms with at least 3 multi-banner merchants whether the workspace pattern matches their org structure.
- **What they bring back:** A multi-brand-relevance memo.

### STORY-017 — Productization sentiment capture

- **Trace IDs:** all (the artifact as a whole)
- **Hypothesis:** all three
- **Story:** As a CS member running merchant walk-throughs, I want to capture verbatim productization sentiment — "can we buy this?" / "can we hire commerce.com to build this for us?" / "we'd love this if it worked with our existing tools" — so leadership has evidence-backed input for any future productization decision.
- **Acceptance:** CS member maintains a running list of merchant productization quotes, tagged with merchant size, vertical, and which capability prompted the reaction.
- **What they bring back:** Quarterly productization-sentiment summary feeding the productization conversation if/when it happens.

---

## 4. Stories — Bealls (observed during engagement)

These are not speculative future-merchant stories. They are stories captured during the actual Bealls engagement — what their team said and did when interacting with the artifact.

### STORY-018 — Bealls merchandising team reaction to AI homepage

- **Trace IDs:** PRD-ENG-008, PRD-FND-006, PRD-FND-008
- **Hypothesis:** H1
- **Story:** During the Bealls demo, when the merchandising team sees the AI compose a Bealls homepage live with the LayoutBuildingState progress indicator, what is their unprompted first reaction? Where do they linger? What do they ask to change? What language do they use?
- **Acceptance:** Verbatim reaction captured during walk-through.
- **What they bring back:** Concrete merchant language for objection-handling and pre-sales materials.

### STORY-019 — Bealls Florida brand voice fidelity

- **Trace IDs:** PRD-ENG-008, PRD-ADM-005
- **Hypothesis:** H2
- **Story:** When the Bealls brand manager reviews the AI-generated copy across Bealls / BF / HC and compares to their actual brand guidelines, where does the AI nail the voice and where does it miss? What edits would they make if they could edit the voiceGuidance directly?
- **Acceptance:** Brand manager produces a side-by-side: "AI got this right / AI got this wrong / I'd change the voiceGuidance to X."
- **What they bring back:** Voice-fidelity evidence + the brand-voice editor (PRD-ADM-005) priority signal.

### STORY-020 — Bealls Bucks loyalty surface walk-through

- **Trace IDs:** PRD-FND-004, future PRD-ENG capabilities for loyalty
- **Hypothesis:** H2
- **Story:** When Bealls' loyalty team sees how Bealls Bucks could be surfaced (header pill, PDP earn-preview, cart redemption, PLP dual-currency framing) — what surfaces matter most to them? Which would shift conversion in their existing data? Which feel like overreach?
- **Acceptance:** Loyalty team produces a prioritized surface list with their data-backed expectations of impact.
- **What they bring back:** A loyalty-surface integration memo informing the eventual loyalty roadmap.

### STORY-021 — HomeCentric content-mode realism check

- **Trace IDs:** PRD-ENG-006
- **Hypothesis:** H2
- **Story:** When HC's team sees their brand running on Aisles in content-only mode (no cart, locator-led, in-store-event surfaces), do they recognize it as "what HC actually does" or do they push back on missing capabilities (e.g., "we do sell some things online via affiliate")?
- **Acceptance:** HC team produces a fit/gap list against the content-mode tier.
- **What they bring back:** Content-mode realism evidence + product-tier sizing input.

---

## 5. Stories not yet authored

The 21 stories above cover the demonstrated and Phase 1–2 building capabilities. As Phases 3–6 ship, additional stories should be authored to exercise the Phase 3+ capabilities (PDP composition, Decisions Inspector, RBAC, locator + BOPIS). Author them in this doc as the relevant phase ships, before the walk-throughs happen.

---

## 6. Walk-through cadence (the experiment's success conditions)

The experiment only succeeds if the stories above translate into walk-throughs and walk-throughs translate into the "what they bring back" artifacts. Mitigation for RISK-07 (vanity demo, no team adoption):

- **Cadence:** structured walk-throughs embedded in each audience's existing forum:
  - **Product:** quarterly product review, 30-min slot per quarter
  - **Engineering:** monthly all-hands, 15-min spotlight
  - **Customer success:** weekly pre-sales sync, 5-min show + tell from the prior week's merchant conversations
- **Templates:** "what to bring back" templates per audience (referenced in [`STRATEGY.md`](../strategic/STRATEGY.md) §2). One page each. Used as the walk-through output format.
- **Backstop:** if synchronous walk-throughs don't scale, convert to self-serve — recorded videos + click-through paths + per-audience deep-link entry points into the artifact.

---

## 7. Related documentation

- [`PRD.md`](PRD.md) — capabilities the stories exercise
- [`PRD-COMPANION.md`](PRD-COMPANION.md) — design-time decisions
- [`BRD-OPEN-QUESTIONS.md`](BRD-OPEN-QUESTIONS.md) — open items for follow-on
- [`../strategic/STRATEGY.md`](../strategic/STRATEGY.md) §2 — per-audience extraction guides
- [`../strategic/risks.md`](../strategic/risks.md) — RISK-07 (vanity demo) and RISK-08 (Bealls overfitting) shape the walk-through cadence
- [`../strategic/engagements/bealls.md`](../strategic/engagements/bealls.md) — engagement plan that produces the artifact
- [`../../traceability.json`](../../traceability.json) — trace ID registry
