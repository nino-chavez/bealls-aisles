/**
 * Server-side cart state cache (foundation layer).
 *
 * Two purposes:
 *
 * 1. Cache the cart mutation payload by entityId so reads don't depend
 *    on BC's `site.cart(entityId)` query — that query returns null for
 *    carts created via Storefront Bearer auth without a visitor session.
 *
 * 2. Persist the BC visitor session cookie that scoped the cart so
 *    subsequent mutations against the same cartEntityId can replay it.
 *    Without the cookie, BC returns "Not Found: Cart does not exist"
 *    on the next addCartLineItems call — the cart is created in BC but
 *    is invisible to a fresh visitor session.
 *
 * Scope: in-memory Map; sufficient for the prototype. Production would
 * migrate to Redis (Upstash is already in the stack — see CLAUDE.md).
 *
 * Trace: PRD-FND-003 (cart state primitive).
 */

import type { CartResponse } from './bigcommerce';

const CART_TTL_MS = 1000 * 60 * 60 * 24; // 24h

interface CacheEntry {
	cart: CartResponse;
	sessionCookie: string | null;
	expiresAt: number;
}

const store = new Map<string, CacheEntry>();

export function cacheCart(cart: CartResponse, sessionCookie: string | null): void {
	store.set(cart.entityId, {
		cart,
		sessionCookie,
		expiresAt: Date.now() + CART_TTL_MS,
	});
}

export function getCachedCart(cartEntityId: string): { cart: CartResponse; sessionCookie: string | null } | null {
	const entry = store.get(cartEntityId);
	if (!entry) return null;
	if (entry.expiresAt < Date.now()) {
		store.delete(cartEntityId);
		return null;
	}
	return { cart: entry.cart, sessionCookie: entry.sessionCookie };
}

export function getSessionCookie(cartEntityId: string): string | null {
	return getCachedCart(cartEntityId)?.sessionCookie ?? null;
}

export function evictCart(cartEntityId: string): void {
	store.delete(cartEntityId);
}
