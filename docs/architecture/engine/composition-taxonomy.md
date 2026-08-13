# Aisles AI Composition Taxonomy

**A design taxonomy for what a bounded composition system may eventually support on an ecommerce site.**

Status: design taxonomy; executable runtime boundary updated 2026-08-13
Authors: Nino Chavez + Claude (Opus 4.7)

---

## 0. Why this document exists

We've been adding components reactively. Every demo iteration surfaced a gap, we added 1–2 new components, the schema grew to ~12. After the v3 deploy, the user observed that the AI-generated homepage skews "product display" and is missing the marketing/merchandising/service layers a real off-price ecomm site uses.

That observation isn't "we forgot a few components" — it's that **we never defined the full surface area an autonomous ecommerce agent needs to operate over**. Without that contract, every new gap is a one-off addition and the schema drifts toward whatever the last demo demanded.

This document defines the design vocabulary. It is not the shopper publication contract. The compiled brand policy, exact zone schema, and registered renderer are authoritative when this taxonomy and the running code differ.

## Scope boundary

This taxonomy describes the shared composition vocabulary used by the example merchant organization in this repository. Bealls, Bealls Florida, and Home Centric remain separate brand configurations; a valid layout from this vocabulary is not proof that it preserves an unrelated merchant's visual or interaction system.

External-reference onboarding requires a versioned reference contract, merchant-native recipes and components, and explicit autonomy limits. That future direction is owned by the canonical Aisles work and is not implemented by this taxonomy.

### Implemented runtime boundary

The taxonomy is broader than the renderer. Runtime authority comes from the compiled brand policy and the registered implementation, not from a block's presence in this document.

- Bealls and Bealls Florida have separate executable policies for home, PLP, PDP, cart, checkout, search, account, compare, Picks, locator, style guide, and rescue surfaces.
- Home Centric has home, content-category, locator, style-guide, and 404-rescue policies. Its content category is a distinct typed surface, not a PLP alias, and it has no current empty-state insertion.
- The named-zone catalog contains 28 families and 36 expanded instances. Every applicable instance is mounted and must terminate through named route execution. Exposure and materialization are separate fields; Hidden is a trusted terminal, not missing execution.
- Current model publication is limited to one cart zone and two checkout zones. Three PDP recommendation zones accept only the `pdp-tag-overlap-v1` trusted rule. All other applicable zones are fixed.
- `/api/layout` returns validated named-zone decision envelopes, never a whole layout. `/api/layout/stream` rejects whole-layout publication. Refinement and suggestion endpoints reject model work because their current zones are fixed.
- Every external-reference state remains `uncontracted`. Checks at 390, 768, and 1280 pixels are internal regression evidence only.

The executable sources are `src/lib/brand/composition-policy.ts`, `src/lib/brand/bealls-family-runtime-contract.ts`, `src/lib/server/route-zone-runtime.ts`, `src/lib/server/zone-output-runtime.ts`, and `src/lib/server/zone-decision-envelope.ts`. `npm run test:contracts` is the focused deterministic gate; `npm test` runs the full TypeScript test inventory.

### What this doc is

- The block × surface taxonomy for autonomous ecommerce composition
- The composition latitude rule (where AI composes vs inserts vs personalizes)
- The mode/state matrix (how the same surface mutates by signal)
- The original April 2026 implementation roadmap, retained as design history rather than current runtime inventory

### What this doc is NOT

- A Figma file or visual spec — those are downstream artifacts
- A component library implementation — that's what this doc enables
- A prompt — prompts are derived from the rules in §4
- An ADR — ADRs are decisions; this is a taxonomy

---

## 1. Canonical ecommerce surfaces

An autonomous agent must be able to operate over **8 canonical surface types**. Every off-price/department-store/Stencil/Shopify/headless site has these surfaces — they are the spine of online retail.

| Surface | Purpose | Cardinality | Signal-driven |
|---|---|---|---|
| **Home** | Brand front door — discovery, merchandising, capture | 1 per brand | Highest |
| **PLP** (category list) | Browse a slice of catalog | ~50 per brand | High |
| **PDP** (product detail) | Decide on one product | ~10k+ per brand | Medium |
| **Search results** | Resolve typed intent | 1 surface, infinite states | High |
| **Cart** | Pre-purchase review + upsell | 1 per session | High |
| **Checkout** | Convert (payment, fulfillment) | 1 per session | Low (don't break it) |
| **Account** | Post-purchase relationship | 1 per shopper | Medium |
| **Empty / 404 / Locator** | Rescue + brand engagement | Many | Medium |

The current repository renders Home, PLP/content category, a fixed PDP scaffold, cart, checkout handoff, search, account, compare, locator, and rescue routes. Their autonomy differs. Every applicable zone executes, but a mounted zone can be hidden and produce no shopper DOM. Consult the runtime contract instead of inferring authority from this taxonomy or a schema declaration.

---

## 2. The composition latitude principle (design target)

**Not every surface should be 100% AI-composed.** Composition latitude is a function of surface variability and conversion-criticality.

| Latitude | Surfaces | What AI does | What's fixed |
|---|---|---|---|
| **Wide** | Home, search-rescue empty state | Composes the entire view, choosing block types, order, and props | Brand chrome (header, footer, brand-strip) only |
| **Medium** | PLP, account dashboard | Composes inside a known scaffold (header zone, body zones, sidebar) | Filter rail position, page chrome, pagination |
| **Narrow** | PDP | Inserts blocks at named anchor points | Gallery, title, variant selector, add-to-cart, description, reviews — all mandatory and ordered |
| **Fixed** | Cart, checkout | Personalizes copy and chooses upsells; cannot reorder steps | Step structure, payment fields, security/compliance copy |

This is the architectural insight that drove this doc: **we've been writing prompts and schemas as if every surface had homepage-level latitude.** That's why early PDP prompts produce free-form 8-section layouts when a PDP should be ~15 fixed zones with maybe 3 AI insertion points.

### Implications for a future broader schema

The original taxonomy proposed separate layout schemas by surface:

- `HomeLayoutSchema` — wide composition, ordered sections array
- `PLPLayoutSchema` — scaffold + zones (`headerZone`, `bodyZones`, `insertions`)
- `PDPLayoutSchema` — fixed scaffold + named insertion arrays (`belowGallery`, `belowDescription`, `crossSellPosition`)
- `CartLayoutSchema` — fixed scaffold + `upsells[]`, `messageOverrides{}`
- `CheckoutLayoutSchema` — even more fixed; only `lastChanceUpsells[]`, `assuranceCopy`
- `EmptyStateLayoutSchema` — wide composition for rescue surfaces

Those broader layout schemas remain useful on gated style-guide and development surfaces. They are not shopper publication authority. The shopper runtime instead validates each named zone with `zone-schemas.ts`, then requires exact closure with `ZoneRenderer.svelte`. A valid legacy `LayoutSchema` value cannot be published to a shopper route.

---

## 3. The block catalog

Every reusable UI block, organized by category. For each block: **name** | **purpose** | **valid surfaces** | **persona affinity** | **storefront/content/both** | **priority**.

Priority levels: **P0** = ship for demo defensibility, **P1** = next logical batch, **P2** = nice-to-have / advanced.

### 3.1 Marketing & promotional blocks

These create urgency, frame value, and drive conversion lift on any merchandising surface.

| Block | Purpose | Surfaces | Persona | Mode | Priority |
|---|---|---|---|---|---|
| `promo-strip` | Thin banner (eyebrow + headline + CTA) | Home, PLP, Cart | All | both | ✅ have (P0) |
| `coupon-strip` | Offer with code reveal | Home, PLP, Cart | Hunter, Gifter | both | ✅ have (P0) |
| `event-countdown` | Time-bound event ("Memorial Day Weekend Fri–Mon") | Home, PLP | Hunter, Gatherer | both | **P0** missing |
| `flash-sale-banner` | Live countdown with sale stock signal | Home, PLP | Hunter | storefront | P1 |
| `brand-spotlight` | Featured brand callout with assets | Home, PLP | Gatherer, Researcher | storefront | **P0** missing |
| `trend-shop` | Themed seasonal collection card ("The Vacation Shop") | Home | Gatherer, Gifter | both | **P0** missing |
| `editorial-article-teaser` | Blog/lookbook teaser linking out to long-form | Home, PLP | Gatherer, Researcher | both | P1 |
| `promo-modal-overlay` | Entry-modal capture with offer | Home (entry) | All | both | P2 (UX-disruptive) |

### 3.2 Capture blocks

Ways to convert anonymous traffic to known shoppers (email, SMS, account).

| Block | Purpose | Surfaces | Persona | Mode | Priority |
|---|---|---|---|---|---|
| `email-capture-inline` | Inline signup with offer reveal | Home, PLP, Cart, Account | All | both | **P0** missing |
| `sms-capture-inline` | SMS opt-in with offer | Home | All | both | P1 |
| `account-prompt` | Soft signup nudge ("Save your picks") | Home, PDP, Cart | All | storefront | P1 |
| `referral-callout` | Refer-a-friend with credit | Account, Cart | All | storefront | P2 |

### 3.3 Service / trust blocks

The differentiators that make a department-store ecomm site feel safe and convenient.

| Block | Purpose | Surfaces | Persona | Mode | Priority |
|---|---|---|---|---|---|
| `bopis-strip` | Buy-online-pickup-in-store callout | Home, PDP, Cart | Hunter, Researcher | storefront | **P0** missing |
| `service-callouts-grid` | Cluster of icons (shipping, returns, BOPIS, rewards) | Home (footer area), PLP | All | both | **P0** missing |
| `free-shipping-meter` | Threshold-meter ("Add $12 for free shipping") | Cart, Mini-cart | All | storefront | **P1** missing |
| `returns-promise` | Returns policy snippet | PDP, Cart, Account | All | storefront | P1 |
| `trust-badges-row` | Security/compliance badges | Checkout | All | storefront | P1 |
| `locator-strip` | "Visit your nearest store" with state list | Home, Locator | All | both | **P0** missing |
| `same-day-pickup-badge` | Item-level "Pickup ready in 2 hours" | PDP, PLP grid card | Hunter | storefront | P1 |

### 3.4 Loyalty blocks

Bealls Bucks / rewards program surfaces. Already partially covered.

| Block | Purpose | Surfaces | Persona | Mode | Priority |
|---|---|---|---|---|---|
| `bealls-bucks-callout` | Earn / redeem / tier-progress preview | Home, PDP, Cart | All known | both | ✅ have (P0) |
| `bucks-balance-pill` | Current balance pill (logged-in) | Header, Account | All known | storefront | P1 |
| `bucks-earn-row-pdp` | Per-product earn preview | PDP | All known | storefront | P1 |
| `tier-status-card` | Tier card with progress and benefits | Account | All known | both | P1 |

### 3.5 Hero / merchandising surfaces

Big visual zones that anchor a page. Today our weakest area at PDP/PLP.

| Block | Purpose | Surfaces | Persona | Mode | Priority |
|---|---|---|---|---|---|
| `editorial-hero` | Full-bleed image + overlaid copy + CTA | Home, PLP | Gatherer, Gifter | both | ✅ have (P0) |
| `editorial-header` | Eyebrow + headline + body, no image | Home, PLP, Account | Gatherer, Gifter, Researcher | both | ✅ have (P0) |
| `lifestyle-price-hero` | Image + bold price overlay + CTA | Home, PLP | Hunter, Gifter | storefront | ✅ have (P0) |
| `category-header` | Title bar with sort/filter, optional banner | PLP | All | both | ✅ have (P0) |
| `dual-hero-split` | 50/50 split-screen hero (women / men) | Home | Gatherer | both | P1 |
| `triple-hero-tile` | 3-up hero (3 storylines side-by-side) | Home | Gatherer | both | P2 |

### 3.6 Product display blocks

Where the actual catalog shows up.

| Block | Purpose | Surfaces | Persona | Mode | Priority |
|---|---|---|---|---|---|
| `product-grid` | Configurable grid (cols, density, card variants) | Home, PLP, Search | All | storefront | ✅ have (P0) |
| `product-carousel` | Horizontal scroll list with arrows | Home, PLP, PDP, Cart | All | storefront | ✅ have (P0) |
| `hero-product` | One large featured product | Home, PLP | Gatherer, Gifter | storefront | ✅ have (P0) |
| `comparison-table` | Side-by-side product specs (Researcher) | PDP | Researcher | storefront | P1 |
| `bundle-builder` | "Buy together for $X" (3-product bundle) | PDP, Cart | Hunter, Gifter | storefront | P2 |
| `lookbook-shop-the-look` | Curated outfit/room with shoppable hotspots | Home, PLP | Gatherer | storefront | **P1** |

### 3.7 Personalization & cross-sell blocks

Distinct from generic carousel — these are signal-driven.

| Block | Purpose | Surfaces | Persona | Mode | Priority |
|---|---|---|---|---|---|
| `for-you-row` | "Based on your last visit" / persona-fit row | Home, Account | All known | storefront | **P0** missing |
| `also-bought-carousel` | "Customers also bought" | PDP, Cart | All | storefront | **P0** missing |
| `also-viewed-carousel` | "Customers also viewed" | PDP | Researcher, Gatherer | storefront | P1 |
| `recently-viewed` | Shopper's own recent products | Home, PLP, PDP | All known | storefront | P1 |
| `complete-the-look` | Outfit completion (apparel) / room completion (home) | PDP | Gatherer, Gifter | storefront | **P1** |
| `last-chance-cart-upsell` | "Add to your order before checkout" | Cart | All | storefront | **P0** missing |
| `back-in-stock-alert-card` | "We notified you — here's what's back" | Home (returning), Account | Hunter, Researcher | storefront | P2 |

### 3.8 Navigation blocks

Wayfinding within the site.

| Block | Purpose | Surfaces | Persona | Mode | Priority |
|---|---|---|---|---|---|
| `category-tile-grid` | Visual category nav (pillar tiles) | Home, PLP | All | both | ✅ have (P0) |
| `price-rail` | Price-tier merchandising tiles ("Under $25") | Home, PLP | Hunter, Gifter | storefront | ✅ have (P0) |
| `breadcrumb` | Trail with home / category / sub / product | PLP, PDP, Search | All | both | **P0** missing (renderer) |
| `subcat-strip` | Chip nav above grid ("Tops / Bottoms / Dresses") | PLP | All | storefront | **P0** partial |
| `mega-menu-content` | Dropdown nav content (text + image cells) | Header (all) | All | both | P1 |
| `brand-strip-cross-banner` | Cross-banner sister-site nav | Header (all, family-of-brands) | All | both | ✅ have (P0) |

### 3.9 PDP-specific blocks

Where the largest gap is. PDP is ~15 fixed zones; we have ~5.

| Block | Purpose | Surfaces | Persona | Mode | Priority |
|---|---|---|---|---|---|
| `image-gallery` | Image carousel with thumbnails + zoom | PDP | All | storefront | **P0** missing (renderer-fixed) |
| `product-title-block` | Name + price + rating + review count | PDP | All | storefront | **P0** partial |
| `variant-selector` | Size / color / config picker | PDP | All | storefront | **P0** missing |
| `stock-signal` | "Only 3 left at this price" | PDP, Cart | Hunter, Researcher | storefront | **P0** missing |
| `bopis-picker` | Find-in-store with zip lookup | PDP | All | storefront | **P0** missing |
| `add-to-cart-bar` | Sticky CTA with quantity | PDP | All | storefront | **P0** missing |
| `description-tabs` | Description / specs / materials / care | PDP | Researcher, Gatherer | storefront | **P0** missing |
| `size-guide` | Size chart + fit tips | PDP | All | storefront | P1 |
| `reviews-summary` | Avg rating + histogram + "Write a review" | PDP | Researcher | storefront | **P0** missing |
| `reviews-list` | Filterable review cards | PDP | Researcher | storefront | **P0** missing |
| `qa-list` | Customer Q&A | PDP | Researcher | storefront | P1 |
| `recently-sold-pulse` | "3 sold in last hour" | PDP | Hunter | storefront | P2 |

### 3.10 Cart & checkout blocks

Mostly fixed scaffold; AI personalizes copy and chooses upsell row contents.

| Block | Purpose | Surfaces | Persona | Mode | Priority |
|---|---|---|---|---|---|
| `cart-line-items` | Item rows with qty + variant edit | Cart | All | storefront | **P0** missing |
| `cart-summary` | Subtotal + tax + shipping + threshold meter | Cart | All | storefront | **P0** missing |
| `promo-code-entry` | Code field with apply | Cart, Checkout | All | storefront | **P0** partial |
| `express-checkout-row` | Apple Pay / PayPal / Shop Pay buttons | Cart, Checkout | All | storefront | P1 |
| `checkout-step-progress` | 3–4 step progress indicator | Checkout | All | storefront | **P0** missing |
| `order-summary-sidebar` | Sticky summary on checkout | Checkout | All | storefront | **P0** missing |
| `payment-options` | Cards / BNPL (Klarna, Afterpay) / loyalty pay | Checkout | All | storefront | **P0** partial |
| `shipping-options` | Standard / expedited / pickup options | Checkout | All | storefront | **P0** missing |
| `last-chance-upsell-row` | Final cross-sell before purchase | Cart, Checkout (top) | All | storefront | **P0** missing |
| `gift-options` | Gift wrap / message / receipt-hide | Cart, Checkout | Gifter | storefront | P1 |
| `assurance-strip-checkout` | "Secure / Free returns / 24/7 support" | Checkout | All | storefront | P1 |

### 3.11 Social proof & UGC blocks

| Block | Purpose | Surfaces | Persona | Mode | Priority |
|---|---|---|---|---|---|
| `ugc-gallery` | Customer photos / Instagram embed | Home, PDP | Gatherer | storefront | P1 |
| `review-highlight-quote` | One pulled-quote review | PDP, Home | Researcher, Gatherer | storefront | P1 |
| `recently-purchased-feed` | Live feed of recent purchases (anonymized) | Home | Hunter | storefront | P2 |

### 3.12 Search & rescue blocks

| Block | Purpose | Surfaces | Persona | Mode | Priority |
|---|---|---|---|---|---|
| `search-input-with-suggest` | Type-ahead search box | Header, Search | All | both | **P0** partial |
| `search-zero-state-rescue` | "No results — try these" with alt suggestions | Search empty | All | both | **P1** missing |
| `404-rescue` | "We can't find that page — here's where to go" | 404 | All | both | **P1** missing |
| `did-you-mean` | Spelling correction suggestion | Search | All | both | P1 |
| `popular-searches-row` | Trending searches | Search empty, Home (search modal) | All | both | P2 |

### 3.13 Account blocks

| Block | Purpose | Surfaces | Persona | Mode | Priority |
|---|---|---|---|---|---|
| `order-history-list` | Recent orders with status | Account | All known | storefront | **P0** missing |
| `address-book` | Saved shipping/billing addresses | Account | All known | storefront | P1 |
| `wishlist-grid` | Saved picks/wishlist (= our existing picks store) | Account | All | storefront | ✅ have (partial) |
| `profile-card` | Name / email / preferences | Account | All known | both | P1 |
| `subscription-preferences` | Email/SMS opt-in management | Account | All known | both | P1 |
| `reviews-to-write-row` | "Write a review for items you bought" | Account | Researcher | storefront | P2 |

### 3.14 Editorial / content blocks (content-mode)

For brands like Home Centric that operate as content-only sites.

| Block | Purpose | Surfaces | Persona | Mode | Priority |
|---|---|---|---|---|---|
| `brand-story-banner` | Editorial about the brand mission | Home, About | Researcher, Gatherer | content | ✅ have (rendered as editorial-hero variant) |
| `inspiration-gallery` | "Get Inspired" image grid (pinterest-like) | Home, Category | Gatherer | content | **P0** missing |
| `room-by-room-tiles` | Curated rooms (HC) / outfits (BF) | Home | Gatherer | content | P1 |
| `event-calendar-strip` | In-store events list | Home, Locator | All | content | P2 |
| `newsletter-deep-cta` | Story-driven newsletter pitch | Home (mid-page) | Researcher, Gatherer | content | P1 |

---

## 4. Surface × block matrix

The compositional contract. **M** = mandatory (must appear, scaffold-fixed), **A** = AI-composable (AI decides whether and where), **I** = AI-insertable at named anchor (AI decides whether but not where), **—** = invalid here.

| Block | Home | PLP | PDP | Search | Cart | Checkout | Account | 404 | Locator |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Brand strip / header / footer | M | M | M | M | M | M | M | M | M |
| editorial-hero | A | A | — | — | — | — | — | A | A |
| editorial-header | A | A | I | A | — | — | A | A | A |
| promo-strip | A | A | I | — | A | — | — | — | — |
| coupon-strip | A | A | I | — | A | — | — | — | — |
| event-countdown | A | A | — | — | — | — | — | — | — |
| brand-spotlight | A | A | I | — | — | — | — | — | — |
| trend-shop | A | A | — | — | — | — | — | — | — |
| email-capture-inline | A | — | — | — | A | — | A | A | A |
| bopis-strip | A | I | M | — | I | — | — | — | M |
| service-callouts-grid | A | A | — | — | — | — | — | — | — |
| free-shipping-meter | — | — | — | — | M | M | — | — | — |
| locator-strip | A | — | — | — | — | — | — | — | M |
| bealls-bucks-callout | A | I | I | — | A | — | M | — | — |
| category-tile-grid | A | A | — | — | — | — | — | A | — |
| price-rail | A | A | — | — | — | — | — | — | — |
| product-grid | A | M | — | M | — | — | — | A | — |
| product-carousel | A | A | I | A | A | — | A | A | — |
| hero-product | A | A | — | — | — | — | — | — | — |
| lookbook-shop-the-look | A | A | I | — | — | — | — | — | — |
| for-you-row | A | — | I | — | A | — | A | A | — |
| also-bought-carousel | — | — | M | — | M | A | — | — | — |
| recently-viewed | A | A | I | — | A | — | A | — | — |
| complete-the-look | — | — | M | — | A | — | — | — | — |
| last-chance-upsell-row | — | — | — | — | M | M | — | — | — |
| breadcrumb | — | M | M | M | — | — | — | — | — |
| subcat-strip | — | A | — | A | — | — | — | — | — |
| image-gallery | — | — | M | — | — | — | — | — | — |
| variant-selector | — | — | M | — | — | — | — | — | — |
| stock-signal | — | I | M | — | I | — | — | — | — |
| add-to-cart-bar | — | — | M | — | — | — | — | — | — |
| description-tabs | — | — | M | — | — | — | — | — | — |
| reviews-summary | — | — | M | — | — | — | — | — | — |
| reviews-list | — | — | M | — | — | — | — | — | — |
| cart-line-items | — | — | — | — | M | M | — | — | — |
| cart-summary | — | — | — | — | M | M | — | — | — |
| checkout-step-progress | — | — | — | — | — | M | — | — | — |
| order-summary-sidebar | — | — | — | — | — | M | — | — | — |
| order-history-list | — | — | — | — | — | — | M | — | — |
| wishlist-grid | — | — | — | — | — | — | M | — | — |
| search-zero-state-rescue | — | — | — | M (when empty) | — | — | — | — | — |
| 404-rescue | — | — | — | — | — | — | — | M | — |

A few takeaways from the matrix:
- Home and PLP are the only surfaces with a lot of **A** (AI-composable). Everywhere else, AI is mostly making **I** (insert) or **A within scaffold** decisions.
- Cart and checkout are almost entirely **M** (mandatory scaffold). The AI's job is to choose `last-chance-upsell-row` contents, personalize copy, and decide whether to surface `bopis-strip` and `coupon-strip`.
- PDP has 9 mandatory blocks (gallery, title, variant, stock, BOPIS, ATC, description, reviews-summary, reviews-list, also-bought, complete-the-look). Most of those don't exist yet.

---

## 5. Composition rules per surface

### 5.1 Home (Wide latitude)

**Scaffold:** brand-strip, header nav, photographic hero, footer, value-props strip.
**AI composes:** an ordered array of 6–10 sections drawn from the AI-composable column above.

**Mandatory inclusions (one of each category):**
- 1 marketing block: `coupon-strip` OR `event-countdown` OR `brand-spotlight`
- 1 capture block (if shopper is anonymous): `email-capture-inline`
- 1 service block: `bopis-strip` OR `service-callouts-grid`
- 1+ product surfaces: `product-grid`, `product-carousel`, `hero-product`, or `lifestyle-price-hero`
- 1 navigation surface: `category-tile-grid` OR `price-rail`
- 1 loyalty block (if shopper is known): `bealls-bucks-callout`

**Persona biases:**
- Hunter: lead with `lifestyle-price-hero` or `price-rail`; include `coupon-strip`; dense `product-grid`
- Gatherer: lead with `editorial-hero`; include `lookbook-shop-the-look`; sparse editorial layout
- Researcher: lead with `editorial-header`; include `brand-spotlight` and `comparison-table` link teaser
- Gifter: lead with `editorial-hero` framing the occasion; `price-rail` for "Under $X"

**Forbidden:**
- `category-header` (PLP only)
- `image-gallery`, `variant-selector`, `description-tabs` (PDP only)
- `cart-summary`, `checkout-step-progress` (cart/checkout only)

### 5.2 PLP (Medium latitude)

**Scaffold:** brand-strip, header nav, breadcrumb, category-header (with sort/filter), product-grid, pagination, footer.
**AI composes:** the order and choice of insertion blocks above and within the grid.

**Mandatory inclusions:** breadcrumb, category-header, product-grid.

**Optional insertions:**
- `editorial-hero` above the grid (Gatherer, Gifter only)
- `subcat-strip` above the grid
- `coupon-strip` or `promo-strip` between scroll thirds of grid
- `editorial-article-teaser` mid-grid (every 12 products)
- `category-tile-grid` for sub-pillars at bottom of empty/short results

**Persona biases:**
- Hunter: skip editorial inserts; show `subcat-strip`; dense grid
- Researcher: include `comparison-table-link`; show ratings on cards
- Gatherer: include `editorial-hero`; sparse grid; landscape cards

### 5.3 PDP (Narrow latitude — fixed scaffold + named insertions)

**Scaffold (top to bottom, fixed order):**
1. breadcrumb (M)
2. image-gallery (M)
3. product-title-block (M)
4. variant-selector (M)
5. stock-signal + bopis-picker (M when applicable)
6. add-to-cart-bar (M)
7. promo / coupon eligibility callout (I — AI decides whether)
8. description-tabs (M)
9. **AI insertion zone "below-description"** (I — AI inserts 0–2 blocks)
10. complete-the-look (M when persona∈{gatherer,gifter})
11. also-bought-carousel (M)
12. **AI insertion zone "below-recs"** (I — AI inserts 0–1 blocks)
13. reviews-summary + reviews-list (M)
14. recently-viewed (I)

**AI's job:** choose `coupon-strip` placement (above or below ATC), choose what (if anything) to insert in zones 9 and 12, choose whether to surface `bopis-strip`, `bucks-earn-row-pdp`, and `recently-viewed`.

**Persona biases:**
- Hunter: surface `bopis-strip` aggressively; `stock-signal` urgency wording
- Researcher: prioritize `reviews-list` filter UX, `comparison-table` link, expand description tabs by default
- Gatherer: prioritize `complete-the-look`, `lookbook-shop-the-look`
- Gifter: prioritize `gift-options`, `complete-the-look` framing as gift sets

### 5.4 Cart (Fixed scaffold + upsells)

**Scaffold (top to bottom, fixed):**
1. cart-line-items (M)
2. cart-summary with free-shipping-meter (M)
3. promo-code-entry (M)
4. **AI insertion zone "above-checkout-cta"** for `last-chance-upsell-row` (M, AI picks contents)
5. checkout CTA (M)
6. trust strip / returns promise (M)
7. **AI insertion zone "below-fold"** for `also-bought-carousel`, `recently-viewed`, `bealls-bucks-callout` (I — AI picks 1–2)

**AI's job:** populate the upsell row, choose copy variants (urgency language scaled by abandonment risk), decide which loyalty/below-fold blocks to show.

### 5.5 Checkout (Very narrow latitude)

**Scaffold (fixed):** step-progress, contact, shipping address, shipping options, payment options, order-summary-sidebar (sticky), trust strip, place-order CTA.

**AI's job:**
- Personalize step-progress copy ("Almost there, Sara")
- Choose `last-chance-upsell-row` contents above the place-order CTA (1 row max, ≤4 items)
- Choose `assurance-strip-checkout` variant by risk signal (first-time buyer = trust badges; returning = "Welcome back")
- Decide whether to surface `gift-options` (default off, on for Gifter persona)
- Personalize confirmation message after placing order

**Forbidden:** reordering steps, changing field labels, hiding required fields, swapping CTAs.

### 5.6 Search results (Wide for empty, narrow for results)

**Results state (narrow):**
- Search input (sticky)
- Result count + applied filters
- Filter rail (left)
- Product grid (M)
- Pagination (M)

**Empty state (wide):**
- Did-you-mean suggestion (if typo)
- 404-style rescue copy
- AI composes: `search-zero-state-rescue`, `popular-searches-row`, `category-tile-grid`, `editorial-hero` of the brand's most-searched, `product-carousel` (best sellers)
- Persona-aware: Hunter sees `price-rail`, Gatherer sees `editorial-hero`

### 5.7 Account (Medium latitude — known shopper context)

**Scaffold:** header nav, sidebar (orders, addresses, wishlist, loyalty, settings), main content area.
**AI composes:** the dashboard landing — chooses 4–6 cards from: `tier-status-card`, `order-history-list` (recent), `wishlist-grid` (preview), `for-you-row`, `back-in-stock-alert-card`, `reviews-to-write-row`, `subscription-preferences`.

**Persona biases:**
- Hunter: lead with `back-in-stock-alert-card` and `tier-status-card` (savings)
- Researcher: lead with `reviews-to-write-row` and order history detail
- Gatherer: lead with `for-you-row` and `wishlist-grid`
- Gifter: lead with `gift-options` shortcuts and order history

### 5.8 404 / empty / locator (Wide for rescue)

**404:** brand chrome + `404-rescue` (AI-composed copy and alt CTAs) + `category-tile-grid` + `product-carousel` of best sellers.
**Empty cart:** `email-capture-inline` + `recently-viewed` + `category-tile-grid` + `coupon-strip` (returning shopper rescue).
**Locator:** brand chrome + `locator-strip` (M) + map + store list + `event-calendar-strip` (content mode).

---

## 6. Mode and state matrix

The same surface mutates by signal. Composition rules above must respect:

| Signal | Effect |
|---|---|
| **Brand mode = content** | Strip all transactional blocks; compose from §3.14 + editorial subset |
| **Cold visitor (no inferred persona)** | Default to Gatherer composition; lead with capture and brand framing |
| **Returning visitor (inferred persona)** | Lead with `for-you-row`, persona-skewed hero, surface loyalty if known |
| **Logged in** | Surface `bucks-balance-pill` in header; surface `tier-status-card`; greet by name |
| **Cart populated** | Show `free-shipping-meter` in header; surface `last-chance-upsell-row` on PLP/PDP |
| **High-intent signal** (filter use, multi-PDP visit) | Surface `bopis-strip`, `stock-signal`, `coupon-strip` more aggressively |
| **Low-intent signal** (entry from social/email) | Surface `editorial-hero`, `lookbook-shop-the-look`, soft capture |
| **Out-of-stock product on PDP** | Replace ATC with `back-in-stock-alert-card` + similar product carousel |
| **Repeat buyer of category** | Surface `also-bought-carousel` from past purchases, not generic recs |

Each rule above translates into prompt context the AI sees (we already have probability vectors and picks context flowing in; we'll need to extend the request shape to carry mode signals).

---

## 7. Historical April 2026 gap snapshot

This section records the state that motivated the taxonomy. Its counts and “missing” labels are not a current component or runtime-authority inventory. Use the renderer and runtime contracts for current truth.

### Current state (12 blocks, mostly product display)

| Category | Blocks we have |
|---|---|
| Marketing | promo-strip, coupon-strip |
| Capture | (none) |
| Service | (none) |
| Loyalty | bealls-bucks-callout |
| Hero | editorial-hero, editorial-header, lifestyle-price-hero, category-header |
| Product display | product-grid, product-carousel, hero-product |
| Navigation | category-tile-grid, price-rail, brand-strip-cross-banner |
| Personalization | (none — all carousels are generic) |
| PDP | (none — current PDP is hand-coded, not composed) |
| Cart/Checkout | (none — stubs) |
| Search/Empty | (none) |
| Account | wishlist-grid (partial — uses picks store) |
| Editorial | (only via editorial-hero) |

### Target state (~80–100 blocks, full surface coverage)

The full P0+P1 set across all 14 categories, structured by surface schema.

### Gap quantification

- **P0 missing (must add for demo defensibility):** ~20 blocks
  - 4 marketing/capture/service (event-countdown, brand-spotlight, trend-shop, email-capture-inline, bopis-strip, service-callouts-grid, locator-strip)
  - 1 personalization (for-you-row, also-bought-carousel, last-chance-upsell-row)
  - 9 PDP scaffold blocks (gallery, title, variant, stock, ATC, description-tabs, reviews-summary, reviews-list, breadcrumb)
  - 4 cart/checkout scaffold blocks (line-items, summary, step-progress, order-summary-sidebar)
  - 2 account/empty (order-history-list, search-zero-state-rescue, 404-rescue)
- **P1 next batch:** ~25 blocks (cross-sell variants, loyalty depth, social proof, editorial)
- **P2 future:** ~15 blocks (UGC, advanced merchandising, BNPL UX, advanced rescue)

---

## 8. Historical implementation roadmap

This roadmap is retained as design history. It does not grant authority to a block, route, schema, or model endpoint.

Concrete sequence to close the gap. Each phase is independently shippable and demonstrably improves a specific surface.

### Phase 1 — Home depth (close the user's original observation)

**Add P0 marketing/capture/service blocks** so home stops being product-only.

- `event-countdown`, `brand-spotlight`, `trend-shop` (marketing)
- `email-capture-inline` (capture)
- `bopis-strip`, `service-callouts-grid`, `locator-strip` (service)
- `for-you-row` (personalization for known shoppers)

Update homepage prompt with mandatory inclusions (§5.1). Keep storefront/content variants.

**Estimate:** ~6 hr human / ~90 min agent.

### Phase 2 — PLP enrichment

**Add insertion blocks and rescue states.**

- `subcat-strip` (formalize the existing partial)
- `editorial-article-teaser`
- `comparison-table-link`
- Inline `coupon-strip` insertion every N products
- Empty PLP rescue (similar to 404)

Refactor PLP renderer to accept `headerZone` + `bodyZones` + `insertions` shape.

**Estimate:** ~6 hr human / ~90 min agent.

### Phase 3 — PDP scaffold (the largest gap)

**Build the 9 mandatory PDP blocks** as a fixed scaffold. AI's only latitude here is the named insertion zones + cross-sell row contents.

- image-gallery, product-title-block, variant-selector, stock-signal, bopis-picker, add-to-cart-bar, description-tabs, reviews-summary, reviews-list
- Plus: `also-bought-carousel`, `complete-the-look`, `recently-viewed`

Migrate hand-coded PDP to scaffold-based. Define `PDPLayoutSchema` distinct from current `LayoutSchema`.

**Estimate:** ~16 hr human / ~4 hr agent (largest single phase).

### Phase 4 — Cart & checkout personalization

**Build cart/checkout scaffolds with named upsell zones.**

- cart-line-items, cart-summary, free-shipping-meter, promo-code-entry, last-chance-upsell-row
- checkout-step-progress, order-summary-sidebar, payment-options, shipping-options, assurance-strip-checkout

`CartLayoutSchema` and `CheckoutLayoutSchema` constrain AI to upsell choice + copy personalization only.

**Estimate:** ~12 hr human / ~3 hr agent.

### Phase 5 — Search, account, 404/locator

**Close out the rescue and post-purchase surfaces.**

- search-zero-state-rescue, did-you-mean, 404-rescue, popular-searches-row
- order-history-list, address-book, profile-card, tier-status-card, subscription-preferences
- locator-strip, event-calendar-strip (content mode)

**Estimate:** ~8 hr human / ~2 hr agent.

### Phase 6 — Personalization depth

**Move from generic carousels to signal-driven recommendations.**

- Real `for-you-row` and `also-bought-carousel` driven by enrichment + picks + browse history
- `back-in-stock-alert-card` requires inventory event hooks
- `recently-viewed` requires client-side history store

**Estimate:** ~12 hr human / ~3 hr agent (depends on enrichment depth).

### Total

- **P0 (Phases 1–4):** ~40 hr human / ~10 hr agent
- **P1 (Phases 5–6):** ~20 hr human / ~5 hr agent
- **Total to defensible coverage:** ~60 hr human / ~15 hr agent

---

## 9. Implemented shopper publication shape

The shopper runtime publishes named zones, not surface-selected whole layouts:

```
server route pathname
└── trusted brand + route context
    └── compiled surface and expanded-zone policy
        ├── trusted merchant pin / lock
        ├── fixed, trusted-rule, or model candidate
        ├── trusted authored content
        └── brand fallback or Hidden
            └── strict zone schema + exact renderer dispatch
```

The client cannot provide a `surface` discriminator. Page loads derive the route from `event.url.pathname`. Cross-route model calls require a short-lived, signed, HttpOnly grant scoped to organization, brand, exact route, server-derived API surface, effective policy and reference state, catalog authority, synthetic provenance, expiry, and browser binding session. Origin and Referer are additional same-origin confusion checks, not the authority.

Legacy whole-layout schemas remain available to `/style-guide` and `/test/components`. They are review/development fixtures and cannot be extracted or published by shopper APIs.

---

## 10. What this changes about how we build

1. **No more reactive component additions.** Every new block must be motivated by a row in §3 (the catalog). If a block isn't in the catalog, we add it to the catalog first, justify its surfaces and personas, then build it.
2. **Prompts follow executable authority.** A prompt may target only the exact named zones its server-derived policy permits. Current model prompts exist only for cart and checkout zones.
3. **Schemas and renderer dispatch close exactly.** A home zone cannot accept `cart-summary`, unsupported component IDs, extra props, or unbounded copy.
4. **Demos are surface-walkthroughs, not feature lists.** "Watch the AI compose a homepage, then a PLP, then a PDP" — each demonstrates different latitude.
5. **The block catalog is design input.** Runtime authority is the compiled brand/route/zone policy plus the strict schema and registered renderer. Presence in §3 grants nothing.

---

## 11. Historical open questions

These need decisions before Phase 3 starts.

1. **PDP gallery:** is this AI-composed (AI picks which images to lead with) or fixed to BC's gallery order? Recommendation: fixed to BC.
2. **Reviews system:** do we synthesize reviews for the demo, or stub the block? Recommendation: synthesize 5–10 plausible reviews at enrichment time.
3. **BOPIS:** do we mock store inventory, or surface "demo inventory" tiles only? Recommendation: mock 3 stores per zip with deterministic synthetic stock.
4. **Cart persistence:** session-only or signed-cookie? Already session-only — keep it.
5. **Checkout fidelity:** real Stripe sandbox or end-of-flow "demo complete" splash? Recommendation: demo splash; we're not testing payments.
6. **Personalization signal source:** the existing inference engine has 4 personas. Add intent-tier signal (browsing / considering / purchasing) or stay with persona only? Recommendation: add intent-tier in Phase 6, not earlier.

---

## Appendix A — Original P0 backlog (historical)

Marketing / capture / service:
- event-countdown, brand-spotlight, trend-shop, email-capture-inline, bopis-strip, service-callouts-grid, locator-strip

Personalization / cross-sell:
- for-you-row, also-bought-carousel, last-chance-upsell-row

PDP scaffold:
- image-gallery, product-title-block, variant-selector, stock-signal, bopis-picker, add-to-cart-bar, description-tabs, reviews-summary, reviews-list, breadcrumb

Cart / checkout scaffold:
- cart-line-items, cart-summary, free-shipping-meter, promo-code-entry, checkout-step-progress, order-summary-sidebar

Search / empty / 404:
- search-zero-state-rescue, 404-rescue

That's ~25 blocks to defensibility. The rest of the catalog is P1+ refinement.

---

## Appendix B — Glossary

- **Surface** — a canonical page type (Home, PLP, PDP, Cart, Checkout, Account, Search, Empty/Locator)
- **Block** — a reusable composition unit (e.g. `coupon-strip`, `bopis-picker`)
- **Zone** — a named region within a surface scaffold (e.g. PDP's "below-description" zone)
- **Latitude** — how much an AI agent is allowed to compose vs. fill scaffolded slots
- **Mode** — brand mode (storefront vs. content-only)
- **State** — request-time signals (cold/returning, logged-in, cart populated, intent tier)
- **Insertion** — placing a block at a named anchor point (vs. composing freely)
- **Scaffold** — the fixed structural skeleton of a surface (M-marked blocks in §4)
- **Personalization signal** — persona × probabilities × picks × intent that informs block choice and copy
