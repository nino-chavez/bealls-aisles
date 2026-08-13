import { getBrandById, getBrandMode } from './config';
import { BEALLS_COMPOSITION_POLICY, getBrandCompositionPolicy } from './composition-policy';
import {
	compileCompositionPolicy,
	type EffectiveCompositionPolicy,
	type PolicySurface,
} from '../foundation/composition-policy';
import { ZONE_IDS, ZONES, type Surface, type ZoneId } from '../foundation/zones';

export const BEALLS_FAMILY_BRAND_IDS = ['bealls', 'beallsflorida', 'homecentric'] as const;
export type BeallsFamilyBrandId = (typeof BEALLS_FAMILY_BRAND_IDS)[number];

export const PARITY_VIEWPORTS = {
	desktop: { width: 1440, height: 900 },
	mobile: { width: 390, height: 844 },
} as const;
export type ParityViewport = keyof typeof PARITY_VIEWPORTS;

export const EXTERNAL_REFERENCE_BOUNDARY = {
	state: 'uncontracted',
	internalBaselineKind: 'pinned-regression-contract',
	claim: 'internal-regression-parity-only',
} as const;

export type RouteAudience = 'shopper' | 'merchant-review' | 'operator' | 'development' | 'runtime-api';
export type RouteAvailability = 'available' | 'input-gated' | 'not-applicable';

export interface RuntimeRouteContract {
	routeId: string;
	path: string;
	sourceFiles: readonly string[];
	audience: RouteAudience;
	chrome: 'family' | 'none';
	commerce: 'catalog' | 'cart' | 'checkout-handoff' | 'content' | 'none' | 'input-gated';
	componentTree: readonly string[];
	policySurface: PolicySurface | 'brand-normalized' | 'reason-normalized' | 'request-normalized' | null;
	availability: Readonly<Record<BeallsFamilyBrandId, RouteAvailability>>;
	mounted: true;
	exposure: 'shopper' | 'merchant-review-direct' | 'operator-direct' | 'development-direct' | 'api';
	shopperClaim: 'included' | 'excluded';
}

const ALL_AVAILABLE = { bealls: 'available', beallsflorida: 'available', homecentric: 'available' } as const;
const STOREFRONT_ONLY = { bealls: 'available', beallsflorida: 'available', homecentric: 'not-applicable' } as const;
const INPUT_GATED = { bealls: 'input-gated', beallsflorida: 'input-gated', homecentric: 'input-gated' } as const;

/** One entry for every executable SvelteKit page, error, and API endpoint in src/routes. */
const RUNTIME_ROUTE_DEFINITIONS = [
	{ routeId: '/', path: '/', sourceFiles: ['src/routes/+page.server.ts', 'src/routes/+page.svelte'], audience: 'shopper', chrome: 'family', commerce: 'catalog', componentTree: ['brand-hero', 'home.hero', 'layout-renderer'], policySurface: 'home', availability: ALL_AVAILABLE },
	{ routeId: '/account', path: '/account', sourceFiles: ['src/routes/account/+page.server.ts', 'src/routes/account/+page.svelte'], audience: 'shopper', chrome: 'family', commerce: 'catalog', componentTree: ['account-dashboard', 'persona-ranked-product-row'], policySurface: 'account', availability: STOREFRONT_ONLY },
	{ routeId: '/cart', path: '/cart', sourceFiles: ['src/routes/cart/+page.server.ts', 'src/routes/cart/+page.svelte'], audience: 'shopper', chrome: 'family', commerce: 'cart', componentTree: ['cart-scaffold', 'last-chance-upsell-row', 'empty-rescue'], policySurface: 'cart', availability: STOREFRONT_ONLY },
	{ routeId: '/category/[slug]', path: '/category/:slug', sourceFiles: ['src/routes/category/[slug]/+page.server.ts', 'src/routes/category/[slug]/+page.svelte'], audience: 'shopper', chrome: 'family', commerce: 'input-gated', componentTree: ['category-route-switch', 'layout-renderer|content-category-surface'], policySurface: 'brand-normalized', availability: ALL_AVAILABLE },
	{ routeId: '/checkout', path: '/checkout', sourceFiles: ['src/routes/checkout/+page.server.ts', 'src/routes/checkout/+page.svelte'], audience: 'shopper', chrome: 'family', commerce: 'checkout-handoff', componentTree: ['checkout-handoff', 'assurance-strip-checkout', 'last-chance-upsell-row'], policySurface: 'checkout', availability: STOREFRONT_ONLY },
	{ routeId: '/compare', path: '/compare', sourceFiles: ['src/routes/compare/+page.server.ts', 'src/routes/compare/+page.svelte'], audience: 'shopper', chrome: 'family', commerce: 'catalog', componentTree: ['comparison-table'], policySurface: 'compare', availability: STOREFRONT_ONLY },
	{ routeId: '/observe', path: '/observe', sourceFiles: ['src/routes/observe/+page.svelte'], audience: 'operator', chrome: 'none', commerce: 'none', componentTree: ['observability-console'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/product/[slug]', path: '/product/:slug', sourceFiles: ['src/routes/product/[slug]/+page.server.ts', 'src/routes/product/[slug]/+page.svelte'], audience: 'shopper', chrome: 'family', commerce: 'catalog', componentTree: ['pdp-fixed-scaffold', 'five-zone-renderers', 'model-pairings'], policySurface: 'pdp', availability: STOREFRONT_ONLY },
	{ routeId: '/search', path: '/search?q=:query', sourceFiles: ['src/routes/search/+page.server.ts', 'src/routes/search/+page.svelte'], audience: 'shopper', chrome: 'family', commerce: 'catalog', componentTree: ['search-results', 'persona-rule-layout', 'refinement-chat', 'empty-rescue'], policySurface: 'search', availability: STOREFRONT_ONLY },
	{ routeId: '/store-locator', path: '/store-locator', sourceFiles: ['src/routes/store-locator/+page.server.ts', 'src/routes/store-locator/+page.svelte'], audience: 'shopper', chrome: 'family', commerce: 'none', componentTree: ['store-locator-surface', 'locator.editorial-intro'], policySurface: 'locator', availability: ALL_AVAILABLE },
	{ routeId: '/style-guide', path: '/style-guide', sourceFiles: ['src/routes/style-guide/+page.server.ts', 'src/routes/style-guide/+page.svelte'], audience: 'merchant-review', chrome: 'family', commerce: 'none', componentTree: ['brand-fixtures', 'layout-renderer'], policySurface: 'style-guide', availability: ALL_AVAILABLE },
	{ routeId: '/test/cart-scaffold', path: '/test/cart-scaffold', sourceFiles: ['src/routes/test/cart-scaffold/+page.svelte'], audience: 'development', chrome: 'family', commerce: 'none', componentTree: ['cart-fixtures'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/test/components', path: '/test/components', sourceFiles: ['src/routes/test/components/+page.svelte'], audience: 'development', chrome: 'family', commerce: 'none', componentTree: ['component-fixtures', 'layout-renderer'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/test/p0-blocks', path: '/test/p0-blocks', sourceFiles: ['src/routes/test/p0-blocks/+page.svelte'], audience: 'development', chrome: 'family', commerce: 'none', componentTree: ['p0-block-fixtures'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/test/pdp-scaffold', path: '/test/pdp-scaffold', sourceFiles: ['src/routes/test/pdp-scaffold/+page.svelte'], audience: 'development', chrome: 'family', commerce: 'none', componentTree: ['pdp-fixtures'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/+error', path: '<sveltekit-error>', sourceFiles: ['src/routes/+error.svelte'], audience: 'shopper', chrome: 'family', commerce: 'none', componentTree: ['empty-rescue', 'layout-renderer'], policySurface: 'reason-normalized', availability: ALL_AVAILABLE },
	{ routeId: '/api/cart', path: '/api/cart', sourceFiles: ['src/routes/api/cart/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'cart', componentTree: ['cart-api'], policySurface: 'cart', availability: STOREFRONT_ONLY },
	{ routeId: '/api/email-signup', path: '/api/email-signup', sourceFiles: ['src/routes/api/email-signup/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'none', componentTree: ['email-signup-api'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/api/layout', path: '/api/layout', sourceFiles: ['src/routes/api/layout/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'input-gated', componentTree: ['policy-gate', 'surface-schema', 'registered-layout-vocabulary'], policySurface: 'request-normalized', availability: INPUT_GATED },
	{ routeId: '/api/layout/stream', path: '/api/layout/stream', sourceFiles: ['src/routes/api/layout/stream/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'input-gated', componentTree: ['policy-gate', 'surface-schema', 'registered-layout-vocabulary'], policySurface: 'request-normalized', availability: INPUT_GATED },
	{ routeId: '/api/observe/enrichment', path: '/api/observe/enrichment', sourceFiles: ['src/routes/api/observe/enrichment/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'none', componentTree: ['observability-api'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/api/observe/inference', path: '/api/observe/inference', sourceFiles: ['src/routes/api/observe/inference/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'none', componentTree: ['observability-api'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/api/observe/logs', path: '/api/observe/logs', sourceFiles: ['src/routes/api/observe/logs/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'none', componentTree: ['observability-api'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/api/observe/session', path: '/api/observe/session', sourceFiles: ['src/routes/api/observe/session/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'none', componentTree: ['observability-api'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/api/observe/sessions', path: '/api/observe/sessions', sourceFiles: ['src/routes/api/observe/sessions/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'none', componentTree: ['observability-api'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/api/refine', path: '/api/refine', sourceFiles: ['src/routes/api/refine/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'catalog', componentTree: ['policy-gate', 'refine-schema', 'registered-layout-vocabulary'], policySurface: 'request-normalized', availability: STOREFRONT_ONLY },
	{ routeId: '/api/session/reset', path: '/api/session/reset', sourceFiles: ['src/routes/api/session/reset/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'none', componentTree: ['session-api'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/api/signals', path: '/api/signals', sourceFiles: ['src/routes/api/signals/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'none', componentTree: ['signals-api'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/api/signals/finalize', path: '/api/signals/finalize', sourceFiles: ['src/routes/api/signals/finalize/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'none', componentTree: ['signals-api'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/api/suggest', path: '/api/suggest', sourceFiles: ['src/routes/api/suggest/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'catalog', componentTree: ['policy-gate', 'suggest-schema', 'catalog-id-resolution'], policySurface: 'request-normalized', availability: STOREFRONT_ONLY },
] as const satisfies readonly Omit<RuntimeRouteContract, 'mounted' | 'exposure' | 'shopperClaim'>[];

export const BEALLS_FAMILY_RUNTIME_ROUTES: readonly RuntimeRouteContract[] = RUNTIME_ROUTE_DEFINITIONS.map((route) => ({
	...route,
	mounted: true,
	exposure: route.audience === 'shopper'
		? 'shopper'
		: route.audience === 'merchant-review'
			? 'merchant-review-direct'
			: route.audience === 'operator'
				? 'operator-direct'
				: route.audience === 'development'
					? 'development-direct'
					: 'api',
	shopperClaim: route.audience === 'shopper' ? 'included' : 'excluded',
}));

export type ZoneMount = 'mounted' | 'declared-only' | 'not-applicable';
export type ZoneExposure = 'exposed' | 'hidden' | 'not-applicable';

const MOUNTED_STOREFRONT_ZONES = new Set<ZoneId>([
	'home.hero',
	'pdp.below-description', 'pdp.related', 'pdp.cross-sell', 'pdp.recently-viewed', 'pdp.below-recs',
	'cart.above-checkout-cta',
	'checkout.assurance-strip', 'checkout.last-chance-upsell',
	'locator.editorial-intro',
]);
const MOUNTED_CONTENT_ZONES = new Set<ZoneId>(['home.hero', 'locator.editorial-intro']);

export interface RuntimeZoneContract {
	brandId: BeallsFamilyBrandId;
	zoneId: ZoneId;
	surface: Surface;
	applicable: boolean;
	mount: ZoneMount;
	exposure: ZoneExposure;
	policy: EffectiveCompositionPolicy | null;
}

export function compileBrandCompositionPolicy(
	brandId: BeallsFamilyBrandId,
	surface: PolicySurface,
	zoneId?: ZoneId,
): EffectiveCompositionPolicy {
	return compileCompositionPolicy({
		organizationId: 'example-merchant', brandId, surface, zoneId, registry: BEALLS_COMPOSITION_POLICY,
	});
}

export function normalizeShopperRouteSurface(
	brandId: BeallsFamilyBrandId,
	routeId: string,
	options: { errorKind?: 'not-found' | 'empty'; requestSurface?: PolicySurface } = {},
): PolicySurface | null {
	if (routeId === '/category/[slug]') return brandId === 'homecentric' ? 'category' : 'plp';
	if (routeId === '/+error') return options.errorKind === 'not-found' ? 'error-404' : 'error-empty';
	if (routeId.startsWith('/api/')) return options.requestSurface ?? null;
	const route = BEALLS_FAMILY_RUNTIME_ROUTES.find((candidate) => candidate.routeId === routeId);
	return route && route.policySurface && !['brand-normalized', 'reason-normalized', 'request-normalized'].includes(route.policySurface)
		? route.policySurface as PolicySurface
		: null;
}

export function isBrandRouteAvailable(brandId: BeallsFamilyBrandId, routeId: string): boolean {
	const route = BEALLS_FAMILY_RUNTIME_ROUTES.find((candidate) => candidate.routeId === routeId);
	return !!route && route.availability[brandId] !== 'not-applicable';
}

export function assertBrandPolicySurface(brandId: string, surface: PolicySurface): EffectiveCompositionPolicy {
	if (!BEALLS_FAMILY_BRAND_IDS.includes(brandId as BeallsFamilyBrandId) || !getBrandById(brandId)) {
		throw new Error(`brand runtime contract: unknown brand "${brandId}"`);
	}
	return compileBrandCompositionPolicy(brandId as BeallsFamilyBrandId, surface);
}

export function getRuntimeZoneContracts(brandId: BeallsFamilyBrandId): RuntimeZoneContract[] {
	const brand = getBrandById(brandId);
	if (!brand) throw new Error(`brand runtime contract: unknown brand "${brandId}"`);
	const content = getBrandMode(brand) === 'content';
	const mounted = content ? MOUNTED_CONTENT_ZONES : MOUNTED_STOREFRONT_ZONES;
	const brandPolicy = getBrandCompositionPolicy(brandId);
	return ZONE_IDS.map((zoneId) => {
		const surface = ZONES[zoneId].surface;
		const applicable = !!brandPolicy?.surfaces[surface];
		return {
			brandId,
			zoneId,
			surface,
			applicable,
			mount: !applicable ? 'not-applicable' : mounted.has(zoneId) ? 'mounted' : 'declared-only',
			exposure: !applicable ? 'not-applicable' : mounted.has(zoneId) ? 'exposed' : 'hidden',
			policy: applicable ? compileBrandCompositionPolicy(brandId, surface, zoneId) : null,
		};
	});
}

export const REGISTERED_LAYOUT_COMPONENTS = {
	storefront: [
		'editorial-header', 'hero-product', 'product-grid', 'category-header', 'promo-strip',
		'category-tile-grid', 'price-rail', 'product-carousel', 'coupon-strip', 'editorial-hero',
		'bealls-bucks-callout', 'lifestyle-price-hero', 'for-you-row', 'image-gallery',
		'product-title-block', 'variant-selector', 'stock-signal', 'add-to-cart-bar',
		'description-tabs', 'reviews-summary', 'reviews-list', 'bopis-picker', 'cart-line-items',
		'cart-summary', 'free-shipping-meter', 'promo-code-entry', 'last-chance-upsell-row',
		'assurance-strip-checkout', 'event-countdown', 'brand-spotlight', 'trend-shop',
		'email-capture-inline', 'service-callouts-grid', 'locator-strip', 'bopis-strip', 'cluster-chip-row',
	],
	content: ['editorial-header', 'category-header', 'promo-strip', 'category-tile-grid', 'editorial-hero', 'bealls-bucks-callout'],
} as const;

const SURFACE_COMPONENTS: Record<'cart' | 'checkout', readonly string[]> = {
	cart: ['last-chance-upsell-row'],
	checkout: ['assurance-strip-checkout', 'last-chance-upsell-row'],
};

export function registeredComponentsForLayout(brandId: BeallsFamilyBrandId, surface: 'home' | 'plp' | 'pdp' | 'cart' | 'checkout' | 'empty'): readonly string[] {
	if (surface === 'cart' || surface === 'checkout') return brandId === 'homecentric' ? [] : SURFACE_COMPONENTS[surface];
	return brandId === 'homecentric' ? REGISTERED_LAYOUT_COMPONENTS.content : REGISTERED_LAYOUT_COMPONENTS.storefront;
}

export function buildRuntimeCacheScope(input: {
	brandId: BeallsFamilyBrandId;
	surface: PolicySurface;
	viewport: ParityViewport | 'responsive';
}): string {
	const policy = compileBrandCompositionPolicy(input.brandId, input.surface);
	return [
		policy.provenance.organizationId,
		input.brandId,
		policy.policyVersion,
		policy.provenance.referenceState,
		input.surface,
		policy.decisionMode,
		policy.publicationMode,
		policy.capabilities.join(','),
		input.viewport,
	]
		.map((part) => encodeURIComponent(part)).join(':');
}
