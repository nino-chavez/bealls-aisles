/**
 * Cache kill-switch — for demo cold-start latency moments.
 *
 * Only the server-owned `AISLES_NO_CACHE=1` environment setting can bypass
 * caches. Shopper URLs and cookies are never cache authority.
 *
 * The cart cache is NOT bypassable — it's the cart-state truth, not a
 * perf optimization. Bypassing it would corrupt the cart.
 */

import { env } from '$env/dynamic/private';

let warned = false;

/**
 * Returns true when global cache bypass is active.
 *
 * Reads `AISLES_NO_CACHE` env var lazily (Vercel injects env vars before
 * the request handler runs, so module-load time would be too early on
 * some deployment shapes).
 */
export function isCachingDisabledGlobally(): boolean {
	const flag = env.AISLES_NO_CACHE;
	const disabled = flag === '1' || flag === 'true';
	if (disabled && !warned) {
		console.warn('[cache] AISLES_NO_CACHE is set — all caches bypassed (demo cold-start mode).');
		warned = true;
	}
	return disabled;
}
