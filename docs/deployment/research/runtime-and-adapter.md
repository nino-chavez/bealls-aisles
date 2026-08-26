# Vercel → Cloudflare Workers migration plan — `bealls-aisles`

Investigation only. No files in `/Users/nino/Workspace/dev/wip/bealls-aisles` were modified.

Date: 2026-07-30. Target repo HEAD: `1f47266` ("Initial public release"), branch `main`, clean.

---

## Bottom line

The app is **not** blocked by the Workers runtime itself. There are zero `node:*`/`fs`/`path` imports, every
dependency is fetch-based, there is no `hooks.server.ts`, no prerendered routes, no `static/` directory,
no local images, and no SvelteKit load-function streaming. The SSE endpoint is fine — Workers has **no
wall-clock limit** on HTTP requests.

Three things actually break, in this order:

1. **Fire-and-forget work is silently dropped.** Ten `.catch(() => {})` promises are launched and never
   awaited or handed to `waitUntil`. On a warm Vercel lambda they complete. On Workers they are cancelled
   when the response finishes. Two of them are `cacheLayout(...)` — so the Redis layout cache never gets
   written, and *every* request pays the full 8–13 s LLM generation and its token cost, forever.
2. **The multi-brand story does not survive as-is.** `getBrand()` is imported by five client-side Svelte
   components, so the brand is baked into the browser bundle at build time by Vite. One Worker serving three
   brands is impossible without a code change. Three Workers is a config change and works today.
3. **Vercel-injected environment variables disappear.** `VERCEL_OIDC_TOKEN` (AI Gateway auth), and the
   Neon/Upstash integration vars, are all Vercel platform features. `/api/refine` calls `gateway(...)`
   unconditionally with no fallback, so it hard-fails until `AI_GATEWAY_API_KEY` is set explicitly.

Everything else is a paper cut or a parity item — with one exception worth reading before anyone touches
caching headers later: the adapter edge-caches any response that carries `Cache-Control`, which on a
persona-personalized page would leak one visitor's layout to the next. It cannot fire today (there is no
`setHeaders` call in the codebase), but it is Workers-only behaviour with no Vercel analogue. See P2-3.

---

## Ranked blockers

Severity key: **P0** breaks or badly degrades production · **P1** costs money or observability ·
**P2** worth fixing, not gating.

---

### P0-1 — Fire-and-forget promises are cancelled after the response

**Confidence: high.** Verified in code (exact lines below) and against Cloudflare's own guidance:
"Always `await` or `waitUntil` your Promises — floating promises cause silent bugs and dropped work"
(`developers.cloudflare.com/workers/best-practices/workers-best-practices/`). The platform limits page
states tasks associated with a request "may be canceled" once the response completes, and that
`ctx.waitUntil()` is the mechanism to extend execution (up to 30 s past the response).

Sites, with what is lost:

| File:line | Call | Impact if dropped |
|---|---|---|
| `src/routes/api/layout/+server.ts:219` | `cacheLayout(...)` | **Layout cache never written.** Permanent cache miss. Fired immediately before `return json(...)` at `:240`. |
| `src/routes/api/layout/stream/+server.ts:140` | `cacheLayout(...)` | Same, inside `ReadableStream.start()`; races `controller.close()` at `:164`. |
| `src/routes/api/suggest/+server.ts:144` | `cacheSuggestions(...)` | Suggest cache never written; every PDP re-pays 2–4 s. |
| `src/routes/api/layout/+server.ts:121` | `logGeneration(...)` (cache-hit path) | Observe dashboard loses rows. |
| `src/routes/api/layout/+server.ts:238` | `logGeneration(...)` | Same. |
| `src/routes/api/layout/stream/+server.ts:91` | `logGeneration(...)` | Same. |
| `src/routes/api/layout/stream/+server.ts:154` | `logGeneration(...)` | Same. |
| `src/routes/api/refine/+server.ts:140` | `logGeneration(...)` | Same. |
| `src/routes/api/layout/+server.ts:166` | `logZoneRetrieval(...)` | Zone-retrieval audit trail lost. |
| `src/routes/product/[slug]/+page.server.ts:119` | `logZoneRetrieval(...)` | Same. |
| `src/lib/server/zone-retrieval-log.ts:72` | `void persistZoneRetrieval(...)` | The `void` inside the logger itself — a second layer of the same problem. |

The `cacheLayout` ones are the expensive pair. `src/lib/server/cache.ts:5` documents the intent:
"First visitor generates (8-13s), subsequent visitors get sub-100ms." On Workers, without `waitUntil`,
*every* visitor is the first visitor.

The stream-endpoint case at `:140` is a race rather than a certainty — the fetch handler has already
returned, and the invocation stays alive only while the `ReadableStream` is being consumed. `cacheLayout`
fires, then three more `controller.enqueue` calls and `controller.close()` run. Whether the Upstash HTTP
PUT lands before the runtime tears the invocation down is timing-dependent, which is worse than a clean
failure.

**Fix — recommended (explicit, no ALS dependency).** Capture the execution context at handler entry and
wrap. `platform` is already available on every SvelteKit handler under `adapter-cloudflare`; verified in
the adapter's generated worker (`node_modules/@sveltejs/adapter-cloudflare/files/worker.js:100-110`), which
passes `{ env, ctx, context: ctx, caches, cf }`. `ctx` is current; `context` is the deprecated alias.

```ts
// src/lib/server/bg.ts (new file)
/** Hand background work to the platform so it survives the response. */
export function bg(
  platform: App.Platform | undefined,
  p: Promise<unknown>,
): void {
  const settled = p.catch(() => {});
  platform?.ctx?.waitUntil(settled) ?? void settled;
}
```

Then at each site, add `platform` to the destructured handler args and wrap:

```ts
// src/routes/api/layout/+server.ts:45
export const POST: RequestHandler = async ({ request, cookies, url, platform }) => {
  // …
  // :219
  if (layout) bg(platform, cacheLayout(brandId, persona, cacheSlug, layout, ph));
```

For the stream endpoint, capture `platform` in the handler closure before constructing the
`ReadableStream` — `start()` runs later and must not rely on any implicit context.

**One caveat on that snippet: `src/app.d.ts` does not exist in this repo** (verified — `src/` contains only
`app.css`, `app.html`, `lib/`, `routes/`). `adapter-cloudflare` ships an `ambient.d.ts` and the SvelteKit
docs say type declarations are "automatically applied" when you use the adapter directly, so `App.Platform`
should resolve without one. I did not verify this, because `node_modules` is not installed in the target
repo. Run `npm run check` as part of step 1 of the sequence below; if `App.Platform` is unresolved, add a
minimal `src/app.d.ts`.

**Alternative, smaller diff, one caveat.** SvelteKit ≥ 2.20 exposes `getRequestEvent()` from `$app/server`
(installed range is `^2.21.0`, so it is available). That lets `cacheLayout`, `cacheSuggestions`,
`logGeneration` and `logZoneRetrieval` self-wrap internally with no call-site changes. It depends on
`AsyncLocalStorage`, which `nodejs_compat` provides. **Do not use it inside
`api/layout/stream/+server.ts`'s `ReadableStream.start()`** — I did not verify that ALS context propagates
into a stream callback that runs after the handler returned, and I would expect it not to. Use the explicit
form there regardless.

---

### P0-2 — `/api/refine` has no non-gateway path, and `VERCEL_OIDC_TOKEN` does not exist on Cloudflare

**Confidence: high** for the code facts; **high** for the AI SDK credential behaviour (confirmed via
Context7 against `vercel/ai` `packages/gateway/src/gateway-provider.ts`: the API key "defaults to
`AI_GATEWAY_API_KEY` environment variable").

- `src/lib/server/ai-model.ts:18` — `export const useGateway = !!env.AI_GATEWAY_API_KEY || !!env.VERCEL_OIDC_TOKEN;`
  The `VERCEL_OIDC_TOKEN` half is dead on Cloudflare. Harmless (it's an `||`), but it means the
  documented local-dev escape hatch in the comment at `:15-17` no longer applies.
- `src/routes/api/refine/+server.ts:113` — `model: gateway('anthropic/claude-haiku-4.5')`. Unlike
  `/api/layout`, this does **not** go through `layoutModel()`, so it has no direct-Anthropic fallback.
  Without `AI_GATEWAY_API_KEY` set as a Worker secret, refinement chat 500s.

The AI SDK resolves that key from `process.env`, not from `$env/dynamic/private`. That works on Workers
**only** with `nodejs_compat` and a `compatibility_date` on or after `2025-04-01` — see P1-1.

**Fix:** set `AI_GATEWAY_API_KEY` as a Worker secret. Optionally route `/api/refine` through
`layoutModel()` for parity with `/api/layout`, but that is a code change beyond migration scope.

---

### P0-3 — Every Vercel-injected environment variable must be recreated by hand

**Confidence: high.** Derived from `.env.example` plus the eight `$env/dynamic/private` consumers.

`$env/dynamic/private` works correctly on Workers. Verified mechanically: the adapter's worker does
`import { env } from "cloudflare:workers"` and calls `server.init({ env })` at module scope
(`files/worker.js:4,45`), awaited at the top of `fetch` (`:73`) before any route module is lazily imported.
So module-scope reads like `src/lib/server/ai-model.ts:13`
(`createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })`) are populated by the time the module evaluates.
This was my main suspicion going in and it is **not** a problem.

What *is* a problem is that on Vercel several of these are injected by platform integrations. Full required
set, from `.env.example` and code:

| Variable | Consumer | Notes |
|---|---|---|
| `BIGCOMMERCE_STORE_HASH` | `src/lib/server/bigcommerce.ts:15` | secret |
| `BEALLS_STOREFRONT_TOKEN` / `BEALLSFLORIDA_STOREFRONT_TOKEN` / `<BRAND>_STOREFRONT_TOKEN` | `bigcommerce.ts:14-16` — dynamic key `${brand.id.toUpperCase()}_STOREFRONT_TOKEN` | secret, per brand |
| `BIGCOMMERCE_STOREFRONT_TOKEN` | `bigcommerce.ts:16` fallback | secret |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | `cache.ts:23-24`, `cart-store.ts:42-43`, `signals/session.ts:56-57` | **Vercel Upstash integration injects these. Cloudflare will not.** |
| `DATABASE_URL` | `db.ts:15`, and `process.env.DATABASE_URL` at `zone-retrieval-log.ts:78` | **Vercel Neon integration injects this. Cloudflare will not.** |
| `ANTHROPIC_API_KEY` | `ai-model.ts:13` | secret |
| `AI_GATEWAY_API_KEY` | AI SDK via `process.env` | **mandatory now** — see P0-2 |
| `AISLES_NO_CACHE` | `cache-flags.ts:32` | optional demo kill-switch |
| `BRAND_ID` | `brand/config.ts:381` via `process.env` | plain var, per Worker |
| `VITE_BRAND_ID` | `brand/config.ts:380`, build-time | **build env, not runtime** — see multi-brand section |

Note `cache-flags.ts:27` explicitly says "Vercel injects env vars before the request handler runs, so
module-load time would be too early on some deployment shapes." That reasoning still holds on Workers, and
the lazy read there is correct — leave it.

`bigcommerce.ts:16`'s dynamic index `env[tokenKey]` works fine: `$env/dynamic/private` is a plain object on
Workers.

---

### P1-1 — `compatibility_date` must be ≥ `2025-04-01` or `process.env` is empty

**Confidence: high.** Cloudflare docs, `workers/configuration/environment-variables/`: "When you enable
`nodejs_compat` and the `nodejs_compat_populate_process_env` compatibility flag (enabled by default for
compatibility dates on or after 2025-04-01), environment variables are available via the global
`process.env`… populated lazily the first time that `process` is accessed."

Three consumers depend on this:

- `src/lib/brand/config.ts:381` — `process.env?.BRAND_ID`
- `src/lib/server/zone-retrieval-log.ts:78` — `if (!process.env.DATABASE_URL) return;` — a silent early
  return, so this fails *closed* and just stops logging with no error.
- The AI SDK's gateway/Anthropic providers, internally.

**This is why the internal reference configs are not safe to copy verbatim.** Per the canonical-pattern-first
check, I looked at all five Cloudflare SvelteKit apps in `~/Workspace/dev/`:

| App | `compatibility_date` | `pages_build_output_dir` | adapter |
|---|---|---|---|
| `apps/rally-hq/wrangler.toml` | `2026-03-01` | yes | `^7.2.8` |
| `apps/photography/wrangler.toml` | `2024-03-20` | yes | `^7.2.8` |
| `apps/zerospecs/wrangler.toml` | `2024-05-01` | yes | `^7.2.8` |
| `apps/website-nc/wrangler.toml` | `2026-06-22` | yes | `^4.9.0` |
| `client/urvil-performance/wrangler.jsonc` | not read | — | present |

Two of the four have compatibility dates *before* 2025-04-01, so `process.env` is empty in those apps —
fine for them, fatal here. And **all four are Pages, not Workers** (`pages_build_output_dir` is the Pages
discriminator). There is no internal Workers-target SvelteKit reference to copy. This is a deliberate
divergence from the house pattern and should be called out as such.

---

### P1-2 — Workers Free plan is not viable; check the CPU budget on Paid

**Confidence: high** on the numbers (Cloudflare `workers/platform/limits/`), **medium** on whether this app
needs a raised limit.

- Wall clock for HTTP requests: **no limit.** "No hard limit while the client remains connected. A Worker
  that is still streaming a response body remains active." **The SSE endpoint is safe.** The 8–13 s
  generation, and the client's own 30 s abort at `src/routes/category/[slug]/+page.svelte:105`, are both
  well within this.
- CPU time: **Free = 10 ms per request. Paid = 30 s default, 5 min max via `limits.cpu_ms`.** Waiting on
  `fetch()` does not count.

10 ms will not cover Svelte 5 SSR plus Zod schema validation plus JSON serialisation. **Workers Paid is a
hard requirement**, not an optimisation.

On Paid, the one thing I would actually measure is `src/routes/api/layout/stream/+server.ts:128` —
`for await (const partial of stream.partialOutputStream)`. Each chunk re-parses the accumulated partial JSON
and re-validates against a Zod schema. That is real CPU, it scales super-linearly with output length, and it
is the only CPU-heavy loop in the app. I have no measurement, so I am **not** claiming it exceeds 30 s — I
expect it does not. Enable `observability` from day one and look at CPU time on that route before deciding
whether to raise `limits.cpu_ms`.

---

### P1-3 — Per-isolate DDL flags amortise worse, and interact with P0-1

**Confidence: medium-high.** The mechanism is certain; the magnitude depends on traffic distribution.

- `src/lib/server/generation-log.ts:14-47` — `let tableCreated = false` guards a **nine-statement** DDL
  block (`CREATE TABLE`, six `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, two `CREATE INDEX`). It runs once per
  isolate.
- `src/lib/server/zone-retrieval-log.ts:19` — same pattern.
- `src/lib/server/admin-overrides.ts:48-50` — `voiceTableMissing` / `zoneTableMissing` /
  `personaFitTableMissing`, same pattern.

Two compounding effects. The first is geographic, not lifecycle: Cloudflare runs the Worker at **300+
POPs**, where Vercel runs functions in a handful of regions. The same traffic is therefore spread across
far more isolates, each with its own copy of every module-scope flag and cache. That is a stronger and more
defensible claim than "Workers isolates are shorter-lived," which is arguable. And `ensureTable()` is only
ever reached from inside the
fire-and-forget `logGeneration(...)` calls listed in P0-1 — so if the promise is cancelled mid-DDL,
`tableCreated = true` at `:46` never executes and the next request starts over. **Fixing P0-1 largely fixes
this.** Beyond that, moving the DDL to a migration run out-of-band is the real answer, but that is a design
change, not a migration step.

---

### P2-1 — `signals/session.ts` cleanup timer effectively never fires

**Confidence: medium-high.**

`src/lib/signals/session.ts:32` registers `setInterval(..., 5 * 60 * 1000)` from inside `ensureCleanup()`,
called at `:114` and `:125` — i.e. in request scope, so it will not throw the "disallowed operation in
global scope" error. But a Workers isolate only runs timers while it has work; a five-minute interval on an
isolate that goes idle between requests will rarely, if ever, fire.

Consequence: the in-memory `sessions` Map at `:26` grows without eviction for the isolate's lifetime.
This is **not a correctness bug** — Redis at `:107-116` is the durable source of truth and `getSessionStore(id, { fresh: true })`
exists for callers that need to bypass the hot cache. It is a slow memory-growth risk against the 128 MB
isolate limit on a long-lived hot isolate. Low priority; note it and move on.

For the record, since the brief asked: **`src/lib/signals/emitter.ts:41`'s `setInterval` is client-side
only** — the module reads `window.location` at `:50-51` and is initialised from `+layout.svelte`. It never
runs on the Worker. Not a concern.

---

### P2-2 — `Connection: keep-alive` on the SSE response is inert

**Confidence: medium.** I did not find a Cloudflare doc that states explicitly whether `Connection` is
rejected or stripped on a Response.

`src/routes/api/layout/stream/+server.ts:183` sets `'Connection': 'keep-alive'`. `Connection` is a
hop-by-hop header; it is meaningless over HTTP/2 and HTTP/3, which is what Cloudflare serves. My expectation
is that it is silently ignored, not that it throws. It has no function on Vercel either. Harmless to leave;
harmless to delete. Flagged only because the brief asked about the SSE endpoint specifically — I found
nothing else wrong with it.

Two related things I *did* verify and that are fine:

- The adapter's `caches.default` wrapper (`files/worker.js:119-120`) will not try to cache the SSE
  response: the worktop helper at `:13-14` only caches `GET`, and this endpoint is `POST`. Even if it were
  `GET`, the `Cache-Control: no-cache` at `:182` fails the cacheability check at `:20-21`.
- Outbound `Origin` and `Cookie` headers work. `src/lib/server/bigcommerce.ts:56` hardcodes
  `Origin: 'http://localhost:5173'` and `:62` replays a BC visitor `Cookie` — both fine, per the Workers
  Request docs: "Compared to browsers, Cloudflare Workers imposes very few restrictions on what headers you
  are allowed to send… Workers has no special understanding of cookies, and treats the `Cookie` header like
  any other header."

---

### P2-3 — Latent: the adapter edge-caches any response carrying `Cache-Control`, and this app's pages are per-persona

**Confidence: high** on the mechanism (read from the adapter source); **verified safe today**.

The adapter's generated worker wraps every request in `caches.default`
(`node_modules/@sveltejs/adapter-cloudflare/files/worker.js:74-76` on read, `:119-120` on write). The write
path is guarded only by "response has a `Cache-Control` header and `status < 400`". The bundled worktop
helper at `:13-14` then does something worth knowing about: if the response also has `Set-Cookie`, it
appends `Cache-Control: private=Set-Cookie`, strips the cookie — **and caches the body anyway**.

Vercel has no equivalent wrapper. This is a Workers-only behaviour.

Why it matters here: SSR pages are personalized by inferred persona and set cookies while doing it —
`src/routes/+page.server.ts:44-45`, `src/routes/category/[slug]/+page.server.ts:67-69`,
`src/routes/search/+page.server.ts:65`. A cached GET page would be served to the next visitor with someone
else's persona-generated layout.

**Verified: this cannot fire today.** `grep -rn "setHeaders" src/` returns **zero** matches, and the only
`Cache-Control` set anywhere in `src/routes/` or `src/lib/server/` is
`src/routes/api/layout/stream/+server.ts:182` (`'no-cache'`, on a `POST`, excluded twice over — the helper
only caches `GET`, and `no-cache` fails the cacheability test at `files/worker.js:20-21`).

So this is a **trap for future work**, not a live bug. Record it: on this adapter, adding
`setHeaders({ 'cache-control': ... })` to any personalized page load is unsafe without a cache-key or
`Vary` strategy, and the failure mode is a cross-visitor content leak rather than an error. That is not
obvious from the SvelteKit docs and it is not how the same line behaves on Vercel.

---

### P2-4 — Subrequest caps have no Vercel equivalent; two `Promise.all` sites are unbounded

**Confidence: high** on the limits and the code shape; **medium** on whether real traffic reaches them.

Workers caps subrequests at **1000 per invocation** (Free: 50) and **6 simultaneous outgoing connections**.
Lambda has neither limit. Every Neon query, Upstash call, BigCommerce GraphQL request and LLM call is a
subrequest.

Two fan-outs are not bounded by a constant:

- `src/routes/api/observe/sessions/+server.ts:13` — `Promise.all` over every session ID returned by
  `listSessionIds()`, which is a Redis `SCAN` of `aisles:session:*` (`src/lib/signals/session.ts:170-197`)
  with **no limit**. One `getSessionStore` → one Redis GET per session. At a few hundred active sessions
  this endpoint starts queueing against the 6-connection cap; past 1000 it fails outright. The Observe
  dashboard polls it on an interval (`src/routes/observe/+page.svelte:99`).
- `src/lib/server/catalog.ts:223` — one Neon query per cart line item, in parallel. Seeded from
  `cartItemEntityIds`, which arrives from the client and is deduped but **never capped**
  (`src/routes/api/layout/+server.ts:73-75`). This one is on the hot cart-upsell path. Real carts are small,
  so this is theoretical in normal use — but it is client-controlled input with no upper bound, which is a
  pre-existing input-validation gap that Workers makes consequential rather than merely wasteful. The
  in-process `tagOverlapCache` (`src/lib/server/enrichment/query.ts:29`) absorbs repeats but not a cold
  isolate with distinct IDs.

The other three `Promise.all` sites are fixed-arity and fine: `src/routes/product/[slug]/+page.server.ts:35`
(2 elements) and `:164` (5 elements); `src/routes/observe/+page.svelte:109` is client-side.

Not a migration blocker. Cap both — a `LIMIT` on the session scan, a `.slice(0, N)` on the cart seeds.

---

### P2-5 — `Headers.getSetCookie()` availability

**Confidence: medium.** Cloudflare's Request docs mention a Workers-specific `getAll()` for `Set-Cookie`;
I did not find explicit confirmation of `getSetCookie()` in the docs I retrieved.

`src/lib/server/bigcommerce.ts:88-96` already feature-detects it and falls back to splitting
`headers.get('set-cookie')` on a lookahead regex. So this degrades rather than breaks. Worth one smoke test
of the add-to-cart flow after deploy, because the whole cart-session replay described in
`src/lib/server/cart-store.ts:11-20` hangs off this function returning the right value.

---

### P2-6 — Worker bundle size

**Confidence: low-medium.** Not measured — `node_modules` is not installed in the target repo, so I could
not run a trial build.

Limit is 3 MB gzipped (Free) / 10 MB gzipped (Paid) after minification. The server bundle pulls in `ai` v6,
`@ai-sdk/anthropic`, `@ai-sdk/gateway`, `@openrouter/ai-sdk-provider`, `zod` v4, `@neondatabase/serverless`,
`@upstash/redis`, plus six layout schema modules and forty-odd section components. Probably fine on Paid.
Check it on the first `wrangler deploy`; Wrangler reports the size.

Note `@phosphor-icons/react` is in `dependencies` but **is not imported anywhere in `src/`** (verified by
grep). Dead dependency in a Svelte project — it will not be bundled, but it should be removed.

---

## Non-issues — verified, so nobody re-investigates them

| Concern | Finding |
|---|---|
| `node:*` / `fs` / `path` | Zero occurrences in `src/`. Verified. |
| `hooks.server.ts` / `hooks.client.ts` | Do not exist. Nothing to port. |
| `$env/static/*` | Not used. Only `$env/dynamic/private`, in eight files. |
| SvelteKit load-function streaming (returned promises) | None. Every load function awaits fully. Verified across all nine `+*.server.ts` files. |
| `prerender` / `ssr` / `csr` / `export const config` page options | None anywhere in `src/routes/`. Fully dynamic SSR. |
| `src/lib/server/enrichment/enrich.ts` | Has module-scope `throw new Error` guards on bare `process.env` at `:19-31` — but it has **zero exports** and is imported by nothing. It is a standalone `tsx` script (`:7`). Not on any route's import graph, will not be bundled, cannot kill the Worker at init. Verified by grep. |
| `crypto.randomUUID()` at `signals/request.ts:37` and `signals/store.ts:49` | Web Crypto, available on Workers. Fine. |
| `Math.random()` for anything security-sensitive | None in `src/lib/server/` or `src/lib/signals/`. |
| `Buffer` / `__dirname` / `require()` / `eval` / `new Function` | Zero occurrences. |
| In-memory caches (`rules.ts:38`, `admin-overrides.ts:44-46`, `bigcommerce.ts:325`, `enrichment/query.ts:27-56`, `cart-store.ts:62`) | Read-through caches keyed by content, not request-scoped state. No cross-request leak — **correctness** parity holds. **Hit rate does not**: spread across 300+ POPs instead of a few regions, each cache is cold far more often. Expect more Neon/BC origin traffic than on Vercel. Not a blocker; budget for it. |
| `@neondatabase/serverless`, `@upstash/redis` | Both HTTP/fetch-based. Native Workers support. |

---

## Exact configuration changes

### `svelte.config.js`

Current:

```js
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter()
	}
};

export default config;
```

Replacement — a one-line import swap. No adapter options are needed:

```js
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter()
	}
};

export default config;
```

The `routes: { include, exclude }` option that `apps/photography` and `apps/website-nc` pass is
**Pages-only** — the SvelteKit docs say so explicitly, and it only affects `_routes.json` generation, which
the adapter skips on the Workers path (`node_modules/@sveltejs/adapter-cloudflare/index.js:154-176`, inside
`if (building_for_cloudflare_pages)`). Do not copy it.

`fallback` also does nothing useful here: it only matters for Pages, or when `assets.not_found_handling` is
set. Leave it default.

Package changes:

```
npm rm @sveltejs/adapter-vercel
npm i -D @sveltejs/adapter-cloudflare@^7.2.8 wrangler@^4
```

Pin to `^7.2.8` — that is the version installed and working in all four internal SvelteKit-on-Cloudflare
apps, and the version whose source I read to verify the behaviour claimed in this document.

### `wrangler.jsonc` (new file, repo root)

**Adapter targets Workers, not Pages, when `main` or `assets` is present and `pages_build_output_dir` is
absent.** Verified in `node_modules/@sveltejs/adapter-cloudflare/utils.js:7-17`
(`is_building_for_cloudflare_pages`). Note the first condition: `process.env.CF_PAGES` forces Pages mode
regardless. If this ends up wired to a Cloudflare **Pages** project by mistake, the adapter will silently
build for Pages and the `main`/`assets` keys will be ignored. Use Workers Builds or `wrangler deploy`.

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",

  // Top-level `main` and `assets` are shared by every brand environment.
  // They MUST live at the top level: the adapter calls
  // `unstable_readConfig({ config })` with no `env` argument
  // (node_modules/@sveltejs/adapter-cloudflare/index.js:287), so it only ever
  // sees the top-level config. Per-environment overrides of these two keys
  // would be invisible at build time.
  "main": ".svelte-kit/cloudflare/_worker.js",
  "assets": {
    "directory": ".svelte-kit/cloudflare",
    "binding": "ASSETS"
  },

  // >= 2025-04-01 is REQUIRED, not cosmetic: it is what makes `nodejs_compat`
  // auto-populate `process.env`, which brand/config.ts:381,
  // zone-retrieval-log.ts:78 and the AI SDK all depend on.
  "compatibility_date": "2026-07-30",
  "compatibility_flags": ["nodejs_compat"],

  // Inheritable — set once, every environment gets it. Turn this on before
  // the first deploy, not after the first incident: the CPU-time question on
  // /api/layout/stream is unresolvable without it.
  "observability": { "enabled": true },

  // Deliberately NOT "aisles-bealls". `name` is inheritable, so a bare
  // `wrangler deploy` with no --env targets this name. If that collided with
  // a real brand's Worker, running `wrangler deploy` right after a
  // homecentric build would silently overwrite the bealls deployment with
  // homecentric's client bundle. An inert name makes that mistake land
  // somewhere harmless. Never run `wrangler deploy` without --env here.
  "name": "aisles",

  // No top-level `vars`: BRAND_ID belongs to an environment, and leaving it
  // out means the inert top-level Worker falls back to brand/config.ts:383's
  // 'bealls' default rather than inheriting a stale value.

  "env": {
    "bealls": {
      "name": "aisles-bealls",
      "vars": { "BRAND_ID": "bealls" }
    },
    "beallsflorida": {
      "name": "aisles-beallsflorida",
      "vars": { "BRAND_ID": "beallsflorida" }
    },
    "homecentric": {
      "name": "aisles-homecentric",
      "vars": { "BRAND_ID": "homecentric" }
    }
  }
}
```

Notes on the shape above:

- **`nodejs_compat`, not `nodejs_als`.** The SvelteKit adapter docs show `nodejs_als` in the minimal Workers
  example, which covers `AsyncLocalStorage` only. That is not enough here — `process.env` population is
  gated on `nodejs_compat` specifically. `nodejs_compat` is a superset and also enables ALS. **Confidence:
  high** on the `process.env` gating (quoted doc above); **medium-high** on ALS being included in
  `nodejs_compat` — the docs frame `nodejs_als` as "enable *only* AsyncLocalStorage", which implies
  inclusion.
- **Do not add `nodejs_compat_populate_process_env` explicitly.** It is default-on for compat dates ≥
  2025-04-01. Adding it is redundant noise.
- **`main` and `assets.directory` overlap on purpose.** `_worker.js` sits inside the assets directory. The
  adapter writes a `.assetsignore` containing `_worker.js`, `_routes.json`, `_headers`, `_redirects` so they
  are not uploaded as public assets — verified at `index.js:176` and `index.js:269-277`. This is the
  documented pairing from the SvelteKit adapter docs, not a workaround.
- **`vars` is a non-inheritable key; `observability` is not.** Confirmed against
  `developers.cloudflare.com/workers/configuration/environment-variables/`: "As `vars` is a non-inheritable
  key, they are not inherited by environments and must be specified for each environment." `observability`,
  `placement`, `limits`, `name`, `compatibility_date` and `compatibility_flags` are all on the *inheritable*
  list, so they are set once at the top level. Note the additional rule Cloudflare documents: if **any**
  non-inheritable key is overridden in an environment, **all** of them must be. Right now `vars` is the only
  one in play; that changes the moment a KV/R2/D1/Queue binding is added, and it fails at deploy-time
  validation rather than locally.
- **`placement: { mode: "smart" }` — deliberately omitted.** Every request fans out to Neon, Upstash, the
  BigCommerce GraphQL API and the AI Gateway, all in different places. Smart placement optimises for a
  single dominant backend and there isn't one. Revisit with real latency data; don't cargo-cult it in.
- **`limits: { cpu_ms: … }` — deliberately omitted.** Default 30 s on Paid should be sufficient. Measure
  first (see P1-2).

Secrets are **not** in this file. Set them per environment:

```bash
for e in bealls beallsflorida homecentric; do
  wrangler secret put ANTHROPIC_API_KEY        --env "$e"
  wrangler secret put AI_GATEWAY_API_KEY       --env "$e"
  wrangler secret put DATABASE_URL             --env "$e"
  wrangler secret put KV_REST_API_URL          --env "$e"
  wrangler secret put KV_REST_API_TOKEN        --env "$e"
  wrangler secret put BIGCOMMERCE_STORE_HASH   --env "$e"
done
wrangler secret put BEALLS_STOREFRONT_TOKEN        --env bealls
wrangler secret put BEALLSFLORIDA_STOREFRONT_TOKEN --env beallsflorida
wrangler secret put HOMECENTRIC_STOREFRONT_TOKEN   --env homecentric
```

Add to `.gitignore`: `.wrangler`. (`.svelte-kit` and `build` are already ignored; `.vercel` can stay or go.)

---

## Multi-brand deploy shape

### The build-time/runtime split, stated plainly

`src/lib/brand/config.ts:378-385`:

```ts
const brandId =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BRAND_ID) ||
  (typeof process !== 'undefined' && process.env?.BRAND_ID) ||
  'bealls';
```

`VITE_BRAND_ID` is **first**, and Vite statically replaces `import.meta.env.VITE_BRAND_ID` at build time.
`.env.example:20` sets `VITE_BRAND_ID=bealls`, and `docs/architecture/multi-brand.md:222-223` instructs
setting *both* `BRAND_ID` and `VITE_BRAND_ID` per Vercel project. So in every real deployment the baked
value wins and **`process.env.BRAND_ID` is effectively dead code on the server**.

That is not an accident, and it cannot simply be reordered. `getBrand()` is imported by five **client-side**
components — verified:

- `src/lib/components/Nav.svelte:5,18`
- `src/lib/components/Footer.svelte:2,6`
- `src/lib/components/primitives/PriceLabel.svelte:2,19`
- `src/lib/components/CartDrawer.svelte:12,34`
- `src/lib/components/RefinementChat.svelte:3,29`

The browser bundle has no `process.env`. The only way those five components can know their brand today is a
build-time constant.

### Recommendation: three Workers, one per brand

This is a 1:1 port of the current Vercel shape (`README.md:77`: "Each deploys as its own Vercel project from
the same `main`"), requires no code change, and is what the `env` blocks above express.

The build must run once per brand, because the client bundle differs per brand:

```bash
VITE_BRAND_ID=bealls        npm run build && wrangler deploy --env bealls
VITE_BRAND_ID=beallsflorida npm run build && wrangler deploy --env beallsflorida
VITE_BRAND_ID=homecentric   npm run build && wrangler deploy --env homecentric
```

Under Cloudflare Workers Builds (git-integrated), that means **three Worker projects on the same repo and
branch**, each with `VITE_BRAND_ID` set as a *build* variable and `BRAND_ID` as a *runtime* var. Cloudflare
docs are explicit that, unlike Pages, "Workers does not share the same set of runtime and build-time
variables" — so `VITE_BRAND_ID` must be configured in the Builds settings, not as a Worker var, and
`BRAND_ID` vice versa. Getting this backwards produces a silent wrong-brand deploy, not an error.

Set `BRAND_ID` anyway, even though it is currently shadowed. It costs nothing, it matches
`docs/architecture/multi-brand.md`, and it is the value that starts working if the resolution order is ever
fixed.

### Why one Worker with host-based routing does not work today

It would require `getBrand()` to resolve from the request host, which is impossible in the five client
components above. The refactor is real but not huge, and the plumbing is half-built already:
`src/routes/+layout.server.ts:28-41` already returns a `brand` object (`id`, `name`, `tagline`,
`footerNote`, `googleFontsUrl`, `theme`, `mode`, `shippingPromo`) to every page. The work is:

1. Resolve the brand server-side from `event.url.hostname` instead of an env var.
2. Put the resolved `BrandConfig` into Svelte context in `+layout.svelte`.
3. Convert the five components from `getBrand()` to `getContext(...)`.
4. Keep `getBrand()` for server-only callers (`bigcommerce.ts`, `catalog.ts`, `layout-prompt.ts`, the
   `+page.server.ts` files, the API routes) — those can read the host too.

Also affected: `src/lib/foundation/fallbacks/*.ts` (`home`, `pdp`, `plp`, `checkout`) and
`src/lib/seo/jsonld.ts` import `brand/config` and run on both sides.

**Do not bundle this into the migration.** Migrate as three Workers, prove parity, then consider
consolidation as its own change with its own testing. Six brand configs exist in `brands/` (`bealls`,
`beallsflorida`, `ember`, `haven`, `homecentric`, `volt`) but only three are deployed — a host-routing
refactor is more attractive if that number grows.

---

## Build output and asset serving

| | Vercel (`adapter-vercel`) | Cloudflare Workers (`adapter-cloudflare`) |
|---|---|---|
| Output dir | `.vercel/output` (Build Output API) | `.svelte-kit/cloudflare` |
| Server entry | serverless/edge functions per route group | one bundled `_worker.js` |
| Static assets | uploaded from `.vercel/output/static` | uploaded from `assets.directory`, minus `.assetsignore` |
| Asset routing | Vercel routing layer | `_worker.js` checks `manifest.assets` and falls through to `env.ASSETS.fetch(req)` (`files/worker.js:83-90`) |
| Immutable caching | Vercel default | adapter appends rules to `_headers` for `${appPath}/immutable/*` (`index.js:137-140`) |
| `_headers` / `_redirects` | n/a | **project root**, not `static/`. The adapter throws if it finds them under the assets dir (`index.js:33-43`). Applies to static assets only — never to SSR responses. |
| `_routes.json` | n/a | **Pages only.** Not generated on the Workers path. Do not create one; the adapter throws if it finds one at `index.js:23-30`. |
| Image optimization | available, **not configured** — `adapter()` is called with no `images` option | n/a — nothing to replace |

Verified facts about this specific repo:

- **There is no `static/` directory.** `ls static` → no such file or directory. So there are no static files
  to migrate, and `routes.exclude` tuning is moot.
- **`src/app.html:5` references `%sveltekit.assets%/favicon.png`, which does not exist.** It 404s today on
  Vercel and will 404 identically on Workers. Pre-existing, not caused by the migration. Worth fixing while
  you are in there — create `static/favicon.png`.
- **All product images are remote BigCommerce CDN URLs** — `src/lib/server/catalog.ts:275`
  (`image: p.defaultImage?.url || ''`), rendered directly at
  `src/lib/components/primitives/ProductCard.svelte:72`. No `@sveltejs/enhanced-img`, no `<enhanced:img>`,
  no local image assets. Nothing changes.
- **Nothing is prerendered**, so the prerendered-page handling in the adapter and the `_routes.json`
  100-rule limit are both irrelevant.
- `assets/readme/showcase.png` and the ~11 screenshot directories under `docs/audits/screenshots/` are
  outside `static/` and are not deployed. No asset-count concern (limits are 20,000 / 100,000 files).

---

## Suggested sequence

1. Swap the adapter, add `wrangler.jsonc`, add `.wrangler` to `.gitignore`. Run `npm run build` and confirm
   `.svelte-kit/cloudflare/_worker.js` and `.assetsignore` are produced. Run `npm run check` — this is where
   the `App.Platform` / missing-`app.d.ts` question from P0-1 resolves, and it is cheap here and annoying
   later. Note the reported Worker size (P2-6).
2. Set all secrets and vars for one environment (`bealls`) only. Deploy. This is where P0-3 surfaces.
3. Smoke-test in this order, because each depends on a different failing subsystem:
   `/` (SSR + Neon + BC) → `/category/[slug]` (layout generation, the 8–13 s path) → add to cart
   (P2-3, BC cookie replay) → refinement chat (P0-2) → `/observe` (P0-1, logging).
4. **Verify the cache actually writes.** Hit the same category twice and confirm the second response has
   `meta.cacheHit: true`. If it does not, P0-1 is live. This is the single highest-value check in the list —
   it fails silently and it costs money on every request.
5. Apply the `waitUntil` fix (P0-1), redeploy, re-verify step 4.
6. Read CPU time per route in Workers Observability; decide on `limits.cpu_ms` (P1-2).
7. Only then stand up the other two environments.

---

## Confidence summary

| Item | Confidence | Basis |
|---|---|---|
| No `node:*`/`fs`/`path`; no hooks; no prerender; no `static/`; no load streaming | High | Direct grep of the repo |
| Ten fire-and-forget sites at the exact lines listed | High | Direct read of each file |
| Those promises are cancelled on Workers without `waitUntil` | High | Cloudflare best-practices + platform limits docs |
| `platform.ctx.waitUntil` is the right property path | High | Read `adapter-cloudflare@7.2.8/files/worker.js:100-110` |
| `$env/dynamic/private` works at module scope | High | Read `files/worker.js:4,45,73`; `server.init({env})` precedes lazy route import |
| `process.env` needs `nodejs_compat` + compat_date ≥ 2025-04-01 | High | Cloudflare `workers/configuration/environment-variables/`, quoted |
| SSE endpoint safe — no wall-clock limit | High | Cloudflare `workers/platform/limits/`, quoted |
| Free plan 10 ms CPU / Paid 30 s default / 5 min max | High | Same page + the 2025-03-25 changelog |
| Adapter targets Workers when `main`/`assets` present, Pages otherwise | High | Read `adapter-cloudflare@7.2.8/utils.js:7-17` |
| Adapter reads only top-level wrangler config (no `--env`) | High | Read `index.js:287` — `unstable_readConfig({ config })` |
| `.assetsignore` contents | High | Read `index.js:269-277` |
| Adapter edge-caches any `Cache-Control`-bearing response via `caches.default` | High | Read `files/worker.js:13-21,74-76,119-120` |
| No `setHeaders` anywhere, so P2-3 cannot fire today | High | Direct grep — zero matches |
| `vars` non-inheritable, `observability` inheritable | High | Cloudflare `workers/configuration/environment-variables/` + `workers/wrangler/configuration/` key lists |
| Subrequest caps: 1000/invocation Paid, 50 Free, 6 simultaneous connections | High | Cloudflare `workers/platform/limits/` |
| Unbounded fan-out at `observe/sessions/+server.ts:13` and `catalog.ts:223` | High | Direct read; neither has a cap |
| `src/app.d.ts` does not exist | High | `ls src/` |
| `App.Platform` resolves without an `app.d.ts` | **Unverified** | Adapter ships `ambient.d.ts`; docs claim auto-application. Gated behind `npm run check` in step 1. |
| `VITE_BRAND_ID` shadows `BRAND_ID`; client components force build-time brand | High | Read `brand/config.ts:378-385` + five component imports + `.env.example:20` |
| `enrich.ts` is not on any route import graph | High | Zero exports, zero importers, verified by grep |
| Outbound `Origin`/`Cookie` headers allowed | High | Cloudflare `workers/runtime-apis/request/`, quoted |
| `nodejs_compat` includes ALS | Medium-high | Inferred from docs framing `nodejs_als` as "enable *only* AsyncLocalStorage" |
| Isolate churn makes per-isolate DDL flags worse | Medium | Mechanism certain; frequency unmeasured |
| `setInterval` in `session.ts` effectively never fires | Medium-high | Workers timer semantics; not empirically tested |
| `Connection: keep-alive` is ignored rather than rejected | Medium | Inferred; no doc found either way |
| `Headers.getSetCookie()` availability | Medium | Docs mention `getAll()`; `getSetCookie` not confirmed. Code already falls back. |
| `partialOutputStream` CPU cost stays under 30 s | Medium | Reasoned, not measured |
| Bundle size fits | Low-medium | **Not measured** — `node_modules` is not installed in the target repo |

**What I could not verify.** `node_modules` is absent from `/Users/nino/Workspace/dev/wip/bealls-aisles`, so
I ran no build, no `wrangler deploy --dry-run`, and no bundle-size check. All adapter-internal claims were
verified against the identical version (`7.2.8`) installed in `~/Workspace/dev/apps/rally-hq`. The five
internal Cloudflare reference apps are all **Pages** targets, so none of them validates the Workers-target
`wrangler.jsonc` above; that shape comes from the SvelteKit adapter docs plus the adapter source, not from a
working local deploy.
