import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateText, Output, gateway } from 'ai';
import { LayoutSchema } from '$lib/schema/layout';
import { buildLayoutPrompt } from '$lib/server/layout-prompt';
import { loadCategoryProducts } from '$lib/server/catalog';
import { getCachedLayout, cacheLayout, hashPicks } from '$lib/server/cache';
import { logGeneration } from '$lib/server/generation-log';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const startTime = Date.now();

	const sessionId = cookies.get('aisles_session') || undefined;

	try {
		const { persona, categorySlug, picksContext } = await request.json();

		if (!persona || !categorySlug) {
			return json({ error: 'Missing required fields: persona, categorySlug' }, { status: 400 });
		}

		// ─── Cache check ───────────────────────────────────────────
		const ph = hashPicks(picksContext);
		const cached = await getCachedLayout(persona, categorySlug, ph);
		if (cached) {
			const elapsed = Date.now() - startTime;

			logGeneration({
				type: 'layout',
				persona,
				categorySlug,
				cacheHit: true,
				generationTimeMs: elapsed,
				sessionId,
			}).catch(() => {});

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

		// ─── Cache miss — generate via AI Gateway ──────────────────
		const result = await loadCategoryProducts(categorySlug, persona);
		if (!result) {
			return json({ error: `Category "${categorySlug}" not found` }, { status: 404 });
		}

		const { products, categoryName } = result;
		const prompt = buildLayoutPrompt(persona, categoryName, products, picksContext);

		// Haiku primary, Sonnet fallback — handled by AI Gateway
		const aiResult = await generateText({
			model: gateway('anthropic/claude-haiku-4.5'),
			output: Output.object({ schema: LayoutSchema }),
			prompt,
			providerOptions: {
				gateway: {
					models: ['anthropic/claude-sonnet-4.6'],
					tags: ['feature:layout', `persona:${persona}`, `category:${categorySlug}`],
				},
			},
		});
		const layout = aiResult.output;
		const usage = aiResult.usage;
		const model = 'anthropic/claude-haiku-4.5';

		if (layout) {
			cacheLayout(persona, categorySlug, layout, ph).catch(() => {});
		}

		const elapsed = Date.now() - startTime;

		logGeneration({
			type: 'layout',
			persona,
			categorySlug,
			cacheHit: false,
			generationTimeMs: elapsed,
			productCount: products.length,
			inputTokens: usage?.inputTokens,
			outputTokens: usage?.outputTokens,
			model,
			sessionId,
		}).catch(() => {});

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
