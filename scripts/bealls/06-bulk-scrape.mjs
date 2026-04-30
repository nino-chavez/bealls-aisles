#!/usr/bin/env node
/**
 * Bulk Bealls family scraper — plain HTTP fetch, no browser.
 *
 * Bealls SSRs JSON-LD into the initial HTML response, so we can skip Playwright
 * entirely. ~50ms per request vs ~2s with a browser.
 *
 * Usage:
 *   node scripts/bealls/06-bulk-scrape.mjs bealls 1500
 *   node scripts/bealls/06-bulk-scrape.mjs beallsflorida 1000
 *
 * Pipeline:
 *   1. For each category, paginate /c/CAT/?page=N until target hit
 *   2. Parse JSON-LD ItemList for product URLs
 *   3. For each unique URL, fetch PDP and parse JSON-LD ProductGroup
 *   4. Extract "Comparable value $X" from raw HTML (not in JSON-LD)
 *   5. Concurrency-limited (CONCURRENCY in-flight at a time)
 *
 * Output: scripts/bealls/data/{banner}.json (overwrites prior file)
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'data');
const CONCURRENCY = 8;
const PER_PAGE = 48;

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

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
	const sigs = ['Just a moment', 'Pardon Our Interruption', '/cdn-cgi/challenge-platform', 'PerimeterX'];
	return sigs.find((s) => html.includes(s)) ?? null;
}

async function fetchHtml(url) {
	const res = await fetch(url, {
		headers: {
			'User-Agent': UA,
			Accept: 'text/html,application/xhtml+xml',
			'Accept-Language': 'en-US,en;q=0.9',
		},
		redirect: 'follow',
	});
	const html = await res.text();
	if (!res.ok) throw new Error(`${res.status} ${url}`);
	const block = detectBlock(html);
	if (block) throw new Error(`blocked: ${block}`);
	return html;
}

function extractJsonLd(html) {
	const out = [];
	const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
	let m;
	while ((m = re.exec(html)) !== null) {
		try { out.push(JSON.parse(m[1])); } catch {}
	}
	return out;
}

function getItemListUrls(html, base) {
	const lds = extractJsonLd(html);
	const list = lds.find((j) => j['@type'] === 'ItemList');
	if (!list) return [];
	return (list.itemListElement || []).map((it) => new URL(it.url, base).href);
}

function getProductGroup(html) {
	const lds = extractJsonLd(html);
	return lds.find((j) => j['@type'] === 'ProductGroup');
}

function getComparableValue(html) {
	const m = html.match(/Comparable value[^$]*\$\s*([\d,]+(?:\.\d{1,2})?)/i);
	return m ? parseFloat(m[1].replace(/,/g, '')) : null;
}

async function discoverUrls(base, path, target) {
	const urls = new Set();
	let page = 1;
	const MAX_PAGES = 30;
	while (urls.size < target && page <= MAX_PAGES) {
		const url = `${base}${path}/?page=${page}`;
		try {
			const html = await fetchHtml(url);
			const found = getItemListUrls(html, base);
			if (found.length === 0) break;
			let added = 0;
			for (const u of found) {
				if (!urls.has(u)) { urls.add(u); added++; }
			}
			if (added === 0) break; // exhausted unique URLs
			page++;
		} catch (e) {
			console.warn(`    page ${page} fail: ${e.message}`);
			break;
		}
	}
	return Array.from(urls).slice(0, target);
}

async function fetchPdp(url) {
	const html = await fetchHtml(url);
	const pg = getProductGroup(html);
	if (!pg) return { url, error: 'no ProductGroup' };

	let attributes = [];
	let description = '';
	try {
		const desc = JSON.parse(pg.description || '{}');
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
	}));
	const sale = variants[0]?.price ?? null;
	const compVal = getComparableValue(html);
	const imageBase = pg.image || null;

	return {
		id: pg.productGroupID,
		url,
		title: (pg.name || '').trim(),
		brand: pg.brand?.name ?? null,
		description,
		attributes,
		image: imageBase ? imageBase.replace('{:size}', '500w') : null,
		imageBaseUrl: imageBase,
		variants,
		variantCount: variants.length,
		price: sale,
		comparablePrice: compVal,
		savingsPct: compVal && sale ? Math.round(((compVal - sale) / compVal) * 100) : null,
		audienceMinAge: pg.audience?.suggestedAge?.minValue ?? null,
	};
}

/** Run async tasks with bounded concurrency; preserves order via index. */
async function mapConcurrent(items, fn, concurrency) {
	const results = new Array(items.length);
	let inFlight = 0;
	let cursor = 0;
	let done = 0;
	return new Promise((resolve, reject) => {
		const next = () => {
			while (inFlight < concurrency && cursor < items.length) {
				const i = cursor++;
				inFlight++;
				Promise.resolve(fn(items[i], i))
					.then((v) => { results[i] = v; })
					.catch((e) => { results[i] = { error: e.message }; })
					.finally(() => {
						inFlight--;
						done++;
						if (done % 50 === 0 || done === items.length) {
							process.stderr.write(`    [${done}/${items.length}]\n`);
						}
						if (done === items.length) resolve(results);
						else next();
					});
			}
		};
		next();
	});
}

async function main() {
	const banner = process.argv[2];
	const target = parseInt(process.argv[3] || '1000', 10);
	if (!banner || !BANNERS[banner]) {
		console.error('Usage: node scripts/bealls/06-bulk-scrape.mjs <bealls|beallsflorida> [target]');
		process.exit(1);
	}

	const cfg = BANNERS[banner];
	const perCategory = Math.ceil(target / cfg.categoryPaths.length);
	console.log(`\n=== ${banner} → target ${target} (~${perCategory} per category) ===\n`);

	await mkdir(OUT_DIR, { recursive: true });

	// ─── Phase 1: discover URLs across all categories ────────────
	console.log('Phase 1: PLP discovery');
	const t0 = Date.now();
	const urlsByCat = new Map();
	for (const path of cfg.categoryPaths) {
		const urls = await discoverUrls(cfg.base, path, perCategory);
		urlsByCat.set(path, urls);
		console.log(`  ${path}: ${urls.length} URLs`);
	}
	const t1 = Date.now();

	// Dedupe across categories, but keep sourceCategory of first encounter
	const allByUrl = new Map();
	for (const [path, urls] of urlsByCat) {
		for (const u of urls) {
			if (!allByUrl.has(u)) allByUrl.set(u, path);
		}
	}
	console.log(`  Unique URLs: ${allByUrl.size}  (${((t1 - t0) / 1000).toFixed(1)}s)\n`);

	// ─── Phase 2: PDP detail in parallel ─────────────────────────
	console.log(`Phase 2: PDP fetch (concurrency ${CONCURRENCY})`);
	const t2 = Date.now();
	const items = [...allByUrl.entries()];
	const results = await mapConcurrent(items, async ([url, sourceCategory]) => {
		try {
			const detail = await fetchPdp(url);
			if (detail.error) return null;
			return { ...detail, sourceCategory };
		} catch (e) {
			return null;
		}
	}, CONCURRENCY);
	const t3 = Date.now();
	const products = results.filter(Boolean);

	// ─── Save ────────────────────────────────────────────────────
	const outFile = join(OUT_DIR, `${banner}.json`);
	await writeFile(outFile, JSON.stringify(products, null, 2));

	console.log(`\n=== Summary ===`);
	console.log(`  Fetched:           ${products.length} / ${allByUrl.size}`);
	console.log(`  With brand:        ${products.filter((p) => p.brand).length}`);
	console.log(`  With description:  ${products.filter((p) => p.description).length}`);
	console.log(`  With attributes:   ${products.filter((p) => p.attributes?.length).length}`);
	console.log(`  With comp value:   ${products.filter((p) => p.comparablePrice != null).length}`);
	console.log(`  Avg variants:      ${(products.reduce((s, p) => s + p.variantCount, 0) / products.length).toFixed(1)}`);
	console.log(`  Phase 1 time:      ${((t1 - t0) / 1000).toFixed(1)}s`);
	console.log(`  Phase 2 time:      ${((t3 - t2) / 1000).toFixed(1)}s`);
	console.log(`  Total wall-clock:  ${((t3 - t0) / 1000).toFixed(1)}s`);
	console.log(`  Saved:             ${outFile}\n`);
}

main().catch((e) => {
	console.error('Fatal:', e);
	process.exit(1);
});
