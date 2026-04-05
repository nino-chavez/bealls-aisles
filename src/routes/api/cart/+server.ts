import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createCart, addToCart, getCart } from '$lib/server/bigcommerce';

/** POST /api/cart — Add item to cart */
export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { productEntityId, quantity = 1 } = await request.json();

		if (!productEntityId) {
			return json({ error: 'Missing productEntityId' }, { status: 400 });
		}

		const cartId = cookies.get('bc_cart_id');
		let cart;

		if (cartId) {
			try {
				cart = await addToCart(cartId, productEntityId, quantity);
			} catch {
				// Cart might have expired — create a new one
				cart = await createCart(productEntityId, quantity);
			}
		} else {
			cart = await createCart(productEntityId, quantity);
		}

		// Store cart ID in cookie
		cookies.set('bc_cart_id', cart.entityId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30, // 30 days
		});

		const itemCount = cart.lineItems.physicalItems.reduce((sum, item) => sum + item.quantity, 0);

		return json({ cart, itemCount });
	} catch (err) {
		console.error('Cart operation failed:', err);
		return json(
			{ error: 'Cart operation failed', message: err instanceof Error ? err.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};

/** GET /api/cart — Get current cart */
export const GET: RequestHandler = async ({ cookies }) => {
	const cartId = cookies.get('bc_cart_id');

	if (!cartId) {
		return json({ cart: null, itemCount: 0 });
	}

	try {
		const cart = await getCart(cartId);
		if (!cart) {
			cookies.delete('bc_cart_id', { path: '/' });
			return json({ cart: null, itemCount: 0 });
		}

		const itemCount = cart.lineItems.physicalItems.reduce((sum, item) => sum + item.quantity, 0);
		return json({ cart, itemCount });
	} catch {
		return json({ cart: null, itemCount: 0 });
	}
};
