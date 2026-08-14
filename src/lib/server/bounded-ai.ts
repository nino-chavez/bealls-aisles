import { generateText, Output } from 'ai';
import { z } from 'zod';
import { getBrandById } from '../brand/config';
import type { TrustedShopperRouteContext } from '../brand/bealls-family-runtime-contract';
import { validateZoneEngineOutput } from './zone-output-runtime';
import { approvedInputHash } from './zone-decision-envelope';
import type { EngineProvenance } from '../foundation/resolve-zone';
import type { Product } from '../types';

/**
 * Shopper AI is a decision service, not a page author.
 *
 * The provider chooses from merchant-owned variants and catalog IDs. It never
 * returns HTML, CSS, URLs, prices, promotions, account state, or a whole page.
 * The materializer below turns that small decision into the existing named
 * zone schemas before the resolver can publish it.
 */

const MAX_CANDIDATES = 24;
const MAX_OUTPUT_TOKENS = 640;
const PROVIDER_TIMEOUT_MS = 4_000;

const ProductIds = z.array(z.string().trim().min(1).max(128)).max(12);
const HomeDecisionSchema = z.strictObject({
	reasonCode: z.enum(['broad-merchandising', 'seasonal-framing', 'category-discovery']),
	productOrder: z.array(z.string().trim().min(1).max(128)).max(MAX_CANDIDATES),
	zones: z.strictObject({
		'home.hero': z.strictObject({ variant: z.enum(['editorial-header', 'editorial-hero']) }).optional(),
		'home.editorial-strip': z.strictObject({ variant: z.enum(['category-tiles', 'brand-spotlight']) }).optional(),
		'home.brand-spotlight': z.strictObject({ variant: z.literal('brand-spotlight') }).optional(),
		'home.below-fold': z.strictObject({ variant: z.enum(['service-callouts', 'locator-strip']) }).optional(),
	}),
});

const PlpDecisionSchema = z.strictObject({
	reasonCode: z.enum(['category-framing', 'bounded-ranking', 'theme-discovery']),
	productOrder: z.array(z.string().trim().min(1).max(128)).max(MAX_CANDIDATES),
	zones: z.strictObject({
		'plp.banner': z.strictObject({ variant: z.enum(['category-prompt', 'store-help']) }).optional(),
		'plp.editorial-header': z.strictObject({ variant: z.enum(['shop-the-category', 'compare-options']) }).optional(),
		'plp.cluster-row': z.strictObject({
			clusterKeys: z.array(z.enum(['shop-all', 'new-arrivals', 'best-sellers'])).min(1).max(3),
		}).optional(),
		'plp.between-thirds': z.strictObject({ variant: z.literal('category-prompt') }).optional(),
	}),
});

const PdpDecisionSchema = z.strictObject({
	reasonCode: z.enum(['related-products', 'complete-the-look', 'product-story']),
	zones: z.strictObject({
		'pdp.below-description': z.strictObject({ variant: z.literal('brand-spotlight') }).optional(),
		'pdp.related': z.strictObject({ titleKey: z.enum(['you-might-like', 'similar-style']), productIds: ProductIds }).optional(),
		'pdp.cross-sell': z.strictObject({ titleKey: z.enum(['pairs-well-with', 'finish-the-look']), productIds: ProductIds }).optional(),
	}),
});

const SearchDecisionSchema = z.strictObject({
	reasonCode: z.enum(['category-rescue', 'popular-products']),
	zones: z.strictObject({
		'search.zero-results-rescue': z.strictObject({
			variant: z.enum(['category-tiles', 'popular-products']),
			productIds: ProductIds,
			categorySlugs: z.array(z.string().trim().min(1).max(128)).max(4),
		}).optional(),
	}),
});

const CartDecisionSchema = z.strictObject({
	reasonCode: z.literal('cart-pairing'),
	zones: z.strictObject({
		'cart.above-checkout-cta': z.strictObject({
			titleKey: z.enum(['complete-your-cart', 'recommended-for-you']),
			productIds: ProductIds,
		}).optional(),
	}),
});

const CheckoutDecisionSchema = z.strictObject({
	reasonCode: z.literal('checkout-assurance'),
	zones: z.strictObject({
		'checkout.assurance-strip': z.strictObject({ variant: z.enum(['first-time', 'returning']) }).optional(),
	}),
});

const DecisionSchemas = {
	home: HomeDecisionSchema,
	plp: PlpDecisionSchema,
	pdp: PdpDecisionSchema,
	search: SearchDecisionSchema,
	cart: CartDecisionSchema,
	checkout: CheckoutDecisionSchema,
} as const;

type SupportedSurface = keyof typeof DecisionSchemas;
type ProviderDecision = z.infer<(typeof DecisionSchemas)[SupportedSurface]>;

export interface BoundedAiCandidate {
	id: string;
	entityId: number;
	name: string;
	price: number;
	salePrice?: number;
	category: string;
	image?: string;
	tags?: readonly string[];
}

export interface BoundedAiInput {
	context: TrustedShopperRouteContext;
	persona?: string;
	candidates?: readonly BoundedAiCandidate[];
	categorySlug?: string;
	categoryName?: string;
	categorySlugs?: readonly string[];
	query?: string;
	returningShopper?: boolean;
	safeFallbackZones?: Record<string, unknown>;
}

export interface BoundedAiMeta {
	status: 'applied' | 'disabled' | 'unconfigured' | 'failed' | 'empty';
	provider: 'anthropic' | 'gateway' | 'none';
	modelId: string | null;
	latencyMs: number;
	callCount: number;
	maxOutputTokens: number;
	failureReason?: string;
	reasonCode?: string;
}

export interface BoundedAiResult {
	engineOutput: { zones: Record<string, unknown> };
	fallbackOutput: { zones: Record<string, unknown> };
	engineDecisionMode?: 'model';
	engineProvenance?: EngineProvenance;
	productOrder: string[];
	ai: BoundedAiMeta;
}

type ProviderCallResult =
	| { ok: true; output: ProviderDecision; latencyMs: number }
	| { ok: false; latencyMs: number; reason: string; attempted: boolean };

type BoundedAiProviderTestInput = {
	surface: string;
	prompt: string;
	persona: string;
	category: string;
};

let boundedAiProviderTestOverride: ((input: BoundedAiProviderTestInput) => Promise<unknown>) | null = null;

/** Test-only seam: it still passes through the live schema and publication gates. */
export function setBoundedAiProviderForTest(
	override: ((input: BoundedAiProviderTestInput) => Promise<unknown>) | null,
): () => void {
	const previous = boundedAiProviderTestOverride;
	boundedAiProviderTestOverride = override;
	return () => { boundedAiProviderTestOverride = previous; };
}

export async function composeBoundedZones(input: BoundedAiInput): Promise<BoundedAiResult> {
	const surface = input.context.surface as SupportedSurface;
	const candidates = normalizeCandidates(input.candidates ?? []);
	const baseMeta: BoundedAiMeta = {
		status: 'empty',
		provider: gatewayEnabled() ? 'gateway' : process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'none',
		modelId: gatewayEnabled() || Boolean(process.env.ANTHROPIC_API_KEY) ? providerModelId() : null,
		latencyMs: 0,
		callCount: 0,
		maxOutputTokens: MAX_OUTPUT_TOKENS,
	};
	const providerAvailable = isBoundedAiEnabled() || boundedAiProviderTestOverride !== null;

	if (!(surface in DecisionSchemas) || !providerAvailable || candidates.length === 0 && !['checkout'].includes(surface)) {
		return { engineOutput: { zones: {} }, fallbackOutput: { zones: input.safeFallbackZones ?? {} }, productOrder: [], ai: {
			...baseMeta,
			status: providerAvailable ? 'empty' : process.env.AISLES_BOUNDED_AI_ENABLED === '0' || process.env.AISLES_BOUNDED_AI_ENABLED === 'false' ? 'disabled' : 'unconfigured',
		} };
	}

	const schema = DecisionSchemas[surface];
	const startedAt = Date.now();
	const call = await callProvider({
		schema,
		prompt: buildPrompt(input, candidates),
		persona: input.persona ?? 'gatherer',
		category: input.categorySlug ?? surface,
		surface,
	});

	if (!call.ok) {
		return {
			engineOutput: { zones: {} },
			fallbackOutput: { zones: input.safeFallbackZones ?? {} },
			productOrder: [],
			ai: {
				...baseMeta,
				status: call.attempted ? 'failed' : 'unconfigured',
				latencyMs: call.latencyMs,
				callCount: call.attempted ? 1 : 0,
				failureReason: call.reason,
			},
		};
	}

	const decision = call.output as ProviderDecision;
	const rawZones = materializeDecision(input, candidates, decision);
	const allowedZoneIds = input.context.zoneInstanceIds;
	const candidateProductIds = candidates.flatMap((candidate) => [candidate.id, String(candidate.entityId)]);
	const candidateAssetUrls = candidates.map((candidate) => candidate.image).filter((value): value is string => Boolean(value));

	try {
		const validated = validateZoneEngineOutput({
			brandId: input.context.brandId,
			allowedZoneIds,
			zones: rawZones,
			candidateProductIds,
			candidateAssetUrls,
		});
		const inputHash = approvedInputHash({
			route: { routeId: input.context.routeId, routePath: input.context.routePath, surface, brandId: input.context.brandId },
			decision,
			candidateProductIds,
		});
		return {
			engineOutput: validated,
			fallbackOutput: { zones: input.safeFallbackZones ?? {} },
			engineDecisionMode: 'model',
			engineProvenance: { kind: 'model', approvedInputHash: inputHash, modelId: providerModelId() },
			productOrder: boundedProductOrder(decision, candidates),
			ai: {
				...baseMeta,
				status: Object.keys(validated.zones).length > 0 ? 'applied' : 'empty',
				latencyMs: Date.now() - startedAt,
				callCount: 1,
				reasonCode: decision.reasonCode,
			},
		};
	} catch (error) {
		return {
			engineOutput: { zones: {} },
			fallbackOutput: { zones: input.safeFallbackZones ?? {} },
			productOrder: [],
			ai: {
				...baseMeta,
				status: 'failed',
				latencyMs: Date.now() - startedAt,
				callCount: 1,
				failureReason: error instanceof Error ? error.message : String(error),
				reasonCode: decision.reasonCode,
			},
		};
	}
}

export function isBoundedAiEnabled(): boolean {
	if (process.env.AISLES_BOUNDED_AI_ENABLED === '0' || process.env.AISLES_BOUNDED_AI_ENABLED === 'false') return false;
	return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.ANTHROPIC_API_KEY);
}

/** Stable server-side reorder: unknown, duplicate, and omitted IDs never enter the shopper grid. */
export function reorderBoundedProducts<T extends { id: string; entityId?: number }>(products: readonly T[], order: readonly string[]): T[] {
	const byId = new Map(products.flatMap((product) => [
		[product.id, product] as const,
		...(product.entityId == null ? [] : [[String(product.entityId), product] as const]),
	]));
	const seen = new Set<string>();
	const reordered: T[] = [];
	for (const id of order) {
		const product = byId.get(id);
		if (product && !seen.has(product.id)) {
			seen.add(product.id);
			reordered.push(product);
		}
	}
	return [...reordered, ...products.filter((product) => !seen.has(product.id))];
}

async function callProvider<T extends z.ZodTypeAny>(input: {
	schema: T;
	prompt: string;
	persona: string;
	category: string;
	surface: string;
}): Promise<ProviderCallResult> {
	if (!isBoundedAiEnabled() && !boundedAiProviderTestOverride) return { ok: false, latencyMs: 0, reason: 'provider is not configured', attempted: false };
	const startedAt = Date.now();
	const controller = new AbortController();
	let rejectTimeout!: (reason?: unknown) => void;
	const timeoutPromise = new Promise<never>((_, reject) => { rejectTimeout = reject; });
	const timeout = setTimeout(() => {
		controller.abort('bounded AI timeout');
		rejectTimeout(new Error(`bounded AI timeout after ${PROVIDER_TIMEOUT_MS}ms`));
	}, PROVIDER_TIMEOUT_MS);
	try {
		const rawOutput = boundedAiProviderTestOverride
			? await Promise.race([
				boundedAiProviderTestOverride({ surface: input.surface, prompt: input.prompt, persona: input.persona, category: input.category }),
				timeoutPromise,
			])
			: (await Promise.race([generateText({
				model: (await import('./ai-model')).layoutModel(),
				output: Output.object({ schema: input.schema }),
				prompt: input.prompt,
				maxOutputTokens: MAX_OUTPUT_TOKENS,
				abortSignal: controller.signal,
				providerOptions: (await import('./ai-model')).gatewayProviderOptions(input.persona, input.category),
			}), timeoutPromise])).output;
		return { ok: true, output: input.schema.parse(rawOutput) as ProviderDecision, latencyMs: Date.now() - startedAt };
	} catch (error) {
		return {
			ok: false,
			latencyMs: Date.now() - startedAt,
			reason: error instanceof Error ? error.message : String(error),
			attempted: true,
		};
	} finally {
		clearTimeout(timeout);
	}
}

function buildPrompt(input: BoundedAiInput, candidates: readonly BoundedAiCandidate[]): string {
	const surface = input.context.surface;
	const allowedZones = input.context.zoneInstanceIds.filter((zoneId) => input.context.zoneInstanceIds.includes(zoneId));
	return [
		`You are the bounded merchandising selector for ${input.context.brandId}. Surface: ${surface}. Persona: ${input.persona ?? 'gatherer'}.`,
		`Choose only from the named zones and enum values in the response schema. The page recipe, header, chrome, commerce controls, prices, promotions, account state, cart state, checkout state, payment state, order state, and subscription state are outside your authority.`,
		`Use only exact catalog IDs from the candidate list. Do not invent IDs, copy, URLs, images, claims, or facts. Return a small decision even when the safe choice is to omit a zone.`,
		`Allowed zone instances: ${JSON.stringify(allowedZones)}. Category: ${input.categoryName ?? input.categorySlug ?? 'none'}. Query: ${input.query ?? 'none'}. Returning shopper signal: ${input.returningShopper ? 'yes' : 'no'}.`,
		JSON.stringify(candidates.slice(0, MAX_CANDIDATES).map(({ id, entityId, name, price, salePrice, category, tags }) => ({ id, entityId, name, price, salePrice: salePrice ?? null, category, tags: tags ?? [] }))),
	].join('\n');
}

function materializeDecision(input: BoundedAiInput, candidates: readonly BoundedAiCandidate[], decision: ProviderDecision): Record<string, unknown> {
	const brand = getBrandById(input.context.brandId);
	if (!brand) return {};
	const productMap = new Map(candidates.flatMap((candidate) => [
		[candidate.id, candidate] as const,
		[String(candidate.entityId), candidate] as const,
	]));
	const productRefs = (ids: readonly string[], role: 'standard' | 'featured' = 'standard', max = 8) =>
		[...new Set(ids)].slice(0, max).map((id) => productMap.get(id)).filter((candidate): candidate is BoundedAiCandidate => Boolean(candidate)).map((candidate) => ({ productId: candidate.id, role }));
	const zones: Record<string, unknown> = {};

	if (input.context.surface === 'home') {
		const home = decision as z.infer<typeof HomeDecisionSchema>;
		const hero = home.zones['home.hero'];
		if (hero?.variant === 'editorial-hero' && brand.homepage.heroImage) {
			zones['home.hero'] = { component: 'editorial-hero', props: {
				image: brand.homepage.heroImage,
				eyebrow: brand.tagline,
				headline: brand.homepage.heroHeadline,
				body: brand.homepage.heroBody,
				textPosition: 'left',
			} };
		} else if (hero) {
			zones['home.hero'] = { component: 'editorial-header', props: {
				eyebrow: brand.tagline.toUpperCase().slice(0, 60),
				headline: brand.homepage.editorialHeadline,
				body: brand.homepage.editorialBody,
			} };
		}
		const editorial = home.zones['home.editorial-strip'];
		if (editorial?.variant === 'category-tiles') {
			const categoryTiles = homeCategoryTiles(brand);
			if (categoryTiles) zones['home.editorial-strip'] = categoryTiles;
		}
		if (editorial?.variant === 'brand-spotlight' || home.zones['home.brand-spotlight']) zones['home.brand-spotlight'] = homeBrandSpotlight(brand);
		const below = home.zones['home.below-fold'];
		if (below?.variant === 'locator-strip') zones['home.below-fold'] = {
			component: 'locator-strip', props: { eyebrow: 'IN PERSON', headline: `Find a ${brand.name} store`, body: 'Pickup, returns, and in-store help are close by.', ctaLabel: 'Find a Store', ctaHref: '/store-locator' },
		};
		if (below?.variant === 'service-callouts') zones['home.below-fold'] = homeServiceCallouts(brand);
	}

	if (input.context.surface === 'plp') {
		const plp = decision as z.infer<typeof PlpDecisionSchema>;
		const categoryName = input.categoryName ?? 'this category';
		if (plp.zones['plp.banner']?.variant === 'category-prompt') zones['plp.banner'] = {
			component: 'promo-strip', props: { eyebrow: 'SHOP THE EDIT', headline: `Explore ${categoryName}`, ctaLabel: 'Browse the collection', ctaHref: `/category/${input.categorySlug ?? ''}`, urgency: 'none' },
		};
		if (plp.zones['plp.banner']?.variant === 'store-help') zones['plp.banner'] = {
			component: 'locator-strip', props: { eyebrow: 'IN PERSON', headline: `Visit a ${brand.name} store`, body: 'Pickup, returns, and in-store help are close by.', ctaLabel: 'Find a Store', ctaHref: '/store-locator' },
		};
		const header = plp.zones['plp.editorial-header'];
		if (header) zones['plp.editorial-header'] = { component: 'editorial-header', props: header.variant === 'compare-options'
			? { eyebrow: 'COMPARE YOUR OPTIONS', headline: `${categoryName}, your way`, body: 'Browse the details, compare the choices, and find the right fit.' }
			: { eyebrow: 'SHOP THE COLLECTION', headline: `More to discover in ${categoryName}`, body: 'Explore the collection at your own pace.' } };
		const cluster = plp.zones['plp.cluster-row'];
		if (cluster) zones['plp.cluster-row'] = { component: 'cluster-chip-row', props: { sectionLabel: 'explore the collection', chips: cluster.clusterKeys.map((key) => clusterChip(key, input.categorySlug ?? '')) } };
		if (plp.zones['plp.between-thirds']) zones['plp.between-thirds'] = { component: 'promo-strip', props: { eyebrow: 'KEEP EXPLORING', headline: `Find more in ${categoryName}`, urgency: 'none' } };
	}

	if (input.context.surface === 'pdp') {
		const pdp = decision as z.infer<typeof PdpDecisionSchema>;
		if (pdp.zones['pdp.below-description']) zones['pdp.below-description'] = {
			component: 'brand-spotlight', props: { brandName: brand.name, eyebrow: 'MORE TO EXPLORE', headline: `Make it yours`, body: 'Find more pieces and ideas from the Bealls collection.', image: brand.homepage.heroImage, ctaLabel: 'Shop the collection', ctaHref: `/category/${input.categorySlug ?? Object.keys(brand.categories)[0]}` },
		};
		const related = pdp.zones['pdp.related'];
		if (related) {
			const refs = productRefs(related.productIds, 'standard', 4);
			if (refs.length >= 1) zones['pdp.related'] = { component: 'product-carousel', props: { title: related.titleKey === 'similar-style' ? 'Similar styles' : 'You might also like', products: refs, showRating: true } };
		}
		const crossSell = pdp.zones['pdp.cross-sell'];
		if (crossSell) {
			const refs = productRefs(crossSell.productIds, 'standard', 6);
			if (refs.length >= 1) zones['pdp.cross-sell'] = { component: 'product-carousel', props: { title: crossSell.titleKey === 'finish-the-look' ? 'Finish the look' : 'Pairs well with', products: refs, showRating: false } };
		}
	}

	if (input.context.surface === 'search') {
		const search = decision as z.infer<typeof SearchDecisionSchema>;
		const rescue = search.zones['search.zero-results-rescue'];
		if (rescue?.variant === 'popular-products') {
			const refs = productRefs(rescue.productIds, 'standard', 6);
			if (refs.length >= 1) zones['search.zero-results-rescue'] = [{ component: 'product-carousel', props: { title: 'Popular right now', products: refs, showRating: true } }];
		} else if (rescue) {
			const tiles = rescue.categorySlugs.map((slug) => brand.categories[slug as keyof typeof brand.categories] ? { label: brand.categories[slug as keyof typeof brand.categories].displayName, image: brand.categories[slug as keyof typeof brand.categories].tileImage, href: `/category/${slug}` } : null).filter((tile): tile is { label: string; image: string; href: string } => tile !== null && Boolean(tile.image));
			if (tiles.length >= 2) zones['search.zero-results-rescue'] = [{ component: 'category-tile-grid', props: { sectionLabel: 'browse a category', columns: Math.min(tiles.length, 4) as 2 | 3 | 4, tiles } }];
		}
	}

	if (input.context.surface === 'cart') {
		const cart = decision as z.infer<typeof CartDecisionSchema>;
		const choice = cart.zones['cart.above-checkout-cta'];
		if (choice) {
			const refs = productRefs(choice.productIds, 'standard', 6);
			if (refs.length >= 1) zones['cart.above-checkout-cta'] = { component: 'last-chance-upsell-row', props: { title: choice.titleKey === 'complete-your-cart' ? 'Complete your cart' : 'Recommended for you', products: refs } };
		}
	}

	if (input.context.surface === 'checkout') {
		const checkout = decision as z.infer<typeof CheckoutDecisionSchema>;
		const choice = checkout.zones['checkout.assurance-strip'];
		if (choice) zones['checkout.assurance-strip'] = checkoutAssurance(brand, choice.variant);
	}

	return zones;
}

function normalizeCandidates(candidates: readonly BoundedAiCandidate[]): BoundedAiCandidate[] {
	const seen = new Set<string>();
	return candidates.filter((candidate) => {
		if (!candidate.id || seen.has(candidate.id)) return false;
		seen.add(candidate.id);
		return true;
	}).slice(0, MAX_CANDIDATES);
}

function boundedProductOrder(decision: ProviderDecision, candidates: readonly BoundedAiCandidate[]): string[] {
	if (!('productOrder' in decision) || !Array.isArray(decision.productOrder)) return [];
	const allowed = new Set(candidates.flatMap((candidate) => [candidate.id, String(candidate.entityId)]));
	return [...new Set(decision.productOrder)].filter((id) => allowed.has(id)).slice(0, MAX_CANDIDATES);
}

function providerModelId(): string {
	return gatewayEnabled() ? 'anthropic/claude-haiku-4.5' : 'claude-haiku-4-5-20251001';
}

function gatewayEnabled(): boolean {
	return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

function homeCategoryTiles(brand: NonNullable<ReturnType<typeof getBrandById>>) {
	const tiles = Object.entries(brand.categories).filter(([, category]) => Boolean(category.tileImage)).slice(0, 4).map(([slug, category]) => ({ label: category.displayName, image: category.tileImage as string, href: `/category/${slug}` }));
	return tiles.length >= 2 ? { component: 'category-tile-grid', props: { sectionLabel: 'Shop by category', columns: Math.min(tiles.length, 4) as 2 | 3 | 4, tiles } } : null;
}

function homeBrandSpotlight(brand: NonNullable<ReturnType<typeof getBrandById>>) {
	return { component: 'brand-spotlight', props: { brandName: brand.name, eyebrow: 'OUR COLLECTION', headline: brand.homepage.editorialHeadline, body: brand.homepage.editorialBody, image: brand.homepage.heroImage, ctaLabel: 'Shop now', ctaHref: `/category/${Object.keys(brand.categories)[0]}` } };
}

function homeServiceCallouts(brand: NonNullable<ReturnType<typeof getBrandById>>) {
	return { component: 'service-callouts-grid', props: { columns: 4, callouts: [
		{ icon: 'shipping', label: 'Free shipping', body: 'On qualifying orders' },
		{ icon: 'returns', label: 'Easy returns', body: 'In store or by mail' },
		{ icon: 'store', label: 'Find a store', body: `Visit ${brand.name} in person` },
		{ icon: 'rewards', label: 'Bealls Bucks rewards', body: 'Earn on every order' },
	] } };
}

function clusterChip(key: 'shop-all' | 'new-arrivals' | 'best-sellers', slug: string) {
	if (key === 'new-arrivals') return { label: 'New Arrivals', href: '/search?q=new' };
	if (key === 'best-sellers') return { label: 'Best Sellers', href: '/search?q=best' };
	return { label: 'Shop All', href: `/category/${slug}` };
}

function checkoutAssurance(brand: NonNullable<ReturnType<typeof getBrandById>>, variant: 'first-time' | 'returning') {
	const returning = variant === 'returning';
	return { component: 'assurance-strip-checkout', props: { variant, items: [
		{ icon: 'secure', label: 'Secure checkout', body: 'PCI-compliant payment, encrypted in transit.' },
		{ icon: 'returns', label: 'Easy returns', body: 'Return online orders for free within 60 days.' },
		{ icon: 'shipping', label: returning ? 'Ready when you are' : 'Free shipping', body: returning ? `Welcome back to ${brand.name}.` : 'Standard shipping is on us at qualifying order totals.' },
	] } };
}

export function productCandidates(products: readonly Product[]): BoundedAiCandidate[] {
	return products.map((product) => ({
		id: product.id,
		entityId: product.entityId,
		name: product.name,
		price: product.price,
		salePrice: product.salePrice,
		category: product.category,
		image: product.image,
		tags: product.tags,
	}));
}
