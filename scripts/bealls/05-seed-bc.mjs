#!/usr/bin/env node
/**
 * Seed BigCommerce with scraped Bealls family product data.
 *
 * Usage:
 *   node scripts/bealls/05-seed-bc.mjs bealls
 *   node scripts/bealls/05-seed-bc.mjs beallsflorida
 *
 * For each product:
 *   1. POST /catalog/products with name, price, retail_price, brand, etc.
 *   2. POST /catalog/products/{id}/images with image_url
 *   3. POST /catalog/products/channel-assignments to make visible on banner channel
 *
 * Pre-requisites:
 *   - scripts/bealls/data/{banner}.json (from 04-scrape-products.mjs)
 *   - BC store has been restructured (01–03 scripts)
 *   - Channel + categories exist with the IDs in CATEGORY_MAP below
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const STORE = process.env.BIGCOMMERCE_STORE_HASH;
const TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;
const BASE = `https://api.bigcommerce.com/stores/${STORE}/v3`;

const headers = {
	'X-Auth-Token': TOKEN,
	'Content-Type': 'application/json',
	Accept: 'application/json',
};

const BANNERS = {
	bealls: {
		channelId: 1,
		categoryMap: {
			'/c/women/tops':    250, // Bealls Women
			'/c/women/dresses': 250,
			'/c/men':           251, // Bealls Men
			'/c/kids':          252, // Bealls Kids
			'/c/shoes':         253, // Bealls Shoes
			'/c/home':          254, // Bealls Home
			'/c/beauty':        255, // Bealls Beauty
			'/c/handbags':      256, // Bealls Handbags
		},
		channelCategoryIds: [250, 251, 252, 253, 254, 255, 256, 257],
	},
	beallsflorida: {
		channelId: 1846321,
		categoryMap: {
			'/c/women':                  258, // BeallsFlorida Women
			'/c/men':                    259, // BeallsFlorida Men
			'/c/kids':                   260, // BeallsFlorida Kids
			'/c/shoes':                  261, // BeallsFlorida Shoes
			'/c/home':                   262, // BeallsFlorida Home
			'/c/seasonal/vacation-shop': 263, // BeallsFlorida Vacation
			'/c/women/swim-beach':       264, // BeallsFlorida Swim & Beach
			'/c/women/active-outdoor':   263, // map active-outdoor → Vacation
		},
		channelCategoryIds: [258, 259, 260, 261, 262, 263, 264, 265],
	},
};

async function api(method, path, body) {
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});
	if (res.status === 429) {
		const wait = parseInt(res.headers.get('X-Rate-Limit-Time-Reset-Ms') || '1000');
		await new Promise((r) => setTimeout(r, wait + 100));
		return api(method, path, body);
	}
	if (res.status === 204) return null;
	const data = await res.json().catch(() => null);
	if (!res.ok) {
		throw new Error(`API ${res.status}: ${method} ${path} — ${JSON.stringify(data?.errors || data || {}).slice(0, 200)}`);
	}
	return data;
}

function buildDescription(p) {
	const parts = [];
	if (p.description) parts.push(`<p>${p.description}</p>`);
	if (p.attributes?.length) {
		parts.push('<ul>');
		for (const attr of p.attributes) parts.push(`<li>${attr}</li>`);
		parts.push('</ul>');
	}
	return parts.join('') || `<p>${p.title}</p>`;
}

async function createProduct(banner, p) {
	const cfg = BANNERS[banner];
	const categoryId = cfg.categoryMap[p.sourceCategory];
	if (!categoryId) {
		throw new Error(`No category mapping for sourceCategory ${p.sourceCategory}`);
	}

	// Use first variant SKU if available, otherwise generate from product ID
	const sku = p.variants?.[0]?.sku || `${banner.toUpperCase()}-${p.id}`;
	const weight = 1.0; // BC requires non-zero weight; demo data — actual weight not scraped

	const payload = {
		name: p.title.trim(),
		type: 'physical',
		sku,
		price: p.price ?? 19.99,
		retail_price: p.comparablePrice ?? 0,
		weight,
		categories: [categoryId],
		brand_name: p.brand || 'Generic',
		description: buildDescription(p),
		inventory_tracking: 'none',
		is_visible: true,
		availability: 'available',
		condition: 'New',
	};

	const res = await api('POST', '/catalog/products', payload);
	const productId = res.data.id;

	// Add image — BC fetches the URL asynchronously
	if (p.image) {
		try {
			await api('POST', `/catalog/products/${productId}/images`, {
				image_url: p.image,
				is_thumbnail: true,
				description: p.title,
			});
		} catch (e) {
			// Image add failures are non-fatal — product still seeds
			console.warn(`    image upload failed: ${e.message}`);
		}
	}

	return productId;
}

async function assignChannels(productIds, channelId) {
	const BATCH = 50;
	for (let i = 0; i < productIds.length; i += BATCH) {
		const batch = productIds.slice(i, i + BATCH);
		const payload = batch.map((pid) => ({
			product_id: pid,
			channel_id: channelId,
		}));
		await api('PUT', '/catalog/products/channel-assignments', payload);
		console.log(`  Assigned ${batch.length} products to channel ${channelId} (total ${i + batch.length})`);
	}
}

async function main() {
	const banner = process.argv[2];
	if (!banner || !BANNERS[banner]) {
		console.error('Usage: node scripts/bealls/05-seed-bc.mjs <bealls|beallsflorida>');
		process.exit(1);
	}

	if (!STORE || !TOKEN) {
		throw new Error('Missing BIGCOMMERCE_STORE_HASH or BIGCOMMERCE_ACCESS_TOKEN');
	}

	const cfg = BANNERS[banner];
	const inFile = join(__dirname, 'data', `${banner}.json`);
	const products = JSON.parse(await readFile(inFile, 'utf8'));

	console.log(`\n=== Seeding ${banner} (channel ${cfg.channelId}) ===`);
	console.log(`  Source: ${inFile}`);
	console.log(`  Count:  ${products.length} products\n`);

	const created = [];
	const failed = [];

	for (let i = 0; i < products.length; i++) {
		const p = products[i];
		const idx = `[${i + 1}/${products.length}]`;
		try {
			const productId = await createProduct(banner, p);
			created.push(productId);
			if ((i + 1) % 10 === 0 || i === products.length - 1) {
				console.log(`  ${idx} ✓ ${p.title} (BC id ${productId})`);
			}
		} catch (e) {
			console.error(`  ${idx} ✗ ${p.title}: ${e.message}`);
			failed.push({ product: p, error: e.message });
		}
	}

	console.log(`\nCreated: ${created.length}/${products.length}`);

	if (created.length > 0) {
		console.log('\n=== Channel assignments ===');
		await assignChannels(created, cfg.channelId);
	}

	if (failed.length > 0) {
		console.log(`\nFailures saved: ${inFile}.failed.json`);
		await import('node:fs/promises').then((fs) =>
			fs.writeFile(`${inFile}.failed.json`, JSON.stringify(failed, null, 2)),
		);
	}

	console.log('\n✓ Seed complete.\n');
}

main().catch((e) => {
	console.error('Fatal:', e);
	process.exit(1);
});
