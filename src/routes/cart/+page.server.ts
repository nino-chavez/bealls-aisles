import type { PageServerLoad } from './$types';
import { getCachedCart, getSessionCookie } from '$lib/server/cart-store';
import { getCart } from '$lib/server/bigcommerce';
import { getBrand } from '$lib/brand/config';

/**
 * /cart — full cart page (companion to the cart drawer).
 *
 * The drawer is the primary cart UX; the page is the surface BC's
 * "review cart" link can route to if a merchant wants pre-checkout
 * customization. Both render the same blocks; the page is just sized
 * for a full-width review rather than a 384px drawer.
 *
 * Cart state is read from the cart-store cache (BC headless carts
 * aren't visible to `site.cart()` without the visitor session cookie
 * replay; the cache is the source of truth — see cart-store.ts).
 */
export const load: PageServerLoad = async ({ cookies }) => {
	const cartId = cookies.get('bc_cart_id');
	const brand = getBrand();
	const freeShippingThresholdMinor = brand.incentives?.freeShippingThresholdMinor ?? null;

	if (!cartId) {
		return {
			cart: null,
			itemCount: 0,
			subtotal: 0,
			freeShippingThreshold: freeShippingThresholdMinor != null ? freeShippingThresholdMinor / 100 : null,
		};
	}

	let cart = (await getCachedCart(cartId))?.cart ?? null;
	if (!cart) {
		const sessionCookie = (await getSessionCookie(cartId)) ?? undefined;
		try {
			cart = await getCart(cartId, sessionCookie);
		} catch {
			cart = null;
		}
	}

	const items = cart?.lineItems.physicalItems ?? [];
	const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
	const subtotal = items.reduce((sum, i) => sum + i.salePrice.value * i.quantity, 0);

	return {
		cart,
		itemCount,
		subtotal,
		freeShippingThreshold: freeShippingThresholdMinor != null ? freeShippingThresholdMinor / 100 : null,
	};
};
