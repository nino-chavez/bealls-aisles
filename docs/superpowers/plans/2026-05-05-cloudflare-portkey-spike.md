# Cloudflare-only Migration — Spike Plan

> **Pivot note (2026-05-05):** Original framing was "Cloudflare + Portkey." After the adapter feasibility deep-dive (`docs/spikes/2026-05-05-cloudflare-portkey/adapter-feasibility.md`) and CF AI Gateway evaluation (`cf-ai-gateway-decision.md`), Portkey was dropped in favor of **Cloudflare AI Gateway**. Branch and filenames retain the legacy `portkey` slug — cosmetic. The follow-on migration plan (if Go) will use a clean slug.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate (and timebox) a migration of Aisles from Vercel + Vercel AI Gateway to **Cloudflare-only infrastructure** — Workers + Cloudflare AI Gateway. The spike ends with a Go / No-Go recommendation, a working PoC of the riskiest pieces, and a sized full-migration plan — not a production cutover.

**Architecture:** The migration touches two layers (per `CLAUDE.md`): the **foundation** (SvelteKit adapter, deploy model, env binding, streaming) and the **engine** (AI provider routing through Cloudflare AI Gateway instead of `@ai-sdk/gateway`). The engine swap is implemented as a `baseURL` override on the maintained `@ai-sdk/anthropic` provider — no new SDK, no stale package. Data stores (Neon Postgres, Upstash Redis) are already accessed over HTTP — confirmed Workers-compatible. The three-Vercel-project multi-brand model maps to three Workers (one per `BRAND_ID`) deploying off `main`.

**Tech Stack:**
- Current: SvelteKit 2, Svelte 5, `@sveltejs/adapter-vercel`, `ai` v6 + `@ai-sdk/gateway`, `@ai-sdk/anthropic`, `@neondatabase/serverless`, `@upstash/redis`, Vercel Functions
- Target: Cloudflare Workers (`@sveltejs/adapter-cloudflare` 7.2.x), Wrangler 4.x, `ai` v6 + `@ai-sdk/anthropic` with `createAnthropic({ baseURL })` pointing at Cloudflare AI Gateway, `@neondatabase/serverless` (unchanged), `@upstash/redis` (unchanged)
- Deploy: Wrangler + GitHub Actions (one Worker per brand) replacing three Vercel projects

---

## Spike framing

A spike is **timeboxed investigation**, not implementation. Total budget: **3 working days** (revised down from 5 after the CF AI Gateway pivot collapsed several Portkey-specific tasks). Each task below is half-to-full-day.

The spike produces three artifacts:
1. **`docs/spikes/2026-05-05-cloudflare-portkey/REPORT.md`** — findings, decision matrix, Go/No-Go.
2. **A working PoC** on the `worktree-spike-cloudflare-portkey` branch — Cloudflare adapter swapped, one AI route routing through Portkey, deployed to a single Cloudflare Worker preview URL.
3. **A sized full-migration plan** under `docs/superpowers/plans/` if Go.

Investigation tasks are ordered by risk — highest unknowns first. Stop early and write the report if any task hits a hard blocker.

---

## Open questions the spike must answer

These are the unknowns. Each task targets one or more.

| # | Question | Status entering spike | Task(s) |
|---|----------|---------------|---------|
| Q1 | Does `@sveltejs/adapter-cloudflare` support our SvelteKit feature surface (streaming, `$env/dynamic/private`, server-only modules)? | **Likely yes** — adapter 7.x mature, no banned-API usage in `src/`. PoC confirms. | T1, T5 |
| Q2 | Does CF AI Gateway via `createAnthropic({ baseURL })` provide parity with `@ai-sdk/gateway` for `generateText`, `streamText`, structured `Output`? | **Likely yes** — gateway is thin proxy over Anthropic; AI SDK provider is unchanged. PoC confirms. | T2, T5 |
| Q3 | Do `@neondatabase/serverless` and `@upstash/redis` work unchanged on Workers? | **Resolved (deep-dive)** — both fetch-based. PoC verifies end-to-end. | T3 |
| Q4 | Does the three-brand deploy model (one repo, three deploy targets via `BRAND_ID`) translate cleanly to Wrangler? | Open. | T4 |
| Q5 | Does CF AI Gateway's dashboard answer the five operational queries we currently answer in Vercel AI Gateway, within the 5-metadata-field limit? | Open — likely better (unified with Workers analytics). | T6 |
| Q6 | What's the cold-start + p50/p95 latency delta vs current Vercel deploy on the layout-generation hot path? | Open — likely small improvement. | T7 |
| Q7 | What's the all-in monthly cost delta (Workers + CF AI Gateway + Neon + Upstash) vs current Vercel + AI Gateway + Upstash + Neon? | **Likely favorable** — CF AI Gateway is free, no token markup. Spike quantifies. | T8 |
| **NQ1** | Universal endpoint vs Anthropic-specific endpoint — can we get fallback chains without giving up the clean `createAnthropic({ baseURL })` integration? | New (post-pivot). | T2 |
| **NQ2** | Does our 3-tag set (`feature`, `persona`, `category`) plus any future tags fit within CF AI Gateway's 5-metadata-field limit? | New (post-pivot). | T6 |
| **NQ3** | Are CF-added response headers (`cf-aig-step`, `cf-cache-status`) preserved through the SvelteKit response so we can debug in browser? | New (post-pivot). | T2 |

---

## File structure (spike scope)

The spike modifies these files. The full migration would touch more — we explicitly limit blast radius.

**Modified (PoC scope, all reverted-or-kept based on Go/No-Go):**
- `svelte.config.js` — swap adapter
- `package.json` — add Cloudflare + Portkey deps, retain Vercel deps until cutover
- `src/lib/server/ai-model.ts` — add Portkey provider path alongside existing gateway path (gated by env)
- `src/routes/api/layout/+server.ts` — route through Portkey when env flag set (one route only for spike)
- `wrangler.toml` (new) — Worker config for one brand
- `.dev.vars` (new, gitignored) — Worker local env

**Created (spike artifacts, persist regardless of outcome):**
- `docs/spikes/2026-05-05-cloudflare-portkey/REPORT.md` — findings + recommendation
- `docs/spikes/2026-05-05-cloudflare-portkey/decision-matrix.md` — scored comparison

**Untouched in spike (would change in full migration):**
- `/api/suggest`, `/api/refine` — they will migrate identically to `/api/layout` (same `gatewayProviderOptions` seam) but PoC scope is one route to bound risk
- `/api/layout/stream` — covered only in T5 streaming validation, not full migration
- `/api/signals`, observe routes — no AI calls; trivial to migrate, deferred
- `enrichment/enrich.ts` (script context, not request-path)
- `cache.ts`, `db.ts` (PoC validates they work as-is)

---

## Task 0: Spike workspace setup

**Files:**
- Create: `docs/spikes/2026-05-05-cloudflare-portkey/REPORT.md` (skeleton)
- Verify: branch is `worktree-spike-cloudflare-portkey`

- [ ] **Step 1: Confirm worktree branch**

Run:
```bash
git branch --show-current
```
Expected: `worktree-spike-cloudflare-portkey`

- [ ] **Step 2: Create the spike report skeleton**

Write `docs/spikes/2026-05-05-cloudflare-portkey/REPORT.md` with this template:
```markdown
# Cloudflare + Portkey Spike — Report

**Started:** 2026-05-05
**Branch:** worktree-spike-cloudflare-portkey
**Status:** in progress

## TL;DR
_(Filled at end: one paragraph + Go/No-Go.)_

## Findings by question

### Q1 — Cloudflare adapter compatibility
_(filled by T1, T5)_

### Q2 — Portkey as drop-in for `@ai-sdk/gateway`
_(filled by T2, T5)_

### Q3 — Neon + Upstash on Workers
_(filled by T3)_

### Q4 — Three-brand deploy on Wrangler
_(filled by T4)_

### Q5 — Observability parity
_(filled by T6)_

### Q6 — Latency delta
_(filled by T7)_

### Q7 — Cost delta
_(filled by T8)_

## Decision matrix
_(see decision-matrix.md)_

## Recommendation
_(Go / No-Go / Conditional Go with explicit blockers to retire)_

## Sized follow-on plan (if Go)
_(link to docs/superpowers/plans/<date>-cloudflare-portkey-migration.md)_
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-05-05-cloudflare-portkey-spike.md docs/spikes/
git commit -m "spike(cf-portkey): plan + report skeleton"
```

---

## Task 1: Cloudflare adapter swap — boot the app

**Hypothesis:** `@sveltejs/adapter-cloudflare` is a near drop-in for `@sveltejs/adapter-vercel`. The app builds and serves locally via `wrangler dev` without route changes.

**Validation:** `wrangler dev` serves the home page and at least one server route (`/api/cart` GET). No runtime errors related to Node-only APIs.

**Exit criteria:** Boot succeeds OR a concrete blocker is documented (e.g., a `+server.ts` uses a Node-only API with no Workers equivalent).

**Files:**
- Modify: `svelte.config.js`
- Modify: `package.json` (deps)
- Create: `wrangler.toml`
- Create: `.dev.vars` (gitignored)
- Modify: `.gitignore` (add `.dev.vars`, `.wrangler/`)

- [ ] **Step 1: Install Cloudflare adapter + Wrangler**

Run:
```bash
npm install --save-dev @sveltejs/adapter-cloudflare wrangler
```

- [ ] **Step 2: Swap adapter in `svelte.config.js`**

Replace the current contents with:
```js
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			routes: {
				include: ['/*'],
				exclude: ['<all>'],
			},
		}),
	},
};

export default config;
```

- [ ] **Step 3: Create `wrangler.toml` for a single brand (Bealls)**

```toml
name = "aisles-demo-1"
main = ".svelte-kit/cloudflare/_worker.js"
compatibility_date = "2026-05-01"
compatibility_flags = ["nodejs_compat"]
workers_dev = true

[assets]
directory = ".svelte-kit/cloudflare"
binding = "ASSETS"

[vars]
BRAND_ID = "bealls"
```

- [ ] **Step 4: Create `.dev.vars` with local secrets**

Copy values from your existing `.env.local` (BigCommerce, Neon, Upstash, Anthropic). Do NOT commit. Add to `.gitignore`:
```
.dev.vars
.wrangler/
```

- [ ] **Step 5: Build and run**

Run:
```bash
npm run build
npx wrangler dev
```

Expected: server boots on `http://localhost:8787`. Open browser, hit `/`. Hit `/api/cart`. Note any errors in `REPORT.md` Q1 section.

- [ ] **Step 6: Document findings**

In `docs/spikes/2026-05-05-cloudflare-portkey/REPORT.md` Q1 section, write:
- Did boot succeed? Y/N
- What broke? (verbatim error + which file)
- Was `nodejs_compat` enough or did anything need refactoring?
- Time spent on this task.

- [ ] **Step 7: Commit**

```bash
git add svelte.config.js wrangler.toml package.json package-lock.json .gitignore docs/spikes/
git commit -m "spike(cf-portkey): T1 cloudflare adapter swap"
```

---

## Task 2: Cloudflare AI Gateway — replace one `gateway()` call

**Hypothesis:** Cloudflare AI Gateway is a thin proxy over Anthropic. By overriding `baseURL` on `@ai-sdk/anthropic`, every AI SDK feature we use today (`generateText`, `streamText`, structured `Output`) keeps working with zero provider-package changes. Metadata flows via the `cf-aig-metadata` header. Fallback is configured at the gateway dashboard level OR via the Universal endpoint per-request.

**Validation:** `/api/layout` returns a valid layout when routed through CF AI Gateway. Structured `Output` parses identically to the current Vercel-Gateway path. The CF AI Gateway dashboard shows the request, with our 3 metadata fields populated. Response includes `cf-aig-step: 0` (primary served).

**Exit criteria:** Gateway-routed layout response is shape-equivalent to current. Metadata visible in dashboard. NQ3 (CF response headers preserved through SvelteKit) confirmed. OR a concrete blocker.

**Files:**
- Modify: `src/lib/server/ai-model.ts` (replace gateway path)
- Modify: `package.json` (no new deps — `@ai-sdk/anthropic` already present)
- Modify: `.dev.vars`

- [ ] **Step 1: Create a Cloudflare AI Gateway in the dashboard**

In the Cloudflare dashboard → AI Gateway → create new gateway named `aisles-bealls`. Capture:
- Account ID (already on file for Workers)
- Gateway ID = `aisles-bealls`
- Optional: enable "stored API keys" so the Anthropic key lives at Cloudflare and our Worker doesn't need it. For spike, easier to pass the Anthropic key client-side via standard `x-api-key` header — defer stored-keys for follow-on.

Note IDs in `REPORT.md` Q2 section.

- [ ] **Step 2: Replace gateway path in `src/lib/server/ai-model.ts`**

Replace contents with:
```ts
/**
 * Model selector — supports three backends:
 *   1. Cloudflare AI Gateway (target) — when CF_AIG_ACCOUNT_ID + CF_AIG_GATEWAY_ID set
 *   2. Vercel AI Gateway — when AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN set
 *   3. Direct Anthropic — fallback, requires ANTHROPIC_API_KEY
 *
 * Spike-mode flips between paths via env, no code edits.
 */
import { gateway } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { env } from '$env/dynamic/private';

export const useCfAig = !!(env.CF_AIG_ACCOUNT_ID && env.CF_AIG_GATEWAY_ID);
export const useGateway = !useCfAig && (!!env.AI_GATEWAY_API_KEY || !!env.VERCEL_OIDC_TOKEN);

const directAnthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

const cfAig = useCfAig
	? createAnthropic({
			apiKey: env.ANTHROPIC_API_KEY,
			baseURL: `https://gateway.ai.cloudflare.com/v1/${env.CF_AIG_ACCOUNT_ID}/${env.CF_AIG_GATEWAY_ID}/anthropic`,
		})
	: null;

export function layoutModel() {
	if (useCfAig && cfAig) return cfAig('claude-haiku-4-5-20251001');
	if (useGateway) return gateway('anthropic/claude-haiku-4.5');
	return directAnthropic('claude-haiku-4-5-20251001');
}

/**
 * Provider options builder.
 * - CF AIG path: returns headers to attach via the AI SDK's `headers` option
 *   on the call site (cf-aig-metadata, optional cf-aig-cache-ttl).
 * - Vercel gateway path: returns providerOptions.gateway (existing shape).
 */
export function gatewayProviderOptions(persona: string, categorySlug: string) {
	if (useCfAig) {
		return {
			headers: {
				'cf-aig-metadata': JSON.stringify({
					feature: 'layout',
					persona,
					category: categorySlug,
				}),
			},
		};
	}
	if (useGateway) {
		return {
			providerOptions: {
				gateway: {
					models: ['anthropic/claude-sonnet-4.6'],
					tags: [`feature:layout`, `persona:${persona}`, `category:${categorySlug}`],
				},
			},
		};
	}
	return undefined;
}
```

**Note:** the return shape of `gatewayProviderOptions` differs between branches (CF AIG returns `{ headers }` for the AI SDK call's top-level option; Vercel gateway returns `{ providerOptions }`). The 4 callsites currently spread the result onto `generateText`/`streamText` calls — this still works because both keys are valid AI SDK options. **Verify** at first callsite during PoC; adjust shape if needed.

- [ ] **Step 3: Add CF AIG env to `.dev.vars`**

```
CF_AIG_ACCOUNT_ID=...
CF_AIG_GATEWAY_ID=aisles-bealls
```

(Anthropic key is already there.)

- [ ] **Step 4: Run a layout request through CF AI Gateway**

Run `wrangler dev` with the env set, hit `/api/layout?persona=family-shopper&category=women`. Capture:
- Response shape — does the structured Zod `Output` parse pass?
- Latency — first-call (cold) and second-call (warm) p50.
- CF AI Gateway dashboard — request logged? metadata fields present? cost estimated?

- [ ] **Step 5: Verify response headers reach the browser (NQ3)**

Open Chrome DevTools Network tab, hit `/api/layout`. In the response headers panel, look for:
- `cf-aig-step` (which fallback rung served — should be `0` for normal flow)
- `cf-cache-status` (cache hit/miss)

If absent: SvelteKit's response handling may be stripping or replacing the Response object. Note in REPORT — non-blocking but worth knowing.

- [ ] **Step 6: Test fallback (deferred or via Universal endpoint)**

Two paths:
- **Easier:** configure a default fallback rule in the CF AI Gateway dashboard (if available). Force-fail haiku via misconfigured key, verify sonnet serves.
- **Harder:** switch one route to use the Universal endpoint URL with a per-request fallback array. Document the trade-off (loses clean SDK integration). Mark as follow-on if the dashboard config is sufficient.

- [ ] **Step 7: Document findings**

REPORT Q2: structured output works Y/N, dashboard observability matches expectations Y/N, fallback chain works Y/N, NQ3 outcome.

- [ ] **Step 8: Commit**

```bash
git add src/lib/server/ai-model.ts package.json docs/spikes/
git commit -m "spike(cf-portkey): T2 cloudflare ai gateway via baseURL override"
```

---

## Task 3: Verify Neon + Upstash on Workers

**Hypothesis:** `@neondatabase/serverless` (HTTP driver) and `@upstash/redis` (REST client) are already Workers-compatible — no changes needed.

**Validation:** A request that exercises both (a layout request — reads Neon for tag enrichment, reads Upstash for cache hit/miss) succeeds end-to-end on `wrangler dev`.

**Exit criteria:** Both stores are reachable from a Worker AND read/write paths work AND no perf cliff vs Vercel. OR a concrete blocker (e.g., outbound TCP not allowed and the package secretly uses TCP).

**Files:** none modified — this is verification, not code change.

- [ ] **Step 1: Cold-cache layout request**

With `wrangler dev` running and `AISLES_NO_CACHE=1` set, hit `/api/layout?persona=family-shopper&category=women`. Expected: full generation path runs, Neon reads succeed (look for any DB query in the response or logs).

- [ ] **Step 2: Warm-cache layout request**

Unset `AISLES_NO_CACHE`, hit the same URL twice. Expected: second hit served from Upstash cache (sub-100ms).

- [ ] **Step 3: Verify cache invalidation path**

Run a `r.scan` operation indirectly by calling `invalidateLayoutCache()` from a debug script or temporary route. Expected: keys deleted, next request regenerates.

- [ ] **Step 4: Document findings**

REPORT Q3: did Neon work unchanged? did Upstash work unchanged? any latency delta vs running on Vercel locally? note "no code changes required" or list what broke.

- [ ] **Step 5: Commit (only docs)**

```bash
git add docs/spikes/
git commit -m "spike(cf-portkey): T3 neon+upstash work on workers"
```

---

## Task 4: Multi-brand deploy model on Wrangler

**Hypothesis:** Three Workers (one per brand) deploying off `main` with brand-specific `[vars]` blocks is cleaner than one Worker with route-level brand routing. Pipeline: GitHub Actions → `wrangler deploy --env <brand>`.

**Validation:** A single `wrangler.toml` with three `[env.bealls]` / `[env.bealls-fl]` / `[env.home-centric]` sections deploys to three Worker URLs. No GitHub Actions required for the spike — just `wrangler deploy --env bealls` from the worktree.

**Exit criteria:** All three brands deploy and serve correct branding (verified by hitting each Worker URL and inspecting `BRAND_ID`-driven content). OR a clear reason to use a different model (e.g., Worker route binding awkwardness).

**Files:**
- Modify: `wrangler.toml`

- [ ] **Step 1: Extend `wrangler.toml` with three envs**

```toml
name = "aisles-demo"
main = ".svelte-kit/cloudflare/_worker.js"
compatibility_date = "2026-05-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = ".svelte-kit/cloudflare"
binding = "ASSETS"

[env.bealls]
name = "aisles-demo-1"
vars = { BRAND_ID = "bealls" }

[env.bealls-fl]
name = "aisles-demo-2"
vars = { BRAND_ID = "bealls-fl" }

[env.home-centric]
name = "aisles-demo-3"
vars = { BRAND_ID = "home-centric" }
```

- [ ] **Step 2: Set secrets per env**

For each brand, run:
```bash
npx wrangler secret put ANTHROPIC_API_KEY --env bealls
npx wrangler secret put DATABASE_URL --env bealls
npx wrangler secret put KV_REST_API_URL --env bealls
npx wrangler secret put KV_REST_API_TOKEN --env bealls
npx wrangler secret put CF_AIG_ACCOUNT_ID --env bealls
npx wrangler secret put CF_AIG_GATEWAY_ID --env bealls
# repeat for bealls-fl, home-centric (likely separate AI gateways per brand
# so observability slices cleanly — confirm in T6)
```

(Tedious but one-time. Document the list.)

- [ ] **Step 3: Deploy all three**

```bash
npx wrangler deploy --env bealls
npx wrangler deploy --env bealls-fl
npx wrangler deploy --env home-centric
```

- [ ] **Step 4: Smoke each URL**

Open each Worker URL, verify brand-correct logo, copy, and home layout. Note URLs in REPORT Q4.

- [ ] **Step 5: Document findings**

REPORT Q4: was three-Worker model clean? Any per-brand quirks? Migration cost from three Vercel projects to three Workers (env vars, DNS, etc).

- [ ] **Step 6: Commit**

```bash
git add wrangler.toml docs/spikes/
git commit -m "spike(cf-portkey): T4 three-brand wrangler envs"
```

---

## Task 5: Streaming endpoint validation [HARD GATE]

**Hypothesis:** `/api/layout/stream` (uses `streamText` from AI SDK) works on Workers via CF AI Gateway. Streaming responses arrive incrementally to the client. CF AI Gateway is a thin SSE pass-through.

**Validation:** Byte-level evidence that the response is incremental. TTFB < 2s on cold cache. Chunks visible over time in `curl -N -v` output and in browser DevTools network tab. **This is a hard go/no-go gate** — a buffered streaming response on the demo's marquee endpoint kills the migration.

**Exit criteria:** Streaming works end-to-end with byte-level evidence. OR documented buffering with an attempted fix using a hand-rolled `new Response(readableStream, { headers })` from AI SDK's `textStream` async iterator (per known-footgun mitigation in adapter-feasibility.md §6).

**Files:**
- Modify: `src/routes/api/layout/stream/+server.ts` only if needed

- [ ] **Step 1: Hit stream endpoint locally on `wrangler dev`**

```bash
curl -N -v -w "\n\n---\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" \
  "http://localhost:8787/api/layout/stream?persona=family-shopper&category=women&fresh=1"
```

Expected: chunks visible in `<` lines spread over multiple seconds (not arriving all at once at the end). TTFB < 2s. If TTFB ≈ Total, response was buffered — go to Step 4.

- [ ] **Step 2: Hit stream endpoint on deployed Worker URL**

Same curl against the deployed URL. Confirm streaming preserved through Cloudflare's edge (no extra buffering tier).

- [ ] **Step 3: Verify CF AI Gateway logs the streamed call correctly**

CF AI Gateway dashboard: was the request logged with token usage? Streaming requests sometimes lose accounting on gateways — verify.

- [ ] **Step 4 (only if buffered): Apply known-footgun mitigation**

Open `src/routes/api/layout/stream/+server.ts`. Replace the AI SDK Response helper with a direct `new Response(...)` from the `textStream` async iterator:

```ts
const result = streamText({ model, prompt, /* ... */ });
const stream = new ReadableStream({
	async start(controller) {
		const encoder = new TextEncoder();
		for await (const chunk of result.textStream) {
			controller.enqueue(encoder.encode(chunk));
		}
		controller.close();
	},
});
return new Response(stream, {
	headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
});
```

Re-run Step 1 and Step 2. If still buffered: hard blocker — document and stop.

- [ ] **Step 4: Document findings**

REPORT Q2 update: streaming works Y/N, any buffering observed, any caveats.

- [ ] **Step 5: Commit (likely docs only)**

```bash
git add docs/spikes/
git commit -m "spike(cf-portkey): T5 streaming verified on cf+portkey"
```

---

## Task 6: Observability parity check

**Hypothesis:** CF AI Gateway provides per-request logs, model fallback traces (`cf-aig-step`), latency, token cost estimates, and metadata-filterable views. Unified pane with Workers analytics. Parity or better than Vercel AI Gateway, with the caveat of the 5-metadata-field limit (NQ2).

**Validation:** Side-by-side dashboard comparison. Can you answer the same five operational questions on CF AI Gateway that you currently answer on Vercel AI Gateway?

**Exit criteria:** All five operational queries below resolve on CF AI Gateway OR a documented gap. NQ2 confirmed (3 fields fits, room for 2 more).

**Files:** none — this is dashboard exploration.

- [ ] **Step 1: Generate ~20 mixed requests**

Hit each of the four AI routes (note: only `/api/layout` migrated in PoC; the other three still use Vercel gateway. For T6 metric purposes, run `/api/layout` 20 times with varied persona + category to get spread).

- [ ] **Step 2: Answer these five questions on CF AI Gateway dashboard**

For each, capture a screenshot in `docs/spikes/2026-05-05-cloudflare-portkey/screenshots/`:
1. What's the p95 latency for `feature:layout` requests in the last hour?
2. Which persona has the highest token spend (filter by `persona` metadata)?
3. Show me all requests where `cf-aig-step > 0` (i.e., a fallback served).
4. Show me the prompt + response for request id X.
5. What's today's total Anthropic API spend?

- [ ] **Step 3: Confirm NQ2 — metadata headroom**

In the dashboard, confirm all 3 metadata fields (`feature`, `persona`, `category`) are queryable. We have headroom of 2 more (limit is 5). Document any future fields we'd want (`brand_id`, `surface`, `cache_state`) and decide priority — only 2 of the 3 candidates fit.

- [ ] **Step 4: Document gaps**

REPORT Q5: which queries CF AI Gateway can answer, which it can't, and what alternatives exist (Workers Analytics Engine for custom dashboards, Logpush for archival).

- [ ] **Step 4: Commit**

```bash
git add docs/spikes/
git commit -m "spike(cf-portkey): T6 observability parity findings"
```

---

## Task 7: Latency baseline

**Hypothesis:** Cloudflare Workers + Portkey latency is within 20% of current Vercel + AI Gateway on the layout-generation path.

**Validation:** 50-request latency comparison, both cold and warm cache, on the deployed Worker vs the existing Vercel deployment.

**Exit criteria:** Numbers captured and documented. No subjective "feels fast" — concrete p50/p95.

**Files:** none — measurement only.

- [ ] **Step 1: Write a one-shot k6 or `hey` script**

```bash
# Using `hey` (brew install hey)
hey -n 50 -c 2 -t 30 "https://aisles-demo-1.workers.dev/api/layout?persona=family-shopper&category=women&fresh=1"
hey -n 50 -c 2 -t 30 "https://aisles-demo-1-signal-x-studio-labs.vercel.app/api/layout?persona=family-shopper&category=women&fresh=1"
```

Use `?fresh=1` to bypass cache and force AI generation each call.

- [ ] **Step 2: Capture warm-cache numbers**

Same script without `?fresh=1`. Both deploys.

- [ ] **Step 3: Document**

REPORT Q6: table of (cold p50, cold p95, warm p50, warm p95) × (Vercel, Cloudflare). Note variance, time-of-day, sample size caveats.

- [ ] **Step 4: Commit**

```bash
git add docs/spikes/
git commit -m "spike(cf-portkey): T7 latency baseline"
```

---

## Task 8: Cost baseline

**Hypothesis:** Monthly cost on Cloudflare (Workers + AI Gateway) + still-external Neon + Upstash is **lower** than current Vercel + Vercel AI Gateway + Upstash + Neon, primarily because (a) CF AI Gateway is free with no token markup, and (b) Workers Paid bundles 10M requests vs Vercel Functions per-invocation pricing.

**Validation:** Spreadsheet of fixed + variable cost per provider at projected request volume.

**Exit criteria:** All-in monthly delta documented with explicit assumptions.

**Files:** create `docs/spikes/2026-05-05-cloudflare-portkey/cost-model.md`

- [ ] **Step 1: Pull current Vercel + AI Gateway + Upstash + Neon last-30-days bills**

Capture: Vercel Pro seat + Functions invocations + bandwidth, AI Gateway request fee + token markup, Upstash command count + bandwidth, Neon compute + storage.

- [ ] **Step 2: Estimate Cloudflare equivalents**

Workers Paid plan ($5/mo per account base) + Workers requests (10M included, $0.30/M after) + bandwidth (free). Assets storage (free). Domains.

- [ ] **Step 3: Estimate CF AI Gateway**

Per Cloudflare's pricing: gateway features (analytics, caching, rate limiting, fallback) are **free**. Persistent logs: 100k/mo free across all gateways on Workers Free; 10M/gateway on Workers Paid. Logpush (archival) is paid above 10M/mo at ~$0.05/M. **No markup on third-party (Anthropic) tokens** — pay Anthropic rates direct, optionally consolidated on the Cloudflare invoice. This is the headline savings vs Vercel AI Gateway.

- [ ] **Step 4: Build the cost-model.md table**

| Component | Vercel stack ($/mo) | Cloudflare stack ($/mo) | Delta |
|-----------|--------------------:|------------------------:|------:|
| Hosting   | ... | ... | ... |
| AI gateway | ... | ... | ... |
| Cache (Upstash) | ... | ... | ... |
| Database (Neon) | ... | ... | ... |
| **Total** | ... | ... | ... |

- [ ] **Step 5: Document assumptions**

REPORT Q7: assumptions block (request volume, avg tokens per request, % cache hit). Sensitivity: what if traffic 3x.

- [ ] **Step 6: Commit**

```bash
git add docs/spikes/
git commit -m "spike(cf-portkey): T8 cost baseline"
```

---

## Task 9: Decision matrix + Go/No-Go

**Goal:** Synthesize T1–T8 into a structured decision and either size the follow-on migration plan or write a No-Go memo.

**Files:**
- Create: `docs/spikes/2026-05-05-cloudflare-portkey/decision-matrix.md`
- Modify: `docs/spikes/2026-05-05-cloudflare-portkey/REPORT.md` (TL;DR + Recommendation)
- Create (if Go): `docs/superpowers/plans/<date>-cloudflare-portkey-migration.md`

- [ ] **Step 1: Score each dimension 1–5 and weight**

In `decision-matrix.md`:

| Dimension | Weight | Vercel score | Cloudflare + CF AI Gateway score | Weighted delta |
|-----------|-------:|-------------:|---------------------------------:|---------------:|
| Adapter compatibility | 3 | 5 | ?  | ? |
| Streaming reliability | 3 | 5 | ?  | ? |
| AI gateway features (fallback, structured output, observability, metadata) | 3 | 5 | ? | ? |
| Multi-brand deploy ergonomics | 2 | 4 | ? | ? |
| p95 latency | 3 | 5 | ? | ? |
| Monthly cost | 2 | 3 (markup on tokens) | ? | ? |
| Vendor concentration | 1 | 2 (split: hosting Vercel, gateway Vercel) | 5 (single: Cloudflare) | + |
| Observability surface | 2 | 5 | ? | ? |
| Migration risk | -3 | n/a | (cost) | ? |

Sum the deltas. Sign of the sum + magnitude indicates strength of recommendation.

- [ ] **Step 2: Write TL;DR + Recommendation in REPORT.md**

Three possible recommendations:
- **Go** — proceed with sized migration. List blockers retired, residual risks accepted.
- **No-Go** — keep Vercel+AI-Gateway. List the showstopper(s) and conditions under which we'd revisit.
- **Conditional Go** — proceed if and only if specific blockers retire (e.g., "Go if Portkey ships streaming token accounting by Q3"). List the conditions.

- [ ] **Step 3 (Go path only): Size the follow-on migration**

Create `docs/superpowers/plans/<today>-cloudflare-aigateway-migration.md` (clean slug — no `portkey`) using the writing-plans skill. Cover:
- Cutover strategy (parallel-run vs flag-flip vs hard cutover)
- All four AI routes migrated (not just `/api/layout`) — single `gatewayProviderOptions` shape change
- Three-brand deploy CI/CD (GitHub Actions)
- DNS migration plan (per brand, including TTL drop ahead of cutover)
- Rollback plan (the Vercel projects stay deployable for N weeks; the env-flag seam in `ai-model.ts` allows runtime flip back to Vercel AI Gateway if needed)
- Observability cutover (CF AI Gateway dashboards bookmarked, alert thresholds set)
- ADR drafted at `docs/architecture/decisions/009-deploy-target-cloudflare.md` summarizing the decision (replaces `@ai-sdk/gateway` and `@sveltejs/adapter-vercel`)

- [ ] **Step 4: Commit**

```bash
git add docs/spikes/ docs/superpowers/plans/
git commit -m "spike(cf-portkey): T9 decision + sized follow-on"
```

- [ ] **Step 5: Push the spike branch**

```bash
git push -u origin worktree-spike-cloudflare-portkey
```

(Do NOT open a PR yet — share the report internally first.)

---

## Self-review (post-plan)

- [ ] Each open question (Q1–Q7) has at least one task that targets it.
- [ ] Each task has an explicit hypothesis, validation method, exit criteria.
- [ ] No placeholders remain (`TBD`, `add error handling`, `similar to...`).
- [ ] The PoC scope is bounded to one route (`/api/layout`) — full migration is the follow-on plan, not the spike.
- [ ] Both Go and No-Go outcomes have a clear next-step artifact.
- [ ] Worktree branch is named correctly and the plan does not assume a particular merge target.
- [ ] No emoji.

---

## Out of scope for this spike

These are explicitly deferred to the follow-on migration plan (if Go):
- Cloudflare D1 / KV migration (Neon + Upstash stay external — confirmed by T3)
- Cloudflare Images / image optimization migration
- Cloudflare R2 for any future asset hosting
- GitHub Actions CI/CD pipeline
- DNS cutover plan
- ADR + cross-doc updates (NORTH-STAR mentions Vercel; ARCHITECTURE has a stack section)
- Engine-layer prompt or schema changes — Portkey routes raw prompts; no prompt-engineering work in this spike
- Admin app (`aisles-admin`) — separate repo, separate spike if needed
