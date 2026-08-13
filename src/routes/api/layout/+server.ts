import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { getBrand } from '$lib/brand/config';
import {
	type BeallsFamilyBrandId,
} from '$lib/brand/bealls-family-runtime-contract';
import { ZoneSchemas } from '$lib/foundation/zone-schemas';
import { projectShopperProducts } from '$lib/foundation/shopper-product';
import { loadHomeProducts, loadProductsByTagOverlapAggregate } from '$lib/server/catalog';
import { cacheZoneDecision, getCachedZoneDecision } from '$lib/server/cache';
import { shouldBypassCache } from '$lib/server/cache-flags';
import { layoutModel, gatewayProviderOptions } from '$lib/server/ai-model';
import { executeRouteZones, routeZoneDecision } from '$lib/server/route-zone-runtime';
import {
	approvedInputHash,
	catalogVersion,
	createZoneDecisionContext,
	createZoneDecisionEnvelope,
	type ZoneDecisionContext,
	type ZoneDecisionEnvelope,
} from '$lib/server/zone-decision-envelope';
import { validateZoneEngineOutput } from '$lib/server/zone-output-runtime';
import { trustedShopperApiContext } from '$lib/server/shopper-route-grant';

const InputSchema = z.strictObject({
	persona: z.enum(['gatherer', 'hunter', 'researcher', 'gifter']).default('gatherer'),
	categorySlug: z.string().trim().min(1).max(128).optional(),
	picksContext: z.string().max(4_000).optional(),
	probabilities: z.record(z.string(), z.number().min(0).max(1)).optional(),
	tagIntents: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
	cartItemEntityIds: z.array(z.number().int().positive()).max(50).optional(),
});

const MODEL_ZONE_IDS = {
	cart: ['cart.above-checkout-cta'],
	checkout: ['checkout.assurance-strip', 'checkout.last-chance-upsell'],
} as const;

const ModelOutputSchemas = {
	cart: z.strictObject({
		reasoning: z.string().trim().min(1).max(420),
		zones: z.strictObject({
			'cart.above-checkout-cta': ZoneSchemas['cart.above-checkout-cta'].optional(),
		}),
	}),
	checkout: z.strictObject({
		reasoning: z.string().trim().min(1).max(420),
		zones: z.strictObject({
			'checkout.assurance-strip': ZoneSchemas['checkout.assurance-strip'].optional(),
			'checkout.last-chance-upsell': ZoneSchemas['checkout.last-chance-upsell'].optional(),
		}),
	}),
};

/**
 * Model decisions exist only inside named, policy-authorized cart/checkout
 * zones. The server derives the API surface from a page-issued signed route
 * grant; Origin and Referer are confusion checks, not authority. Request JSON
 * cannot select a route or surface. The response contains decision envelopes,
 * never a whole layout.
 */
export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const startedAt = Date.now();
	const brand = getBrand();
	const brandId = brand.id as BeallsFamilyBrandId;
	let route;
	try {
		route = trustedShopperApiContext(request, cookies, brandId);
	} catch (cause) {
		return json({ error: cause instanceof Error ? cause.message : 'Untrusted shopper route' }, { status: 403 });
	}

	const parsedInput = InputSchema.safeParse(await request.json().catch(() => null));
	if (!parsedInput.success) return json({ error: 'Invalid zone decision input', issues: parsedInput.error.issues }, { status: 400 });
	if (route.surface !== 'cart' && route.surface !== 'checkout') {
		return json({ error: `No model-authorized named zones for ${route.routeId}` }, { status: 403 });
	}

	const targetZoneIds = MODEL_ZONE_IDS[route.surface];
	const input = parsedInput.data;
	const cartSeeds = [...new Set(input.cartItemEntityIds ?? [])];
	if (route.surface === 'cart' && cartSeeds.length === 0) {
		const fallbackExecution = await executeRouteZones({ context: route });
		return json({
			envelopes: await envelopesForExecution(fallbackExecution, targetZoneIds, request, input, [], 'none'),
			products: [],
			meta: { cacheHit: false, generationTimeMs: Date.now() - startedAt, modelCalled: false },
		});
	}

	const products = route.surface === 'cart'
		? await loadProductsByTagOverlapAggregate(cartSeeds, { minOverlap: 2, limit: 12 })
		: (await loadHomeProducts(input.persona, 16, input.tagIntents)).products;
	const shopperProducts = projectShopperProducts(products);
	const approvedHash = approvedInputHash({
		route: { routeId: route.routeId, routePath: route.routePath, surface: route.surface, brandId },
		input,
		candidateProductIds: products.map((product) => [product.id, product.entityId]),
	});
	const catalogFingerprint = catalogVersion(products.map((product) => ({
		id: product.id, entityId: product.entityId, price: product.price, salePrice: product.salePrice,
	})));
	const viewportClass = inferViewportClass(request);
	const syntheticProvenance: ZoneDecisionContext['syntheticProvenance'] = env.AISLES_PARITY_FIXTURE === 'v1'
		? { kind: 'parity-fixture', version: 'v1' }
		: { kind: 'none', version: 'live-v1' };

	// Resolve merchant authority before cache/model. A trusted pin or lock wins
	// even when a cached engine decision exists.
	const preflight = await executeRouteZones({ context: route });
	const contexts = targetZoneIds.map((zoneId) => {
		const decision = routeZoneDecision(preflight, zoneId);
		return createZoneDecisionContext({
			policy: decision.policy,
			routeId: route.routeId,
			routePath: route.routePath,
			zoneId,
			viewportClass,
			catalogVersion: catalogFingerprint,
			contentVersion: decision.resolution.merchantContentVersion ?? 'none',
			syntheticProvenance,
			approvedInputHash: approvedHash,
		});
	});
	const pinned = targetZoneIds.map((zoneId, index) => {
		const decision = routeZoneDecision(preflight, zoneId);
		return decision.resolution.merchantAuthority === 'pin' || decision.resolution.merchantAuthority === 'lock'
			? createZoneDecisionEnvelope(contexts[index], decision.resolution)
			: null;
	});

	const bypassCache = shouldBypassCache({ url, cookies });
	const cached = await Promise.all(contexts.map((context, index) =>
		pinned[index] ?? (bypassCache ? null : getCachedZoneDecision(context)),
	));
	if (cached.every((value): value is ZoneDecisionEnvelope => value !== null)) {
		return json({
			envelopes: cached,
			products: shopperProducts,
			meta: { cacheHit: !pinned.every(Boolean), generationTimeMs: Date.now() - startedAt, modelCalled: false },
		});
	}

	const remaining = cached.some((value) => value === null);
	let engineOutput: { zones: Record<string, unknown> } = { zones: {} };
	if (remaining) {
		const candidateSummary = products.map((product) => ({
			productId: product.id,
			entityId: product.entityId,
			name: product.name,
			price: product.salePrice ?? product.price,
			category: product.category,
		}));
		const prompt = buildNamedZonePrompt(route.surface, input.persona, candidateSummary);
		const generatedZones = route.surface === 'cart'
			? (await generateText({
				model: layoutModel(),
				output: Output.object({ schema: ModelOutputSchemas.cart }),
				prompt,
				providerOptions: gatewayProviderOptions(input.persona, 'cart'),
			})).output.zones
			: (await generateText({
				model: layoutModel(),
				output: Output.object({ schema: ModelOutputSchemas.checkout }),
				prompt,
				providerOptions: gatewayProviderOptions(input.persona, 'checkout'),
			})).output.zones;
		engineOutput = validateZoneEngineOutput({
			brandId,
			allowedZoneIds: targetZoneIds,
			zones: generatedZones,
			candidateProductIds: products.flatMap((product) => [String(product.id), String(product.entityId)]),
			candidateAssetUrls: products.map((product) => product.image).filter((value): value is string => !!value),
		});
	}

	const execution = await executeRouteZones({
		context: route,
		engineOutput,
		engineDecisionMode: 'model',
		engineProvenance: { kind: 'model', approvedInputHash: approvedHash, modelId: 'anthropic/claude-haiku-4.5' },
	});
	const envelopes = targetZoneIds.map((zoneId, index) => {
		if (pinned[index]) return pinned[index];
		return createZoneDecisionEnvelope(contexts[index], routeZoneDecision(execution, zoneId).resolution);
	});
	await Promise.all(envelopes.map((envelope) => cacheZoneDecision(envelope)));

	return json({
		envelopes,
		products: shopperProducts,
		meta: { cacheHit: false, generationTimeMs: Date.now() - startedAt, modelCalled: remaining },
	});
};

async function envelopesForExecution(
	execution: Awaited<ReturnType<typeof executeRouteZones>>,
	zoneIds: readonly string[],
	request: Request,
	input: z.infer<typeof InputSchema>,
	products: unknown[],
	contentVersion: string,
): Promise<ZoneDecisionEnvelope[]> {
	const hash = approvedInputHash({ routeId: execution.routeId, routePath: execution.routePath, input, products });
	return zoneIds.map((zoneId) => {
		const decision = routeZoneDecision(execution, zoneId);
		const context = createZoneDecisionContext({
			policy: decision.policy, routeId: execution.routeId, routePath: execution.routePath, zoneId,
			viewportClass: inferViewportClass(request), catalogVersion: catalogVersion(products), contentVersion,
			syntheticProvenance: env.AISLES_PARITY_FIXTURE === 'v1'
				? { kind: 'parity-fixture', version: 'v1' }
				: { kind: 'none', version: 'live-v1' },
			approvedInputHash: hash,
		});
		return createZoneDecisionEnvelope(context, decision.resolution);
	});
}

function inferViewportClass(request: Request): ZoneDecisionContext['viewportClass'] {
	const width = Number(request.headers.get('sec-ch-viewport-width'));
	if (Number.isFinite(width) && width > 0) return width < 600 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
	const ua = request.headers.get('user-agent') ?? '';
	if (/iPad|Tablet/i.test(ua)) return 'tablet';
	return /Mobile|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';
}

function buildNamedZonePrompt(
	surface: 'cart' | 'checkout',
	persona: string,
	products: Array<{ productId: string; entityId: number; name: string; price: number; category: string }>,
): string {
	const contract = surface === 'cart'
		? 'You may emit only cart.above-checkout-cta as last-chance-upsell-row.'
		: 'You may emit only checkout.assurance-strip as assurance-strip-checkout and checkout.last-chance-upsell as last-chance-upsell-row.';
	return `Compose named ${surface} insertion zones for persona ${persona}. ${contract}\n` +
		`Use only exact productId values below. Keep copy concise and factual. Do not emit CSS, HTML, URLs, components, or zone IDs outside the schema.\n` +
		JSON.stringify(products);
}
