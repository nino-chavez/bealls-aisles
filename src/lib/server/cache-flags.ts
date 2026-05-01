/**
 * Cache kill-switch — for demo cold-start latency moments.
 *
 * Two ways to bypass caches:
 *
 *   1. Env var `AISLES_NO_CACHE=1` — global, applies to every request.
 *      Set it on Vercel → redeploy → all caches become no-ops. Useful
 *      for demoing the cold-start narrative (10s home generation,
 *      streaming slot-fill, AI loaders rotating).
 *
 *   2. URL param `?fresh=1` on `/api/layout` and `/api/suggest` — per-
 *      request override. Useful when you want to demo a single fresh
 *      generation without affecting other browsers, or to flush a stale
 *      cell on the fly without nuking the whole namespace.
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

/**
 * Per-request bypass check — call from API handlers that read URL
 * params. Combines the global env flag with the optional URL param.
 */
export function shouldBypassCache(url: URL | { searchParams: URLSearchParams }): boolean {
	if (isCachingDisabledGlobally()) return true;
	const param = url.searchParams.get('fresh');
	return param === '1' || param === 'true';
}
