# Cloudflare + Portkey Migration — Spike Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate (and timebox) a migration of Aisles from Vercel + Vercel AI Gateway to Cloudflare-only infrastructure (Workers + bindings) using Portkey as the AI gateway. The spike ends with a Go / No-Go recommendation, a working PoC of the riskiest pieces, and a sized full-migration plan — not a production cutover.

**Architecture:** The migration touches two layers (per `CLAUDE.md`): the **foundation** (SvelteKit adapter, deploy model, env binding, streaming) and the **engine** (AI provider routing through Portkey instead of `@ai-sdk/gateway`). Data stores (Neon Postgres, Upstash Redis) are already accessed over HTTP and should require zero changes — the spike confirms that. The three-Vercel-project multi-brand model maps to three Workers (one per `BRAND_ID`) deploying off `main`.

**Tech Stack:**
- Current: SvelteKit 2, Svelte 5, `@sveltejs/adapter-vercel`, `ai` v6 + `@ai-sdk/gateway`, `@ai-sdk/anthropic`, `@neondatabase/serverless`, `@upstash/redis`, Vercel Functions
- Target: Cloudflare Workers (`@sveltejs/adapter-cloudflare`), Wrangler, `ai` v6 + Portkey provider (`@portkey-ai/vercel-provider` or OpenAI-compatible), `@neondatabase/serverless` (unchanged), `@upstash/redis` (unchanged or Cloudflare KV)
- Deploy: Wrangler + GitHub Actions (one Worker per brand) replacing three Vercel projects

---

## Spike framing

A spike is **timeboxed investigation**, not implementation. Total budget: **5 working days**. Each task below is half-to-full-day.

The spike produces three artifacts:
1. **`docs/spikes/2026-05-05-cloudflare-portkey/REPORT.md`** — findings, decision matrix, Go/No-Go.
2. **A working PoC** on the `worktree-spike-cloudflare-portkey` branch — Cloudflare adapter swapped, one AI route routing through Portkey, deployed to a single Cloudflare Worker preview URL.
3. **A sized full-migration plan** under `docs/superpowers/plans/` if Go.

Investigation tasks are ordered by risk — highest unknowns first. Stop early and write the report if any task hits a hard blocker.

---

## Open questions the spike must answer

These are the unknowns. Each task targets one or more.

| # | Question | Risk if wrong | Task(s) |
|---|----------|---------------|---------|
| Q1 | Does `@sveltejs/adapter-cloudflare` support our SvelteKit feature surface (streaming, `$env/dynamic/private`, server-only modules)? | Adapter incompatibility = dead-end. | T1, T5 |
| Q2 | Can Portkey replace `@ai-sdk/gateway` with the same AI SDK ergonomics — fallback chains, structured `Output`, streaming, cost tags? | Spike-killer if structured outputs or streaming don't work. | T2, T5 |
| Q3 | Do `@neondatabase/serverless` and `@upstash/redis` work unchanged on Workers? | If broken, scope expands to D1 + KV migration. | T3 |
| Q4 | Does the three-brand deploy model (one repo, three deploy targets via `BRAND_ID`) translate cleanly to Wrangler? | If awkward, rethink build pipeline. | T4 |
| Q5 | Does Portkey's observability (logs, metrics, trace tags) match or exceed what Vercel AI Gateway provides? | Loss of observability is a real cost — needs to be quantified. | T6 |
| Q6 | What's the cold-start + p50/p95 latency delta vs current Vercel deploy on the layout-generation hot path? | Worse latency on the demo-defining endpoint kills the migration. | T7 |
| Q7 | What's the all-in monthly cost delta (Workers + Portkey + Neon/Upstash external) vs current Vercel + AI Gateway + Upstash + Neon? | Migration must not be more expensive without offsetting wins. | T8 |

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
- All other `+server.ts` routes (`/api/suggest`, `/api/refine`, `/api/layout/stream`, `/api/signals`, observe routes)
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

## Task 2: Portkey provider — replace one `gateway()` call

**Hypothesis:** Portkey provides an AI SDK-compatible provider that supports `generateText`, structured `Output` (Zod schemas), and streaming, with fallback chains configured via Portkey config (not provider options).

**Validation:** `/api/layout` returns a valid layout when the request is routed through Portkey. The structured `Output` shape parses the same as via `@ai-sdk/gateway`. Manual fallback chain (haiku → sonnet) is exercisable from Portkey's dashboard config (no code change needed).

**Exit criteria:** A Portkey-routed layout response equals (in shape, not byte-for-byte) the AI Gateway response. Fallback config tested. OR a concrete blocker (e.g., structured output unsupported on Portkey + Anthropic).

**Files:**
- Modify: `src/lib/server/ai-model.ts` (add Portkey path)
- Modify: `src/routes/api/layout/+server.ts` (use new model selector)
- Modify: `package.json`
- Modify: `.dev.vars`

- [ ] **Step 1: Sign up for Portkey, create a virtual key for Anthropic, create a config with haiku-4.5 primary + sonnet-4.6 fallback**

Document the virtual key + config IDs in `REPORT.md` Q2. Do not commit keys.

- [ ] **Step 2: Install Portkey provider**

Run:
```bash
npm install @portkey-ai/vercel-provider
```

(If the package is unmaintained or doesn't support AI SDK v6: fall back to using `createOpenAI` from `@ai-sdk/openai` with Portkey's OpenAI-compatible URL. Note which path was taken in the report.)

- [ ] **Step 3: Add Portkey path to `src/lib/server/ai-model.ts`**

Replace contents with:
```ts
/**
 * Model selector — supports three backends:
 *   1. Portkey (target) — when PORTKEY_API_KEY is set
 *   2. Vercel AI Gateway — when AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN is set
 *   3. Direct Anthropic — fallback, requires ANTHROPIC_API_KEY
 *
 * The seam is intentional: spike-mode flips between paths via env, no code edits.
 */
import { gateway } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createPortkey } from '@portkey-ai/vercel-provider';
import { env } from '$env/dynamic/private';

const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

export const usePortkey = !!env.PORTKEY_API_KEY;
export const useGateway = !usePortkey && (!!env.AI_GATEWAY_API_KEY || !!env.VERCEL_OIDC_TOKEN);

const portkey = usePortkey
	? createPortkey({
			apiKey: env.PORTKEY_API_KEY,
			config: env.PORTKEY_CONFIG_ID, // points at fallback chain in Portkey dashboard
		})
	: null;

export function layoutModel() {
	if (usePortkey && portkey) return portkey.chatModel('claude-haiku-4-5-20251001');
	if (useGateway) return gateway('anthropic/claude-haiku-4.5');
	return anthropic('claude-haiku-4-5-20251001');
}

export function gatewayProviderOptions(persona: string, categorySlug: string) {
	if (usePortkey) {
		return {
			portkey: {
				metadata: {
					feature: 'layout',
					persona,
					category: categorySlug,
				},
			},
		};
	}
	if (useGateway) {
		return {
			gateway: {
				models: ['anthropic/claude-sonnet-4.6'],
				tags: [`feature:layout`, `persona:${persona}`, `category:${categorySlug}`],
			},
		};
	}
	return undefined;
}
```

(Verify exact API shape against current Portkey docs at spike time — fields may have moved. Note any deviation in REPORT.)

- [ ] **Step 4: Add Portkey env to `.dev.vars`**

```
PORTKEY_API_KEY=pk-live-...
PORTKEY_CONFIG_ID=cfg-...
```

- [ ] **Step 5: Run a layout request through Portkey**

Run dev server with Portkey env set, hit `/api/layout?persona=family-shopper&category=women`. Capture:
- Response shape — does the structured Zod parse pass?
- Latency — first-call (cold) and second-call (warm) p50.
- Portkey dashboard — request logged? cost tracked? fallback config visible?

- [ ] **Step 6: Test the fallback chain**

In Portkey dashboard, temporarily mis-configure the haiku key to force a fallback to sonnet. Re-run the request. Expected: response still succeeds (sonnet path).

- [ ] **Step 7: Document findings**

REPORT Q2: structured output works Y/N, streaming verified Y/N (test with `streamText` separately if time allows), fallback chain works Y/N, observability surface vs Vercel AI Gateway side-by-side notes.

- [ ] **Step 8: Commit**

```bash
git add src/lib/server/ai-model.ts package.json package-lock.json docs/spikes/
git commit -m "spike(cf-portkey): T2 portkey provider behind env flag"
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
npx wrangler secret put PORTKEY_API_KEY --env bealls
npx wrangler secret put PORTKEY_CONFIG_ID --env bealls
# repeat for bealls-fl, home-centric
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

## Task 5: Streaming endpoint validation

**Hypothesis:** `/api/layout/stream` (uses `streamText` from AI SDK) works on Workers via Portkey. Streaming responses arrive incrementally to the client.

**Validation:** Hit `/api/layout/stream` from a deployed Worker URL, observe chunked response in browser dev tools network tab.

**Exit criteria:** Streaming works end-to-end. OR a documented reason it doesn't (e.g., Portkey buffers, Worker response streaming not compatible with SvelteKit's response shape).

**Files:**
- Modify: `src/routes/api/layout/stream/+server.ts` only if needed

- [ ] **Step 1: Hit stream endpoint locally on `wrangler dev`**

```bash
curl -N "http://localhost:8787/api/layout/stream?persona=family-shopper&category=women"
```

Expected: response chunks arrive over time, not all at once.

- [ ] **Step 2: Hit stream endpoint on deployed Worker URL**

Same curl against the deployed URL. Confirm streaming preserved through Cloudflare's edge.

- [ ] **Step 3: Verify Portkey logs the streamed call correctly**

Portkey dashboard: was the request logged with token usage? Streaming requests sometimes lose accounting on gateways — verify.

- [ ] **Step 4: Document findings**

REPORT Q2 update: streaming works Y/N, any buffering observed, any caveats.

- [ ] **Step 5: Commit (likely docs only)**

```bash
git add docs/spikes/
git commit -m "spike(cf-portkey): T5 streaming verified on cf+portkey"
```

---

## Task 6: Observability parity check

**Hypothesis:** Portkey provides per-request logs, model fallback traces, latency histograms, token cost, and metadata-tag-based filtering — at parity or better than Vercel AI Gateway's tag system.

**Validation:** Side-by-side dashboard comparison. Can you answer the same operational questions on Portkey that you currently answer on Vercel AI Gateway?

**Exit criteria:** All five operational queries below resolve on Portkey OR a documented gap.

**Files:** none — this is dashboard exploration.

- [ ] **Step 1: Generate ~20 mixed requests**

Hit each of the four AI routes from local dev with Portkey enabled. Vary persona + category. Mix layout, refine, suggest.

- [ ] **Step 2: Answer these five questions on Portkey dashboard**

For each, capture a screenshot in `docs/spikes/2026-05-05-cloudflare-portkey/screenshots/`:
1. What's the p95 latency for `feature:layout` requests in the last hour?
2. Which persona has the highest token spend?
3. Show me all requests that fell back from haiku to sonnet.
4. Show me the prompt + response for request id X.
5. What's today's total Anthropic API spend across all features?

- [ ] **Step 3: Document gaps**

REPORT Q5: which queries Portkey can answer, which it can't, and what alternatives exist (custom dashboard via Portkey API, separate observability tooling).

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

**Hypothesis:** Monthly cost on Cloudflare + Portkey + (still-external) Neon + Upstash is ≤ current Vercel + AI Gateway + Upstash + Neon.

**Validation:** Spreadsheet of fixed + variable cost per provider at projected request volume.

**Exit criteria:** All-in monthly delta documented with explicit assumptions.

**Files:** create `docs/spikes/2026-05-05-cloudflare-portkey/cost-model.md`

- [ ] **Step 1: Pull current Vercel + AI Gateway + Upstash + Neon last-30-days bills**

Capture: Vercel Pro seat + Functions invocations + bandwidth, AI Gateway request fee + token markup, Upstash command count + bandwidth, Neon compute + storage.

- [ ] **Step 2: Estimate Cloudflare equivalents**

Workers Paid plan ($5/mo per account base) + Workers requests (10M included, $0.30/M after) + bandwidth (free). Assets storage (free). Domains.

- [ ] **Step 3: Estimate Portkey**

Portkey hosted: free tier limits, paid tier $/req or $/k tokens. Note: Portkey takes its cut on top of raw Anthropic API cost — the Vercel AI Gateway markup goes away but Portkey's appears.

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

| Dimension | Weight | Vercel score | Cloudflare+Portkey score | Weighted delta |
|-----------|-------:|-------------:|-------------------------:|---------------:|
| Adapter compatibility | 3 | 5 | ?  | ? |
| Streaming reliability | 3 | 5 | ?  | ? |
| AI gateway features (fallback, structured output, observability) | 3 | 5 | ? | ? |
| Multi-brand deploy ergonomics | 2 | 4 | ? | ? |
| p95 latency | 3 | 5 | ? | ? |
| Monthly cost | 2 | 5 | ? | ? |
| Vendor concentration | 1 | 2 | ? | ? |
| Observability surface | 2 | 5 | ? | ? |
| Migration risk | -3 | n/a | (cost) | ? |

Sum the deltas. Sign of the sum + magnitude indicates strength of recommendation.

- [ ] **Step 2: Write TL;DR + Recommendation in REPORT.md**

Three possible recommendations:
- **Go** — proceed with sized migration. List blockers retired, residual risks accepted.
- **No-Go** — keep Vercel+AI-Gateway. List the showstopper(s) and conditions under which we'd revisit.
- **Conditional Go** — proceed if and only if specific blockers retire (e.g., "Go if Portkey ships streaming token accounting by Q3"). List the conditions.

- [ ] **Step 3 (Go path only): Size the follow-on migration**

Create `docs/superpowers/plans/<today>-cloudflare-portkey-migration.md` using the writing-plans skill. Cover:
- Cutover strategy (parallel-run vs flag-flip vs hard cutover)
- All four AI routes migrated (not just `/api/layout`)
- Three-brand deploy CI/CD (GitHub Actions)
- DNS migration plan (per brand, including TTL drop ahead of cutover)
- Rollback plan (the Vercel projects stay deployable for N weeks)
- Observability cutover (Portkey dashboards built, alerts configured)
- ADR drafted at `docs/architecture/decisions/009-deploy-target-cloudflare.md` summarizing the decision

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
