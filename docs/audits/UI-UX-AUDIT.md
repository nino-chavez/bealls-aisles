# UI/UX Audit — Deployed Demos vs Original Sites

**Date**: 2026-04-30
**Scope**: Live deployed demos at aisles-demo-1/2/3 vs the Phase 1 audit captures of the actual Bealls family sites
**Methodology**: Full-page screenshots at 1440×900, axis-by-axis comparison, demo-quality vs production-fidelity calibration
**Honest framing**: A sales demo doesn't need 1:1 fidelity with the live merchant site — it needs to *feel like the brand* and visibly demonstrate the platform's value. Some AI-driven layout divergence is expected. This audit calls out what's clearly broken vs what's acceptable AI-generated variation.

---

## Files audited

| Banner | Original (Phase 1) | Deployed |
|---|---|---|
| bealls.com | `screenshots/bealls/01-homepage.png`, `02-plp-women-tops.png` | `comparison/demo-bealls-home.png`, `demo-bealls-plp.png` |
| beallsflorida.com | `screenshots/beallsflorida/01-homepage.png`, `02-plp-women.png` | `comparison/demo-bf-home.png`, `demo-bf-plp.png` |
| homecentric.com | `screenshots/homecentric/01-homepage.png` | `comparison/demo-hc-home.png`, `demo-hc-bedroom.png` |

---

## Banner 1 — bealls.com vs aisles-demo-1

### Axis-by-axis

| Axis | Original | Demo | Verdict |
|---|---|---|---|
| Brand-strip nav | `bealls / Bealls Florida / HOME` tabs at top, red active | Same — `BEALLS / BEALLS FLORIDA / HOME CENTRIC` with red active for bealls | ✅ Match |
| Wordmark | Custom "bealls" logotype with stylized ll ligature | Plain text "bealls" | ⚠️ Demo-quality (Phase 7 polish item) |
| Category nav | Top bar: Women / Men / Kids / Shoes / Home / Beauty / Handbags / Accessories | Same set ✓ | ✅ Match |
| Persistent shipping promo strip (red) | "FREE SHIPPING when you spend $99" | **Not visible on home** — should be a `promo-strip` urgency=hard at top | ❌ Missing — visible-on-every-page promo strip is core to Bealls's chrome |
| Hero treatment | **Full-bleed lifestyle photography** with two female models, no overlay text | **Text-only** ("Find your favorites for less" + body + 8 category buttons) on plain background | ❌ Major gap — original is photographic, ours is text-on-white. Loses 90% of visual impact |
| Email-capture modal (5% off) | Fires on first visit | Not implemented (out of scope) | ⚠️ Acceptable — out of scope for v1 |
| Price-tier 2-up tiles ("under $25 / $50") | Bold price overlay on lifestyle imagery | Not on home | ❌ Missing — strong off-price merchandising signal |
| Category tile grid | 4-up + 5-up themed grids ("match day outfits", "vacation destination", etc.) with photographic imagery | **2-col simple text tiles** with category name + "Browse →" arrow | ❌ Major gap — original is photographic; ours is text-only links |
| Best Sellers carousel | 4-up product cards with arrows + dot pagination, sale badges | **Static 4-up grid** ("Featured") with images and prices, no carousel | ⚠️ Layout regression — original has interactivity, ours is static |
| Comparable-value pricing on home cards | Strikethrough + "Comparable value $X / You save X%" | **Plain prices visible** ($24.99, $12.99, $10.99, $9.99) — no strikethrough, no comparable-value labeling | ⚠️ Implementation gap — pricing language IS implemented but doesn't surface because no salePrice field on home featured |
| "Real names. Real value." section | n/a (different on original) | Editorial header + lifestyle image of pink dress | ✅ Net new but on-brand |
| Footer | Black background, multi-column links, brand strip footer | Light background, multi-column links, brand mention. Missing: brand-strip in footer, dense link list | ⚠️ Acceptable simplification |

### PLP comparison (`/category/women`)

| Axis | Original | Demo | Verdict |
|---|---|---|---|
| Layout density | 4-col dense grid with sale badges, prices, Add to Bag CTAs | **2-col gatherer-persona layout** with editorial framing, hero product, then sparse grid | ❌ **Major gap** — the AI selected a gatherer layout (editorial 2-col landscape) when most Bealls shoppers want hunter density (4-col with quick-add) |
| Product images | All visible, fully loaded | **Many empty placeholders** — only ~6 of 30+ products show images | ❌ **Demo-blocker** — BC's async CDN image fetch hasn't completed for most seeded products |
| Filter rail | Left sidebar with Color/Size/Price | Not present | ⚠️ AI vocabulary doesn't include filter rails (out of scope) |
| Sort dropdown | Top right | Not present (gatherer layout doesn't include) | ⚠️ AI persona choice |
| Pricing | Sale price + "Comparable value $X" | Plain prices in some cards | ❌ Comparable-value not surfacing |

### Honest assessment — bealls

**The home page reads like an early-2010s minimalist DTC brand, not Bealls.** Bealls is promo-dense, photographic, and visually busy. Our demo is sparse, text-driven, and quiet. The brand identity (red, lowercase wordmark, family-friendly category list) is right, but the *visual character* is fundamentally off.

**Two critical issues**:

1. **Empty product card images** on the PLP — BC's CDN is still asynchronously fetching ~80% of the seeded product images. This makes the demo look genuinely broken. Wait time may be 24-48 hours per BC's documentation, OR this requires a manual cache-warm pass.

2. **Wrong persona detected** — AI is generating a Gatherer layout for `/category/women`. Most Bealls shoppers are Hunter persona (restocking, value-seeking). The signal pipeline's request-time defaults probably score Gatherer too high. **Test fix**: visit `/category/women?intent=hunter` and capture the layout for comparison — it should produce a 4-col dense grid.

---

## Banner 2 — beallsflorida.com vs aisles-demo-2

### Axis-by-axis

| Axis | Original | Demo | Verdict |
|---|---|---|---|
| Brand-strip nav | Same 3 tabs, blue active | Same, blue active for BF ✓ | ✅ Match |
| Wordmark | Custom cursive "Bealls Florida" logotype | "Bealls Florida" in Playfair Display serif | ⚠️ Demo-quality (correct register — both serif/editorial) |
| Hero | **"FLORIDA IS A *feeling*" with text overlay on full-bleed photography of women in coastal scene** | **"Florida is a feeling" in Playfair italic, plain background, with body copy + 8 category buttons** | ⚠️ Typography matches (Playfair italic captures the "feeling" register) but **no photographic background** |
| Hero typography | Mixed bold sans + flowing italic script | Playfair Display italic — captures the editorial italic but loses the script flourish | ✅ Acceptable — Playfair italic is the right register, font availability for the cursive script accent is a known polish item |
| Vacation Destination 4-up tiles | Photographic tiles (women's, kids', men's, beach) | Not present on home | ❌ Missing |
| Best Sellers carousel | Same 4-up arrows pattern as bealls | **Static 4-up "Featured" with real BF products** (Reel Legends Tropical Dress, Counterparts Career Capris, Bermuda Shorts, etc.) | ⚠️ Layout regression but **products are real and on-brand** |
| Brand-correct products | Real beachwear, resort wear | ✓ Real BF SKUs visible: Reel Legends, Counterparts, etc. | ✅ Match |
| "Fashion. Fitness. Family. Fun." | Tagline strapline on original | Section heading "Fashion. Fitness. Family. Fun." with body copy + lifestyle image (pink floral dress) | ✅ Match |
| Category tiles | Photographic 4-up "Vacation Mode", text-link "Favorite Florida Finds" row | Plain 2-col text tiles with "Browse →" | ❌ Major gap |
| Footer | Multi-column dense links, blue accent | Multi-column simplified | ⚠️ Acceptable |

### PLP comparison

Same gatherer-layout issue as bealls. Plus same image-loading issue (~6 of 30+ products visible).

### Honest assessment — BF

**BF is the strongest of the three demos** — the Playfair Display italic on "Florida is a feeling" is genuinely on-brand. Real BF products surface in Featured. Color palette (blue + teal) is faithful.

But the same fundamental issues as bealls: missing photographic chrome, wrong persona on PLP, async image-fetch incomplete.

---

## Banner 3 — homecentric.com vs aisles-demo-3

### Axis-by-axis

| Axis | Original | Demo (home) | Verdict |
|---|---|---|---|
| Brand-strip nav | Green active for HOME tab | Same ✓ | ✅ Match |
| Wordmark | "HOMEcentric" with green HOME + script "centric" + red dots | "Home Centric" in Lora serif | ⚠️ Demo-quality (Lora serif gives editorial register; mixed sans+script is a Phase 7 polish item) |
| Hero treatment | **Tri-image collage** — three photographic blocks with green "New Inspiration for LESS!" center panel | **Text-only**: "New Inspiration for Less" + body + 7 category buttons | ❌ Major gap |
| Content-mode chrome | Hamburger menu only — no cart, search, account | Same — Find a Store pill + hamburger ✓ | ✅ Match — content mode pattern is correct |
| Category tiles with descriptions | "Furniture / Come together in the comfort..." 2-up with rich descriptions | **Plain 2-col text tiles** with "Browse →" — no descriptions | ❌ Original tiles have descriptive subheadings; ours don't |
| "What's IN STORE" 3-up | Photographic tiles (Rugs / Entertaining / Lighting) | Not present | ❌ Missing |
| Bealls Rewards + Gift Cards split-promo | Two photographic cards | Not present on home | ❌ Missing |
| Voice | "Inspired Living for Less" + "The latest trends..." | Tagline matches, body copy matches | ✅ Match |
| Footer | Brand strip repeated, minimal links | Multi-column with content categories | ⚠️ Acceptable |

### Content surface (`/category/bedroom`)

| Axis | Original equivalent | Demo | Verdict |
|---|---|---|---|
| Hero with "IN STORE" framing | n/a (HC has no PLPs) | Full-bleed photographic hero with eyebrow "IN STORE" + headline "Bedroom" + body + "FIND A STORE NEAR YOU" CTA | ✅ **Strong demo moment** — this is the content-mode pattern working as designed |
| Locator promo strip | n/a | Red-orange strip "Bedroom arrivals refresh weekly. Visit your nearest..." with FIND A STORE button | ✅ Match brand register (red-orange = HC's "centric" dot accent) |
| "More to explore in store" 4-up tiles | n/a | Photographic category tiles (Bath / Rugs / Kitchen & Dining / Lighting) | ✅ Strong execution |

### Honest assessment — HC

**HC home is the weakest of the three.** It looks barely populated. The original site has its own minimalism, but the tri-image hero collage and rich category descriptions are what give HC its presence. Our text-only home reads as unfinished.

**HC's content-mode category surfaces are the strongest part of the entire demo.** The `/category/bedroom` page genuinely demonstrates the content-mode pattern: editorial hero → in-store promo → brand pillar tiles → all driving foot traffic. This is a legitimately novel demo moment that doesn't exist on the actual HomeCentric site.

---

## Cross-banner observations

### What's working consistently ✅

1. **Brand colors** — red/blue/green palettes correctly applied across all surfaces
2. **Brand-strip nav** — the most distinctive Bealls-family UI signature, present on every page
3. **Typography register** — humanist sans for bealls, Playfair italic for BF, Lora serif for HC all read on-brand
4. **Wordmark + category nav** — accurate per banner
5. **Off-price pricing language** — implemented; surfaces correctly on cards with sale prices
6. **AI personalization framework** — working end-to-end (BC fetch → persona inference → AI layout → schema-validated render)
7. **Real merchant catalogs** — 1,449 + 728 = 2,177 real Bealls family products with persona-fit scores

### Critical issues ❌ (demo-blocking)

| Issue | Severity | Banners affected | Fix |
|---|---|---|---|
| **Async product images not loaded** | High | bealls, BF | Wait for BC CDN to finish, OR run a manual image-warm pass via API. ~80% of cards show empty placeholders on PLPs. |
| **No photographic hero on home pages** | High | bealls, BF, HC | Original sites lead with full-bleed lifestyle imagery. Demo leads with text on white. Brand presence is hollowed out. **Action**: add an `editorial-hero` to brand homepage layouts with a real lifestyle image. |
| **Wrong persona detected on PLPs** | Medium-High | bealls, BF | AI generated Gatherer (sparse 2-col) where Hunter (4-col dense) was expected. Tune signal weights or add explicit URL params for demo flows. |
| **No promo strip on home** | Medium | bealls, BF | The persistent shipping strip ("FREE SHIPPING when you spend $99") is core to Bealls chrome. Add as a global `promo-strip` rendered above the AI layout. |

### Polish items ⚠️ (Phase 7)

- Custom wordmark logotypes (vs text rendering of brand names)
- Photographic category tiles (vs plain text "Browse →" tiles) — would require curated tile imagery per banner
- Best Sellers carousel (vs static 4-up grid) — the AI vocabulary has `product-carousel`, just isn't being chosen for home
- HC tri-image collage hero (Tier 3 deferred component)
- HC mixed sans + script wordmark (Lora is closer but not identical)

### Genuinely strong ✓

- HomeCentric's `/category/bedroom` content surface is the standout — the editorial hero + locator strip + brand pillar pattern is a coherent, on-brand demo of an architectural pattern (content mode) that doesn't exist on the actual merchant site.

---

## Recommendations

### Demo-blocking fixes (ship before stakeholder demo)

1. **Image-fetch warm pass.** Either wait 24-48 hours for BC's async CDN OR write a script that hits each `imageUrl` from the seeded products to force-cache them on BC's CDN. ~30 min agent work.
2. **Add brand-homepage layout fixtures.** Currently the home page server load passes featured products but the AI doesn't generate a layout for home — only for `/category/[slug]`. The home is a static fallback. Two paths: (a) trigger AI layout generation on home, or (b) create a richer static fallback per brand with editorial-hero + photographic tiles. Path (b) is faster (~1-2 hr).
3. **Force Hunter persona on demo PLPs.** Either add `?intent=hunter` to demo URLs (cheap) or tune signal weights so that returning-visitor + women-category triggers Hunter not Gatherer (more correct, ~30 min). Demo experiences the dense PLP that matches Bealls's actual visual character.

### Polish items (Phase 7)

4. **Wordmark replacement** — drop in actual brand logos. Worth doing per brand. ~1-2 hr per banner.
5. **Photographic category tiles** — curate 6-8 tile images per banner (vacation, kids, beauty, etc.). ~1 hr per banner.
6. **Promo strip everywhere** — render persistent free-shipping strip above the AI layout, brand-config driven. ~30 min.

### What to skip

- Email-capture modal (out of scope for AI demo)
- HC tri-image collage (Tier 3 known limitation)
- Filter sidebar on PLPs (would require new component vocabulary)

---

## Bottom line

**The demo proves the architecture works** — three brand-routed sites, real catalogs, AI layouts, content vs storefront mode, persona inference, observe dashboard. **It does not yet feel as visually rich as the original Bealls family sites.** Most of the gap is *photographic imagery* (hero, tiles, lifestyle) — the AI is generating valid layouts but the underlying art assets are placeholder-grade.

**For a stakeholder demo of the Aisles platform**, this is acceptable: the value prop is "AI personalizes layouts for real catalogs" and that's demonstrably true. **For a stakeholder demo trying to convince Bealls itself to adopt Aisles**, the visual gap will land poorly. They'll see "yeah but this doesn't look like our actual site."

**Recommendation**: invest 4-6 hours to close the three demo-blocking gaps (image warm, brand-home fixtures, persona forcing). That converts the demo from "works in principle" to "looks legitimate." Phase 7 polish items can wait for engagement-specific stakeholder review.
