# Decision: Cloudflare AI Gateway (not Portkey)

**Date:** 2026-05-05
**Decision:** Migrate the AI gateway layer from Vercel AI Gateway to **Cloudflare AI Gateway**. Drop Portkey from consideration.
**Decided by:** Project owner, after reviewing `adapter-feasibility.md`.

## Why this is the right call

The original spike framed "Cloudflare-only infra" + "Portkey for AI gateway" as two coupled choices. Portkey turned out to be a poor fit:

- `@portkey-ai/vercel-provider` last published 2025-02-28 (14 months stale), peer-deps `zod ^3.0.0`, predates AI SDK v6
- Adds a second vendor (and bill, and dashboard, and outage surface) to a stack we're consolidating onto Cloudflare
- Workarounds existed (OpenAI-compat URL, direct SDK), but each added integration cost or lost ergonomics

Cloudflare AI Gateway, evaluated against the same operational surface, dominates on every dimension that matters here:

| Dimension | Cloudflare AI Gateway | Why it matters for us |
|---|---|---|
| AI SDK integration | `createAnthropic({ baseURL: 'https://gateway.ai.cloudflare.com/v1/{acct}/{gw}/anthropic' })` — the maintained `@ai-sdk/anthropic` provider, just with a different base URL | No stale provider package; structured `Output` and `streamText` work because the SDK is unchanged |
| Fallback chains | Universal endpoint accepts an array of provider objects; response includes `cf-aig-step` header indicating which one served | We currently use sonnet-4.6 as fallback for haiku-4.5 in 4 routes — directly translatable |
| Metadata / tagging | `cf-aig-metadata` JSON header, up to 5 fields (string/number/boolean), filterable in dashboard | We use 3 today (`feature`, `persona`, `category`) — fits the limit with headroom |
| Streaming | Thin proxy over Anthropic's native SSE — no transform or buffering at the gateway | `/api/layout/stream` should pass through unchanged |
| Caching | Built-in at the gateway layer | We currently cache layouts in Upstash; gateway-level cache is bonus, not required |
| Pricing | **Gateway is free; no markup on third-party tokens.** Logs: 100k/mo free tier, 10M/gateway on Workers Paid | Vercel AI Gateway has a token markup — pivot is a cost win |
| Vendor concentration | Same vendor as hosting | One bill, one dashboard, one support surface, one outage surface |

## Re-evaluating the spike's open questions

The original plan had Q1–Q7. Walking each through the CF AI Gateway lens:

### Q1 — Cloudflare adapter compatibility
**Status: resolved (deep-dive).** Adapter 7.x is mature (stable since 2025-04). Our SvelteKit 2.21 / Svelte 5.28 stack is supported. No banned-API usage in `src/`. Spike still needs to boot the app on `wrangler dev` (T1) but expectation is "works."

### Q2 — Gateway swap (originally Portkey)
**Reframed: does CF AI Gateway via `createAnthropic({ baseURL })` provide parity for `generateText`, `streamText`, and structured `Output`?**

Lower risk than the Portkey framing because:
- The provider is the maintained `@ai-sdk/anthropic`, not a third-party adapter
- CF AI Gateway is a thin proxy — the request/response shape is unchanged from direct Anthropic
- Fallback is configured per-request via the Universal endpoint OR via the Anthropic-specific endpoint (TBD which we use; see residual question below)

**Still requires PoC validation** — a single layout request through the gateway, structured Zod parse, fallback verified.

### Q3 — Neon + Upstash on Workers
**Status: resolved (deep-dive).** Both fetch-based, supported. Spike still verifies end-to-end (T3) but expectation is zero code changes.

### Q4 — Three-brand deploy on Wrangler
**Status: still open.** Not affected by the gateway choice. T4 unchanged.

### Q5 — Observability parity
**Reframed: does CF AI Gateway's dashboard answer the five operational queries we currently answer in Vercel AI Gateway?**

Likely better, not worse, because the gateway dashboard is in the same pane as Workers logs/analytics — unified observability. The 5-metadata-field limit is the only constraint to verify (we use 3 today).

### Q6 — Latency baseline
**Status: still open.** Pure measurement. T7 unchanged. Expectation is small improvement (gateway co-located with Worker, not crossing Vercel→Cloudflare).

### Q7 — Cost baseline
**Reframed: with CF AI Gateway being free (no token markup) and Workers replacing Vercel Functions, what's the all-in monthly delta?**

Almost certainly favorable. The headline savings:
- AI gateway markup: gone
- Vercel Pro seat costs: gone (or reallocated)
- Workers requests: 10M/mo included on Paid plan; bandwidth free
Spike still produces the explicit cost-model.md (T8 unchanged in shape, simpler in content).

## Residual open questions (post-pivot)

Three new questions opened by the CF AI Gateway choice. None block the spike but each must be answered during PoC.

### NQ1 — Universal endpoint vs Anthropic-specific endpoint
CF AI Gateway exposes two URLs per Anthropic call:
- `…/{gw}/anthropic` — direct Anthropic-format pass-through (use with `@ai-sdk/anthropic` + `baseURL`)
- `…/{gw}` — Universal endpoint (POST a body listing providers in priority order)

For fallback chains, only the Universal endpoint configures fallback per-request. The Anthropic-specific endpoint serves a single provider. **Resolution path:** use the Anthropic-specific endpoint for normal requests (clean AI SDK integration), and configure default fallback rules at the gateway level via the dashboard if Cloudflare supports gateway-level fallback config. If gateway-level fallback isn't a thing, accept "no fallback" for the spike PoC and document it as a follow-on.

### NQ2 — Metadata limit headroom
5 metadata fields per request. We use 3 (`feature`, `persona`, `category`). If we want to add more (`brand_id`, `surface`, `cache_state`), we hit the cap. Worth verifying we can live with 5.

### NQ3 — `nodejs_compat` interaction with the gateway response
The CF AI Gateway response is identical to Anthropic's, but Cloudflare adds headers (`cf-aig-step`, `cf-cache-status`). Make sure our SvelteKit response transforms don't strip them — we want them visible to clients for debugging.

## What changes in the plan

The spike plan (`docs/superpowers/plans/2026-05-05-cloudflare-portkey-spike.md`) is being amended in place to reflect the pivot:

1. Goal / Architecture / Tech Stack: replace Portkey references with CF AI Gateway
2. T2 fully rewritten: drop Portkey provider install, use `@ai-sdk/anthropic` with `baseURL`
3. T5 streaming validation: unchanged (still a hard gate)
4. T6 observability: dashboards switch to CF AI Gateway
5. T7 latency: comparison still vs Vercel deploy
6. T8 cost: simplified — CF AI Gateway is free, only logs cost
7. Decision matrix in T9: dimensions unchanged but expectation favors Go
8. New residual questions (NQ1–NQ3) added to "Open questions" table

Branch + filenames keep the `portkey` token for now (cosmetic; this is a spike). The follow-on migration plan, if the spike says Go, will use a clean `cloudflare-aigateway` slug.

## Recommendation

**Proceed with the spike under the CF AI Gateway framing.** The PoC is materially smaller than the Portkey version because:
- No new provider package install
- No stale-dependency workarounds
- No new vendor signup beyond Cloudflare itself

Estimated spike duration drops from 5 days to **3 days** (T1+T2 collapse, T6 simpler, T8 simpler).

---

## Sources

- [Cloudflare AI Gateway overview](https://developers.cloudflare.com/ai-gateway/)
- [Anthropic via Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/usage/providers/anthropic/)
- [Fallback configuration](https://developers.cloudflare.com/ai-gateway/configuration/fallbacks/)
- [Custom metadata](https://developers.cloudflare.com/ai-gateway/configuration/custom-metadata/)
- [Pricing](https://developers.cloudflare.com/ai-gateway/reference/pricing/)
