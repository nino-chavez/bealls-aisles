# Aisles — Architecture Overview

**Version**: 0.1.0
**Last Updated**: 2026-04-06
**Audience**: Developers, Technical Stakeholders

## Overview

Aisles is an AI-native headless storefront platform that personalizes the shopping experience in real time. A persona inference engine reads client signals, computes a probability distribution across four shopper archetypes, and feeds that distribution directly into AI layout generation. The result is a category page that reorganizes itself for each visitor — editorially for a browser, functionally for a buyer.

Three brands run on a single codebase, differentiated entirely by configuration.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | SvelteKit 2 / Svelte 5 (runes) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Deployment | Vercel (adapter-vercel) |
| AI Models | Claude Haiku 4.5 (primary), Claude Sonnet 4.6 (fallback) |
| AI Gateway | Vercel AI Gateway (model routing, cost tagging) |
| AI SDK | Vercel AI SDK v6 (generateText, streamText, Output.object) |
| Layout Cache | Upstash Redis (1-hour TTL) |
| Signal Sessions | Upstash Redis (30-minute TTL) |
| Enrichment Data | Neon Postgres |
| Product Catalog | BigCommerce GraphQL Storefront API |
| Embeddings | OpenRouter (openai/text-embedding-3-small) |

---

## The Signal → Inference → Layout Pipeline

This is the core of Aisles. Every category page load runs through three stages.

### Stage 1: Signal Collection

Signals originate from two places:

**Request-time signals** (server-side, available on every page load):
- URL parameters (`?intent=hunter`)
- Search query text
- HTTP referrer (social, deal site, review site)
- UTM campaign and source tags
- Device type (mobile / tablet / desktop)
- Time of day and day of week
- Cross-session cookie (`aisles_session`): stored persona, stored category, visit count

**Behavioral signals** (client-side, emitted after page load):
- `nav.category_view` — shopper entered a category
- `nav.product_view` — shopper viewed a product detail
- `nav.search` — shopper ran a search
- `commerce.add_to_cart` — shopper added an item
- `refine.message` — shopper sent a refinement message

Client signals are batched and sent to `POST /api/signals`, which appends them to the session store in Redis and re-runs inference.

### Stage 2: Inference Engine

`src/lib/signals/inference.ts` consumes an `InferenceContext` and returns a `PersonaInference`.

The four personas:
- **gatherer** — exploratory, inspiration-driven, browsing aesthetics and editorial content
- **hunter** — goal-oriented, efficiency-driven, comparing prices and specs
- **researcher** — methodical, evidence-driven, reading every spec and comparison
- **gifter** — shopping for someone else, needs universal appeal and safe price points

The engine works by:
1. Starting from a prior (`gatherer: 0.3, hunter: 0.2, researcher: 0.2, gifter: 0.1`)
2. Running weighted rules against the context (search keywords, referrer patterns, UTM tags, device+time combos, cross-session continuity)
3. Summing score adjustments per rule, weighted by rule confidence
4. Normalizing to a probability distribution
5. Computing the primary persona (highest probability), confidence (gap to second place), and shift detection (did the primary change from the stored persona?)

The output `PersonaInference` includes:
- `probabilities` — all four scores as fractions summing to 1.0
- `primary` — the winning persona label
- `confidence` — how far ahead the primary is from the runner-up
- `modifiers` — `priceSensitivity`, `urgency`, `familiarityWithStore` (each 0–1)
- `shift` — `detected`, `from`, `trigger` (what caused the change)
- `signalCount` — how many rules fired

### Stage 3: AI Layout Generation

The primary persona drives layout generation. `POST /api/layout` (or `/api/layout/stream` for SSE):

1. Checks Redis for a cached layout matching `persona + categorySlug`
2. On cache miss: fetches products from BigCommerce via `loadCategoryProducts`, which merges enrichment data from Neon Postgres and sorts by persona-fit score
3. Builds a prompt via `buildLayoutPrompt` — includes the persona definition, brand voice, and product catalog with persona-fit scores and semantic tags
4. Calls Claude Haiku 4.5 via Vercel AI Gateway with structured output (`Output.object({ schema: LayoutSchema })`)
5. Falls back to Claude Sonnet 4.6 if Haiku fails validation
6. Stores the result in Redis (1-hour TTL)
7. Logs to Neon Postgres (`generation_logs` table) with model, tokens, cost, persona, category, and session ID

The AI output is a `Layout` object — a validated JSON structure defining an ordered list of sections drawn from a fixed component vocabulary. The AI selects components, orders products, and writes editorial copy. It cannot invent new components.

#### Layout Component Vocabulary

| Component | Purpose | Key Props |
|---|---|---|
| `editorial-header` | Opening editorial copy | eyebrow, headline, body text |
| `hero-product` | Single standout product | product ref, showSpecs |
| `product-grid` | Main product display | columns (2/3/4), imageRatio, showQuickAdd |
| `category-header` | Functional header | title, subtitle, showSort, showFilter |

#### Persona Layout Patterns (typical AI output)

| Persona | Layout Style |
|---|---|
| gatherer | `editorial-header` → `hero-product` → 2-column `product-grid` (landscape images, descriptions shown) |
| hunter | `category-header` with sort/filter → 4-column `product-grid` (square images, quickAdd enabled) |
| researcher | `category-header` → `product-grid` with specs shown, no hero |
| gifter | `editorial-header` → `hero-product` → 3-column grid at mid price tier |

---

## Data Flow Diagram

```
Browser (shopper)
  │
  │  GET /category/[slug]
  ▼
SvelteKit server load
  ├─ reads aisles_session cookie
  ├─ builds InferenceContext (URL params, referrer, device, time, cross-session)
  ├─ runs infer() → PersonaInference
  ├─ POST /api/layout or /api/layout/stream
  │    ├─ Redis cache check
  │    │    hit  → return cached Layout (<100ms)
  │    │    miss → loadCategoryProducts
  │    │              ├─ BigCommerce GraphQL (products)
  │    │              └─ Neon Postgres (enrichment: personaFit, semanticTags)
  │    │           → buildLayoutPrompt(persona, products)
  │    │           → Claude Haiku 4.5 via AI Gateway
  │    │           → (fallback: Claude Sonnet 4.6)
  │    │           → cache to Redis
  │    │           → log to Neon generation_logs
  │    └─ return Layout JSON
  └─ render LayoutRenderer (Svelte components)

Browser (client-side, after load)
  ├─ emits behavioral signals (nav, search, cart)
  ├─ POST /api/signals
  │    ├─ appends to SignalStore
  │    ├─ re-runs infer()
  │    └─ persists to Redis
  └─ receives PersonaInference (may trigger layout refresh)
```

---

## Enrichment Pipeline

Before layout generation can work well, products need persona-fit scores. The enrichment pipeline (`src/lib/server/enrichment/enrich.ts`) runs as an offline script:

1. Fetches all products from BigCommerce (up to 50 per channel)
2. For each product, calls Claude Sonnet to extract:
   - Material, style, use case, dimensions, price tier
   - Persona-fit scores (0.0–1.0 for each of the four personas)
   - Semantic tags for intent-based discovery
3. Generates embeddings via OpenRouter (text-embedding-3-small)
4. Upserts results into the `enriched_products` table in Neon Postgres

The `loadCategoryProducts` function merges these scores at request time, sorting products by the detected persona's fit score before the AI sees them. High-fit products appear first in the prompt and tend to get hero or featured placement.

---

## Caching Strategy

Two layers of caching reduce cost and latency:

**Layout cache (Redis, `aisles:layout:{persona}:{categorySlug}`)**
- 1-hour TTL
- Cache hit: sub-100ms response, no AI call
- Cache miss: 2–15s generation, then cached for subsequent visitors
- Invalidated manually or after enrichment runs

**Session store (Redis, `aisles:session:{sessionId}`)**
- 30-minute TTL, sliding
- In-memory hot cache per function instance for zero-latency reads
- Falls back to in-memory only if Redis is not configured

**Why not prerender?** Category pages are persona-dependent — the same URL renders four different layouts. Prerendering would bake one persona into static HTML. See `docs/decisions/003-prerender-vs-cache-warming.md`.

---

## Multi-Brand Architecture

See `docs/multi-brand.md` for the full setup guide.

In brief: `BRAND_ID` (or `VITE_BRAND_ID` in the browser context) selects the active brand from `src/lib/brand/config.ts`. The brand config drives:
- BigCommerce channel ID and category prefix
- CSS theme tokens (injected into `:root` at runtime)
- Google Fonts URL
- LLM prompt context (store name, description, product domain, persona definitions, voice guidance)
- Category slug → BigCommerce category name mapping

Three brands ship in the codebase: `haven`, `volt`, `ember`. Each is deployed as a separate Vercel project from the same Git repository, with a different `BRAND_ID` environment variable.

---

## Related Documentation

- `docs/multi-brand.md` — adding and configuring brands
- `docs/api-reference.md` — all API endpoints
- `docs/observe.md` — Observe dashboard for demos
- `docs/development.md` — local setup and tooling
- `docs/decisions/001-enrichment-vs-feedonomics.md`
- `docs/decisions/002-streaming-layout-generation.md`
- `docs/decisions/003-prerender-vs-cache-warming.md`
