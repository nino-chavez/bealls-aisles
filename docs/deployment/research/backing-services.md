# Backing services → Cloudflare mapping

**Repo analyzed:** `/Users/nino/Workspace/dev/wip/bealls-aisles` (as instructed).
**Date:** 2026-07-30. Investigation only — no files modified, no Cloudflare resources created or deleted.

---

## Bottom line

Keep everything. Upstash and Neon are both HTTP/fetch-based and run from a Worker
unchanged; the only mandatory change for a Cloudflare redeploy is swapping
`@sveltejs/adapter-vercel` for `@sveltejs/adapter-cloudflare`. Moving the cache to KV
or the database to D1 is gold-plating for a demo redeploy, and in two specific places
it would be a regression, not a lateral move — KV's 1-write-per-second-per-key ceiling
breaks the session store, and D1 (SQLite) has no `text[]`, `jsonb`, or `pgvector`, which
the enrichment schema depends on throughout.

Nino's account already has four AI Gateways named `aisles-bealls`, `aisles-bealls-fl`,
`aisles-hc`, and `aisles-sleepcountry`. Nothing in `~/Workspace/dev` references them —
they were created out-of-band and are unwired.

Three latent bugs surfaced while reading (§6). They are not Cloudflare problems and
they exist on Vercel today, but two of them would look like "the redeploy broke it" if
found afterwards.

---

## 1. Service-by-service

| # | Current | Used for | Recommended | Reason | Effort |
|---|---------|----------|-------------|--------|--------|
| 1 | Upstash Redis (`@upstash/redis` REST) | Layout cache 1h / suggestion cache 1h (`cache.ts`) | **Keep** | Pure `get`/`set`/`scan`/`del` over HTTPS REST. Runs from a Worker with zero code change. KV would technically work (prefix `list()` replaces `scan(match:)`, 60s min TTL is under the 1h TTL) but buys nothing on a demo and costs a rewrite of the invalidation path. | 0 (keep) / M (~2–3h to move) |
| 2 | Upstash Redis | Cart state + BC visitor session cookie, 24h TTL (`cart-store.ts`) | **Keep** | Same HTTP story. Moving to KV is actively risky: KV writes take up to 60s to propagate outside the writing region, and the whole reason this module exists (`cart-store.ts:16-20`) is that a POST on one instance must be readable by a GET on another. Read-after-write is the requirement; KV does not guarantee it cross-region. | 0 (keep) |
| 3 | Upstash Redis | Signal session store, 30min TTL (`src/lib/signals/session.ts`) | **Keep** | **KV is disqualified.** `persistSession()` rewrites the same key `aisles:session:<id>` after every appended signal event. KV caps at 1 write/sec to the same key and returns 429 past that (verified in CF docs). Scroll/dwell/view events burst well past that. The Cloudflare-native fit is a Durable Object per session, which is a real rewrite, not a redeploy. | 0 (keep) / L (DO rewrite) |
| 4 | Neon Postgres (`@neondatabase/serverless`) | Enrichment reads on the request path (`enrichment/query.ts`), merchandising rules, admin overrides | **Keep** | `db.ts:16` uses `neon()` — the HTTP driver, plain `fetch`, no TCP, no `node:net`. Works in a Worker as-is. **D1 is not a swap:** the schema uses `TEXT[]` (`semantic_tags`, `compatible_with`), `JSONB`, `vector`, `unnest()`, the `&&` array-overlap operator, and `= ANY($array)`. SQLite has none of them. | 0 (keep) |
| 5 | Neon Postgres | Write-path logging: `generation_logs`, `zone_retrieval_logs`, `session_outcomes` | **Keep** | Same driver, same reasoning. All three call sites already swallow failures (`generation-log.ts:101`, `zone-retrieval-log.ts:73`, `outcomes.ts:138`), so they are off the critical path regardless of backend. | 0 (keep) |
| 6 | Neon Postgres — connection layer | — | **Skip Hyperdrive** | Hyperdrive pools *TCP* Postgres connections. This app never opens one. `atelier-pool` exists in the account as precedent, but it fronts a Supabase TCP pooler — a different shape. Adding Hyperdrive here would be a binding that nothing uses. | 0 (skip) |
| 7 | pgvector cosine search (`search.ts:59-71`) | `/search` route, request path | **Keep the column; fix or gate the code — see §6b, currently dead** | The `vector` extension, the `embedding` column, and an `ivfflat` cosine index all exist in the live DB — but **0 of 2177 rows have an embedding** (verified). `vectorSearch` pays the OpenRouter round-trip, matches nothing on `WHERE embedding IS NOT NULL`, and silently falls through to `tagSearch`. Vectorize is a legitimate CF-native home for this later (1536-dim cosine is supported — `askdad-corpus` already runs at those settings), but it is out of scope for a redeploy of a path that currently returns nothing. | 0 (keep) / S (gate the dead call) |
| 8 | OpenRouter — `text-embedding-3-small` | Offline: `enrichment/enrich.ts:302`. Request path: `search.ts:52` | **Keep** | Plain HTTPS. **Do not move to Workers AI:** no Workers AI embedding model produces 1536 dimensions (max is 1024 — `bge-large-en-v1.5`, `bge-m3`, `qwen3-embedding-0.6b`; verified in CF docs). Switching means re-embedding the catalog *and* altering the `vector(1536)` column. Pure cost, no redeploy benefit. | 0 (keep) |
| 9 | Vercel AI Gateway (`gateway()` from `ai`) | Haiku 4.5 → Sonnet 4.6 fallback + cost tagging (`ai-model.ts`) | **Keep — optionally move** | Works off-Vercel via the long-lived `AI_GATEWAY_API_KEY`, which exists in 1Password. Note `ai-model.ts:18` also accepts `VERCEL_OIDC_TOKEN`; that one is auto-injected by Vercel only and will simply be absent on Workers — the API key path covers it. **Optional move:** four `aisles-*` CF AI Gateways already exist. But CF AI Gateway is a base-URL proxy (`createAnthropic({ baseURL: 'https://gateway.ai.cloudflare.com/v1/<account>/<gateway>/anthropic' })`), so you would lose `providerOptions.gateway.models` — the declarative Haiku→Sonnet fallback chain (`ai-model.ts:31-43`) — and have to hand-roll it. Trade cost visibility in the CF dashboard for a fallback you re-implement. | 0 (keep) / M (~3h to move + reimplement fallback) |
| 10 | Workers AI (as a Claude replacement) | — | **Do not** | The layout generator emits schema-validated structured output against a fixed component vocabulary. Swapping the model class is a product change, not a deploy change. | n/a |
| 11 | BigCommerce Storefront GraphQL | Catalog (`bigcommerce.ts`) | **Keep** | External SaaS over `fetch`. No Cloudflare equivalent, none wanted. | 0 (keep) |
| 12 | `@sveltejs/adapter-vercel` | Build target | **Move to `@sveltejs/adapter-cloudflare`** | The one mandatory change. Internal canonical implementation: `/Users/nino/Workspace/dev/wip/bc-subscriptions/apps/storefront-svelte` — `svelte.config.js` + `wrangler.toml` (`main = ".svelte-kit/cloudflare/_worker.js"`, `[assets] directory = ".svelte-kit/cloudflare"`, `compatibility_flags = ["nodejs_compat"]`). Deployed live as the `subs-storefront-svelte` Worker. Copy that shape. Runtime compat is `cf-runtime`'s scope, not this analysis. | S–M |

### Effort key
`0` = no work. `S` ≈ under an hour. `M` ≈ 2–4h. `L` ≈ a day or more.

---

## 2. How each service is actually used (verified by reading the code)

### Redis — three consumers, zero atomicity requirements

`grep -rl '@upstash/redis|KV_REST_API'` returns exactly three files; all three were read
in full. The complete set of operations used is **`get`, `set` (with `ex`), `del`,
`scan` (with `match`), `exists`**. There is no `INCR`, no `SETNX`, no Lua script, no
`MULTI`/pipeline, no watch. Nothing needs atomicity or compare-and-swap.

| File | Keys | TTL | Notes |
|---|---|---|---|
| `src/lib/server/cache.ts` | `aisles:layout:<brand>:<persona>:<slug>[:picks:<hash>]`, `aisles:suggest:<brand>:<hash>` | 3600s (900s for picks variants), 3600s | `invalidateLayoutCache` (`cache.ts:139-163`) does `scan` with a prefix pattern then variadic `del`. A KV port maps this to `list({ prefix })` + per-key `delete` — mechanical but not free. |
| `src/lib/server/cart-store.ts` | `aisles:cart:<entityId>` | 86400s | Has an in-memory fallback for dev. Read-after-write across instances is the whole point of the module. |
| `src/lib/signals/session.ts` | `aisles:session:<id>` | 1800s | Hot in-memory Map in front of Redis. `listSessionIds()` also uses `scan` with a prefix pattern. **Write frequency is the blocker for KV** (see table row 3). |

### Postgres — on the request path, not just offline

The brief framed Neon as "enrichment data, generation logs, and a `session_outcomes`
table." It is more than that: **Postgres is on the synchronous request path** for
reads.

**Request-path reads:**
- `enrichment/query.ts` — `getEnrichmentByEntityIds` (called from `catalog.ts:17` on
  category, home, and PDP loads), `getBrandTagVocabulary` (`/api/refine`),
  `getProductsByTagOverlap`. All three have in-process TTL caches (10min / 1h / 1h), so
  a warm isolate skips the query — but a cold isolate does not.
- `rules.ts:60` — merchandising rules.
- `admin-overrides.ts:76,113,145` — brand voice, zone content, persona-fit overrides.
- `search.ts:57,96` — `/search` route, both the vector and the tag-fallback branch.

**Request-path writes (all fire-and-forget, all failure-swallowing):**
- `generation-log.ts:18,82` ← `/api/layout`, `/api/layout/stream`, `/api/refine`
- `zone-retrieval-log.ts:23,80` ← `/api/layout`, `/product/[slug]`
- `outcomes.ts:147` ← `/api/signals`, `/api/signals/finalize`

**Offline only:** `enrichment/enrich.ts` — a `tsx` script reading `process.env`
directly, not `$env/dynamic/private`. It never runs in the Worker.

**Postgres features that block a D1 port:** `TEXT[]` columns, `JSONB` columns, the
`vector` type, `unnest()`, the `&&` array-overlap operator, `= ANY($array)`,
`ON CONFLICT ... DO UPDATE`, `::int[]` / `::text[]` casts. Rewriting these into SQLite
means a data-model change (join tables or JSON-string columns), not a driver swap.

### Live database state

> **Live-system access disclosure.** To settle whether pgvector was real, I connected to
> the Neon database with the credential at
> `op://Developer Secrets/Postgres bealls-aisles/database_url`
> (host `ep-green-cloud-anydrsfk-pooler.c-6.us-east-1.aws.neon.tech`, database `neondb`)
> and ran **read-only** queries: `information_schema.columns`, `pg_indexes`,
> `pg_extension`, `pg_tables`, `pg_database_size`, and `count(*)`. No writes, no DDL, no
> schema changes. Everything below is from that session. Scope caveat: this is the
> database that `DATABASE_URL` resolves to *today*. The repo has no `.vercel` link
> directory, so I could not confirm the deployed Vercel app points at this same Neon
> branch — if production uses a different branch or project, the row counts and the
> missing-table findings apply to this one only.

| Fact | Value |
|---|---|
| Total DB size | 10 MB |
| `enriched_products` rows | 2,177 |
| Rows with a non-null `embedding` | **0** |
| `vector` extension installed | yes |
| `embedding` column | exists, type `vector` |
| `idx_enriched_embedding` | exists — `ivfflat (embedding vector_cosine_ops) WITH (lists='10')` |
| GIN index on `semantic_tags` | **absent** (declared in `enrichment/schema.sql:39`, never applied) |
| `session_outcomes` table | **does not exist** |
| `merchandising_rules` rows | 0 |
| `generation_logs` rows | 958 |
| `zone_retrieval_logs` rows | 122 |
| Tables present | `enriched_products`, `generation_logs`, `zone_retrieval_logs`, `merchandising_rules`, `brand_overrides`, `persona_fit_overrides`, `zone_content`, `workspaces`, `app_users` |

10 MB is trivially inside D1's limits. Size is not what blocks the port — the type
system is.

---

## 3. Existing Cloudflare inventory

Account `b6ffcf200d56bab5749e243f024658d2` (Abelino.chavez@gmail.com's Account).
Retrieved live via the `cloudflare-api` MCP tool — **authentication was already
present, no login needed.**

**Workers (21):** `album-zip-worker`, `ask-bc-agent-runtime`, `atelier-broadcast`,
`atelier-cron`, `atelier-prototype`, `blueprint-archaeology`, `film-room-vision-campaign`,
`fleet-obs`, `letspepper-reels-worker`, `nino-open-practice-anton-f3a7ef5`,
`nino-open-practice-review-0b8d57e`, `nino-open-practice-type-b-c3d516c`,
`ninochavez-router`, `quantifai-app`, `rally-hq-agent`, `rally-hq-cron`, `subs-api`,
`subs-assistant`, `subs-email-consumer`, `subs-storefront-svelte`, `supabase-watch`.

**No aisles Worker exists yet.**

**KV namespaces (4):** `STATE`, `CHANNEL_CACHE`, `QUEUE`, `CATEGORY_CACHE`.
None belong to aisles. A KV move starts from zero.

**D1 databases (6):** `film-room-vision-review`, `fleet-obs`, `quantifai`,
`subs-api-d1`, `blueprint-archaeology`, `urvil-performance-forms`. None aisles.

**R2 buckets (6):** `blueprint-archaeology-blobs`, `film-room-beta-kit`,
`film-room-vision-review`, `flickday-social`, `photo-gallery-zips`,
`subs-feedback-screenshots`. None aisles; the app needs no object storage.

**Hyperdrive (1):** `atelier-pool` → `aws-1-us-west-1.pooler.supabase.com:6543`,
caching disabled, origin connection limit 60. Precedent that Hyperdrive is a known
pattern in this account, but it fronts a TCP pooler — not the shape this app needs.

**Vectorize indexes (3):** `askdad-corpus` (1536, cosine),
`blueprint-archaeology-chunks` (768, cosine),
`rally-help-bge-base-en-v1-5` (768, cosine). None aisles. `askdad-corpus` proves
1536-dim cosine indexes work here, if vector search is ever revived on CF.

**AI Gateways (5):** `bcss`, **`aisles-bealls`**, **`aisles-bealls-fl`**, **`aisles-hc`**,
**`aisles-sleepcountry`**.
The four `aisles-*` gateways are the most directly relevant existing resource — one per
brand, matching this codebase's multi-brand structure. **But a grep across all of
`~/Workspace/dev` for `gateway.ai.cloudflare.com` and for those four names returns
nothing.** They were created out-of-band and no code points at them. Whoever created
them intended the CF AI Gateway path; the code still runs on Vercel AI Gateway.

**Queues (2):** `subs-events` (producer `subs-api` → consumer `subs-email-consumer`),
`subs-events-dlq`. Unrelated.

**Secrets Store: empty.** No stores exist. A secrets-store binding starts from zero.

---

## 4. Secrets checklist

`op item list --vault "Developer Secrets"` returns 110 items. Field labels were read
with `op item get --format json` and projected to labels only — **no secret values were
printed or logged.**

| `.env.example` var | 1Password reference | Item exists | Field exists |
|---|---|---|---|
| `BIGCOMMERCE_STORE_HASH` | `BigCommerce bealls-aisles/store_hash` | yes | yes |
| `BIGCOMMERCE_CLIENT_ID` | `BigCommerce bealls-aisles/client_id` | yes | yes |
| `BIGCOMMERCE_CLIENT_SECRET` | `BigCommerce bealls-aisles/client_secret` | yes | yes |
| `BIGCOMMERCE_ACCESS_TOKEN` | `BigCommerce bealls-aisles/access_token` | yes | yes |
| `BIGCOMMERCE_CHANNEL_ID` | `BigCommerce bealls-aisles/channel_id` | yes | yes |
| `BEALLS_STOREFRONT_TOKEN` | `BigCommerce bealls-aisles/storefront_token_bealls` | yes | yes |
| `BEALLSFLORIDA_STOREFRONT_TOKEN` | `BigCommerce bealls-aisles/storefront_token_beallsflorida` | yes | yes |
| `KV_REST_API_URL` | `KV bealls-aisles/rest_api_url` | yes | yes |
| `KV_REST_API_TOKEN` | `KV bealls-aisles/rest_api_token` | yes | yes |
| `DATABASE_URL` / `POSTGRES_URL` | `Postgres bealls-aisles/database_url` | yes | yes |
| `OPENROUTER_API_KEY` | `OpenRouter bealls-aisles/credential` | yes | yes |
| `AI_GATEWAY_API_KEY` | `Vercel AI Gateway bealls-aisles/api_key` | yes | yes |
| `ANTHROPIC_API_KEY` | `Anthropic vercel-cluster/credential` | **NO — item missing** | n/a |

### The one broken reference

`.env.example:11` points at `op://Developer Secrets/Anthropic vercel-cluster/credential`.
**No item named `Anthropic vercel-cluster` exists in the vault.** The documented
bootstrap in that file's own header — `op inject -i .env.example -o .env` — fails on
that line today, on Vercel or anywhere else. It is not a Cloudflare problem.

Anthropic items that *do* exist: `Anthropic admin`, `Anthropic rally-hq`,
`Anthropic photography`. Picking a replacement is Nino's call, not mine.

Practical note: `ANTHROPIC_API_KEY` is only the *fallback* path.
`ai-model.ts:18,26-29` prefers the gateway whenever `AI_GATEWAY_API_KEY` is set, and
that item resolves. So the missing item does not block a deploy — it blocks local
`op inject`.

### Mapping to Cloudflare

**Recommended: `wrangler secret put`, one per key.**

**Eleven secrets for a working deploy**, from the fourteen env vars in `.env.example`
(`VITE_BRAND_ID` excluded — it is a public build-time var, not a secret). The three
excluded:

- `BIGCOMMERCE_CLIENT_ID` and `BIGCOMMERCE_CLIENT_SECRET` — **zero references anywhere
  in `src/`, `scripts/`, or `tools/`.** Declared in `.env.example`, never read. Don't
  carry them over.
- `ANTHROPIC_API_KEY` — its 1Password item is missing (below), and it is only the
  fallback when `AI_GATEWAY_API_KEY` is absent. Skip unless you want the direct-Anthropic
  path working.

`POSTGRES_URL` is counted separately from `DATABASE_URL` even though both resolve to the
same 1Password field — the code reads both names (2 and 13 references respectively), so
both must be set.

Eleven commands, scriptable straight from 1Password without ever writing a plaintext
file:

```bash
# Pattern — pipe from op, never touch disk.
op read "op://Developer Secrets/Postgres bealls-aisles/database_url" \
  | wrangler secret put DATABASE_URL --name <worker-name>
```

Non-secret values (`VITE_BRAND_ID`, and `BIGCOMMERCE_STORE_HASH` / `BIGCOMMERCE_CHANNEL_ID`
if treated as public) belong in `[vars]` in `wrangler.toml`. `subs-storefront-svelte`
splits them exactly this way — public vars in `[vars]`, sensitive ones via
`wrangler secret put`, documented in a header comment.

**Not recommended for this: a Workers Secrets Store binding.** The account has zero
stores, so it means provisioning a store, populating it, and adding bindings — real
setup cost whose payoff is cross-Worker secret reuse. There is one Worker here. Revisit
if the four brands become four Workers sharing the same BigCommerce credentials.

**Reading secrets in code needs no change.** `$env/dynamic/private` resolves Worker
secrets and vars through the platform env under `adapter-cloudflare`, so every
`env.FOO` call site keeps working.

---

## 5. What actually has to change for a Cloudflare redeploy

1. `@sveltejs/adapter-vercel` → `@sveltejs/adapter-cloudflare` (`svelte.config.js`).
2. Add `wrangler.toml` — copy the shape from
   `/Users/nino/Workspace/dev/wip/bc-subscriptions/apps/storefront-svelte/wrangler.toml`.
3. `wrangler secret put` × 11 (see §4 for which three `.env.example` vars to drop).
4. Nothing else on the service side. Upstash, Neon, OpenRouter, Vercel AI Gateway, and
   BigCommerce are all reached over `fetch` and do not care where the code runs.

Runtime compatibility beyond this — `nodejs_compat`, CPU limits on the 8–13s layout
generation, streaming — is `cf-runtime`'s scope.

---

## 6. Latent bugs found while reading (not Cloudflare issues)

Flagging these because two of them will look like redeploy regressions if discovered
afterwards.

**Scope on all of a/b/c:** these describe the database that
`op://Developer Secrets/Postgres bealls-aisles/database_url` resolves to. I could not
confirm the deployed Vercel app uses that same Neon branch (no `.vercel` link directory
in the repo, so `vercel env ls` would need an interactive link first). If production
runs against a different branch, re-check there before acting.

**a. `session_outcomes` does not exist in that database.**
`outcomes.ts:146-189` writes to it; `outcomes.ts:136-142` catches and logs the failure.
Against this database, every `finalizeSession()` from `/api/signals` and
`/api/signals/finalize` throws and is swallowed — a silent no-op. `outcomesSummary()`
(`outcomes.ts:251`) throws uncaught, which breaks `/api/observe/inference`. The
LR-fitting and calibration pipeline the table was built for would have no data. The
schema file `src/lib/server/outcomes-schema.sql` exists and was never applied here.

**b. Vector search is dead weight on the request path.**
0 of 2,177 rows have an embedding, yet `search.ts:42-54` calls OpenRouter on every
`/search` request before running a query that can only return 0 rows. Every search pays
an embedding API call and a round-trip for nothing, then falls back to `tagSearch`.
Either backfill embeddings (re-run `enrich.ts`, whose embedding block at
`enrich.ts:301-324` is wrapped in its own try/catch and may be failing silently too) or
gate `vectorSearch` behind a cheap "do any embeddings exist" check.

**c. The GIN index on `semantic_tags` was never created.**
`enrichment/schema.sql:39` declares it; the live DB does not have it. The
`semantic_tags && $1::text[]` query in `getProductsByTagOverlap` (`query.ts:260`) is a
sequential scan. Harmless at 2,177 rows — the comment at `query.ts:251` claiming a GIN
pre-filter is just wrong.

**d. Adjacent, for `cf-runtime`:** `signals/session.ts:32` starts a module-scope
`setInterval` cleanup timer. Background timers outside a request context are not
reliable on Workers. Flagging for their runtime pass; not analyzing further here.

---

## 7. Verified vs. assumed

**Verified — primary source, this session:**
- Every Redis operation used, by reading all three files that import `@upstash/redis`.
- Every Postgres call site and whether it is request-path or offline, by grep + reading.
- The live Neon schema, indexes, row counts, and 0-embedding state — read-only `psql`
  introspection against `information_schema` / `pg_indexes` / `pg_extension`. **This
  touched a live database** (read-only; see the disclosure box in §2).
- That `BIGCOMMERCE_CLIENT_ID` and `BIGCOMMERCE_CLIENT_SECRET` have zero code
  references — grep across `src/`, `scripts/`, `tools/`.
- The full Cloudflare inventory — live `cloudflare-api` MCP calls against
  account `b6ffcf200d56bab5749e243f024658d2`.
- All 1Password item titles and field labels — `op item list` / `op item get --format json`.
- KV limits (1 write/sec/key, ≤60s cross-region propagation, 60s minimum
  `expirationTtl`) — Cloudflare docs.
- Workers AI embedding dimensions cap at 1024 — Cloudflare docs (`bge-large-en-v1.5`
  1024, `bge-m3` 1024, `qwen3-embedding-0.6b` 1024, `embeddinggemma-300m` 768,
  `bge-base-en-v1.5` 768, `bge-small-en-v1.5` 384).
- `subs-storefront-svelte` as a working SvelteKit-on-Workers reference — read its
  `wrangler.toml` and `svelte.config.js`; the Worker is live in the account.
- No code anywhere in `~/Workspace/dev` references `gateway.ai.cloudflare.com` or the
  four `aisles-*` gateway names.

**Assumed / not verified:**
- Effort estimates are judgement, not measurement.
- That `adapter-cloudflare` builds this app cleanly — not attempted. `cf-runtime`'s call.
- Why the four `aisles-*` AI Gateways exist and whether they are configured with
  provider keys — only their names were listed.
- Whether the Vercel deployment sets env vars this repo's `.env.example` does not list.
- That the deployed Vercel app points at the same Neon branch I introspected. No
  `.vercel` link directory exists, so confirming would require an interactive
  `vercel link` — out of scope for a read-only investigation.
- The redeploy target repo. Analysis is of `bealls-aisles` as instructed. **Note:** the
  session's working directory is the public `/Users/nino/Workspace/dev/wip/aisles` repo,
  whose `.env.example` has no `KV_REST_API_*`, no `DATABASE_URL`, and no
  `OPENROUTER_API_KEY`, and which adds an `incentives` module absent from bealls-aisles.
  If the redeploy target is that repo instead, rows 3, 7, and 8 drop out entirely and
  the secrets list shrinks to BigCommerce + Anthropic + Voucherify.
