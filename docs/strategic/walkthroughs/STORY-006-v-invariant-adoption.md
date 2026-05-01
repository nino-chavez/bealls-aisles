## STORY-006 walk-through — V invariant pattern adoption

**Audience:** engineering
**Hypothesis tested:** H1 (schema-typed generative composition is production-viable)
**Layer(s) exercised:** engine
**Trace IDs:** PRD-ENG-001, PRD-ENG-007
**Time budget:** 30–40 min (code review + live observation + bring-back capture)
**Prereqs:** repo checked out (`~/Workspace/dev/wip/bealls-aisles`), browser DevTools, terminal. No write access to env needed.

### The question we're testing

Is the schema-typed structured-output pattern (Zod schema → Vercel AI Gateway structured output → Sonnet fallback → static fallback in the page) reliable enough to copy into production services that emit structured AI output (search facets, recommendation cards, A/B variant assignments, copy generation)?

### Demo path

This walk-through is **code-review-driven** — there is no in-app "inject malformed response" affordance today. The cascade is observable through (a) the code, (b) Vercel AI Gateway logs, and (c) the runtime behavior when the upstream model is temporarily unavailable. If the audience wants live failure injection, treat it as a bring-back item, not a precondition.

| # | Action | Where | What to observe |
|---|---|---|---|
| 1 | Read the schema definition | `src/lib/schema/layout.ts` (look up `getLayoutSchemaForSurface`) | One typed Zod schema per surface (home, PLP, PDP, cart, checkout, empty). The V invariant `S ∈ V` is encoded as a discriminated union per surface. |
| 2 | Read the structured-output call | `src/routes/api/layout/+server.ts:75-86` | `generateText({ output: Output.object({ schema: layoutSchema }), … })` — the AI SDK enforces validation server-side before returning. Any output that doesn't parse never reaches application code. |
| 3 | Read the gateway fallback config | `src/lib/server/ai-model.ts:31-43` | `providerOptions.gateway.models: ['anthropic/claude-sonnet-4.6']` — Gateway fails over to Sonnet at the network layer when Haiku errors or rate-limits. No application-level retry logic. |
| 4 | Read the static fallback | `src/routes/+page.svelte:13-36, 91-145` | When `/api/layout` throws, `aiError` is set and the page renders a static featured-products section. Shopper still sees a working storefront. |
| 5 | Observe a healthy generation live | `https://aisles-demo-1-signal-x-studio-labs.vercel.app/?intent=hunter` with DevTools → Network → `/api/layout` POST | Response body is a typed layout. Surface, persona, blocks all match schema. Generation latency in `meta.generationTimeMs`. |
| 6 | Observe a cache hit | Reload the same URL within 1h | `meta.cacheHit: true`, latency drops to <100ms. Same typed layout structure. |
| 7 | Observe Gateway routing | `…/observe` → Layout Decision panel → `model` field | Shows `claude-haiku-4.5` for ~94% of generations. If you ever see `claude-sonnet-4.6` for a request, that's the Gateway-level fallback engaging. |

### What to observe (specific, falsifiable)

- **Schema validation is at the SDK boundary, not in application code.** No handwritten `safeParse()` calls in the route handler. The structured-output mode enforces it. Is that the right boundary for your services, or do you want the validation visible in app code?
- **Per-surface schemas are discriminated unions, not one big schema.** ADR-006 split a single LayoutSchema into 6 surface-typed ones. Trade-off: type safety per surface, more files to maintain. Worth it?
- **Static fallback is in the page component, not the API.** `/api/layout` returns 500 on failure; `+page.svelte` catches and renders a featured grid. Production-shape pattern (UI degrades gracefully) — or do you want fallback inside the API?
- **No application-level retry between Haiku and Sonnet.** It's a Gateway concern. One less code path to maintain — at the cost of vendor lock-in to Vercel AI Gateway. Acceptable?
- **The audit chain (signals → inference → prompt → AI output → validated layout → render) is reconstructible from logs.** Engineering bring-back: is this enough for incident debugging in our production environments?

### What's NOT in the artifact today (flag this as a bring-back item, not a blocker)

- **No deliberate-failure injector.** STORY-006 acceptance assumes "engineer triggers a deliberate schema violation (mock); observes Sonnet fallback engaging." That facility doesn't exist; the cascade has only been observed via real upstream errors. If engineering wants this, scope it as a 2–4 hour PR adding a dev-mode `?simulate=schema-fail|gateway-down` query param to the API.
- **Gateway-level fallback metrics are not exposed in `/observe` directly** — you'd need Vercel AI Gateway's dashboard. Bring-back: would surfacing `which-model-actually-served-this` per request in our own dashboards be valuable?

### What to bring back (the audience fills this in — verbatim)

```
Run date:
Audience role (engineer / staff / etc.):
Pattern adoption recommendation (one of):
  ☐ Adopt the full cascade (Zod + structured output + Gateway fallback + UI static fallback)
  ☐ Adopt partial — name which layers:
  ☐ Modify before adoption — name the modification:
  ☐ Skip — name what we'd use instead:
  ☐ Inconclusive — name what we need to test next:

Production candidates I'd apply this pattern to (name 2+ services with structured AI output):

Concerns about adoption (latency, vendor lock-in, observability gap, debug ergonomics, etc.):

What's missing from the artifact that I'd need to be confident the pattern works at our scale:

The "right" boundary for schema validation in our services (SDK / app / both / neither):
```

### Failure modes to flag during the walk-through

- If the engineer can't articulate the cascade after the code review, the code is too implicit — flag for documentation, not for the engineer.
- If `claude-sonnet-4.6` shows up for ≥10% of generations in `/observe`, the Haiku model is not as reliable as PRD-ENG-007 claims — flag as PRD-trace inconsistency.
- If the engineer's bring-back is "neat" with empty production candidates: the pattern doesn't translate; document why and update RISK-07.

### Notes for the host

- The code review portion is the spine. Don't skip it for the live demo — engineers extract patterns from code, not screenshots.
- The "no failure injector" gap is real and worth discussing openly. It's also a likely first PR from engineering if they decide to adopt the pattern.
- Vercel AI Gateway lock-in is a non-trivial concern. STORY-011 (Gateway abstraction) explicitly tests this; cross-reference if engineering wants more depth.
