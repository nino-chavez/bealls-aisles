# Aisles Design System — Contract

**Date:** 2026-05-02
**Status:** Living contract. Update when the layered model changes.
**Audience:** anyone making a visual change to the Bealls fork.

> **Pre-flight rule.** Read §1 (token contract) and §6 (verification gate) before any
> change to `app.css`, `brand/config.ts`, `+layout.svelte`, or a foundation primitive.
> The audits in `docs/audits/` document *what* and *why*; this doc documents *the
> contract that the implementation must hold to*.

---

## 1. The three-layer token model

Aisles' design tokens live in three places. Each layer has a distinct job. Removing
or skipping a layer breaks the next one silently.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3 — brand/config.ts                                  │
│  Canonical per-brand values (bealls cherry, BF blue, HC     │
│  forest). Source of truth for what each banner LOOKS like.  │
└──────────────┬──────────────────────────────────────────────┘
               │ runtime injection on every page load
               ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2 — +layout.svelte:30 themeStyle inline-style        │
│  Sets --color-primary, --color-accent, etc. on a wrapping   │
│  <div>, scoped to the active brand. Overrides Layer 1.      │
└──────────────┬──────────────────────────────────────────────┘
               │ classes resolve to var(--color-*) at render
               ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 1 — app.css @theme block                             │
│  Build-time slot declarations. Gates Tailwind v4 utility    │
│  generation. Without a slot here, the utility doesn't       │
│  exist — runtime injection has nothing to apply.            │
└─────────────────────────────────────────────────────────────┘
```

### 1.1 Why @theme matters in Tailwind v4

Tailwind v4 generates utility classes (`bg-primary`, `text-accent`, `bg-surface-fg`)
**only for color names declared in `@theme`**. The compiled CSS for `.bg-primary` is
roughly:

```css
.bg-primary { background-color: var(--color-primary); }
```

If `--color-primary` is not in the `@theme` block at build time, Tailwind does not
emit `.bg-primary` at all. The class becomes a no-op string. Setting the variable at
runtime via `style="--color-primary:#aa182c"` does nothing — there's no rule that
reads it.

**This is the failure mode that caused the 2026-05-02 regression** where the
cross-brand strip, persistent shipping promo, brand-red CTAs, and brand-red logo all
disappeared from the canonical Vercel deploy. The "kill forge-brand kit residue"
cleanup removed the wrong values *and* the structural slots Tailwind needs to
generate utilities. Runtime injection couldn't compensate.

### 1.2 Required @theme slots (Layer 1)

`src/app.css` `@theme` block must declare these slots. Values are placeholders;
Layer 2 overrides them. **Never remove a slot — change its value if needed.**

| Slot | Purpose | Placeholder |
|---|---|---|
| `--color-primary` | Brand primary action — CTAs, sale badges, active states | `#aa182c` (bealls cherry) |
| `--color-secondary` | Brand secondary — hover, deeper accent | `#7d2540` (bealls cranberry) |
| `--color-accent` | Brand chrome — top brand-strip bg, footer | `#330A3D` (bealls wine) |
| `--color-surface-bg` | Page background | `#ffffff` |
| `--color-surface-fg` | Default text on bg | `#1a1a1a` |
| `--color-surface-card` | Card background | `#ffffff` |
| `--color-surface-card-fg` | Text on card | `#1a1a1a` |
| `--color-surface-muted` | Subdued surface (eyebrow rails, dividers) | `#f6f6f6` |
| `--color-surface-muted-fg` | Text on muted | `#5a5a5a` |
| `--color-surface-border` | Borders | `#e5e5e5` |

Brand-neutral slots that stay in `@theme` (no runtime override):

| Slot | Purpose |
|---|---|
| `--color-success` / `-warning` / `-error` / `-info` | Semantic state colors, brand-agnostic |
| `--color-neutral-{50..950}` | Grayscale ramp |
| `--shadow-sm` / `-base` / `-md` / `-lg` | Shadow scale (Catalyst-derived) |

### 1.3 Layer 2 — runtime injection contract

`src/routes/+layout.svelte:29-31` builds an inline `style` string from
`data.brand.theme` and applies it to a wrapping `<div>`:

```svelte
<div style={themeStyle}>
  <!-- everything renders inside; CSS vars cascade -->
</div>
```

The themeStyle string sets `--color-primary`, `--color-secondary`, `--color-accent`,
all `--color-surface-*`, and `--font-*`. This is the *only* place per-brand color
values are injected. **Do not duplicate brand values in `@theme` or in component
files.** If you find yourself writing `bg-[#aa182c]` instead of `bg-primary`, stop —
the runtime layer should be doing the work.

### 1.4 Layer 3 — brand/config.ts canonical values

`src/lib/brand/config.ts` is the single source of truth for what each banner looks
like. The `theme` object maps to the slot names in §1.2 exactly. The current active
brands per memory are `bealls`, `beallsflorida`, `homecentric`. Deprecated brand
entries (haven, volt, ember) have been removed; do not add them back.

---

## 2. Chrome inventory

Chrome is defined as: **always rendered on every non-Observe page, never
AI-composed, deletion requires an ADR.**

| Element | Source | Renders when | Notes |
|---|---|---|---|
| BrandStripNav | `+layout.svelte:134` → `BrandStripNav.svelte` | Active brand is in the bealls family (bealls / beallsflorida / homecentric) | Cross-banner cherry/wine strip with active-tab highlight + locator/help links |
| Persistent shipping promo | `+layout.svelte:135-141` | `data.brand.shippingPromo` is truthy (driven by `incentives.freeShippingThresholdMinor`) | Single-line bg-primary strip; copy comes from config |
| Top Nav | `+layout.svelte:142-149` → `Nav.svelte` | Always (storefront mode) / mode-aware variant on content brands | Logo + categories + utility icons (account / picks / cart) |
| Footer | `+layout.svelte:153` → `Footer.svelte` | Always | Brand strip echo, link columns, brand mention |

**Rules:**
- Chrome elements cannot be conditionally hidden by an audit pass. If an audit
  thinks a chrome element should go, that's an ADR conversation, not an edit.
- Chrome elements must render correctly across all three banners. A change to one
  banner's chrome requires verification on the other two.
- The Observe dashboard is the only chrome-less surface (`isObserve` short-circuit
  at `+layout.svelte:130-131`). Adding new chrome-less surfaces requires an ADR.

---

## 3. Foundation primitives

Foundation primitives are deterministic UI components used by both chrome and
AI-composed surfaces. They are *not* AI-composed themselves.

### 3.1 Currently consolidated

| Primitive | File | Used by |
|---|---|---|
| `BrandStripNav` | `src/lib/components/BrandStripNav.svelte` | Layout chrome |
| `PromoStrip` | `src/lib/components/layouts/sections/PromoStrip.svelte` | AI-composable; also rendered as chrome via inline div in layout |
| `AddToCartBar` | `src/lib/components/layouts/sections/AddToCartBar.svelte` | PDP |
| `ServiceCalloutsGrid` | `src/lib/components/layouts/sections/ServiceCalloutsGrid.svelte` | Home below-fold |
| `AssuranceStripCheckout` | `src/lib/components/layouts/sections/AssuranceStripCheckout.svelte` | Checkout |
| `ClusterChipRow` | `src/lib/components/layouts/sections/ClusterChipRow.svelte` | PLP |
| `BOPISStrip` / `BOPISPicker` | sections/ | PDP / locator |
| `LocatorStrip` | sections/ | PLP / PDP |

### 3.2 Pending consolidation (per redesign-plan)

| Primitive | Tracked as | Status |
|---|---|---|
| `Button.svelte` | REDESIGN-PLAN V-03 | Not yet built — currently inline `<button class="bg-primary ...">` everywhere |
| `Chip.svelte` | V-05 | Not yet built — blocks filter UX (V-06) |
| `PriceLabel.svelte` | V-04 | Off-price markup is currently per-card |
| `ProductCard.svelte` | V-07 | Inline; aspect ratios inconsistent |
| `ImageGallery.svelte` | V-08 | PDP single-image only |
| `Toast.svelte` | V-09 | Add-to-cart confirmation missing |

When a primitive lands, list it in §3.1 and reference its consumers.

### 3.3 Icon dispatcher pattern

`ServiceCalloutsGrid.svelte` and `AssuranceStripCheckout.svelte` use a named-key SVG
dispatcher (8 keys: `shipping`, `returns`, `rewards`, `store`, `gift`, `quality`,
`secure`, `support`). The AI prompt in `src/lib/server/layout-prompt.ts` enumerates
these keys and forbids emoji rendering. Adding a new icon requires:

1. Add the SVG path to both consuming components.
2. Add the key to the AI prompt's icon-rule block.
3. Update the named-key list in this section.

---

## 4. AI composition vocabulary

Cross-references to existing canonical docs — do not duplicate here:

- **Schemas:** `src/lib/schema/blocks.ts` (block union), `src/lib/schema/layouts/`
  (per-surface schemas)
- **Surface-typed schema rationale:** `docs/architecture/decisions/006-surface-typed-schemas.md`
- **Vocabulary constraint invariant (`∀I, ∀P, f(I, P) → S ∈ V`):**
  `docs/architecture/decisions/004-vocabulary-constraint-invariant.md`
- **Composition taxonomy (engine vs foundation vs admin authoring):**
  `docs/architecture/engine/composition-taxonomy.md`
- **Section authoring model:** `docs/architecture/foundation/section-authoring.md`
- **Storefront vs content mode:** `docs/architecture/decisions/005-storefront-vs-content-modes.md`
- **Tag-as-retrieval-signal (PDP zone resolution):**
  `docs/architecture/decisions/008-tag-as-retrieval-signal.md`

**Rule:** any new block type added to `blocks.ts` must:

1. Be registered in the appropriate surface-typed schema (`home`, `plp`, `pdp`,
   `cart`, `checkout`, `empty` per ADR-006).
2. Be added to `SURFACE_BLOCKS_*` in `layout-prompt.ts` so the AI advertises it for
   the right surface.
3. Have a Svelte renderer wired in `LayoutRenderer.svelte` (and `ZoneRenderer.svelte`
   if it can be rendered direct-from-zone).
4. Get a row in `composition-taxonomy.md`.

---

## 5. Voice and casing rules

Authoritative source: `docs/audits/visual-design-2026-05-02/REAL-BEALLS-REFERENCE.md` §4.1.

Quick reference (bealls + beallsflorida; HC has its own register):

| Register | Casing | Use for |
|---|---|---|
| Editorial / emotional | lowercase | hero eyebrows, sub-headlines (`celebrate mom`, `gifts under`, `women`) |
| Display hero | UPPERCASE (condensed face) | hero headlines (`TRENDING FOR YOU`) |
| Cluster / theme labels | TRACKING-WIDE UPPERCASE | PLP cluster chips (`BOHEMIAN ROMANCE`, `VACATION OUTFITS`) |
| Product names + service rails | Title Case | `Bealls Bucks`, `Find a Store`, `Free Shipping` |

Casing rules are enforced in two places:

- **AI output:** the voice block in `src/lib/server/layout-prompt.ts` constrains
  casing per register (added 2026-05-02 per REAL-BEALLS §4.1 / commit b6d2a8b).
- **Static fallbacks:** `src/lib/foundation/fallbacks/*.ts` must follow the same
  rules. When adding a fallback, check casing.

---

## 6. Verification gate

**No visual change is marked ✅ until it has been visually verified on the
canonical Vercel deploy.**

This is the single rule that prevents the failure mode that caused the
2026-05-02 regression — where audit synthesis claimed brand-red CTAs / wine
brand-strip / red logo / shipping promo strip all shipped, while the canonical
deploy was rendering none of them.

### 6.1 Canonical deploy URLs

| Banner | URL |
|---|---|
| bealls | `https://aisles-demo-1-signal-x-studio-labs.vercel.app` |
| beallsflorida | `https://aisles-demo-2-signal-x-studio-labs.vercel.app` |
| homecentric | `https://aisles-demo-3-signal-x-studio-labs.vercel.app` |

**Stale aliases are not canonical.** `prism-mu-five.vercel.app` and any other Vercel
project name from before the bealls fork are explicitly out of scope. If an audit
references one of these URLs, that audit is invalid.

### 6.2 What to verify

For any change that touches:

- **Brand tokens** (`app.css` `@theme`, `brand/config.ts` theme object,
  `+layout.svelte` themeStyle): open all three canonical URLs, confirm brand
  colors render (cross-brand strip is wine on bealls, navy on bf, dark green on
  hc; primary CTAs are red on bealls, blue on bf, green on hc).
- **Chrome** (`+layout.svelte`, BrandStripNav, Nav, Footer, persistent promo
  strip): open all three canonical URLs on home + PDP + PLP + cart pages.
  Confirm chrome present and styled per §2.
- **Foundation primitive**: open the page that uses it on at least the bealls
  canonical URL. Visual diff against the previous render.
- **AI-composed block**: see ADR-006 — verify schema validation, then confirm
  the AI is selecting the block on the surface where it should appear.

### 6.3 When verification fails

Don't mark the change ✅. Root-cause first:

1. Is the canonical deploy current? Check Vercel dashboard for the deployed commit
   hash vs `git log -1 main` HEAD.
2. Is the brand environment variable set correctly? `BRAND_ID` per Vercel project.
3. Did the change accidentally remove a Tailwind utility (the §1.2 trap)?
4. Did the change skip Layer 2 (runtime injection on a wrapping div) or Layer 3
   (brand config theme object)?

Re-deploy if the gap is just stale build. Patch and re-verify if the gap is real.

### 6.4 Changes that can skip the gate

Documentation-only changes, audit deliverables, ADR drafts, and methodology files
do not require visual verification. The gate is for *implementation* changes that
affect rendering.

---

## 7. Change protocol

The verification gate (§6) is the runtime check. The change protocol below tells
you which other layers to also re-verify when you touch a given file.

| Change to | Re-verify |
|---|---|
| `src/app.css` `@theme` block | All three canonical URLs render brand colors. Run §6.2 in full. |
| `src/lib/brand/config.ts` (any brand entry) | The affected brand's canonical URL. Spot-check the other two for regressions. |
| `src/routes/+layout.svelte` | All three canonical URLs on home + PDP + PLP + cart. Chrome must be intact (§2). |
| Any foundation primitive in `src/lib/components/` | Pages that use the primitive, on at least bealls canonical URL. |
| `src/lib/server/layout-prompt.ts` | AI output for affected surfaces — confirm vocab + casing rules survived. |
| `src/lib/schema/blocks.ts` or surface-typed schemas | Run schema unit tests; confirm AI selection on the canonical URL where the new block should appear. |
| Deletion of a chrome element | **Stop. Open an ADR.** Chrome cannot be silently removed. |

---

## 8. Known regression patterns

Catalogued so future audits don't re-encounter them.

### 8.1 @theme slot removal silently disables utilities (2026-05-02)

**Pattern:** Cleanup pass scrubs values from `app.css` `@theme` block. Tailwind v4
stops generating utility classes for the removed slots. Runtime injection sets the
CSS vars but no rule reads them. Brand colors render as transparent.

**Detection:** `bg-primary` button is invisible (white text on transparent), brand
strip is invisible (white text on transparent), logo falls back to inherit color.

**Prevention:** Layer 1 always declares the slots in §1.2, even if values are
placeholders. Cleanup is "change values," not "remove slots."

### 8.2 Stale Vercel aliases mislead audits

**Pattern:** Old Vercel projects (e.g., `prism-mu-five.vercel.app`) deploy older
commits. Audits use them as references, claim things are missing or present that
don't match the canonical deploys.

**Detection:** Anything outside `aisles-demo-{1,2,3}-signal-x-studio-labs.vercel.app`.

**Prevention:** §6.1 — canonical URLs are the only valid audit reference.

### 8.3 Source-of-truth audit mistaken for visual audit

**Pattern:** Audit synthesizer reads `brand/config.ts`, sees `primary: '#aa182c'`,
marks the brand-red rollout ✅. Misses that the rendered DOM doesn't show red.

**Detection:** REDESIGN-PLAN §1 ✅ marks that don't match a canonical-URL screenshot.

**Prevention:** §6 verification gate. Source-of-truth checks are necessary but not
sufficient.

### 8.4 Forge-brand kit residue

**Pattern:** `app.css` initially shipped with DM Sans / DM Serif / `#a3522d` from a
brand-forge kit run on a different brand (Haven). Looked like Bealls config but
wasn't. Caused brand-mismatch confusion until killed in CATALYST translation.

**Detection:** any value in `app.css` that doesn't match the bealls placeholder
list in §1.2.

**Prevention:** `app.css` carries only structural tokens + neutral defaults. All
brand-specific values come from `brand/config.ts` via runtime injection.

---

## 9. Open items

These are tracked in REDESIGN-PLAN.md and listed here for design-system context:

- **V-00** (P0, blocking): restore `--color-primary`, `--color-secondary`,
  `--color-accent`, `--color-surface-*` slots in `app.css` `@theme` block
  (per §1.2). Caused the 2026-05-02 regression.
- **V-03 / V-04 / V-05 / V-07**: Button / PriceLabel / Chip / ProductCard primitive
  consolidation (§3.2).
- **V-06**: Filter strip + sort selector (foundation primitive, not AI block —
  per REDESIGN-PLAN §3 conflict resolution #3).
- **V-08 / V-09**: ImageGallery + Toast.

When these land, update §3.1 / §3.2 here.

---

## 10. Cross-references

- **REDESIGN-PLAN.md** — execution-sequenced priority list
- **REAL-BEALLS-REFERENCE.md** — path-B reproduction tokens + voice rules
- **CATALYST-TRANSLATION.md** — primitive vocabulary + token architecture
- **BRAND-FIDELITY-COMPARISON.md** — original brand audit (5-axis comparison)
- **ADR-004** — vocabulary constraint invariant
- **ADR-005** — storefront vs content modes
- **ADR-006** — surface-typed schemas
- **ADR-008** — tag-as-retrieval-signal
- **composition-taxonomy.md** — engine / foundation / admin authoring split
- **section-authoring.md** — fallback authoring model

This doc is the *contract*. Those docs are the *evidence and rationale*.
