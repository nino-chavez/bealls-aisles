
/**
 * Build the system prompt for layout generation.
 * The AI receives persona definitions, component vocabulary, and product summaries.
 * It returns a Layout schema that the renderer interprets.
 */

const PERSONA_DEFINITIONS: Record<string, string> = {
	gatherer: `GATHERER persona — an exploratory, inspiration-driven shopper.
They browse at a leisurely pace, relying on visual cues and editorial storytelling.
They want to discover, be inspired, and imagine how pieces fit their space.

Layout principles:
- Lead with an editorial header (eyebrow + headline + body copy)
- Feature one hero product with a large lifestyle image and detailed specs
- Use a 2-column editorial grid with landscape (4:3) images
- Show product descriptions — the story matters
- No quick-add buttons — this shopper wants to browse, not rush
- Copy should be warm, editorial, magazine-like (think shelter magazine)
- Order products by visual appeal and narrative flow, not price`,

	hunter: `HUNTER persona — a goal-oriented, efficiency-driven shopper.
They know what they need and want to find it fast. Price and specs matter most.
The interface should get out of the way.

Layout principles:
- Lead with a compact category header showing count and sort/filter controls
- Use a dense 3-4 column grid with square images
- Show specs inline (material, dimensions — the facts)
- Show quick-add buttons on every card
- No editorial copy — no hero product, no lifestyle stories
- Sort products by price (low to high) by default
- Copy should be minimal and functional`,

	researcher: `RESEARCHER persona — a methodical, evidence-driven shopper.
They compare options systematically, reading specs, reviews, and expert opinions.
They want data to make an informed decision, not inspiration or speed.

Layout principles:
- Lead with a category header showing count, sort by rating, and filter controls
- Use a 2-3 column grid with square images
- Show full specs inline on every card (material, dimensions, weight, features)
- Show product descriptions — detail matters
- No quick-add buttons — they're not ready to buy yet, they're evaluating
- No editorial fluff — factual, structured, comparison-friendly
- Order products by relevance to query, then by rating/review count
- Copy should be informative and precise`,

	gifter: `GIFTER persona — shopping for someone else, often with a budget and occasion.
They need guidance on what makes a good gift, price tiers, and giftability.
They want curation and confidence that the recipient will love it.

Layout principles:
- Lead with an editorial header framing the gift context (occasion, recipient type)
- Feature one hero product as the "top pick" with a clear value proposition
- Use a 2-3 column grid with landscape images (gifts should look appealing)
- Show product descriptions focused on why it makes a great gift
- Show quick-add buttons — gifters decide faster once convinced
- Group or call out price tiers ("Under $100", "Splurge-worthy")
- Copy should be warm, reassuring, and focused on the recipient's experience
- Order products by giftability score (universal appeal, presentation, value)`,
};

const STOREFRONT_COMPONENT_GUIDE = `You have 9 components available:

1. "editorial-header" — Eyebrow label, headline, body copy.
   Use for: Gatherer (set tone), Gifter (frame occasion). Not for Hunter or Researcher.

2. "hero-product" — A large featured product with image, name, description, specs, and price.
   Use for: Gatherer and Gifter layouts to highlight one standout product. Not for Hunter or Researcher.

3. "product-grid" — A grid of product cards. Configurable:
   - columns: 2 (editorial), 3 (moderate), 4 (dense)
   - imageRatio: "landscape" (4:3, editorial) or "square" (compact)
   - showDescription: true for editorial/research, false for dense
   - showSpecs: true to show material/dimensions line
   - showQuickAdd: true for Hunter and Gifter, false for Gatherer and Researcher
   - showRating: true to show star rating + review count (recommended for Hunter and Researcher)
   - showBadges: true to surface per-product labels like "New", "Deal", "Clearance"

4. "category-header" — Compact title bar with sort/filter, optional hero banner.
   Use for: Hunter and Researcher leading sections; any persona as a subtle header.
   - heroImage (optional): banner image URL above the title — use for editorial PLPs (e.g., Gatherer landing on a category)
   - subcategories (optional): array of {label, href} for an above-grid sub-category navigation strip

5. "promo-strip" — A thin promotional banner with eyebrow, headline, and optional CTA.
   Props: eyebrow (optional), headline, ctaLabel (optional), ctaHref (optional), urgency ("none" | "soft" | "hard").
   Use for: Free shipping callouts, themed shop announcements ("the trend shop"), event promos. Hunter benefits most; Gatherer for theme; skip for Researcher (too marketing).

6. "category-tile-grid" — Visual category nav with photographic tiles.
   Props: sectionLabel (optional), columns (2/3/4/5), tiles[{label, image, href, description?}]
   Use for: Gatherer (visual exploration), Gifter (giftable category framing), Hunter (fast category drilling). 4-5 tiles ideal; 2-3 for editorial pairs.

7. "price-rail" — Price-tier merchandising tiles ("Under $25", "Under $50").
   Props: columns (2/3/4), tiers[{label, image, href, savingsBadge?}]
   Use for: Hunter primary (deal-finding), Gifter for "under $X" framing. Skip for Gatherer (too price-forward) and Researcher (too generic).

8. "product-carousel" — Horizontal scrolling product list with arrows.
   Props: title, products[], showRating, showBadges, showQuickAdd
   Use for: Best Sellers, Customers Also Purchased, Recommended For You. Works across personas; the title carries the persona framing.

9. "coupon-strip" — Personalized offer banner with code reveal.
   Props: eyebrow, headline, body (optional), code (optional), ctaLabel
   Use for: Personalized offers (Hunter primary, Gifter secondary). Distinct from promo-strip — coupon-strip is brighter, has a code reveal CTA, and frames a specific dollar/% offer with optional terms.

10. "editorial-hero" — Full-bleed image with text overlay (eyebrow, headline, optional body, optional CTA).
    Props: image, eyebrow (optional), headline, body (optional), ctaLabel (optional), ctaHref (optional), textPosition ("left" | "center" | "right").
    Use for: Gatherer primary (lifestyle/editorial framing) and Gifter (occasion framing). Stronger emotional hook than editorial-header. Skip for Hunter and Researcher (too aspirational).

11. "bealls-bucks-callout" — Loyalty earning/redemption preview.
    Props: mode ("earn" | "redeem" | "tier-progress"), amount, unit, threshold (optional), tierLabel (optional).
    Use for: Known shoppers across all personas. earn=preview rewards on this order; redeem=show available balance; tier-progress=motivate spend to next tier. Shows naturally when loyalty state is present.

12. "lifestyle-price-hero" — Large image with bold price overlay and CTA ("handbags starting at $19.99").
    Props: image, category, priceLabel, ctaLabel, ctaHref.
    Use for: Hunter primary (price-anchored category teaser), Gifter (under-$X gift framing). Skip for Gatherer (too price-forward) and Researcher (too generic).

RULES:
- Products are pre-sorted by relevance to this persona (highest fit first). Respect this order unless the layout demands otherwise.
- If a product has a persona-fit score, use it: high-fit products feature prominently (hero, top of grid); low-fit go later.
- Every product must appear in at least one section
- Every product must be purchasable (price always visible)
- Use the product IDs exactly as provided — do not invent IDs
- Sections are rendered top to bottom in the order you specify
- Maximum 8 sections total
- The "reasoning" field should explain your layout choices in 1-2 sentences`;

const CONTENT_COMPONENT_GUIDE = `You have a non-transactional content vocabulary. This brand operates as a content/locator site — there are NO products, NO prices, NO carts. Your job is to arrange editorial content and category framing to drive in-store visits, newsletter signups, and brand engagement.

Available components:

1. "editorial-header" — Eyebrow label, headline, body copy.
   Use for: All personas. Lead the page with editorial framing that matches the persona — inspirational for Gatherer, practical for Hunter, story-driven for Researcher, gift-occasion for Gifter.

2. "category-header" — Title bar for a category surface, with optional hero banner image and sub-category strip.

3. "promo-strip" — Thin promotional banner. In content mode, use for newsletter callouts, in-store events, brand engagement ("Find a store near you", "Subscribe for new-store openings").
   Props: eyebrow (optional), headline, ctaLabel, ctaHref (optional, omit for soft engagement), urgency ("none" | "soft" | "hard").

4. "category-tile-grid" — Visual brand-pillar tiles or category-pillar tiles. In content mode, tiles drive to category surfaces or store-locator queries, NOT product pages.
   Props: sectionLabel (optional), columns (2/3/4/5), tiles[{label, image, href, description?}].

5. "editorial-hero" — Full-bleed image with text overlay (eyebrow, headline, optional body, optional CTA).
   In content mode the CTA should drive to brand engagement (locator, newsletter), NOT a transactional flow.
   Props: image, eyebrow (optional), headline, body (optional), ctaLabel (optional), ctaHref (optional), textPosition.

6. "bealls-bucks-callout" — Loyalty/rewards explainer in content mode (no transactional state). Use to introduce the rewards program or highlight tier benefits.
   Props: mode ("earn" | "redeem" | "tier-progress"), amount, unit, threshold (optional), tierLabel (optional).

CONTENT-MODE RULES:
- This brand has NO online catalog. Do not reference products, prices, sale events, or shipping.
- Every CTA should drive to in-store visits, store locator, or brand engagement (newsletter, RSVP).
- Persona still matters — Gatherer = inspirational lifestyle scenes; Hunter = locator-first ("find your store"); Researcher = brand-story depth; Gifter = gift-occasion framing tied to in-store experience.
- The "productOrder" field should be an empty array for content-mode brands.
- Maximum 8 sections total.
- The "reasoning" field should explain your layout choices in 1-2 sentences.`;

function getComponentGuide(mode: 'storefront' | 'content'): string {
	return mode === 'content' ? CONTENT_COMPONENT_GUIDE : STOREFRONT_COMPONENT_GUIDE;
}

interface PromptProduct {
	id: string;
	name: string;
	price: number;
	salePrice?: number;
	image?: string;
	specs: Record<string, string>;
	personaFit?: { gatherer: number; hunter: number; researcher: number; gifter: number } | null;
}

import { getBrand, getBrandMode } from '$lib/brand/config';
import type { Surface, EmptyReason } from '$lib/schema/layout';

/**
 * Rescue framing for empty/404 surfaces (PRD-FND-012).
 *
 * The AI is told: this shopper hit a dead end. The rescue layout's job
 * is to surface alternative paths (popular categories, best-sellers,
 * known-good search terms, locator for content-mode brands) without
 * pretending the dead end didn't happen.
 *
 * Each reason gets reason-specific framing — the AI knows whether
 * the shopper just hit a 404 vs. emptied their cart vs. searched for
 * something we don't carry. The rescue should feel different in each
 * case.
 */
const EMPTY_REASON_FRAMING: Record<EmptyReason, string> = {
	'not-found': `RESCUE CONTEXT: The shopper landed on a missing page (404). Acknowledge the dead end gently in the lead block, then pivot to alternative paths: popular categories, a best-seller carousel, an editorial entry point. Lead copy should be brand-voice, not generic ("Looks like that page wandered off — here's what's selling this week" beats "404 Not Found"). One CTA back to home/categories must be obvious. Skip price-rail and coupon-strip — this is rescue, not a deal moment.`,
	'empty-cart': `RESCUE CONTEXT: The shopper opened their cart and it's empty. Don't restate "your cart is empty" — the foundation already shows that copy. The rescue's job is to tee up the next add-to-cart: popular products, items frequently bought, a free-shipping nudge if the brand has a threshold, a bealls-bucks-callout if loyalty applies. Keep it short — 3–4 sections max. Lead with a product-carousel or hero-product, not editorial copy.`,
	'empty-search': `RESCUE CONTEXT: The shopper searched and got zero results. Acknowledge the miss in 1 sentence, then surface alternative paths: popular categories from the brand's catalog, a "shoppers also looked at" carousel of best-sellers, related semantic categories. Lead block should suggest specific search refinements ("Try 'sectional' instead of 'big couch'") rather than generic "browse our catalog." Skip price-rail and editorial-hero — this needs to feel like a helpful pivot, not a marketing moment.`,
	'empty-wishlist': `RESCUE CONTEXT: The shopper opened their picks/wishlist and there's nothing saved. Frame the rescue as "things worth saving" — a curated carousel of high-fit products, a category-tile-grid for browsing, an editorial-header that explains the picks affordance ("Tap the heart on anything to save it here"). One section should explicitly teach the picks/save mechanic. Skip coupon-strip and price-rail — picks is a curation moment, not a deal moment.`,
};

const EMPTY_REASON_FRAMING_CONTENT: Record<EmptyReason, string> = {
	'not-found': `RESCUE CONTEXT (content mode): The shopper landed on a missing page. This brand is content/locator-only — no products, no cart. Pivot to in-store affordances: a category-tile-grid of brand pillars (each tile drives to a content surface or store-locator), an editorial-hero with a "find your store" CTA, a promo-strip for newsletter signup. Acknowledge the dead end gently, then drive in-store engagement.`,
	'empty-cart': `RESCUE CONTEXT (content mode): This shouldn't happen — content-mode brands have no cart. If you receive this reason, render an editorial-header explaining "this brand is in-store only" + a category-tile-grid + a store-locator promo-strip.`,
	'empty-search': `RESCUE CONTEXT (content mode): The shopper searched but this brand has no online catalog. Lead with an editorial-header pivoting to in-store discovery, then category-tile-grid of brand pillars, then a promo-strip with "find your nearest store" CTA. Make clear this is a locator brand without sounding apologetic.`,
	'empty-wishlist': `RESCUE CONTEXT (content mode): No wishlist in content mode. Render an editorial-header explaining the brand is in-store only + a category-tile-grid + a store-locator promo-strip.`,
};

/**
 * Cart surface framing — narrow latitude per ADR-006 + ADR-007 §3.4.
 *
 * The cart's mandatory scaffold (line items, summary, free-shipping meter,
 * promo entry, checkout CTA) is foundation-rendered. The AI's only job is
 * to compose a `last-chance-upsell-row` block above the checkout CTA,
 * choosing 3 products from the candidate set that pair well with what the
 * shopper has signaled (persona-fit ranking today; tag-overlap when
 * PRD-ENG-019 lands).
 */
const CART_FRAMING = `CART CONTEXT: The shopper is reviewing their cart and you ONLY compose the upsell row that appears above the checkout CTA. The cart's line items, subtotal, free-shipping meter, promo-code entry, and Checkout button are all foundation-rendered from cart state — DO NOT emit those. Your sole job is one \`last-chance-upsell-row\` section: pick 3 products from the candidate set that pair well with the persona, write a short title ("Last chance — pair these with your order" or persona-aware variant), and stop. If no qualifying products exist, return an empty \`sections\` array. Skip everything else — no editorial-hero, no promo-strip, no category tiles, nothing else is valid here.`;

/**
 * Checkout surface framing — narrowest latitude per ADR-006 + ADR-007 §3.5.
 *
 * BC Optimized Checkout (FND-010) handles the actual checkout flow. This
 * surface is the *handoff page* between cart CTA and BC redirect. The AI
 * emits at most two blocks: an `assurance-strip-checkout` (variant by
 * inferred shopper signal) and an optional `last-chance-upsell-row`.
 */
const CHECKOUT_FRAMING = `CHECKOUT HANDOFF CONTEXT: The shopper is between cart and BC Optimized Checkout. The redirect to BC's hosted checkout is foundation-rendered — DO NOT compose any payment, shipping, billing, or place-order UI. Compose at most two blocks: (1) an \`assurance-strip-checkout\` with the right \`variant\` for this shopper (\`first-time\` if no signals of prior visits — most demos; \`returning\` if signals suggest a repeat shopper; \`loyalty-known\` if a tier is known) and 3 \`items\` whose copy matches the variant — first-time leans safety/return language, returning leans speed/welcome-back, loyalty-known leans tier benefits. (2) Optionally, one \`last-chance-upsell-row\` with 3 small-add products that pair with the cart. If you have nothing for the upsell, omit it. Stop there.`;

export function buildLayoutPrompt(
	persona: string,
	categoryName: string,
	products: PromptProduct[],
	picksContext?: string,
	rulesContext?: string,
	probabilities?: { gatherer: number; hunter: number; researcher: number; gifter: number },
	options?: { surface?: Surface; reason?: EmptyReason },
): string {
	const brand = getBrand();
	const mode = getBrandMode(brand);
	const personaDef = PERSONA_DEFINITIONS[persona] || PERSONA_DEFINITIONS.gatherer;

	// Pre-filter to top 15 by persona-fit for layout efficiency.
	// The AI only selects 4-8 products; sending 50 wastes tokens.
	const MAX_LAYOUT_PRODUCTS = 15;
	const filtered = products.length > MAX_LAYOUT_PRODUCTS
		? [...products]
			.sort((a, b) => {
				const fitA = a.personaFit?.[persona as keyof NonNullable<typeof a.personaFit>] ?? 0.5;
				const fitB = b.personaFit?.[persona as keyof NonNullable<typeof b.personaFit>] ?? 0.5;
				return fitB - fitA;
			})
			.slice(0, MAX_LAYOUT_PRODUCTS)
		: products;

	const productSummaries = filtered.map((p) => {
		const specs = Object.entries(p.specs)
			.slice(0, 3)
			.map(([k, v]) => `${k}: ${v}`)
			.join(', ');
		const price = p.salePrice
			? `$${p.salePrice} (sale from $${p.price})`
			: `$${p.price}`;
		const fit = p.personaFit
			? ` | ${persona}-fit: ${(p.personaFit[persona as keyof typeof p.personaFit] * 100).toFixed(0)}%`
			: '';
		const imageRef = p.image ? ` | image: "${p.image}"` : '';
		return `- ID: "${p.id}" | ${p.name} | ${price} | ${specs}${fit}${imageRef}`;
	}).join('\n');

	const validCategorySlugs = Object.keys(brand.categories);
	const productHrefRule = mode === 'content'
		? '- "/store-locator" — store locator (preferred CTA destination in content mode)\n- "/account/rewards" — rewards page'
		: '- "/product/{id}" where {id} is exactly one of the product IDs listed above\n- "/store-locator" — store locator page\n- "/account/rewards" — rewards page';
	const brandHeroImage = brand.homepage?.heroImage;
	const imageRule = mode === 'content'
		? `For editorial-hero, category-tile-grid, lifestyle-price-hero: the ONLY allowed image URL is the brand hero "${brandHeroImage ?? ''}". Reuse it across sections if needed, or omit the image field entirely. Never invent other URLs (no images.bealls.com, no other unsplash photos).`
		: 'For category-tile-grid, editorial-hero, lifestyle-price-hero, price-rail tiles: use the exact "image" URL of one of the AVAILABLE PRODUCTS above. Never invent image hosts (no images.bealls.com, no unsplash, no stock.adobe). If no suitable product image exists, OMIT the image field.';
	const validHrefBlock = `\nVALID URL PATHS (only emit these — never invent paths):
- "/" — homepage
- "/category/{slug}" where slug ∈ {${validCategorySlugs.map((s) => `"${s}"`).join(', ')}}
${productHrefRule}

NEVER use query strings (e.g. "?price=0-10"), invented sub-paths (e.g. "/c/women/tops"), or external domains.

VALID IMAGES:
- ${imageRule}\n`;

	const modeLabel = mode === 'content' ? 'content surface' : 'category page';
	const modeRole = mode === 'content'
		? `You are an editorial AI for ${brand.prompt.storeDescription} called ${brand.prompt.storeName}. This brand operates as a content/locator site (no online sales). Your job is to arrange a content surface that serves the shopper's intent and drives in-store engagement.`
		: `You are a merchandising AI for ${brand.prompt.storeDescription} called ${brand.prompt.storeName}. Your job is to arrange a category page layout that serves the shopper's intent.`;

	const productsBlock = mode === 'content'
		? '' // content-mode brands have no products
		: `\nAVAILABLE PRODUCTS (${filtered.length} items, top by ${persona} fit):\n${productSummaries}\n`;

	const isHome = categoryName === 'Home';
	const isEmpty = options?.surface === 'empty';
	const isCart = options?.surface === 'cart';
	const isCheckout = options?.surface === 'checkout';
	const reason = options?.reason;
	const surfaceLabel = isEmpty
		? `${reason ?? 'rescue'} rescue page`
		: isCart
			? 'cart upsell row'
			: isCheckout
				? 'checkout handoff page'
				: isHome
					? 'homepage'
					: `${categoryName} ${modeLabel}`;
	const emptyFraming = isEmpty && reason
		? `\n${(mode === 'content' ? EMPTY_REASON_FRAMING_CONTENT : EMPTY_REASON_FRAMING)[reason]}\n`
		: '';
	const homeGuidance = isEmpty
		? emptyFraming
		: isCart
			? `\n${CART_FRAMING}\n`
			: isCheckout
				? `\n${CHECKOUT_FRAMING}\n`
				: isHome
					? `\nHOMEPAGE CONTEXT: This is the brand's landing page — the shopper's first impression. The products span all categories, pre-sorted to show the strongest persona-fit first. Use a richer mix of components than a category page: an editorial-hero or hero-product to anchor, a category-tile-grid to surface the brand's range, a product-carousel for featured picks, and persona-appropriate promo (price-rail for Hunter, coupon-strip for Gifter, bealls-bucks-callout for any known shopper). DO NOT use category-header on the homepage — that's for category pages only.\n`
					: '';

	// Empty/rescue + cart + checkout surfaces source from the home loader,
	// which yields `categoryName: "Home"`. Emitting `CATEGORY: Home` alongside
	// the surface framing makes the AI confabulate. Skip the category line for
	// these surfaces — the surface framing carries the context.
	const categoryLine = isEmpty || isCart || isCheckout ? '' : `\nCATEGORY: ${categoryName}`;

	return `${modeRole}

VOICE: ${brand.prompt.voiceGuidance}

PERSONA:
${personaDef}
${probabilities ? `
PROBABILITY VECTOR: gatherer ${Math.round(probabilities.gatherer * 100)}% | hunter ${Math.round(probabilities.hunter * 100)}% | researcher ${Math.round(probabilities.researcher * 100)}% | gifter ${Math.round(probabilities.gifter * 100)}%
The primary persona is ${persona}, but blend in elements from secondary personas if their score is above 25%. For example, if researcher is 30% alongside a hunter primary, show specs alongside the dense grid.` : ''}
${categoryLine}${homeGuidance}
${productsBlock}${picksContext || ''}${rulesContext || ''}${validHrefBlock}
${getComponentGuide(mode)}

Generate a layout for this ${persona} shopper landing on the ${surfaceLabel}.`;
}
