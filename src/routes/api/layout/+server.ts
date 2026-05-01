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
import { loadCategoryProducts, loadHomeProducts, loadProductsByTagOverlapAggregate, type EnrichedProduct, type TagOverlapProduct } from '$lib/server/catalog';
import { getCachedLayout, cacheLayout, hashPicks } from '$lib/server/cache';

// ADR-008 Phase A: tagIntents is a prompt-affecting input alongside picks.
// Phase B: cart-seed entityIds are too — the upsell's candidate pool is the
// tag-overlap neighborhood of those seeds. Compose all three into one
// discriminator so the cache key reflects every prompt-affecting input.
// A non-empty value on any axis, even with no picks, still gets a suffix.
function composeCacheDiscriminator(
	picksContext?: string,
	tagIntents: string[] = [],
	cartSeedEntityIds: number[] = [],
): string | undefined {
	const tagPart = tagIntents.length > 0
		? 'tags:' + [...tagIntents].map((t) => t.toLowerCase()).sort().join(',')
		: '';
	const seedPart = cartSeedEntityIds.length > 0
		? 'seeds:' + [...cartSeedEntityIds].sort((a, b) => a - b).join(',')
		: '';
	const combined = picksContext || tagPart || seedPart
		? `${picksContext ?? ''}|${tagPart}|${seedPart}`
		: undefined;
	return hashPicks(combined);
}
import { logGeneration } from '$lib/server/generation-log';
import { logZoneRetrieval } from '$lib/server/zone-retrieval-log';
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
			tagIntents: rawTagIntents,
			cartItemEntityIds: rawCartSeeds,
		} = await request.json();

		// Normalize tagIntents: accept undefined/null/non-array as empty.
		// Strings are deduped lowercased downstream by the loader; here we
		// just guard the shape so the cache key + prompt see a stable value.
		const tagIntents: string[] = Array.isArray(rawTagIntents)
			? rawTagIntents.filter((t): t is string => typeof t === 'string' && t.length > 0)
			: [];

		// PRD-ENG-019: cart upsell candidates come from the tag-overlap
		// neighborhood of the in-cart line items. Normalize to a numeric
		// entityId array and dedupe; non-cart surfaces leave this empty.
		const cartItemEntityIds: number[] = Array.isArray(rawCartSeeds)
			? Array.from(new Set(rawCartSeeds.filter((n: unknown): n is number => typeof n === 'number' && Number.isFinite(n))))
			: [];

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
		// `picksContext`, `tagIntents`, and `cartItemEntityIds` are all
		// prompt-affecting per-request inputs that change the generated
		// layout (cart seeds change the candidate pool for the upsell).
		// Compose them into a single cache discriminator so each combination
		// caches independently and existing picks-only callers still hash
		// to the same key.
		const ph = composeCacheDiscriminator(picksContext, tagIntents, cartItemEntityIds);
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

			// Empty/rescue + cart + checkout surfaces need products inline so
			// client-only consumers (EmptyRescue, CartDrawer, checkout handoff
			// page — no +page.server.ts in the inline-render case) can render
			// upsell/rescue product blocks without a second roundtrip. Re-load
			// the same candidate pool the cached layout was generated against.
			//
			// PRD-ENG-019: cart with seed entityIds → tag-overlap aggregate
			// (the candidate set is the *neighborhood* of the cart, not popular
			// products). Empty cart, empty/rescue, checkout → popular products.
			let cachedProducts: EnrichedProduct[] | TagOverlapProduct[] = [];
			if (surface === 'cart' && cartItemEntityIds.length > 0 && mode === 'storefront') {
				cachedProducts = await loadProductsByTagOverlapAggregate(cartItemEntityIds, { minOverlap: 2, limit: 12 });
			} else if ((surface === 'empty' || surface === 'cart' || surface === 'checkout') && mode === 'storefront') {
				const popular = await loadHomeProducts(persona, undefined, tagIntents);
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
		// Source the candidate pool. PRD-ENG-019: cart with seed entityIds
		// pulls the tag-overlap neighborhood of the line items — the AI
		// composes the upsell title and ordering from THIS pool, not
		// brand-wide popular products. Empty/rescue + checkout + empty cart
		// fall back to popular (loadHomeProducts).
		const useHomeProducts = surface === 'empty' || surface === 'cart' || surface === 'checkout' || categorySlug === 'home';
		let products: EnrichedProduct[] | TagOverlapProduct[];
		let categoryName: string;
		if (surface === 'cart' && cartItemEntityIds.length > 0 && mode === 'storefront') {
			const overlapPool = await loadProductsByTagOverlapAggregate(cartItemEntityIds, { minOverlap: 2, limit: 12 });
			products = overlapPool;
			categoryName = 'Cart';
			logZoneRetrieval({
				surface: 'cart',
				seedEntityIds: cartItemEntityIds,
				zones: {
					'cart.above-checkout-cta': overlapPool.map((p) => ({
						productId: p.id,
						entityId: p.entityId,
						overlapScore: p.overlapScore,
						sharedTags: p.sharedTags,
					})),
				},
			});
		} else {
			const result = useHomeProducts
				? await loadHomeProducts(persona, undefined, tagIntents)
				: await loadCategoryProducts(categorySlug, persona, tagIntents);
			if (!result) {
				return json({ error: `Category "${categorySlug}" not found` }, { status: 404 });
			}
			products = result.products;
			categoryName = result.categoryName;
		}
		// Fetch merchandising rules from the admin app's shared DB
		const rules = await getActiveRules(persona, categorySlug);
		const rulesContext = rulesToPromptContext(rules);

		const prompt = buildLayoutPrompt(persona, categoryName, products, picksContext, rulesContext, probabilities, { surface, reason, tagIntents });

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
			// Inline products for empty/rescue + cart + checkout surfaces — see
			// cache-hit branch above for rationale. PLP/PDP surfaces resolve
			// products via their own +page.server.ts.
			products: surface === 'empty' || surface === 'cart' || surface === 'checkout' ? products : undefined,
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
