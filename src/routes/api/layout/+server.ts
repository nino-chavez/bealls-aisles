import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateText, Output } from 'ai';
import { LayoutSchema } from '$lib/schema/layout';
import { buildLayoutPrompt } from '$lib/server/layout-prompt';
import { loadCategoryProducts, loadHomeProducts } from '$lib/server/catalog';
import { getCachedLayout, cacheLayout, hashPicks } from '$lib/server/cache';
import { logGeneration } from '$lib/server/generation-log';
import { getActiveRules, rulesToPromptContext } from '$lib/server/rules';
import { layoutModel, gatewayProviderOptions } from '$lib/server/ai-model';
import { getBrand } from '$lib/brand/config';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const startTime = Date.now();

	const sessionId = cookies.get('aisles_session') || undefined;

	try {
		const { persona, categorySlug, picksContext, probabilities } = await request.json();

		if (!persona || !categorySlug) {
			return json({ error: 'Missing required fields: persona, categorySlug' }, { status: 400 });
		}

		const brandId = getBrand().id;

		// ─── Cache check ───────────────────────────────────────────
		const ph = hashPicks(picksContext);
		const cached = await getCachedLayout(brandId, persona, categorySlug, ph);
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
		const result = categorySlug === 'home'
			? await loadHomeProducts(persona)
			: await loadCategoryProducts(categorySlug, persona);
		if (!result) {
			return json({ error: `Category "${categorySlug}" not found` }, { status: 404 });
		}

		const { products, categoryName } = result;
		// Fetch merchandising rules from the admin app's shared DB
		const rules = await getActiveRules(persona, categorySlug);
		const rulesContext = rulesToPromptContext(rules);

		const prompt = buildLayoutPrompt(persona, categoryName, products, picksContext, rulesContext, probabilities);

		// Haiku primary; Sonnet fallback only via gateway path (skipped for direct).
		const aiResult = await generateText({
			model: layoutModel(),
			output: Output.object({ schema: LayoutSchema }),
			prompt,
			providerOptions: gatewayProviderOptions(persona, categorySlug),
		});
		const layout = aiResult.output;
		const usage = aiResult.usage;
		const model = 'anthropic/claude-haiku-4.5';

		if (layout) {
			cacheLayout(brandId, persona, categorySlug, layout, ph).catch(() => {});
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
