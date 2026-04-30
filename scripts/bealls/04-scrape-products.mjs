#!/usr/bin/env node
/**
 * Scrape Bealls family product catalogs via JSON-LD structured data.
 *
 * Usage:
 *   node scripts/bealls/04-scrape-products.mjs bealls
 *   node scripts/bealls/04-scrape-products.mjs beallsflorida
 *
 * Two-pass approach:
 *   Phase 1 — Visit each category PLP. Read JSON-LD ItemList script tag for
 *             the list of product URLs (cap at PRODUCTS_PER_CATEGORY).
 *   Phase 2 — Visit each unique PDP. Read JSON-LD ProductGroup for clean
 *             brand/name/description/variants/image. Also pull
 *             "Comparable value $X" from the DOM (not in JSON-LD but core
 *             to off-price brand voice).
 *
 * Output: scripts/bealls/data/{banner}.json
 *
 * Anti-bot handling: detects Cloudflare/Akamai challenge pages and bails.
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'data');

const PRODUCTS_PER_CATEGORY = 15; // ~120 per banner across 8 categories

const BANNERS = {
	bealls: {
		base: 'https://www.bealls.com',
		categoryPaths: [
			'/c/women/tops',
			'/c/women/dresses',
			'/c/men',
			'/c/kids',
			'/c/shoes',
			'/c/home',
			'/c/beauty',
			'/c/handbags',
		],
	},
	beallsflorida: {
		base: 'https://www.beallsflorida.com',
		categoryPaths: [
			'/c/women',
			'/c/men',
			'/c/kids',
			'/c/shoes',
			'/c/home',
			'/c/seasonal/vacation-shop',
			'/c/women/swim-beach',
			'/c/women/active-outdoor',
		],
	},
};

function detectBlock(html) {
	const sigs = ['Just a moment', 'Cloudflare', 'Access denied', 'Pardon Our Interruption', '/cdn-cgi/challenge-platform', 'PerimeterX', '/_Incapsula_Resource'];
	return sigs.find((s) => html.includes(s)) ?? null;
}

async function readJsonLd(page) {
	return page.evaluate(() => {
		return Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
			.map((s) => { try { return JSON.parse(s.textContent || ''); } catch { return null; } })
			.filter(Boolean);
	});
}

async function getPlpUrls(page, base, path, cap) {
	const url = `${base}${path}`;
	console.log(`  → PLP ${path}`);
	try {
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
	} catch (e) {
		console.warn(`    ✗ navigate failed: ${e.message}`);
		return [];
	}
	const html = await page.content();
	const block = detectBlock(html);
	if (block) {
		console.warn(`    ✗ blocked: matched "${block}"`);
		throw new Error('blocked');
	}

	const lds = await readJsonLd(page);
	const itemList = lds.find((j) => j['@type'] === 'ItemList');
	if (!itemList) {
		console.warn('    ✗ no ItemList JSON-LD');
		return [];
	}
	const urls = (itemList.itemListElement || [])
		.slice(0, cap)
		.map((item) => new URL(item.url, base).href);
	console.log(`    ✓ ${urls.length} URLs`);
	return urls;
}

async function getPdpDetail(page, url) {
	try {
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
	} catch (e) {
		return { url, error: `navigate: ${e.message}` };
	}

	const lds = await readJsonLd(page);
	const pg = lds.find((j) => j['@type'] === 'ProductGroup');
	if (!pg) return { url, error: 'no ProductGroup JSON-LD' };

	// Comparable-value extraction from DOM (not in JSON-LD)
	const compVal = await page.evaluate(() => {
		const text = document.body.innerText;
		const m = text.match(/Comparable value\s*\$\s*([\d,]+(?:\.\d{1,2})?)/i);
		return m ? parseFloat(m[1].replace(/,/g, '')) : null;
	});

	// Description blob is JSON-encoded under "description"
	let attributes = [];
	let description = '';
	try {
		const desc = JSON.parse(pg.description);
		attributes = desc.attributes || [];
		description = desc.description || '';
	} catch {
		description = pg.description || '';
	}

	const variants = (pg.hasVariant || []).map((v) => ({
		sku: v.sku,
		mpn: v.mpn,
		color: v.color,
		size: v.size,
		price: v.offers?.price ?? null,
		availability: v.offers?.availability?.split('/')?.pop() ?? null,
		image: v.image,
	}));
	const sale = variants[0]?.price ?? null;

	const imageBaseUrl = pg.image || null;
	const image = imageBaseUrl ? imageBaseUrl.replace('{:size}', '500w') : null;

	const brand = pg.brand?.name ?? null;
	const audienceMin = pg.audience?.suggestedAge?.minValue ?? null;

	return {
		id: pg.productGroupID,
		url,
		title: (pg.name || '').trim(),
		brand,
		description,
		attributes,
		image,
		imageBaseUrl,
		variants,
		variantCount: variants.length,
		price: sale,
		comparablePrice: compVal,
		savingsPct: compVal && sale ? Math.round(((compVal - sale) / compVal) * 100) : null,
		audienceMinAge: audienceMin,
	};
}

async function main() {
	const banner = process.argv[2];
	if (!banner || !BANNERS[banner]) {
		console.error('Usage: node scripts/bealls/04-scrape-products.mjs <bealls|beallsflorida>');
		process.exit(1);
	}

	const cfg = BANNERS[banner];
	console.log(`\n=== Scraping ${banner} (${cfg.base}) ===`);
	console.log(`Cap: ${PRODUCTS_PER_CATEGORY} products × ${cfg.categoryPaths.length} categories`);

	await mkdir(OUT_DIR, { recursive: true });

	const browser = await chromium.launch({ headless: true });
	const ctx = await browser.newContext({
		userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
		viewport: { width: 1440, height: 900 },
		locale: 'en-US',
	});
	const page = await ctx.newPage();

	// ─── Phase 1: collect PDP URLs from each PLP via JSON-LD ─────
	console.log('\n--- Phase 1: PLP URL discovery ---');
	const urlByCategory = new Map();
	try {
		for (const path of cfg.categoryPaths) {
			const urls = await getPlpUrls(page, cfg.base, path, PRODUCTS_PER_CATEGORY);
			urlByCategory.set(path, urls);
			await page.waitForTimeout(400);
		}
	} catch (e) {
		console.error('Phase 1 aborted:', e.message);
		await browser.close();
		process.exit(2);
	}

	const allUrls = new Map();
	for (const [path, urls] of urlByCategory) {
		for (const u of urls) {
			if (!allUrls.has(u)) allUrls.set(u, path);
		}
	}
	console.log(`\nTotal unique PDP URLs to fetch: ${allUrls.size}`);

	// ─── Phase 2: fetch full detail per PDP ──────────────────────
	console.log('\n--- Phase 2: PDP detail extraction ---');
	const products = [];
	const errors = [];
	let i = 0;
	for (const [url, sourceCategory] of allUrls) {
		i++;
		const detail = await getPdpDetail(page, url);
		if (detail.error) {
			errors.push({ url, error: detail.error });
			console.log(`  [${i}/${allUrls.size}] ✗ ${detail.error}`);
		} else {
			products.push({ ...detail, sourceCategory });
			if (i % 10 === 0 || i === allUrls.size) {
				console.log(`  [${i}/${allUrls.size}] ${detail.title} (${detail.brand})`);
			}
		}
		await page.waitForTimeout(300);
	}

	await browser.close();

	const outFile = join(OUT_DIR, `${banner}.json`);
	await writeFile(outFile, JSON.stringify(products, null, 2));

	console.log(`\n=== Summary ===`);
	console.log(`  Products fetched: ${products.length}`);
	console.log(`  Errors:           ${errors.length}`);
	console.log(`  With brand:       ${products.filter((p) => p.brand).length}`);
	console.log(`  With description: ${products.filter((p) => p.description).length}`);
	console.log(`  With comp value:  ${products.filter((p) => p.comparablePrice != null).length}`);
	console.log(`  Avg variants:     ${(products.reduce((s, p) => s + p.variantCount, 0) / products.length).toFixed(1)}`);
	console.log(`  Saved:            ${outFile}`);
	if (errors.length) {
		console.log(`  Errors saved:     ${outFile}.errors.json`);
		await writeFile(`${outFile}.errors.json`, JSON.stringify(errors, null, 2));
	}
}

main().catch((e) => {
	console.error('Fatal:', e);
	process.exit(1);
});
