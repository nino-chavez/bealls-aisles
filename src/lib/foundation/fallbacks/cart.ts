/**
 * Cart surface — static fallbacks per section-authoring.md §3.4.
 *
 * The mandatory cart scaffold (line items, summary, free-shipping meter,
 * promo entry, checkout CTA) is foundation-rendered from cart state and
 * is NOT zone-targeted — only the upsell + below-fold + empty-state
 * zones live here.
 *
 * - cart.above-checkout-cta: Hidden by default. Shopper model execution
 *   is retired; a future merchant-authorized producer needs a new contract.
 * - cart.below-fold: Hidden by default. Behavioral surface; pulls
 *   forward when viewed-products session state lands.
 * - cart.empty-state: Hidden — the existing CartDrawer EmptyRescue
 *   path (FND-012) handles this independently; not zone-resolved.
 *
 * All cart zones currently fall through to Hidden unless an exactly bound,
 * publication-valid merchant record exists.
 */

import type { ZoneFallback } from './index';

export const cartFallbacks: Partial<Record<string, ZoneFallback>> = {
	// All cart zones intentionally Hidden — see header note.
};
