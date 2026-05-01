import { z } from 'zod';
import { AssuranceStripCheckoutSection, LastChanceUpsellRowSection } from '../blocks';

/**
 * CheckoutLayoutSchema — narrowest composition latitude.
 *
 * Per the foundation research consensus + FND-010, real checkout hands
 * off to BC Optimized One-Page Checkout. CheckoutLayoutSchema covers
 * the *handoff page* between cart CTA and the BC redirect: the AI's
 * job is to choose an assurance-strip variant + an optional last-chance
 * upsell row before handoff.
 *
 * The BC redirect itself is foundation-rendered (in +page.server.ts);
 * everything below the place-order CTA on the BC side is BC's. This
 * schema constrains only what we render on the way out.
 */

const layoutBase = {
	persona: z.enum(['gatherer', 'hunter', 'researcher', 'gifter']).describe('Detected persona'),
	reasoning: z.string().describe('Why this assurance variant + upsell was chosen'),
	productOrder: z.array(z.string()).describe('Last-chance upsell product IDs in display order'),
};

export const CheckoutLayoutSchema = z.object({
	...layoutBase,
	surface: z.literal('checkout').optional(),
	sections: z
		.array(z.discriminatedUnion('component', [AssuranceStripCheckoutSection, LastChanceUpsellRowSection]))
		.max(2)
		.describe('AI-composed checkout-handoff blocks (0–2: assurance strip + optional last-chance upsell). BC redirect is foundation-rendered.'),
});

export type CheckoutLayout = z.infer<typeof CheckoutLayoutSchema>;
