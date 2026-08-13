# Cloudflare current-main preview

This deployment path builds the current Bealls-family runtime on Cloudflare Workers. It does not revive the historical whole-page AI runtime.

The preview uses the deterministic `AISLES_PARITY_FIXTURE=v1` catalog. It needs no BigCommerce, Redis, database, Anthropic, OpenRouter, or AI Gateway credential. Shopper pages keep the authority in current `main`: fixed zones plus the three trusted-rule PDP zones. The retired endpoints remain closed.

## The old Workers are not release candidates

Any Worker still running code from `cf-deploy` or `worktree-spike-cloudflare-portkey` is stale and unsafe to promote. That lineage included broad shopper layout generation that current `main` retired.

The historical names include `aisles-demo-1`, `aisles-demo-2`, `aisles-demo-3`, `aisles-bealls`, `aisles-beallsflorida`, `aisles-homecentric`, and `aisles-sleepcountry`. A live response from one of those Workers does not prove it carries the current policy.

Do not repoint traffic to them. Do not copy their secrets into the new Workers. Do not use their successful smoke logs as evidence for this build.

Sleep Country is excluded from this port. Current `main` has no Sleep Country brand configuration, canonical policy, renderer contract, or deterministic catalog fixture. `BRAND_ID=sleepcountry` fails closed.

## Three separate preview Workers

`wrangler.jsonc` declares one environment per supported brand:

| Brand | Wrangler environment | Worker | Preview state |
|---|---|---|---|
| Bealls | `bealls` | `aisles-bealls-current-preview` | First promotion candidate |
| Home Centric | `homecentric` | `aisles-homecentric-current-preview` | Promote after Bealls smoke passes |
| Bealls Florida | `beallsflorida` | `aisles-beallsflorida-current-preview` | Buildable; promotion blocked pending catalog validity |

Each environment binds only three non-secret values: exact `BRAND_ID`, the fixture version, and the hosting profile. The browser bundle also bakes the same exact brand through `VITE_BRAND_ID`. The deployment wrapper refuses to deploy a build receipt for another brand.

The root Wrangler target binds an intentionally invalid brand. A bare `wrangler deploy` can create no usable storefront; it returns the same `503` binding rejection. Use the guarded package commands with an exact brand.

The shopper HTML exposes the active value as `data-brand-id`. Every response also carries `x-aisles-brand-id`, `x-aisles-hosting-profile`, `x-aisles-catalog-mode`, and `x-aisles-shopper-model-authority`. The server returns `503` before route execution if the runtime brand, compiled brand, or fixture binding does not match.

The smoke command checks those fields instead of inferring the brand from colors, copy, or the Worker name.

## Build without application credentials

Install and verify the source first:

```bash
npm ci
npm test
npm run check
```

Build and validate the Worker without deploying:

```bash
npm run verify:cloudflare -- bealls
npm run verify:cloudflare -- homecentric
npm run verify:cloudflare -- beallsflorida
```

For each brand, the wrapper:

1. removes application, catalog, database, cache, and model credentials from the build child process
2. selects the Cloudflare adapter and exact brand
3. enables the deterministic fixture
4. writes a build receipt with the source commit, Worker name, brand, environment, fixture, and bundle hash
5. scans the shopper JavaScript for `/api/layout`, `/api/refine`, and `/api/suggest`
6. runs `wrangler deploy --dry-run` against the named environment

Vercel remains the default adapter for ordinary `npm run build`.

## Promotion order

Cloudflare account authentication must come from the operator or CI environment. The repository does not store an account ID or API token.

Deploy Bealls first:

```bash
npm run deploy:cloudflare -- bealls
npm run smoke:cloudflare -- bealls https://<exact-bealls-preview-url>
```

Record that smoke before enabling the Home Centric gate. Then deploy and smoke Home Centric:

```bash
AISLES_BEALLS_PREVIEW_VERIFIED=v1 npm run deploy:cloudflare -- homecentric
npm run smoke:cloudflare -- homecentric https://<exact-homecentric-preview-url>
```

Bealls Florida can be built and dry-run now. Its deploy command fails intentionally. Promotion stays blocked until an operator verifies the actual Bealls Florida BigCommerce channel, category names, product membership, and storefront-token origin rules. Removing the code gate without that evidence is not approval.

## Smoke contract

The smoke command makes only these deterministic preview requests:

- `GET /` returns `200`, the exact `data-brand-id`, and matching runtime proof headers
- `POST /api/layout` returns `403` with `modelCalled: false`
- `POST /api/layout/stream` returns `410`
- `POST /api/refine` returns `403`
- `POST /api/suggest` returns `403`

The fixture prevents server access to BigCommerce, Redis, Postgres, search providers, and model providers. The existing fixture boundary test independently fails if any guarded path acquires one of those services.

## What remains unresolved

- Cloudflare deploy authentication has not been verified for this branch. The operator or CI job needs a token authorized to deploy Workers in the intended account.
- The final preview URLs are unknown until the named Workers are deployed.
- Bealls Florida catalog validity is not established. Its promotion remains blocked.
- These previews do not validate live commerce. Moving any brand from fixture data to live catalog, cart, or checkout needs a separate credential, channel, and behavior review.
- Sleep Country remains excluded until it has a canonical brand policy, renderer contract, and deterministic catalog source on current `main`.
