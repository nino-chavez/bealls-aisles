import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateText, Output } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { LayoutSchema } from '$lib/schema/layout';
import { buildLayoutPrompt } from '$lib/server/layout-prompt';

const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY });

export const POST: RequestHandler = async ({ request }) => {
	const startTime = Date.now();

	try {
		const { persona, categoryName, products } = await request.json();

		if (!persona || !categoryName || !products?.length) {
			return json({ error: 'Missing required fields: persona, categoryName, products' }, { status: 400 });
		}

		const prompt = buildLayoutPrompt(persona, categoryName, products);

		const { output: layout } = await generateText({
			model: anthropic('claude-sonnet-4-20250514'), // eslint-disable-line -- direct key for local dev; gateway for production
			output: Output.object({ schema: LayoutSchema }),
			prompt,
		});

		const elapsed = Date.now() - startTime;

		return json({
			layout,
			meta: {
				persona,
				categoryName,
				productCount: products.length,
				generationTimeMs: elapsed,
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
