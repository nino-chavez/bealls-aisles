#!/usr/bin/env node
/**
 * Bulk-seed BigCommerce with scraped product data, parallelized.
 *
 * Usage:
 *   node scripts/bealls/08-bulk-seed.mjs bealls
 *   node scripts/bealls/08-bulk-seed.mjs beallsflorida
 *
 * Concurrent product creation (default 5 in flight). 429 handling retries
 * with the API's recommended wait. Channel assignments batched after.
 */
import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const STORE = process.env.BIGCOMMERCE_STORE_HASH;
const TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;
const BASE = `https://api.bigcommerce.com/stores/${STORE}/v3`;
const CONCURRENCY = 5;

const headers = {
	'X-Auth-Token': TOKEN,
	'Content-Type': 'application/json',
	Accept: 'application/json',
};

const BANNERS = {
	bealls: {
		channelId: 1,
		categoryMap: {
			'/c/women/tops':    250,
			'/c/women/dresses': 250,
			'/c/men':           251,
			'/c/kids':          252,
			'/c/shoes':         253,
			'/c/home':          254,
			'/c/beauty':        255,
			'/c/handbags':      256,
		},
	},
	beallsflorida: {
		channelId: 1846321,
		categoryMap: {
			'/c/women':                  258,
			'/c/men':                    259,
			'/c/kids':                   260,
			'/c/shoes':                  261,
			'/c/home':                   262,
			'/c/seasonal/vacation-shop': 263,
			'/c/women/swim-beach':       264,
			'/c/women/active-outdoor':   263,
		},
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
		throw new Error(`${res.status}: ${JSON.stringify(data?.errors || data || {}).slice(0, 200)}`);
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

async function createOne(banner, p) {
	const cfg = BANNERS[banner];
	const categoryId = cfg.categoryMap[p.sourceCategory];
	if (!categoryId) throw new Error(`No category map for ${p.sourceCategory}`);

	const sku = p.variants?.[0]?.sku || `${banner.toUpperCase()}-${p.id}`;
	const payload = {
		name: p.title.trim().slice(0, 250),
		type: 'physical',
		sku,
		price: p.price ?? 19.99,
		retail_price: p.comparablePrice ?? 0,
		weight: 1.0,
		categories: [categoryId],
		brand_name: (p.brand || 'Generic').slice(0, 250),
		description: buildDescription(p),
		inventory_tracking: 'none',
		is_visible: true,
		availability: 'available',
		condition: 'New',
	};

	const res = await api('POST', '/catalog/products', payload);
	const productId = res.data.id;

	if (p.image) {
		try {
			await api('POST', `/catalog/products/${productId}/images`, {
				image_url: p.image,
				is_thumbnail: true,
				description: p.title,
			});
		} catch {
			// non-fatal
		}
	}
	return productId;
}

/** Bounded-concurrency map. */
async function mapConc(items, fn, c) {
	const results = new Array(items.length);
	let cursor = 0;
	let done = 0;
	let inFlight = 0;
	return new Promise((resolve) => {
		const next = () => {
			while (inFlight < c && cursor < items.length) {
				const i = cursor++;
				inFlight++;
				Promise.resolve(fn(items[i], i))
					.then((v) => { results[i] = { ok: true, value: v }; })
					.catch((e) => { results[i] = { ok: false, error: e.message, item: items[i] }; })
					.finally(() => {
						inFlight--;
						done++;
						if (done % 50 === 0) process.stderr.write(`\r  ${done}/${items.length}`);
						if (done === items.length) {
							process.stderr.write(`\r  ${done}/${items.length}\n`);
							resolve(results);
						} else next();
					});
			}
		};
		next();
	});
}

async function main() {
	const banner = process.argv[2];
	if (!banner || !BANNERS[banner]) {
		console.error('Usage: node scripts/bealls/08-bulk-seed.mjs <bealls|beallsflorida>');
		process.exit(1);
	}

	const cfg = BANNERS[banner];
	const inFile = join(__dirname, 'data', `${banner}.json`);
	const products = JSON.parse(await readFile(inFile, 'utf8'));

	console.log(`\n=== Bulk seed ${banner} → channel ${cfg.channelId} ===`);
	console.log(`  Products: ${products.length}`);
	console.log(`  Concurrency: ${CONCURRENCY}\n`);

	const t0 = Date.now();
	const results = await mapConc(products, (p) => createOne(banner, p), CONCURRENCY);
	const t1 = Date.now();

	const created = results.filter((r) => r.ok).map((r) => r.value);
	const failed = results.filter((r) => !r.ok);

	console.log(`\n  Created: ${created.length} / ${products.length}  (${((t1 - t0) / 1000).toFixed(1)}s)`);
	console.log(`  Failed:  ${failed.length}`);

	if (failed.length > 0 && failed.length < 10) {
		for (const f of failed.slice(0, 5)) {
			console.log(`    ✗ ${f.item.title}: ${f.error}`);
		}
	}

	if (created.length > 0) {
		console.log(`\n=== Channel assignments → ${cfg.channelId} ===`);
		const BATCH = 50;
		for (let i = 0; i < created.length; i += BATCH) {
			const batch = created.slice(i, i + BATCH);
			await api('PUT', '/catalog/products/channel-assignments',
				batch.map((pid) => ({ product_id: pid, channel_id: cfg.channelId })));
			process.stderr.write(`\r  ${Math.min(i + BATCH, created.length)}/${created.length}`);
		}
		process.stderr.write(`\n`);
	}

	if (failed.length > 0) {
		await writeFile(`${inFile}.failed.json`, JSON.stringify(failed, null, 2));
	}
	console.log(`\n✓ Done.\n`);
}

main().catch((e) => {
	console.error('Fatal:', e);
	process.exit(1);
});
