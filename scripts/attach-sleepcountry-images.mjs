/**
 * Sleep Country — Image Attach (one-off)
 *
 * The SC seeder (`seed-brand-catalog.mjs`) doesn't attach product images. This
 * script lists every SC product on the SC BC store, derives an Unsplash query
 * from its name/category/brand, and POSTs an `image_url` to BC's product-images
 * endpoint so BC fetches and hosts the image.
 *
 * Usage:
 *   node scripts/attach-sleepcountry-images.mjs [--dry-run] [--only=SC-MAT-001,SC-PIL-002]
 *
 * Env (from .env.local):
 *   SLEEPCOUNTRY_BIGCOMMERCE_STORE_HASH
 *   SLEEPCOUNTRY_BIGCOMMERCE_ACCESS_TOKEN
 *   SLEEPCOUNTRY_BIGCOMMERCE_CLIENT_ID (optional)
 */

import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: true });

const STORE = process.env.SLEEPCOUNTRY_BIGCOMMERCE_STORE_HASH;
const TOKEN = process.env.SLEEPCOUNTRY_BIGCOMMERCE_ACCESS_TOKEN;
const CLIENT_ID = process.env.SLEEPCOUNTRY_BIGCOMMERCE_CLIENT_ID;

if (!STORE || !TOKEN) {
	console.error('Missing SLEEPCOUNTRY_BIGCOMMERCE_STORE_HASH or _ACCESS_TOKEN in env');
	process.exit(2);
}

const BC_BASE = `https://api.bigcommerce.com/stores/${STORE}/v3`;
const bcHeaders = {
	'X-Auth-Token': TOKEN,
	'Content-Type': 'application/json',
	Accept: 'application/json',
};
if (CLIENT_ID) bcHeaders['X-Auth-Client'] = CLIENT_ID;

// ─── Args ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlyArg = args.find((a) => a.startsWith('--only='));
const onlySkus = onlyArg ? onlyArg.slice(7).split(',') : null;
const force = args.includes('--force'); // overwrite even if image exists

// ─── SKU → Image URL ──────────────────────────────────────────────────
// Direct Unsplash CDN URLs (no search — Unsplash search is now bot-walled).
// Photo IDs hand-picked from the public Unsplash catalog for bedroom /
// sleep-product imagery. Rotation across products is intentional — this is
// a demo catalog, not a real merchandised store.

const u = (id) => `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;

// Curated photo IDs (verified to exist on images.unsplash.com)
const IMG = {
	mattressBedroomLight: '1505693416388-ac5ce068fe85', // bright bedroom + bed
	mattressBedroomDark: '1540518614846-7eded433c457',  // moody bedroom
	mattressMinimal: '1540518614846-7eded433c457',       // moody bedroom (rotate)
	mattressLuxury: '1616594039964-ae9021a400a0',        // luxury hotel bed
	mattressSimple: '1631049552240-59c37f38802b',        // simple bed/pillows
	pillowsWhite: '1631049552240-59c37f38802b',          // white pillows on bed
	pillowsCloseup: '1631049035182-249067d7618e',        // pillow detail (substitute)
	pillowsLuxury: '1616594039964-ae9021a400a0',
	beddingSheets: '1522771739844-6a9f6d5f14af',         // crisp white sheets
	beddingDuvet: '1631049035182-249067d7618e',          // linen duvet
	beddingComforter: '1505691723518-36a5ac3be353',      // bed with comforter
	beddingThrow: '1542728928-1413d1894ed1',             // sage throw on chair
	bedFrameUpholstered: '1505691938895-1758d7feb511',   // upholstered headboard
	bedFrameWalnut: '1595526114035-0d45ed16cfbf',        // wood bed frame
	bedFrameMetal: '1505691938895-1758d7feb511',         // metal frame (substitute → upholstered)
	bedFrameAdjustable: '1631679706909-1844bbd07221',    // bed angled view
	accessoryProtector: '1631049035182-249067d7618e',
	accessoryTopper: '1631049035182-249067d7618e',       // bedding/topper (rotate)
	accessoryWeightedBlanket: '1542728928-1413d1894ed1',
	accessorySleepMask: '1556228720-195a672e8a03',       // sleep mask (substitute → accessory tile)
	accessorySoundMachine: '1574629810360-7efbbe195018', // bedside lamp/device
};

const SKU_IMAGES = {
	'SC-MAT-001': u(IMG.mattressBedroomLight),
	'SC-MAT-002': u(IMG.mattressMinimal),
	'SC-MAT-003': u(IMG.mattressLuxury),
	'SC-MAT-004': u(IMG.mattressBedroomDark),
	'SC-MAT-005': u(IMG.mattressSimple),
	'SC-MAT-006': u(IMG.mattressMinimal),
	'SC-MAT-007': u(IMG.mattressSimple),
	'SC-MAT-008': u(IMG.mattressBedroomLight),

	'SC-PIL-001': u(IMG.pillowsCloseup),
	'SC-PIL-002': u(IMG.pillowsWhite),
	'SC-PIL-003': u(IMG.pillowsCloseup),
	'SC-PIL-004': u(IMG.pillowsLuxury),
	'SC-PIL-005': u(IMG.pillowsCloseup),

	'SC-BED-001': u(IMG.beddingSheets),
	'SC-BED-002': u(IMG.beddingDuvet),
	'SC-BED-003': u(IMG.beddingComforter),
	'SC-BED-004': u(IMG.beddingSheets),
	'SC-BED-005': u(IMG.beddingDuvet),
	'SC-BED-006': u(IMG.beddingSheets),
	'SC-BED-007': u(IMG.beddingThrow),
	'SC-BED-008': u(IMG.beddingComforter),

	'SC-FRM-001': u(IMG.bedFrameAdjustable),
	'SC-FRM-002': u(IMG.bedFrameUpholstered),
	'SC-FRM-003': u(IMG.bedFrameWalnut),
	'SC-FRM-004': u(IMG.bedFrameMetal),

	'SC-ACC-001': u(IMG.accessoryProtector),
	'SC-ACC-002': u(IMG.accessoryTopper),
	'SC-ACC-003': u(IMG.accessoryWeightedBlanket),
	'SC-ACC-004': u(IMG.accessorySleepMask),
	'SC-ACC-005': u(IMG.accessorySoundMachine),
};

// ─── BC catalog: list SC products ─────────────────────────────────────

async function listSleepCountryProducts() {
	const all = [];
	let page = 1;
	while (true) {
		const url = `${BC_BASE}/catalog/products?sku:like=SC-&include=images&limit=100&page=${page}`;
		const res = await fetch(url, { headers: bcHeaders });
		if (!res.ok) {
			throw new Error(`list products failed: ${res.status} ${await res.text()}`);
		}
		const j = await res.json();
		all.push(...(j.data || []));
		const meta = j.meta?.pagination || {};
		if (meta.current_page >= (meta.total_pages || 1)) break;
		page++;
	}
	return all;
}

// ─── Verify image URL is reachable ────────────────────────────────────

async function verifyImage(url) {
	try {
		const res = await fetch(url, { method: 'HEAD' });
		return res.ok;
	} catch {
		return false;
	}
}

// ─── BC: upload image ─────────────────────────────────────────────────

async function uploadImage(productId, imageUrl, description) {
	const payload = { image_url: imageUrl, is_thumbnail: true, description, sort_order: 0 };
	const res = await fetch(`${BC_BASE}/catalog/products/${productId}/images`, {
		method: 'POST',
		headers: bcHeaders,
		body: JSON.stringify(payload),
	});
	if (res.status === 429) {
		const retryMs = parseInt(res.headers.get('X-Rate-Limit-Time-Reset-Ms') || '1500');
		await new Promise((r) => setTimeout(r, retryMs + 100));
		return uploadImage(productId, imageUrl, description);
	}
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(`BC upload failed for product ${productId}: ${res.status} ${err.title || ''}`);
	}
	return true;
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
	console.log(`Sleep Country image attach (store ${STORE})${dryRun ? ' [DRY RUN]' : ''}`);

	const products = await listSleepCountryProducts();
	console.log(`Found ${products.length} products with SC- prefix`);

	let success = 0;
	let skipped = 0;
	let failed = 0;

	for (const p of products) {
		if (onlySkus && !onlySkus.includes(p.sku)) continue;

		const hasImages = (p.images || []).length > 0;
		if (hasImages && !force) {
			console.log(`  SKIP ${p.sku} (already has ${p.images.length} image(s))`);
			skipped++;
			continue;
		}

		const imgUrl = SKU_IMAGES[p.sku];
		if (!imgUrl) {
			console.log(`  WARN ${p.sku}: no image mapping, skipping`);
			skipped++;
			continue;
		}

		console.log(`  ${p.sku} | ${p.name}`);
		console.log(`    image: ${imgUrl}`);

		if (dryRun) {
			const ok = await verifyImage(imgUrl);
			console.log(`    [dry-run] reachable: ${ok}`);
			ok ? success++ : failed++;
			continue;
		}

		try {
			await uploadImage(p.id, imgUrl, 'Photo from Unsplash');
			console.log(`    uploaded`);
			success++;
		} catch (err) {
			console.error(`    FAILED: ${err.message}`);
			failed++;
		}

		await new Promise((r) => setTimeout(r, 250));
	}

	console.log(`\nDone. ${success} uploaded${dryRun ? ' (dry)' : ''}, ${skipped} skipped, ${failed} failed.`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
