/**
 * Cache kill-switch — for demo cold-start latency moments.
 *
 * Only the server-owned `AISLES_NO_CACHE=1` environment setting can bypass
 * caches. Shopper URLs and cookies are never cache authority.
 *
 * Commerce state is not handled here. BigCommerce remains cart truth and
 * Aisles stores only the opaque server-owned session reference.
 */

let warned = false;

/**
 * Returns true when global cache bypass is active.
 *
 * Reads `AISLES_NO_CACHE` env var lazily (Vercel injects env vars before
 * the request handler runs, so module-load time would be too early on
 * some deployment shapes).
 */
export function isCachingDisabledGlobally(): boolean {
	const flag = process.env.AISLES_NO_CACHE;
	const disabled = flag === '1' || flag === 'true';
	if (disabled && !warned) {
		console.warn('[cache] AISLES_NO_CACHE is set — all caches bypassed (demo cold-start mode).');
		warned = true;
	}
	return disabled;
}
