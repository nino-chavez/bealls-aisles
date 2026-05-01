import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createCart, addToCart, getCart } from '$lib/server/bigcommerce';
import { cacheCart, getCachedCart, getSessionCookie, evictCart } from '$lib/server/cart-store';

/** POST /api/cart — Add item to cart (foundation primitive). */
export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { productEntityId, quantity = 1 } = await request.json();

		if (!productEntityId) {
			return json({ error: 'Missing productEntityId' }, { status: 400 });
		}

		const cartId = cookies.get('bc_cart_id');
		let result;

		if (cartId) {
			const sessionCookie = getSessionCookie(cartId) ?? undefined;
			try {
				result = await addToCart(cartId, productEntityId, quantity, sessionCookie);
			} catch (err) {
				console.warn('[cart] addToCart failed, creating new:', err instanceof Error ? err.message : err);
				evictCart(cartId);
				result = await createCart(productEntityId, quantity);
			}
		} else {
			result = await createCart(productEntityId, quantity);
		}

		// Cache the payload AND the BC visitor session cookie. Subsequent
		// addCartLineItems calls must replay the cookie or BC won't find
		// the cart. site.cart(entityId) likewise returns null without it.
		cacheCart(result.cart, result.sessionCookie);

		cookies.set('bc_cart_id', result.cart.entityId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30, // 30 days
		});

		const itemCount = result.cart.lineItems.physicalItems.reduce((sum, item) => sum + item.quantity, 0);

		return json({ cart: result.cart, itemCount });
	} catch (err) {
		console.error('Cart operation failed:', err);
		return json(
			{ error: 'Cart operation failed', message: err instanceof Error ? err.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};

/** GET /api/cart — Get current cart (foundation primitive). */
export const GET: RequestHandler = async ({ cookies }) => {
	const cartId = cookies.get('bc_cart_id');

	if (!cartId) {
		return json({ cart: null, itemCount: 0 });
	}

	// Cache-first: BC site.cart returns null for headless-bearer carts, so
	// we serve from the mutation-response cache when available.
	const cached = getCachedCart(cartId);
	if (cached) {
		const itemCount = cached.cart.lineItems.physicalItems.reduce((sum, item) => sum + item.quantity, 0);
		return json({ cart: cached.cart, itemCount });
	}

	try {
		const cart = await getCart(cartId);
		if (!cart) {
			cookies.delete('bc_cart_id', { path: '/' });
			return json({ cart: null, itemCount: 0 });
		}

		cacheCart(cart, null);
		const itemCount = cart.lineItems.physicalItems.reduce((sum, item) => sum + item.quantity, 0);
		return json({ cart, itemCount });
	} catch {
		return json({ cart: null, itemCount: 0 });
	}
};
