import { z } from 'zod';
import { LastChanceUpsellRowSection } from '../blocks';

/**
 * CartLayoutSchema — fixed scaffold + AI-composed upsell row.
 *
 * The cart's mandatory blocks (cart-line-items, cart-summary,
 * free-shipping-meter, promo-code-entry, checkout CTA) are foundation-
 * rendered from cart state — NOT AI-composed. The engine only emits
 * the last-chance upsell row. This separation is the architectural
 * lesson from CartDrawer: foundation primitives read state, the AI
 * personalizes only what is genuinely a personalization decision.
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

/** Cart latitude is narrow: AI may emit zero or one last-chance-upsell-row block. */
export const CartLayoutSchema = z.object({
	...layoutBase,
	surface: z.literal('cart').optional(),
	sections: z
		.array(z.discriminatedUnion('component', [LastChanceUpsellRowSection]))
		.max(1)
		.describe('AI-composed cart blocks (0 or 1 upsell row). Foundation renders line items, summary, meter, promo entry, CTA from cart state.'),
});

export type CartLayout = z.infer<typeof CartLayoutSchema>;
