/**
 * Cart surface — static fallbacks per section-authoring.md §3.4.
 *
 * The mandatory cart scaffold (line items, summary, free-shipping meter,
 * promo entry, checkout CTA) is foundation-rendered from cart state and
 * is NOT zone-targeted — only the upsell + below-fold + empty-state
 * zones live here.
 *
 * - cart.above-checkout-cta: Hidden by default. Engine emits the
 *   last-chance upsell row when the AI composer finds qualifying
 *   neighborhood products. Candidate pool is the tag-overlap aggregate
 *   of the cart's line items (ADR-008 Phase B / PRD-ENG-019); empty
 *   cart falls back to popular products for resilience.
 * - cart.below-fold: Hidden by default. Behavioral surface; pulls
 *   forward when viewed-products session state lands.
 * - cart.empty-state: Hidden — the existing CartDrawer EmptyRescue
 *   path (FND-012) handles this independently; not zone-resolved.
 *
 * All cart zones currently fall through to Hidden. Engine wiring is
 * the primary populator; admin authoring lands in Phase 5.
 */

import type { ZoneFallback } from './index';

export const cartFallbacks: Partial<Record<string, ZoneFallback>> = {
	// All cart zones intentionally Hidden — see header note.
};
