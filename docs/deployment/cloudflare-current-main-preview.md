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
| Bealls | `bealls` | `aisles-bealls-current-preview` | Live and smoke-verified |
| Home Centric | `homecentric` | `aisles-homecentric-current-preview` | Live and smoke-verified |
| Bealls Florida | `beallsflorida` | `aisles-beallsflorida-current-preview` | Buildable; promotion blocked pending catalog validity |

Each environment declares three stable non-secret values: exact `BRAND_ID`, the fixture version, and the hosting profile. The guarded build adds two more non-secret values to its resolved deployment config: the full deployable-output identity and source commit. The browser bundle also bakes the same exact brand through `VITE_BRAND_ID`. The deployment wrapper refuses to deploy a build receipt for another brand.

The root Wrangler target binds an intentionally invalid brand. A bare `wrangler deploy` can create no usable storefront; it returns the same `503` binding rejection. Use the guarded package commands with an exact brand.

The shopper HTML exposes the active value as `data-brand-id`. Application, SSR, and API responses carry `x-aisles-brand-id`, `x-aisles-hosting-profile`, `x-aisles-catalog-mode`, `x-aisles-shopper-model-authority`, `x-aisles-build-id`, and `x-aisles-source-commit`. Static assets may be served before the Worker and do not carry this application proof. The server returns `503` before route execution if the runtime brand, compiled brand, fixture, build identity, or source-commit binding is invalid.

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
4. refuses to attest any dirty tracked or untracked source
5. writes a build receipt over the full deployable directory plus the adapter's generated server, client, and temporary inputs, source commit, Worker name, brand, environment, and fixture
6. creates a resolved per-brand deployment config containing that build identity and source commit
7. re-hashes the full deployable directory and Wrangler dry-run output before deployment, so added, removed, or modified files fail closed
8. scans the shopper JavaScript for `/api/layout`, `/api/refine`, and `/api/suggest`
9. runs `wrangler deploy --dry-run` against the resolved named Worker config

Vercel remains the default adapter for ordinary `npm run build`.

## Promotion order

Cloudflare account authentication must come from the operator or CI environment. The public account ID is pinned to `b6ffcf200d56bab5749e243f024658d2`; an absent config value or mismatched ambient `CLOUDFLARE_ACCOUNT_ID` fails before remote inspection. The repository stores no API token.

Immediately before mutation, the wrapper reads the exact target Worker through Wrangler. A missing new Worker is safe. An existing Worker is allowed only when every active version exposes the declared plain-text values and `ASSETS` binding, and `wrangler secret list` returns empty. Any inherited secret, service, D1, KV, AI, database, backend, or otherwise undeclared binding blocks deployment. The preflight never deletes or edits remote state. Omitting a binding from the local config does not clear it.

After that read-only gate passes, the wrapper deploys with Wrangler's strict binding replacement. Build and deployment children also remove Vercel OIDC plus observer/review tokens, in addition to the catalog, model, database, and cache credentials listed above.

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

## Production preview receipt — 2026-08-13

The two approved preview Workers were built from and identify exact current-main commit `4f7c2612fc322288ef1e39c406c81da7c6a8e93d`.

| Brand | URL | Cloudflare version | Build identity | Result |
|---|---|---|---|---|
| Bealls | [aisles-bealls-current-preview.biq.workers.dev](https://aisles-bealls-current-preview.biq.workers.dev) | `cfee9347-6c64-4902-bd4f-9f736bfd8cf7` | `ce660027580b368363c70c80ec5db97fa438b14553e322cfe67739794164e8b0` | Smoke passed |
| Home Centric | [aisles-homecentric-current-preview.biq.workers.dev](https://aisles-homecentric-current-preview.biq.workers.dev) | `346fe906-4c10-42ca-a33d-bbdf0572887b` | `75739e25363a789a5ed17b6761200b0ff987f3fb5e732bebadf4841bd0326913` | Smoke passed |

Each live version has only the `ASSETS` binding and the five declared non-secret plain-text values. `wrangler secret list` returned an empty array for both Workers. The smoke contract below passed after normal Workers routing propagation. No legacy Worker was changed.

## Smoke contract

The smoke command makes only these deterministic preview requests:

- `GET /` returns `200`, the exact `data-brand-id`, and matching runtime proof headers
- the runtime build identity and commit exactly match the fresh local receipt
- storefront fixture PDP policy is exactly `fixed / rules / rules / rules / fixed`
- storefront PLP and search policy zones remain exactly `fixed`
- Home Centric proves its fixed content-category boundary instead of pretending to have storefront PDP/search routes
- `POST /api/layout` returns `403` with `modelCalled: false`
- `POST /api/layout/stream` returns `410`
- `POST /api/refine` returns `403`
- `POST /api/suggest` returns `403`

The fixture prevents server access to BigCommerce, Redis, Postgres, search providers, and model providers. The existing fixture boundary test independently fails if any guarded path acquires one of those services.

## What remains unresolved

- Bealls Florida catalog validity is not established. Its promotion remains blocked.
- These previews do not validate live commerce. Moving any brand from fixture data to live catalog, cart, or checkout needs a separate credential, channel, and behavior review.
- Sleep Country remains excluded until it has a canonical brand policy, renderer contract, and deterministic catalog source on current `main`.
