# Cloudflare redeploy — plan

**Written:** 2026-07-30
**Status:** executed 2026-07-31. All four brands are live. See **Outcome** below.
**Research appendices:** `research/runtime-and-adapter.md`, `research/backing-services.md`, `research/catalog-liveness.md`
**Code:** branch `cf-deploy` (commits `8f4cf7f`, `f44c730`), not yet pushed or merged.

---

## Outcome (2026-07-31)

Four Workers on the main account (`b6ffcf20…`), one per brand, each with its own build
because `VITE_BRAND_ID` is a build-time constant. Each routes to its own AI Gateway; all
four gateways were confirmed receiving successful Haiku 4.5 traffic after deploy.

| Worker | Home | Category pages | Notes |
|---|---|---|---|
| [aisles-bealls](https://aisles-bealls.biq.workers.dev) | works | works | 1,449 products, full catalog |
| [aisles-beallsflorida](https://aisles-beallsflorida.biq.workers.dev) | works | **404** | BC tree repurposed → 25 Particle skincare products |
| [aisles-homecentric](https://aisles-homecentric.biq.workers.dev) | works | works | content mode; no catalog by design |
| [aisles-sleepcountry](https://aisles-sleepcountry.biq.workers.dev) | works | **404** | channel 1 repurposed → dog-food catalog |

**B1 (background work dropped) is fixed and proven.** `src/lib/server/bg.ts` routes the ten
floating promises through `platform.ctx.waitUntil`. Measured on bealls: first call
`cacheHit=false` at 7,766 ms, second `cacheHit=true` at 45 ms. Before the fix the second
call would also have been a miss.

**B2 was already resolved on the spike branch** — `api/refine/+server.ts:115` calls
`layoutModel()`, not `gateway(...)` directly. Verified live: `/api/refine` on bealls returns
a full refinement payload. This plan's B2 entry is stale.

**B3 is fixed.** All four environments set `CF_AIG_ACCOUNT_ID` alongside `CF_AIG_GATEWAY_ID`.

### Content mode had never been deployed, and was broken three ways

Home Centric is the only `mode: 'content'` brand, so none of these had ever been hit. All
three are fixed in `f44c730`:

1. **Prompt/schema drift.** The prompt offered 11 content components; the `ContentBlocks`
   Zod union accepted 6. Every content-mode generation failed with *"response did not match
   schema."* `CONTENT_WIDE_BLOCKS` is now derived from the union, so the two cannot drift again.
2. **`loadCategoryProducts` had no content-mode short-circuit** (its sibling `loadHomeProducts`
   did), so it hit the Storefront API and threw *"Storefront token not configured."* Scope
   note: the category **page** never hit this — `+page.server.ts:22` short-circuits content
   mode before calling the loader, which is why `/category/bedroom` returned 200 even while
   broken. The callers that did break are the five API routes that go through the loader:
   `/api/layout`, `/api/layout/stream`, `/api/refine`, `/api/suggest`, and
   `/api/observe/enrichment`. So a content PLP rendered, but its refinement chat and any
   AI-composed zone on it did not.
3. **`/search` called `getProducts(50)` unconditionally** and 500'd, despite the layout prompt
   already carrying copy for exactly this case. This one *was* user-visible.

### One cache is brand-unsafe, and only the per-Worker split hides it

`bigcommerce.ts`'s `categoriesCache` is module-scope with a 30-minute TTL and **no brand key**.
It is correct today only because each brand runs in its own Worker, hence its own isolate. The
consolidation floated in `wrangler.toml`'s header comment — one Worker for all brands once
`getBrand()` moves to Svelte context — must key this cache first, or brand A serves brand B's
category tree for up to half an hour. Sibling caches in `enrichment/query.ts` and
`admin-overrides.ts` are already brand- or entity-keyed; this is the only one that is not.
Noted in the code at the declaration.

### The catalog problem is now two brands, not one

Both non-working catalogs failed the same way: the BigCommerce container was reassigned to a
different demo. `beallsflorida`'s category tree now holds Particle skincare; `sleepcountry`'s
channel 1 now holds dog food. Both 404 to the rescue surface, which is the designed behavior —
they do not render wrong products on a PLP. Home *does* compose from whatever the channel
returns, so sleepcountry's homepage currently merchandises dog food under a mattress brand.

Restoring either is an operator decision, not a code fix. See **Catalog** below.

### Secrets

`SLEEPCOUNTRY_STOREFRONT_TOKEN` did not exist. Minted against channel 1 (expires 2027-07-31),
stored as `BigCommerce bealls-aisles/storefront_token_sleepcountry`, round-trip verified. Its
allowed origin in `scripts/bc-tokens.config.mjs` moved off the dead `aisles-demo-4` hackathon
host. Each Worker carries 7 secrets; the two storefront brands carry 8.

---

## Bottom line

**Most of this migration already exists.** Branch `worktree-spike-cloudflare-portkey` carries
`@sveltejs/adapter-cloudflare`, a four-environment `wrangler.toml`, the Cloudflare AI Gateway seam
(`useCfAig` / `CF_AIG_GATEWAY_ID`), and ADR-010 declaring Cloudflare a parallel deploy target rather
than a replacement. It is unmerged, and nothing is currently serving: `aisles-demo-{1..4}.biq.workers.dev`
all return 404, and the `*-cf.internal.signal-x.dev` hostnames named in ADR-010 do not resolve at all.

So the job is **merge and repair**, not migrate. Three things block a working redeploy, and one of
them costs money on every request.

Two premises in the original framing turned out to be wrong, both verified:

- **BigCommerce is not dead.** Credentials resolve, tokens are valid until 2027-04-27, and the bealls
  channel serves 1,449 products with 100% enrichment coverage. **No mock catalog is needed.**
- **The Cloudflare work is not greenfield.** See above.

---

## What is actually broken

### B1 — Background work is silently dropped on Workers *(blocking, costs money)*

Ten promises are launched with `.catch(() => {})` and never awaited or handed to `waitUntil`. On a warm
Vercel lambda they complete. On Workers they are cancelled when the response finishes.

Two of them are `cacheLayout(...)` — `api/layout/+server.ts:219` and `api/layout/stream/+server.ts:140`.
Without them the Redis layout cache is never written, so **every request pays the full 8–13 s LLM
generation and its token cost, forever.** `cache.ts:5` documents the intent: "First visitor generates
(8-13s), subsequent visitors get sub-100ms." On Workers, without a fix, every visitor is the first
visitor.

The spike branch does **not** fix this — `git grep waitUntil` on that branch returns nothing.

Fix: a small `bg(platform, promise)` helper wrapping `platform.ctx.waitUntil`. Full list of the ten call
sites and the helper source are in `research/runtime-and-adapter.md` § P0-1.

### B2 — `/api/refine` has no fallback path

`api/refine/+server.ts:113` calls `gateway(...)` directly rather than going through `layoutModel()`, so it
has no direct-Anthropic fallback. Refinement chat 500s unless the gateway credential is set. The
`VERCEL_OIDC_TOKEN` half of the `useGateway` check at `ai-model.ts:18` is dead on Cloudflare.

### B3 — `CF_AIG_ACCOUNT_ID` is unset in `wrangler.toml`, and its absence fails silently

`ai-model.ts:8` gates the Cloudflare gateway on **both** variables:

```ts
export const useCfAig = !!(env.CF_AIG_ACCOUNT_ID && env.CF_AIG_GATEWAY_ID);
```

`wrangler.toml` sets only `CF_AIG_GATEWAY_ID`. If `CF_AIG_ACCOUNT_ID` is not supplied separately,
`useCfAig` is `false` and the code quietly falls through to the Vercel gateway, then to direct Anthropic.
No error — you simply would not be using Cloudflare AI Gateway while believing you were. `.env.example`
does not list the variable either.

The account split is *not* itself a bug. The gateway base URL is built from `CF_AIG_ACCOUNT_ID`
(`ai-model.ts:16`), which is independent of wrangler's `account_id`. So the Worker can legitimately deploy
to BigCommerce Testing (`5e70ef24…`) while the gateways live in the personal account
(`b6ffcf200d…`), where all four were found. **Set `CF_AIG_ACCOUNT_ID` to the account that actually owns
the gateways** and confirm traffic appears in that dashboard after the first deploy.

---

## Backing services: keep all of them

Every service is HTTP/fetch-based and runs from a Worker unchanged. Moving them is not a lateral swap:

| Service | Verdict | Why |
|---|---|---|
| Upstash Redis — layout + suggest cache | **Keep** | Pure `get`/`set`/`scan`/`del` over REST. No atomicity needed anywhere. |
| Upstash Redis — signal session store | **Keep** | KV is *disqualified*: `persistSession()` rewrites the same key on every signal event, and KV caps at 1 write/sec/key. The native fit is a Durable Object per session — a rewrite, not a redeploy. |
| Upstash Redis — cart store | **Keep** | Needs read-after-write across instances. KV does not guarantee it cross-region. |
| Neon Postgres | **Keep** | `neon()` is the HTTP driver. **D1 cannot hold this schema** — it uses `TEXT[]`, `JSONB`, `vector`, `unnest()`, and `&&`. The DB is 10 MB, so size is not the blocker; the type system is. |
| Hyperdrive | **Skip** | Pools TCP connections. This app never opens one. |
| OpenRouter embeddings | **Keep** | No Workers AI model produces 1536 dimensions (cap is 1024). Switching means re-embedding the catalog and altering the column. |
| Cloudflare AI Gateway | **Already wired** | The seam exists on the spike branch. Verify B3 first. |

---

## Configuration notes that differ from the spike branch

The branch's config predates this review. Three corrections:

1. **`compatibility_date` must stay ≥ 2025-04-01.** The branch has `2026-05-01`, which is fine. This is
   not cosmetic — it is what makes `nodejs_compat` auto-populate `process.env`, which `brand/config.ts:381`,
   `zone-retrieval-log.ts:78`, and the AI SDK all depend on.
2. **Drop the `routes: { include, exclude }` adapter option.** It is Pages-only and inert on the Workers
   path. Harmless, but misleading.
3. **Restore `@sveltejs/adapter-vercel`.** ADR-010's own open question: the branch removed it, but the
   parallel-deploy decision requires both adapters so one branch can build either target. Gate adapter
   selection on an env var.

**Workers Paid is a hard requirement.** Free caps CPU at 10 ms per request, which will not cover Svelte 5
SSR plus Zod validation. Paid gives 30 s. Wall-clock is unlimited for HTTP, so the SSE endpoint is safe.

---

## Catalog: fix the data, do not build a mock

| Brand | Status |
|---|---|
| **bealls** | Healthy — channel 1846324, 8 categories, 1,449 products, 100% enrichment, images live. |
| **beallsflorida** | Broken by content, not credentials — its category tree was repurposed for an unrelated "Particle" skincare demo. |
| **homecentric** | Healthy by design — content mode, needs no catalog. |
| **sleepcountry** | Spike branch only — 30 synthetic products, isolated by `categoryPrefix`. |

All 728 Bealls Florida products **still exist** (entityIds 2188–2915, all with images, all `is_visible`).
They were unhooked in two places: zero category assignments and zero channel assignments. Their entityIds
match the 728 orphaned enrichment rows exactly, so re-hooking restores persona-fit scores and semantic
tags for free — no re-enrichment, no LLM spend.

Restoring is ~3–5 hours and needs one operator decision: reclaim the existing tree (breaks whoever is
using the Particle demo) or create a new tree and channel (safer default). Detail in
`research/catalog-liveness.md` § 5, Path A.

A mock catalog provider is fully specified in that same appendix as Path B. **Do not build it now** — it
solves a problem the evidence disproves. One piece of it is worth doing regardless: harvest the live BC
CDN image URLs into fixtures while the store is alive. That is a cheap snapshot that makes Path B a few
hours of work later instead of a rebuild.

`src/lib/server/mock-data.ts` is dead — zero importers, wrong shape, furniture SKUs from the Haven era,
and image paths pointing at a `static/` directory that does not exist. Delete it. It is exactly what a
future reader grepping for "mock" would wrongly assume is the wired fallback.

---

## Sequence

1. Merge or cherry-pick the Cloudflare config from `worktree-spike-cloudflare-portkey`. Apply the three
   corrections above.
2. **Resolve B3** — confirm which account holds the AI Gateways and align `account_id`.
3. Set secrets for `bealls` only. Deploy that one environment.
4. Smoke-test in dependency order: `/` → `/category/[slug]` → add to cart → refinement chat → `/observe`.
5. **Verify the cache writes.** Hit the same category twice; confirm `meta.cacheHit: true` on the second.
   This is the highest-value check in the list — B1 fails silently and costs money on every request.
6. Apply the `waitUntil` fix. Redeploy. Re-verify step 5.
7. Restore the Bealls Florida catalog.
8. Stand up the remaining environments.

Steps 1–6 are roughly a day. Step 7 is 3–5 hours and independent.

---

## Pre-existing defects found along the way

Not caused by the migration; flagged so they do not read as redeploy regressions.

- **`session_outcomes` does not exist in the live Neon database.** `outcomes.ts` writes to it and swallows
  the failure, so every `finalizeSession()` is a silent no-op. `outcomesSummary()` throws uncaught, which
  breaks `/api/observe/inference`. The schema file exists and was never applied.
- **Zero of 2,177 enrichment rows have embeddings.** Every `/search` request pays an OpenRouter embedding
  call, runs a query that can only match nothing, then falls back to tag search.
- **Schema drift.** The live DB has `embedding vector(1536)` and `compatible_with text[]`; `schema.sql` has
  the first commented out and omits the second, which `query.ts:99` selects. A fresh bootstrap yields a
  broken app.
- **The `Anthropic vercel-cluster` 1Password item is gone**, so the documented `op inject` bootstrap fails.
  Does not block deploy — the gateway key covers the path — but it blocks local setup.
- **Two unbounded fan-outs** that Workers makes consequential: `observe/sessions/+server.ts:13` iterates
  every active session, and `catalog.ts:223` issues one query per cart line item from client-controlled,
  uncapped input. Workers caps subrequests at 1000 per invocation with 6 simultaneous connections.
- **`@phosphor-icons/react` is a dependency and is imported nowhere** in this Svelte project.
- **`app.html:5` references a favicon that does not exist.** 404s today on Vercel too.

---

## How this was verified

Three parallel investigations, all read-only. Live systems were touched: the Neon database
(`information_schema` introspection only, no writes or DDL), the BigCommerce Management and Storefront
APIs (reads only), the Cloudflare API (inventory listing only, nothing created or deleted), and 1Password
(item titles and field labels only — no secret values were printed). The `worktree-spike-cloudflare-portkey`
branch was fetched from origin and read directly rather than taken from a summary.

Each appendix separates what was verified from what was inferred. Effort estimates are judgement.
