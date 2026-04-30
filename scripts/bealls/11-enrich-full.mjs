#!/usr/bin/env node
/**
 * Full Bealls catalog enrichment via Claude Haiku 4.5 (Vercel AI Gateway).
 *
 * Usage:
 *   node scripts/bealls/11-enrich-full.mjs bealls
 *   node scripts/bealls/11-enrich-full.mjs beallsflorida
 *   node scripts/bealls/11-enrich-full.mjs bealls --resume    # skip already-enriched products
 *
 * For each scraped product:
 *   1. Look up BC entity_id by SKU (variants[0].sku → BC's product.sku)
 *   2. Run Haiku 4.5 enrichment (priceTier, useCase, personaFit, semanticTags)
 *   3. UPSERT into Neon enriched_products keyed by bc_entity_id
 *
 * Concurrency 5; rate-limit aware.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateText, Output, gateway } from 'ai';
import { neon } from '@neondatabase/serverless';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));

const STORE = process.env.BIGCOMMERCE_STORE_HASH;
const TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;
const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const sql = neon(DB_URL);

const MODEL = 'anthropic/claude-haiku-4.5';
const PRICING = { input: 1.0, output: 5.0 };
const CONCURRENCY = 5;

const BANNER_CONFIG = {
	bealls: {
		channelId: 1846324,
		storeName: 'bealls',
		storeDescription: 'an off-price family retailer offering clothing, shoes, home, and gifts at comparable values up to 70% off',
		voiceGuidance: 'Friendly, value-driven, broadly inclusive. Family-oriented copy. Inclusive across ages, sizes, and budgets.',
		personaDefinitions: {
			gatherer: 'Browsing for vacation outfits, seasonal updates, family wardrobes. Loves a deal but takes time to discover. Open to inspiration tiles, seasonal edits, and outfit ideas.',
			hunter: 'Restocking essentials on coupon. Knows what they need — kids\' shorts under $10, work tops on sale, beach essentials. Wants filters, sale prices, fast checkout.',
			researcher: 'Reading reviews, comparing fabric content and sizing. Wants confidence on fit and quality before clicking buy. Methodical, value-oriented.',
			gifter: 'Snowbird grandparents, holiday gifts for kids/grandkids, broad-appeal gifts at reasonable price points. Wants safe choices that feel generous.',
		},
	},
	beallsflorida: {
		channelId: 1846321,
		storeName: 'Bealls Florida',
		storeDescription: 'a Florida lifestyle brand selling coastal apparel, beach essentials, and resort wear at off-price values',
		voiceGuidance: 'Coastal, lifestyle, casual confidence. Lead with the feeling, then the product.',
		personaDefinitions: {
			gatherer: 'Resort/beach wear inspiration. Browsing for the next vacation, the next pool weekend, the next casual outing.',
			hunter: 'Outfit completion. Knows the occasion; needs the missing piece. Fast and specific.',
			researcher: 'Quality of materials matters here for durability — saltwater, sun, chlorine.',
			gifter: 'Gifts for FL relatives — the snowbird parents, the retiree who moved south, the visiting grandkids.',
		},
	},
};

const EnrichmentSchema = z.object({
	priceTier: z.enum(['budget', 'mid', 'premium', 'luxury']),
	useCase: z.string(),
	personaFit: z.object({
		gatherer: z.number(),
		hunter: z.number(),
		researcher: z.number(),
		gifter: z.number(),
	}),
	semanticTags: z.array(z.string()),
});

function buildPrompt(brandCtx, product) {
	const { storeName, storeDescription, voiceGuidance, personaDefinitions } = brandCtx;
	const price = product.price ?? 0;
	const comp = product.comparablePrice;
	const compPart = comp ? ` (comparable value $${comp})` : '';
	const attrs = (product.attributes ?? []).join(', ') || 'none provided';
	const desc = (product.description ?? '').slice(0, 400) || 'none provided';
	return `You are an enrichment AI for ${storeName}, ${storeDescription}.

VOICE: ${voiceGuidance}

PERSONAS (score 0.0-1.0 fit per persona):
- Gatherer: ${personaDefinitions.gatherer}
- Hunter: ${personaDefinitions.hunter}
- Researcher: ${personaDefinitions.researcher}
- Gifter: ${personaDefinitions.gifter}

PRODUCT
- Title: ${product.title}
- Brand: ${product.brand ?? 'unbranded'}
- Category: ${product.sourceCategory}
- Price: $${price}${compPart}
- Description: ${desc}
- Attributes: ${attrs}

SCORING — USE THE FULL 0.0–1.0 RANGE. Most products fit some personas WELL and other personas POORLY. Avoid clustering scores between 0.5 and 0.85.

Calibration:
- 0.85–1.00: exactly what this persona is shopping for
- 0.55–0.84: reasonable but not standout
- 0.30–0.54: wouldn't naturally surface for this persona
- 0.10–0.29: actively wrong for this persona's intent
- 0.00–0.09: would frustrate this persona

Worked examples for off-price retail:
- Pack of 6 plain white men's t-shirts → Hunter 0.95, Gatherer 0.20, Gifter 0.30
- Statement-print maxi dress with hand-embroidery → Gatherer 0.90, Hunter 0.40, Researcher 0.45
- 3-piece sports ball gift set → Gifter 0.90, Researcher 0.20

Score this product across all four personas using the full range. Also assign priceTier (budget <$25, mid $25-75, premium $75-200, luxury $200+), useCase (2-6 words), and 5-8 semanticTags for intent-based discovery.`;
}

async function bcApi(method, path) {
	const res = await fetch(`https://api.bigcommerce.com/stores/${STORE}/v3${path}`, {
		method,
		headers: { 'X-Auth-Token': TOKEN, Accept: 'application/json' },
	});
	if (res.status === 429) {
		const wait = parseInt(res.headers.get('X-Rate-Limit-Time-Reset-Ms') || '1000');
		await new Promise((r) => setTimeout(r, wait + 100));
		return bcApi(method, path);
	}
	if (!res.ok) throw new Error(`BC ${res.status}: ${path}`);
	return res.json();
}

async function buildSkuMap(channelId) {
	console.log(`  Fetching BC products on channel ${channelId}...`);
	const skuToEntityId = new Map();
	let page = 1;
	while (true) {
		const data = await bcApi('GET', `/catalog/products/channel-assignments?channel_id:in=${channelId}&limit=250&page=${page}`);
		const ids = (data.data || []).map((a) => a.product_id);
		if (ids.length === 0) break;
		// Now fetch product details (sku) in batches
		for (let i = 0; i < ids.length; i += 50) {
			const batch = ids.slice(i, i + 50);
			const detail = await bcApi('GET', `/catalog/products?id:in=${batch.join(',')}&include_fields=sku&limit=50`);
			for (const p of detail.data || []) {
				if (p.sku) skuToEntityId.set(p.sku, p.id);
			}
		}
		if (ids.length < 250) break;
		page++;
	}
	console.log(`  Mapped ${skuToEntityId.size} SKUs to BC entity IDs`);
	return skuToEntityId;
}

async function loadAlreadyEnriched(skuMap) {
	const rows = await sql`SELECT bc_entity_id FROM enriched_products`;
	const ids = new Set(rows.map((r) => r.bc_entity_id));
	let count = 0;
	for (const id of skuMap.values()) if (ids.has(id)) count++;
	return ids;
}

async function enrichOne(brandCtx, product) {
	const { output, usage } = await generateText({
		model: gateway(MODEL),
		output: Output.object({ schema: EnrichmentSchema }),
		prompt: buildPrompt(brandCtx, product),
	});
	return { output, usage };
}

async function upsert(entityId, productPath, e) {
	await sql`
		INSERT INTO enriched_products (
			bc_entity_id, bc_product_path,
			use_case, price_tier,
			fit_gatherer, fit_hunter, fit_researcher, fit_gifter,
			semantic_tags, enriched_at, enrichment_model, updated_at
		) VALUES (
			${entityId}, ${productPath},
			${e.useCase}, ${e.priceTier},
			${e.personaFit.gatherer}, ${e.personaFit.hunter}, ${e.personaFit.researcher}, ${e.personaFit.gifter},
			${e.semanticTags}, NOW(), ${MODEL}, NOW()
		)
		ON CONFLICT (bc_entity_id) DO UPDATE SET
			bc_product_path = EXCLUDED.bc_product_path,
			use_case = EXCLUDED.use_case,
			price_tier = EXCLUDED.price_tier,
			fit_gatherer = EXCLUDED.fit_gatherer,
			fit_hunter = EXCLUDED.fit_hunter,
			fit_researcher = EXCLUDED.fit_researcher,
			fit_gifter = EXCLUDED.fit_gifter,
			semantic_tags = EXCLUDED.semantic_tags,
			enriched_at = NOW(),
			enrichment_model = EXCLUDED.enrichment_model,
			updated_at = NOW()
	`;
}

async function mapConc(items, fn, c) {
	const results = new Array(items.length);
	let cursor = 0, done = 0, inFlight = 0;
	return new Promise((resolve) => {
		const next = () => {
			while (inFlight < c && cursor < items.length) {
				const i = cursor++;
				inFlight++;
				Promise.resolve(fn(items[i], i))
					.then((v) => { results[i] = { ok: true, value: v }; })
					.catch((e) => { results[i] = { ok: false, error: e.message }; })
					.finally(() => {
						inFlight--; done++;
						if (done % 25 === 0 || done === items.length) {
							process.stderr.write(`\r  ${done}/${items.length}`);
						}
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
	const resume = process.argv.includes('--resume');
	if (!banner || !BANNER_CONFIG[banner]) {
		console.error('Usage: node scripts/bealls/11-enrich-full.mjs <bealls|beallsflorida> [--resume]');
		process.exit(1);
	}
	if (!STORE || !TOKEN) throw new Error('BC credentials required');
	if (!DB_URL) throw new Error('DATABASE_URL required');

	const cfg = BANNER_CONFIG[banner];
	console.log(`\n=== Full enrichment: ${banner} (${MODEL}) ===\n`);

	// Build SKU → entity ID map
	const skuMap = await buildSkuMap(cfg.channelId);

	// Load scraped data
	const dataFile = join(__dirname, 'data', `${banner}.json`);
	const scraped = JSON.parse(await readFile(dataFile, 'utf8'));
	console.log(`  Scraped: ${scraped.length} products`);

	// Match to BC entity IDs via variant SKU
	const matched = scraped.map((p) => {
		const sku = p.variants?.[0]?.sku;
		const entityId = sku ? skuMap.get(sku) : null;
		return { product: p, entityId };
	}).filter((m) => m.entityId);
	console.log(`  Matched to BC: ${matched.length}/${scraped.length}`);

	// Optional resume — skip already-enriched
	let toEnrich = matched;
	if (resume) {
		const enrichedIds = await loadAlreadyEnriched(skuMap);
		toEnrich = matched.filter((m) => !enrichedIds.has(m.entityId));
		console.log(`  Skipping ${matched.length - toEnrich.length} already enriched`);
	}
	console.log(`  To enrich: ${toEnrich.length}\n`);

	if (toEnrich.length === 0) {
		console.log('Nothing to do.\n');
		return;
	}

	let totalIn = 0, totalOut = 0;
	const t0 = Date.now();

	const results = await mapConc(toEnrich, async ({ product, entityId }) => {
		const { output, usage } = await enrichOne(cfg, product);
		totalIn += usage?.inputTokens ?? 0;
		totalOut += usage?.outputTokens ?? 0;
		await upsert(entityId, product.url || `/p/${product.id}`, output);
		return entityId;
	}, CONCURRENCY);

	const tTotal = Date.now() - t0;
	const ok = results.filter((r) => r.ok).length;
	const failed = results.filter((r) => !r.ok);
	const cost = (totalIn / 1_000_000) * PRICING.input + (totalOut / 1_000_000) * PRICING.output;

	console.log(`\n=== Summary ===`);
	console.log(`  Enriched: ${ok}/${toEnrich.length}`);
	console.log(`  Failed:   ${failed.length}`);
	console.log(`  Tokens:   ${totalIn.toLocaleString()} in / ${totalOut.toLocaleString()} out`);
	console.log(`  Cost:     $${cost.toFixed(4)}  (avg $${(cost / ok).toFixed(5)}/product)`);
	console.log(`  Wall:     ${(tTotal / 1000).toFixed(1)}s\n`);
	if (failed.length && failed.length < 20) {
		for (const f of failed.slice(0, 5)) console.log(`    ✗ ${f.error}`);
	}
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
