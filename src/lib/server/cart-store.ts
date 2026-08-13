/**
 * Cart-state cache backed by Upstash Redis.
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
 * Originally an in-memory Map ("sufficient for the prototype"). On Vercel,
 * different lambda instances don't share memory: POST creates the cart on
 * lambda A, GET hits lambda B with an empty Map, falls through to the
 * `getCart` path that BC returns null on, and the cookie gets deleted.
 * This module migrated to Upstash Redis on 2026-05-01 to fix that.
 *
 * Trace: PRD-FND-003 (cart state primitive).
 */

import type { CartResponse } from './bigcommerce';
import { isParityFixtureEnabled } from './parity-fixture';

const CART_TTL_S = 60 * 60 * 24; // 24h

interface CacheEntry {
	cart: CartResponse;
	sessionCookie: string | null;
}

let redis: import('@upstash/redis').Redis | null = null;
let initialized = false;
let redisAccessObserverForTest: (() => void) | null = null;

async function getRedis(): Promise<import('@upstash/redis').Redis | null> {
	if (isParityFixtureEnabled()) return null;
	if (initialized) return redis;
	initialized = true;
	redisAccessObserverForTest?.();

	const url = process.env.KV_REST_API_URL;
	const token = process.env.KV_REST_API_TOKEN;
	if (!url || !token) return null;

	try {
		const { Redis } = await import('@upstash/redis');
		redis = new Redis({ url, token });
		return redis;
	} catch {
		return null;
	}
}

function cartKey(cartEntityId: string): string {
	return `aisles:cart:${cartEntityId}`;
}

// In-memory fallback for environments without Redis (local dev without
// KV_REST_API_*). Behaves like the old Map. Production should always
// have Redis configured.
const memoryFallback = new Map<string, CacheEntry>();

/** Test-only observer for proving fixture paths return before Redis acquisition. */
export function _setCartRedisAccessObserverForTest(observer: (() => void) | null): void {
	redisAccessObserverForTest = observer;
}

/** Test-only cleanup for the process-local fixture cart store. */
export function _resetCartStoreForTest(): void {
	memoryFallback.clear();
	redis = null;
	initialized = false;
	redisAccessObserverForTest = null;
}

export async function cacheCart(cart: CartResponse, sessionCookie: string | null): Promise<void> {
	const entry: CacheEntry = { cart, sessionCookie };
	const r = await getRedis();
	if (r) {
		try {
			await r.set(cartKey(cart.entityId), JSON.stringify(entry), { ex: CART_TTL_S });
			return;
		} catch (err) {
			console.warn('[cart-store] redis set failed, using memory fallback:', err instanceof Error ? err.message : err);
		}
	}
	memoryFallback.set(cart.entityId, entry);
}

export async function getCachedCart(
	cartEntityId: string,
): Promise<{ cart: CartResponse; sessionCookie: string | null } | null> {
	const r = await getRedis();
	if (r) {
		try {
			const raw = await r.get<string | CacheEntry>(cartKey(cartEntityId));
			if (raw) {
				// Upstash auto-parses JSON; tolerate both shapes.
				const entry = typeof raw === 'string' ? (JSON.parse(raw) as CacheEntry) : raw;
				return { cart: entry.cart, sessionCookie: entry.sessionCookie };
			}
			return null;
		} catch (err) {
			console.warn('[cart-store] redis get failed, using memory fallback:', err instanceof Error ? err.message : err);
		}
	}
	const entry = memoryFallback.get(cartEntityId);
	return entry ? { cart: entry.cart, sessionCookie: entry.sessionCookie } : null;
}

export async function getSessionCookie(cartEntityId: string): Promise<string | null> {
	const cached = await getCachedCart(cartEntityId);
	return cached?.sessionCookie ?? null;
}

export async function evictCart(cartEntityId: string): Promise<void> {
	const r = await getRedis();
	if (r) {
		try {
			await r.del(cartKey(cartEntityId));
		} catch (err) {
			console.warn('[cart-store] redis del failed:', err instanceof Error ? err.message : err);
		}
	}
	memoryFallback.delete(cartEntityId);
}
