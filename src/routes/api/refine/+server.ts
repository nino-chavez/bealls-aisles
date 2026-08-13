import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateText, Output, gateway } from 'ai';
import { RefineResponseSchema } from '$lib/schema/refine';
import { loadCategoryProducts, CATEGORY_MAP } from '$lib/server/catalog';
import { logGeneration } from '$lib/server/generation-log';
import { getBrand } from '$lib/brand/config';
import { getActiveRules, rulesToPromptContext } from '$lib/server/rules';
import { getBrandTagVocabulary } from '$lib/server/enrichment/query';
import { filterToVocabulary, formatTagVocabularyForPrompt } from '$lib/server/tag-intent';
import { compileBrandCompositionPolicy, type BeallsFamilyBrandId } from '$lib/brand/bealls-family-runtime-contract';
import { validateRuntimeLayout } from '$lib/server/layout-runtime-contract';
import { z } from 'zod';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const startTime = Date.now();
	const sessionId = cookies.get('aisles_session') || undefined;

	try {
		const { message, currentLayout, persona, categorySlug, constraints, sourceSurface: rawSourceSurface } = await request.json();

		if (!message || !categorySlug) {
			return json({ error: 'Missing required fields: message, categorySlug' }, { status: 400 });
		}
		const sourceSurfaceResult = z.enum(['plp', 'search']).safeParse(rawSourceSurface ?? 'plp');
		if (!sourceSurfaceResult.success) return json({ error: 'Invalid refinement surface' }, { status: 400 });
		const brand = getBrand();
		let policy;
		try {
			policy = compileBrandCompositionPolicy(brand.id as BeallsFamilyBrandId, sourceSurfaceResult.data);
		} catch {
			return json({ error: 'Refinement is not authorized for this brand surface' }, { status: 403 });
		}
		if (policy.decisionMode !== 'model' || policy.publicationMode !== 'live') {
			return json({ error: 'Refinement is not authorized for publication' }, { status: 403 });
		}

		// Server owns data assembly — check for cross-category intent
		const result = await loadCategoryProducts(categorySlug, persona);
		if (!result) {
			return json({ error: `Category "${categorySlug}" not found` }, { status: 404 });
		}

		let { products, categoryName } = result;
		let crossCategoryName: string | null = null;

		// Detect cross-category intent by checking if the message mentions another category
		const msgLower = message.toLowerCase();
		const otherCategories = Object.entries(CATEGORY_MAP).filter(([slug]) => slug !== categorySlug);
		for (const [slug, config] of otherCategories) {
			const displayLower = config.displayName.toLowerCase();
			if (msgLower.includes(displayLower) || msgLower.includes(slug.replace('-', ' '))) {
				const crossResult = await loadCategoryProducts(slug, persona);
				if (crossResult) {
					crossCategoryName = crossResult.categoryName;
					products = [...products, ...crossResult.products.map((p) => ({ ...p, category: crossResult.categoryName }))];
				}
				break;
			}
		}

		const constraintHistory = (constraints || []).map((c: string) => `- ${c}`).join('\n');

		const productSummaries = products.map((p) => {
			const specs = Object.entries(p.specs || {}).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ');
			const price = p.salePrice ? `$${p.salePrice} (sale from $${p.price})` : `$${p.price}`;
			const fit = p.personaFit
				? ` | ${persona}-fit: ${(p.personaFit[persona as keyof typeof p.personaFit] * 100).toFixed(0)}%`
				: '';
			return `- ID: "${p.id}" | ${p.name} | ${price} | ${specs}${fit}`;
		}).join('\n');

		const rules = await getActiveRules(persona, categorySlug);
		const rulesContext = rulesToPromptContext(rules);
		const availableCategories = Object.values(brand.categories).map((c) => c.displayName).join(', ');

		// ADR-008 Phase A: load brand tag vocabulary once per request and surface
		// it to the prompt. The AI returns tagIntents from this set only; we
		// post-validate after the call to defend against hallucinated tags.
		const tagVocabulary = await getBrandTagVocabulary(brand.id);
		const tagVocabularyContext = formatTagVocabularyForPrompt(tagVocabulary);

		const prompt = `You are a merchandising AI for ${brand.prompt.storeName}, ${brand.prompt.storeDescription}. A shopper is refining their browse experience through conversation.
${rulesContext}

VOICE: ${brand.prompt.voiceGuidance}

CURRENT PERSONA: ${persona}
CATEGORY: ${categoryName}
${crossCategoryName ? `CROSS-CATEGORY: Products from "${crossCategoryName}" have been included because the shopper mentioned it.` : ''}
AVAILABLE CATEGORIES IN THIS STORE: ${availableCategories}

SHOPPER'S MESSAGE: "${message}"

${constraintHistory ? `ACCUMULATED CONSTRAINTS:\n${constraintHistory}\n` : ''}
AVAILABLE PRODUCTS (${products.length} items, pre-sorted by ${persona} relevance):
${productSummaries}
${tagVocabularyContext}
PREVIOUS LAYOUT:
${currentLayout ? JSON.stringify(currentLayout.sections.map((s: any) => s.component), null, 2) : 'None'}

INSTRUCTIONS:
1. Extract a constraint from the shopper's message (e.g., "under $500", "wireless only", "for camping")
2. Apply ALL accumulated constraints + the new one to filter and reorder products
3. Generate a new layout reflecting the refined intent
4. Extract tagIntents per the TAG INTENT EXTRACTION RULES above (vocabulary-constrained subset)

CONSTRAINT NEGOTIATION:
- If the new constraint conflicts with existing ones (e.g., "leather" + "under $100" with no matches), set constraintConflict=true
- When conflicting: relax the LEAST important constraint, explain in chatResponse what you did ("No leather options under $100 — showing faux leather alternatives instead")
- When no products match at all: suggest removing a constraint or broadening the search
- Never return an empty layout — always show the closest matches with an explanation

RESPONSE STYLE:
- chatResponse should be 1-2 sentences, natural, helpful
- Good: "Narrowed to 4 compact options. The Ranger is the smallest at 15 inches."
- Good: "No ANC headphones under $50 in this category — showing the closest options starting at $69."
- Bad: "Done — showing 4 pieces that match." (too robotic)
- Bad: "I've curated a selection of items matching your criteria." (too formal)

AVAILABLE COMPONENTS: editorial-header, hero-product, product-grid, category-header

Generate a refined layout with a conversational response.`;

		// Haiku primary, Sonnet fallback — handled by AI Gateway
		const aiResult = await generateText({
			model: gateway('anthropic/claude-haiku-4.5'),
			output: Output.object({ schema: RefineResponseSchema }),
			prompt,
			providerOptions: {
				gateway: {
					models: ['anthropic/claude-sonnet-4.6'],
					tags: ['feature:refine', `persona:${persona}`, `category:${categorySlug}`],
				},
			},
		});
		const output = aiResult.output;
		const validatedLayout = validateRuntimeLayout({
			brandId: brand.id as BeallsFamilyBrandId,
			surface: 'plp',
			layout: output?.layout,
			candidateProductIds: products.flatMap((product) => [String(product.id), String(product.entityId)]),
			candidateAssetUrls: products.map((product) => product.image).filter((value): value is string => !!value),
		});
		const usage = aiResult.usage;
		const model = 'anthropic/claude-haiku-4.5';

		const elapsed = Date.now() - startTime;

		logGeneration({
			type: 'refine',
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

		// ADR-008 Phase A: vocabulary-constrain the AI's tag extraction. Even
		// with the prompt rule, an LLM may emit tags outside the brand set —
		// drop those silently rather than fail. Empty result is the documented
		// fallback (Q-012): persona-only ranking continues.
		const tagIntents = filterToVocabulary(output?.tagIntents, tagVocabulary);

		return json({
			layout: validatedLayout,
			chatResponse: output?.chatResponse || 'Layout updated.',
			newConstraint: output?.constraintApplied || message.trim(),
			constraintConflict: output?.constraintConflict || false,
			tagIntents,
			// `personaUpdate` echoes the persona vector that drove this turn so
			// the client can pass both `persona` and `tagIntents` back to
			// /api/layout for the next recompose. The actual persona inference
			// continues to run via the signal store; this field is the
			// effective vector for this turn (ADR-008 Phase A leaves persona
			// inference unchanged — refinement chat contributes only via the
			// existing `refinement-chat-engaged` signal rule).
			personaUpdate: { primary: persona },
			meta: {
				generationTimeMs: elapsed,
				persona,
				constraintCount: (constraints?.length || 0) + 1,
				tagIntentCount: tagIntents.length,
				tagVocabularySize: tagVocabulary.length,
				contract: policy.provenance,
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
