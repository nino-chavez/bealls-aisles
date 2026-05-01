## Sponsor pitch — Engineering

**Audience:** engineering team sponsor (staff/principal engineer, EM, or director who can slot a 30–40 min review into a tech-spec or all-hands session)
**Asks for:** 30–40 minutes of one engineer's time + a written bring-back
**Layer(s) demonstrated:** engine
**Anchored on:** [STORY-006](../STORY-006-v-invariant-adoption.md) (V invariant pattern adoption)
**Architectural readouts:** [ADR-004](../../../architecture/decisions/004-vocabulary-constraint-invariant.md) (V invariant), [ADR-006](../../../architecture/decisions/006-surface-typed-schemas.md) (surface-typed schemas)

### 30-second elevator

We have a working AI-composition engine in production, generating typed page layouts under a formal correctness invariant: `∀I, ∀P, f(I, P) → S ∈ V`. Every layout the AI produces is an element of a finite, schema-typed set. Validation runs at the AI SDK boundary, the Vercel AI Gateway handles Haiku → Sonnet fallback at the network layer, and the page renders a static fallback if everything upstream fails. We want 30–40 minutes of one engineer's time to evaluate **whether this pattern belongs in our production services that emit structured AI output** — search facets, recommendations, A/B variant assignments, copy generation. Aisles itself shipping is not the question. Pattern adoption is.

### 30–40-minute agenda

| Minutes | Activity | Reference |
|---|---|---|
| 0–5 | Frame the experiment. Three layers, three audiences. Today's question: is the V invariant pattern + the structured-output cascade reliable enough to copy? | [NORTH-STAR §1](../../NORTH-STAR.md), [STRATEGY §2.2](../../STRATEGY.md) |
| 5–25 | Code review (the spine — don't skip for the live demo). Walk the cascade: Zod schema per surface → AI SDK structured output → AI Gateway model fallback → static fallback in the page component. | [STORY-006 demo path steps 1–4](../STORY-006-v-invariant-adoption.md) |
| 25–32 | Live observation: cold gen → cache hit → `/observe` Layout Decision panel showing model used, persona, latency, cost. Open Vercel AI Gateway dashboard if available; show that ~94% of generations resolve on Haiku. | STORY-006 steps 5–7 |
| 32–40 | Bring-back capture, in the room. Engineer names production candidates and concerns. Empty bring-back = pattern doesn't translate; document why. | [STORY-006 bring-back template](../STORY-006-v-invariant-adoption.md#what-to-bring-back-the-audience-fills-this-in--verbatim) |

### Architectural readouts to surface during the review

- **[ADR-004 — Vocabulary constraint invariant](../../../architecture/decisions/004-vocabulary-constraint-invariant.md):** the formal claim. Every layout is an element of `V`, where `V` is finite and typed in code. This is what makes Observe / explainability possible — you can only surface "which component the AI chose and why" if the components come from a known vocabulary.
- **[ADR-006 — Surface-typed schemas](../../../architecture/decisions/006-surface-typed-schemas.md):** the engineering shape of the invariant. Single LayoutSchema split into 6 per-surface schemas (home, PLP, PDP, cart, checkout, empty). Discriminated union per surface. Trade-off: type safety per surface vs. more files to maintain.
- **AI Gateway as fallback boundary:** `providerOptions.gateway.models: ['anthropic/claude-sonnet-4.6']` in [`src/lib/server/ai-model.ts`](../../../../src/lib/server/ai-model.ts). No application-level retry. One less code path; the cost is vendor lock-in to Vercel AI Gateway.
- **Validation at the SDK boundary, not in app code.** No handwritten `safeParse()` in the route handler. Question for the engineer: is that the right boundary for *your* services?

### What you'll bring back

Verbatim from STORY-006 (full template in the walk-through doc):

- **Pattern adoption recommendation** — adopt the full cascade, adopt partial (name which layers), modify before adoption (name the modification), skip (name what we'd use instead), or inconclusive (name what we need to test next).
- **Production candidates** — name 2+ services with structured AI output where this pattern would apply. This is the load-bearing field. Empty here = pattern doesn't translate.
- **Concerns about adoption** — latency, vendor lock-in, observability gap, debug ergonomics, anything that would block production-grade rollout.
- **What's missing from the artifact** that you'd need to be confident it works at our scale — the known gap is the lack of a deliberate-failure injector (STORY-006 acceptance assumes it; it doesn't exist). Likely first PR if engineering adopts.
- **The "right" boundary for schema validation in our services** — SDK / app / both / neither.

### Bealls touchpoints — what Bealls specifically demonstrates

- **Cache-key shape `(brandId, surface, persona, picks-hash)`.** Layout cache in Upstash Redis, 1-hour TTL. Three brands × six surfaces × four personas × N picks-states = the actual cache pressure. Engineering input on whether this key shape generalizes (or where it breaks).
- **Multi-tenancy via `BRAND_ID` env var + per-brand Vercel project.** Three deployments off `main` (aisles-demo-{1,2,3}), one codebase. Live evidence for the "is this the right multi-tenancy shape vs. database-level isolation?" question in [STRATEGY §2.2 / Q-262](../../STRATEGY.md#22-engineering-teams).
- **AI Gateway routing in real traffic.** Haiku 4.5 primary, Sonnet 4.6 fallback. Observable rate of fallback engagement. Tells you whether the cost/quality numbers in the strategy doc actually pay off.
- **Surface-typed schema cascade in production.** ADR-006 split shipped 2026-04-30; the cascade now runs across home, PLP, PDP, cart, checkout, and empty surfaces. Engineering bring-back: is the per-surface split worth the file count?

### What success looks like for this run

- **2+ production candidates named.** Specific services, not categories. "Search facets" doesn't count; "the type-ahead suggest endpoint in ProductX" does.
- **Concerns named explicitly, with mitigations or follow-ups.** Generic "vendor lock-in" doesn't count; "vendor lock-in unless we abstract the Gateway behind a thin adapter — let's spec that PR" does.
- **At least one architecture decision the engineer would copy regardless of pattern-adoption verdict.** ADR practice itself, the static-fallback-in-page-component shape, the cache-key contract — even one of these is a real win.
