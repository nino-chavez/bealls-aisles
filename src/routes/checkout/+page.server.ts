import type { PageServerLoad } from './$types';
import { getCheckoutRedirectUrl } from '$lib/server/bigcommerce';
import { getCachedCart, getSessionCookie } from '$lib/server/cart-store';

/**
 * /checkout — handoff page between cart CTA and BC Optimized Checkout.
 *
 * Per ADR-006/-007 and FND-010: BC Optimized One-Page Checkout handles
 * the actual purchase flow. This page is the *handoff UX* — it renders
 * AI-composed assurance copy + last-chance upsell, then continues to
 * BC's hosted checkout via the minted redirect URL.
 *
 * Phase 3 change: previous behavior auto-redirected when a checkoutUrl
 * was available. We now render the handoff page first (sponsor demos
 * need to see the AI-composed content) and put the BC redirect behind
 * a "Proceed to checkout" CTA. Demo channels without Optimized Checkout
 * still fall back to the demo-splash CTA.
 */
export const load: PageServerLoad = async ({ cookies }) => {
	const cartId = cookies.get('bc_cart_id');

	if (!cartId) {
		return { reason: 'empty' as const };
	}

	// cart-store reads are async since the Redis migration (commit dcc70be).
	// Earlier this file called them synchronously and the resulting Promise
	// failed every truthy check that followed → `/checkout` ran getCheckoutRedirectUrl
	// with `undefined` cartId, BC threw, and SvelteKit served a 500. Per the
	// 2026-05-02 audit P0 §3.5, the fix is to await both calls and bail
	// gracefully to the empty path when no cached cart exists.
	const cached = await getCachedCart(cartId);
	if (!cached || cached.cart.lineItems.physicalItems.length === 0) {
		return { reason: 'empty' as const };
	}

	const sessionCookie = (await getSessionCookie(cartId)) ?? undefined;
	const checkoutUrl = await getCheckoutRedirectUrl(cartId, sessionCookie);

	const itemCount = cached.cart.lineItems.physicalItems.reduce((sum, i) => sum + i.quantity, 0);
	const subtotal = cached.cart.lineItems.physicalItems.reduce(
		(sum, i) => sum + i.salePrice.value * i.quantity,
		0,
	);

	return {
		reason: (checkoutUrl ? 'handoff' : 'demo-fallback') as 'handoff' | 'demo-fallback',
		itemCount,
		subtotal,
		checkoutUrl,
	};
};
