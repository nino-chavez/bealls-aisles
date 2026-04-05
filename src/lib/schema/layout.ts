import { z } from 'zod';

/**
 * Layout Schema — the contract between the AI and the renderer.
 *
 * The AI generates a Layout object. The renderer maps sections to Svelte components.
 * The AI selects and arranges from this fixed vocabulary — it cannot invent new components.
 */

const ProductRef = z.object({
	productId: z.string().describe('Product ID from the catalog'),
	role: z.enum(['hero', 'featured', 'standard', 'compact']).describe('Display treatment for this product'),
});

const EditorialHeaderSection = z.object({
	component: z.literal('editorial-header'),
	props: z.object({
		eyebrow: z.string().describe('Small uppercase label above the headline (e.g., "The Living Room Edit")'),
		headline: z.string().describe('Main heading — editorial, not generic (e.g., "Pieces that earn their place")'),
		body: z.string().describe('1-2 sentences of editorial copy — warm, specific, not marketing fluff'),
	}),
});

const HeroProductSection = z.object({
	component: z.literal('hero-product'),
	props: z.object({
		product: ProductRef,
		showSpecs: z.boolean().describe('Whether to show the specs grid below the description'),
	}),
});

const ProductGridSection = z.object({
	component: z.literal('product-grid'),
	props: z.object({
		columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).describe('Grid column count — 2 for editorial, 3-4 for dense/functional'),
		products: z.array(ProductRef).describe('Products to display in order'),
		imageRatio: z.enum(['landscape', 'square']).describe('Image aspect ratio — landscape (4:3) for editorial, square for dense'),
		showDescription: z.boolean().describe('Show product description text below name'),
		showSpecs: z.boolean().describe('Show specs line (material, dimensions)'),
		showQuickAdd: z.boolean().describe('Show inline Add to Cart button'),
	}),
});

const CategoryHeaderSection = z.object({
	component: z.literal('category-header'),
	props: z.object({
		title: z.string().describe('Category title'),
		subtitle: z.string().optional().describe('Optional subtitle or product count'),
		showSort: z.boolean().describe('Whether to show sort dropdown'),
		showFilter: z.boolean().describe('Whether to show filter button'),
	}),
});

export const SectionSchema = z.discriminatedUnion('component', [
	EditorialHeaderSection,
	HeroProductSection,
	ProductGridSection,
	CategoryHeaderSection,
]);

export type Section = z.infer<typeof SectionSchema>;

export const LayoutSchema = z.object({
	persona: z.enum(['gatherer', 'hunter']).describe('The detected shopper persona driving this layout'),
	reasoning: z.string().describe('Brief explanation of why this layout was chosen — shown in dev mode'),
	sections: z.array(SectionSchema).min(1).max(8).describe('Ordered list of UI sections to render'),
	productOrder: z.array(z.string()).describe('Product IDs in recommended display order'),
});

export type Layout = z.infer<typeof LayoutSchema>;
