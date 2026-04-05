import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateText, Output } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { LayoutSchema } from '$lib/schema/layout';

const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY });

export const POST: RequestHandler = async ({ request }) => {
	const startTime = Date.now();

	try {
		const { message, currentLayout, persona, categoryName, products, constraints } = await request.json();

		if (!message || !products?.length) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		const constraintHistory = (constraints || []).map((c: string) => `- ${c}`).join('\n');

		const prompt = `You are a merchandising AI for Haven, a furniture store. A shopper is refining their browse experience through conversation.

CURRENT PERSONA: ${persona}
CATEGORY: ${categoryName}

SHOPPER'S MESSAGE: "${message}"

${constraintHistory ? `ACCUMULATED CONSTRAINTS:\n${constraintHistory}\n` : ''}
AVAILABLE PRODUCTS (${products.length} items):
${products.map((p: any) => {
	const specs = Object.entries(p.specs || {}).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ');
	const price = p.salePrice ? `$${p.salePrice} (sale from $${p.price})` : `$${p.price}`;
	return `- ID: "${p.id}" | ${p.name} | ${price} | ${specs}`;
}).join('\n')}

PREVIOUS LAYOUT:
${currentLayout ? JSON.stringify(currentLayout.sections.map((s: any) => s.component), null, 2) : 'None'}

INSTRUCTIONS:
1. Interpret the shopper's message as a constraint on the current view
2. Filter and reorder products based on ALL accumulated constraints + the new message
3. Generate a new layout that reflects the refined intent
4. In the "reasoning" field, explain what changed and why
5. If the message implies a persona shift (e.g., from browsing to buying), adjust the layout style accordingly

AVAILABLE COMPONENTS: editorial-header, hero-product, product-grid, category-header
- Use editorial-header for editorial intros
- Use hero-product to highlight one standout
- Use product-grid for the main product display (2/3/4 columns, square/landscape images, with/without quickAdd)
- Use category-header for functional headers with count/sort

Generate a refined layout.`;

		const { output: layout } = await generateText({
			model: anthropic('claude-sonnet-4-20250514'),
			output: Output.object({ schema: LayoutSchema }),
			prompt,
		});

		const elapsed = Date.now() - startTime;

		// Extract the new constraint from the message
		const newConstraint = message.trim();

		return json({
			layout,
			newConstraint,
			meta: {
				generationTimeMs: elapsed,
				persona,
				constraintCount: (constraints?.length || 0) + 1,
			},
		});
	} catch (err) {
		const elapsed = Date.now() - startTime;
		console.error('Refinement failed:', err);
		return json(
			{
				error: 'Refinement failed',
				message: err instanceof Error ? err.message : 'Unknown error',
				generationTimeMs: elapsed,
			},
			{ status: 500 }
		);
	}
};
