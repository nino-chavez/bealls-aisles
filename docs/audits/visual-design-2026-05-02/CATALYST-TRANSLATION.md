# Catalyst → Bealls design-token translation

**Date:** 2026-05-02
**Source:** [`bigcommerce/catalyst`](https://github.com/bigcommerce/catalyst), `core/vibes/soul/` design system (called "Vibes")
**Target:** `bealls-aisles/src/app.css` + `src/lib/components/layouts/sections/`
**Companion:** [`REPORT.md`](./REPORT.md) (the agency-POV audit findings this translation acts on)

---

## 1. Why Catalyst as the baseline

Catalyst is BigCommerce's reference Next.js storefront. Same merchant audience as Aisles, BC-native chrome conventions, actively maintained, and its `Vibes/Soul` design system is BC's *own opinion* on what a 2026 storefront looks like. Adopting its token + primitive vocabulary gets us "BC-native modern" without inventing our own design language in isolation.

We don't lift JSX — Aisles is SvelteKit, Catalyst is Next.js + React. We lift:

- The token architecture (HSL channels in CSS variables, `color-mix(in oklab, ...)` for derived states)
- The component variant taxonomy (button: primary/secondary/tertiary/ghost/danger × large/medium/small/x-small × pill/rounded/square/circle)
- The rhythm: heights, gaps, paddings, radii
- The composition patterns (product card aspect ratios, price-label sale shape, chip removal interaction)

Where Catalyst is generic (off-price apparel-specific patterns, megamenu density, comparable-value pricing), we layer in **Old Navy / Nordstrom Rack / Target** as the category benchmark. Those are noted inline.

---

## 2. Token architecture — what to copy verbatim

### 2.1 HSL channels in CSS variables

Catalyst uses HSL split into channels so theming is composable:

```css
:root {
  --primary: 96 100% 68%;          /* H S L — note: no comma, no hsl() wrapper */
  --foreground: 0 0% 7%;
  --background: 0 0% 100%;
  --contrast-100: 0 0% 93%;
  --contrast-200: 0 0% 82%;
  --contrast-300: 0 0% 70%;
  --contrast-400: 0 0% 54%;
  --contrast-500: 0 0% 34%;
  /* ... */
}

/* Consumed via hsl(var(--primary)) wherever needed */
.thing { background: hsl(var(--primary)); }
```

**Why this is better than what Aisles does today:** the current `app.css` defines tokens as full hex values (`--color-primary: #c8102e`). That blocks the derivation pattern below. Migrate to HSL channels and you get hover/active/disabled states for free via `color-mix`.

### 2.2 Derived states via `color-mix(in oklab, ...)`

Catalyst computes hover/highlight/shadow programmatically:

```css
--button-primary-background: hsl(var(--primary));
--button-primary-background-hover: color-mix(in oklab, hsl(var(--primary)), white 75%);
--badge-primary-background: color-mix(in oklab, hsl(var(--primary)), white 75%);
```

`oklab` (perceptually uniform) gives you accurate lightening/darkening without the muddy purples HSL-mixing produces. Browser support: 95%+ (Chrome 111, Safari 16.4, FF 113 — all 2023). Safe to use.

**Adopt for:** button hover states, badge backgrounds, card hover lifts, chip remove-button hover, every "lighter/darker variant of brand color" need.

### 2.3 Contrast scale (5 steps)

`--contrast-100` through `--contrast-500` is a neutral grayscale ramp. Use it for borders, dividers, secondary text, disabled states. The 5-step granularity is enough for any UI without proliferating palette decisions.

```
contrast-100 → light dividers, card backgrounds
contrast-200 → input borders, button-tertiary borders
contrast-300 → blockquote borders, secondary dividers
contrast-400 → placeholder text, disabled states
contrast-500 → secondary body text, ul/ol/code
```

### 2.4 Type scale (six steps + heading variation settings)

```css
--font-size-xs: 0.75rem;     /* 12px — labels, microcopy, badges */
--font-size-sm: 0.875rem;    /* 14px — body small, captions */
--font-size-base: 1rem;      /* 16px — body */
--font-size-lg: 1.125rem;    /* 18px — body large */
--font-size-xl: 1.25rem;     /* 20px — H4 */
--font-size-2xl: 1.5rem;     /* 24px — H3 */
/* H2 / H1 are typically 2xl scaled by component */

--font-variation-settings-heading: 'slnt' 0;  /* slant axis for variable fonts */
--font-variation-settings-body: 'slnt' 0;
```

**Adopt as-is.** Tailwind already aligns at xs/sm/base/lg/xl/2xl, so this is mostly a renaming/source-of-truth move.

### 2.5 Shadow scale

```css
--shadow-sm:   0 1px 2px 0 rgba(0,0,0,.05);
--shadow-base: 0 1px 3px 0 rgba(0,0,0,.1), 0 1px 2px 0 rgba(0,0,0,.06);
--shadow-md:   0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -1px rgba(0,0,0,.06);
--shadow-lg:   0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -2px rgba(0,0,0,.05);
--shadow-xl:   0 20px 25px -5px rgba(0,0,0,.1), 0 10px 10px -5px rgba(0,0,0,.04);
```

Aisles currently has zero shadow tokens — every component is flat-bordered. The audit P2 item "Card shadow/border system" maps directly to adopting `--shadow-sm` on cards + `--shadow-md` on hover.

---

## 3. Token translation table — Catalyst → Bealls

The Bealls brand red stays. Everything else in the grayscale ramp + states is borrowed from Catalyst's structure with Bealls hue values plugged in.

### 3.1 New `app.css` `:root` (proposed)

```css
:root {
  /* ─── Brand ──────────────────────────────────────────────────── */
  /* Bealls red #c8102e → HSL: hsl(351, 85%, 42%) */
  --primary: 351 85% 42%;

  /* Foreground / background — keep current cream/black */
  --foreground: 0 0% 7%;          /* near-black */
  --background: 30 33% 98%;       /* cream — current brand surface */

  /* Contrast scale — neutral grayscale */
  --contrast-100: 30 12% 94%;     /* light dividers, light card bg */
  --contrast-200: 30 10% 86%;     /* input borders, secondary dividers */
  --contrast-300: 30 8% 70%;      /* blockquote borders */
  --contrast-400: 30 6% 54%;      /* placeholder, disabled */
  --contrast-500: 30 4% 34%;      /* secondary body */

  /* Semantic states — keep close to Catalyst defaults; tune red so it doesn't
     fight the brand red. Bealls error becomes a deeper red distinct from the
     brand action red. */
  --success: 145 65% 42%;         /* "ready for pickup" green-ish */
  --error: 4 80% 50%;             /* darker than --primary */
  --warning: 35 95% 55%;
  --info: 210 70% 45%;

  /* Type — replace forge-brand kit residue (DM Sans / DM Serif).
     Bealls config specifies Plus Jakarta Sans display + Inter body. */
  --font-family-heading: 'Plus Jakarta Sans', system-ui, sans-serif;
  --font-family-body: 'Inter', system-ui, sans-serif;
  --font-family-mono: ui-monospace, SFMono-Regular, Menlo, monospace;

  --font-variation-settings-heading: 'slnt' 0;
  --font-variation-settings-body: 'slnt' 0;

  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 2rem;          /* added — H2 */
  --font-size-4xl: 2.5rem;        /* added — H1 small */
  --font-size-5xl: 3.5rem;        /* added — H1 hero */
  --font-size-6xl: 5rem;          /* added — editorial hero (Old Navy / Anthropologie scale) */

  /* Shadows — adopt verbatim */
  --shadow-sm:   0 1px 2px 0 rgba(0,0,0,.05);
  --shadow-base: 0 1px 3px 0 rgba(0,0,0,.1), 0 1px 2px 0 rgba(0,0,0,.06);
  --shadow-md:   0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -1px rgba(0,0,0,.06);
  --shadow-lg:   0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -2px rgba(0,0,0,.05);

  /* Radius — Catalyst uses pill (rounded-full) for buttons, rounded-xl for cards.
     Adopt their three values. */
  --radius-sm: 0.25rem;     /* 4px — chips, badges */
  --radius-md: 0.5rem;      /* 8px — inputs, secondary cards */
  --radius-lg: 0.75rem;     /* 12px — primary cards */
  --radius-xl: 1rem;        /* 16px — product cards */
  --radius-pill: 9999px;    /* buttons */
}
```

### 3.2 What `app.css` currently has that needs to die

Per the audit findings, `app.css` currently leaks tokens from a `forge-brand` kit:

```
--font-body: 'DM Sans'           ← KILL — should be Inter via brand config
--font-display: 'DM Serif'       ← KILL — should be Plus Jakarta Sans
@theme primary: #a3522d          ← KILL — that's a different brand entirely
```

Reconciliation: `app.css` reads tokens from the runtime theme injection (set in `+layout.svelte` from brand config). The `@theme` block in `app.css` should only define the universal token *structure* (HSL channels, scales, spacing), not the per-brand values. Per-brand values come from `getBrand()`.

---

## 4. Component primitive translations

Catalyst's `vibes/soul/primitives/` has 30+ primitives. The translation below covers the 12 highest-leverage ones for our Bealls components.

### 4.1 Button — `Button.svelte` (need to create)

**Catalyst structure:** 5 variants × 4 sizes × 4 shapes = 80 valid configurations. Loading state with spinner. CSS-variable-driven for full theming. Hover effect uses `::after` pseudo-element that slides in from -105% on hover (subtle, modern).

**Bealls translation:**

| Catalyst | Bealls | Use case |
|---|---|---|
| `variant="primary"` | `variant="primary"` | Add to Cart, Checkout, Apply Promo, Sign Up — the brand-red CTAs |
| `variant="secondary"` | `variant="secondary"` | "Find in store", "Continue shopping", page-secondary actions (currently dark/black in our UI; would become inverted-black on cream) |
| `variant="tertiary"` | `variant="tertiary"` | "Compare", "Add to Picks", neutral UI actions (currently outlined-neutral) |
| `variant="ghost"` | `variant="ghost"` | Toolbar buttons, header icon buttons, anything inside a tight container |
| `variant="danger"` | `variant="danger"` | "Remove from cart", account "Delete address" — distinct from the brand action red |

| Size | Min height | Padding x | Use case |
|---|---|---|---|
| `large` | 56px | 24px | Hero CTAs (Add to Cart on PDP, Checkout on cart) |
| `medium` | 48px | 20px | Secondary actions, form submits |
| `small` | 40px | 16px | Inline "Apply", quick-add buttons |
| `x-small` | 32px | 12px | Toolbar, dev overlay, badges-with-action |

| Shape | Use case |
|---|---|
| `pill` (default) | Hero CTAs — Catalyst's default; Old Navy/Target both use pill primary CTAs in 2026 |
| `rounded` | Form submits, modals — when pill feels too informal |
| `square` | Tabular UI, side-by-side button rows |

**Reference for Bealls specifically:** Old Navy uses pill primary CTAs at ~52px tall on desktop with 28px horizontal padding. Nordstrom Rack uses square primary CTAs (more "outlet" energy). Bealls voice ("smart pick, value-driven, family-first") tracks closer to Old Navy → **default to pill**.

### 4.2 Product card — `ProductCard.svelte` (replace ad-hoc cards)

**Catalyst structure:** Product card with image (5:6 / 3:4 / 1:1 aspect ratios), badge overlay (top-left), compare action (top-right), price label, optional rating, inventory message. Light/dark color schemes. `@container` query for responsive density.

**Audit-relevant takeaways:**
- Aspect ratio is enforced — current Bealls cards have inconsistent image dimensions
- Badge slot is on the *card*, not below the image — "ON SALE" / "NEW" / "BESTSELLER" overlays
- Card font-family is configurable (default body) — matches Catalyst's "primary tokens drive everything" pattern

**Bealls fix-list mapping:**
- Audit P0 §3.7 (text-only category tiles): the Catalyst pattern requires images; adopt the aspect-ratio enforcement
- Audit P1 §4.4 (PDP gallery): Catalyst's `Image` component handles `priority` + `sizes` for above-the-fold optimization

### 4.3 Price label — `PriceLabel.svelte` (need to create — currently rendered inline in cards)

**Catalyst structure:** Three price types: `string` (regular), `range` (min-max), `sale` (previousValue + currentValue with strikethrough on previous). Light/dark color schemes.

**Audit P1 §4.2 directly maps:** Bealls' brand config declares `pricingStyle: 'off-price'` — every price should render as comparable-value-plus-savings format. Catalyst's `sale` type is the closest pattern; we'd extend it with a savings-percent calculation.

**Proposed Bealls extension:**

```svelte
<!-- PriceLabel.svelte, off-price variant -->
{#if salePrice && listPrice && salePrice < listPrice}
  <div class="off-price">
    <span class="current">${salePrice}</span>
    <span class="comparable">Comparable value ${listPrice}</span>
    <span class="savings">You save {savingsPct}%</span>
  </div>
{:else}
  <span class="current">${price}</span>
{/if}
```

**Reference:** Nordstrom Rack and TJ Maxx both use the "Comparable value $X — You save Y%" pattern. It's the off-price visual signature — the brand voice already wants it; the components just don't render it.

### 4.4 Badge — `Badge.svelte` (need to create)

Catalyst: 5 variants (primary/warning/error/success/info), 2 shapes (pill/rounded), tracking-tighter uppercase mono font. Used for product card badges (ON SALE, NEW, BESTSELLER), order status, locator pickup-readiness.

**Currently in Bealls:** ad-hoc spans with brand-red backgrounds for cart count, green dots for BOPIS readiness. No system. Consolidate to `Badge.svelte` with the Catalyst variants.

### 4.5 Chip — `Chip.svelte` (NEW — drives the audit P0 §3.3 fix)

```svelte
<!-- Catalyst's chip is a removable filter token -->
<span class="chip">
  Size: M
  <button onclick={remove} aria-label="Remove">×</button>
</span>
```

Visual: `bg-contrast-100`, 36px tall, 12px x 8px padding, `rounded-lg`, x-icon in a small circle that hovers to `bg-contrast-200`.

**This is the missing primitive that blocks PLP filter UX.** Once `Chip.svelte` exists, the filter strip becomes a row of chips above the grid. The audit P0 "no filter/sort UI" fix lives or dies on this primitive landing first.

### 4.6 Dropdown / Sort selector

Catalyst uses Radix UI primitives (`@radix-ui/react-navigation-menu`, `@radix-ui/react-dropdown-menu`). Aisles is SvelteKit — equivalent: [`bits-ui`](https://www.bits-ui.com/) or [`melt-ui`](https://melt-ui.com/) (both Svelte-native, similar API, accessible).

**Recommendation:** adopt `bits-ui` for the dropdown menu, navigation menu, popover, modal primitives. Match Catalyst's structure 1:1.

### 4.7 Skeleton

Catalyst has skeleton loaders for product cards. Aisles has `AILoadingInline` (the AI-composed-zone loader) which is great for engine zones, but doesn't cover the foundation primitives (image loading, cart fetch, account orders). Add a generic `Skeleton.svelte` for image + text placeholder shapes.

### 4.8 Modal

Catalyst uses a Radix-based modal. Aisles' admin modal pattern (Persona Fit override modal) works fine but uses BC big-design. The storefront has no modal primitive. Cart-empty CTA → "Continue shopping" + a guest-checkout invitation could live in a modal. Adopt the pattern.

### 4.9 Side panel (cart drawer)

Catalyst has `side-panel` primitive — slides in from right, full-height, fixed width on desktop. Our `CartDrawer.svelte` is essentially this pattern; rename/refactor for clarity.

### 4.10 Toaster (notifications)

Audit P1 §4.7 ("Cart drawer doesn't open on add-to-cart") — fix could be the drawer OR a toast. Catalyst has `Toaster` for ephemeral confirmations. Add a `Toast.svelte` to Aisles and use it for "Added to bag — view cart" type confirmations.

### 4.11 Rating / Stars

Catalyst's Rating: half-star precision, ARIA-described, color via `--rating-active-color`. Audit P2 finding ("muddy gold/ochre stars") is fixed by adopting Catalyst's tokenized rating component and pinning `--rating-active-color` to a saturated gold or to `--primary`.

### 4.12 Animated underline

Catalyst has a hover animation for nav links — underline grows from left on hover. Mid-2020s subtle motion. Adopt for top-nav, breadcrumb links, footer links.

---

## 5. Section-level patterns to adopt

Beyond primitives, Catalyst's `vibes/soul/sections/` has full surface compositions. Three are directly relevant to our audit P0 fixes:

### 5.1 `header-section`
Megamenu pattern: top-nav opens a 3-column dropdown with category groups, featured product, promo card. **Audit P1 §4.6** ("inter-brand switcher position") + the absent megamenu both improve when we adopt this. Catalyst's header is the BC-native modern reference.

### 5.2 `products-list-section`
Filter strip (vertical sidebar OR horizontal chip row), sort selector, paginated grid, results count, mobile filter drawer. **Audit P0 §3.3 (no filter UI) maps 1:1.** We don't need to lift the JSX — we lift the *layout*: sort selector top-right, filter chips horizontal across the top, "X of Y results" inline, grid below.

### 5.3 `product-detail`
PDP layout with image gallery (thumbnails on the left, hero on the right OR carousel below at narrow widths), variant selector, ATC, accordion description tabs. **Audit P1 §4.3 (concatenated description) + §4.4 (no thumbnails) both addressed.**

---

## 6. Component-level fix list (mapped to audit findings)

Ordered by leverage. Each item is one PR.

| # | Audit ref | Component | Fix | Effort |
|---|---|---|---|---|
| 1 | §3.1 (P0) | `app.css` | Migrate brand red to HSL channels: `--primary: 351 85% 42%`. Update theme tokens. | 30 min |
| 2 | §4.9 (P1) | `app.css` | Delete forge-brand kit residue (`DM Sans`, `DM Serif`, `#a3522d`). Wire Plus Jakarta Sans + Inter from brand config. | 30 min |
| 3 | §3.1 (P0) | `Button.svelte` (NEW) | Create primitive with 5 variants × 4 sizes × pill default. Replace every `class="bg-surface-fg ..."` button instance. | 3 hours |
| 4 | §3.1 (P0) | `AddToCartBar.svelte`, `CartSummary.svelte`, `LocatorStrip.svelte`, `BOPISStrip.svelte` | Swap to `<Button variant="primary" size="large">`. Brand-red CTAs across the funnel. | 1 hour |
| 5 | §3.7 (P0) | `CategoryTileGrid.svelte` | Wire to BC category-image field (or fixture); enforce 5:6 aspect ratio with object-cover. | 1 hour |
| 6 | §3.3 (P0) | `Chip.svelte` (NEW) + `FilterStrip.svelte` (NEW) | Adopt Catalyst's chip + horizontal filter strip pattern. Wire to PLP + search server-load filters. | 4 hours |
| 7 | §3.3 (P0) | `SortSelector.svelte` (NEW) | Catalyst dropdown pattern via `bits-ui`. Sort options: Newest · Price low/high · Bestsellers · Most-reviewed. Default per-persona (gatherer→Newest, hunter→Price low). | 2 hours |
| 8 | §4.2 (P1) | `PriceLabel.svelte` (NEW) | Catalyst's `Price` type extended with off-price variant: `Comparable value $X · You save Y%`. Used by `ProductGrid`, `CartLineItems`, `PDP`. | 2 hours |
| 9 | §3.4, §3.5, §3.6 (P0) | `+page.server.ts` paths | Functional bug fixes: `/category/home` editorial fallback guard, `/checkout` redirect to `/cart` if no session, dedup 404 rendering. | 2 hours |
| 10 | §4.3 (P1) | PDP `+page.server.ts` `synthesizeDescriptionTabs` | Format BC attribute string into labelled key-value rows. | 30 min |
| 11 | §4.4 (P1) | `ImageGallery.svelte` | Multi-image gallery with thumbnails (Catalyst pattern); render placeholder thumbnails when SKU has 1 image. | 2 hours |
| 12 | §4.7 (P1) | `Toast.svelte` (NEW) | Adopt Catalyst toaster for "Added to bag" confirmations. Trigger from `AddToCartBar`. | 1.5 hours |
| 13 | §4.10 (P1) | `account/+page.svelte` | Read tier names from `getBrand().incentives.loyaltyTiers` instead of hardcoded `Gold/Platinum`. | 30 min |
| 14 | §4.5, §4.6 (P1) | `BrandStripNav.svelte` | Mobile collapse: hide inter-brand tabs at <768px behind a "More from Bealls family" disclosure. | 1 hour |
| 15 | P2 | `app.css` | Add shadow scale (`--shadow-sm`/`-md`/`-lg`). Apply `shadow-sm` on cards default + `shadow-md` on hover. | 30 min |
| 16 | P2 | All cards | Cross-component: rounded-xl on product cards, rounded-lg on secondary cards, rounded on chips/badges. Spacing rhythm to 8px grid. | 2 hours |
| 17 | P2 | Top-nav | `AnimatedUnderline.svelte` (Catalyst pattern) on nav links. | 1 hour |

**Total estimated effort:** ~25 hours = 3-day focused sprint for a single dev. The audit's "5-day sprint" included QA + handoff doc, which extends to 5.

---

## 7. What we're NOT adopting (and why)

- **Catalyst's React/Next.js architecture** — Aisles is SvelteKit, by design (server-rendering the full layout JSON contract is cleaner with SvelteKit's load functions). Lift patterns, not framework.
- **Catalyst's translation infrastructure** (`useTranslations`, `next-intl`) — Aisles is single-locale by scope. Skip.
- **Catalyst's `@conform-to/react` form library** — overkill for the storefront. Native `<form>` + SvelteKit actions is enough.
- **Catalyst's full Vibes section library** — 25+ sections, most of which Aisles already has equivalents for. Lift the ones audit findings name (header, products-list, product-detail); don't grab the whole closet.
- **Catalyst's `compare-drawer`** — comparison shopping isn't part of the Bealls value prop (off-price family retail; shoppers compare across stores, not within a store). Skip.

---

## 8. Quick references

**Old Navy** for off-price-apparel-specific patterns:
- PLP filter chips above grid (size, color, fit, price, rating)
- Hero with massive type + value prop (e.g. "$5 tees, today only" at ~96px)
- Pill primary CTAs at ~52px tall

**Nordstrom Rack** for the "Comparable value" pricing display:
- `$24.97 · Compare at $60` is the canonical off-price treatment
- Strikethrough on `$60` is muted gray, `$24.97` is bold black, optional `Save 58%` chip in red

**Target** for trust-strip + free-shipping execution:
- Free-shipping promo bar slides up on scroll
- Order-status timeline in account dashboard

**ThredUp** for AI-native UX patterns that aren't a chatbot:
- "We thought you'd like…" inline AI suggestions in browse
- Persona-aware sort defaults
- Smart filter suggestions ("People who bought tropical print also filtered by size M")

---

## 9. Next moves

This is a translation document — not a refactor. Sequencing for execution:

1. **Day 1 morning:** ship items #1 + #2 (token migration + forge-brand kit cleanup). Visible on every page.
2. **Day 1 afternoon:** ship item #3 + #4 (button primitive + brand-red CTAs). The marquee fix. Audit's "single biggest brand-credibility fix".
3. **Day 2:** items #5 + #6 + #7 (category tiles with imagery + filter strip + sort selector). Demo-ready.
4. **Day 3:** items #8 + #9 + #10 (off-price pricing + functional bugs + PDP description). Trust + correctness.
5. **Day 4:** items #11 + #12 + #13 + #14 (image gallery, toast, tier names, mobile nav). Polish + completeness.
6. **Day 5:** items #15 + #16 + #17 (shadow system, radius rhythm, animated underline). Trend layer.

This translation document plus the [`REPORT.md`](./REPORT.md) is the design-handoff package for that sprint.
