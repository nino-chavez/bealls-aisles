import { z } from 'zod';
import { StorefrontBlocks } from '../blocks';

/**
 * CartLayoutSchema — fixed scaffold + AI-composed upsell row.
 *
 * Cart's scaffold is fixed (line items, summary with free-shipping
 * meter, promo code entry, CTA, trust strip). The AI's job is to
 * choose `last-chance-upsell-row` contents and personalize copy
 * variants — not reorder steps or modify required fields.
 *
 * STATUS (Phase 3, planned):
 * The cart scaffold blocks (cart-line-items, cart-summary,
 * free-shipping-meter, promo-code-entry, last-chance-upsell-row)
 * ship in Phase 3. Today this schema is a stub typed to the storefront
 * block union; specialization happens when the new blocks land.
 *
 * Per ADR-006: stub today so API endpoints can route by surface
 * immediately. Latitude divergence ships per-phase.
 */

const layoutBase = {
	persona: z.enum(['gatherer', 'hunter', 'researcher', 'gifter']).describe('Detected persona'),
	reasoning: z.string().describe('Why this composition was chosen'),
	productOrder: z.array(z.string()).describe('Upsell product IDs in display order'),
};

export const CartLayoutSchema = z.object({
	...layoutBase,
	surface: z.literal('cart').optional(),
	sections: z
		.array(z.discriminatedUnion('component', [...StorefrontBlocks]))
		.min(1)
		.describe('STUB: today identical to storefront layout. Phase 3 specializes to cart scaffold.'),
});

export type CartLayout = z.infer<typeof CartLayoutSchema>;
