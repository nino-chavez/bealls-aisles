<p align="center">
  <img src="./assets/readme/showcase.png" width="100%" alt="Aisles — one engine, three storefronts. The same AI composition engine renders three distinct retail brands from one codebase: Bealls (off-price, red), Bealls Florida (resort, blue), and Home Centric (home decor, green). Built with SvelteKit, the Vercel AI SDK, and BigCommerce.">
</p>

<h1 align="center">Aisles &mdash; an AI-native storefront, shown as a family of brands</h1>

<p align="center">
  <a href="#what-it-is"><b>What it is</b></a> ·
  <a href="#the-three-layers"><b>Three layers</b></a> ·
  <a href="#how-the-engine-composes-a-page"><b>How it works</b></a> ·
  <a href="#quickstart"><b>Quickstart</b></a> ·
  <a href="#documentation"><b>Docs</b></a>
</p>

> **Example-merchant notice.** Bealls, Bealls Florida, and Home Centric appear here as an **example merchant** — realistic retail properties (off-price, a family of brands, buy-online-pickup-in-store, a content-led home brand) chosen to ground the prototype in something concrete. This is an independent research-and-development experiment. It is **not** affiliated with, endorsed by, or a commercial engagement with Bealls Inc. All product data and imagery are demo content.

---

## What it is

Aisles is a working prototype of a storefront with policy-bounded composition. This repository demonstrates one example merchant organization running related brand configurations through a shared engine.

A shopper lands on a category, product, or home page. Aisles reads the intent behind the visit and infers which of four shopper **personas** fits the moment. The current runtime keeps each route's commerce scaffold fixed. It permits trusted product-ranking rules in three PDP zones and bounded model output in one cart zone and two checkout zones. All other current named zones resolve through fixed content or an explicit Hidden terminal. An operator can inspect the signals and rules without gaining shopper-route authority.

The three brand experiences above — **Bealls**, **Bealls Florida**, and **Home Centric** — run on one codebase as separate brand configurations under the same example merchant organization. They do not share product data or visual identity. The prototype demonstrates organization-level reuse: a shared AI composition engine, commerce foundation, and control-plane pattern with brand-specific configuration and existing implementation choices.

This is not evidence that configuration alone can preserve an unrelated merchant's existing storefront. External-reference onboarding needs a versioned reference contract, merchant-native recipes and components, and explicit autonomy policy. That direction is owned by the canonical Aisles work and is not implemented in this repository.

The local policy foundation records Bealls, Bealls Florida, and Home Centric as three separate brands under the `example-merchant` organization. Those runtime records control route access, named-zone resolution, model publication, and cache provenance. Each remains explicitly `uncontracted` against external references.

Merchant pin/lock precedence is executable through trusted server records, but this repository does not ship the compatible storage migration or write path. Production database reads remain disabled unless a separately provisioned route-bound schema is explicitly version-enabled.

[`src/lib/brand/bealls-family-runtime-contract.ts`](src/lib/brand/bealls-family-runtime-contract.ts) inventories 30 executable endpoints and 34 addressable page-plus-method handlers. The zone taxonomy has 28 families and 36 expanded instances. Every applicable instance executes through a named route-to-zone resolver; exposure is recorded separately, so a mounted zone may terminate Hidden without appearing in shopper DOM. The route inventory distinguishes shopper, merchant-review, operator, development, and API audiences. Home Centric's content category stays distinct from storefront PLP. Its storefront-only routes and APIs fail before catalog, cart, or model work begins.

[`src/lib/brand/bealls-family-renderer-contract.ts`](src/lib/brand/bealls-family-renderer-contract.ts) separately fingerprints the current internal renderer integration for each brand. It records shopper surfaces, chrome, runtime design inputs, component recipes, and linked policy versions. Home Centric records mounted cart and picks drawers without claiming that its content-mode navigation exposes those controls.

Run `npm test` for every TypeScript test, or `npm run test:contracts` for the focused runtime and renderer gates. The runtime test scans every executable endpoint, all 34 handlers, and every brand-zone contract. The renderer test scans direct `LayoutRenderer` use and recomputes SHA-256 fingerprints from recorded route, component, CSS, and config owners. `npm run capture:runtime-parity` compares pinned main production source with the candidate at 390, 768, and 1280 pixels. A recorded test-only adapter gives both sides the same deterministic catalog data without paid calls. These are internal regression gates. They do not establish parity with an external storefront, and every `reference.state` remains `uncontracted`.

It's built as an **"art of the possible" prototype** — an artifact to react to and pull capabilities from, not a product being sold.

---

## The three layers

The one rule this project holds to: never conflate these layers. Each answers a different question.

| Layer | What it is | Lives in |
|---|---|---|
| **1 · Composition engine** | Reads shopper signals, infers a persona, and resolves policy-authorized named zones through an exact renderer vocabulary | `src/lib/signals`, `src/lib/foundation`, `src/lib/server` |
| **2 · Commerce foundation** | The table-stakes storefront that exists with or without AI: catalog, cart, checkout, account, search, store locator, compare | `src/routes` |
| **3 · Control plane** | Where a non-technical operator authors rules and content, runs A/B tests, and observes the AI's behavior | `aisles-admin` (separate repo); Observe dashboard ships here |

---

## How the engine composes a page

Every shopper page executes the same authority boundary after signal inference.

```
  Trusted route ──▶ Compiled brand policy ──▶ Named zone resolver ──▶ Renderer or Hidden
                                                      │
                         merchant pin/lock ───────────┤
                         fixed / trusted rules / model┤
                         validated fallback ──────────┘
```

**Signals.** Request-time (search, referrer, UTM, device, time, return visit) and behavioral (category and product views, dwell, scroll, cart adds and removals, refinement chat).

**Inference.** `src/lib/signals/inference.ts` runs 28 weighted rules over the accumulated context and normalizes to a probability across four personas — **gatherer** (browsing to discover), **hunter** (buying with intent), **researcher** (comparing specs), **gifter** (shopping for someone else). The primary persona drives composition; the dashboard reports every rule that fired.

**Composition — with a correctness guarantee.** Model output is not a whole shopper layout and is not free-form. Each authorized zone output must be a member of that zone's finite, typed set:

> **∀ I, P, Z · f(I, P, Z) → S<sub>Z</sub> ∈ V<sub>Z</sub>** — for all approved inputs, personalization vectors, and authorized zones, output must validate against that zone's registered schema.

`V` is a strict Zod schema closed over components the zone renderer can dispatch. Product IDs, assets, and destinations must also come from the approved request inputs. Runtime CSS, HTML, component IDs, zone IDs, and URLs cannot be invented. Invalid, over-authority, holdout, or approval-required output does not publish; the brand-specific fallback or Hidden terminal remains in control. See the design vocabulary and the narrower implemented boundary in [`docs/architecture/engine/composition-taxonomy.md`](docs/architecture/engine/composition-taxonomy.md).

The runtime contract covers the whole shopper surface inventory. Model authority does not. Current live model publication is limited to the named cart and checkout zones above; PDP recommendations use a trusted deterministic rule, and the remaining applicable zones are fixed or Hidden.

---

## The example merchant

Three real retail archetypes, one engine, selected at deploy time by a `BRAND_ID` env var:

| Brand | Accent | Archetype |
|---|---|---|
| **Bealls** | `#C8102E` | Off-price department store — "Find your favorites for less" |
| **Bealls Florida** | `#0066B3` | Resort & coastal lifestyle — "Florida is a feeling" |
| **Home Centric** | `#76B82A` | Content-led home decor — "New Inspiration for Less" |

Each deploys as its own Vercel project from the same `main`. The current related brands are configured from one codebase; that does not make a config-only addition sufficient for an unrelated merchant. See [`docs/architecture/multi-brand.md`](docs/architecture/multi-brand.md).

---

## Quickstart

**Prerequisites:** Node 22 and npm. BigCommerce and model credentials enable live catalog/model paths; Redis and Postgres are optional. Static fallbacks and the deterministic parity fixture make no paid model calls.

```bash
git clone https://github.com/nino-chavez/bealls-aisles.git
cd bealls-aisles
npm install

cp .env.example .env.local   # add only the providers you intend to exercise

# Required for the signed, HttpOnly route grant used by model-zone APIs.
# Use a secret manager outside local development; minimum 32 characters.
export AISLES_ROUTE_BINDING_SECRET="$(openssl rand -hex 32)"

npm run dev                   # http://localhost:5173
```

Append `?dev=true` to a supported shopper page to inspect persona confidence, rule matches, and shift detection. Fixed pages do not gain model authority in dev mode. Switch brands locally with `VITE_BRAND_ID`:

```bash
VITE_BRAND_ID=bealls npm run dev      # or beallsflorida · homecentric
```

The operator's view lives at `/observe` and requires `OBSERVE_ACCESS_TOKEN` in deployed environments. `/style-guide` is development-open and otherwise requires `MERCHANT_REVIEW_ACCESS_TOKEN`. `/test/*` routes exist only in development. `/compare` remains shopper-facing because the Picks tray links to it.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | SvelteKit 2 / Svelte 5 (runes) · TypeScript · Tailwind v4 |
| AI | Vercel AI SDK v6 + Vercel AI Gateway · Claude Haiku → Sonnet |
| Data | BigCommerce Storefront GraphQL · Neon Postgres (enrichment) · Upstash Redis (cache) |
| Deploy | Vercel (`adapter-vercel`) — three projects off one `main` |

---

## Documentation

| Document | What it answers |
|---|---|
| [`docs/README.md`](docs/README.md) | The document map — read first |
| [`docs/architecture/engine/composition-taxonomy.md`](docs/architecture/engine/composition-taxonomy.md) | The block × surface × latitude contract |
| [`docs/architecture/engine/signals-and-inference.md`](docs/architecture/engine/signals-and-inference.md) | The signal and inference-rule catalog |
| [`docs/architecture/multi-brand.md`](docs/architecture/multi-brand.md) | How one codebase serves multiple brands |
| [`docs/architecture/decisions/`](docs/architecture/decisions/) | ADRs — load-bearing engine choices |
| [`docs/developer/development.md`](docs/developer/development.md) · [`api-reference.md`](docs/developer/api-reference.md) | Local setup, debugging, and the API surface |

---

## Status

An active R&D prototype (`v0.0.1`). The composition engine, the four-persona inference, the typed-layout invariant with fallback, the full commerce foundation, multi-brand configuration, and the Observe dashboard are implemented and deployed as the three brands above. The `aisles-admin` control plane lives in a separate repo.

No open-source license is currently set; all rights reserved by the author. Bealls, Bealls Florida, and Home Centric are trademarks of their respective owner and are used here only to illustrate a prototype.
