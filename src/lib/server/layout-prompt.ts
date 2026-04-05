import type { Product } from '$lib/types';

/**
 * Build the system prompt for layout generation.
 * The AI receives persona definitions, component vocabulary, and product summaries.
 * It returns a Layout schema that the renderer interprets.
 */

const PERSONA_DEFINITIONS = {
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
};

const COMPONENT_GUIDE = `You have exactly 4 components to work with:

1. "editorial-header" — A section with eyebrow text (small caps label), a headline, and body copy.
   Use for: Gatherer layouts to set the editorial tone. Not for Hunter.

2. "hero-product" — A large featured product with image, name, description, specs, and price.
   Use for: Gatherer layouts to highlight one standout product. Not for Hunter.

3. "product-grid" — A grid of product cards. Configurable:
   - columns: 2 (editorial), 3 (moderate), 4 (dense)
   - imageRatio: "landscape" (4:3, editorial) or "square" (compact)
   - showDescription: true for editorial, false for dense
   - showSpecs: true to show material/dimensions line
   - showQuickAdd: true for Hunter, false for Gatherer

4. "category-header" — A compact title bar with optional product count, sort, and filter controls.
   Use for: Hunter layouts as the leading section. Can also be used for Gatherer as a subtle header.

RULES:
- Every product must appear in at least one section
- Every product must be purchasable (price always visible)
- Use the product IDs exactly as provided — do not invent IDs
- Sections are rendered top to bottom in the order you specify
- Maximum 8 sections total
- The "reasoning" field should explain your layout choices in 1-2 sentences`;

export function buildLayoutPrompt(
	persona: string,
	categoryName: string,
	products: Product[]
): string {
	const personaDef = PERSONA_DEFINITIONS[persona as keyof typeof PERSONA_DEFINITIONS]
		|| PERSONA_DEFINITIONS.gatherer;

	const productSummaries = products.map((p) => {
		const specs = Object.entries(p.specs)
			.slice(0, 3)
			.map(([k, v]) => `${k}: ${v}`)
			.join(', ');
		const price = p.salePrice
			? `$${p.salePrice} (sale from $${p.price})`
			: `$${p.price}`;
		return `- ID: "${p.id}" | ${p.name} | ${price} | ${specs}`;
	}).join('\n');

	return `You are a merchandising AI for a furniture store called Haven. Your job is to arrange a category page layout that serves the shopper's intent.

PERSONA:
${personaDef}

CATEGORY: ${categoryName}

AVAILABLE PRODUCTS (${products.length} items):
${productSummaries}

${COMPONENT_GUIDE}

Generate a layout for this ${persona} shopper browsing the ${categoryName} category.`;
}
