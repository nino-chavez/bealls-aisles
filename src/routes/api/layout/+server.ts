import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateText, Output } from 'ai';
import {
	getLayoutSchemaForSurface,
	inferSurfaceFromCategorySlug,
	EmptyReason,
	type Layout,
	type Surface,
	type EmptyReason as EmptyReasonType,
} from '$lib/schema/layout';
import { buildLayoutPrompt } from '$lib/server/layout-prompt';
import { loadCategoryProducts, loadHomeProducts } from '$lib/server/catalog';
import { getCachedLayout, cacheLayout, hashPicks } from '$lib/server/cache';
import { logGeneration } from '$lib/server/generation-log';
import { getActiveRules, rulesToPromptContext } from '$lib/server/rules';
import { layoutModel, gatewayProviderOptions } from '$lib/server/ai-model';
import { getBrand, getBrandMode } from '$lib/brand/config';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const startTime = Date.now();

	const sessionId = cookies.get('aisles_session') || undefined;

	try {
		const {
			persona,
			categorySlug,
			picksContext,
			probabilities,
			surface: explicitSurface,
			reason: explicitReason,
		} = await request.json();

		if (!persona || !categorySlug) {
			return json({ error: 'Missing required fields: persona, categorySlug' }, { status: 400 });
		}

		const brand = getBrand();
		const brandId = brand.id;
		const mode = getBrandMode(brand);
		// Per ADR-006: prefer explicit surface from request; fall back to category-slug inference
		const surface: Surface = explicitSurface ?? inferSurfaceFromCategorySlug(categorySlug);
		const layoutSchema = getLayoutSchemaForSurface(surface, mode);

		// PRD-FND-012: empty/rescue surfaces require a reason discriminator so
		// the AI knows whether to compose a 404, empty-cart, empty-search, or
		// empty-wishlist rescue. The cache key includes the reason so each
		// rescue variant caches independently.
		const reasonResult = surface === 'empty' ? EmptyReason.safeParse(explicitReason) : null;
		const reason: EmptyReasonType | undefined = reasonResult?.success ? reasonResult.data : undefined;
		if (surface === 'empty' && !reason) {
			return json({ error: "Missing/invalid 'reason' for empty surface (must be one of: not-found, empty-cart, empty-search, empty-wishlist)" }, { status: 400 });
		}
		const cacheSlug = surface === 'empty' ? `empty:${reason}` : categorySlug;

		// ─── Cache check ───────────────────────────────────────────
		const ph = hashPicks(picksContext);
		const cached = await getCachedLayout(brandId, persona, cacheSlug, ph);
		if (cached) {
			const elapsed = Date.now() - startTime;

			logGeneration({
				type: 'layout',
				persona,
				categorySlug: cacheSlug,
				cacheHit: true,
				generationTimeMs: elapsed,
				sessionId,
			}).catch(() => {});

			// Empty/rescue surfaces need products inline so the client-only
			// rescue component (no +page.server.ts) can render product blocks
			// without a second roundtrip. Re-load popular products on cache
			// hit — same set the cached layout was generated against.
			let cachedProducts: Awaited<ReturnType<typeof loadHomeProducts>>['products'] = [];
			if (surface === 'empty' && mode === 'storefront') {
				const popular = await loadHomeProducts(persona);
				cachedProducts = popular.products;
			}

			return json({
				layout: cached,
				products: cachedProducts,
				meta: {
					persona,
					categoryName: cacheSlug,
					productCount: cachedProducts.length,
					generationTimeMs: elapsed,
					cacheHit: true,
				},
			});
		}

		// ─── Cache miss — generate via AI Gateway ──────────────────
		// Empty/rescue surfaces source from popular products (loadHomeProducts);
		// content-mode rescues run with no products at all.
		const result = surface === 'empty' || categorySlug === 'home'
			? await loadHomeProducts(persona)
			: await loadCategoryProducts(categorySlug, persona);
		if (!result) {
			return json({ error: `Category "${categorySlug}" not found` }, { status: 404 });
		}

		const { products, categoryName } = result;
		// Fetch merchandising rules from the admin app's shared DB
		const rules = await getActiveRules(persona, categorySlug);
		const rulesContext = rulesToPromptContext(rules);

		const prompt = buildLayoutPrompt(persona, categoryName, products, picksContext, rulesContext, probabilities, { surface, reason });

		// Haiku primary; Sonnet fallback only via gateway path (skipped for direct).
		const aiResult = await generateText({
			model: layoutModel(),
			output: Output.object({ schema: layoutSchema }),
			prompt,
			providerOptions: gatewayProviderOptions(persona, categorySlug),
		});
		// `aiResult.output` is loosely typed because `getLayoutSchemaForSurface`
		// returns `ZodTypeAny` (the schema shape varies by surface). Cast to
		// the concrete `Layout` type for downstream consumers (cache, return
		// value). The runtime validation in the AI SDK enforces correctness;
		// the cast is purely a TypeScript convenience.
		const layout = aiResult.output as Layout;
		const usage = aiResult.usage;
		const model = 'anthropic/claude-haiku-4.5';

		if (layout) {
			cacheLayout(brandId, persona, cacheSlug, layout, ph).catch(() => {});
		}

		const elapsed = Date.now() - startTime;

		logGeneration({
			type: 'layout',
			persona,
			categorySlug: cacheSlug,
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
			// Inline products only for empty/rescue surfaces — see cache-hit
			// branch above for rationale. Other surfaces resolve products via
			// their own +page.server.ts.
			products: surface === 'empty' ? products : undefined,
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
