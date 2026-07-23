import { z } from 'zod';
import { StorefrontBlocks } from '../blocks';

/**
 * PDPLayoutSchema — narrow composition latitude.
 *
 * PDP has a fixed scaffold (gallery, title, variants, ATC,
 * description, reviews) and the AI's job is to insert blocks at
 * named zones, not compose freely.
 *
 * STATUS (Phase 3, planned):
 * The fully-typed PDP scaffold + named insertion zones (image-gallery,
 * variant-selector, stock-signal, bopis-picker, add-to-cart-bar,
 * description-tabs, reviews-summary, reviews-list, breadcrumb,
 * also-bought-carousel, complete-the-look, recently-viewed) is the
 * Later build phase. The new blocks need to be added to
 * `blocks.ts` and the scaffold needs a typed shape.
 *
 * Today this schema is structurally identical to a Storefront layout
 * (uses the same block union) — but the type is distinct, so call
 * sites can already route `surface: 'pdp'` requests through this
 * schema. When the Phase 3 blocks ship, this schema specializes
 * without touching call sites.
 *
 * Per ADR-006: defining PDPLayoutSchema as a stub today (instead of
 * waiting for Phase 3) lets API endpoints route by surface
 * immediately. The latitude divergence from home/PLP ships per-phase.
 */

const layoutBase = {
	persona: z.enum(['gatherer', 'hunter', 'researcher', 'gifter']).describe('Detected persona'),
	reasoning: z.string().describe('Why this layout was chosen (1-2 sentences)'),
	productOrder: z.array(z.string()).describe('Product IDs in display order'),
};

export const PDPLayoutSchema = z.object({
	...layoutBase,
	surface: z.literal('pdp').optional(),
	sections: z
		.array(z.discriminatedUnion('component', [...StorefrontBlocks]))
		.min(1)
		.describe('STUB: today identical to storefront layout. Phase 3 specializes to PDP scaffold.'),
});

export type PDPLayout = z.infer<typeof PDPLayoutSchema>;
