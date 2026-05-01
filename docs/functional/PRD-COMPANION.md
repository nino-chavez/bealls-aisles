# PRD Companion — Design-time Decisions with Rationale

**Version**: 0.4.1
**Last Updated**: 2026-05-01

A companion to [`PRD.md`](PRD.md) that captures the **why** behind each capability that is non-obvious or load-bearing. Format: trace ID → capability → decision → alternatives considered → rationale → reversibility cost.

ADRs in [`../architecture/decisions/`](../architecture/decisions/) capture **runtime** architecture decisions; this companion captures **design-time** product decisions.

---

## Entries

### PRD-ENG-002 — 4-persona probability vector model

- **Decision:** Inference produces a probability distribution over four named personas (gatherer / hunter / researcher / gifter), not a single label, not a continuous embedding, not a 10+ persona taxonomy.
- **Alternatives considered:**
  - Single-label persona ("you are a hunter") — simpler but loses expressiveness; no way to say "60% hunter, 30% researcher."
  - Continuous embedding (TikTok-style) — most expressive but unexplainable to merchants. Merchandisers cannot reason about "this session is at vector position [0.12, 0.61, 0.22, 0.05]."
  - 10+ persona taxonomy — too granular; loses the merchant-legible categorical structure.
- **Rationale:** the 4-persona probability vector is the smallest representation that is both (a) merchant-legible (named categories) and (b) expressive enough to drive layout differences observably. The probability vector lets the engine blend secondary persona elements (a strong hunter session with 25%+ researcher score gets a specs section). The named categories let merchandisers reason about behavior without needing ML training.
- **Reversibility cost:** moderate. Reframing from 4 to 5 personas means schema changes + prompt rewrites + observability changes. Reframing from named-categories to embeddings is much costlier — touches admin UX, observability, and merchant-facing language.

### PRD-ENG-006 — Storefront vs. content brand-mode flag

- **Decision:** Brand mode is a binary flag (`storefront` vs. `content`) at the brand-config level. Mode-aware schemas (transactional surfaces vs. content surfaces) and mode-aware prompts gate which composition is allowed.
- **Alternatives considered:**
  - Per-surface gating ("HC has no PDP") — more granular but harder to reason about. Merchant team needs to think about each surface independently.
  - "Hybrid" mode (some surfaces transactional, some content) — supports edge cases like HC's eventual affiliate-only items but adds 3x complexity to the engine's surface routing.
  - No mode flag (every brand has all surfaces; merchants disable what they don't use) — bleeds transactional patterns into content brands that don't sell online.
- **Rationale:** a binary mode is the smallest abstraction that captures the real merchant distinction (catalog merchant vs. content/locator merchant). Bealls + BF are storefront; HC is content. Hybrid edge cases are vanishingly rare in the BC merchant base; a hybrid mode would over-engineer for them.
- **Reversibility cost:** low. Adding a third mode (e.g., `hybrid`) is additive — existing storefront and content brands are unaffected. Merging to a single mode would be costly because schemas have already split.

### PRD-ENG-013 — Surface-typed schemas (split single LayoutSchema → 6)

- **Decision:** Replace the single discriminated-union `LayoutSchema` with six surface-typed schemas: `HomeLayoutSchema`, `PLPLayoutSchema`, `PDPLayoutSchema`, `CartLayoutSchema`, `CheckoutLayoutSchema`, `EmptyLayoutSchema` (search/locator/account roll into surface-typed schemas as needed).
- **Alternatives considered:**
  - Keep the single schema — simpler at first; AI prompt drift is the failure mode (the AI keeps composing free-form on PDP because the schema allows it).
  - Per-component schemas (each block is its own schema) — too granular; loses the surface-level latitude rules (wide / medium / narrow / fixed).
  - Surface + persona schemas (matrix: 6 surfaces × 4 personas = 24 schemas) — over-specified; persona is a runtime input, not a schema discriminator.
- **Rationale:** the composition latitude principle (NORTH-STAR §3.1, STRATEGY §6) requires that each surface enforces appropriate latitude. The single schema cannot do this — it allows all blocks on all surfaces. Surface-typed schemas are the architectural unlock that makes the V invariant per-surface meaningful.
- **Reversibility cost:** moderate-high. After Phase 3 ships, schema split is deeply assumed by every prompt and renderer. Reverting requires reconciling 6 latitude rules into one; not impossible but expensive.

**Wiring caveat (added 2026-05-01):** Five of six schemas are exercised by live routes (`/api/layout` invoked by home, PLP, cart, checkout, empty/error surfaces). `PDPLayoutSchema` is not — PDP renders foundation primitives plus tag-overlap aggregate zones per [ADR-008](../architecture/decisions/008-tag-as-retrieval-signal.md) Phase B. The schema demonstrates the typing pattern and is exercised in synthetic perf measurements + type-checks, but no production route invokes AI composition on PDP. This is a known divergence between schema capability and live wiring; resolution path is tracked in [BRD Q-013](BRD-OPEN-QUESTIONS.md#q-013--pdplayoutschema-keep-vs-remove-schema-vs-wiring-divergence). Recommendation is **keep as future capability** — removal closes a door for marginal cleanup gain.

### PRD-ADM-003 — Decisions Inspector as the primary admin daily-driver

- **Decision:** The admin's primary daily-driver — the surface a merchant opens the admin to interact with most days — is the Decisions Inspector ("what did the AI just do, and why?"), not a Rules tab.
- **Alternatives considered:**
  - Rules-tab-first (Dynamic Yield, Monetate pattern) — merchants author rules; admin reports rule performance.
  - Experiments-tab-first (Optimizely, Adobe Target pattern) — merchants design A/B tests; admin reports experiment outcomes.
  - CMS-tab-first (Contentful, Sanity pattern) — merchants author content; admin handles publish/preview workflow.
  - Analytics-tab-first (Mixpanel, Amplitude pattern) — merchants explore behavior; admin surfaces dashboards.
- **Rationale:** per the admin-layer competitive research (`docs/research/admin/competitive-survey.md`), no incumbent does explainability well. Adobe Target Auto-Personalization, DY Predictive Targeting, Monetate bandits are black boxes. The merchant-facing question incumbents punt on — "why did the AI do this?" — is the question Aisles' V invariant + typed schemas can answer. Putting the answer at the center of the admin (rather than buried under a Rules tab) is what makes "Aisles tells you why" a real differentiator. Rule authoring drops to secondary.
- **Reversibility cost:** moderate. The Inspector is shipped before the Rules tab in the demonstration sequence (Phase 4 before Phase 5), so the Inspector-first IA is locked in early. Reverting to Rules-first would require IA changes and admin redesign.

### PRD-ADM-009 / PRD-ADM-010 — Workspaces + RBAC on day one

- **Decision:** V1 of the admin includes multi-brand workspaces and 5-role RBAC (Admin / Developer / Editor / Author / Analyst, per Contentful taxonomy). Not deferred to V2.
- **Alternatives considered:**
  - Defer to V2 — common product startup pattern. Faster to ship V1; merchants can use single-tenant at first.
  - Workspaces only, no RBAC — supports multi-brand but assumes one role per workspace.
  - RBAC only, no workspaces — supports role separation but forces multi-brand merchants into one shared admin.
- **Rationale:** Bealls has three brands and an agency relationship. Bealls' team has different operators (merchandiser, brand manager, growth lead, IT) with different access needs. Bealls cannot run on the artifact without workspaces + RBAC; a Bealls-shaped demo without these is unrealistic. Per admin-layer research, retrofitting permissions costs ~10x because every admin endpoint has to grow auth checks; doing it on day one is far cheaper than doing it later.
- **Reversibility cost:** N/A — this decision is "build it now, not later." Reversing would mean removing the capability, which has no cost (no merchants using it yet).

### PRD-XLAYER-001 — Engine ↔ Foundation contract is a typed JSON layout, not a component tree

- **Decision:** The engine emits a typed JSON layout per the surface schema; the foundation's `LayoutRenderer` consumes the JSON and renders Svelte components. The engine does NOT emit Svelte component code, JSX, HTML, or any code-level output.
- **Alternatives considered:**
  - Engine emits component code (JSX/HTML/Svelte) — gives engine more compositional power but breaks the V invariant (no schema validation possible on free-form code) and creates a security risk (LLM-generated code in the render path).
  - Engine emits MDX or templating-language output — same risks.
  - Engine emits a custom DSL — adds DSL design + parser maintenance burden without clear benefit over typed JSON.
- **Rationale:** typed JSON is the smallest representation that (a) is schema-validatable (V invariant), (b) is auditable in the Decisions Inspector (you can read it), (c) is renderer-portable (Svelte today, React tomorrow if needed), (d) has zero security risk (no executable content). This decision is what makes everything else work.
- **Reversibility cost:** very high. Switching to a code-emitting model would break the V invariant, the cache shape, the Inspector, and every existing test. Effectively a rewrite.

---

## Entries pending capabilities to be built

The capabilities below ship in Phases 1–6. Their PRD-COMPANION entries are authored when the design decisions are made (one ADR per architecture decision; one PRD-COMPANION entry per non-obvious product decision):

- **PRD-FND-013** — section authoring model (named insertion zones contract)
- **PRD-ENG-014** — PDP composition with fixed scaffold + named zones
- **PRD-ENG-015** — Cart composition shape
- **PRD-ENG-016** — Checkout composition shape (handoff vs. embed)
- **PRD-ENG-017** — BOPIS strip with proximity awareness
- **PRD-ADM-005** — Brand voice editor (live edit vs. preview-and-publish)
- **PRD-ADM-007** — Rule weight tuning UX (slider vs. numeric vs. percentile)

When these phases ship, append PRD-COMPANION entries here with the design-time rationale. Append-only — never edit a settled entry.

---

## Related documentation

- [`PRD.md`](PRD.md) — capabilities table
- [`BRD.md`](BRD.md) — walk-through stories
- [`../architecture/decisions/`](../architecture/decisions/) — runtime architecture ADRs
