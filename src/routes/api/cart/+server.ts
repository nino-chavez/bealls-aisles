import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createCart,
	addToCart,
	getCart,
	updateCartLineItem,
	deleteCartLineItem,
} from '$lib/server/bigcommerce';
import { cacheCart, getCachedCart, getSessionCookie, evictCart } from '$lib/server/cart-store';
import { requireBrandSurface } from '$lib/server/brand-surface-guard';

/** POST /api/cart — Add item to cart (foundation primitive). */
export const POST: RequestHandler = async ({ request, cookies }) => {
	requireBrandSurface('cart');
	try {
		const { productEntityId, quantity = 1 } = await request.json();

		if (!productEntityId) {
			return json({ error: 'Missing productEntityId' }, { status: 400 });
		}

		const cartId = cookies.get('bc_cart_id');
		let result;

		if (cartId) {
			const sessionCookie = (await getSessionCookie(cartId)) ?? undefined;
			try {
				result = await addToCart(cartId, productEntityId, quantity, sessionCookie);
			} catch (err) {
				console.warn('[cart] addToCart failed, creating new:', err instanceof Error ? err.message : err);
				await evictCart(cartId);
				result = await createCart(productEntityId, quantity);
			}
		} else {
			result = await createCart(productEntityId, quantity);
		}

		// Cache the payload AND the BC visitor session cookie. Subsequent
		// addCartLineItems calls must replay the cookie or BC won't find
		// the cart. site.cart(entityId) likewise returns null without it.
		await cacheCart(result.cart, result.sessionCookie);

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

/** PATCH /api/cart — Update line item quantity (qty = 0 → remove). */
export const PATCH: RequestHandler = async ({ request, cookies }) => {
	requireBrandSurface('cart');
	try {
		const { lineItemEntityId, productEntityId, quantity } = await request.json();

		if (!lineItemEntityId || typeof quantity !== 'number') {
			return json({ error: 'Missing lineItemEntityId or quantity' }, { status: 400 });
		}

		const cartId = cookies.get('bc_cart_id');
		if (!cartId) {
			return json({ error: 'No cart' }, { status: 404 });
		}

		const sessionCookie = (await getSessionCookie(cartId)) ?? undefined;

		// qty=0 removes the line; otherwise update. We need productEntityId for
		// updates — read from the cached cart if the client didn't supply it.
		let productId = productEntityId as number | undefined;
		if (quantity > 0 && !productId) {
			const cached = await getCachedCart(cartId);
			productId = cached?.cart.lineItems.physicalItems.find((i) => i.entityId === lineItemEntityId)?.productEntityId;
			if (!productId) {
				return json({ error: 'Line item not found in cached cart' }, { status: 404 });
			}
		}

		try {
			const result = quantity === 0
				? await deleteCartLineItem(cartId, lineItemEntityId, sessionCookie)
				: await updateCartLineItem(cartId, lineItemEntityId, productId!, quantity, sessionCookie);

			if (result.cart) {
				await cacheCart(result.cart, result.sessionCookie ?? sessionCookie ?? null);
				const itemCount = result.cart.lineItems.physicalItems.reduce((sum, i) => sum + i.quantity, 0);
				return json({ cart: result.cart, itemCount });
			}
			// BC returns null cart when last line removed.
			await evictCart(cartId);
			cookies.delete('bc_cart_id', { path: '/' });
			return json({ cart: null, itemCount: 0 });
		} catch (err) {
			console.warn('[cart] line-item mutation failed:', err instanceof Error ? err.message : err);
			return json({ error: 'Cart update failed' }, { status: 500 });
		}
	} catch (err) {
		console.error('Cart PATCH failed:', err);
		return json({ error: 'Cart operation failed' }, { status: 500 });
	}
};

/** GET /api/cart — Get current cart (foundation primitive). */
export const GET: RequestHandler = async ({ cookies }) => {
	requireBrandSurface('cart');
	const cartId = cookies.get('bc_cart_id');

	if (!cartId) {
		return json({ cart: null, itemCount: 0 });
	}

	// Cache-first: BC site.cart returns null for headless-bearer carts, so
	// we serve from the mutation-response cache when available.
	const cached = await getCachedCart(cartId);
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

		await cacheCart(cart, null);
		const itemCount = cart.lineItems.physicalItems.reduce((sum, item) => sum + item.quantity, 0);
		return json({ cart, itemCount });
	} catch {
		return json({ cart: null, itemCount: 0 });
	}
};
