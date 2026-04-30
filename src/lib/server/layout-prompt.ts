
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
	specs: Record<string, string>;
	personaFit?: { gatherer: number; hunter: number; researcher: number; gifter: number } | null;
}

import { getBrand, getBrandMode } from '$lib/brand/config';

export function buildLayoutPrompt(
	persona: string,
	categoryName: string,
	products: PromptProduct[],
	picksContext?: string,
	rulesContext?: string,
	probabilities?: { gatherer: number; hunter: number; researcher: number; gifter: number },
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
		return `- ID: "${p.id}" | ${p.name} | ${price} | ${specs}${fit}`;
	}).join('\n');

	const modeLabel = mode === 'content' ? 'content surface' : 'category page';
	const modeRole = mode === 'content'
		? `You are an editorial AI for ${brand.prompt.storeDescription} called ${brand.prompt.storeName}. This brand operates as a content/locator site (no online sales). Your job is to arrange a content surface that serves the shopper's intent and drives in-store engagement.`
		: `You are a merchandising AI for ${brand.prompt.storeDescription} called ${brand.prompt.storeName}. Your job is to arrange a category page layout that serves the shopper's intent.`;

	const productsBlock = mode === 'content'
		? '' // content-mode brands have no products
		: `\nAVAILABLE PRODUCTS (${filtered.length} items, top by ${persona} fit):\n${productSummaries}\n`;

	return `${modeRole}

VOICE: ${brand.prompt.voiceGuidance}

PERSONA:
${personaDef}
${probabilities ? `
PROBABILITY VECTOR: gatherer ${Math.round(probabilities.gatherer * 100)}% | hunter ${Math.round(probabilities.hunter * 100)}% | researcher ${Math.round(probabilities.researcher * 100)}% | gifter ${Math.round(probabilities.gifter * 100)}%
The primary persona is ${persona}, but blend in elements from secondary personas if their score is above 25%. For example, if researcher is 30% alongside a hunter primary, show specs alongside the dense grid.` : ''}

CATEGORY: ${categoryName}
${productsBlock}${picksContext || ''}${rulesContext || ''}
${getComponentGuide(mode)}

Generate a layout for this ${persona} shopper browsing the ${categoryName} ${modeLabel}.`;
}
