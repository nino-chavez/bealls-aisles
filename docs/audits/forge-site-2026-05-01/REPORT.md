# Forge-Site Applied to Bealls

**Date:** 2026-05-01
**Subject:** Bealls Aisles demo storefronts (bealls, beallsflorida, homecentric)
**Methodology:** `~/Workspace/dev/tools/forge-site/`
**Author:** Claude (Opus 4.7) for Nino Chavez

---

## TL;DR

Forge-site is an agency playbook built around four archetypes — service-business,
event-organizer, digital-content, portfolio-brand. None of them fit a multi-banner
transactional retailer. The diagnose decision tree explicitly routes "I want to
sell products online" → "None — refer to Shopify/existing platforms."

So the headline finding is a **methodology gap, not a renovation backlog**:

1. Bealls cannot be diagnosed under the current archetype set.
2. Aisles is an AI-composed-storefront prototype. Its existence is the
   *answer* to the gap, not a candidate for forge-site treatment.
3. The actionable output is to extend forge-site with a fifth archetype —
   `transactional-retail` — using Aisles + Bealls as the reference project
   the way Allen Wellness Center is the reference for service-business.

A handful of forge-site modules transfer cleanly (analytics-vercel,
seo-structured-data, cms-sanity for editorial bands, contact-forms for
locator/CS). Most don't — Stripe, Mux, Cal.com, Clerk, feature-gating all
solve problems Bealls doesn't have or solves elsewhere (BigCommerce checkout,
BC-managed accounts, no gated content).

The rest of this report walks the five playbook steps to make the gap
concrete and produces an `archetypes/transactional-retail.md` proposal in
§7.

---

## 1. Recon

Forge-site Step 1 asks fourteen universal questions plus archetype-specific
follow-ups. Bealls answers most of them through prior context — the
questions and their answers are below.

### Business Basics

| # | Question | Answer |
|---|----------|--------|
| 1 | What does the business do? | Three retail banners under one parent (Bealls Inc.): **bealls** (off-price apparel/home), **Bealls Florida** (Florida-coastal lifestyle, separate banner), **HOMEcentric** (home-furnishings content arm, store-discovery only). |
| 2 | Who is the customer? | bealls/BF: value-conscious women 35–65, US South + coastal. HC: home-furnishings shoppers near a HC location. |
| 3 | How do customers find them? | Brand search, paid social (Meta), email, store walk-ins driving online return visits. |
| 4 | Revenue model | Transactional retail (one-time orders + BOPIS). Loyalty program (Bealls Bucks). No subscriptions. |
| 5 | Volume | Real Bealls operates hundreds of stores; the demo is a synthetic catalog (~thousands of SKUs in BC) for prototype purposes. |

### Current State

| # | Question | Answer |
|---|----------|--------|
| 6 | Existing site? | Yes — bealls.com, beallsflorida.com, homecentric.com (the live merchants); the *demo* is a separate fork at the three Vercel preview URLs in `BrandStripNav.svelte:13-16`. |
| 7 | What's working | BC catalog + checkout, established loyalty program, cross-banner SSO, in-store fulfillment. |
| 8 | What's broken (in the *demo*) | Layout still reads generic-DTC vs. real Bealls. Audit findings tracked in `docs/audits/visual-design-2026-05-02/`. |
| 9 | Existing content | BC catalog (products + categories), real bealls.com editorial photography, brand-strip cross-banner navigation pattern, loyalty/Rewards copy. |
| 10 | Existing accounts | BigCommerce (catalog + checkout + storefront app marketplace), Vercel, Upstash (cart store + KV), Neon (per-banner product DBs for Aisles). |

### Goals

| # | Question | Answer |
|---|----------|--------|
| 11 | Primary action | Add to cart → checkout, OR find-in-store. |
| 12 | One thing the site must get right | Faithful brand voice + catalog discoverability. The demo additionally must read as *prototype-of-Aisles*, i.e. the AI-composed zones must be observable. |
| 13 | Timeline | Demo readiness; no hard ship date. |
| 14 | Maintainer | Internal commerce.com team (not the merchant). |

### Existing-Site Audit

Already done thoroughly outside forge-site:

- `docs/audits/visual-design-2026-05-02/REPORT.md` — full UX/UI audit, 4.5/10
  rating, 17-item priority list (Catalyst-comparable + path-B real-Bealls
  reproduction).
- `docs/audits/SYNTHESIS.md` and `BRAND-FIDELITY-COMPARISON.md` — earlier
  multi-banner brand-fidelity work.
- `docs/audits/perf/` — performance pulls.

The recon questions surface no information the existing audits don't already
hold, *except* the last one: forge-site's recon explicitly asks "who will
maintain the site after launch." For real Bealls that answer is "merchant
team" — not the case for the demo, where the maintainer is Nino + future
commerce.com sponsor team. That distinction matters in §3.

---

## 2. Diagnose

Walk the decision tree (`playbook/2-diagnose.md:9-29`):

```
Does the business sell access to digital content?
  └── NO

Does the business run events?
  └── NO

Does the business provide services to customers?
  └── NO

Is this a personal brand, creative portfolio, or media presence?
  └── NO

Does not fit current archetypes.
```

Confirmation from the Quick Match table (line 39):

> "I want to sell products online" → **None — refer to Shopify/existing platforms** — N/A

This is unambiguous. **Bealls fails the diagnose step.** The methodology
acknowledges by design that transactional retail is out of scope.

The Hybrids section doesn't rescue this either. The four hybrids listed are
all *service-business + something*; none describe "transactional retail with
editorial overlay," which is what a banner like Bealls actually is.

### Why this matters

The four current archetypes share a structural assumption: **the site is
the product**. A service-business website is the lead-gen engine; a digital-
content site IS the storefront for the courses; a portfolio is the brand.

Transactional retail breaks that. The site is the **distribution surface**
for a catalog that lives elsewhere (BC, Shopify, custom commerce platform).
The catalog, checkout, fulfillment, payments, returns, and loyalty all sit
in the commerce platform — the website's job is curation, narrative,
discoverability, and conversion-funnel scaffolding *on top of* the catalog.

That's a different shape. It's why Stripe-as-a-module doesn't fit (the
commerce platform owns checkout), why feature-gating doesn't fit (purchase
isn't an access-grant), and why Mux/Cal.com don't fit (no service component).
But it's also why analytics, SEO, structured data, and CMS-driven editorial
*do* fit — those are surface concerns, and the surface is real.

### Forge-site, as currently scoped, cannot prescribe Bealls.

This is the report's headline finding.

---

## 3. Prescribe (best-fit, with caveats)

Despite the gap, several modules transfer. Doing the prescription exercise
honestly:

```yaml
client:
  name: "Bealls Inc. (multi-banner: bealls, beallsflorida, homecentric)"
  domain: "bealls.com / beallsflorida.com / homecentric.com"
  archetype: "transactional-retail (PROPOSED — does not exist in forge-site v1)"

stack:
  framework: "sveltekit"          # already in place; SK 2 + Svelte 5 runes
  catalog_platform: "bigcommerce" # NEW concept — not modeled in forge-site
  commerce_session: "bigcommerce-storefront-graphql + cart-session-cookie"
  database: "neon (per-banner product enrichment DB) + upstash-redis (cart + KV)"
  cms: "none yet — editorial bands are AI-composed via Aisles engine"
  auth: "bc-customer (storefront) + jwt-installer (admin app)"
  payments: "bigcommerce-checkout"  # not stripe
  email: "bigcommerce-transactional"
  analytics: "vercel (already wired)"
  deployment: "vercel"

modules:
  required:
    - "analytics-vercel       # already in place"
    - "seo-structured-data    # NOT in place — gap; Product/Organization/BreadcrumbList JSON-LD"
  recommended:
    - "cms-sanity             # for editorial-only content (lookbook, brand-story, locator copy)"
    - "contact-forms          # store-locator inquiries, CS escalation"
    - "email-resend           # only if forms route outside BC's transactional system"
  deferred:
    - "payments-stripe        # commerce platform owns checkout"
    - "auth-clerk / auth-supabase # BC owns customer accounts"
    - "feature-gating         # no gated-access model"
    - "video-mux              # editorial media stays on YouTube/Vimeo embeds"
    - "booking-calcom         # no service component"
  not_modeled:
    - "catalog-platform-integration  # BC Storefront GraphQL + Catalog v3"
    - "cart-session-state            # cookie-scoped cart replay"
    - "ai-composition-engine         # Aisles' surface-typed schema engine"
    - "in-store-fulfillment          # BOPIS / locator / inventory"
    - "loyalty-program               # Bealls Bucks / Coastal Cash"
    - "brand-family-cross-nav        # the BrandStripNav pattern"
```

The "not modeled" block is the honest list of capabilities Bealls needs
that forge-site has no module for. They are not bugs in forge-site — they're
exactly the capabilities a `transactional-retail` archetype would standardize.

### Ramsay Check

Forge-site Step 3 mandates a scope-reduction pass — what can you cut?

For Bealls demo specifically:

- **Cut:** `cms-sanity` — Aisles' AI engine + brand.config.ts already serve
  this role for the prototype. A real merchant deployment would re-add it
  for non-AI editorial bands.
- **Cut:** `contact-forms` — locator already handles the only inquiry path
  the demo cares about; CS lives in BC.
- **Cut:** `seo-structured-data` for now — demo is gated and not crawled,
  but this is the #1 module to wire before any external launch.
- **Keep:** `analytics-vercel` — already wired.

So the prescription for the *demo specifically* collapses to:
**analytics-vercel, plus the not-modeled stack (BC + Aisles + cart-store +
brand-config) which forge-site doesn't speak to.** Almost everything is
"deferred" or "not modeled."

This is what gap-finding looks like.

---

## 4. Renovate (skip — not the actionable lane)

Step 4 is execution. Renovating the Bealls demo through forge-site doesn't
make sense because:

1. The repo is already built on the Aisles stack (SvelteKit + BC + AI
   composition). Forge-site would prescribe a Next.js + Sanity + Stripe
   stack that doesn't apply.
2. The renovation backlog Bealls actually has is captured in
   `docs/audits/visual-design-2026-05-02/REPORT.md` and the path-B
   real-Bealls reconciliation in the same folder. That's where the work is.
3. Forge-site Step 4's tooling (brand-forge → signal-forge → image-gen) is
   for greenfield client launches; Bealls already has banner brand
   configurations, copy, and editorial assets.

Skipping Step 4 is the right answer here.

---

## 5. Handoff (skip — irrelevant for prototype)

Step 5 hands a finished site to a maintaining client. Bealls demo's
maintainer is its author. There's no handoff event. If the prototype
later becomes a productized template, the handoff target would be
commerce.com internal teams (product / eng / CS), and the artifacts
would be the Aisles documentation in `docs/`, not a forge-site handoff
packet.

---

## 6. The Real Output: A New Archetype

The exercise above produced one durable artifact — a draft fifth
archetype. Bealls + Aisles are the reference project for it the same way
Allen Wellness Center is the reference for service-business.

### Proposed: `archetypes/transactional-retail.md`

```markdown
# Archetype: Transactional Retail

## Description

Multi-product retailers selling physical goods (apparel, home, grocery,
specialty) through a third-party commerce platform. Revenue comes from
catalog transactions; the website is the curated distribution surface
on top of a catalog system that owns checkout, payments, fulfillment,
and customer accounts.

The site's job is discovery, narrative, and conversion scaffolding —
NOT order capture. Order capture lives in the commerce platform.

## Qualifying Criteria

- Revenue is transactional retail (one-time product sales), not services,
  subscriptions, or content access.
- Catalog is owned by a commerce platform (BigCommerce, Shopify, Salesforce
  Commerce Cloud, custom), NOT by the website CMS.
- The commerce platform owns checkout, payments, fulfillment, customer
  accounts, returns.
- The website's role is curation + storytelling + funnel + locator.
- May span multiple banners under one parent (cross-banner nav, shared
  loyalty, distinct brand voices).
- May include in-store fulfillment (BOPIS, locator).

## Reference Projects

| Project | Path | What it proves |
|---------|------|----------------|
| Bealls (Aisles demo) | `~/Workspace/dev/wip/bealls-aisles/` | Multi-banner (3) on shared SvelteKit + BC, AI-composed editorial bands, brand-family cross-nav, BOPIS, loyalty, cart-session-cookie replay |

## Default Stack

- **Framework:** SvelteKit 2 / Svelte 5 (Aisles default) OR Next.js 16
- **Commerce platform:** BigCommerce | Shopify | Commerce Cloud (configurable)
- **Catalog access:** Storefront GraphQL + Catalog REST
- **Cart state:** Platform-cookie scoped (replay tokens, not synthesized)
- **Per-banner data:** Optional Neon/Postgres for enrichment (semantic
  tags, cluster taxonomies — Aisles pattern)
- **Cache layer:** Upstash Redis (cart KV, in-process query caches)
- **CMS:** Sanity for editorial-only bands (lookbook, brand story, locator
  copy); commerce-platform CMS for product PDP copy
- **AI composition (optional):** Aisles surface-typed schema engine for
  AI-composed bands within a deterministic page chrome
- **Auth:** Commerce-platform customer accounts (do NOT add Clerk/Supabase
  for shoppers — only for internal admin)
- **Payments:** Commerce platform (do NOT add Stripe — the platform owns it)
- **Email:** Commerce platform's transactional + Resend for off-platform
  forms (locator, CS escalation)
- **Analytics:** Vercel + GA4 + commerce-platform analytics
- **Deployment:** Vercel

## Required Modules

- `analytics-vercel` — traffic and performance baseline
- `seo-structured-data` — Product, BreadcrumbList, Organization, LocalBusiness,
  Offer, AggregateRating JSON-LD
- `catalog-platform-integration` (NEW) — abstracts BC vs Shopify vs CC
- `cart-session-state` (NEW) — platform-cookie replay pattern

## Recommended Modules

- `cms-sanity` — editorial bands, brand stories, locator content
- `contact-forms` — store-locator inquiries, CS escalation
- `email-resend` — off-platform form delivery
- `loyalty-program` (NEW) — points display, tier badges, rewards copy

## Optional Modules

- `ai-composition-engine` (NEW) — Aisles surface-typed schemas for
  AI-composed bands within deterministic chrome
- `brand-family-nav` (NEW) — cross-banner header strip for parent
  retailers
- `bopis-locator` (NEW) — store finder with pickup-ready inventory

## Excluded Modules

These DO NOT apply to transactional-retail and should not be prescribed:

- `payments-stripe` — commerce platform owns checkout
- `auth-clerk` / `auth-supabase` for shoppers — commerce platform owns
  customer accounts. Use these only for internal admin tooling.
- `feature-gating` — purchase is not an access grant
- `booking-calcom` — no service component
- `video-mux` — product video lives on the commerce platform's media
  service or YouTube/Vimeo

## Typical Sitemap

```
/                           # Homepage (hero, featured rows, editorial, service-callouts)
/category/[slug]            # PLP (filters, sort, grid, cluster-chip-row)
/category/[slug]/[sub]      # nested PLP
/product/[slug]             # PDP (gallery, specs, BOPIS picker, recs)
/cart                       # Cart (line items, summary, last-chance-upsell)
/checkout                   # Handoff to commerce platform OR custom checkout
/store-locator              # BOPIS / find-a-store
/store/[slug]               # Per-store page (hours, directions, services)
/rewards                    # Loyalty program copy (link to platform account)
/account/*                  # Commerce-platform-hosted (do not rebuild)
/lookbook                   # Editorial (Sanity-managed)
/about                      # Brand story
/help                       # CS / FAQ
```

For multi-banner retailers, add `/[banner]` prefix or deploy each banner
as its own Vercel project (Aisles pattern: three Vercel projects sharing
this codebase, branch-keyed by `BRAND_ID` env var).

## Critical SEO

Product schema is non-negotiable for retail. Required JSON-LD per page:

| Page | Schema(s) |
|------|-----------|
| Root | Organization, WebSite |
| PLP | BreadcrumbList, ItemList |
| PDP | Product, Offer, AggregateRating, BreadcrumbList |
| Store page | LocalBusiness with geo + openingHours |
| /help/[faq] | FAQPage |

## Performance Constraints

Retail PLPs and PDPs have unique cost shapes:

- **PLP rendering ceiling:** virtualize at 500 rows (per `~/.claude/CLAUDE.md`
  IA/UX audit scope rules).
- **Server-side filter/sort:** never ship rows the client won't render.
- **Image optimization:** product imagery is the dominant LCP factor.
  Mandate `srcset` + AVIF/WebP + above-fold preloading.
- **Cart-page caching:** never. Cart state is per-session-cookie and
  must skip CDN cache.

## Anti-Patterns (Don't Do)

- Don't synthesize a cart in your own DB. Replay the commerce platform's
  cart-session cookie. (See `aisles_bc_cart_session_cookie` memory.)
- Don't gate the catalog behind auth. Browse is anonymous; account is
  optional and platform-owned.
- Don't rebuild the checkout. Hand off to the commerce platform OR use
  its embedded checkout SDK.
- Don't model loyalty in your DB. Read it from the commerce platform's
  customer object.

## Hybrid Considerations

- **Retail + content:** A retailer with a strong editorial arm
  (e.g., Anthropologie's stories, REI's expert advice) gets
  transactional-retail as primary + cms-sanity for the editorial section
  (NOT the digital-content archetype, which assumes content IS the product).
- **Retail + locator-heavy:** A retailer where store visits drive most
  revenue (e.g., HOMEcentric in the Bealls family) gets transactional-retail
  with `mode: 'content'` config — catalog browse stays available but the
  primary CTAs route to locator. Aisles models this via
  `brand.config.ts:mode = 'content' | 'transactional'`.
- **Retail + service:** Retailer with installation services (e.g., a
  flooring retailer) gets transactional-retail primary + service-business
  module-set for the install side (booking-calcom, contact-forms,
  estimate flow).
```

That archetype file is what the exercise actually produced. It belongs in
`~/Workspace/dev/tools/forge-site/archetypes/transactional-retail.md` if
the methodology owner (Nino) wants to extend forge-site to cover this case.

---

## 7. New Modules That Would Need to Exist

The proposed archetype references modules forge-site doesn't have today.
For full coverage, these would need to be authored:

| Module | Purpose | Reference in Aisles |
|--------|---------|---------------------|
| `catalog-platform-integration` | BC / Shopify / CC abstraction layer for product fetch, search, category trees | `src/lib/server/bc/*` |
| `cart-session-state` | Platform-cookie replay pattern (do NOT synthesize) | `src/lib/server/cart-store.ts`, `src/routes/api/cart/+server.ts` |
| `ai-composition-engine` (optional) | Surface-typed Zod schema → JSON-mode LLM → deterministic render | `src/lib/schema/blocks.ts`, `src/lib/server/layout-prompt.ts`, `src/lib/foundation/zone-schemas.ts` |
| `brand-family-nav` | Cross-banner header strip for parent retailers | `src/lib/components/BrandStripNav.svelte` |
| `bopis-locator` | Store finder with pickup-ready inventory | `src/lib/components/layouts/sections/BOPISPicker.svelte`, `LocatorStrip.svelte` |
| `loyalty-program` | Points display, tier badges, rewards copy (read-only from platform) | `brand.config.ts:incentives` |

Each would follow the existing module-file shape (`Purpose / Used By /
Dependencies / Produces / Reference Implementation`).

---

## 8. Modules That Transfer Cleanly

For completeness — these existing forge-site modules apply to
transactional-retail without modification:

| Module | How it applies |
|--------|----------------|
| `analytics-vercel` | Required, no changes |
| `seo-structured-data` | Required, with Product/Offer/BreadcrumbList JSON-LD added to the schema mapping table |
| `cms-sanity` | Recommended, for editorial-only bands (NOT product PDP copy — that lives in the commerce platform) |
| `contact-forms` | Recommended, for locator inquiries / CS escalation |
| `email-resend` | Optional, only if forms route outside the commerce platform |

The seo-structured-data module specifically would benefit from a fifth
schema-by-archetype subsection — easy edit; the existing structure
already accommodates it.

---

## 9. What This Means For Bealls (Today)

**Nothing changes today.** The Bealls demo's renovation backlog is
already captured in:

- `docs/audits/visual-design-2026-05-02/REPORT.md` — visual/design audit
- `docs/audits/visual-design-2026-05-02/REAL-BEALLS-REFERENCE.md` — path B
- `docs/audits/SYNTHESIS.md` — earlier brand-fidelity work

Forge-site has no prescription for Bealls beyond the modules listed in §3,
and most of those are deferred or not-modeled. This audit's value is
upstream of Bealls — it's a recommendation for how to extend forge-site.

### Recommended next steps (in order of leverage)

1. **Decide whether to extend forge-site.** If yes, copy §6's archetype
   draft to `~/Workspace/dev/tools/forge-site/archetypes/transactional-retail.md`
   and create the module stubs from §7. If no, file this report as
   "methodology gap noted, not pursued."
2. **If extending:** wire `seo-structured-data` for retail in advance —
   it's the one module that genuinely improves the Bealls demo if it
   ever launches publicly, and its schema-mapping addition is small.
3. **If extending:** treat Aisles' `src/lib/foundation/` and
   `src/lib/schema/` as the canonical reference for the
   `ai-composition-engine` module — that module is the differentiator
   forge-site would gain by absorbing this archetype.

---

## 10. Honest Assessment

Running forge-site against Bealls produced one substantive deliverable
(the new archetype draft) and confirmed three things:

1. Forge-site is well-scoped for what it covers. The decision tree
   correctly refuses Bealls rather than fake-fitting it.
2. Transactional retail is the largest missing surface, and Aisles has
   already produced the patterns a retail archetype would need.
3. The Bealls demo itself has no actionable forge-site backlog — the
   real work continues to be the design/UX audits already in flight.

If the goal of this exercise was to find renovation work for Bealls, the
answer is "look at the visual-design audits, not this report." If the goal
was to stress-test forge-site's coverage, the answer is "forge-site needs
a fifth archetype, and Aisles is its reference project."
