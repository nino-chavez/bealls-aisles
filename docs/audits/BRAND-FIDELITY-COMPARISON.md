# Brand Fidelity Comparison — Audit vs Implementation

**Date**: 2026-04-30
**Purpose**: Honest, auditable comparison between each banner's actual live site (Phase 1 audit captures) and our reskinned implementation (Phase 3 brand identity + Phase 2 component vocabulary). Flags real mismatches so they can be fixed before demo.

**How to read this**: Each banner gets:
- Original site captures (homepage, PLP, PDP) from Phase 1 audit
- Implementation style guide (the brand-aware `/style-guide` route)
- Per-attribute comparison table (color / typography / chrome / voice / promo grammar)
- Honest assessment with explicit "matches" and "needs refinement" calls

---

## Methodology

The implementation is verified against the live sites along five axes:

1. **Color** — primary, accent, surface, semantic palette
2. **Typography** — display + body font register and feel
3. **Chrome** — header/nav/utility bar, footer, persistent promo strip
4. **Voice & promo grammar** — copy register, off-price language, urgency treatment
5. **Component treatment** — sale badges, CTAs, card layouts, carousel patterns

Brand-fidelity issues are categorized:

- ✅ **Matches** — implementation faithful to source
- ⚠️ **Demo-quality** — slightly off but acceptable for stakeholder demo
- ❌ **Needs refinement before demo** — visible mismatch that hurts the pitch

---

## Banner 1 — bealls.com

### Source captures (Phase 1 audit)

- Homepage: `screenshots/bealls/01-homepage.png`
- PLP (Women / Tops): `screenshots/bealls/02-plp-women-tops.png`
- PDP (Women's Solid Top): `screenshots/bealls/03-pdp-womens-top.png`

### Implementation style guide

- `screenshots/style-guides/bealls-style-guide.png`

### Comparison

| Attribute | Source (live site) | Implementation | Verdict |
|---|---|---|---|
| Primary color | Red — appears `#c41e3a`-ish (slight orange-red, photographic capture so exact hex uncertain) | `#c8102e` | ✅ Matches direction; exact-hex eye-drop pending if we want pixel-precision |
| Secondary | Deeper red, used for hover states | `#a00d24` | ✅ Matches direction |
| Accent | Black `#222222`-ish for CTAs and chrome | `#1a1a1a` (black) | ✅ Matches |
| Surface bg | Off-white | `#ffffff` | ⚠️ Source has slightly warm gray bg in places; ours is pure white. Imperceptible at demo scale. |
| Display font | Friendly humanist sans (likely Mier or similar custom) | `Plus Jakarta Sans` | ✅ Visual match (humanist sans family) |
| Body font | Inter-like clean sans | `Inter` | ✅ Match |
| Wordmark | Custom "bealls" lowercase logotype with stylized "ll" ligature | Plain text "bealls" lowercase | ⚠️ Demo-quality — source has a custom wordmark; we render text. Phase 7 polish item. |
| Persistent shipping promo | Red strip below brand-tab nav: "FREE SHIPPING when you spend $99" | Same red strip via `promo-strip` urgency='hard' | ✅ Match |
| Sale badges | Red rectangular "SALE" / `$$` badges, top-left of card | Red rectangular badges via `showBadges` | ✅ Match |
| PLP grid | 4-column dense, square images, red Add-to-Bag CTAs | 4-column dense, square images, red Add-to-Cart CTAs (after fix) | ✅ Match |
| Pricing language | "Comparable value $20.00 — You save 50%" | Strikethrough `$price` + sale price (does not yet show "Comparable value $X" or "You save X%" labeling) | ❌ Needs refinement — *off-price grammar is core to Bealls's voice*. Must surface "Comparable value" + "You save X%" in price treatment. |
| Card brand line | Brand name above product title (e.g., "Joie De Vivre" / "Women's Solid Top") | Brand line above product title via `Product.brand` field | ✅ Match |
| Card star rating | Stars + count below title | Stars + count when `showRating: true` | ✅ Match |
| Multi-badge | Stacks "New" + "Deal" vertically on PDP | Multi-badge stacking via `badges: string[]` | ✅ Match |
| Voice | Friendly, value-driven, "Members earn $5 for every $100 spent" | Same in `voiceGuidance` + Bealls Bucks loyalty config | ✅ Match |
| Brand-strip cross-banner nav | Tabbed `bealls / Bealls Florida / HOME` at very top of every page | **Not yet implemented in Nav.svelte** | ❌ Needs implementation — flagged in audit synthesis as Phase 7 demo polish, but it's the most distinctive Bealls UI signature. |

### Honest assessment

The brand color, type system, sale-badge treatment, and PLP layout are good matches. **Two real refinements needed**:

1. **Off-price pricing language** is currently generic strikethrough. Should display "Comparable value $X" + "You save X%" — that's Bealls's distinctive vocabulary.
2. **Brand-strip cross-banner nav** at the top is missing. It's a very visible UI element on every Bealls family page.

These are demo-affecting and worth fixing before the live demo. Both are scoped: pricing language is a `ProductGrid.svelte` + `HeroProduct.svelte` template change; brand-strip nav is a new `BrandStripNav.svelte` component conditionally rendered for Bealls family brands.

---

## Banner 2 — beallsflorida.com

### Source captures

- Homepage: `screenshots/beallsflorida/01-homepage.png`
- PLP (Women): `screenshots/beallsflorida/02-plp-women.png`
- PDP (Bermuda Shorts): `screenshots/beallsflorida/03-pdp-bermuda-shorts.png`

### Implementation style guide

- `screenshots/style-guides/beallsflorida-style-guide.png`

### Comparison

| Attribute | Source (live site) | Implementation | Verdict |
|---|---|---|---|
| Primary color | Strong blue, appears `#0066b3`-ish | `#0066b3` | ✅ Match |
| Secondary | Deeper blue | `#004d8a` | ✅ Match |
| Accent | Bright teal-cyan, used for shipping strip and emphasis | `#00a3c4` | ✅ Match |
| Surface bg | White | `#ffffff` | ✅ Match |
| Display font | Mixed serif italic + sans — "FLORIDA IS A *feeling*" mixes a thick sans with flowing italic script | `Playfair Display` (italic-capable serif) for display | ✅ Match — Playfair Display italic captures the "feeling" italic register |
| Body font | Clean sans | `Inter` | ✅ Match |
| Wordmark | Distinctive cursive "Bealls Florida" logotype with the characteristic "/\\" mark | Plain text "Bealls Florida" | ⚠️ Demo-quality — same text-vs-logotype issue as bealls.com |
| Persistent shipping promo | Blue strip: "FREE SHIPPING when you spend $99" | Blue strip via `promo-strip` urgency='hard' | ✅ Match |
| PLP top section | **Hero banner with category title overlay** ("Women" with photographic background) | Supported via `category-header.heroImage` prop, but only renders if AI populates it; not auto-applied | ⚠️ Demo-quality — feature exists but needs catalog-data and AI prompting to surface in real layouts |
| PLP grid | **3-column** (more editorial than bealls's 4-column) | 3-column supported via `product-grid.columns: 3` | ✅ Match — AI will pick 3-col for BF based on persona/voice |
| Per-card swatch dots | Visible color circles on PLP cards | Not yet rendered (Tier 3 deferred — `swatch-grid` component) | ⚠️ Tier 3 deferred — known limitation |
| Personalized coupon strip on PDP | **Yellow** "OFFER for YOU — Spend $80, get $10 off — GET CODE" strip above PDP | Implemented via `coupon-strip` component (left border + warning-tinted background) | ✅ Match |
| Multi-badge | "New" + "Deal" stacking on PDP | Multi-badge via `badges[]` | ✅ Match |
| Voice | Coastal, lifestyle, "Sunshine state living" | "Florida is a feeling" hero copy + voice guidance match | ✅ Match |
| Sub-category nav strip on PLP | Horizontal text-link row above grid (NEW ARRIVALS / TOPS / BOTTOMS / etc.) | Supported via `category-header.subcategories[]` | ✅ Match — feature in place |

### Honest assessment

beallsflorida.com is the **best-matched of the three banners**. Color, typography, voice, and component treatment all align well with the source. The two demo-quality items (wordmark vs logotype, swatch-dots deferred) are explicitly known and tracked.

The **PLP hero banner** capability exists but only surfaces when the AI chooses to use it — Phase 5 enrichment + prompt tuning will make this consistent.

---

## Banner 3 — homecentric.com

### Source captures

- Homepage: `screenshots/homecentric/01-homepage.png`
- PLP / PDP: **Not applicable** — content-mode brand, no live e-commerce

### Implementation style guide

- `screenshots/style-guides/homecentric-style-guide.png`

### Comparison

| Attribute | Source (live site) | Implementation | Verdict |
|---|---|---|---|
| Primary color | Green — the "HOME" letterform color, appears `#76b82a`-ish | `#76b82a` | ✅ Match |
| Accent color | Red-orange — the "centric" wordmark dots, appears `#d04429`-ish | `#d04429` | ✅ Match |
| Surface bg | White / very light | `#ffffff` | ✅ Match |
| Display font | Mixed: bold sans for "HOME centric" wordmark + italic script for "*New Inspiration*" hero | `Lora` (editorial serif) | ⚠️ Demo-quality — Lora is closer to source than Caveat-everywhere was, but neither captures the source's mixed sans+script register exactly. Lora gives editorial home-decor feel which is the right register; the sparse hero-script accent is a Phase 7 polish item. |
| Body font | Clean sans | `Source Sans 3` | ✅ Match |
| Wordmark | Bold green "HOME" + script-style "centric" with red-orange dots between letters | Plain text "Home Centric" | ⚠️ Demo-quality — same text-vs-logotype gap |
| Hero treatment | Tri-image collage with center green "New Inspiration for LESS!" panel | Single editorial-hero in /test/components — full-bleed image with text overlay | ⚠️ Demo-quality — the tri-collage is a one-off pattern; tagged as deferred in Phase 1 audit (`tri-image-hero` was Tier 3) |
| Operating mode | Brick-and-mortar only — every CTA drives to store locator, no online catalog | **`mode: 'content'`** — ContentLayoutSchema excludes product-grid, hero-product, product-carousel, price-rail, lifestyle-price-hero, coupon-strip | ✅ Architectural match — content-mode is the **strongest fidelity decision** of the engagement |
| Voice | Editorial, "Inspired Living for Less", "The latest trends and unique decor at unbelievable prices" | Same `voiceGuidance` + persona definitions | ✅ Match |
| Persistent chrome | Minimal — just hamburger menu, no shopping cart, no search | **Currently uses storefront Nav.svelte** with cart/search/account icons — even in content mode | ❌ Needs refinement — content-mode brands should use a stripped-down Nav (no cart, no search, just locator + menu). |
| Categories | Furniture / Home Decor / Rugs / Entertaining / Lighting / Bedroom / Bath — content surfaces, not catalog routes | Content-mode categories defined as brand pillars, but the routes still resolve to `/c/{slug}` PLP layouts (which try to load BC products, will fail in content mode) | ⚠️ Architectural — Phase 4 needs to wire content-mode category routes to render content surfaces, not PLPs |

### Honest assessment

The **architectural match is strong**: choosing content mode over synthesizing-online was the right call and gives HC a fundamentally accurate operational posture. **One real refinement needed before demo**:

- **Content-mode Nav** must drop the cart/search/account chrome. Currently the site Nav assumes storefront mode. This is a `Nav.svelte` mode-aware update — small change, visible improvement.

The wordmark and tri-collage hero are Phase 7 polish items, not demo-blockers.

---

## Summary — what's matched, what needs refinement

### ✅ Cleanly matched across all three banners

- Color systems (primary, secondary, accent, surfaces) — all three palettes correctly applied
- Typography registers (sans for bealls, serif italic for BF, editorial serif for HC)
- Voice & persona definitions — all three brands have distinct voice profiles
- Component vocabulary subset per mode — content mode correctly excludes transactional components
- Sale-badge, multi-badge, star-rating, brand-line treatments — all in place
- Loyalty config — Bealls Rewards correctly cross-brand

### ❌ Real refinements needed before demo

| Item | Banners | Effort (agent target) |
|---|---|---|
| Off-price pricing language ("Comparable value $X — You save X%") | bealls, beallsflorida | ~30 min |
| Brand-strip cross-banner nav (tabbed `bealls / Bealls Florida / HOME` at top) | All three (especially Bealls family) | ~45 min |
| Content-mode Nav (drop cart/search/account from chrome on HC) | homecentric | ~15 min |
| Content-mode category routing (`/c/{slug}` should render content surfaces, not PLPs) | homecentric | ~30 min |

**Total**: ~2 hours of agent work to close the demo-quality gap.

### ⚠️ Demo-quality (acceptable for stakeholder demo, polish in Phase 7)

- Wordmark/logotype treatments (rendering text instead of brand logos for all three)
- Per-card swatch dots on apparel banners (Tier 3 deferred)
- Tri-image collage hero on HomeCentric (one-off pattern, Tier 3 deferred)
- Mixed sans+script register on HC (current Lora serif is closer than Caveat-everywhere; exact source register is a polish item)

### Pending Phase 4-5 surfacing

- Capabilities like `category-header.heroImage` and `subcategories[]` are implemented but only surface when the AI chooses to use them. Phase 5 enrichment + prompt tuning will make these consistent across category pages.

---

## Recommendation

**Close the four real refinements (`❌` items) before declaring Phase 3 demo-ready.** That's ~2 hours of agent work and resolves the visible brand-fidelity gaps. The remaining `⚠️` items are correctly tracked as Phase 7 polish.

Worth committing the four fixes as a single "Phase 3 brand-fidelity polish" commit, retest with the comparison method above, then call Phase 3 truly done.
