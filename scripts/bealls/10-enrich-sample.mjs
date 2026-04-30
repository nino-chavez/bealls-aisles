#!/usr/bin/env node
/**
 * Sample enrichment run for Bealls catalog.
 *
 * Goal: run a small sample (default 10 products) on Haiku 4.5 to validate
 * quality and cost before committing to a full enrichment pass.
 *
 * Reads products from scripts/bealls/data/{banner}.json (already-scraped),
 * skips BC GraphQL entirely. Output is written to data/{banner}-sample-enriched.json
 * and stdout — no DB writes for sample.
 *
 * Usage:
 *   node scripts/bealls/10-enrich-sample.mjs bealls
 *   node scripts/bealls/10-enrich-sample.mjs bealls 20      # custom sample size
 */
import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateText, Output, gateway } from 'ai';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MODEL = 'anthropic/claude-haiku-4.5';
const PRICING = { input: 1.00, output: 5.00 }; // Haiku 4.5 per 1M tokens

const BRAND_PROMPT_CONTEXT = {
	bealls: {
		storeName: 'bealls',
		storeDescription: 'an off-price family retailer offering clothing, shoes, home, and gifts at comparable values up to 70% off',
		voiceGuidance: 'Friendly, value-driven, broadly inclusive. Use comparable-value language ("Comparable value $20 — You save 50%") rather than "regular price." No fake urgency, no fashion pretension. Family-oriented copy. Inclusive across ages, sizes, and budgets.',
		personaDefinitions: {
			gatherer: 'Browsing for vacation outfits, seasonal updates, family wardrobes. Loves a deal but takes time to discover. Open to inspiration tiles, seasonal edits, and outfit ideas.',
			hunter: 'Restocking essentials on coupon. Knows what they need — kids\' shorts under $10, work tops on sale, beach essentials. Wants filters, sale prices, fast checkout.',
			researcher: 'Reading reviews, comparing fabric content and sizing. Wants confidence on fit and quality before clicking buy. Methodical, value-oriented.',
			gifter: 'Snowbird grandparents, holiday gifts for kids/grandkids, broad-appeal gifts at reasonable price points. Wants safe choices that feel generous.',
		},
	},
	beallsflorida: {
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
	priceTier: z.enum(['budget', 'mid', 'premium', 'luxury']).describe('budget (<$25), mid ($25-75), premium ($75-200), luxury ($200+)'),
	useCase: z.string().describe('Primary use case in 2-6 words (e.g., "everyday casual", "beach day", "work-to-weekend", "kids dress-up")'),
	personaFit: z.object({
		gatherer: z.number().describe('0.0-1.0 — fit for the exploratory inspiration-driven shopper'),
		hunter: z.number().describe('0.0-1.0 — fit for the goal-oriented value-seeking shopper'),
		researcher: z.number().describe('0.0-1.0 — fit for the methodical fit/material-conscious shopper'),
		gifter: z.number().describe('0.0-1.0 — fit for someone shopping for others'),
	}),
	semanticTags: z.array(z.string()).describe('5-8 tags for intent-based discovery (e.g., "vacation-ready", "kids-friendly", "easy-care", "statement-piece")'),
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

SCORING — USE THE FULL 0.0–1.0 RANGE. Most products fit some personas WELL and other personas POORLY. Avoid clustering scores between 0.5 and 0.85 — that signals you're hedging, not scoring.

Calibration:
- 0.85–1.00: this product is exactly what this persona is shopping for
- 0.55–0.84: a reasonable but not standout match
- 0.30–0.54: would not naturally surface for this persona but could still appear
- 0.10–0.29: actively wrong for this persona's intent
- 0.00–0.09: this product would frustrate this persona

Worked example for off-price retail:
- A pack of 6 plain white men's t-shirts → Hunter 0.95 (essential restocking), Gatherer 0.20 (no story), Gifter 0.30 (boring gift)
- A statement-print maxi dress with floral hand-embroidery → Gatherer 0.90 (visual interest), Hunter 0.40 (not an essential), Researcher 0.45 (limited specs to compare)
- A 3-piece sports ball gift set → Gifter 0.90 (classic kids gift), Hunter 0.50, Researcher 0.20 (no one comparison-shops sports balls)

Score this product across all four personas using the full range.`;
}

async function main() {
	const banner = process.argv[2] || 'bealls';
	const limit = parseInt(process.argv[3] || '10', 10);
	const brandCtx = BRAND_PROMPT_CONTEXT[banner];
	if (!brandCtx) {
		console.error(`Unknown banner: ${banner}`);
		process.exit(1);
	}

	const dataFile = join(__dirname, 'data', `${banner}.json`);
	const all = JSON.parse(await readFile(dataFile, 'utf8'));

	// Sample: take a diverse subset (every Nth product to span categories)
	const stride = Math.floor(all.length / limit);
	const sample = [];
	for (let i = 0; i < all.length && sample.length < limit; i += stride || 1) {
		sample.push(all[i]);
	}

	console.log(`\n=== Haiku 4.5 enrichment sample — ${banner} ===`);
	console.log(`  Sample: ${sample.length} of ${all.length} products`);
	console.log(`  Model:  ${MODEL}\n`);

	const results = [];
	let totalIn = 0, totalOut = 0;
	const t0 = Date.now();

	for (let i = 0; i < sample.length; i++) {
		const p = sample[i];
		const idx = `[${i + 1}/${sample.length}]`;
		const tCallStart = Date.now();
		try {
			const { output, usage } = await generateText({
				model: gateway(MODEL),
				output: Output.object({ schema: EnrichmentSchema }),
				prompt: buildPrompt(brandCtx, p),
			});
			const elapsed = Date.now() - tCallStart;
			totalIn += usage?.inputTokens ?? 0;
			totalOut += usage?.outputTokens ?? 0;
			const fit = output.personaFit;
			console.log(`${idx} ${p.title.slice(0, 50).padEnd(52)} G:${fit.gatherer.toFixed(2)} H:${fit.hunter.toFixed(2)} R:${fit.researcher.toFixed(2)} Gi:${fit.gifter.toFixed(2)}  (${elapsed}ms)`);
			results.push({ ...p, _enrichment: output, _usage: usage });
		} catch (e) {
			console.log(`${idx} ${p.title.slice(0, 50)}  FAILED: ${e.message}`);
			results.push({ ...p, _error: e.message });
		}
	}

	const tTotal = Date.now() - t0;
	const cost = (totalIn / 1_000_000) * PRICING.input + (totalOut / 1_000_000) * PRICING.output;

	console.log(`\n=== Cost & Timing ===`);
	console.log(`  Tokens:   ${totalIn.toLocaleString()} in / ${totalOut.toLocaleString()} out`);
	console.log(`  Cost:     $${cost.toFixed(4)} (${sample.length} products → $${(cost / sample.length).toFixed(5)}/product)`);
	console.log(`  Wall:     ${(tTotal / 1000).toFixed(1)}s (${(tTotal / sample.length).toFixed(0)}ms/product)`);
	console.log(`  Extrapolation:`);
	console.log(`    800 products: $${((cost / sample.length) * 800).toFixed(2)}`);
	console.log(`    2,177 products (full): $${((cost / sample.length) * 2177).toFixed(2)}`);

	const outFile = join(__dirname, 'data', `${banner}-sample-enriched.json`);
	await writeFile(outFile, JSON.stringify(results, null, 2));
	console.log(`\n  Saved: ${outFile}\n`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
