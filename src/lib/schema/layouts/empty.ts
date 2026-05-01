import { z } from 'zod';
import { StorefrontBlocks, ContentBlocks } from '../blocks';

/**
 * EmptyLayoutSchema — wide composition latitude for rescue surfaces.
 *
 * Used for: 404 pages, empty cart, empty search results, empty
 * wishlist. The AI composes a rescue surface that surfaces alternative
 * paths (popular products, category tiles, search redirects, brand
 * engagement).
 *
 * STATUS (Phase 1, planned):
 * Empty/rescue surfaces ship in Phase 1 alongside the section
 * authoring model. Today this schema is a stub typed to the
 * storefront block union; mode-aware variants are stubbed too.
 *
 * Per ADR-006: stub today so API endpoints can route `surface: 'empty'`
 * requests immediately. Specialization ships in Phase 1.
 */

const layoutBase = {
	persona: z.enum(['gatherer', 'hunter', 'researcher', 'gifter']).describe('Detected persona'),
	reasoning: z.string().describe('Why this rescue composition was chosen'),
	productOrder: z.array(z.string()).describe('Product IDs in display order (best-sellers / popular)'),
};

export const EmptyStorefrontLayoutSchema = z.object({
	...layoutBase,
	surface: z.literal('empty').optional(),
	sections: z
		.array(z.discriminatedUnion('component', [...StorefrontBlocks]))
		.min(1)
		.describe('STUB: rescue composition. Phase 1 specializes for 404 / empty cart / empty search.'),
});

export const EmptyContentLayoutSchema = z.object({
	...layoutBase,
	surface: z.literal('empty').optional(),
	sections: z
		.array(z.discriminatedUnion('component', [...ContentBlocks]))
		.min(1)
		.describe('STUB: rescue composition for content-mode brands.'),
});

export type EmptyStorefrontLayout = z.infer<typeof EmptyStorefrontLayoutSchema>;
export type EmptyContentLayout = z.infer<typeof EmptyContentLayoutSchema>;

export function getEmptyLayoutSchema(mode: 'storefront' | 'content') {
	return mode === 'content' ? EmptyContentLayoutSchema : EmptyStorefrontLayoutSchema;
}
