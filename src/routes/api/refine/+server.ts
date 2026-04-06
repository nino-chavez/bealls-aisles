import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateText, Output } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { LayoutSchema } from '$lib/schema/layout';
import { loadCategoryProducts } from '$lib/server/catalog';

const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY });

export const POST: RequestHandler = async ({ request }) => {
	const startTime = Date.now();

	try {
		const { message, currentLayout, persona, categorySlug, constraints } = await request.json();

		if (!message || !categorySlug) {
			return json({ error: 'Missing required fields: message, categorySlug' }, { status: 400 });
		}

		// Server owns data assembly
		const result = await loadCategoryProducts(categorySlug, persona);
		if (!result) {
			return json({ error: `Category "${categorySlug}" not found` }, { status: 404 });
		}

		const { products, categoryName } = result;
		const constraintHistory = (constraints || []).map((c: string) => `- ${c}`).join('\n');

		const productSummaries = products.map((p) => {
			const specs = Object.entries(p.specs || {}).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ');
			const price = p.salePrice ? `$${p.salePrice} (sale from $${p.price})` : `$${p.price}`;
			const fit = p.personaFit
				? ` | ${persona}-fit: ${(p.personaFit[persona as keyof typeof p.personaFit] * 100).toFixed(0)}%`
				: '';
			return `- ID: "${p.id}" | ${p.name} | ${price} | ${specs}${fit}`;
		}).join('\n');

		const prompt = `You are a merchandising AI for Haven, a furniture store. A shopper is refining their browse experience through conversation.

CURRENT PERSONA: ${persona}
CATEGORY: ${categoryName}

SHOPPER'S MESSAGE: "${message}"

${constraintHistory ? `ACCUMULATED CONSTRAINTS:\n${constraintHistory}\n` : ''}
AVAILABLE PRODUCTS (${products.length} items, pre-sorted by ${persona} relevance):
${productSummaries}

PREVIOUS LAYOUT:
${currentLayout ? JSON.stringify(currentLayout.sections.map((s: any) => s.component), null, 2) : 'None'}

INSTRUCTIONS:
1. Interpret the shopper's message as a constraint on the current view
2. Filter and reorder products based on ALL accumulated constraints + the new message
3. Generate a new layout that reflects the refined intent
4. In the "reasoning" field, explain what changed and why
5. If the message implies a persona shift (e.g., from browsing to buying), adjust the layout style accordingly
6. Respect persona-fit scores — high-fit products should remain prominent unless filtered out by constraints

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
