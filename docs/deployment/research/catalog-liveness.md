# Aisles catalog data — liveness verdict, data contract, and the mock path

Investigation target: `/Users/nino/Workspace/dev/wip/bealls-aisles` (read-only; no files modified).
Date: 2026-07-30.

---

## 1. Verdict, up front

**BigCommerce is alive. The premise that the catalog is dead is wrong.** Credentials resolve, both storefront tokens authenticate, both channels are `LAUNCHED`, product images serve publicly from the BC CDN, and the Neon Postgres enrichment table has 2,177 rows.

Exactly one thing is broken, and it is not a credentials problem:

| Brand | Status | Detail |
|---|---|---|
| **bealls** | **Healthy** | Channel 1846324, 8 categories, **1,449 products**, **100% enrichment coverage** (1,449/1,449), images live. One cosmetic gap: `Bealls Accessories` (id 281) has 0 products, so `/category/accessories` falls to the rescue layout. |
| **beallsflorida** | **Broken — content, not credentials** | Channel 1846321 authenticates fine, but its category tree was **repurposed for an unrelated "Particle" skincare demo**. All 8 `BeallsFlorida *` categories the brand config expects are gone; the channel now serves 25 Particle products with **0 enrichment rows**. |
| **homecentric** | **Healthy by design** | `mode: 'content'`, `channelId: 0`. `loadHomeProducts` short-circuits to `{ products: [], categoryName: 'Home' }` (`catalog.ts:140`). Needs no catalog and no storefront token. |

**And the recovery is cheap.** All 728 Bealls Florida products **still exist in the store** — entityIds 2188–2915, with names, prices, `is_visible: true`, and **728/728 carrying at least one image** (verified across the full range). They have been **unhooked in two places**: zero category assignments, and zero channel assignments. Their entityIds match the 728 orphaned `beallsflorida.com` enrichment rows **exactly**, so re-hooking them restores persona-fit scores and semantic tags for free — no re-enrichment, no LLM spend.

**Recommendation: fix the BigCommerce data (Path A, ~2–4 h). Do not build a mock catalog as the primary plan.** The mock design is specified in full in §5 as Path B, because it was scoped and because it is real insurance against a future where the sandbox store disappears — but building it now would be solving a problem that the evidence disproves.

---

## 2. What I verified (with command output)

### 2.1 The 1Password item exists and is complete

`op item list --vault "Developer Secrets"` → 110 items; `BigCommerce bealls-aisles` present (created 2026-05-23, edited 2026-06-10). All seven fields populated:

```
access_token: <present, len=31>          client_secret: <present, len=64>
channel_id: <present, len=1>             store_hash: <present, len=10>
client_id: <present, len=31>             storefront_token_bealls: <present, len=439>
                                         storefront_token_beallsflorida: <present, len=439>
```

### 2.2 Tokens are valid until 2027-04-27

Decoded JWT claims (no token values printed):

```
storefront_token_bealls         cid=[1846324]  iat=1777646293  eat=1809182292  alg=ES256
storefront_token_beallsflorida  cid=[1846321]  iat=1777646293  eat=1809182292  (same sub/store)
cors: ["http://localhost:5173", "https://aisles-demo-{1,2}-signal-x-studio-labs.vercel.app"]
```

`eat` 1809182292 = 2027-04-27. Not expired.

### 2.3 The 1Password `channel_id` field is stale and matches nothing

`channel_id` reads `1`. Hitting `store-<hash>.mybigcommerce.com/graphql` (the default-channel URL) returns:

```
HTTP 401
{"errors":[{"message":"GraphQL invalid credentials. JWT channel id doesn't match channel id of the URL"}]}
```

This is harmless in practice — `bigcommerce.ts:22` reads `brand.bc.channelId` from `src/lib/brand/config.ts`, not from the env var. The only consumer of `BIGCOMMERCE_CHANNEL_ID` is `src/lib/server/enrichment/enrich.ts:99`, which defaults it to `'1'` — a latent bug in the offline enrichment script, not the storefront.

### 2.4 Live Storefront GraphQL, correct channels

**bealls — channel 1846324:**

```
HTTP 200   storeName: Default   status: LAUNCHED
top-level categories: 8
  - Bealls Women (274), Bealls Men (275), Bealls Kids (276), Bealls Shoes (277),
    Bealls Home (278), Bealls Beauty (279), Bealls Handbags (280), Bealls Accessories (281)
TOTAL PRODUCTS (paginated): 1449
  Bealls Women 322 | Bealls Men 188 | Bealls Shoes 188 | Bealls Home 188
  Bealls Beauty 188 | Bealls Handbags 188 | Bealls Kids 187 | Bealls Accessories 0
products with defaultImage: 50/50 in the sampled page
sample: entityId 739 "Women's Solid Top" $9.99, image on cdn11.bigcommerce.com
customFields: [] on every sampled product
```

**beallsflorida — channel 1846321:**

```
HTTP 200   storeName: Default   status: LAUNCHED
top-level categories: 5
  - Particle Face (312), Particle Body (313), Particle Fragrance (314),
    Particle Hair (315), Particle Wellness (316)
TOTAL PRODUCTS: 25
  Particle Face 8 | Particle Body 5 | Particle Wellness 5 | Particle Hair 4 | Particle Fragrance 3
sample: entityId 2998 "Particle Face Cream" $69.00
```

None of the eight `BeallsFlorida *` category names in `config.ts:203-212` exist. Every `/category/{slug}` on that brand resolves to `null` at `catalog.ts:99` and falls to the rescue layout; the home page renders 25 skincare products under a coastal-apparel brand identity.

### 2.5 The store itself, via Management API

Channels (`GET /v3/channels`):

```
id=      1  active      storefront  bigcommerce  Demo
id=1846321  active      storefront  custom       Bealls Florida
id=1846324  active      storefront  custom       bealls
(+ 3 terminated, 3 prelaunch/connected Catalyst channels)
```

Category trees (`GET /v3/catalog/trees`):

```
{"id": 5, "name": "Bealls Florida Catalog", "channels": [1846321]}   → now holds 5 Particle categories
{"id": 6, "name": "bealls Catalog",         "channels": [1846324]}   → 8 Bealls categories, intact
```

So the channel and its tree are correctly wired. **Someone emptied tree 5 of the Bealls Florida categories and loaded a Particle demo into it.** There is no other channel holding a Bealls Florida catalog — a `channelId` config change would not fix this.

### 2.6 The 728 Bealls Florida products were never deleted

```
total products in store: 2335
products with id in 2188–2915: 728, ALL with categories: []
  2188 "Women's Stretch Poplin Bermuda Shorts"   custom_url /women-s-stretch-poplin-bermuda-shorts/  brand_id 44
  2189 "Women's Sleeveless Wrap Dress with Overlay"
  2190 "Women's 3/4 Sleeve UPF Dress"
  2191 "Juniors Beach Open Weave Sweater"
  2192 "Women's Pull-On Cat Eye Pocket Shorts"
  2588 "Hydrangea Heather Wreath"  price 34.99  is_visible true  images: 1 (cdn11...products/2588/images/2655/...)
```

Image coverage, counted over every product in both ranges with `include=images`:

```
BF range 2188–2915:      728 products, 728 with >=1 image (100%)
bealls range 739–2187:  1449 products, 1449 with >=1 image (100%)
```

### 2.7 Both the category link *and* the channel link were severed

`GET /v3/catalog/products/{id}/channel-assignments` is not a real endpoint — it returns `HTTP 404 Not Found` for every product, including working ones. The store-wide endpoint is what answers the question:

```
GET /v3/catalog/products/channel-assignments   → HTTP 200, total 1607
assignments per channel: {1846324: 1449, 1853406: 49, 1: 49, 1846321: 25, 1857860: 18, 1854685: 17}
bealls-range (739–2187) assignments: {1846324: 1449}   ← all 1449, explicitly assigned
BF-range   (2188–2915) assignments: {}                 ← zero, on every channel
```

So per-product channel assignment **is** an operative gate here, alongside category membership: every one of the 1,449 working bealls products is explicitly assigned to channel 1846324, and channel 1846321 holds exactly the 25 Particle assignments. The 728 BF products are assigned to nothing. **Restoring them requires both a category assignment and a channel assignment** — a category-only fix would not bring them back. This corrects an earlier reading of a `null` response body that was actually a 404.

### 2.8 BC CDN images are public — no auth needed

```
curl https://cdn11.bigcommerce.com/s-cdfqf9k6zf/.../107-2519-0810-01-yyy-jpg__63013...jpg
HTTP 200  bytes=55555  type=image/jpeg
```

### 2.9 Neon Postgres enrichment is live and healthy

`op read op://Developer Secrets/Postgres bealls-aisles/database_url` → resolves; host `ep-green-cloud-anydrsfk-pooler.c-6.us-east-1.aws.neon.tech`.

```
enriched_products: 2177 rows, 2177 distinct bc_entity_id, entityId range 739–2915
  bealls.com paths:        1449 rows (ids 739–2187)  → 1449/1449 live bealls products covered
  beallsflorida.com paths:  728 rows (ids 2188–2915) → 0/25 live Particle products covered
enrichment_model: anthropic/claude-haiku-4.5, all rows, last run 2026-04-30
rows with embedding: 0
distinct semantic tags: 6093
top tags: resort wear 263 | gift-worthy 198 | budget-friendly 160 | summer essentials 133 | vacation outfit 118
sample row: 2588 | .../hydrangea-heather-wreath-p00009159255/ | mid | g .72 h .15 r .28 gi .88 | 8 tags
tables: app_users, brand_overrides, enriched_products, generation_logs,
        merchandising_rules, persona_fit_overrides, workspaces, zone_content, zone_retrieval_logs
```

Two consequences worth naming:

- **`embedding` is NULL on all 2,177 rows.** `vectorSearch` (`search.ts:42`) always returns `[]` and falls through to `tagSearch`. Vector search has never had data.
- **Schema drift:** `enriched_products` has `embedding vector(1536)` and `compatible_with text[]` live in the DB, but `src/lib/server/enrichment/schema.sql` has `embedding` commented out (line 30) and no `compatible_with` at all. `query.ts:99` selects `compatible_with`. Anyone bootstrapping a fresh DB from `schema.sql` gets a broken app.

---

## 3. The data contract any mock must satisfy

### 3.1 `BCProduct` — the wire shape (`bigcommerce.ts:100-124`)

Every catalog query returns this via `PRODUCT_FRAGMENT`:

```ts
{ entityId: number; name: string; sku: string; path: string; description: string;
  prices: { price: {value, currencyCode}; salePrice: {value, currencyCode} | null };
  defaultImage: { url: string; altText: string } | null;      // url(width:800,height:800)
  customFields: { edges: [{ node: { name, value } }] };        // first:10 — empty in live data
  categories:   { edges: [{ node: { entityId, name, path } }] } // first:5
}
```

### 3.2 `Product` — the app shape (`src/lib/types.ts:2-22`)

Produced by `transformProduct`. Note the id derivation: **`id` is the URL slug, not the entityId** (`catalog.ts:270`).

```ts
{ id: string;            // path stripped of slashes → the /product/[slug] route param
  entityId: number;      // the enrichment join key
  name, price, salePrice?, image, imageAlt, description: string/number;
  specs: Record<string,string>;   // customFieldsToRecord(p) — {} in live data
  tags: string[];                 // Object.values(specs).slice(0,3) — [] in live data
  category: string;               // first category name
  brand?, rating?, reviewCount?, badges?: optional renderer extras }
```

`transformProduct` is **duplicated three times** — `catalog.ts:266`, `product/[slug]/+page.server.ts:328`, `search/+page.server.ts:93`. Any mock must satisfy all three call paths, or they must be consolidated first.

### 3.3 `EnrichedProduct` — what layouts and ranking consume (`catalog.ts:29-32`)

```ts
interface EnrichedProduct extends Product {
  personaFit: { gatherer, hunter, researcher, gifter } | null;   // 0.0–1.0 each
  semanticTags: string[];
}
```

`TagOverlapProduct` adds `overlapScore: number` and `sharedTags: string[]` — the Decisions Inspector renders "shown because tags X, Y, Z overlap" verbatim (ADR-008), so these are load-bearing, not decorative.

### 3.4 `PromptProduct` — what the layout prompt actually sends (`layout-prompt.ts:367-375`)

```ts
{ id, name, price, salePrice?, image?, specs, personaFit? }
```

Rendered per product as:
`- ID: "{id}" | {name} | ${price} | {≤3 specs} | {persona}-fit: NN% | image: "{url}"`

Prompt rules that constrain mock content (`layout-prompt.ts:298-302, 481`):

- Products arrive **pre-sorted by persona fit**; the AI is told to respect that order.
- **Every product must appear in at least one section** — so an oversupplied pool produces bloated layouts. `MAX_LAYOUT_PRODUCTS = 15` caps what reaches the prompt (`layout-prompt.ts:446`).
- **Image URLs are whitelisted to the product set.** `category-tile-grid`, `editorial-hero`, `lifestyle-price-hero`, and `price-rail` tiles must reuse an exact product `image` URL — "never invent image hosts (no images.bealls.com, no unsplash, no stock.adobe)". A mock with broken or missing `image` values silently degrades every editorial block.
- `specs` feeds the researcher/hunter personas' "show specs inline" directives. **Live BC data has empty `customFields`, so `specs` and `tags` are already empty in production** — the mock does not need to beat reality here, but populating `specs` would actually make researcher layouts richer than the live store.

### 3.5 Category contract

`loadCategoryProducts` (`catalog.ts:94-99`) needs `getCategories()` to return an entry whose **`name` exactly equals** `brand.categories[slug].bcName`. Miss → `null` → rescue layout. Category tree shape: `{ entityId, name, path, children: [{entityId, name, path}] }`.

### 3.6 The paths that bypass `catalog.ts` entirely

This is the design-critical finding. `catalog.ts` is **not** the only seam:

| Consumer | Imports directly from `bigcommerce.ts` |
|---|---|
| `src/routes/product/[slug]/+page.server.ts:2` | `getProductByPath`, `customFieldsToRecord` |
| `src/routes/search/+page.server.ts:2` | `getProducts`, `customFieldsToRecord` |
| `src/routes/api/cart/+server.ts:3-9` | `createCart`, `addToCart`, `getCart`, `updateCartLineItem`, `deleteCartLineItem` |
| `src/routes/cart/+page.server.ts` | `getCart` |
| `src/routes/checkout/+page.server.ts` | `getCheckoutRedirectUrl` |

And two consumers bypass BigCommerce **and** `catalog.ts`, hitting Postgres directly:

| Consumer | Query |
|---|---|
| `search.ts:31` (`searchProducts`) | `SELECT ... FROM enriched_products` — vector, then ILIKE over `bc_product_path`, `material`, `style`, `use_case`, `semantic_tags` |
| `query.ts:198` (`getProductsByTagOverlap`) | `WHERE semantic_tags && $seedTags` + GIN index, feeding PDP cross-sell/related and cart upsell |

**Consequence for the mock:** persona-fit baked into TypeScript fixtures satisfies the home/PLP/layout path (`catalog.ts:108-115` merges `enrichment?.personaFit ?? null`, and `applyPersonaFitOverrides` falls back to 0.5 across the board). It does **not** satisfy `/search` or PDP related-products, which read Postgres columns directly. A fixtures-only mock leaves search returning text-match-only results and PDP cross-sell empty, unless the mock also inserts rows into `enriched_products`.

---

## 4. Verdict on `src/lib/server/mock-data.ts`

**Genuinely dead, stale, and wrong-brand. Delete it; do not adapt it.**

- **Unused:** `grep -rn "mock-data\|mockProducts"` across the whole repo (excluding node_modules) returns exactly one hit — its own export at line 19. Zero importers.
- **Incompatible shape:** it declares its **own local** `Product` interface (lines 1–17) that shadows `$lib/types.ts`. It embeds `personaFit` inside `Product` (the real contract keeps it on `EnrichedProduct`), and it is missing `entityId` and `imageAlt`. `entityId` is the enrichment join key and the cart line-item key — a fixture without it cannot participate in the real pipeline.
- **Wrong content:** 15 furniture SKUs (sectionals, walnut coffee tables, dorm desks) with `category: 'living-room' | 'office'` — Haven-era, not any of the three Bealls brands.
- **Dead image paths:** `/products/sectional-placeholder.svg` etc. **There is no `static/` directory in this repo.** Every one of those URLs 404s.
- **Same vintage as three other dead scripts:** `scripts/setup-catalog.mjs`, `scripts/fetch-images.mjs`, and `scripts/assign-images.ts` all say "Haven Demo Store" in their headers and target furniture SKU ids 375–392. They are leftovers from the same era.

Leaving it in place is an active hazard: it is exactly what a future reader (human or agent) finds when grepping for "mock" or "fallback" and reasonably assumes is the wired fallback path.

---

## 5. Implementation plan

### Path A — Restore Bealls Florida in BigCommerce (recommended, do this first)

Why this wins: the products, prices, and images already exist; the entityIds already match 728 enrichment rows, so persona-fit and semantic tags come back for free. Nothing in the app changes.

**Blocking decision the operator must make:** tree 5 currently hosts an active Particle demo. Two options:

- **A1 — reclaim tree 5.** Delete/hide the 5 Particle categories, recreate the 8 BF categories, assign the 728 products to categories and to channel 1846321. Cheapest, and the existing token keeps working — but it breaks whoever is using the Particle demo on that channel.
- **A2 — new tree + new channel for Bealls Florida.** Create a tree and channel, assign products to both, then update `config.ts:199` `channelId` and `scripts/bc-tokens.config.mjs:43`, and run `node scripts/regen-storefront-tokens.mjs` (already exists, reads the canonical CORS config, writes `.env` in place). Leaves Particle alone.

**A2 is the safer default** unless it is confirmed that nothing depends on the Particle demo.

Steps:

0. **Prove the mechanism on one product before scripting 728.** Take product 2588, create one category in the target tree, assign it, assign the product to the channel, then re-run the storefront GraphQL query for that channel and confirm it appears. §2.7 establishes that both links were severed, but only a write proves both are sufficient. Ten minutes; it de-risks the whole path.
1. New script `scripts/restore-beallsflorida-catalog.mjs`. **Lift** the API wrapper + 429 rate-limit retry from `setup-catalog.mjs:22-45` into the new script first — it is the only reusable part of that file, and step 6 deletes it.
   - Create the 8 categories from `config.ts:203-212` in the target tree: `BeallsFlorida Women / Men / Kids / Shoes / Home / Vacation / Swim & Beach / Accessories`.
   - Assign each product in `2188 <= id <= 2915` to a category (`PUT /v3/catalog/products/{id}`, or the bulk category-assignment endpoint).
   - **Assign all 728 to the channel** — `PUT /v3/catalog/products/channel-assignments` with `[{product_id, channel_id}]`. Per §2.7 this is a separate, required step; skipping it leaves the products categorized but invisible.
   - **Mapping heuristic** — no saved manifest of the original assignment exists (`BeallsFlorida` appears only in `config.ts`). Derive from product name plus the enrichment row's `use_case`/`style`/`semantic_tags`, already in Postgres for all 728: `Women's|Juniors|Ladies` → Women; `Men's|Mens` → Men; `Boys|Girls|Kids|Toddler` → Kids; `Sandal|Shoe|Sneaker|Flip` → Shoes; swim/cover-up/beach tags → Swim & Beach; resort/vacation tags → Vacation; wreath/decor/kitchen → Home; remainder → Accessories. Spot-check ~30 by hand; an off-by-one category on a demo SKU costs nothing.
2. **A2 only** — write the regenerated storefront token back to 1Password. The shell exports `OP_SERVICE_ACCOUNT_TOKEN`, which is read-only on `Developer Secrets`; a bare `op item edit` fails with a generic "Couldn't update the item." Use the user-account form, then `op read` the field back to verify:
   ```bash
   env -u OP_SERVICE_ACCOUNT_TOKEN op --account my.1password.com item edit \
     'BigCommerce bealls-aisles' --vault 'Developer Secrets' \
     'storefront_token_beallsflorida[concealed]=<token>'
   ```
3. Fix the two latent bugs found along the way: `enrich.ts:99`'s `BIGCOMMERCE_CHANNEL_ID || '1'` default, and the 1Password `channel_id` field (`1` matches neither live channel — either correct it per-brand or drop it).
4. Update `enrichment/schema.sql` to include `embedding vector(1536)` and `compatible_with text[]` so a fresh DB bootstrap matches production.
5. Verify: `BRAND_ID=beallsflorida` → home page renders coastal products with non-null persona fit; each of the 8 category slugs returns products; PDP cross-sell returns tag-overlap neighbors.
6. Delete `src/lib/server/mock-data.ts`, `scripts/setup-catalog.mjs` (after step 1 lifts its helper), `scripts/fetch-images.mjs`, `scripts/assign-images.ts`.

**Effort: 3–5 hours**, most of it in the mapping heuristic and spot-checking. No LLM spend — enrichment is untouched.

### Path B — Mock catalog provider (contingency; build only if the sandbox store is going away)

**Seam placement: `bigcommerce.ts`, not `catalog.ts`.** §3.6 is decisive — five route files import `bigcommerce.ts` directly, so a provider behind `catalog.ts` would leave PDP, search, cart, and checkout still calling BigCommerce. Put the swap at the lowest layer everything shares.

Concretely:

- Rename the current module to `src/lib/server/catalog-provider/bigcommerce.ts` (unchanged code).
- Add `src/lib/server/catalog-provider/mock.ts` exporting the **same** named functions: `getProducts`, `getProductsByCategory`, `getProductByPath`, `getProductsByEntityIds`, `getProductByEntityId`, `getCategories`, `customFieldsToRecord`, `categorySlug`, plus the cart five.
- Add `src/lib/server/catalog-provider/index.ts` that re-exports one or the other based on `env.CATALOG_SOURCE === 'mock'` (default `'bigcommerce'`), and keep `src/lib/server/bigcommerce.ts` as a one-line re-export of `index.ts` so **no call site changes**. That keeps the diff to three new files and zero route edits.
- Cart in mock mode: an in-memory `Map<cartId, CartResponse>` honoring the same `CartMutationResult` shape and returning `null` from `getCheckoutRedirectUrl` (the checkout page already handles null — `bigcommerce.ts:583-586` catches and returns null today).

**Toggle:** `CATALOG_SOURCE=mock|bigcommerce` in `.env` / `.env.example`, read via `$env/dynamic/private` like the existing config. Do **not** infer it from missing credentials — silent fallback to mock data in production is worse than a loud failure.

**Fixture volume** — sized against what the prompt and renderers actually need, not against the real store:

| Surface | Need | Sizing |
|---|---|---|
| Home | `loadHomeProducts(persona, 30)` | 30+ products spanning ≥5 categories |
| PLP | `MAX_LAYOUT_PRODUCTS = 15` after ranking; a grid should not look thin | **20–24 per category** |
| PDP tag-overlap | `minOverlap=2 limit=8` and `minOverlap=3 limit=4` | ≥8 tags per product, ≥4 shared tags within a category |
| Search | 20 results | covered by the above |

→ **bealls: 8 categories × 20 = ~160. beallsflorida: 8 × 20 = ~160. homecentric: 0** (content mode needs none). ~320 fixtures total. Below ~15/category, PLP grids and the "every product must appear" rule start producing visibly sparse layouts.

**Imagery.** No `static/` dir exists, and vendoring 320 images bloats the repo. Two viable sources, in order:

1. **Freeze the live BC CDN URLs into the fixtures.** Verified public and unauthenticated (§2.8), and image coverage is 100% on both ranges (§2.6) — so no product needs a fallback. One script run harvests real, on-brand, correctly-sized (`800x800`) product photography for all 1,449 bealls and — via the Management API, which still returns them — all 728 BF products. Zero repo weight, and it satisfies the prompt's "reuse an exact product image URL" rule. Risk: the URLs die if the sandbox store is deleted, which is the scenario this path exists for.
2. **Unsplash query URLs**, the precedent already in `config.ts` for tile and hero images. Durable, but generic — and mismatched product photography reads as broken to a demo audience faster than anything else on the page.

**Recommendation: harvest CDN URLs now while the store is alive** (`scripts/harvest-catalog-fixtures.mjs`, one run, writes JSON), and treat Unsplash as the degraded fallback for any product whose image later 404s. Harvesting is worth doing **even under Path A** — it is a cheap snapshot that makes Path B a few hours of work later instead of a rebuild.

**Persona-fit scores — the two-part answer:**

- **Yes for layouts and ranking.** `catalog.ts:108-115` merges `enrichment?.personaFit ?? null` and `applyPersonaFitOverrides` defaults missing personas to 0.5. A fixture that carries `personaFit` and `semanticTags` inline satisfies `loadHomeProducts`, `loadCategoryProducts`, `rankByTagAndPersona`, and the layout prompt with **zero DB access**. Harvest the real scores from the 2,177 existing enrichment rows — do not invent them; the tag vocabulary (6,093 tags, top: "resort wear", "gift-worthy", "budget-friendly") is what makes the refinement chat and Decisions Inspector look credible.
- **No for search and PDP related.** `search.ts` and `getProductsByTagOverlap` query `enriched_products` directly. Under fixtures-only, `/search` degrades to the text-match fallback (`search/+page.server.ts:41-45`, which does work) and **PDP cross-sell/related render empty**. To close that gap, either (a) also ship `scripts/seed-enrichment.sql` that loads the fixture scores into a local Postgres, or (b) add mock branches inside `search.ts` and `query.ts` that compute Jaccard overlap in memory over the fixture set — `tag-overlap-score.ts` is already a pure function taking candidates as an argument, so (b) is a small, clean change and is the better option.

**Effort: 1–1.5 days.** Roughly: 2 h provider seam + re-export shim; 2 h harvest script; 2 h fixture generation and trimming to ~320; 3 h mock cart + search/tag-overlap in-memory branches; 2 h verification across three brands and the PDP/cart/search surfaces.

**Explicitly out of scope for Path B as specified:** real checkout (BC Optimized Checkout handoff, `FND-010`) cannot be mocked — `/checkout` degrades to a handoff page with a null redirect. Store locator (`src/lib/server/locator/`) is independent of BigCommerce and unaffected.

---

## 6. Verified vs inferred

**Verified by running commands in this session** — 1Password item contents and field presence; JWT claims including channel IDs and 2027-04-27 expiry; the 401 channel-mismatch error on the default-channel URL; HTTP 200 + `LAUNCHED` on both channels; the 8 bealls categories and full 1,449 product count with per-category tally; the 5 Particle categories and 25 products on the BF channel; the channel list and tree→channel mapping via Management API; 728 products in the 2188–2915 range all with `categories: []`; 100% image coverage across both product ranges (728/728 and 1449/1449); product 2588's price and visibility; 2,335 total products in the store; the store-wide channel-assignment tally (1,449 on 1846324, 25 on 1846321, **0** anywhere for the BF range) and the 404 on the per-product endpoint; CDN image HTTP 200 unauthenticated; 2,177 enrichment rows with 1,449/728 path split and exact entityId-range alignment; 0 rows with embeddings; the 9-table DB schema and the live `compatible_with`/`embedding` columns; zero importers of `mock-data.ts`; the five route files importing `bigcommerce.ts` directly; three copies of `transformProduct`.

**Inferred, not proven:**

- That restoring both the category assignment and the channel assignment is *sufficient* to make the 728 products visible on the storefront. The read side is now solid — the working bealls products have exactly those two links and the BF products have neither — but only a write proves it. **Step 0 of Path A tests one product before scripting 728.**
- That the Particle categories were loaded deliberately by another demo rather than by accident. The channel is still named "Bealls Florida" and the tree is still "Bealls Florida Catalog", which reads like a repurpose-in-place. Confirm with the operator before deleting anything (hence the A1/A2 fork).
- The name→category mapping heuristic in Path A. No manifest of the original assignment survives; the heuristic is a reconstruction and will need spot-checking.
- Fixture volumes (20–24/category). Derived from `MAX_LAYOUT_PRODUCTS = 15`, the `limit: 8` tag-overlap default, and the "every product must appear" prompt rule — reasoned from the code, not measured against rendered output.
- Effort estimates.
