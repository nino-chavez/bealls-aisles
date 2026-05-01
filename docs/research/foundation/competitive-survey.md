# Foundation Layer Competitive Survey

**BigBlueprint Stage 1 — Cross-Industry Research**
**Audience:** commerce.com product leadership
**Question answered:** What is the default "what an ecomm site is" spec across reference platforms? Which surfaces, sections, and primitives must exist whether or not AI is personalizing them?
**Date:** April 2026

---

## 1. Executive summary

Across the seven reference platforms surveyed, the foundation of an ecommerce storefront is remarkably stable: every reference theme ships home, PLP, PDP, cart, search, account, and a 404 as first-class routes; every reference theme treats checkout as either a first-class flow (Shopify, BigCommerce, Hyvä, Saleor) or a swappable submodule (commercetools, Vue Storefront/Alokai, Spryker). What differs is the authoring model (theme JSON vs visual page builder vs CMS-bound), the granularity of section primitives (Dawn ships ~22 reusable sections; Cornerstone ships ~7 homepage zones plus widget regions on every page; commercetools Frontend ships a typed component library of ~50+), and which "store of record" the surfaces read from (cart and account are platform-owned in BC/Shopify/Saleor, but storefront-owned and pluggable in commercetools/Alokai/Spryker). The two genuinely universal table-stakes capabilities are (a) a section-or-region authoring model on home/PLP/PDP that lets merchants reorder content without forking the theme, and (b) a navigation/header/footer/account/cart shell present on every page. **Store locator is universally a bolt-on**, not a default surface, on every reference theme except Hyvä Commerce (and even there it is partial). This is a meaningful greenfield for Aisles given Bealls' physical footprint.

---

## 2. Surface coverage matrix

Rows are the canonical 8 surfaces. Columns are the 7 primary references (Hydrogen tracked separately as a bonus column). Cells: `default` (ships in the reference theme/storefront), `addon` (available as official module/app but not in default theme), `absent` (not part of platform's reference scope).

| Surface | BC Stencil/Cornerstone | Shopify Dawn | Magento Hyvä | commercetools Frontend | Saleor Storefront | Vue Storefront / Alokai | Spryker SCOS | Hydrogen Skeleton |
|---|---|---|---|---|---|---|---|---|
| Home | default | default | default | default (Launchpad) | default | default | default | default |
| PLP (category/collection) | default | default | default | default | default | default | default | default |
| PDP | default | default | default | default | default | default | default | default |
| Search results | default | default | default | default | default (basic) | default | default | default |
| Cart | default | default (page + drawer) | default | default | default (drawer) | default | default | default |
| Checkout | default (hosted, BC-managed) | default (Shopify-managed) | default (Luma + Hyvä Checkout addon) | default (template) | default (in-storefront, multi-step) | partial (no place-order OOTB) | default (multi-step) | default |
| Account dashboard | default (orders, addresses, wishlist, returns, payment methods) | default (orders, addresses) | default (orders, addresses, wishlist) | default (orders, addresses) | default (orders, addresses, password, deletion) | default (orders, profile) | default (B2B-rich: company users, approvals, quick order) | default (orders, addresses, profile) |
| Locator / store finder | addon (Hypa app, WP Maps) | addon (~26 marketplace apps); pickup-availability primitive on PDP is default | addon | addon | absent | absent | addon | absent |
| 404 / empty | default | default (`404.json`) | default | default | default | default | default | default (`$.tsx` catch-all) |
| Blog | default | default (`blog.json`, `article.json`) | default (Magento native) | addon (CMS integration) | absent | varies by integration | default | default (`blogs.*`) |
| Brand pages | default (`brand.html`, `brands.html`) | absent (use collection) | absent (use category) | absent | absent | absent | absent | absent |
| Compare | default (`compare.html`) | absent | addon | absent | absent | absent | absent | absent |
| Wishlist | default | absent (default) | default | absent | absent | absent | absent | absent |
| Gift certificate | default | default (`gift_card.liquid`) | absent | absent | absent | absent | absent | absent |
| Contact / static page | default (`contact-us.html`, `page.html`) | default (`page.contact.json`, `page.json`) | default (Magento CMS pages) | default (CMS via Studio) | absent | absent | default (CMS pages + slots) | default (`pages.$handle`) |
| Policies | absent (custom pages) | absent (separate admin) | default (Magento) | absent | absent | absent | absent | default (`policies.*`) |
| Sitemap | default (`sitemap.html`) | absent (auto-generated) | default | absent | absent | absent | default | default (`sitemap.$type.$page`) |

**Gaps highlighted:**

- **Locator** is only first-class on Hyvä Commerce (partial) — every other reference treats it as bolt-on or absent. Pickup-availability on PDP is the closest universal primitive (Dawn ships it; BC does not).
- **Brand pages** are unique to BigCommerce — every other reference flattens brands into category/collection.
- **Compare and wishlist** as default surfaces appear only on BC (compare + wishlist) and Hyvä (wishlist). Modern headless references skip both.
- **Policies and sitemap** are platform-managed (auto-generated) on Shopify and Saleor; explicit pages on BC/Magento/Hydrogen/Spryker.

---

## 3. Section inventory per surface

For each surface, count of platforms (out of 7 primary references) that ship the section by default in their reference theme.

### 3.1 Home

| Section | Default in N/7 | Notes |
|---|---|---|
| Header (nav, logo, cart icon, search, account) | 7/7 | Universal global section |
| Hero / image banner / carousel | 7/7 | All ship at least one. Dawn has `image-banner`, `slideshow`; Cornerstone has `heroCarousel`; commercetools Launchpad ships hero banner |
| Featured products row / featured collection | 7/7 | Dawn `featured-collection`/`featured-product`; Cornerstone "new products" + "most popular"; Launchpad product slider |
| Category / collection grid | 6/7 | Dawn `collection-list`; Launchpad category cards; Saleor partial |
| Rich text / about block | 6/7 | Dawn `rich-text`, `multirow`, `image-with-text`; commercetools generic component; Hyvä CMS block |
| Newsletter / email signup | 6/7 | Dawn `newsletter`, `email-signup-banner`; Cornerstone footer signup; Launchpad |
| Value-props strip (icons + text) | 4/7 | Dawn `multicolumn`; Cornerstone via custom; Launchpad section |
| Blog / featured article | 5/7 | Dawn `featured-blog`; Cornerstone via blog; Launchpad |
| Video embed | 3/7 | Dawn `video`; commercetools generic |
| Announcement bar | 5/7 | Dawn `announcement-bar`; BC global region above nav; Hyvä CMS |
| Footer (links, social, payment icons) | 7/7 | Universal |

### 3.2 PLP (category / collection)

| Section | Default in N/7 | Notes |
|---|---|---|
| Breadcrumbs | 7/7 | Universal |
| Category banner / hero | 6/7 | Dawn `main-collection-banner`; Cornerstone category header |
| Filter sidebar (faceted nav) | 7/7 | Universal — every platform supports facets, but data source/server-vs-client varies |
| Sort dropdown | 7/7 | Universal |
| Product grid (with image, price, swatch, badge) | 7/7 | Universal |
| Pagination or infinite scroll | 7/7 | Default pagination; infinite scroll varies |
| "View as grid/list" toggle | 4/7 | BC, Hyvä, Spryker, Vue Storefront ship; Dawn/Saleor/commercetools omit |
| Recently viewed | 2/7 | BC, Hyvä |
| Empty-state | 5/7 | Dawn explicit; Saleor; Hyvä; BC; Hydrogen — others fall back to copy |

### 3.3 PDP

| Section | Default in N/7 | Notes |
|---|---|---|
| Image gallery (thumbs, zoom, video) | 7/7 | Universal; Dawn + Saleor support video; Hyvä full gallery + video |
| Title + price + SKU + reviews summary | 7/7 | Universal |
| Variant selector (color/size/material swatches) | 7/7 | Universal |
| Quantity selector + add-to-cart | 7/7 | Universal |
| Pickup availability / store stock | 2/7 | Dawn `pickup-availability` default; Hyvä via module; others bolt-on |
| Description tabs (description, specs, shipping) | 6/7 | Dawn `collapsible-content`; Cornerstone `description-tabs`; Hyvä, commercetools, Saleor, Hydrogen |
| Reviews section | 6/7 | Cornerstone native; others integrate Yotpo/Bazaarvoice/Saleor's |
| Related / recently-viewed / "you may also like" | 7/7 | Dawn `related-products`; commercetools recommendations; Hydrogen demo store |
| Wishlist button | 4/7 | BC, Hyvä, Vue Storefront, partial commercetools |
| Social share | 5/7 | Cornerstone, Dawn, Hyvä, commercetools, Spryker |
| Sticky add-to-cart bar (mobile) | 3/7 | Dawn, Hyvä, Alokai |

### 3.4 Search

| Section | Default in N/7 | Notes |
|---|---|---|
| Search input in header | 7/7 | Universal |
| Predictive / autocomplete dropdown | 5/7 | Dawn `predictive-search`; Hyvä; commercetools; Alokai; Hydrogen demo. Saleor and BC use basic by default |
| Search results page (mirrors PLP layout) | 7/7 | Universal |
| Filters on search results | 5/7 | BC, Dawn, Hyvä, commercetools, Spryker. Saleor minimal |
| "Did you mean" / spell correction | 2/7 | BC (native search), Hyvä (via Elasticsearch). Most rely on third-party |
| Empty-state with suggestions | 4/7 | Dawn, Hyvä, commercetools, Hydrogen |

### 3.5 Cart

| Section | Default in N/7 | Notes |
|---|---|---|
| Cart drawer (slide-out) | 6/7 | Dawn `cart-drawer`; Saleor; Hyvä; commercetools; Hydrogen; Alokai. Spryker uses page-only |
| Cart page (full) | 7/7 | Universal |
| Line items with image, qty stepper, price, remove | 7/7 | Universal |
| Promo / discount code input | 7/7 | Universal |
| Subtotal + tax preview + shipping estimator | 6/7 | All except Saleor's minimal cart |
| "Continue shopping" CTA | 7/7 | Universal |
| Cross-sell / "you forgot" recommendations | 4/7 | Dawn, Hyvä, commercetools, Hydrogen demo |
| Save for later / move to wishlist | 3/7 | BC, Hyvä, Vue Storefront |
| Empty cart state with CTA | 7/7 | Universal |

### 3.6 Checkout

| Section | Default in N/7 | Notes |
|---|---|---|
| Email / contact step | 7/7 | Universal |
| Shipping address form (country-aware) | 7/7 | Saleor explicitly invests here; all platforms ship country select |
| Shipping method selector | 7/7 | Universal |
| Billing address (same as shipping toggle) | 7/7 | Universal — though Alokai notes this is partial OOTB |
| Payment method (cards, wallets, PayPal, BNPL) | 7/7 | Hosted (BC, Shopify) vs in-storefront (Saleor, Hyvä). Wallets default on Dawn, Hydrogen, Hyvä |
| Order summary sidebar | 7/7 | Universal |
| Guest checkout | 7/7 | Universal |
| Account-creation upsell post-purchase | 6/7 | Universal except Saleor |
| Order confirmation page | 7/7 | Universal |
| Multi-step vs single-page | mixed | BC/Shopify: hosted (single-page-ish); Saleor: multi-step explicit; Hyvä: single-page (Magewire); commercetools: configurable; Spryker: multi-step B2B |

### 3.7 Account dashboard

| Section | Default in N/7 | Notes |
|---|---|---|
| Orders list + detail | 7/7 | Universal |
| Addresses (CRUD) | 7/7 | Universal |
| Profile / password change | 7/7 | Universal |
| Wishlist | 3/7 | BC, Hyvä, Vue Storefront |
| Returns / RMA | 1/7 | BC only (`account/returns.html`) |
| Saved payment methods | 3/7 | BC, Shopify (via Customer Account API), Hyvä |
| Subscriptions | 0/7 default | All are addons |
| Loyalty | 0/7 default | All are addons |
| Reorder / order again | 4/7 | Hyvä, BC, Spryker (B2B), Alokai |
| B2B: company users, approvals, quick order, order list | 1/7 | Spryker only as default; Hyvä Commerce / commercetools B2B Store ship as separate templates |

### 3.8 Locator / store finder

Only **Hyvä Commerce** ships a partial locator surface as default. Every other reference treats it as a bolt-on. Closest universal primitive is **PDP pickup availability** (Dawn ships, others addon). For Bealls (physical-store-heavy retailer), this is the largest single shipping gap across the reference set.

---

## 4. Per-platform deep dives

### 4.1 BigCommerce Stencil / Cornerstone (parent platform — deepest treatment)

**Surfaces shipped (from `templates/pages/`):** `home`, `category`, `product`, `brand`, `brands`, `cart`, `checkout`, `order-confirmation`, `search`, `compare`, `blog`, `blog-post`, `contact-us`, `page`, `sitemap`, `subscribed`, `unsubscribe`, plus `account/` (dashboard, orders, addresses, wishlists, returns, payment methods, recent items, inbox, gift certificates), `auth/` (login, create-account, forgot-password, new-password), `errors/` (404, 503), `gift-certificate/`, `unavailable/`. This is the **broadest default page inventory** of any reference theme — Cornerstone ships 17 top-level page templates and ~15 account sub-templates.

**Authoring model:** Two-layer. (1) **Theme Styles** (`schema.json` + `config.json`) — JSON-driven typography, colors, layout toggles surfaced in the Store Design panel; merchants tweak without code. (2) **Page Builder + Widgets API** — drag-and-drop widgets into named regions defined in templates as `{{{region name="..."}}}`. Every page can carry up to 150 widgets; total store cap is 10,000. Cornerstone 4.11+ ships a default global region below the nav, present on every page except checkout. Merchants additionally get **custom templates per page type** (brand, category, product, page) via the admin's "Custom Templates" feature.

**Distinguishing investments:** Brand-as-first-class-surface (unique among references); native Compare; native Wishlist; native Returns; native Sitemap and Contact pages; gift-certificate flow as a complete sub-app; Page Builder regions on cart, search, blog (not just home). Stencil-utils JS event bus for per-page hooks (`addToCart`, `cartItemAdd`) which third-party personalization platforms hook into.

**Skips / weak spots:** Checkout is fully BC-hosted (Optimized One-Page Checkout) — limited theme-level customization without going headless. Search default is basic keyword + facets (no native predictive); merchants typically integrate Klevu/Searchanise. Locator is bolt-on (Hypa app). No native pickup-availability primitive on PDP — surprising given multi-storefront direction.

Sources: [Cornerstone GitHub](https://github.com/bigcommerce/cornerstone), [Stencil docs](https://developer.bigcommerce.com/docs/storefront/stencil/start), [Page Builder regions](https://developer.bigcommerce.com/docs/storefront/widgets/guide), [Cornerstone theme manual](https://support.bigcommerce.com/s/article/Cornerstone-Theme-Manual).

### 4.2 Shopify Dawn (Online Store 2.0 reference)

**Surfaces shipped (from `templates/`):** `index.json`, `product.json`, `collection.json`, `list-collections.json`, `cart.json`, `search.json`, `blog.json`, `article.json`, `page.json`, `page.contact.json`, `password.json`, `404.json`, `gift_card.liquid`, plus `customers/` subdirectory (account, login, register, addresses, order, reset-password, activate-account). 12 root templates.

**Sections shipped (~22 reusable + ~20 main-* template-specific):** `announcement-bar`, `apps`, `collage`, `collapsible-content`, `collection-list`, `contact-form`, `email-signup-banner`, `featured-blog`, `featured-collection`, `featured-product`, `image-banner`, `image-with-text`, `multicolumn`, `multirow`, `newsletter`, `rich-text`, `slideshow`, `video`, plus header/footer/page. Cart/PDP-specific: `cart-drawer`, `cart-icon-bubble`, `cart-notification-*`, `pickup-availability`, `predictive-search`, `related-products`, `quick-order-list`, `bulk-quick-order-list` (B2B).

**Authoring model:** JSON templates declare default sections and order; merchants reorder/add/remove sections in the theme editor without touching code. Sections support `presets` (default settings); blocks compose within sections. App Blocks (Online Store 2.0) let third-party apps extend any section without theme edits.

**Distinguishing investments:** **Section primitives are the deepest of any reference** — Dawn ships ~22 reorderable sections plus the apps section, making it the most "page-builder-native" theme. Pickup availability is built into PDP. Predictive search ships default. Bulk quick-order-list demonstrates B2B awareness without a separate theme. Performance-first (HTML-first, JS-as-needed) is explicit.

**Skips:** No brand pages (uses collections). No compare. No wishlist (Shopify added saved carts but Dawn does not surface). Returns are admin-only — no customer-facing returns surface. Locator is bolt-on (~26 apps in marketplace). No native loyalty.

Sources: [Dawn GitHub](https://github.com/Shopify/dawn), [Dawn templates](https://github.com/Shopify/dawn/tree/main/templates), [Dawn sections](https://github.com/Shopify/dawn/tree/main/sections), [Online Store 2.0 announcement](https://www.shopify.com/partners/blog/shopify-online-store), [pickup-availability docs](https://shopify.dev/docs/storefronts/themes/delivery-fulfillment/pickup-availability).

### 4.3 Magento Hyvä (modern Magento reference)

**Surfaces shipped:** Default theme covers all category, product, cart, account pages; Magento native CMS handles homepage and content pages. Hyvä Checkout (Magewire-based, formerly paid, free under Hyvä Commerce as of late 2025) provides modern checkout. Hyvä Commerce bundle adds CMS LiveView, admin dashboard, image editor, media optimizer.

**Authoring model:** Magento PageBuilder for CMS pages and category banners; Magento layout XML for structural overrides; Hyvä child theme overrides for templates. Heavier developer-touch than Dawn — there is no "drag a section" model on category/PDP without a third-party.

**Distinguishing investments:** Performance (~95+ Lighthouse scores out of box). Tailwind + Alpine.js — minimal JS bundle, no jQuery, no RequireJS. Wishlist + reorder + saved payment methods native. Strong B2B story via Adobe Commerce + Hyvä Commerce add-ons. Magewire (server-driven Livewire-style) for checkout — unique pattern in this set.

**Skips:** Checkout was historically paid (now free under Hyvä Commerce). Search defaults to Elasticsearch via Magento — predictive UI is theme-level only. No native locator. No first-class brand pages. Multi-storeview is Magento-native (good) but theming per storeview requires child themes.

Sources: [Hyvä docs](https://docs.hyva.io/), [Hyvä default theme repo](https://github.com/hyva-themes/magento2-default-theme), [Hyvä Commerce](https://www.hyva.io/hyva-commerce.html), [Hyvä Checkout](https://www.hyva.io/hyva-checkout.html).

### 4.4 commercetools Frontend (Studio + Frontend)

**Surfaces shipped:** Store Launchpad for B2C Retail provides homepage (hero, category cards, product sliders, blog), PDP, PLP, cart, checkout, account. Separate **B2B Store** Launchpad ships company-account, quote, approvals, reorder. Pages are assembled in **Frontend Studio** from a typed component library; layouts split into `HEAD`, `MAIN`, `FOOTER` regions with mobile/tablet/desktop breakpoints.

**Authoring model:** **Visual page builder is first-class.** Business users build page versions from page templates; developers build typed components against the API. Components are grouped by category in Studio. Versions support locales and environments (dev/preview/prod). Most thoroughly "merchant-edit-without-developer" of the headless references.

**Distinguishing investments:** Studio is a real CMS-grade visual page builder — closer to commercetools' answer to Contentstack/Builder.io. First-class environments and locale management. Native Dynamic Yield component (drag DY recommendations as a Frontend component, configure data source) — personalization is platform-aware.

**Skips:** No locator. No wishlist. No compare. Search is template-driven; merchants integrate Algolia/Constructor. Frontend Studio is a paid commercetools layer — the open `frontend-development` SDK ships components but not the visual builder.

Sources: [Frontend Studio docs](https://docs.commercetools.com/frontend-studio), [Page templates](https://docs.commercetools.com/frontend-studio/page-templates), [Dynamic Yield integration](https://docs.commercetools.com/frontend-development/dynamic-yield), [Store Launchpad B2C](https://docs.commercetools.com/frontend-development/cart), [B2B Store announcement](https://commercetools.com/blog/introducing-the-b2b-store-by-commercetools-frontend).

### 4.5 Saleor Storefront (React + Next.js App Router)

**Surfaces shipped:** Channel-scoped routes (`/[channel]/products/[slug]`, `/[channel]/products`), checkout, account dashboard with addresses + orders + password + account-deletion, login/register/reset. Cart is slide-over drawer.

**Authoring model:** **Code-only.** No CMS, no page builder in the reference. Saleor Storefront is positioned as "minimal, production-ready" — designed to be customized in code, not authored visually. Saleor's roadmap includes a "Paper App" dashboard preview and CMS integration but neither is shipped yet.

**Distinguishing investments:** Channel scoping (per-channel currency/tax/shipping in the URL) is first-class. Variant matrix UX (color × size × material) is notably polished. Multi-step mobile-first checkout with strong accessibility (focus management, semantic HTML, ARIA). International address forms are country-aware. Connection-resilient checkout (retries, rate limiting).

**Skips:** **No homepage CMS — homepage is a coded React component.** No store locator. No wishlist. No loyalty. No blog. Filtering on PLP is currently pagination-only (dynamic filtering is on roadmap). The reference is deliberately a developer scaffold, not a merchant-ready storefront.

Sources: [Saleor Storefront repo](https://github.com/saleor/storefront), [Storefront README](https://github.com/saleor/storefront/blob/main/README.md), [Saleor docs storefront](https://docs.saleor.io/quickstart/storefront).

### 4.6 Vue Storefront / Alokai

**Surfaces shipped:** Homepage, PLP, PDP, cart, checkout (partial — billing + place-order are not fully OOTB and require backend-specific config), login/register, account (orders, profile). 50+ ecommerce components in the default theme. Header with nav/logo/search/cart/login; footer with static nav.

**Authoring model:** Theme is a Nuxt app; default theme is overridden by integrations (Shopify integration, BigCommerce integration, commercetools integration each ship slightly different additions). CMS integration is via plugins (Contentful, Storyblok, Sanity) — no built-in page builder in the open-source theme.

**Distinguishing investments:** **Backend-agnostic** — same theme works against Magento, Shopify, BigCommerce, commercetools, Shopware, SAP. Default search includes SKU + text. Strong PWA story (offline, service workers, app-like). Alokai (the commercial layer) adds CDN, Connect (middleware), Storefront UI 2 (component library). Focus is portability rather than depth.

**Skips:** No locator. No native wishlist (varies by integration). Checkout completeness depends on backend integration. No CMS in the OSS reference.

Sources: [Alokai docs](https://docs.alokai.com/storefront/features/storefront-features/), [Vue Storefront repo](https://github.com/vuestorefront/vue-storefront), [Layouts and routing](https://docs.alokai.com/v2/getting-started/layouts-and-routing.html).

### 4.7 Spryker SCOS (Yves storefront, B2B-leaning)

**Surfaces shipped (B2B Demo Shop):** Homepage, PLP, PDP, cart (multi-cart), checkout (multi-step), account, plus **B2B-distinctive surfaces**: company users, business-on-behalf, approval workflows, shopping lists, quick order, order list, reorder, RFQ. CMS pages and slots for content.

**Authoring model:** Twig templates organized into **Atomic Frontend** (atoms/molecules/organisms/templates/views) plus **Modular Frontend** (widgets, pages). Theme inheritance: Current theme (e.g., B2B-theme) > Default theme. CMS templates with named slots for placing content blocks — closer to commercetools' page-version model than Dawn's section model.

**Distinguishing investments:** **B2B is the default**, not an addon. Approval workflow as a shipped template. Multi-cart, shopping lists, quick order, business-on-behalf as first-class account features. B2B Demo Marketplace variant ships even more (multi-vendor). CMS slots for editorial control without theme edits.

**Skips:** B2C polish is weaker — Spryker assumes you'll build the storefront. No native locator. Frontend developer experience is heavier (Twig + custom build) than React/Vue/Liquid alternatives. No native blog (use CMS pages).

Sources: [Spryker B2B Demo Shop](https://github.com/spryker-shop/b2b-demo-shop), [Multi-theme docs](https://docs.spryker.com/docs/scos/dev/front-end-development/202311.0/yves/multi-theme.html), [Storefront templates and slots](https://docs.spryker.com/docs/pbc/all/content-management-system/202404.0/base-shop/manage-in-the-back-office/best-practices-add-content-to-the-storefront-pages-using-templates-and-slots.html), [Composable Storefront early access](https://read.spryker.com/composable-storefront).

### 4.8 Hydrogen Skeleton (bonus — Shopify headless reference)

**Surfaces shipped (from `app/routes/`):** `_index` (home), `products.$handle`, `collections._index`, `collections.$handle`, `collections.all`, `cart`, `cart.$lines`, `search`, `account` (`._index`, `.profile`, `.addresses`, `.orders._index`, `.orders.$id`, `_login`, `_logout`, `_authorize`), `blogs._index`, `blogs.$blogHandle._index`, `blogs.$blogHandle.$articleHandle`, `pages.$handle`, `policies._index`, `policies.$handle`, `discount.$code`, `[robots.txt]`, `[sitemap.xml]`, `sitemap.$type.$page[.xml]`, `$.tsx` catch-all. Strong SEO + sitemap defaults.

**Authoring model:** Code-first React Router v7 app. No visual builder in the skeleton. Hydrogen demo store provides richer reference but is still developer-edited.

**Distinguishing investments:** Strong SEO baseline (sitemap, robots, policies as first-class routes). Customer Account API (Shopify's newer auth) baked in. Streaming SSR + Oxygen edge runtime + Storefront API GraphQL. Discount-code-as-route is a clever pattern (`discount.$code` applies and redirects).

**Skips:** No homepage CMS in skeleton (the demo store has more). No locator. No wishlist. Checkout is Shopify-hosted (redirect) — not in-storefront.

Sources: [Hydrogen skeleton routes](https://github.com/Shopify/hydrogen/tree/main/templates/skeleton/app/routes), [Hydrogen demo store](https://github.com/Shopify/hydrogen-demo-store), [Hydrogen and Oxygen fundamentals](https://shopify.dev/docs/storefronts/headless/hydrogen/fundamentals).

---

## 5. Implications for Aisles foundation

### 5.1 Table-stakes minimum (mandatory across all references)

For Aisles to be credible as "an ecomm platform" before any AI personalization, the foundation must ship the following surfaces and sections — these are universal across all 7 references:

**Surfaces (mandatory):** home, PLP (category), PDP, search results, cart (page + drawer), multi-step or single-page checkout, order confirmation, account dashboard with orders + addresses + profile + password, login + register + password-reset, 404, generic CMS page.

**Sections (mandatory across all 7):**
- **Global:** header (nav, logo, cart icon, search input, account link), footer (links, social, payment icons, legal), announcement bar slot.
- **Home:** hero/banner slot (configurable image + CTA), featured-products row (configurable product source), category grid, rich-text block, newsletter signup.
- **PLP:** breadcrumbs, optional banner, filter sidebar (faceted), sort dropdown, product grid with image/price/badge/swatch, pagination, empty state.
- **PDP:** image gallery with zoom, title + price + reviews summary, variant selector, quantity + add-to-cart, description tabs, related products, breadcrumbs.
- **Cart:** line items (image/qty/remove), promo input, subtotal + tax preview, shipping estimator, empty state, cross-sell slot, "continue shopping" CTA.
- **Checkout:** email step, address forms (country-aware), shipping method, payment, billing-same-as-shipping toggle, order summary, guest option, confirmation.
- **Account:** orders list + detail, address book CRUD, profile + password, logout.

This is the baseline. Anything below this and Aisles will not be perceived as a complete storefront platform.

### 5.2 Differentiated investments per platform (where each over-indexes)

Every reference platform invests deeply in one or two areas that are not table-stakes:

- **BigCommerce:** Page Builder regions on every page + brand surface + native compare/wishlist/returns. Authoring model is the differentiator.
- **Shopify Dawn:** Section primitives (~22 reusable). Pickup availability on PDP. Predictive search default. The "lego brick" model.
- **Magento Hyvä:** Performance + Tailwind + Alpine. Magewire-based checkout. Wishlist + reorder native.
- **commercetools:** Visual page builder with locales/environments + B2B Store template + Dynamic Yield as a typed component.
- **Saleor:** Channel-scoped routing as a URL primitive + variant matrix UX + accessibility.
- **Vue Storefront/Alokai:** Backend-agnostic theme + PWA + portability.
- **Spryker:** B2B as default (approvals, business-on-behalf, multi-cart, RFQ).
- **Hydrogen:** SEO baseline (sitemap/robots/policies first-class) + edge streaming.

For Aisles, the differentiation question is whether the AI layer is the differentiator (likely yes) or whether the foundation also makes a unique bet. Recommendation: foundation borrows liberally from Dawn (section model), commercetools (visual builder + personalization hooks), and Saleor (variant + accessibility), and saves invention budget for the AI layer.

### 5.3 Specific gaps in current Aisles foundation

Given the current Aisles state (SvelteKit + BC GraphQL, rough cart, stub checkout, no account, no real search, no locator), the following are concrete gaps versus the table-stakes baseline:

**Critical (every reference ships these; we don't):**
1. **Account dashboard** — orders, addresses, profile, password change, login/register/reset. None of these can be skipped.
2. **Real checkout** — at minimum: email → address (country-aware) → shipping method → payment → confirmation. Hosting decision: BC Optimized One-Page Checkout (BC-managed) vs. custom. Custom is significant scope.
3. **Search results page with facets** — every reference ships this as a default; today we have nothing.
4. **404 + empty states** — every reference ships these as branded surfaces.
5. **Section authoring model on home + PDP + PLP** — without this, merchants cannot self-serve. The decision: lean on BC's Widgets API/Page Builder regions (since we're on BC GraphQL), or build our own Sanity-backed sections, or both.

**Important (most references ship; some skip):**
6. **Predictive search** in header (5/7 ship default). Considered baseline by 2026.
7. **Cart drawer** (6/7 ship; only Spryker is page-only). Drawer is expected modern UX.
8. **Pickup availability on PDP** (only 2/7 ship default, but this is a Bealls-specific must — physical retailer).
9. **Related products on PDP** (7/7 ship). Even pre-AI, a static "related" needs to exist as an insertion zone the AI can later improve.
10. **Order confirmation page** with structured data.

**Differentiation opportunity (universal gap in references):**
11. **Store locator as first-class surface.** Only Hyvä Commerce ships this as default. Bealls' physical-store footprint makes locator a meaningful Aisles foundation investment that also differentiates vs. every reference platform. Pair with PDP pickup availability and account-bound favorite-store.

### 5.4 Architectural decisions implied by the survey

- **Authoring model.** Choose between (a) Dawn-style JSON section schema (developer-friendly, merchant-edits-via-editor), (b) commercetools-style visual page builder (higher-cost, merchant-self-service), or (c) BC-style global regions + widgets (already exists in our parent platform, can be reused). Recommendation: layer (c) as default + extend with (a) for AI-aware sections.
- **Cart and checkout ownership.** Headless references either own checkout fully (Saleor, Hyvä) or hand off (Hydrogen → Shopify Checkout). For Aisles on BC, hand-off to BC Optimized Checkout is the sensible default; building custom checkout is a separate program.
- **Account.** Read-through to BC Customer API is the correct default, mirroring how Hydrogen reads-through to Customer Account API. Don't build account as a Sanity-bound surface.
- **Personalization hooks.** Every reference exposes named slots (Dawn sections, BC regions, commercetools components) that personalization platforms can target. Aisles foundation must expose stable, named insertion zones on home/PLP/PDP/cart/empty-search before the AI layer is built — otherwise the AI layer has no contract to write against.

---

## 6. Open questions for product leadership

1. **Authoring model commitment.** Do we treat BigCommerce Page Builder regions as the authoring contract for the foundation (and have AI write into those regions), or do we ship a parallel Aisles-native section schema (Dawn-style) that BC merchants would learn separately? The first preserves merchant familiarity; the second gives us full control of the contract the AI writes against.

2. **Checkout ownership.** Do we hand off to BC Optimized One-Page Checkout (faster ship, less differentiation, BC is the system of record for orders) or build a custom checkout (longer ship, full control, payment-method risk)? Hydrogen and Cornerstone both hand off — that's the consensus pattern.

3. **Locator as differentiation.** Bealls is a physical retailer. Reference platforms universally treat locator as bolt-on. Do we make store locator + pickup availability + favorite-store + account-bound geo-context a flagship Aisles foundation surface? This is the most defensible foundation-level investment that maps to Bealls' actual moat.

4. **B2B scope.** Spryker and commercetools' B2B Store ship company-user, approval, quick-order as default surfaces. Are we B2B-relevant for commerce.com's broader merchant base, or B2C-only for Bealls? This decision changes the surface count by ~8.

5. **Personalization contract pre-AI.** What named insertion zones must the foundation expose so the AI layer has a stable target? Suggested minimum: `home.hero`, `home.featured-row.{1..N}`, `plp.empty-state`, `plp.banner`, `pdp.related`, `pdp.recently-viewed`, `cart.cross-sell`, `search.empty-state`, `account.welcome`. Need product sign-off on the contract before AI work can scaffold.

---

## Sources

- [BigCommerce Cornerstone GitHub](https://github.com/bigcommerce/cornerstone)
- [Cornerstone templates/pages directory](https://github.com/bigcommerce/cornerstone/tree/master/templates/pages)
- [BigCommerce Stencil docs](https://developer.bigcommerce.com/docs/storefront/stencil/start)
- [BigCommerce Page Builder & Widgets API](https://developer.bigcommerce.com/docs/storefront/widgets/guide)
- [BigCommerce Global Regions](https://developer.bigcommerce.com/docs/storefront/widgets/guide/global-regions)
- [BigCommerce Localization & Multi-Storefront 2025](https://www.bigcommerce.com/blog/platform-updates-for-developers-january-2025/)
- [Shopify Dawn GitHub](https://github.com/Shopify/dawn)
- [Dawn templates directory](https://github.com/Shopify/dawn/tree/main/templates)
- [Dawn sections directory](https://github.com/Shopify/dawn/tree/main/sections)
- [Online Store 2.0 announcement](https://www.shopify.com/partners/blog/shopify-online-store)
- [Shopify pickup-availability docs](https://shopify.dev/docs/storefronts/themes/delivery-fulfillment/pickup-availability)
- [Hydrogen and Oxygen fundamentals](https://shopify.dev/docs/storefronts/headless/hydrogen/fundamentals)
- [Hydrogen skeleton template](https://github.com/Shopify/hydrogen/tree/main/templates/skeleton)
- [Hydrogen demo store](https://github.com/Shopify/hydrogen-demo-store)
- [Hyvä docs](https://docs.hyva.io/)
- [Hyvä default theme repo](https://github.com/hyva-themes/magento2-default-theme)
- [Hyvä Commerce](https://www.hyva.io/hyva-commerce.html)
- [Hyvä Checkout](https://www.hyva.io/hyva-checkout.html)
- [commercetools Frontend Studio docs](https://docs.commercetools.com/frontend-studio)
- [commercetools page templates](https://docs.commercetools.com/frontend-studio/page-templates)
- [commercetools Dynamic Yield integration](https://docs.commercetools.com/frontend-development/dynamic-yield)
- [commercetools B2B Store](https://commercetools.com/blog/introducing-the-b2b-store-by-commercetools-frontend)
- [Saleor Storefront repo](https://github.com/saleor/storefront)
- [Saleor docs storefront](https://docs.saleor.io/quickstart/storefront)
- [Alokai/Vue Storefront docs](https://docs.alokai.com/storefront/features/storefront-features/)
- [Vue Storefront repo](https://github.com/vuestorefront/vue-storefront)
- [Spryker B2B Demo Shop](https://github.com/spryker-shop/b2b-demo-shop)
- [Spryker storefront templates and slots](https://docs.spryker.com/docs/pbc/all/content-management-system/202404.0/base-shop/manage-in-the-back-office/best-practices-add-content-to-the-storefront-pages-using-templates-and-slots.html)
- [Spryker Composable Storefront](https://read.spryker.com/composable-storefront)
