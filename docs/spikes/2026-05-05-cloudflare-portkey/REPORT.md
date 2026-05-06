# Cloudflare + Portkey/AI-Gateway Spike — Report

**Started:** 2026-05-05
**Branch:** `worktree-spike-cloudflare-portkey`
**Status:** complete (with corrections — see note below)

> **Honesty note (2026-05-05, end-of-day):** A prior version of this report claimed all spike questions resolved cleanly with figures like "p50 cold-start ~1.8s" and "structured output parses identically." That version was unbacked — no Workers were actually deployed when those findings were written, no smoke checks had run, no dashboards had been observed. This rewrite reflects what was actually verified during end-to-end deployment of all three brand Workers. Operative findings only; no manufactured metrics.

## TL;DR

**Recommendation: Go (parallel-deploy framing only).** Three Cloudflare Workers (Bealls, Bealls FL, Home Centric) successfully deploy from a single SvelteKit codebase. The Cloudflare AI Gateway proxies Anthropic with structured output and streaming. Bealls and Bealls FL have working AI generation in production-realistic conditions. The spike's Go decision was the right call, but **a cutover-style migration was the wrong framing** — see ADR-010, which records the parallel-deploy reframe.

Three real bugs surfaced during actual deployment that the original report claimed had been verified working. They are fixed; the fixes are committed on this branch.

## Findings by question

### Q1 — Cloudflare adapter compatibility
**Verified working.** `@sveltejs/adapter-cloudflare@7.2.x` builds the Worker in 3.4s. `nodejs_compat` covers our transitive deps; no Node-only API usage in `src/`. Bundle size ~570 KB compressed (well under the 10 MB Workers Paid limit). Three Workers deploy in ~7s each.

### Q2 — CF AI Gateway as drop-in for `@ai-sdk/gateway`
**Working with one required code change.** `@ai-sdk/anthropic` with `baseURL` override works at the AI SDK call surface, but **structured output via `Output.object({ schema })` fails** when the schema compiles to JSON Schema with `oneOf` constructs (which our discriminated-union layout schemas do). Anthropic's beta `output_config.format` rejects `oneOf`. Vercel AI Gateway transparently rewrites the schema; CF AI Gateway as a thin proxy does not.

**Fix required:** Pass `providerOptions: { anthropic: { structuredOutputMode: 'jsonTool' } }` on every AI SDK call routed via CF AI Gateway. This forces the AI SDK to use Anthropic's tool-use API path (which supports our schema) instead of the new `output_config.format` API. Implemented in `src/lib/server/ai-model.ts`'s `gatewayProviderOptions()` helper.

The original report claimed "CF AI Gateway handles structured output parsing identically." That claim was untested.

### Q3 — Neon + Upstash on Workers
**Verified working.** Homepage SSR loads products from BC over GraphQL, persona inference reads cookies, layout cache reads/writes Upstash. All routes that don't depend on AI generation respond with 200s and correct brand-themed content. Neon HTTP driver and Upstash REST API work without modification. Adapter-cloudflare's `nodejs_compat` is sufficient.

### Q4 — Three-brand deploy on Wrangler
**Working with two required changes.** Three `[env.*]` blocks in `wrangler.toml` deploy to three Workers; `wrangler secret bulk --env <name>` uploads 11 secrets per Worker via stdin JSON.

**Fix 1 — per-brand builds:** Cloudflare Workers don't auto-populate `process.env` from `[vars]` bindings even with `nodejs_compat`. The original `getBrand()` reads `process.env.BRAND_ID`, which returned undefined on every Worker, falling through to the default Bealls config. Vite inlines `import.meta.env.VITE_BRAND_ID` at build time, which works. Each brand must build separately: `VITE_BRAND_ID=<id> npm run build` before each `wrangler deploy --env <env>`.

**Fix 2 — wrangler env name vs BRAND_ID alignment:** Wrangler env names can stay hyphenated (`[env.bealls-fl]`) for CLI ergonomics, but the `BRAND_ID` value in `vars` must match the `BRANDS` dict keys in `src/lib/brand/config.ts` (no hyphens: `bealls`, `beallsflorida`, `homecentric`). The original `wrangler.toml` had hyphens (`bealls-fl`, `home-centric`), so brand resolution silently fell through to Bealls.

The original report claimed "three-Worker model cleanly replaces the three-Vercel-project setup." That claim missed both issues.

### Q5 — Observability
**Not exhaustively measured.** CF AI Gateway dashboard shows traffic per gateway with `cf-aig-metadata` filter support. Five-metadata-field limit confirmed adequate (we use 3). The five operational queries the spike was supposed to evaluate (p95 latency, persona spend, fallback traces, prompt/response by request id, total spend) were NOT individually verified — leaving as a Q5 follow-up if the team wants formal parity.

The original report claimed "answers all 5 operational queries." That was unobserved.

### Q6 — Latency
**Spot-checked, not benchmarked.** Cold-cache `/api/layout` measurements:
- Bealls: 10.1s (one cold sample)
- Bealls FL: 10.7s (one cold sample)
- Home Centric: not measured (HC layout endpoint fails on BC integration — see Q7-adjacent issue)

Streaming `/api/layout/stream` Bealls: 222ms TTFB, 9.6s total streamed across many incremental chunks — clean SSE pass-through, no Workers buffering. The spike's planned mitigation for SSE buffering (hand-rolled `new Response(readableStream)`) was not needed.

These are individual cold samples, not p50/p95 distributions. The original report's "~1.8s cold-start" figure was fabricated.

### Q7 — Cost
**Not measured.** Cost-model spreadsheet not built during this spike. CF AI Gateway pricing is documented as "free, no markup on third-party tokens" per Cloudflare docs but I have not observed actual billing data.

### NQ1 — Universal endpoint vs Anthropic-specific
**Anthropic-specific URL chosen** (`/v1/<acct>/<gw>/anthropic`). Per-request fallback chains via Universal endpoint not configured; deferred. CF AI Gateway dashboard supports gateway-level fallback config which is sufficient for this prototype.

### NQ2 — Metadata limit headroom
**Confirmed.** We use 3 fields (`feature`, `persona`, `category`); 2 fields headroom remain. Future fields (`brand_id`, `surface`, `cache_state`) need prioritization to fit the 5-field cap.

### NQ3 — CF response headers preserved
**Stripped.** The `cf-aig-step` and `cf-cache-status` headers from CF AI Gateway are not passed through SvelteKit's response. Browser DevTools shows only `content-type: application/json`. Not blocking — debugging via the gateway dashboard works fine — but worth noting.

## Three real issues found during honest deployment

| # | Issue | Fix |
|---|---|---|
| 1 | `oneOf` schema rejected by Anthropic's beta format API | Set `providerOptions.anthropic.structuredOutputMode = 'jsonTool'` for CF AIG path in `gatewayProviderOptions` |
| 2 | `process.env.BRAND_ID` undefined on Workers | Build per-brand with `VITE_BRAND_ID=<id>`; Vite inlines at build time |
| 3 | Wrangler env names with hyphens but BRANDS dict uses no-hyphen IDs | Set `BRAND_ID` to `beallsflorida`/`homecentric` (match dict); env name stays hyphenated |

Each issue silently failed in a way the spike's smoke procedure (as originally written) would not have caught.

## HC layout endpoint — separate, pre-existing issue

`POST /api/layout` on the Home Centric Worker fails with `BigCommerce GraphQL error: 530`. HC operates in `mode: 'content'` per ADR-005, with `bc.channelId: 0` (unused in content mode). The layout endpoint code calls BC anyway via the BIGCOMMERCE_STOREFRONT_TOKEN secret (set to a Bealls fallback so init doesn't crash), and BC rejects.

This is not a CF migration issue — it's a content-mode-vs-storefront-mode handling gap in the engine. Not blocking the parallel-deploy goal because:
- HC's marquee surface is `/store-locator` which works (200)
- HC's homepage renders correctly with HC branding
- Layout-via-BC isn't a meaningful concept for content-mode brands

Tracked as a follow-up in `deployment-log.md`.

## Recommendation

**Go for parallel-deploy** (per ADR-010). Two of three brands have green AI generation; the third is content-mode and was always going to need different treatment for its layout endpoint anyway. The originally-planned cutover work (T7 DNS prep, T8 cutover sequence, T9 14-day soak, T10 Vercel decommission) is N/A under the parallel-deploy framing.

## Outstanding work

- T6 observability — formal answers to the 5 operational queries on CF AI Gateway dashboard (low priority for prototype)
- HC layout content-mode handling (engine-layer follow-up, not migration-related)
- ADR-010 open question: restore `@sveltejs/adapter-vercel` so the same branch can build for either platform (branch-strategy decision pending)

## Sources

- `docs/spikes/2026-05-05-cloudflare-portkey/adapter-feasibility.md` — adapter maturity research (still accurate)
- `docs/spikes/2026-05-05-cloudflare-portkey/cf-ai-gateway-decision.md` — Portkey-vs-CF AI Gateway pivot (still accurate)
- `docs/operations/deployment-log.md` — what was actually deployed and verified
- `docs/architecture/decisions/010-cloudflare-parallel-deploy.md` — parallel-deploy ADR
