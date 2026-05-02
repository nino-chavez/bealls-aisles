/**
 * S-01 — BC product-image CDN warm pass.
 *
 * Hits each product's defaultImage URL across all active brand channels to
 * force-cache them on BigCommerce's CDN. ~80% of seeded product images
 * return placeholders on first request because BC's CDN fetches from origin
 * asynchronously; running this once per channel after seeding eliminates
 * the empty-card render.
 *
 * Run: `npx tsx scripts/cache/warm-bc-images.ts`
 *
 * Env: requires the same per-brand storefront token vars used by the app
 * (BEALLS_STOREFRONT_TOKEN, BEALLSFLORIDA_STOREFRONT_TOKEN, etc.).
 *
 * Idempotent — safe to run repeatedly. Failed images are logged but do not
 * abort the run.
 */

import { getProducts } from '../../src/lib/server/bigcommerce';

const BRANDS = ['bealls', 'beallsflorida', 'homecentric'] as const;

async function warmImage(url: string): Promise<{ ok: boolean; status: number; ms: number }> {
	const start = Date.now();
	try {
		const res = await fetch(url, { method: 'GET', redirect: 'follow' });
		await res.arrayBuffer();
		return { ok: res.ok, status: res.status, ms: Date.now() - start };
	} catch {
		return { ok: false, status: 0, ms: Date.now() - start };
	}
}

async function warmBatch(urls: string[], concurrency = 8): Promise<{ ok: number; fail: number }> {
	let ok = 0;
	let fail = 0;
	const queue = [...urls];
	const workers = Array.from({ length: concurrency }, async () => {
		while (queue.length > 0) {
			const next = queue.shift();
			if (!next) break;
			const result = await warmImage(next);
			if (result.ok) ok++;
			else {
				fail++;
				console.warn(`  [fail] ${next} (${result.status}, ${result.ms}ms)`);
			}
		}
	});
	await Promise.all(workers);
	return { ok, fail };
}

async function main() {
	for (const brand of BRANDS) {
		// The bigcommerce.ts query() helper resolves the brand-specific token
		// from BRAND_ID. Set BRAND_ID per-run to scope the warm to that brand.
		process.env.BRAND_ID = brand;
		console.log(`\n=== ${brand} ===`);
		try {
			const products = await getProducts(150);
			const urls = products
				.map((p) => p.defaultImage?.url)
				.filter((u): u is string => Boolean(u));
			const unique = Array.from(new Set(urls));
			console.log(`Found ${unique.length} unique image URLs across ${products.length} products`);
			const start = Date.now();
			const { ok, fail } = await warmBatch(unique);
			const elapsed = ((Date.now() - start) / 1000).toFixed(1);
			console.log(`  ${ok} warmed, ${fail} failed (${elapsed}s)`);
		} catch (err) {
			console.error(`  [error] ${brand}: ${(err as Error).message}`);
		}
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
