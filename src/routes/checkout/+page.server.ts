import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getCheckoutRedirectUrl } from '$lib/server/bigcommerce';
import { getCachedCart, getSessionCookie } from '$lib/server/cart-store';

/**
 * PRD-FND-010 — real checkout via BC Optimized One-Page handoff.
 *
 * We mint a short-lived BC redirect URL via `cart.createCartRedirectUrls`,
 * then 302 the shopper into BC's hosted checkout with the cart contents
 * + auth context attached. If the mutation returns no URL (sandbox channel
 * without Optimized Checkout configured, expired cart, etc.), the page
 * renders a demo splash so the flow doesn't dead-end on a stack trace.
 */
export const load: PageServerLoad = async ({ cookies }) => {
	const cartId = cookies.get('bc_cart_id');

	if (!cartId) {
		return { reason: 'empty' as const };
	}

	const cached = getCachedCart(cartId);
	if (!cached || cached.cart.lineItems.physicalItems.length === 0) {
		return { reason: 'empty' as const };
	}

	const sessionCookie = getSessionCookie(cartId) ?? undefined;
	const checkoutUrl = await getCheckoutRedirectUrl(cartId, sessionCookie);

	if (checkoutUrl) {
		throw redirect(302, checkoutUrl);
	}

	const itemCount = cached.cart.lineItems.physicalItems.reduce((sum, i) => sum + i.quantity, 0);
	const subtotal = cached.cart.lineItems.physicalItems.reduce(
		(sum, i) => sum + i.salePrice.value * i.quantity,
		0,
	);
	return {
		reason: 'demo-fallback' as const,
		itemCount,
		subtotal,
	};
};
