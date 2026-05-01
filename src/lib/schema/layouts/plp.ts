import { z } from 'zod';
import { StorefrontBlocks, ContentBlocks } from '../blocks';

/**
 * PLPLayoutSchema — medium composition latitude.
 *
 * PLP composes within a known scaffold:
 * - Header zone (category-header is mandatory in storefront mode;
 *   editorial-header in content mode)
 * - Body zones (product-grid is mandatory in storefront mode)
 * - Insertion zones (editorial-hero, promo/coupon-strip,
 *   category-tile-grid for sub-pillars on empty)
 *
 * Per ADR-006: PLP currently uses the same block vocabulary as home
 * (the schema-level scaffold enforcement is added in a subsequent
 * phase). Today the PLP latitude rules live in the prompt; the schema
 * change will move them into the type system once foundation Phase 2
 * (named insertion zones) lands.
 */

const layoutBase = {
	persona: z.enum(['gatherer', 'hunter', 'researcher', 'gifter']).describe('Detected persona'),
	reasoning: z.string().describe('Why this layout was chosen (1-2 sentences)'),
	productOrder: z.array(z.string()).describe('Product IDs in display order'),
};

export const PLPStorefrontLayoutSchema = z.object({
	...layoutBase,
	surface: z.literal('plp').optional(),
	sections: z
		.array(z.discriminatedUnion('component', [...StorefrontBlocks]))
		.min(1)
		.describe('Ordered UI sections — must include category-header + product-grid'),
});

export const PLPContentLayoutSchema = z.object({
	...layoutBase,
	surface: z.literal('plp').optional(),
	sections: z
		.array(z.discriminatedUnion('component', [...ContentBlocks]))
		.min(1)
		.describe('Ordered content sections (content-mode brands have non-transactional PLPs)'),
});

export type PLPStorefrontLayout = z.infer<typeof PLPStorefrontLayoutSchema>;
export type PLPContentLayout = z.infer<typeof PLPContentLayoutSchema>;

export function getPLPLayoutSchema(mode: 'storefront' | 'content') {
	return mode === 'content' ? PLPContentLayoutSchema : PLPStorefrontLayoutSchema;
}
