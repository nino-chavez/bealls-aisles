
/**
 * Build the system prompt for layout generation.
 * The AI receives persona definitions, component vocabulary, and product summaries.
 * It returns a Layout schema that the renderer interprets.
 *
 * Component vocabulary is surface-aware — the prompt only describes blocks that
 * are valid for the requested surface. Per ADR-006: home/PLP get the wide
 * merchandising set; PDP gets the cross-sell/related-zone subset; cart gets
 * just the upsell row; checkout gets the assurance strip + upsell. This keeps
 * the prompt input proportional to the surface's compositional latitude.
 */

import { getBrand, getBrandMode } from '$lib/brand/config';
import type { Surface, EmptyReason } from '$lib/schema/layout';

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

// ─── Block guide entries ──────────────────────────────────────────────
// Each entry describes one block to the AI: shape, key props, and which
// personas it serves. Persona affinity is symbolic ("Personas: hunter,
// gifter") rather than a "use for X / not for Y" pair — the negative
// is implied. Keep entries concise; the AI uses prop schema descriptions
// for fine-grained prop semantics.

const STOREFRONT_BLOCK_GUIDES: Record<string, string> = {
	'editorial-header': `"editorial-header" — Eyebrow + headline + body.
   Personas: gatherer (set tone), gifter (frame occasion).`,

	'hero-product': `"hero-product" — One large featured product (image, name, description, specs, price).
   Personas: gatherer, gifter.`,

	'product-grid': `"product-grid" — Grid of product cards. Configurable:
   - columns: 2 (editorial), 3 (moderate), 4 (dense)
   - imageRatio: "landscape" (editorial) or "square" (compact)
   - showDescription / showSpecs / showQuickAdd / showRating / showBadges
   Personas: hunter+gifter prefer quickAdd; gatherer+researcher prefer description; researcher+hunter prefer rating.`,

	'category-header': `"category-header" — Title bar with sort/filter; optional hero banner image and sub-category strip.
   Personas: hunter, researcher (lead block); any persona as a subtle header.
   - heroImage (optional): banner above the title (editorial PLPs)
   - subcategories (optional): sub-pillar text-link strip`,

	'promo-strip': `"promo-strip" — Thin promotional banner with eyebrow, headline, optional CTA.
   Props: eyebrow?, headline, ctaLabel?, ctaHref?, urgency ("none"|"soft"|"hard").
   Personas: hunter primary; gatherer for theme; skip for researcher.`,

	'category-tile-grid': `"category-tile-grid" — Visual category nav with photographic tiles.
   Props: sectionLabel?, columns (2-5), tiles[{label, image, href, description?}].
   Personas: gatherer, gifter, hunter. 4-5 tiles ideal; 2-3 for editorial pairs.`,

	'price-rail': `"price-rail" — Price-tier merchandising tiles.
   Props: columns (2-4), tiers[{label, image, href, savingsBadge?}].
   Personas: hunter primary, gifter for "under $X". Skip for gatherer, researcher.`,

	'product-carousel': `"product-carousel" — Horizontal scrolling product list with arrows.
   Props: title, products[], showRating, showBadges, showQuickAdd.
   Personas: any — title carries the framing (e.g. Best Sellers, Recommended For You).`,

	'coupon-strip': `"coupon-strip" — Personalized offer banner with code reveal.
   Props: eyebrow, headline, body?, code?, ctaLabel.
   Personas: hunter primary, gifter secondary. Distinct from promo-strip — has a code reveal CTA.`,

	'editorial-hero': `"editorial-hero" — Full-bleed image with text overlay.
   Props: image, eyebrow?, headline, body?, ctaLabel?, ctaHref?, textPosition ("left"|"center"|"right").
   Personas: gatherer primary, gifter (occasion framing). Stronger emotional hook than editorial-header.`,

	'bealls-bucks-callout': `"bealls-bucks-callout" — Loyalty earn/redemption preview.
   Props: mode ("earn"|"redeem"|"tier-progress"), amount, unit, threshold?, tierLabel?.
   Personas: any known shopper. earn=preview rewards; redeem=show balance; tier-progress=motivate spend.`,

	'lifestyle-price-hero': `"lifestyle-price-hero" — Large image with bold price overlay and CTA.
   Props: image, category, priceLabel, ctaLabel, ctaHref.
   Personas: hunter primary, gifter (under-$X). Skip for gatherer, researcher.`,

	'event-countdown': `"event-countdown" — Time-bound event with live countdown.
   Props: eyebrow?, headline, body?, endsAt (ISO 8601), ctaLabel?, ctaHref?.
   Personas: hunter (urgency), gatherer (event framing). Auto-hides after endsAt; never use for evergreen offers.`,

	'brand-spotlight': `"brand-spotlight" — Featured-brand callout with story image, body, CTA.
   Props: brandName, eyebrow?, headline, body, image, ctaLabel?, ctaHref?.
   Personas: gatherer, researcher. Distinct from editorial-hero (frames a brand story, not the site hero). One per page max.`,

	'trend-shop': `"trend-shop" — Themed seasonal collection card.
   Props: sectionLabel?, headline, image, ctaLabel, ctaHref.
   Personas: gatherer, gifter. Single themed destination, distinct from category-tile-grid (nav). Strong landscape image required.`,

	'email-capture-inline': `"email-capture-inline" — Inline email signup with offer reveal.
   Props: eyebrow?, headline, body?, offerCopy?, ctaLabel, privacyNote?.
   Personas: any. Most effective on home below-fold and PLP banners for cold visitors. Skip if a recent capture already happened on the page.`,

	'service-callouts-grid': `"service-callouts-grid" — Cluster of icon callouts (shipping/returns/BOPIS/rewards).
   Props: columns (3 or 4), callouts: Array<{icon, label, body?}>. 3-4 callouts.
   Personas: any. Trust strip — universal value props rather than a marketing message.
   ICON RULE: \`icon\` MUST be one of these named keys (lowercase): "shipping", "returns", "rewards", "store", "gift", "quality", "secure", "support". DO NOT emit emoji characters or emoji shortcodes — they render as a fallback circle outline. Pick the closest semantic match for the callout (e.g. label "Free shipping over $99" → icon "shipping"; "Easy returns" → "returns"; "Earn Bealls Bucks" → "rewards"; "Find a store" → "store").`,

	'locator-strip': `"locator-strip" — Thin "Visit your nearest store" strip with CTA.
   Props: eyebrow?, headline, body?, ctaLabel, ctaHref ("/store-locator").
   Personas: any; especially physical-retail brands. Use sparingly — once per page max.`,

	'bopis-strip': `"bopis-strip" — Proximity-aware "Free pickup at [Store] · Ready in 2 hours" strip.
   Props: storeName, distanceMi, readyByLabel, productName?, ctaLabel?, ctaHref? ("/store-locator").
   Personas: hunter (speed), researcher (certainty). On home.below-fold the engine may compose this when the shopper has a known nearby store with pickup-ready stock. On PDP the strip is foundation-rendered (request-data driven), so the engine should NOT emit bopis-strip on PDP — emit locator-strip there if a store callout is needed.`,

	'cluster-chip-row': `"cluster-chip-row" — Themed merchandising bins above a PLP grid (real-Bealls signature).
   Props: sectionLabel? (sentence-case lowercase, e.g. "outfit collections"), chips: 3-8 of {label, href}. Labels MUST be Title Case in storage; render code applies TRACKING-WIDE UPPERCASE.
   Use when the candidate pool clusters around 3+ cross-subcategory themes (e.g. tropical print + vacation outfit + warm weather → "VACATION OUTFITS"; bohemian + crochet + flowy → "BOHEMIAN ROMANCE"). Compose 3-8 chips; each href links to a search query, theme filter, or curated landing.
   Personas: gatherer (themed discovery), gifter (occasion bins). Hunter prefers filters over themes; researcher prefers specs over moods. Skip when the candidate pool has no strong cross-cut theme.`,

	'last-chance-upsell-row': `"last-chance-upsell-row" — Cart/checkout upsell row.
   Props: title, products: ProductRef[] (1-6, 3 ideal). Pick small-add products that pair with the cart.`,

	'assurance-strip-checkout': `"assurance-strip-checkout" — Pre-checkout trust strip.
   Props: items: Array<{icon, label, body?}> (2-4, 3 ideal); variant: "first-time" | "returning" | "loyalty-known".
   Pick variant by inferred shopper signal; first-time leans safety/returns, returning leans speed/welcome-back, loyalty-known leans tier benefits.
   ICON RULE: each item's \`icon\` MUST be one of these named keys (lowercase): "secure", "returns", "shipping", "rewards", "quality". DO NOT emit emoji characters or shortcodes — they fall back to a neutral circle.`,

	'for-you-row': `"for-you-row" — Personalized recommendations row.
   Props: title, reasoning?, products: ProductRef[] (3+, 4-6 ideal).
   Personas: any. Use on PDP to anchor a personalized recommendation block.`,
};

const CONTENT_BLOCK_GUIDES: Record<string, string> = {
	'editorial-header': `"editorial-header" — Eyebrow + headline + body.
   Personas: any. Lead with editorial framing — inspirational (gatherer), practical (hunter), story (researcher), occasion (gifter).`,

	'category-header': `"category-header" — Title bar for a category surface; optional hero banner and sub-category strip.`,

	'promo-strip': `"promo-strip" — Thin banner. Content mode: newsletter, in-store events, brand engagement.
   Props: eyebrow?, headline, ctaLabel, ctaHref? (omit for soft engagement), urgency ("none"|"soft"|"hard").`,

	'category-tile-grid': `"category-tile-grid" — Visual brand-pillar / category-pillar tiles. Tiles drive to category surfaces or store-locator (NOT product pages).
   Props: sectionLabel?, columns (2-5), tiles[{label, image, href, description?}].`,

	'editorial-hero': `"editorial-hero" — Full-bleed image with text overlay. Content mode: CTA drives to brand engagement (locator, newsletter), not transactional flow.
   Props: image, eyebrow?, headline, body?, ctaLabel?, ctaHref?, textPosition.`,

	'bealls-bucks-callout': `"bealls-bucks-callout" — Loyalty/rewards explainer (no transactional state). Introduce the program or highlight tier benefits.
   Props: mode ("earn"|"redeem"|"tier-progress"), amount, unit, threshold?, tierLabel?.`,

	'event-countdown': `"event-countdown" — Time-bound in-store event with live countdown.
   Props: eyebrow?, headline, body?, endsAt (ISO 8601), ctaLabel?, ctaHref?.
   In-store grand openings, store events, weekend promotions. CTA → /store-locator. Auto-hides after endsAt.`,

	'brand-spotlight': `"brand-spotlight" — Featured-brand or featured-store callout.
   Props: brandName, eyebrow?, headline, body, image, ctaLabel?, ctaHref?.
   Spotlight a featured store, brand pillar, or community partnership. One per page max.`,

	'email-capture-inline': `"email-capture-inline" — Newsletter signup with offer reveal.
   Props: eyebrow?, headline, body?, offerCopy?, ctaLabel, privacyNote?.
   Personas: any. Newsletter / store-opening alerts. Always appropriate in content mode.`,

	'service-callouts-grid': `"service-callouts-grid" — Cluster of icon callouts (find a store, hours, services, in-store help).
   Props: columns (3 or 4), callouts (3-4). Trust strip with in-store value props (skip transactional language).
   ICON RULE: \`icon\` MUST be one of "store", "support", "rewards", "secure", "gift", "quality" (lowercase named keys, not emoji).`,

	'locator-strip': `"locator-strip" — Thin "Visit a store" strip.
   Props: eyebrow?, headline, body?, ctaLabel, ctaHref ("/store-locator"). Use sparingly — once per page max.`,
};

// ─── Surface → block list mapping ─────────────────────────────────────
// Each surface advertises only the blocks valid for its compositional
// latitude. Schemas in src/lib/schema/layouts/*.ts enforce these unions
// at validation time; this mapping mirrors that constraint into the
// prompt input so the AI never sees blocks it cannot emit.
//
// Wide-latitude surfaces (home, plp, empty): full merchandising set.
// PDP: zone-fit blocks only (related/cross-sell/below-recs zones).
// Cart: just the upsell row.
// Checkout: assurance strip + optional upsell.

const STOREFRONT_WIDE_BLOCKS = [
	'editorial-header',
	'hero-product',
	'product-grid',
	'category-header',
	'promo-strip',
	'category-tile-grid',
	'price-rail',
	'product-carousel',
	'coupon-strip',
	'editorial-hero',
	'bealls-bucks-callout',
	'lifestyle-price-hero',
	'event-countdown',
	'brand-spotlight',
	'trend-shop',
	'email-capture-inline',
	'service-callouts-grid',
	'locator-strip',
	'bopis-strip',
	'cluster-chip-row',
];

const SURFACE_BLOCKS_STOREFRONT: Record<Surface, string[]> = {
	home: STOREFRONT_WIDE_BLOCKS,
	plp: STOREFRONT_WIDE_BLOCKS,
	empty: STOREFRONT_WIDE_BLOCKS,
	pdp: [
		'product-carousel',
		'for-you-row',
		'brand-spotlight',
		'trend-shop',
		'service-callouts-grid',
		'locator-strip',
	],
	cart: ['last-chance-upsell-row'],
	checkout: ['assurance-strip-checkout', 'last-chance-upsell-row'],
};

const CONTENT_WIDE_BLOCKS = [
	'editorial-header',
	'category-header',
	'promo-strip',
	'category-tile-grid',
	'editorial-hero',
	'bealls-bucks-callout',
	'event-countdown',
	'brand-spotlight',
	'email-capture-inline',
	'service-callouts-grid',
	'locator-strip',
];

const SURFACE_BLOCKS_CONTENT: Record<Surface, string[]> = {
	home: CONTENT_WIDE_BLOCKS,
	plp: CONTENT_WIDE_BLOCKS,
	empty: CONTENT_WIDE_BLOCKS,
	// PDP/cart/checkout are storefront-only per layout.ts router — content
	// brands have no products. These entries exist to keep the map total;
	// the schema router prevents these (surface, content) combos in practice.
	pdp: CONTENT_WIDE_BLOCKS,
	cart: CONTENT_WIDE_BLOCKS,
	checkout: CONTENT_WIDE_BLOCKS,
};

// ─── Per-surface rules block ──────────────────────────────────────────
// Wide surfaces share the merchandising rules (8-section cap, product-coverage,
// reasoning shape). Cart/checkout have narrower rules — fewer sections, no
// "every product must appear" constraint (cart upsell pulls from a candidate
// pool, not the whole catalog).

const STOREFRONT_WIDE_RULES = `RULES:
- Products are pre-sorted by relevance to this persona (highest fit first). Respect this order unless the layout demands otherwise.
- If a product has a persona-fit score, use it: high-fit products feature prominently (hero, top of grid); low-fit go later.
- Every product must appear in at least one section
- Every product must be purchasable (price always visible)
- Use the product IDs exactly as provided — do not invent IDs
- Sections are rendered top to bottom in the order you specify
- Maximum 8 sections total
- The "reasoning" field should explain your layout choices in 1-2 sentences`;

const PDP_RULES = `RULES:
- Products are pre-sorted by tag-overlap with the focal product. Respect this order.
- Use product IDs exactly as provided — do not invent IDs.
- Maximum 4 sections — these blocks slot into PDP zones (related, cross-sell, below-recs).
- The "reasoning" field should explain your selection in 1-2 sentences.`;

const CART_RULES = `RULES:
- Maximum 1 section (one last-chance-upsell-row). Return an empty sections array if no products fit.
- Use product IDs exactly as provided — do not invent IDs.
- The "reasoning" field should explain your selection in 1-2 sentences.`;

const CHECKOUT_RULES = `RULES:
- Maximum 2 sections (assurance-strip + optional last-chance-upsell-row).
- Use product IDs exactly as provided — do not invent IDs.
- The "reasoning" field should explain your variant + upsell choice in 1-2 sentences.`;

const CONTENT_WIDE_RULES = `CONTENT-MODE RULES:
- This brand has NO online catalog. Do not reference products, prices, sale events, or shipping.
- Every CTA should drive to in-store visits, store locator, or brand engagement (newsletter, RSVP).
- Persona still matters — Gatherer = inspirational lifestyle; Hunter = locator-first; Researcher = brand-story depth; Gifter = gift-occasion tied to in-store.
- The "productOrder" field should be an empty array.
- Maximum 8 sections total.
- The "reasoning" field should explain your layout choices in 1-2 sentences.`;

function rulesForSurface(surface: Surface, mode: 'storefront' | 'content'): string {
	if (mode === 'content') return CONTENT_WIDE_RULES;
	switch (surface) {
		case 'cart':
			return CART_RULES;
		case 'checkout':
			return CHECKOUT_RULES;
		case 'pdp':
			return PDP_RULES;
		default:
			return STOREFRONT_WIDE_RULES;
	}
}

function buildComponentGuide(surface: Surface, mode: 'storefront' | 'content'): string {
	const guides = mode === 'content' ? CONTENT_BLOCK_GUIDES : STOREFRONT_BLOCK_GUIDES;
	const surfaceMap = mode === 'content' ? SURFACE_BLOCKS_CONTENT : SURFACE_BLOCKS_STOREFRONT;
	const blockNames = surfaceMap[surface] ?? surfaceMap.home;

	const entries = blockNames
		.map((name, i) => {
			const body = guides[name];
			if (!body) return null;
			return `${i + 1}. ${body}`;
		})
		.filter((s): s is string => s !== null)
		.join('\n\n');

	const intro =
		mode === 'content'
			? `You have a non-transactional content vocabulary (${blockNames.length} components). This brand has NO products, NO prices, NO carts. Arrange editorial content + category framing to drive in-store visits, newsletter signups, and brand engagement.`
			: `You have ${blockNames.length} component${blockNames.length === 1 ? '' : 's'} available for this surface:`;

	return `${intro}\n\n${entries}\n\n${rulesForSurface(surface, mode)}`;
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

/**
 * Rescue framing for empty/404 surfaces (PRD-FND-012).
 *
 * The AI is told: this shopper hit a dead end. The rescue layout's job
 * is to surface alternative paths (popular categories, best-sellers,
 * known-good search terms, locator for content-mode brands) without
 * pretending the dead end didn't happen.
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
 * to compose a `last-chance-upsell-row` block above the checkout CTA.
 */
const CART_FRAMING = `CART CONTEXT: The cart's line items, subtotal, free-shipping meter, promo-code entry, and Checkout button are foundation-rendered from cart state. Your sole job is one \`last-chance-upsell-row\` section: pick 3 products from the candidate set that pair well with the persona, write a short title, and stop. If no qualifying products exist, return an empty \`sections\` array.`;

/**
 * Checkout surface framing — narrowest latitude per ADR-006 + ADR-007 §3.5.
 *
 * BC Optimized Checkout (FND-010) handles the actual checkout flow. This
 * surface is the *handoff page* between cart CTA and BC redirect.
 */
const CHECKOUT_FRAMING = `CHECKOUT HANDOFF CONTEXT: Payment, shipping, billing, and place-order UI are handled by BC Optimized Checkout (foundation-rendered). Compose at most two blocks: (1) an \`assurance-strip-checkout\` with the right \`variant\` for this shopper (\`first-time\` if no signals of prior visits — most demos; \`returning\` if signals suggest a repeat shopper; \`loyalty-known\` if a tier is known) and 3 \`items\` whose copy matches the variant. (2) Optionally, one \`last-chance-upsell-row\` with 3 small-add products that pair with the cart.`;

/**
 * PDP surface framing — narrow latitude per ADR-006.
 *
 * The PDP scaffold (gallery, title, variants, ATC, description, reviews)
 * is foundation-rendered. The AI fills the cross-sell / related / below-recs
 * zones with merchandising blocks drawn from the tag-overlap pool.
 */
const PDP_FRAMING = `PDP CONTEXT: The product detail scaffold (gallery, title, variants, ATC, description, reviews) is foundation-rendered. Your job is to compose merchandising blocks that slot into the PDP cross-sell / related / below-recs zones. Products are pre-sorted by tag-overlap with the focal product. Use product-carousel for related/cross-sell rows; for-you-row for personalized picks; brand-spotlight or trend-shop sparingly when one fits the focal product.`;

export interface BrandVoiceOverride {
	voiceGuidance: string | null;
	toneKeywords: string[];
	forbiddenTerms: string[];
}

export function buildLayoutPrompt(
	persona: string,
	categoryName: string,
	products: PromptProduct[],
	picksContext?: string,
	rulesContext?: string,
	probabilities?: { gatherer: number; hunter: number; researcher: number; gifter: number },
	options?: { surface?: Surface; reason?: EmptyReason; tagIntents?: string[]; voiceOverride?: BrandVoiceOverride | null },
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

	const surface = options?.surface ?? 'home';

	// Cart and checkout don't need the AVAILABLE PRODUCTS block when content
	// mode is active (no products in content mode). For storefront cart/checkout,
	// the candidate pool is small (12 products from tag-overlap or popular pool)
	// and matters for the upsell selection — keep it.
	const productsBlock = mode === 'content'
		? '' // content-mode brands have no products
		: `\nAVAILABLE PRODUCTS (${filtered.length} items, top by ${persona} fit):\n${productSummaries}\n`;

	const isHome = categoryName === 'Home';
	const isEmpty = surface === 'empty';
	const isCart = surface === 'cart';
	const isCheckout = surface === 'checkout';
	const isPDP = surface === 'pdp';

	// ADR-008 Phase A: when refinement chat extracted shopper-intent tags,
	// surface them so the AI orders product sections by tag relevance + persona-fit
	// and aligns section copy with the intent. Empty/missing → no-op.
	const tagIntentsBlock = options?.tagIntents && options.tagIntents.length > 0
		? `\nSHOPPER INTENT TAGS: ${options.tagIntents.map((t) => `"${t}"`).join(', ')}.
The shopper has expressed concrete attribute intent through refinement chat. Products in AVAILABLE PRODUCTS are pre-filtered + reranked by tag-overlap with these intents. Order grids and the hero (if any) by tag relevance first, persona-fit second. Reflect the intent in section copy where natural — e.g., "Cozy picks", "Built for warm-weather", "Hand-picked classics" — without parroting the tag names verbatim.\n`
		: '';
	const reason = options?.reason;
	const surfaceLabel = isEmpty
		? `${reason ?? 'rescue'} rescue page`
		: isCart
			? 'cart upsell row'
			: isCheckout
				? 'checkout handoff page'
				: isPDP
					? 'product detail page'
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
				: isPDP
					? `\n${PDP_FRAMING}\n`
					: isHome
						? `\nHOMEPAGE CONTEXT: This is the brand's landing page — the shopper's first impression. The products span all categories, pre-sorted to show the strongest persona-fit first. Use a richer mix of components than a category page: an editorial-hero or hero-product to anchor, a category-tile-grid to surface the brand's range, a product-carousel for featured picks, and persona-appropriate promo (price-rail for Hunter, coupon-strip for Gifter, bealls-bucks-callout for any known shopper). DO NOT use category-header on the homepage — that's for category pages only.\n`
						: '';

	// Empty/rescue + cart + checkout surfaces source from the home loader,
	// which yields `categoryName: "Home"`. Emitting `CATEGORY: Home` alongside
	// the surface framing makes the AI confabulate. Skip the category line for
	// these surfaces — the surface framing carries the context.
	const categoryLine = isEmpty || isCart || isCheckout || isPDP ? '' : `\nCATEGORY: ${categoryName}`;

	// Admin-authored voice override (PRD-ADM-005) — replaces brand-config voice
	// when present so a brand manager can edit voice without a code deploy.
	const voiceOverride = options?.voiceOverride ?? null;
	const voiceText = voiceOverride?.voiceGuidance?.trim() || brand.prompt.voiceGuidance;
	const voiceTones = voiceOverride?.toneKeywords?.length
		? `\nTONE KEYWORDS: ${voiceOverride.toneKeywords.join(', ')}`
		: '';
	const voiceForbidden = voiceOverride?.forbiddenTerms?.length
		? `\nFORBIDDEN TERMS (do not use these words): ${voiceOverride.forbiddenTerms.join(', ')}`
		: '';

	return `${modeRole}

VOICE: ${voiceText}${voiceTones}${voiceForbidden}

PERSONA:
${personaDef}
${probabilities ? `
PROBABILITY VECTOR: gatherer ${Math.round(probabilities.gatherer * 100)}% | hunter ${Math.round(probabilities.hunter * 100)}% | researcher ${Math.round(probabilities.researcher * 100)}% | gifter ${Math.round(probabilities.gifter * 100)}%
The primary persona is ${persona}, but blend in elements from secondary personas if their score is above 25%. For example, if researcher is 30% alongside a hunter primary, show specs alongside the dense grid.` : ''}
${categoryLine}${homeGuidance}${tagIntentsBlock}
${productsBlock}${picksContext || ''}${rulesContext || ''}${validHrefBlock}
${buildComponentGuide(surface, mode)}

Generate a layout for this ${persona} shopper landing on the ${surfaceLabel}.`;
}
