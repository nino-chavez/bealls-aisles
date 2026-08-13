# Aisles Documentation Map

Engineering documentation for the Aisles composition engine and its example-merchant multi-brand storefront foundation. The current scope is organization-level reuse for separate Bealls, Bealls Florida, and Home Centric brand configurations; it does not establish config-only onboarding or visual preservation for an unrelated merchant. Start with the [top-level README](../README.md) for the overview.

## Engine

The AI composition layer — what the engine can compose, and how it infers intent.

- [architecture/engine/composition-taxonomy.md](./architecture/engine/composition-taxonomy.md) — the block catalog × surface matrix × composition-latitude contract
- [architecture/engine/signals-and-inference.md](./architecture/engine/signals-and-inference.md) — the signal types and persona inference rules
- [architecture/engine/fractal-interface-evaluation.md](./architecture/engine/fractal-interface-evaluation.md) — the composition philosophy behind the engine

## Foundation

The storefront that exists with or without AI.

- [architecture/multi-brand.md](./architecture/multi-brand.md) — organization-scoped multi-brand setup (storefront and content modes)
- [deployment/cloudflare-current-main-preview.md](./deployment/cloudflare-current-main-preview.md) — bounded current-main Workers preview, no-paid fixture, promotion gates, and stale legacy Worker warning

## Decisions

Load-bearing runtime architecture decisions.

- [architecture/decisions/001-enrichment-vs-feedonomics.md](./architecture/decisions/001-enrichment-vs-feedonomics.md)
- [architecture/decisions/002-streaming-layout-generation.md](./architecture/decisions/002-streaming-layout-generation.md)
- [architecture/decisions/003-prerender-vs-cache-warming.md](./architecture/decisions/003-prerender-vs-cache-warming.md)

## Developer

- [developer/development.md](./developer/development.md) — local setup, environment, debugging
- [developer/api-reference.md](./developer/api-reference.md) — the API surface

## Verification

- [audits/](./audits/) — screenshots of the deployed brands and iteration history
