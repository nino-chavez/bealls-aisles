import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateText, Output } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { LayoutSchema } from '$lib/schema/layout';
import { buildLayoutPrompt } from '$lib/server/layout-prompt';
import { loadCategoryProducts } from '$lib/server/catalog';
import { getCachedLayout, cacheLayout } from '$lib/server/cache';

const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY });

export const POST: RequestHandler = async ({ request }) => {
	const startTime = Date.now();

	try {
		const { persona, categorySlug } = await request.json();

		if (!persona || !categorySlug) {
			return json({ error: 'Missing required fields: persona, categorySlug' }, { status: 400 });
		}

		// ─── Cache check ───────────────────────────────────────────
		const cached = await getCachedLayout(persona, categorySlug);
		if (cached) {
			const elapsed = Date.now() - startTime;
			return json({
				layout: cached,
				meta: {
					persona,
					categoryName: categorySlug,
					productCount: 0,
					generationTimeMs: elapsed,
					cacheHit: true,
				},
			});
		}

		// ─── Cache miss — generate ─────────────────────────────────
		const result = await loadCategoryProducts(categorySlug, persona);
		if (!result) {
			return json({ error: `Category "${categorySlug}" not found` }, { status: 404 });
		}

		const { products, categoryName } = result;
		const prompt = buildLayoutPrompt(persona, categoryName, products);

		const { output: layout } = await generateText({
			model: anthropic('claude-sonnet-4-20250514'),
			output: Output.object({ schema: LayoutSchema }),
			prompt,
		});

		// Store in cache (non-blocking — don't slow down the response)
		if (layout) {
			cacheLayout(persona, categorySlug, layout).catch(() => {});
		}

		const elapsed = Date.now() - startTime;

		return json({
			layout,
			meta: {
				persona,
				categoryName,
				productCount: products.length,
				generationTimeMs: elapsed,
				cacheHit: false,
			},
		});
	} catch (err) {
		const elapsed = Date.now() - startTime;
		console.error('Layout generation failed:', err);

		return json(
			{
				error: 'Layout generation failed',
				message: err instanceof Error ? err.message : 'Unknown error',
				generationTimeMs: elapsed,
			},
			{ status: 500 }
		);
	}
};
