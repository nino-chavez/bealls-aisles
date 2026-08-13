import { getBrandById, getBrandMode } from './config';
import { BEALLS_COMPOSITION_POLICY, getBrandCompositionPolicy } from './composition-policy';
import {
	compileCompositionPolicy,
	type EffectiveCompositionPolicy,
	type PolicySurface,
} from '../foundation/composition-policy';
import { enumerateZoneInstances, parseZoneInstance, ZONE_IDS, ZONES, type Surface, type ZoneId, type ZoneInstanceId } from '../foundation/zones';

export const BEALLS_FAMILY_BRAND_IDS = ['bealls', 'beallsflorida', 'homecentric'] as const;
export type BeallsFamilyBrandId = (typeof BEALLS_FAMILY_BRAND_IDS)[number];

export const PARITY_VIEWPORTS = {
	mobile: { width: 390, height: 844 },
	tablet: { width: 768, height: 1024 },
	desktop: { width: 1280, height: 900 },
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
	policySurface: PolicySurface | 'brand-normalized' | 'reason-normalized' | 'server-bound' | null;
	availability: Readonly<Record<BeallsFamilyBrandId, RouteAvailability>>;
	mounted: true;
	exposure: 'shopper' | 'merchant-review-direct' | 'operator-direct' | 'development-direct' | 'api';
	shopperClaim: 'included' | 'excluded';
	methods: readonly string[];
}

const ALL_AVAILABLE = { bealls: 'available', beallsflorida: 'available', homecentric: 'available' } as const;
const STOREFRONT_ONLY = { bealls: 'available', beallsflorida: 'available', homecentric: 'not-applicable' } as const;
const INPUT_GATED = { bealls: 'input-gated', beallsflorida: 'input-gated', homecentric: 'input-gated' } as const;

/** One entry for every executable SvelteKit page, error, and API endpoint in src/routes. */
const RUNTIME_ROUTE_DEFINITIONS = [
	{ routeId: '/', path: '/', sourceFiles: ['src/routes/+page.server.ts', 'src/routes/+page.svelte'], audience: 'shopper', chrome: 'family', commerce: 'catalog', componentTree: ['brand-hero', 'named-zone-renderers', 'zone-execution-evidence'], policySurface: 'home', availability: ALL_AVAILABLE },
	{ routeId: '/account', path: '/account', sourceFiles: ['src/routes/account/+page.server.ts', 'src/routes/account/+page.svelte'], audience: 'shopper', chrome: 'family', commerce: 'catalog', componentTree: ['account-dashboard', 'persona-ranked-product-row'], policySurface: 'account', availability: STOREFRONT_ONLY },
	{ routeId: '/cart', path: '/cart', sourceFiles: ['src/routes/cart/+page.server.ts', 'src/routes/cart/+page.svelte'], audience: 'shopper', chrome: 'family', commerce: 'cart', componentTree: ['cart-scaffold', 'last-chance-upsell-row', 'empty-rescue'], policySurface: 'cart', availability: STOREFRONT_ONLY },
	{ routeId: '/category/[slug]', path: '/category/:slug', sourceFiles: ['src/routes/category/[slug]/+page.server.ts', 'src/routes/category/[slug]/+page.svelte'], audience: 'shopper', chrome: 'family', commerce: 'input-gated', componentTree: ['category-route-switch', 'storefront-persona-layout|content-category-surface', 'named-zone-renderers'], policySurface: 'brand-normalized', availability: ALL_AVAILABLE },
	{ routeId: '/checkout', path: '/checkout', sourceFiles: ['src/routes/checkout/+page.server.ts', 'src/routes/checkout/+page.svelte'], audience: 'shopper', chrome: 'family', commerce: 'checkout-handoff', componentTree: ['checkout-handoff', 'assurance-strip-checkout', 'last-chance-upsell-row'], policySurface: 'checkout', availability: STOREFRONT_ONLY },
	{ routeId: '/compare', path: '/compare', sourceFiles: ['src/routes/compare/+page.server.ts', 'src/routes/compare/+page.svelte'], audience: 'shopper', chrome: 'family', commerce: 'catalog', componentTree: ['comparison-table'], policySurface: 'compare', availability: STOREFRONT_ONLY },
	{ routeId: '/observe', path: '/observe', sourceFiles: ['src/routes/observe/+page.server.ts', 'src/routes/observe/+page.svelte'], audience: 'operator', chrome: 'none', commerce: 'none', componentTree: ['operator-access-gate', 'observability-console'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/product/[slug]', path: '/product/:slug', sourceFiles: ['src/routes/product/[slug]/+page.server.ts', 'src/routes/product/[slug]/+page.svelte'], audience: 'shopper', chrome: 'family', commerce: 'catalog', componentTree: ['pdp-fixed-scaffold', 'five-zone-renderers', 'trusted-rule-pairings'], policySurface: 'pdp', availability: STOREFRONT_ONLY },
	{ routeId: '/search', path: '/search?q=:query', sourceFiles: ['src/routes/search/+page.server.ts', 'src/routes/search/+page.svelte'], audience: 'shopper', chrome: 'family', commerce: 'catalog', componentTree: ['search-results', 'persona-rule-layout', 'fixed-empty-rescue', 'zone-execution-evidence'], policySurface: 'search', availability: STOREFRONT_ONLY },
	{ routeId: '/store-locator', path: '/store-locator', sourceFiles: ['src/routes/store-locator/+page.server.ts', 'src/routes/store-locator/+page.svelte'], audience: 'shopper', chrome: 'family', commerce: 'none', componentTree: ['store-locator-surface', 'locator.editorial-intro'], policySurface: 'locator', availability: ALL_AVAILABLE },
	{ routeId: '/style-guide', path: '/style-guide', sourceFiles: ['src/routes/style-guide/+page.server.ts', 'src/routes/style-guide/+page.svelte'], audience: 'merchant-review', chrome: 'family', commerce: 'none', componentTree: ['brand-fixtures', 'layout-renderer'], policySurface: 'style-guide', availability: ALL_AVAILABLE },
	{ routeId: '/test/cart-scaffold', path: '/test/cart-scaffold', sourceFiles: ['src/routes/test/+layout.server.ts', 'src/routes/test/cart-scaffold/+page.svelte'], audience: 'development', chrome: 'family', commerce: 'none', componentTree: ['development-access-gate', 'cart-fixtures'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/test/components', path: '/test/components', sourceFiles: ['src/routes/test/+layout.server.ts', 'src/routes/test/components/+page.svelte'], audience: 'development', chrome: 'family', commerce: 'none', componentTree: ['development-access-gate', 'component-fixtures', 'layout-renderer'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/test/p0-blocks', path: '/test/p0-blocks', sourceFiles: ['src/routes/test/+layout.server.ts', 'src/routes/test/p0-blocks/+page.svelte'], audience: 'development', chrome: 'family', commerce: 'none', componentTree: ['development-access-gate', 'p0-block-fixtures'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/test/pdp-scaffold', path: '/test/pdp-scaffold', sourceFiles: ['src/routes/test/+layout.server.ts', 'src/routes/test/pdp-scaffold/+page.svelte'], audience: 'development', chrome: 'family', commerce: 'none', componentTree: ['development-access-gate', 'pdp-fixtures'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/+error', path: '<sveltekit-error>', sourceFiles: ['src/routes/+layout.server.ts', 'src/routes/+error.svelte'], audience: 'shopper', chrome: 'family', commerce: 'none', componentTree: ['fixed-empty-rescue', 'named-zone-terminals'], policySurface: 'reason-normalized', availability: ALL_AVAILABLE },
	{ routeId: '/api/cart', path: '/api/cart', sourceFiles: ['src/routes/api/cart/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'cart', componentTree: ['cart-api'], policySurface: 'cart', availability: STOREFRONT_ONLY },
	{ routeId: '/api/email-signup', path: '/api/email-signup', sourceFiles: ['src/routes/api/email-signup/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'none', componentTree: ['email-signup-api'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/api/layout', path: '/api/layout', sourceFiles: ['src/routes/api/layout/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'input-gated', componentTree: ['signed-route-grant', 'named-zone-schema', 'decision-envelope'], policySurface: 'server-bound', availability: INPUT_GATED },
	{ routeId: '/api/layout/stream', path: '/api/layout/stream', sourceFiles: ['src/routes/api/layout/stream/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'input-gated', componentTree: ['whole-layout-publication-rejected'], policySurface: null, availability: INPUT_GATED },
	{ routeId: '/api/observe/enrichment', path: '/api/observe/enrichment', sourceFiles: ['src/routes/api/observe/enrichment/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'none', componentTree: ['observability-api'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/api/observe/inference', path: '/api/observe/inference', sourceFiles: ['src/routes/api/observe/inference/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'none', componentTree: ['observability-api'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/api/observe/logs', path: '/api/observe/logs', sourceFiles: ['src/routes/api/observe/logs/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'none', componentTree: ['observability-api'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/api/observe/session', path: '/api/observe/session', sourceFiles: ['src/routes/api/observe/session/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'none', componentTree: ['observability-api'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/api/observe/sessions', path: '/api/observe/sessions', sourceFiles: ['src/routes/api/observe/sessions/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'none', componentTree: ['observability-api'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/api/refine', path: '/api/refine', sourceFiles: ['src/routes/api/refine/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'catalog', componentTree: ['fixed-surface-rejection'], policySurface: null, availability: STOREFRONT_ONLY },
	{ routeId: '/api/session/reset', path: '/api/session/reset', sourceFiles: ['src/routes/api/session/reset/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'none', componentTree: ['session-api'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/api/signals', path: '/api/signals', sourceFiles: ['src/routes/api/signals/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'none', componentTree: ['signals-api'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/api/signals/finalize', path: '/api/signals/finalize', sourceFiles: ['src/routes/api/signals/finalize/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'none', componentTree: ['signals-api'], policySurface: null, availability: ALL_AVAILABLE },
	{ routeId: '/api/suggest', path: '/api/suggest', sourceFiles: ['src/routes/api/suggest/+server.ts'], audience: 'runtime-api', chrome: 'none', commerce: 'catalog', componentTree: ['fixed-surface-rejection'], policySurface: null, availability: STOREFRONT_ONLY },
] as const satisfies readonly Omit<RuntimeRouteContract, 'mounted' | 'exposure' | 'shopperClaim' | 'methods'>[];

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
	methods: methodsForRoute(route.routeId),
}));

function methodsForRoute(routeId: string): readonly string[] {
	if (routeId === '/api/cart') return ['GET', 'POST', 'PATCH'];
	if (routeId === '/api/session/reset' || routeId === '/api/signals/finalize') return ['GET', 'POST'];
	return [routeId.startsWith('/api/') ? (routeId === '/api/email-signup' || routeId === '/api/layout' || routeId === '/api/layout/stream' || routeId === '/api/refine' || routeId === '/api/signals' || routeId === '/api/suggest' ? 'POST' : 'GET') : 'GET'];
}

export const BEALLS_FAMILY_RUNTIME_HANDLERS = BEALLS_FAMILY_RUNTIME_ROUTES.flatMap((route) =>
	route.methods.map((method) => ({ routeId: route.routeId, method })),
);

export type ZoneMount = 'mounted' | 'not-applicable';
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

export type ShopperRouteId =
	| '/' | '/account' | '/cart' | '/category/[slug]' | '/checkout' | '/compare'
	| '/product/[slug]' | '/search' | '/store-locator' | '/+error';

export interface TrustedShopperRouteContext {
	organizationId: 'example-merchant';
	brandId: BeallsFamilyBrandId;
	routeId: ShopperRouteId;
	routePath: string;
	surface: PolicySurface;
	zoneInstanceIds: readonly ZoneInstanceId[];
}

/**
 * Model authority exists only on the exact cart and checkout page routes.
 * Global overlays retain fixed shopper behavior and never borrow a page's
 * grant to manufacture cart authority. Request JSON cannot choose a surface.
 */
export function trustedModelZoneApiContext(context: TrustedShopperRouteContext): TrustedShopperRouteContext {
	if (context.surface === 'cart' || context.surface === 'checkout') return context;
	throw new ShopperRouteContractError(`route "${context.routeId}" has no model-zone API authority`);
}

export class ShopperRouteContractError extends Error {
	constructor(message: string) {
		super(`shopper route contract: ${message}`);
		this.name = 'ShopperRouteContractError';
	}
}

/**
 * Normalize only executable shopper routes. Operator, review, development,
 * API, unknown, and unavailable brand paths have no shopper authority.
 */
export function normalizeTrustedShopperRoute(
	brandId: BeallsFamilyBrandId,
	pathname: string,
): TrustedShopperRouteContext {
	if (!BEALLS_FAMILY_BRAND_IDS.includes(brandId) || !getBrandById(brandId)) {
		throw new ShopperRouteContractError(`unknown brand "${brandId}"`);
	}
	const path = normalizeRoutePath(pathname);
	let routeId: ShopperRouteId | null = null;
	let surface: PolicySurface | null = null;

	if (path === '/') { routeId = '/'; surface = 'home'; }
	else if (path === '/account') { routeId = '/account'; surface = 'account'; }
	else if (path === '/cart') { routeId = '/cart'; surface = 'cart'; }
	else if (path === '/checkout') { routeId = '/checkout'; surface = 'checkout'; }
	else if (path === '/compare') { routeId = '/compare'; surface = 'compare'; }
	else if (path === '/search') { routeId = '/search'; surface = 'search'; }
	else if (path === '/store-locator') { routeId = '/store-locator'; surface = 'locator'; }
	else {
		const category = /^\/category\/([A-Za-z0-9][A-Za-z0-9_-]{0,127})$/.exec(path);
		const product = /^\/product\/([A-Za-z0-9][A-Za-z0-9_-]{0,127})$/.exec(path);
		if (category && Object.prototype.hasOwnProperty.call(getBrandById(brandId)!.categories, category[1])) {
			routeId = '/category/[slug]';
			surface = brandId === 'homecentric' ? 'category' : 'plp';
		} else if (product) {
			routeId = '/product/[slug]';
			surface = 'pdp';
		}
	}

	if (!routeId || !surface) throw new ShopperRouteContractError(`unknown or non-shopper route "${path}"`);
	if (!isBrandRouteAvailable(brandId, routeId)) {
		throw new ShopperRouteContractError(`route "${routeId}" is not available for "${brandId}"`);
	}
	const zoneSurface = isZoneSurface(surface) ? surface : null;
	return {
		organizationId: 'example-merchant',
		brandId,
		routeId,
		routePath: path,
		surface,
		zoneInstanceIds: zoneSurface ? enumerateZoneInstances().filter((id) => {
			const parsed = parseZoneInstance(id);
			return parsed ? ZONES[parsed.family].surface === zoneSurface : false;
		}) : [],
	};
}

/** Server-only request binding: the body cannot select a route or surface. */
export function normalizeTrustedShopperRequest(
	request: Request,
	brandId: BeallsFamilyBrandId,
): TrustedShopperRouteContext {
	const origin = request.headers.get('origin');
	const referrer = request.headers.get('referer');
	if (!origin) throw new ShopperRouteContractError('same-origin Origin is required');
	if (!referrer) throw new ShopperRouteContractError('same-origin Referer is required');
	let requestUrl: URL;
	let referrerUrl: URL;
	try {
		requestUrl = new URL(request.url);
		referrerUrl = new URL(referrer);
	} catch {
		throw new ShopperRouteContractError('invalid request URL');
	}
	if (origin !== requestUrl.origin) throw new ShopperRouteContractError('cross-origin Origin is forbidden');
	if (requestUrl.origin !== referrerUrl.origin) throw new ShopperRouteContractError('cross-origin Referer is forbidden');
	const fetchSite = request.headers.get('sec-fetch-site');
	if (fetchSite && fetchSite !== 'same-origin') throw new ShopperRouteContractError('non-same-origin Fetch Metadata is forbidden');
	if (referrerUrl.username || referrerUrl.password || referrerUrl.pathname.includes('%')) {
		throw new ShopperRouteContractError('encoded or credentialed Referer path is forbidden');
	}
	return normalizeTrustedShopperRoute(brandId, referrerUrl.pathname);
}

export function trustedErrorRouteContext(
	brandId: BeallsFamilyBrandId,
	routePath: string,
	kind: 'not-found' | 'empty',
): TrustedShopperRouteContext {
	const surface: Surface = kind === 'not-found' ? 'error-404' : 'error-empty';
	const policy = getBrandCompositionPolicy(brandId);
	if (!policy || !Object.prototype.hasOwnProperty.call(policy.surfaces, surface)) {
		throw new ShopperRouteContractError(`error surface "${surface}" is not available for "${brandId}"`);
	}
	return {
		organizationId: 'example-merchant', brandId, routeId: '/+error',
		routePath: normalizeRoutePath(routePath), surface,
		zoneInstanceIds: enumerateZoneInstances().filter((id) => {
			const parsed = parseZoneInstance(id);
			return parsed ? ZONES[parsed.family].surface === surface : false;
		}),
	};
}

function normalizeRoutePath(pathname: string): string {
	if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('//')) {
		throw new ShopperRouteContractError('invalid route path');
	}
	return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function isZoneSurface(surface: PolicySurface): surface is Surface {
	return ['home', 'plp', 'pdp', 'cart', 'checkout', 'search', 'account', 'locator', 'error-404', 'error-empty'].includes(surface);
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
			mount: !applicable ? 'not-applicable' : 'mounted',
			exposure: !applicable ? 'not-applicable' : mounted.has(zoneId) ? 'exposed' : 'hidden',
			policy: applicable ? compileBrandCompositionPolicy(brandId, surface, zoneId) : null,
		};
	});
}
