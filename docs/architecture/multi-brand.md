# Aisles — Multi-Brand Setup Guide

**Version**: 0.4.0
**Last Updated**: 2026-08-13
**Audience**: Developers, Platform Operators

## Overview

A single Aisles codebase serves related brands for one example merchant organization. Brand selection is controlled by the `BRAND_ID` environment variable. Each brand gets its own Vercel project, BigCommerce channel (storefront mode) or content set (content mode), and visual identity, but shares approved application code, AI logic, and infrastructure patterns.

## Scope limit

Bealls, Bealls Florida, and Home Centric are separate brand configurations under the same `example-merchant` organization. Their shared code does not mean they share a visual identity, and it does not prove that an unrelated merchant can preserve an existing storefront through tokens, prompts, and configuration alone. Each current brand has a separate internal integrated-renderer contract in `src/lib/brand/bealls-family-renderer-contract.ts`. It records the surfaces that exist now, including the fixed style-guide and store-locator routes plus each brand's actual rescue paths. Storefront brands have 404 and empty-state insertions. Home Centric has a 404 insertion but no current empty-state insertion. The three records stay distinct even where they point to the same implementation.

The contract keeps mounted chrome separate from exposed chrome. The root layout mounts the brand strip, primary nav, footer, cart drawer, and picks tray for all three brands. Home Centric's content-mode nav does not expose the cart or picks controls, so its exposed list omits both. This describes the current implementation without presenting hidden controls as usable brand affordances.

The focused source gate is `npm run test:renderer-contract`. Before recomputing its deterministic SHA-256 fingerprint, it scans SvelteKit route files for direct `LayoutRenderer` use. Every discovered route must have explicit route evidence and snapshot coverage, including its sibling load module when one exists. The test-only component harness is tracked as a harness, not presented as a shopper surface. The gate separately fingerprints the normalized `BrandConfig` inputs that affect rendered surfaces, including category values, theme tokens, homepage and prompt content, incentives, pricing mode, and the exact Google Fonts URL. The gate detects drift against the recorded snapshot. It cannot prove that every implementation change must increment `contractVersion`; that remains an explicit review and update step.

That internal-family integration is independent of external-reference preservation. The contract does not preserve a third-party storefront, claim visual parity, or change `reference.state`. External-reference onboarding still needs a separately versioned reference contract, merchant-native components and page recipes, responsive behavior, and explicit autonomy policy. The canonical Aisles reference-contract/autonomy direction owns that work; this repository records only the current example-merchant implementation.

`src/lib/brand/composition-policy.ts` and `src/lib/brand/bealls-family-runtime-contract.ts` make the current boundary executable. They assign the three brands separate child policies under `example-merchant`. Each child can narrow organization authority but cannot expand it. Shopper page loads derive their route from `event.url.pathname`. The model API accepts no client-supplied route or surface; it requires a short-lived, server-signed, HttpOnly route grant and treats Origin and Referer only as confusion checks.

The route contract inventories 30 executable endpoints under `src/routes`: 15 page routes, one SvelteKit error route, and 14 API endpoints. Multi-method APIs expand that inventory to 34 addressable page-plus-method handlers. These are metadata counts, not screenshot counts.

| Audience | Routes | Runtime gate | Shopper regression claim |
|---|---|---|---|
| Shopper | `/`, account, cart, category, checkout, compare, product, search, locator, error | Exact brand availability and server route normalization | Included when the route is available for that brand |
| Operator | `/observe` and `/api/observe/*` | `OBSERVE_ACCESS_TOKEN`; explicit development credential only in dev | Excluded |
| Merchant review | `/style-guide` | Development-only open access or `MERCHANT_REVIEW_ACCESS_TOKEN` | Excluded |
| Development | `/test/*` | Development build only | Excluded |
| Runtime API | `/api/*` | Endpoint-specific brand, route, and policy gates | Not a page-preservation surface |

`/compare` remains shopper-facing because the Picks tray links to it. Home Centric's `/category/[slug]` route normalizes to the distinct `category` surface, never PLP. Its storefront-only account, cart, checkout, compare, PDP, search, cart, refinement, suggestion, and model-zone paths fail before protected work begins.

The zone catalog contains 28 family IDs: home 5, PLP 6, PDP 5, cart 3, checkout 2, search 2, account 2, locator 1, 404 rescue 1, and other-empty rescue 1. Array multiplicity expands that taxonomy to 36 concrete instances. Bealls and Bealls Florida make all 28 families and 36 instances applicable and mounted. Ten families are exposed by current shopper renderers; the other applicable zones terminate through a trusted Hidden result unless validated content exists. Home Centric makes 7 families and 12 instances applicable and mounted, exposes `home.hero` and `locator.editorial-intro`, and marks the remaining 21 families not applicable. It does not claim the taxonomy's `error-empty` family because no current Home Centric route renders that state. “Mounted,” “exposed,” and “materialized” are separate states.

| Brand | Fixed | Trusted rules | Model | Holdout / approval-required |
|---|---|---|---|---|
| Bealls | Home, PLP, search, account, locator, rescue, compare, Picks, two PDP zones, two cart zones | `pdp.related`, `pdp.cross-sell`, `pdp.recently-viewed` via `pdp-tag-overlap-v1` | `cart.above-checkout-cta` on `/cart`; `checkout.assurance-strip` and `checkout.last-chance-upsell` on `/checkout` | None configured |
| Bealls Florida | Same zone shape under its own brand policy and cache identity | Same three PDP rule zones under Bealls Florida identity | Same three bounded cart/checkout zones under Bealls Florida identity | None configured |
| Home Centric | All 7 applicable families; content category is a fixed non-zone surface | None | None | None configured |

All current applicable policies publish in `live` mode. That does not authorize arbitrary output. A zone accepts only its exact strict schema and only components its renderer can dispatch. Model product IDs, assets, and destinations must come from the approved input set. Runtime CSS, HTML, extra props, unsupported components, and invented URLs are rejected. Invalid or over-authority output preserves the trusted brand fallback or Hidden terminal. The global cart drawer is fixed and makes no model-zone request; cart model authority belongs only to the exact `/cart` page grant. Model-zone responses project product candidates to the public card fields needed by cart and checkout. Persona scores, semantic tags, overlap scores, and shared tags remain server/operator data.

The resolver supports a trusted merchant record only when it is bound to the same organization, brand, exact route path, surface, expanded zone, effective policy version, and reference state/version. `pin` and `lock` win before engine output; `authored` content is considered after valid engine output. That precedence is mechanically tested through server-injected records. Runtime merchant storage is not enabled by this repository: it contains no compatible schema migration or write path. Database reads stay off unless an operator separately provisions the route-bound columns and sets `AISLES_ZONE_CONTENT_SCHEMA_VERSION=route-bound-v1`; legacy, unavailable, or ordinary unbound admin data cannot become authority.

The decision cache stores the validated content and provenance envelope, not a raw layout. Its key and hit validation cover organization and brand policy versions, route ID and path, surface, expanded zone, effective policy, preset, decision and publication modes, capabilities, reference state/ID/version, viewport class, catalog and content versions, synthetic provenance, and approved-input hash. A mismatch is a miss; a hit returns the stored provenance unchanged.

Run `npm test` for all TypeScript tests, or `npm run test:contracts` for the focused policy and renderer gates. Run `npm run capture:runtime-parity` for browser evidence. The harness checks out pinned main `71e8750f9070fb788816f0464355f46ab63fb272`, adds a recorded test-only adapter for the same deterministic catalog data used by the candidate, and captures 10 shopper/error routes × 3 brands × 3 viewports (390×844, 768×1024, 1280×900). It records screenshots, unmasked pixel diffs, explicit DOM/component/token comparisons, commerce metadata, active brand, and actual zone terminals. The baseline remains the pinned main production implementation apart from that disclosed fixture adapter. Operator, merchant-review, and development routes are excluded because their audience contracts are not shopper claims.

The browser result is an internal regression comparison, not external preservation. Any pixel delta remains a human-review gate; the harness has no masks or self-approval threshold. Every brand still has `reference.state: uncontracted`. No pinned external source, reference hash, or reviewed external visual gate exists in this repository.

The three brands in this fork demonstrate the breadth of the system, including the storefront vs. content mode split:

| Brand | Domain | Mode | BC Channel | Vercel Project |
|---|---|---|---|---|
| bealls | Off-price family apparel, home, gifts | storefront | Channel 1846324 | `aisles-demo-1` |
| Bealls Florida | Coastal apparel and lifestyle | storefront | Channel 1846321 | `aisles-demo-2` |
| Home Centric | Home decor (in-store discovery) | content | n/a (content set) | `aisles-demo-3` |

---

## How Brand Selection Works

At runtime, `getBrand()` in `src/lib/brand/config.ts` reads the environment:

```typescript
const configuredBrandId =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BRAND_ID) ||
  (typeof process !== 'undefined' ? process.env?.BRAND_ID : undefined);

return resolveBrandId(configuredBrandId);
```

- **Vercel Functions (server-side)**: reads `BRAND_ID`
- **Vite/client-side**: reads `VITE_BRAND_ID` (must be prefixed for Vite to expose it)
- **Node scripts** (enrichment, seeding): reads `BRAND_ID` from `process.env`

Only a missing or empty brand configuration defaults to `bealls`. Any non-empty unknown or prototype-derived ID throws `UnknownBrandConfigurationError`; it never inherits Bealls identity.

---

## The BrandConfig Interface

Every brand is defined by this TypeScript interface in `src/lib/brand/config.ts`:

```typescript
interface BrandConfig {
  organizationId: string; // Stable owning organization; metadata only in this implementation
  id: string;          // Machine identifier, matches the BRAND_ID value
  name: string;        // Display name ("bealls", "Bealls Florida", "Home Centric")
  tagline: string;     // Short tagline shown in the nav and footer
  domain: string;      // Product domain label
  footerNote: string;  // Footer attribution line

  mode?: 'storefront' | 'content'; // Default 'storefront'. See ADR-005.

  bc: {
    channelId: number;      // BigCommerce channel ID (unused in content mode)
    categoryPrefix: string; // Prefix to filter BC categories by brand
  };

  categories: Record<string, {
    bcName: string;      // Exact BC category name to query (or content-pillar key)
    displayName: string; // Human-readable display name
  }>;

  theme: {
    primary: string;       // CSS hex — primary accent color
    secondary: string;     // CSS hex — hover/pressed states
    accent: string;        // CSS hex — secondary accent
    surfaceBg: string;     // CSS hex — page background
    surfaceFg: string;     // CSS hex — primary text
    surfaceCard: string;   // CSS hex — card background
    surfaceCardFg: string; // CSS hex — card text
    surfaceMuted: string;  // CSS hex — muted surface
    surfaceMutedFg: string;// CSS hex — muted text
    surfaceBorder: string; // CSS hex — border color
    fontDisplay: string;   // CSS font-family string for headings
    fontBody: string;      // CSS font-family string for body text
    fontMono: string;      // CSS font-family string for monospace
  };

  googleFontsUrl: string;  // Full Google Fonts @import URL

  prompt: {
    storeName: string;          // Used in LLM prompts
    storeDescription: string;   // Brand description injected into prompts
    productDomain: string;      // e.g., "off-price family apparel", "coastal apparel"
    personaDefinitions: Record<'gatherer'|'hunter'|'researcher'|'gifter', string>;
    voiceGuidance: string;      // Writing style instructions for the AI
  };
}
```

The `theme` object is injected as CSS custom properties on `:root` at page load, so shared components can consume the current brand's colors and fonts. Tokens do not represent a complete design contract and do not remove the need for merchant-native component or recipe work when integrating an unrelated storefront.

The `prompt` fields supply brand context to model-backed paths that explicitly consume them. They do not grant model authority. The compiled route and zone policy remains the publication boundary.

The `mode` field selects between transactional storefront mode and content/locator mode, which drive different component vocabularies.

---

## How to Add a Related Brand

Use this setup for a brand that belongs to the same organization and can use the approved shared implementation. Do not use it as an external-merchant preservation recipe; follow the canonical Aisles reference-contract/autonomy direction when that work begins.

The runtime is currently closed to `bealls`, `beallsflorida`, and `homecentric`. Adding `BrandConfig` alone intentionally fails closed. A related brand is executable only after it receives its own policy, route availability, renderer contract, and parity coverage.

### Step 1: Create the BigCommerce Channel (storefront mode only)

For content-mode brands, skip this step — there is no BC channel; content is hand-authored in `brands/{brand}-content.json` per ADR-005.

For storefront-mode brands:

1. In the BigCommerce control panel, go to **Channel Manager** and create a new channel
2. Note the channel ID (visible in the URL when you open the channel settings)
3. Create the category structure under this channel. Categories must be named with a brand prefix that matches what you'll set in `categoryPrefix` (e.g., `Newbrand Women`, `Newbrand Home`)
4. Generate a Storefront API token for this channel (Storefront API tokens are channel-specific)
5. Add products to the channel's categories

### Step 2: Add Brand Identity Files

Copy one of the existing brand JSON files in `brands/` as a reference:

```
brands/newbrand.json
```

The brand JSON captures the extended identity — persona audiences, color system, typography scale, voice guidelines, creative brief. It is not currently consumed at runtime (the `src/lib/brand/config.ts` values are), but serves as the source of truth for the brand design system and can be used for brand validation tooling.

### Step 3: Add the Brand Config

Open `src/lib/brand/config.ts` and add a new entry to the `BRANDS` object:

```typescript
const BRANDS: Record<string, BrandConfig> = {
  // ... existing brands ...

  newbrand: {
    organizationId: 'example-merchant',
    id: 'newbrand',
    name: 'New Brand',
    tagline: 'Your brand tagline here',
    domain: 'your product domain',
    footerNote: 'New Brand is a demo storefront powered by Aisles',

    mode: 'storefront', // or 'content' — see ADR-005

    bc: {
      channelId: 1234567,   // Your BC channel ID
      categoryPrefix: 'Newbrand',
    },

    categories: {
      'category-slug': { bcName: 'Newbrand Category Name', displayName: 'Category Name' },
      // Add one entry per category the brand will display
    },

    theme: {
      primary: '#hex',
      secondary: '#hex',
      accent: '#hex',
      surfaceBg: '#hex',
      surfaceFg: '#hex',
      surfaceCard: '#hex',
      surfaceCardFg: '#hex',
      surfaceMuted: '#hex',
      surfaceMutedFg: '#hex',
      surfaceBorder: '#hex',
      fontDisplay: "'Font Name', fallback, generic",
      fontBody: "'Font Name', system-ui, sans-serif",
      fontMono: "'JetBrains Mono', Menlo, monospace",
    },

    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=...',

    prompt: {
      storeName: 'New Brand',
      storeDescription: 'a [description] — [adjectives], [values]',
      productDomain: 'your products',
      personaDefinitions: {
        gatherer: 'What does browsing look like for this product domain?',
        hunter: 'What does goal-oriented shopping look like here?',
        researcher: 'What does deep-dive comparison look like here?',
        gifter: 'What does gift shopping look like for this domain?',
      },
      voiceGuidance: 'Describe the writing tone, what to lead with, what to avoid.',
    },
  },
};
```

**Persona definitions matter.** The AI uses these verbatim when building layout prompts. Write them as behavior descriptions, not character sketches. Reference the existing brands for calibration:

- bealls hunter: focused on comparable-value pricing, clear sale grammar, fast scan of price-rail merchandising
- Bealls Florida gatherer: coastal lifestyle, vacation-imagery-driven, "Florida is a feeling" aspirational tone
- Home Centric gifter: editorial home-decor inspiration, store-locator-led intent (no online checkout)

**Voice guidance matters equally.** This is the single line that most shapes AI copy quality. Be prescriptive about what to lead with and what to avoid.

### Step 4: Add executable policy and renderer contracts

Add the exact brand ID to the closed family registry, then add a separate child policy under `example-merchant`. Declare route availability, every applicable zone override, mounted/exposed state, the renderer contract, source fingerprint, and brand-specific fixture expectations. A child policy may narrow organization authority but cannot expand it. Keep `reference.state: uncontracted` unless a real external reference and reviewed visual gate exist.

Run `npm test`, `npm run check`, and `npm run capture:runtime-parity`. Do not configure or deploy the brand until its routes, all applicable expanded zones, active-brand marker, cache identity, and Hidden/fallback terminals pass.

### Step 5: Run the Enrichment Pipeline (storefront mode only)

Content-mode brands use hand-authored persona-fit values per ADR-005 and skip this step.

For storefront-mode brands, enrichment is channel-specific. Set the environment variables for the new channel and run:

```bash
BRAND_ID=newbrand \
BIGCOMMERCE_STORE_HASH=your_store_hash \
STOREFRONT_TOKEN=your_channel_token \
BIGCOMMERCE_CHANNEL_ID=1234567 \
DATABASE_URL=your_neon_url \
ANTHROPIC_API_KEY=your_key \
OPENROUTER_API_KEY=your_key \
npx tsx src/lib/server/enrichment/enrich.ts
```

This scores all products in the channel for persona-fit and generates semantic tags. Layout generation will work without enrichment, but products will appear in default BigCommerce order and receive no persona-aware sorting.

### Step 6: Create a Vercel Project

1. In the Vercel dashboard, create a new project connected to the same Git repository
2. Set the root directory to the repository root (not a subdirectory — this is a single-app repo)
3. Set the following environment variables:

**Required**

| Variable | Value |
|---|---|
| `BRAND_ID` | `newbrand` |
| `VITE_BRAND_ID` | `newbrand` |
| `BIGCOMMERCE_STORE_HASH` | Your BC store hash |
| `STOREFRONT_TOKEN` | Channel-specific storefront token |
| `BIGCOMMERCE_CHANNEL_ID` | Your BC channel ID |
| `KV_REST_API_URL` | Upstash Redis REST URL |
| `KV_REST_API_TOKEN` | Upstash Redis REST token |
| `DATABASE_URL` | Neon Postgres connection string |
| `POSTGRES_URL` | Same as DATABASE_URL (alternative env name) |
| `AISLES_ROUTE_BINDING_SECRET` | At least 32 random characters; required for signed model-zone route grants |
| `AISLES_ZONE_CONTENT_SCHEMA_VERSION` | Optional explicit attestation for a separately provisioned `route-bound-v1` merchant-zone read schema; absent by default |

**For AI generation** (via Vercel AI Gateway — set automatically if using the Vercel AI Gateway integration):

| Variable | Value |
|---|---|
| `AI_GATEWAY_URL` | Vercel AI Gateway endpoint |
| `AI_GATEWAY_TOKEN` | Vercel AI Gateway token |

4. Deployment remains a separate operator authorization after the local contract and human visual gates pass. This guide does not authorize a deploy.

The legacy whole-layout warmers are not compatible with signed, route-bound zone decisions. Do not use them as a way around the page-issued route grant. A future warmer must mint server-trusted route context and cache complete validated decision envelopes.

---

## Category Mapping

The `categories` field in the brand config maps URL slugs to BigCommerce category names:

```typescript
categories: {
  'women': { bcName: 'Bealls Women', displayName: 'Women' },
  'home':  { bcName: 'Bealls Home',  displayName: 'Home' },
}
```

- **Key** (e.g., `women`): the URL slug used in `/category/[slug]` routes
- **`bcName`**: the exact `name` of the category in BigCommerce (case-sensitive)
- **`displayName`**: shown in the storefront navigation and page titles

If a slug in the URL does not match any key in the `categories` map, the category page returns a 404. If the `bcName` does not match any category in BigCommerce, the category page also returns a 404.

For content-mode brands the `categories` map keys identify content pillars rather than catalog routes (see ADR-005).

---

## BigCommerce Multi-Channel Configuration

Each storefront-mode brand requires its own BC channel to isolate product catalogs and storefront tokens. Content-mode brands (e.g., Home Centric) do not use a BC channel.

**Channel types**: Use the "Storefront" channel type (not a headless channel) for full GraphQL Storefront API support.

**Storefront tokens**: Generate a token scoped to the channel in **Settings > API Accounts > Storefront API Tokens**. Each channel's token only works for that channel's GraphQL endpoint.

**GraphQL endpoint**: The endpoint URL depends on the channel ID:
- Channel 1 (default): `https://store-{STORE_HASH}.mybigcommerce.com/graphql`
- Other channels: `https://store-{STORE_HASH}-{CHANNEL_ID}.mybigcommerce.com/graphql`

The enrichment script (`enrich.ts`) handles this automatically based on `BIGCOMMERCE_CHANNEL_ID`.

**Category trees**: BigCommerce channels share the global product catalog but can have independent category trees. Create a channel-specific category tree in **Products > Categories**, filter by channel, and assign products to the new tree.

---

## Brand Visual Identity

Theme tokens are injected into `:root` as CSS custom properties. The page layout reads these via `var(--...)`. This is sufficient for the current related-brand implementation where approved shared components already support the needed variants. It is not a promise that an external merchant needs no brand-native CSS, components, recipes, or responsive behavior.

The Google Fonts URL is injected as a `<link rel="stylesheet">` in the document `<head>`. Include all weights used by the theme fonts. JetBrains Mono is used as a monospace fallback and should always be available.

For dark-background or high-contrast brands, ensure surface tokens provide sufficient contrast:
- `surfaceBg` + `surfaceFg` contrast ratio should meet WCAG AA (4.5:1 for body text)
- `surfaceCard` + `surfaceCardFg` contrast ratio should meet WCAG AA
- `surfaceMuted` + `surfaceMutedFg` is typically relaxed (large text / secondary context)

---

## Shared Infrastructure

Brands may share Upstash Redis and Neon Postgres infrastructure, but decision authority cannot share an unscoped key. Zone decisions use `aisles:zone-decision:v1:{organization}:{brand}:{expanded-zone}:{full-context-digest}` and revalidate the complete context on every hit. Session keys remain session-scoped. Enrichment records and other legacy data paths have their own schemas and are not evidence of a reusable cross-brand decision.

Separate infrastructure remains an operational option, not a substitute for runtime brand and policy binding.
