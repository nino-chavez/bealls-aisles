import { z } from 'zod';
import { LastChanceUpsellRowSection } from '../blocks';

/**
 * CartLayoutSchema — legacy fixture schema, not a shopper publication path.
 *
 * The cart's mandatory blocks (cart-line-items, cart-summary,
 * free-shipping-meter, promo-code-entry, checkout CTA) are foundation-
 * rendered from cart state. The current route resolves every named cart
 * zone as fixed fallback or Hidden and never invokes a shopper model API.
 *
 * Schema accepts a single section (the upsell row) plus the standard
 * persona/reasoning metadata. If the AI emits no upsell row (e.g.
 * empty cart, no fit found), `sections` is an empty array and the
 * cascade falls through to the cart.above-checkout-cta fallback
 * (Hidden) per ADR-007.
 */

const layoutBase = {
	persona: z.enum(['gatherer', 'hunter', 'researcher', 'gifter']).describe('Detected persona'),
	reasoning: z.string().describe('Why this upsell selection was chosen'),
	productOrder: z.array(z.string()).describe('Upsell product IDs in display order'),
};

/** Historical schema retained for development fixtures only. */
export const CartLayoutSchema = z.object({
	...layoutBase,
	surface: z.literal('cart').optional(),
	sections: z
		.array(z.discriminatedUnion('component', [LastChanceUpsellRowSection]))
		.max(1)
		.describe('Legacy fixture cart blocks. Shopper runtime publication is retired.'),
});

export type CartLayout = z.infer<typeof CartLayoutSchema>;
