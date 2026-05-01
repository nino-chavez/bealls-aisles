import { z } from 'zod';
import { StorefrontBlocks } from '../blocks';

/**
 * CheckoutLayoutSchema — very narrow composition latitude.
 *
 * Checkout is the most fixed surface. The scaffold (steps, payment
 * options, shipping options, order summary sidebar) is mandatory and
 * cannot be reordered. The AI's job is to choose the assurance copy
 * variant and the last-chance upsell row above the place-order CTA.
 *
 * STATUS (Phase 3, planned):
 * Per the Stage 1 foundation research, the consensus pattern is to
 * hand off to BC Optimized One-Page Checkout rather than build a
 * custom checkout. So CheckoutLayoutSchema covers only the *handoff
 * UX* — the page that appears between cart and BC Optimized Checkout
 * — with last-chance upsell + assurance copy.
 *
 * Today this schema is a stub typed to the storefront block union.
 *
 * Per ADR-006: stub today so API endpoints can route by surface
 * immediately. Latitude divergence ships per-phase.
 */

const layoutBase = {
	persona: z.enum(['gatherer', 'hunter', 'researcher', 'gifter']).describe('Detected persona'),
	reasoning: z.string().describe('Why this composition was chosen'),
	productOrder: z.array(z.string()).describe('Upsell product IDs in display order'),
};

export const CheckoutLayoutSchema = z.object({
	...layoutBase,
	surface: z.literal('checkout').optional(),
	sections: z
		.array(z.discriminatedUnion('component', [...StorefrontBlocks]))
		.min(1)
		.describe('STUB: today identical to storefront layout. Phase 3 specializes to checkout handoff scaffold.'),
});

export type CheckoutLayout = z.infer<typeof CheckoutLayoutSchema>;
