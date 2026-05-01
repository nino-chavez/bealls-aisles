import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { streamText, Output } from 'ai';
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

/**
 * POST /api/layout/stream
 *
 * Streams a layout object as SSE. Cache hits return a complete JSON
 * response immediately. Cache misses stream partial objects as sections
 * are generated, then send a final __done event with the validated layout.
 */
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

		// PRD-FND-012: empty/rescue reason discriminator (see /api/layout for rationale).
		const reasonResult = surface === 'empty' ? EmptyReason.safeParse(explicitReason) : null;
		const reason: EmptyReasonType | undefined = reasonResult?.success ? reasonResult.data : undefined;
		if (surface === 'empty' && !reason) {
			return json({ error: "Missing/invalid 'reason' for empty surface" }, { status: 400 });
		}
		const cacheSlug = surface === 'empty' ? `empty:${reason}` : categorySlug;

		// ─── Cache check — return instantly ────────────────────────
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

			return json({
				layout: cached,
				meta: { persona, categoryName: cacheSlug, productCount: 0, generationTimeMs: elapsed, cacheHit: true },
			});
		}

		// ─── Cache miss — stream via AI Gateway ───────────────────
		// Empty/rescue surfaces source from popular products (loadHomeProducts).
		const result = surface === 'empty' || categorySlug === 'home'
			? await loadHomeProducts(persona)
			: await loadCategoryProducts(categorySlug, persona);
		if (!result) {
			return json({ error: `Category "${categorySlug}" not found` }, { status: 404 });
		}

		const { products, categoryName } = result;
		const rules = await getActiveRules(persona, categorySlug);
		const rulesContext = rulesToPromptContext(rules);
		const prompt = buildLayoutPrompt(persona, categoryName, products, picksContext, rulesContext, probabilities, { surface, reason });

		const model = 'anthropic/claude-haiku-4.5';

		// Haiku primary; Sonnet fallback only via gateway path (skipped for direct).
		const stream = streamText({
			model: layoutModel(),
			output: Output.object({ schema: layoutSchema }),
			prompt,
			providerOptions: gatewayProviderOptions(persona, categorySlug),
		});

		const encoder = new TextEncoder();

		const readable = new ReadableStream({
			async start(controller) {
				try {
					for await (const partial of stream.partialOutputStream) {
						controller.enqueue(
							encoder.encode(`data: ${JSON.stringify(partial)}\n\n`)
						);
					}

					// Await final validated object and usage
					const layout = await stream.output as Layout;
					const usage = await stream.usage;
					const elapsed = Date.now() - startTime;

					if (layout) {
						cacheLayout(brandId, persona, cacheSlug, layout, ph).catch(() => {});
					}

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

					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify({
							__done: true,
							layout,
							meta: { persona, categoryName, productCount: products.length, generationTimeMs: elapsed, cacheHit: false },
						})}\n\n`)
					);

					controller.close();
				} catch (err) {
					const elapsed = Date.now() - startTime;
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify({
							__error: true,
							message: err instanceof Error ? err.message : 'Stream failed',
							generationTimeMs: elapsed,
						})}\n\n`)
					);
					controller.close();
				}
			},
		});

		return new Response(readable, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
			},
		});
	} catch (err) {
		return json(
			{ error: 'Layout generation failed', message: err instanceof Error ? err.message : 'Unknown error' },
			{ status: 500 },
		);
	}
};
