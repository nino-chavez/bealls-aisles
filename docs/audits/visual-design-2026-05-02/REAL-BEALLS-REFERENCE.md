# Real bealls.com — visual reference + reconciliation

**Date:** 2026-05-02
**Source:** https://www.bealls.com (live), captured + inspected via Playwright
**Audit context:** companion to [`REPORT.md`](./REPORT.md) and [`CATALYST-TRANSLATION.md`](./CATALYST-TRANSLATION.md). Where those two assumed our existing demo brand config was the ground truth, this doc audits real bealls.com and reconciles.

---

## 1. Why this exists

The earlier audit + Catalyst translation treated the brand config in `src/lib/brand/config.ts` as the source of truth for "Bealls". On inspection, that config is **partly real-Bealls and partly demo-arbitrary** — and where it's demo-arbitrary, we picked choices (Plus Jakarta Sans, Inter, `#c8102e`) that look reasonable but don't match the actual brand. The forge-brand kit residue in `app.css` (DM Sans, DM Serif, `#a3522d`) is neither.

This doc captures what real bealls.com actually does, so the design sprint reproduces brand intent rather than re-inventing it.

---

## 2. Concrete visual decisions on real bealls.com

Inspected via `getComputedStyle` on www.bealls.com 2026-05-02. Verified against viewport screenshots at `screenshots/real-bealls-home.png` and `screenshots/real-bealls-plp.png`.

### 2.1 Typography

**Body font:** `mr-eaves-xl-modern` (Adobe Fonts / Typekit). Humanist sans-serif by Zuzana Licko (Emigre). Warm, slightly informal, high x-height. Site loads it via Adobe Fonts kit, not Google Fonts. Body, nav, headings, CTAs — every non-display surface uses it.

```
font-family: mr-eaves-xl-modern, helvetica, arial, sans-serif;
```

**Display font for editorial heroes:** A condensed display face — visible on the home page hero `TRENDING / FOR YOU`. Tall, narrow, multi-line stroke ornament on emphasised words. Likely a custom face or Stratos Condensed / Druk Condensed family. Not a stock Google font.

**Voice carry-through:** Real Bealls uses **lowercase** as a brand-voice signature for editorial moments — `celebrate mom`, `gifts under`, `women` in the PLP hero, even the logo wordmark is lowercase `bealls`. Title-case is reserved for product names + structural labels (Categories, Track, Account, Bag, Shop). This is a load-bearing brand signal we missed entirely in our demo.

**Demo config currently says:**
- `fontDisplay: 'Plus Jakarta Sans'` ❌ wrong — real Bealls uses condensed display + mr-eaves-xl-modern
- `fontBody: 'Inter'` ❌ wrong — real Bealls uses mr-eaves-xl-modern
- `googleFontsUrl: ...Plus+Jakarta+Sans...Inter...` ❌ wrong — real Bealls uses Adobe Fonts (Typekit)

### 2.2 Colors

**Brand red:** `rgb(170, 24, 44)` = **`#aa182c`**

This is **darker** than what we have. Our `#c8102e` is brighter, more orange-tinged, more "primary action" energy. Real Bealls' red is closer to cherry/burgundy — more grown-up, more off-price-credible.

Side-by-side:
- Our demo: `#c8102e` → HSL `351° 85% 42%` — saturated, vivid
- Real Bealls: `#aa182c` → HSL `351° 75% 38%` — same hue, lower saturation, lower lightness

**Promo bar / footer dark color:** `#330A3D` — deep purple-maroon, almost black. This appears as the top-strip background on the brand-switcher row + footer chrome. We currently use plain `#1a1a1a` black for `accent`. Real Bealls treats it as a desaturated wine.

**Brand red applications observed:**
- Logo wordmark
- Sale/promo eyebrow text ("celebrate mom", category PLP "women")
- Primary CTA button background (`shop women`, `Shop Now`)
- `My Lists` heart icon
- Promo bar background uses a darker variant — `#7d2540` cranberry, not the bright red

**Sister brand colors visible in real CSS custom props:**
```css
--brand-home-centric-primary: #328812;    /* green */
--brand-home-centric-secondary: #3a9f15;  /* lighter green */
```

Our demo's HC primary is `#76b82a` (brighter, more spring-green). Real HC is `#328812` — deeper forest green. We're again brighter than real.

### 2.3 Layout patterns

**Top brand-strip:** Three-up tabs across the top, dark purple-maroon background, white text. Active brand has a red highlight band. We have this concept but our chrome is `#1a1a1a` flat black — should be the desaturated `#330A3D` wine.

**Header:** Logo on left, large search bar centered, four icon-and-label actions on right (Track / Account / Bag / Shop). No top-nav category links. Search is the primary navigation paradigm. Our demo has a horizontal category nav (Women / Men / Kids / Shoes / Home / Beauty / Handbags / Accessories) which is a different IA — old-school nav-driven vs Bealls' search-driven.

**Promo bar:** Single-line message in dark cranberry with white text. `MOM'S DAY SPECIAL – FREE SHIPPING when you spend $75 through 5/3/26 – Click Here for details.` One promo at a time, prominent date, click-through to detail page.

**PLP layout:** **Sidebar category list** on the left (vertical), large editorial hero on the right with brand-red lowercase headline `women`, six "outfit cluster" chips below the hero (`BOHEMIAN ROMANCE`, `SHADES OF SPRING`, `RODEO STYLE`, `VACATION OUTFITS`, `CASUAL OUTFITS`, `WORK OUTFITS`). The product grid lives below the cluster chips. This is a meaningfully different IA than what our demo PLPs do.

**Editorial cluster chips on PLP** is the most unexpected real-Bealls finding. They've curated themed merchandising bins — themes that span subcategories (a "vacation outfits" cluster pulls tops, dresses, swim, accessories together). Our PLP composition vocabulary doesn't have an equivalent block; the closest is `category-tile-grid` but those are *category* tiles, not curation themes.

### 2.4 Hero treatment

Editorial photography is full-bleed lifestyle (two diverse women, soft yellow-gold background). Headline overlay in condensed display face, sub-copy in mr-eaves at sentence case. Pill CTA in brand red (`#aa182c`) with white text. The hero photography style — natural lighting, candid joy, age range 20s-50s, real-body sizes — is itself part of the brand voice.

### 2.5 Stack hints from inspecting custom CSS properties

Real Bealls' technology footprint, from the custom-prop names dumped:
- WordPress (`--wp--preset--font-size--*`, `--wp--preset--color--*`)
- Tailwind (`--tw-ring-color`)
- OKLCH for grays (`--color-gray-500: oklch(.551 .027 264.364)`) — modern color-space adoption ✓
- Adobe Fonts (`mr-eaves-xl-modern` is a Typekit web font)

Bealls has migrated to OKLCH already, which validates the Catalyst translation's recommendation to do the same.

---

## 3. Reconciliation: brand config patches needed

The deltas between current `src/lib/brand/config.ts` (bealls entry) and real bealls.com:

| Token | Current demo value | Real-Bealls value | Confidence | Notes |
|---|---|---|---|---|
| `theme.primary` | `#c8102e` | `#aa182c` | High | Dropped saturation + lightness |
| `theme.secondary` | `#a00d24` | `#7d2540` | Med | Real Bealls promo-bar cranberry; needs verification across more pages |
| `theme.accent` | `#1a1a1a` | `#330A3D` | High | Top brand-strip + footer chrome — wine, not pure black |
| `theme.fontDisplay` | `'Plus Jakarta Sans'` | (custom condensed) | Med | Likely Stratos Condensed / Druk Condensed — needs the actual face |
| `theme.fontBody` | `'Inter'` | `'mr-eaves-xl-modern'` | High | Adobe Typekit, not Google Fonts |
| `googleFontsUrl` | Plus Jakarta + Inter URL | (n/a) | High | Replace with Adobe Typekit `<link rel="stylesheet" href="https://use.typekit.net/{kitId}.css">` if license available; otherwise pick a public-license alternative |
| `homepage.heroHeadline` | `'Find your favorites for less'` | `'TRENDING FOR YOU'` (varies) | Med | Real hero copy rotates seasonally — current value is a reasonable evergreen |
| Voice casing | Title Case | **lowercase for editorial** | High | "celebrate mom", "gifts under", "women" |
| Hero photography | Unsplash editorial | Brand-shot lifestyle | High | Real Bealls hires real shoots — Unsplash is OK for demo if labelled |
| Subcategory cluster chips | (none) | `BOHEMIAN ROMANCE`, `SHADES OF SPRING`, etc. | High | Curation theme vocabulary missing entirely from our schema |
| Top nav | Horizontal categories (Women/Men/...) | Search-driven, four header icons | High | Different IA — bigger architectural decision |
| HC primary | `#76b82a` | `#328812` | High | Same hue, real is darker/deeper |

### 3.1 Font licensing nuance

`mr-eaves-xl-modern` is licensed via Adobe Fonts (Typekit). Anyone can subscribe to Adobe Fonts ($14.99/mo individual, included with Creative Cloud), but a *demo storefront* deploying the font without a Typekit ID linked to a paid Adobe account would be using it without a license.

**Three options:**

1. **Use Adobe Typekit properly** — sign in to an Adobe account, create a Typekit kit that includes mr-eaves-xl-modern, embed the kit ID. Cleanest if there's an Adobe account available.
2. **Use a free-license substitute** — closest free-license fonts to mr-eaves-xl-modern in shape/feel:
   - `DM Sans` (open license) — close in geometry, slightly more rigid
   - `Public Sans` (open license) — very close to mr-eaves' US-government-modernist feel
   - `Sofia Sans` (open license) — broader humanist, close stroke contrast
3. **Use Adobe Fonts free tier** — Adobe offers some fonts free with a free Adobe ID. mr-eaves-xl-modern requires paid; mr-eaves-modern (regular weight only, not full family) is in some free bundles. Verify before relying.

**Recommendation:** option 2 with `Public Sans` for the demo. Closest visual match without licensing friction. Caption it in the demo reel narrative as "an open-license analogue to the real Bealls type system" if anyone asks.

### 3.2 Display font

The condensed display face on `TRENDING FOR YOU` doesn't appear in any computed-style sample I extracted (it's likely an SVG or a non-default text rendering path). Best free-license matches:

- `Bebas Neue` — close in proportions, lower-stress strokes
- `Anton` — heavier, more impactful
- `Oswald` — slightly more humanist, very close to bealls.com display face

**Recommendation:** `Oswald` (Google Fonts, open license) for the display slot. The condensed-narrow brand voice survives.

### 3.3 Proposed brand config rewrite (bealls entry only)

```ts
{
  id: 'bealls',
  name: 'bealls',
  // ...

  theme: {
    primary: '#aa182c',         // Real Bealls red (was #c8102e)
    secondary: '#7d2540',       // Real Bealls cranberry promo-bar (was #a00d24)
    accent: '#330A3D',          // Real Bealls deep wine — top strip + footer (was #1a1a1a)
    surfaceBg: '#ffffff',
    surfaceFg: '#1a1a1a',
    surfaceCard: '#ffffff',
    surfaceCardFg: '#1a1a1a',
    surfaceMuted: '#f6f6f6',
    surfaceMutedFg: '#5a5a5a',
    surfaceBorder: '#e5e5e5',
    fontDisplay: "'Oswald', 'Bebas Neue', system-ui, sans-serif",   // condensed (was Plus Jakarta Sans)
    fontBody: "'Public Sans', 'mr-eaves-xl-modern', system-ui, sans-serif",  // humanist sans (was Inter)
    fontMono: "ui-monospace, Menlo, monospace",
  },
  googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Public+Sans:wght@400;500;600;700&display=swap',

  // ...
}
```

---

## 4. Voice + IA implications

### 4.1 Lowercase editorial voice

The lowercase signature is a brand-voice rule, not a typography decision. Any time the AI emits an editorial-header eyebrow or hero headline, it should follow casing rules:

- **lowercase** for emotional / editorial moments: `celebrate mom`, `gifts under`, `bealls`, `women`
- **Title Case** for product names + service rails (`Bealls Bucks`, `Find a Store`, `Free Shipping`)
- **UPPERCASE** for the condensed-display hero only (`TRENDING FOR YOU`)
- **TRACKING-WIDE UPPERCASE** for cluster chips (`BOHEMIAN ROMANCE · SHADES OF SPRING · RODEO STYLE`)

**Implication for layout-prompt.ts:** the brand voice block needs explicit casing rules. Currently the prompt says "use comparable-value language" but doesn't constrain casing. Add:

```
CASING RULES:
- Editorial eyebrow + sub-headlines: lowercase ('shop women', 'celebrate mom')
- Hero headline (condensed display): UPPERCASE ('TRENDING FOR YOU')
- Cluster / theme labels: TRACKING-WIDE UPPERCASE ('BOHEMIAN ROMANCE')
- Product names + service labels: Title Case
```

### 4.2 Subcategory cluster chips — missing from our schema

Real Bealls renders six themed cluster chips on every PLP. These are merchandiser-curated theme bins that span subcategories (`VACATION OUTFITS` pulls dresses + tops + swim + accessories). Our composition vocabulary has `category-tile-grid` and `editorial-header` but no equivalent for "themed merchandising rail across subcategories".

**Two paths:**

1. Add a new `cluster-chip-row` block to the schema — propsBy: chip array of `{ label, href, productIds[] }`. Engine composes from rules-engine themes. Admin authors curation in a new `Themes` tab.
2. Re-use `category-tile-grid` with an `images: false` variant and label as a chip strip. Cheaper but loses the visual theme association.

Path 1 is the right call architecturally — it's an admin-authored merchandising primitive, not an AI composition decision.

### 4.3 Search-driven IA vs nav-driven

Real Bealls deliberately puts search center stage and pushes category drill-down to the *PLP sidebar*, not the global nav. Our demo top-nav has 8 categories horizontal. Two different IAs.

**Tradeoff:**
- Nav-driven (ours): better discoverability, classic e-commerce pattern, scrollable above-the-fold
- Search-driven (real Bealls): trusts shoppers know what they want, frees vertical space for editorial, modern off-price

For the demo, switching to search-driven IA would be a substantial architectural move (reorganises Nav.svelte, BrandStripNav.svelte, and the PLP entry path). **Cost-benefit suggests staying nav-driven for the demo** but documenting this as the highest-value-but-out-of-scope reconciliation finding.

---

## 5. Implications for the Catalyst translation

The earlier `CATALYST-TRANSLATION.md` recommended adopting Catalyst's component primitives and Bealls' demo tokens. With real-Bealls in the picture:

| Catalyst recommendation | Verdict against real Bealls | Action |
|---|---|---|
| HSL channels in CSS variables | ✓ Real Bealls uses CSS custom props with OKLCH for grays — modern color-space migration matches | Adopt |
| `color-mix(in oklab, ...)` for derived states | ✓ Real Bealls already uses OKLCH | Adopt |
| 5-step contrast neutral grayscale | ✓ Real Bealls uses similar | Adopt |
| Type scale xs–6xl | ✓ Real Bealls scale aligns approximately | Adopt |
| Shadow scale | ✓ Real Bealls uses subtle shadows | Adopt |
| Pill primary CTA, large size | ✓ **Real Bealls uses pill primary CTAs** (`shop women`) | Adopt — confirmed correct |
| Default to `Plus Jakarta Sans` | ✗ Wrong — real Bealls is `mr-eaves-xl-modern` / our demo substitute should be `Public Sans` | Override |
| Default to `Inter` body | ✗ Wrong — same fix | Override |
| Color-card primary `#c8102e` | ✗ Real Bealls is `#aa182c` | Override |
| 5:6 / 3:4 / 1:1 product-card aspect ratios | ⚠ Real Bealls uses softer ratios — investigate | Verify before adopting verbatim |
| 5-variant button (primary/secondary/tertiary/ghost/danger) | ✓ Real Bealls' button system supports all five | Adopt |
| `Chip.svelte` for filter tokens | ✓ Real Bealls uses chip-style filters (verify on full PLP capture) | Adopt |
| Off-price `Comparable value $X · Save Y%` price label | ✓ Real Bealls uses "Comparable value" pattern | Adopt — confirmed correct |
| Animated underline on nav | ⚠ Real Bealls' nav is icon-and-label, not underlined | Skip for top nav, keep for footer/breadcrumb |

**Net:** Catalyst's *system architecture* is right. The *default values it ships with* aren't real Bealls. We adopt the architecture and inject real-Bealls values.

---

## 6. Updated component fix list

The earlier 17-item fix list in `CATALYST-TRANSLATION.md §6` stands. Adjusting items #1, #2, #4 with real-Bealls values:

**#1 (was: token migration to HSL channels):** Now also adjusts the brand-color values themselves:

```css
:root {
  --primary: 351 75% 38%;   /* #aa182c — real Bealls red, was 351 85% 42% */
  --secondary: 343 53% 32%; /* #7d2540 — real Bealls cranberry */
  --accent: 286 70% 14%;    /* #330A3D — real Bealls wine */
  /* ... */
}
```

**#2 (was: kill forge-brand kit residue, wire Plus Jakarta + Inter):** Replace with:

```css
--font-family-heading: 'Oswald', 'Bebas Neue', system-ui, sans-serif;
--font-family-body: 'Public Sans', system-ui, sans-serif;
```

Update `googleFontsUrl` in brand config to the Oswald + Public Sans bundle.

**#4 (was: brand-red CTAs across funnel):** Same change, now using the real `#aa182c` instead of bright `#c8102e`.

**New #18: voice casing rules in `layout-prompt.ts`** — add the four casing-rule guidelines so the AI matches real Bealls' lowercase-editorial brand voice.

**New #19: hero photography substitution** — replace Unsplash hero (`heroImage`) with a brand-shot-style asset OR caption it as "demo asset" in the demo reel narrative.

**New #20 (out of scope, documented for completeness): cluster-chip-row block** — admin-authored themed merchandising bin (BOHEMIAN ROMANCE, VACATION OUTFITS, etc.). Schema addition + admin tab.

**New #21 (out of scope, documented): IA pivot to search-driven nav** — flatten top nav to icons-only, push category drill-down into PLP sidebar.

---

## 7. Demo reel narrative implications

The demo reel script should be rewritten with the awareness that we're now reproducing real Bealls more faithfully. Three lines worth tightening:

**Scene 01** (was): "This is Bealls — every section, every product card, every line of copy was generated by an AI engine in real time."

**Scene 01 (revised):** "This is Bealls — every section composed in real time by an AI engine, in the brand's actual voice. The wordmark, the cherry red, the lowercase editorial tone, the off-price 'comparable value' pricing — these aren't styling choices the engine improvised. They're the brand's own visual decisions, taught to the engine through one TypeScript config, then enforced through a typed schema."

This reframes the demo from "look at this AI-composed storefront we built" to "look at this AI-composed storefront that *behaves like the actual Bealls brand* because the brand's visual rules are an input, not an output."

That's a meaningfully stronger product narrative.

---

## 8. Decision required

This doc presents what path B (faithful real-Bealls reproduction) looks like as concrete tokens + voice rules. Three decisions before the design sprint kicks off:

1. **Adopt path B?** Update brand config to real-Bealls values (`#aa182c`, `#7d2540`, `#330A3D`, Oswald + Public Sans, lowercase editorial voice). Yes/no.
2. **Add cluster-chip-row block?** Real Bealls' themed merchandising bins are missing from our schema. Add as a new admin-authored zone. Yes/no.
3. **Pivot IA?** Real Bealls is search-driven; demo is nav-driven. Significant architectural change. Defer to post-demo / no?

If #1 yes + #2 + #3 deferred → ~1 hour of additional work on top of the existing 5-day sprint, ships path B for the demo. The reel narrative tightens from "AI-composed Bealls-flavored storefront" to "AI-composed *real-Bealls-faithful* storefront that any merchant could replicate by writing one config".

That's the version worth making.
