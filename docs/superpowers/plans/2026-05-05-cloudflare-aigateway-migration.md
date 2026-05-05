# Cloudflare + Cloudflare AI Gateway — Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut over Aisles from Vercel + Vercel AI Gateway to Cloudflare Workers + Cloudflare AI Gateway, across all three brand deployments (Bealls, Bealls Florida, Home Centric), with per-brand DNS flip and a two-week rollback window. The migration completes when (1) all three brand domains resolve to Cloudflare, (2) Vercel projects are decommissioned, (3) `@sveltejs/adapter-vercel` and `@ai-sdk/gateway` are removed from the codebase, and (4) ADR-009 + supporting doc updates are merged.

**Architecture:** Two-layer change. **Foundation:** SvelteKit adapter swap (`adapter-vercel` → `adapter-cloudflare` 7.2.x), three Workers deploying off `main` via Wrangler envs (replacing three Vercel projects), GitHub Actions CI/CD. **Engine:** All four AI routes (`/api/layout`, `/api/layout/stream`, `/api/refine`, `/api/suggest`) plus the enrichment script route through CF AI Gateway via `createAnthropic({ baseURL })` on the maintained `@ai-sdk/anthropic` provider — no new SDK package, no stale deps. The runtime env flag `useCfAig` in `ai-model.ts` (introduced during the spike) becomes the in-Worker rollback lever — flip env to revert to Vercel AI Gateway path without redeploy. Neon Postgres and Upstash Redis stay external (HTTP, no changes). Three-brand `BRAND_ID` env model preserved in Wrangler `[env.*]` blocks.

**Cutover strategy:** Parallel-deploy + per-brand DNS flip with progressive rollout — Bealls first (smallest blast radius), then Bealls FL (48h soak), then Home Centric (most complex due to content mode). Each brand has a 48-hour soak window between flips. Vercel projects remain on standby for two weeks post-final-flip; at T+14 days they are deleted and `@sveltejs/adapter-vercel`/`@ai-sdk/gateway` removed from `package.json`.

**Tech Stack:**
- Adapter: `@sveltejs/adapter-cloudflare` ^7.2.8
- CLI: `wrangler` ^4.x
- AI: `ai` ^6.0.146 + `@ai-sdk/anthropic` ^3.0.66 (unchanged) routed through CF AI Gateway via `baseURL`
- CI/CD: GitHub Actions (`cloudflare/wrangler-action@v3`)
- Existing: Neon serverless, Upstash Redis, BigCommerce GraphQL — all unchanged

---

## Prerequisites (must be true before T0)

- [ ] Spike (`docs/superpowers/plans/2026-05-05-cloudflare-portkey-spike.md`) returned **Go**.
- [ ] All three NQs (Universal vs Anthropic endpoint, metadata limit, response header preservation) resolved with documented outcomes.
- [ ] T5 streaming gate passed — byte-level evidence captured in `docs/spikes/2026-05-05-cloudflare-portkey/REPORT.md`.
- [ ] Cloudflare account access confirmed for the project owner: AI Gateway create, Workers deploy, DNS manage.
- [ ] All three brand domains' DNS providers identified (currently Vercel-managed; this migration moves them to Cloudflare DNS or keeps them at the registrar with CNAME).
- [ ] `ai-model.ts` env-flag seam from spike T2 still merged on the working branch.

If any prerequisite is false: stop, finish the spike, then return.

---

## Cutover-day decision points

These are forks where a real choice must be made; default in parens, but the operator confirms at execution time.

| Fork | Default | Alternative | Decided when |
|---|---|---|---|
| One CF AI Gateway per brand vs one shared | One per brand (`aisles-bealls`, `aisles-bealls-fl`, `aisles-hc`) — clean observability slicing | Shared — simpler config, mixed metrics | T3 |
| DNS at Cloudflare DNS or stay at current registrar with CNAME to workers.dev | Move to Cloudflare DNS — proxy benefits, faster TTL changes | CNAME — less invasive, harder to revert quickly | T7 |
| Cutover order | Bealls → Bealls FL → HC (smallest to largest blast radius) | Reverse — HC first if HC has highest stakeholder pressure | T8 |
| Vercel projects: pause auto-deploy or delete on cutover | Pause first, delete after 14d soak | Delete immediately — no rollback path beyond git revert | T10 |

---

## File structure

**Created:**
- `wrangler.toml` (top-level, replaces any spike version with production-grade config)
- `.github/workflows/deploy-cloudflare.yml` (CI/CD pipeline)
- `docs/architecture/decisions/009-deploy-target-cloudflare.md` (ADR)
- `docs/operations/cutover-runbook.md` (per-brand cutover procedure for the human operator)
- `docs/operations/rollback-runbook.md` (revert procedure, two paths: env flip, DNS revert)

**Modified:**
- `svelte.config.js` (adapter)
- `package.json` (deps: add `@sveltejs/adapter-cloudflare` and `wrangler`; defer removal of `@sveltejs/adapter-vercel` + `@ai-sdk/gateway` to T11)
- `src/lib/server/ai-model.ts` (extend env-flag seam, add metadata-header path; spike already touched)
- `src/routes/api/layout/+server.ts`, `src/routes/api/layout/stream/+server.ts`, `src/routes/api/refine/+server.ts`, `src/routes/api/suggest/+server.ts` (all 4 AI routes adopt the unified `gatewayProviderOptions` shape)
- `src/lib/server/enrichment/enrich.ts` (route through CF AI Gateway)
- `.gitignore` (add `.dev.vars`, `.wrangler/`)
- `.env.example` (replace AI_GATEWAY_API_KEY/VERCEL_OIDC_TOKEN with CF_AIG_* vars)
- `docs/architecture/ARCHITECTURE.md` (stack section)
- `docs/architecture/multi-brand.md` (three Workers, not three Vercel projects)
- `docs/architecture/observability.md` (CF AI Gateway dashboards)
- `docs/developer/development.md` (replace `vercel dev` with `wrangler dev`)
- `docs/developer/api-reference.md` (deployment URLs)
- `traceability.json` (touch any deploy-target rows; bump `updated`)
- `CLAUDE.md` (Repository specifics section)

**Deleted at T11:**
- Vercel-specific configs (none exist today — `vercel.json` is absent, so this is just dep removal)

---

## Task 0: Branch + baseline

**Files:**
- Verify: branch is the migration branch (separate from spike branch)

- [ ] **Step 1: Create migration branch from spike branch**

```bash
git checkout worktree-spike-cloudflare-portkey
git pull
git checkout -b feat/cloudflare-aigateway-migration
git push -u origin feat/cloudflare-aigateway-migration
```

The migration branch starts from the spike branch so the env-flag seam in `ai-model.ts` and the wrangler.toml skeleton are present.

- [ ] **Step 2: Run baseline tests + build**

```bash
npm install
npm run check
npx playwright test 2>/dev/null || echo "no playwright config — skip"
```

Expected: `check` passes. If failing tests exist on baseline, capture in a `BASELINE-FAILURES.md` file and decide per-failure whether to fix in this branch or punt.

- [ ] **Step 3: Commit baseline marker**

```bash
git commit --allow-empty -m "chore: migration branch baseline (spike branch HEAD)"
```

---

## Task 1: Production-grade adapter swap

**Files:**
- Modify: `svelte.config.js`
- Modify: `package.json` (add `@sveltejs/adapter-cloudflare` to deps if not already from spike)
- Verify: no Node-only API usage

**Hypothesis:** With `nodejs_compat` enabled and our existing zero-Node-API codebase, the build produces a working Worker for all 13 server routes including the 4 AI routes.

- [ ] **Step 1: Confirm adapter dep installed**

```bash
npm ls @sveltejs/adapter-cloudflare
```

If missing: `npm install --save-dev @sveltejs/adapter-cloudflare@^7.2.8`.

- [ ] **Step 2: Set adapter in `svelte.config.js`**

```js
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// Routes config tells Cloudflare which paths the worker handles.
			// Default ('/*' include, '<all>' exclude) means worker handles every path.
			routes: { include: ['/*'], exclude: ['<all>'] },
		}),
	},
};

export default config;
```

- [ ] **Step 3: Verify no Node-only APIs**

```bash
git grep -nE "from ['\"]node:|from ['\"](fs|path|crypto|stream|http|https|os|child_process)['\"]|require\\(['\"](fs|path|crypto)['\"]" -- 'src/**/*.ts' 'src/**/*.svelte'
```

Expected: empty. `nodejs_compat` covers buffer/stream/util/crypto if pulled by transitive deps, but our own code should be clean.

- [ ] **Step 4: Build and check Worker output**

```bash
npm run build
ls -lh .svelte-kit/cloudflare/_worker.js
```

Expected: build succeeds, worker bundle written.

- [ ] **Step 5: Measure Worker bundle size**

```bash
gzip -c .svelte-kit/cloudflare/_worker.js | wc -c | awk '{print $1/1024/1024 " MB compressed"}'
```

Expected: well under 10 MB compressed (Workers Paid plan limit). Record the number in the cutover runbook for future reference. If over 5 MB, investigate transitive deps.

- [ ] **Step 6: Commit**

```bash
git add svelte.config.js package.json package-lock.json
git commit -m "feat(deploy): swap to @sveltejs/adapter-cloudflare for production"
```

---

## Task 2: Migrate all 4 AI routes + enrichment to CF AI Gateway

**Files:**
- Modify: `src/lib/server/ai-model.ts` (consolidate, ensure all callers use it)
- Modify: `src/routes/api/layout/+server.ts`
- Modify: `src/routes/api/layout/stream/+server.ts`
- Modify: `src/routes/api/refine/+server.ts`
- Modify: `src/routes/api/suggest/+server.ts`
- Modify: `src/lib/server/enrichment/enrich.ts`

**Hypothesis:** All five callsites can share `layoutModel()` + `gatewayProviderOptions()` from `ai-model.ts`. The `gatewayProviderOptions()` return shape works with both `generateText` and `streamText` because both accept `headers` and `providerOptions` at the top level.

- [ ] **Step 1: Audit current AI callsites**

```bash
git grep -nE "gateway\(|generateText\(|streamText\(" -- 'src/routes/**/*.ts' 'src/lib/server/**/*.ts'
```

Expected callsites (validate against output):
- `src/routes/api/layout/+server.ts` — `generateText` + `gateway()`
- `src/routes/api/layout/stream/+server.ts` — `streamText` + `layoutModel()`
- `src/routes/api/refine/+server.ts` — `generateText` + `gateway()` (direct)
- `src/routes/api/suggest/+server.ts` — `generateText` + `gateway()` (direct)
- `src/lib/server/enrichment/enrich.ts` — `generateText` + `embedMany`

If any callsite imports `gateway` from `'ai'` directly (not via `ai-model.ts`): replace with `layoutModel()`.

- [ ] **Step 2: Finalize `ai-model.ts` — remove the dual-flag, make CF AI Gateway the canonical path**

```ts
/**
 * Model selector — Cloudflare AI Gateway as the canonical AI proxy.
 *
 * Two paths:
 *   1. CF AI Gateway (production) — when CF_AIG_ACCOUNT_ID + CF_AIG_GATEWAY_ID set
 *   2. Direct Anthropic — local dev fallback when only ANTHROPIC_API_KEY is set
 *
 * The Vercel AI Gateway path is removed in T11 after the soak period;
 * during the soak it remains as a third branch for emergency rollback.
 */
import { gateway } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { env } from '$env/dynamic/private';

export const useCfAig = !!(env.CF_AIG_ACCOUNT_ID && env.CF_AIG_GATEWAY_ID);
export const useVercelGateway = !useCfAig && (!!env.AI_GATEWAY_API_KEY || !!env.VERCEL_OIDC_TOKEN);

const directAnthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

const cfAig = useCfAig
	? createAnthropic({
			apiKey: env.ANTHROPIC_API_KEY,
			baseURL: `https://gateway.ai.cloudflare.com/v1/${env.CF_AIG_ACCOUNT_ID}/${env.CF_AIG_GATEWAY_ID}/anthropic`,
		})
	: null;

export function layoutModel() {
	if (useCfAig && cfAig) return cfAig('claude-haiku-4-5-20251001');
	if (useVercelGateway) return gateway('anthropic/claude-haiku-4.5');
	return directAnthropic('claude-haiku-4-5-20251001');
}

/**
 * Returns AI SDK call options that route observability/fallback metadata.
 * Spread into generateText/streamText calls:
 *   const result = await generateText({ model, prompt, ...gatewayProviderOptions(...) });
 */
export function gatewayProviderOptions(persona: string, categorySlug: string, feature = 'layout') {
	if (useCfAig) {
		return {
			headers: {
				'cf-aig-metadata': JSON.stringify({ feature, persona, category: categorySlug }),
			},
		};
	}
	if (useVercelGateway) {
		return {
			providerOptions: {
				gateway: {
					models: ['anthropic/claude-sonnet-4.6'],
					tags: [`feature:${feature}`, `persona:${persona}`, `category:${categorySlug}`],
				},
			},
		};
	}
	return {};
}
```

- [ ] **Step 3: Update `/api/layout/+server.ts` to use `layoutModel()` + `gatewayProviderOptions()`**

Find the `generateText({ ... })` call. Replace direct `gateway('anthropic/claude-haiku-4.5')` with `layoutModel()`. Spread `gatewayProviderOptions(persona, categorySlug, 'layout')` into the call.

```ts
import { layoutModel, gatewayProviderOptions } from '$lib/server/ai-model';
// ...
const aiResult = await generateText({
	model: layoutModel(),
	prompt,
	experimental_output: Output.object({ schema: layoutSchema }),
	...gatewayProviderOptions(persona, categorySlug, 'layout'),
});
```

- [ ] **Step 4: Update `/api/refine/+server.ts` and `/api/suggest/+server.ts` similarly**

Both currently import `gateway` from `'ai'` directly. Replace each with imports from `'$lib/server/ai-model'` and use `layoutModel()` + `gatewayProviderOptions(persona, categorySlug, 'refine' | 'suggest')`.

- [ ] **Step 5: Update `/api/layout/stream/+server.ts`**

Already uses `layoutModel()`. Add the spread:

```ts
const stream = streamText({
	model: layoutModel(),
	prompt,
	...gatewayProviderOptions(persona, categorySlug, 'layout-stream'),
});
```

- [ ] **Step 6: Update `enrichment/enrich.ts`**

Currently imports `generateText, Output, embedMany` from `'ai'`. The `embedMany` call uses an embedding model — that's a **separate Anthropic endpoint**. CF AI Gateway proxies it the same way. Update the model factory in this file to use `cfAig` (or extract a helper into `ai-model.ts`):

```ts
// Add to ai-model.ts:
export function embeddingModel() {
	if (useCfAig && cfAig) return cfAig.textEmbeddingModel('voyage-3'); // verify exact ID at execution
	if (useVercelGateway) return gateway.textEmbeddingModel('anthropic/voyage-3');
	return directAnthropic.textEmbeddingModel('voyage-3');
}
```

Replace `enrich.ts`'s embedding-model creation with `embeddingModel()`. **Note:** if Anthropic embeddings are not the actual provider used (the existing code may use OpenAI or Voyage directly — check current code), adjust accordingly. Don't assume; verify and adapt.

- [ ] **Step 7: Local smoke test**

```bash
# In .dev.vars, set CF_AIG_ACCOUNT_ID + CF_AIG_GATEWAY_ID + ANTHROPIC_API_KEY (no AI_GATEWAY vars)
npm run build
npx wrangler dev
# In another terminal:
curl "http://localhost:8787/api/layout?persona=family-shopper&category=women" | head -c 500
```

Expected: valid JSON layout returned. Check CF AI Gateway dashboard — request logged with `feature:layout` metadata. Repeat for `/api/suggest` and `/api/refine` smoke checks.

- [ ] **Step 8: Streaming smoke**

```bash
curl -N -v -w "\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" \
  "http://localhost:8787/api/layout/stream?persona=family-shopper&category=women&fresh=1"
```

Expected: TTFB < 2s, chunks visible over time. If buffered: apply spike T5 Step 4 mitigation (hand-rolled `new Response(stream)`). Capture timing in commit message.

- [ ] **Step 9: Commit**

```bash
git add src/lib/server/ai-model.ts src/routes/api/layout/+server.ts src/routes/api/layout/stream/+server.ts src/routes/api/refine/+server.ts src/routes/api/suggest/+server.ts src/lib/server/enrichment/enrich.ts
git commit -m "feat(ai): route all generateText/streamText through CF AI Gateway via createAnthropic baseURL"
```

---

## Task 3: Multi-brand `wrangler.toml` + secret setup

**Files:**
- Modify: `wrangler.toml`

**Decision point:** one CF AI Gateway per brand, or shared. **Default: per brand** — observability slices cleanly, billing slices cleanly. Cost is identical (gateway is free).

- [ ] **Step 1: Create three CF AI Gateways**

In Cloudflare dashboard: AI Gateway → New, three times. Names:
- `aisles-bealls`
- `aisles-bealls-fl`
- `aisles-hc`

Capture each gateway ID in `docs/operations/cutover-runbook.md`.

- [ ] **Step 2: Production-grade `wrangler.toml`**

Replace any spike-version `wrangler.toml` with:

```toml
name = "aisles-demo"
main = ".svelte-kit/cloudflare/_worker.js"
compatibility_date = "2026-05-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = ".svelte-kit/cloudflare"
binding = "ASSETS"

# Observability — Workers Logs to capture console.log + errors
[observability]
enabled = true

# --- Per-brand environments ---

[env.bealls]
name = "aisles-demo-1"
vars = { BRAND_ID = "bealls", CF_AIG_GATEWAY_ID = "aisles-bealls" }

[env.bealls-fl]
name = "aisles-demo-2"
vars = { BRAND_ID = "bealls-fl", CF_AIG_GATEWAY_ID = "aisles-bealls-fl" }

[env.home-centric]
name = "aisles-demo-3"
vars = { BRAND_ID = "home-centric", CF_AIG_GATEWAY_ID = "aisles-hc" }
```

`CF_AIG_ACCOUNT_ID` is set as a secret (it's the same across brands but treated as sensitive).

- [ ] **Step 3: Set per-brand secrets**

For each of the three envs, set:
```bash
for env in bealls bealls-fl home-centric; do
  npx wrangler secret put ANTHROPIC_API_KEY --env $env
  npx wrangler secret put DATABASE_URL --env $env
  npx wrangler secret put KV_REST_API_URL --env $env
  npx wrangler secret put KV_REST_API_TOKEN --env $env
  npx wrangler secret put CF_AIG_ACCOUNT_ID --env $env
  npx wrangler secret put BIGCOMMERCE_STORE_HASH --env $env
  npx wrangler secret put BIGCOMMERCE_CLIENT_ID --env $env
  npx wrangler secret put BIGCOMMERCE_CLIENT_SECRET --env $env
  npx wrangler secret put BIGCOMMERCE_ACCESS_TOKEN --env $env
  npx wrangler secret put BIGCOMMERCE_CHANNEL_ID --env $env
  npx wrangler secret put BIGCOMMERCE_STOREFRONT_TOKEN --env $env
done
```

The values per brand are not identical — Bealls FL and HC each have their own BigCommerce channel ID and likely separate store hashes. **Pull current values from Vercel** before running:

```bash
vercel env pull --environment=production .env.bealls.production
# repeat for bealls-fl, home-centric (run from each Vercel project's directory or use --project flag)
```

- [ ] **Step 4: Deploy each brand to a `workers.dev` URL for parallel testing**

```bash
npm run build
npx wrangler deploy --env bealls
npx wrangler deploy --env bealls-fl
npx wrangler deploy --env home-centric
```

Capture URLs (e.g., `aisles-demo-1.<account>.workers.dev`) in cutover-runbook.md.

- [ ] **Step 5: Smoke each URL**

For each Worker URL:
- Open `/` — verify brand-correct logo, copy
- Open `/category/women` — verify layout generates
- Open `/store-locator` — verify HC's content mode loads correctly
- Hit `/api/layout?persona=family-shopper&category=women` — verify JSON response
- Hit each gateway's CF AI Gateway dashboard — verify request logged with correct brand-side metadata

- [ ] **Step 6: Commit**

```bash
git add wrangler.toml
git commit -m "feat(deploy): production wrangler.toml with three brand envs"
```

---

## Task 4: GitHub Actions CI/CD pipeline

**Files:**
- Create: `.github/workflows/deploy-cloudflare.yml`

**Hypothesis:** A single workflow with a brand matrix deploys all three on `main` push. Manual `workflow_dispatch` allows targeted single-brand redeploys.

- [ ] **Step 1: Create the workflow file**

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      brand:
        description: Single brand to deploy (or "all")
        required: true
        default: all
        type: choice
        options: [all, bealls, bealls-fl, home-centric]

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      bundle-size: ${{ steps.size.outputs.bytes }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npm run build
      - id: size
        run: |
          bytes=$(gzip -c .svelte-kit/cloudflare/_worker.js | wc -c)
          echo "bytes=$bytes" >> "$GITHUB_OUTPUT"
          echo "Worker bundle: $((bytes / 1024)) KB compressed"
          if [ "$bytes" -gt 10485760 ]; then
            echo "::error::Bundle exceeds 10 MB limit"; exit 1
          fi
      - uses: actions/upload-artifact@v4
        with:
          name: cloudflare-build
          path: .svelte-kit/cloudflare
          retention-days: 7

  deploy:
    needs: build
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        brand: [bealls, bealls-fl, home-centric]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: cloudflare-build
          path: .svelte-kit/cloudflare
      - name: Skip non-selected brands on manual dispatch
        if: github.event_name == 'workflow_dispatch' && github.event.inputs.brand != 'all' && github.event.inputs.brand != matrix.brand
        run: |
          echo "Skipping ${{ matrix.brand }} — manual dispatch targeted ${{ github.event.inputs.brand }}"
          exit 0
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --env ${{ matrix.brand }}
```

- [ ] **Step 2: Set GitHub Actions secrets**

In GitHub repo Settings → Secrets:
- `CLOUDFLARE_API_TOKEN` — generate at Cloudflare dashboard with permissions: Workers Scripts:Edit, Workers Routes:Edit, AI Gateway:Edit, Account: Read
- `CLOUDFLARE_ACCOUNT_ID` — from Cloudflare dashboard

- [ ] **Step 3: Test the workflow on a non-`main` branch**

Push the migration branch. Workflow will not auto-trigger (only `main` does). Manually trigger via GitHub UI: Actions → Deploy to Cloudflare Workers → Run workflow → choose this branch + brand=bealls.

Expected: build succeeds, single brand deploys, bundle size logged.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy-cloudflare.yml
git commit -m "ci: github actions workflow for cloudflare workers deploy (3-brand matrix)"
```

---

## Task 5: Streaming endpoint hardening

**Files:**
- Modify (conditional): `src/routes/api/layout/stream/+server.ts`

**Hypothesis:** If T2 Step 8 confirmed streaming works without intervention, this task is verification-only. If buffering was observed, the spike T5 mitigation (hand-rolled Response from `textStream`) was applied — this task makes it permanent and tests on the deployed Worker.

- [ ] **Step 1: Re-run streaming test against deployed Worker**

```bash
curl -N -v -w "\nTTFB: %{time_starttransfer}s\n" \
  "https://aisles-demo-1.<account>.workers.dev/api/layout/stream?persona=family-shopper&category=women&fresh=1"
```

Expected: TTFB < 2s, chunks arrive over time. If TTFB ≈ Total, response was buffered through Cloudflare's edge — apply Step 2.

- [ ] **Step 2 (only if buffered): Lock in the hand-rolled Response**

Edit `src/routes/api/layout/stream/+server.ts`. Replace the AI SDK Response helper with:

```ts
const result = streamText({
	model: layoutModel(),
	prompt,
	...gatewayProviderOptions(persona, categorySlug, 'layout-stream'),
});

const stream = new ReadableStream({
	async start(controller) {
		const encoder = new TextEncoder();
		try {
			for await (const chunk of result.textStream) {
				controller.enqueue(encoder.encode(chunk));
			}
		} catch (err) {
			controller.error(err);
			return;
		}
		controller.close();
	},
});

return new Response(stream, {
	headers: {
		'content-type': 'text/event-stream',
		'cache-control': 'no-cache, no-transform',
		'x-accel-buffering': 'no',
	},
});
```

Re-run Step 1. If still buffered: hard blocker. Stop and escalate — the demo's marquee feature can't ship.

- [ ] **Step 3: Add a Playwright test for streaming**

```bash
mkdir -p tests/e2e
```

Create `tests/e2e/streaming.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('layout stream delivers chunks incrementally', async ({ request }) => {
	const baseURL = process.env.SMOKE_TARGET_URL ?? 'http://localhost:8787';
	const start = Date.now();
	const res = await request.get(`${baseURL}/api/layout/stream?persona=family-shopper&category=women&fresh=1`);
	expect(res.ok()).toBeTruthy();

	const reader = res.body();
	let firstByteAt = 0;
	let totalBytes = 0;
	for await (const chunk of reader) {
		if (firstByteAt === 0) firstByteAt = Date.now() - start;
		totalBytes += chunk.length;
	}
	const total = Date.now() - start;
	expect(firstByteAt, `TTFB should be < 3000ms, was ${firstByteAt}ms`).toBeLessThan(3000);
	expect(total - firstByteAt, `streaming duration should be > 500ms, was ${total - firstByteAt}ms`).toBeGreaterThan(500);
	expect(totalBytes, `should receive at least 1KB`).toBeGreaterThan(1024);
});
```

- [ ] **Step 4: Run the test against deployed Worker**

```bash
SMOKE_TARGET_URL=https://aisles-demo-1.<account>.workers.dev npx playwright test tests/e2e/streaming.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/layout/stream/+server.ts tests/e2e/streaming.spec.ts
git commit -m "test(stream): playwright assertion for incremental SSE delivery"
```

---

## Task 6: Observability — dashboards + alerts

**Files:**
- Create: `docs/operations/dashboards.md` (links + screenshots)

**Hypothesis:** CF AI Gateway dashboard answers our top-five operational queries (validated in spike T6). Workers Analytics covers request-level metrics. Workers Logs covers errors.

- [ ] **Step 1: Bookmark per-brand dashboards**

For each brand:
- CF AI Gateway: `https://dash.cloudflare.com/<account>/ai/ai-gateway/<gateway-id>`
- Workers Analytics: `https://dash.cloudflare.com/<account>/workers/services/view/aisles-demo-{1,2,3}`
- Workers Logs: same page, Logs tab

Document URLs in `docs/operations/dashboards.md`.

- [ ] **Step 2: Configure alerts**

In Cloudflare → Notifications → Add. Suggested alerts:
- Workers error rate >5% over 5min for any of the three Workers
- AI Gateway request volume drops by >50% vs prior hour (signal that Anthropic is down or our auth broke)
- Workers CPU time p95 >25s (approaching the 30s default limit)

- [ ] **Step 3: Document alert thresholds**

Append to `docs/architecture/observability.md`:

```markdown
## Cloudflare alerts (live as of cutover)

- Workers error rate >5% over 5min — page on-call
- AI Gateway volume drop >50%/h — investigate auth or upstream Anthropic
- Workers CPU p95 >25s — investigate slow path; 30s is hard limit
```

- [ ] **Step 4: Commit**

```bash
git add docs/operations/dashboards.md docs/architecture/observability.md
git commit -m "docs(observability): cloudflare dashboards + alert thresholds for cutover"
```

---

## Task 7: DNS preparation — TTL drop

**Files:**
- Create: `docs/operations/dns-cutover.md` (per-brand DNS state and step-by-step)

**Hypothesis:** Lower TTLs on the three brand domains a week before cutover so that if rollback is needed, DNS propagation is fast (5min vs 24h+).

- [ ] **Step 1: Inventory current DNS state**

For each brand domain, document in `dns-cutover.md`:
- Current registrar
- Current authoritative nameservers
- Current `A`/`AAAA`/`CNAME` records pointing to Vercel
- Current TTL values

- [ ] **Step 2: Drop TTLs to 300s (5 min) seven days before cutover-day**

This is a manual operator step in each domain's DNS panel. Document the timestamp of each change.

- [ ] **Step 3: Commit the DNS plan**

```bash
git add docs/operations/dns-cutover.md
git commit -m "docs(ops): dns cutover plan with ttl drop schedule"
```

(No code changes — this is an operator runbook.)

---

## Task 8: Per-brand cutover

**Files:** none — operational steps only.

**Sequence:** Bealls → 48h soak → Bealls FL → 48h soak → Home Centric.

Each brand follows the same procedure. Run T8.A, T8.B, T8.C sequentially with the soak between.

### T8.A: Cutover Bealls (`aisles-demo-1`)

- [ ] **A1: Pre-flight checklist**
  - [ ] Latest deploy on `aisles-demo-1.<account>.workers.dev` is green
  - [ ] CF AI Gateway dashboard shows healthy traffic from synthetic checks
  - [ ] Vercel deploy on `aisles-demo-1-signal-x-studio-labs.vercel.app` is the rollback target — confirm it is live and serves correctly
  - [ ] DNS TTL has been at 300s for at least 24h
  - [ ] Post in #demo-ops Slack: "Bealls cutover starting at HH:MM"

- [ ] **A2: Add custom domain to Worker**

In Cloudflare dashboard: Workers → `aisles-demo-1` → Triggers → Custom Domains → Add. Domain: the Bealls demo domain.

- [ ] **A3: Update DNS**

In the registrar's DNS panel:
- Remove existing `A`/`AAAA`/`CNAME` to Vercel
- Add `CNAME` (or proxied A record if Cloudflare-managed) to the Worker

Wait 5 minutes for propagation.

- [ ] **A4: Smoke the live domain**

```bash
curl -sI https://<bealls-domain>/ | head
curl -s "https://<bealls-domain>/api/layout?persona=family-shopper&category=women" | head -c 200
```

Expected: Server: cloudflare, valid layout JSON. Check CF AI Gateway dashboard — request appears with `feature:layout` metadata.

- [ ] **A5: Run the streaming Playwright test against the live domain**

```bash
SMOKE_TARGET_URL=https://<bealls-domain> npx playwright test tests/e2e/streaming.spec.ts
```

- [ ] **A6: Hand off to brand UAT**

Notify the Bealls product owner: "Cutover live, please run through your demo script and report any issues within 24h."

- [ ] **A7: Update cutover log**

In `docs/operations/cutover-runbook.md`, append a row: "Bealls cut over YYYY-MM-DD HH:MM, smoke green, UAT pending."

### T8.B: 48-hour soak + cutover Bealls FL

- [ ] **B1: 48h soak — monitor Bealls**

Watch CF AI Gateway dashboard, Workers error rate, brand UAT feedback. **If any P1 issue: invoke rollback runbook (T8.rollback) for Bealls before proceeding.**

- [ ] **B2: Repeat A1–A7 for Bealls FL** (`aisles-demo-2`, gateway `aisles-bealls-fl`)

### T8.C: 48-hour soak + cutover Home Centric

- [ ] **C1: 48h soak — monitor Bealls + Bealls FL**

- [ ] **C2: Repeat A1–A7 for Home Centric** (`aisles-demo-3`, gateway `aisles-hc`)

**Special HC concern:** HC operates in content mode with the store-locator surface as a primary path. Add to A4 smoke for HC:

```bash
curl -sI "https://<hc-domain>/store-locator?zip=33486" | head
```

### T8.rollback (per brand, used only if a cutover fails)

- [ ] **R1: Revert DNS to Vercel records** in the registrar panel.
- [ ] **R2: Wait 5 min for TTL propagation.**
- [ ] **R3: Smoke the Vercel-served domain** to confirm rollback live.
- [ ] **R4: Investigate the issue on the Worker side without DNS pressure.**
- [ ] **R5: Append rollback entry to `cutover-runbook.md` with timestamps + cause.**

**Alternate rollback (no DNS change):** flip the env var on the Worker:
```bash
npx wrangler secret put AI_GATEWAY_API_KEY --env <brand>  # set to the legacy Vercel AI Gateway key
npx wrangler secret delete CF_AIG_GATEWAY_ID --env <brand>  # forces ai-model.ts to fall through to Vercel gateway path
npx wrangler deploy --env <brand>
```
This keeps the Worker serving traffic but reverts the AI gateway to Vercel — useful if the issue is gateway-specific not Worker-specific.

---

## Task 9: Two-week soak

**Files:** none — observation only.

- [ ] **Step 1: Monitor daily for two weeks**

Daily check, 5 minutes each:
- Workers error rate (per brand)
- CF AI Gateway request count (per brand) — expect roughly stable vs prior Vercel volumes
- Any pages or alerts triggered
- Any UAT feedback from brand teams

Log daily check in `cutover-runbook.md`.

- [ ] **Step 2: Capture any post-cutover issues found**

For each issue: was it Cloudflare-specific? Vercel-side bug we just inherited? Pre-existing? Document.

- [ ] **Step 3: At T+14 days, decide: decommission Vercel or extend soak**

Default: decommission. Extend if there's any unresolved issue.

---

## Task 10: Decommission Vercel + remove dependencies

**Files:**
- Modify: `package.json` (remove `@sveltejs/adapter-vercel`, `@ai-sdk/gateway`)
- Modify: `src/lib/server/ai-model.ts` (remove the `useVercelGateway` branch)
- Modify: `.env.example` (remove AI_GATEWAY_API_KEY, VERCEL_OIDC_TOKEN)

- [ ] **Step 1: Pause Vercel auto-deploys**

In each Vercel project (Settings → Git → Production Branch): change production branch to a non-existent name like `disabled` so no further auto-deploys happen.

- [ ] **Step 2: Wait 24h, confirm no rollback needed.**

- [ ] **Step 3: Delete Vercel projects**

In each Vercel project (Settings → Advanced → Delete Project). Confirm three deletions.

- [ ] **Step 4: Remove deps from `package.json`**

```bash
npm uninstall @sveltejs/adapter-vercel @ai-sdk/gateway
```

- [ ] **Step 5: Remove `useVercelGateway` branch from `ai-model.ts`**

Final state:

```ts
import { createAnthropic } from '@ai-sdk/anthropic';
import { env } from '$env/dynamic/private';

export const useCfAig = !!(env.CF_AIG_ACCOUNT_ID && env.CF_AIG_GATEWAY_ID);

const directAnthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

const cfAig = useCfAig
	? createAnthropic({
			apiKey: env.ANTHROPIC_API_KEY,
			baseURL: `https://gateway.ai.cloudflare.com/v1/${env.CF_AIG_ACCOUNT_ID}/${env.CF_AIG_GATEWAY_ID}/anthropic`,
		})
	: null;

export function layoutModel() {
	if (useCfAig && cfAig) return cfAig('claude-haiku-4-5-20251001');
	return directAnthropic('claude-haiku-4-5-20251001');
}

export function gatewayProviderOptions(persona: string, categorySlug: string, feature = 'layout') {
	if (!useCfAig) return {};
	return {
		headers: {
			'cf-aig-metadata': JSON.stringify({ feature, persona, category: categorySlug }),
		},
	};
}
```

- [ ] **Step 6: Remove `import { gateway } from 'ai'` from any callsite that still has it**

```bash
git grep -n "import.*gateway.*from ['\"]ai['\"]" -- src/
```

Expected: empty after T2 work. If any remain, remove.

- [ ] **Step 7: Update `.env.example`**

Replace AI gateway block with:

```
CF_AIG_ACCOUNT_ID=
CF_AIG_GATEWAY_ID=

ANTHROPIC_API_KEY=
```

- [ ] **Step 8: Run full check + build**

```bash
npm run check
npm run build
```

Expected: green. Bundle size measured and logged (likely smaller without `@ai-sdk/gateway`).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/lib/server/ai-model.ts .env.example
git commit -m "chore(deploy): remove vercel adapter + ai-gateway after migration soak"
```

---

## Task 11: ADR + cross-doc updates

**Files:**
- Create: `docs/architecture/decisions/009-deploy-target-cloudflare.md`
- Modify: `docs/architecture/ARCHITECTURE.md` (stack section)
- Modify: `docs/architecture/multi-brand.md` (deploy targets)
- Modify: `docs/developer/development.md` (replace `vercel` commands with `wrangler`)
- Modify: `docs/developer/api-reference.md` (deployment URLs)
- Modify: `CLAUDE.md` (Repository specifics section)
- Modify: `traceability.json` (bump `updated`, touch any deploy-target rows)

- [ ] **Step 1: Write ADR-009**

```markdown
# ADR-009: Deploy target Cloudflare Workers + Cloudflare AI Gateway

**Date:** 2026-MM-DD
**Status:** Accepted
**Supersedes (partial):** prior implicit "Vercel + Vercel AI Gateway" stack choice

## Context

Aisles ran on Vercel (three projects, one per brand) with Vercel AI Gateway routing Anthropic calls. Two pressures motivated re-evaluation:
1. Vendor concentration risk: hosting and AI gateway in the same vendor doubles outage exposure to Vercel without offsetting benefit.
2. Cost: Vercel AI Gateway applies a markup on third-party tokens; Cloudflare AI Gateway is free.

## Decision

Migrate to Cloudflare Workers (one Worker per brand via Wrangler envs) and Cloudflare AI Gateway. AI SDK integration is unchanged — `@ai-sdk/anthropic` with a `baseURL` override at `https://gateway.ai.cloudflare.com/v1/{acct}/{gw}/anthropic`.

## Considered alternatives

- **Stay on Vercel.** Rejected — token markup, vendor concentration.
- **Cloudflare hosting + Portkey AI gateway.** Rejected during spike — `@portkey-ai/vercel-provider` is 14-month-stale and predates AI SDK v6; Portkey adds a vendor without offsetting Cloudflare's native gateway.
- **Cloudflare hosting + direct Anthropic, no gateway.** Rejected — loses observability + fallback features we depend on.

## Consequences

**Positive:**
- Single vendor for hosting + AI gateway → unified observability, billing, support
- No token markup
- Native Workers → AI Gateway integration (no extra hop)
- AI SDK code path unchanged from current `@ai-sdk/anthropic` surface

**Negative / accepted:**
- 5-metadata-field limit per request (we use 3 today; 2 fields of headroom)
- Per-request fallback chains require the Universal endpoint which sacrifices the clean SDK integration; we use dashboard-level fallback config instead
- Wrangler secrets management is more verbose than Vercel env UI

## See also

- Spike report: `docs/spikes/2026-05-05-cloudflare-portkey/REPORT.md`
- Adapter feasibility: `docs/spikes/2026-05-05-cloudflare-portkey/adapter-feasibility.md`
- CF AI Gateway decision memo: `docs/spikes/2026-05-05-cloudflare-portkey/cf-ai-gateway-decision.md`
- Migration plan: `docs/superpowers/plans/2026-05-05-cloudflare-aigateway-migration.md`
```

- [ ] **Step 2: Update `docs/architecture/ARCHITECTURE.md`**

Find the stack section. Replace:
- "Vercel" → "Cloudflare Workers"
- "Vercel AI Gateway" → "Cloudflare AI Gateway"
- "Vercel Functions" → "Workers"
- Any mention of `@sveltejs/adapter-vercel` → `@sveltejs/adapter-cloudflare`

- [ ] **Step 3: Update `docs/architecture/multi-brand.md`**

Replace "three Vercel projects" with "three Workers (Wrangler envs)". Replace deploy-URL references with workers.dev URLs (or production custom domains).

- [ ] **Step 4: Update `docs/developer/development.md`**

Replace `vercel dev` / `vercel env pull` instructions with `wrangler dev` / `.dev.vars` instructions. Reference `wrangler.toml` for adapter config.

- [ ] **Step 5: Update `docs/developer/api-reference.md`**

Update production URLs.

- [ ] **Step 6: Update `CLAUDE.md` Repository specifics section**

Replace:

```
- Three Vercel projects deploy off `main`: `aisles-demo-1` (Bealls), `aisles-demo-2` (Bealls Florida), `aisles-demo-3` (Home Centric). Aliases: `aisles-demo-{N}-signal-x-studio-labs.vercel.app`.
```

With:

```
- Three Cloudflare Workers deploy off `main` via Wrangler envs: `aisles-demo-1` (Bealls), `aisles-demo-2` (Bealls Florida), `aisles-demo-3` (Home Centric). Brand selection via `BRAND_ID` env in each `[env.*]` block of `wrangler.toml`. AI calls route through three CF AI Gateways (`aisles-bealls`, `aisles-bealls-fl`, `aisles-hc`).
```

Update the Stack line too: `@sveltejs/adapter-cloudflare` not `adapter-vercel`; "CF AI Gateway" not "Vercel AI Gateway".

- [ ] **Step 7: Update `traceability.json`**

Bump `updated` to today's date. If any registry rows mention the deploy target explicitly, update them.

- [ ] **Step 8: Update `.env.example`** (if not done in T10)

- [ ] **Step 9: Commit**

```bash
git add docs/architecture/decisions/009-deploy-target-cloudflare.md \
        docs/architecture/ARCHITECTURE.md \
        docs/architecture/multi-brand.md \
        docs/developer/development.md \
        docs/developer/api-reference.md \
        CLAUDE.md \
        traceability.json
git commit -m "docs: ADR-009 deploy target cloudflare + cross-doc updates"
```

---

## Task 12: PR + merge to main

**Files:** none — branch operations only.

- [ ] **Step 1: Open PR**

```bash
gh pr create --title "feat: migrate to Cloudflare Workers + AI Gateway" --body "$(cat <<'EOF'
## Summary

Cuts over from Vercel + Vercel AI Gateway to Cloudflare Workers + CF AI Gateway, all three brands. Spike validated. ADR-009 records the decision.

## Test plan

- [ ] All three brand workers.dev deploys green
- [ ] Streaming endpoint passes Playwright TTFB+chunking assertion
- [ ] CF AI Gateway dashboards show traffic with correct metadata
- [ ] DNS TTLs at 300s for ≥24h before cutover (per T7)
- [ ] Cutover runbook executed per T8 (Bealls → soak → Bealls FL → soak → HC)
- [ ] Two-week soak complete (T9)
- [ ] Vercel projects deleted (T10)
- [ ] All cross-doc updates merged (T11)

## Rollback

Per-brand DNS revert (5min via TTL=300s) within the two-week soak. After Vercel decommission, rollback requires `git revert` of T10 + redeploying to Vercel.
EOF
)"
```

- [ ] **Step 2: Merge PR**

After all checkboxes above are green and reviewer approval. Default merge style: squash, with the conventional-commits-style title preserved.

- [ ] **Step 3: Delete migration branch**

```bash
git branch -d feat/cloudflare-aigateway-migration
git push origin --delete feat/cloudflare-aigateway-migration
```

---

## Self-review

- [ ] Every prerequisite is checkable (no vague "spike done").
- [ ] Cutover is per-brand with explicit soak windows (not a big-bang).
- [ ] Rollback is documented for both pre-decommission (DNS revert + env-flag flip) and post-decommission (`git revert` + Vercel redeploy).
- [ ] Doc updates cover the four canonical-state docs that mention deploy target (ARCHITECTURE, multi-brand, CLAUDE.md, traceability).
- [ ] ADR-009 references the spike artifacts so future readers can reconstruct the reasoning.
- [ ] No emoji.
- [ ] No placeholders ("TBD", "fill in later") — every step has the actual content the operator needs.
- [ ] Type/name consistency: `useCfAig`, `layoutModel`, `gatewayProviderOptions`, `cf-aig-metadata` used consistently across tasks.

---

## Out of scope

These are explicitly deferred to future work:

- Cloudflare D1 / KV migration — Neon + Upstash stay external. Re-evaluate if Neon/Upstash bills become material.
- Cloudflare Images — no asset hosting in this migration; deferred.
- R2 for any future asset hosting.
- Custom Workers Analytics Engine dashboards beyond CF AI Gateway's built-ins.
- Logpush archival to S3/BigQuery — only needed if log retention beyond 10M/gateway becomes binding.
- Engine-layer prompt or schema changes — gateway choice is layer-orthogonal.
- Admin app (`aisles-admin`) — separate repo, not in scope here.
- Edge config / Hyperdrive evaluation — keep Neon/Upstash HTTP for now.

---

## Estimated duration

| Phase | Tasks | Calendar time | Active work |
|---|---|---|---|
| Build out CF infra in parallel | T0–T6 | 4 days | ~3 days |
| DNS prep | T7 | 7 days (waiting for TTL drop) | <1 hour |
| Per-brand cutover with soaks | T8 | 5 days (2× 48h soaks + cutovers) | ~6 hours total |
| Soak | T9 | 14 days | 5 min/day |
| Decommission + cleanup | T10–T12 | 1 day | 1 day |
| **Total** | — | **~31 days calendar** | **~5 days active** |

The calendar timeline is dominated by deliberate soak windows. The active engineering work is roughly a developer-week.
