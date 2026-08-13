import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve, sep } from 'node:path';
import {
	BEALLS_FAMILY_BRAND_IDS,
	BEALLS_FAMILY_RUNTIME_HANDLERS,
	BEALLS_FAMILY_RUNTIME_ROUTES,
	EXTERNAL_REFERENCE_BOUNDARY,
	PARITY_VIEWPORTS,
	compileBrandCompositionPolicy,
	getRuntimeZoneContracts,
	normalizeTrustedShopperRequest,
	normalizeTrustedShopperRoute,
	trustedModelZoneApiContext,
	trustedErrorRouteContext,
	type BeallsFamilyBrandId,
	type TrustedShopperRouteContext,
} from './bealls-family-runtime-contract';
import { BEALLS_COMPOSITION_POLICY } from './composition-policy';
import { getBrandById, resolveBrandId } from './config';
import { resolveZone } from '../foundation/resolve-zone';
import { enumerateZoneInstances, parseZoneInstance, ZONE_IDS, ZONES } from '../foundation/zones';
import { RENDERABLE_ZONE_COMPONENT_IDS } from '../foundation/zone-schemas';
import { issueShopperRouteGrant, verifyShopperRouteGrant, type ShopperRouteGrantScope } from '../foundation/shopper-route-grant';
import { runtimeZoneDomAttributes, runtimeZoneViewFromEnvelope } from '../foundation/runtime-zone-envelope';
import { applyTrustedEmptyRouteState, assertCompleteRouteZoneExecution, executeRouteZones } from '../server/route-zone-runtime';
import {
	approvedInputHash,
	createZoneDecisionContext,
	createZoneDecisionEnvelope,
	revalidateCachedZoneDecision,
	zoneDecisionCacheKey,
	type ZoneDecisionContext,
} from '../server/zone-decision-envelope';
import { validateZoneEngineOutput } from '../server/zone-output-runtime';

let failures = 0;
function assert(name: string, condition: boolean, detail = ''): void {
	if (condition) console.log(`PASS  ${name}`);
	else {
		console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
		failures++;
	}
}
function rejects(name: string, action: () => unknown, expected: RegExp): void {
	try {
		action();
		assert(name, false, 'did not reject');
	} catch (error) {
		assert(name, expected.test(String(error)), String(error));
	}
}

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const routeRoot = resolve(repoRoot, 'src/routes');
const discoveredRoutes = discoverExecutableRoutes(routeRoot);
const declaredRoutes = [...BEALLS_FAMILY_RUNTIME_ROUTES].map((route) => route.routeId).sort();
const discoveredHandlers = discoverAddressableHandlers(routeRoot);

assert('all 30 executable page/error/API endpoints are inventoried', discoveredRoutes.length === 30
	&& declaredRoutes.length === 30, `${discoveredRoutes.length}/${declaredRoutes.length}`);
assert('route inventory exactly matches source', discoveredRoutes.join('\n') === declaredRoutes.join('\n'));
assert('34 page-plus-method handlers are addressable', discoveredHandlers.length === 34
	&& BEALLS_FAMILY_RUNTIME_HANDLERS.length === 34, `${discoveredHandlers.length}/${BEALLS_FAMILY_RUNTIME_HANDLERS.length}`);
assert('handler inventory exactly matches exported methods', discoveredHandlers.join('\n') === BEALLS_FAMILY_RUNTIME_HANDLERS
	.map(({ routeId, method }) => `${method} ${routeId}`).sort().join('\n'));
assert('browser parity viewports are exactly mobile, tablet, and desktop', JSON.stringify(PARITY_VIEWPORTS) === JSON.stringify({
	mobile: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 900 },
}));
assert('route IDs are unique and every route records its reader/exposure', new Set(declaredRoutes).size === declaredRoutes.length
	&& BEALLS_FAMILY_RUNTIME_ROUTES.every((route) => route.mounted && route.exposure
		&& route.shopperClaim === (route.audience === 'shopper' ? 'included' : 'excluded')));
assert('operator/review/development routes have explicit non-shopper audiences', [
	['/observe', 'operator'], ['/style-guide', 'merchant-review'],
	['/test/cart-scaffold', 'development'], ['/test/components', 'development'],
	['/test/p0-blocks', 'development'], ['/test/pdp-scaffold', 'development'],
].every(([routeId, audience]) => BEALLS_FAMILY_RUNTIME_ROUTES.find((route) => route.routeId === routeId)?.audience === audience));
assert('compare remains a shopper route linked from storefront chrome', BEALLS_FAMILY_RUNTIME_ROUTES.find((route) => route.routeId === '/compare')?.audience === 'shopper');

const expectedFamilyCounts = {
	home: 5, plp: 6, pdp: 5, cart: 3, checkout: 2,
	search: 2, account: 2, locator: 1, 'error-404': 1, 'error-empty': 1,
};
const actualFamilyCounts = Object.fromEntries(Object.keys(expectedFamilyCounts).map((surface) => [
	surface,
	ZONE_IDS.filter((zoneId) => ZONES[zoneId].surface === surface).length,
]));
assert('zone taxonomy has 28 families with the source-derived surface counts', ZONE_IDS.length === 28
	&& JSON.stringify(actualFamilyCounts) === JSON.stringify(expectedFamilyCounts));
assert('zone taxonomy expands to 36 concrete runtime instances', enumerateZoneInstances().length === 36);

const contracts = BEALLS_FAMILY_BRAND_IDS.flatMap(getRuntimeZoneContracts);
assert('all 84 brand-family policy cells are explicit', contracts.length === 84
	&& new Set(contracts.map(({ brandId, zoneId }) => `${brandId}/${zoneId}`)).size === 84);
assert('every applicable zone is mounted; declaration-only is impossible', contracts.every((record) => !record.applicable || record.mount === 'mounted'));
assert('storefront brands expose 28 families/36 instances each', (['bealls', 'beallsflorida'] as const).every((brandId) => {
	const records = getRuntimeZoneContracts(brandId);
	const applicable = new Set(records.filter((record) => record.applicable).map((record) => record.zoneId));
	return applicable.size === 28 && enumerateZoneInstances().filter((id) => applicable.has(parseZoneInstance(id)!.family)).length === 36;
}));
assert('Home Centric has 7 applicable families/12 instances and keeps category distinct from PLP', (() => {
	const records = getRuntimeZoneContracts('homecentric');
	const applicable = new Set(records.filter((record) => record.applicable).map((record) => record.zoneId));
	return applicable.size === 7
		&& enumerateZoneInstances().filter((id) => applicable.has(parseZoneInstance(id)!.family)).length === 12
		&& getBrandById('homecentric')?.mode === 'content';
})());
rejects('Home Centric cannot invent an empty-state contract without an insertion point', () =>
	trustedErrorRouteContext('homecentric', '/empty', 'empty'), /error surface "error-empty" is not available/);
assert('every applicable zone has an exact child override', contracts.every((record) => !record.applicable
	|| Object.prototype.hasOwnProperty.call(
		BEALLS_COMPOSITION_POLICY.brands[record.brandId].surfaces[record.surface]?.zoneOverrides ?? {},
		record.zoneId,
	)));
assert('runtime authority is exact: only three model families and three PDP rule families remain', (() => {
	const bealls = getRuntimeZoneContracts('bealls').filter((record) => record.applicable);
	return bealls.filter((record) => record.policy?.decisionMode === 'model').map((record) => record.zoneId).sort().join(',')
		=== ['cart.above-checkout-cta', 'checkout.assurance-strip', 'checkout.last-chance-upsell'].sort().join(',')
		&& bealls.filter((record) => record.policy?.decisionMode === 'rules').map((record) => record.zoneId).sort().join(',')
		=== ['pdp.cross-sell', 'pdp.recently-viewed', 'pdp.related'].sort().join(',')
		&& getRuntimeZoneContracts('homecentric').filter((record) => record.applicable)
			.every((record) => record.policy?.decisionMode === 'fixed');
})());
assert('external references remain uncontracted; parity claim is internal regression only', EXTERNAL_REFERENCE_BOUNDARY.state === 'uncontracted'
	&& EXTERNAL_REFERENCE_BOUNDARY.claim === 'internal-regression-parity-only'
	&& BEALLS_FAMILY_BRAND_IDS.every((brandId) => BEALLS_COMPOSITION_POLICY.brands[brandId].reference.state === 'uncontracted'));

assert('exact registered brand IDs resolve', resolveBrandId('beallsflorida').id === 'beallsflorida');
assert('missing brand configuration alone defaults to Bealls', resolveBrandId(undefined).id === 'bealls');
rejects('unknown BRAND_ID fails closed', () => resolveBrandId('unknown'), /Unknown BRAND_ID/);
rejects('prototype property cannot resolve as a brand', () => resolveBrandId('__proto__'), /Unknown BRAND_ID/);

assert('server normalizes exact storefront routes', normalizeTrustedShopperRoute('bealls', '/cart').surface === 'cart'
	&& normalizeTrustedShopperRoute('bealls', '/category/women').surface === 'plp'
	&& normalizeTrustedShopperRoute('homecentric', '/category/bedroom').surface === 'category');
for (const path of ['/observe', '/style-guide', '/test/components', '/api/layout', '/not-a-route']) {
	rejects(`non-shopper route ${path} has no decision authority`, () => normalizeTrustedShopperRoute('bealls', path), /unknown or non-shopper/);
}
rejects('Home Centric cannot select a storefront cart contract', () => normalizeTrustedShopperRoute('homecentric', '/cart'), /not available/);
rejects('unknown category slugs do not compile a policy', () => normalizeTrustedShopperRoute('bealls', '/category/not-registered'), /unknown or non-shopper/);
assert('server grants model-zone authority only to the exact cart and checkout page routes',
	trustedModelZoneApiContext(normalizeTrustedShopperRoute('bealls', '/checkout')).surface === 'checkout'
	&& trustedModelZoneApiContext(normalizeTrustedShopperRoute('bealls', '/cart')).surface === 'cart');
rejects('home/PLP/PDP grants cannot be repurposed for the global cart drawer', () => trustedModelZoneApiContext(
	normalizeTrustedShopperRoute('bealls', '/product/parity-coastal-shirt'),
), /no model-zone API authority/);
rejects('Home Centric receives no model-zone API authority', () => trustedModelZoneApiContext(
	normalizeTrustedShopperRoute('homecentric', '/'),
), /no model-zone API authority/);

const trustedRequest = new Request('https://shop.example/api/layout', {
	method: 'POST',
	headers: { origin: 'https://shop.example', referer: 'https://shop.example/cart?dev=true', 'sec-fetch-site': 'same-origin' },
});
assert('query-only Referer changes do not alter the exact route binding', normalizeTrustedShopperRequest(trustedRequest, 'bealls').routePath === '/cart');
rejects('requests without Origin/Referer binding fail closed', () => normalizeTrustedShopperRequest(new Request('https://shop.example/api/layout'), 'bealls'), /Origin is required/);
rejects('Origin alone cannot select a consuming route', () => normalizeTrustedShopperRequest(new Request('https://shop.example/api/layout', {
	headers: { origin: 'https://shop.example' },
}), 'bealls'), /Referer is required/);
rejects('cross-origin route bindings fail closed', () => normalizeTrustedShopperRequest(new Request('https://shop.example/api/layout', {
	headers: { origin: 'https://shop.example', referer: 'https://attacker.example/cart' },
}), 'bealls'), /cross-origin/);
rejects('cross-origin Origin fails even with a same-origin Referer', () => normalizeTrustedShopperRequest(new Request('https://shop.example/api/layout', {
	headers: { origin: 'https://attacker.example', referer: 'https://shop.example/cart' },
}), 'bealls'), /cross-origin Origin/);
rejects('encoded path confusion cannot normalize to a shopper route', () => normalizeTrustedShopperRequest(new Request('https://shop.example/api/layout', {
	headers: { origin: 'https://shop.example', referer: 'https://shop.example/%63art' },
}), 'bealls'), /encoded or credentialed/);

const routeGrantSecret = 'parity-route-grant-secret-00000000000000000000000000000000';
const cartGrantContext = normalizeTrustedShopperRoute('bealls', '/cart');
const checkoutGrantContext = normalizeTrustedShopperRoute('bealls', '/checkout');
const cartGrantScope = grantScope(cartGrantContext, 'session-a');
const checkoutGrantScope = grantScope(checkoutGrantContext, 'session-a');
const cartGrant = issueShopperRouteGrant(cartGrantScope, routeGrantSecret, 1_000_000);
assert('server-signed grant revalidates the page-derived consuming route', verifyShopperRouteGrant(
	cartGrant, routeGrantSecret, cartGrantScope, 1_000_100,
).routePath === '/cart');
rejects('same-origin Referer spoofing cannot retarget a signed route grant', () => verifyShopperRouteGrant(
	cartGrant, routeGrantSecret, checkoutGrantScope, 1_000_100,
), /consuming route mismatch/);
rejects('tampered signed route grant fails closed', () => verifyShopperRouteGrant(
	`${cartGrant.slice(0, -1)}x`, routeGrantSecret, cartGrantScope, 1_000_100,
), /invalid signature/);
rejects('route grant cannot replay across browser binding sessions', () => verifyShopperRouteGrant(
	cartGrant, routeGrantSecret, { ...cartGrantScope, bindingSessionId: 'session-b' }, 1_000_100,
), /consuming route mismatch/);
const floridaCartScope = grantScope(normalizeTrustedShopperRoute('beallsflorida', '/cart'), 'session-a');
rejects('route grant cannot replay across sibling brands', () => verifyShopperRouteGrant(
	cartGrant, routeGrantSecret, floridaCartScope, 1_000_100,
), /consuming route mismatch/);
rejects('expired route grants fail closed', () => verifyShopperRouteGrant(
	cartGrant, routeGrantSecret, cartGrantScope, 1_000_000 + 10 * 60 * 1_000,
), /expired or invalid lifetime/);

const modelApiSource = read('src/routes/api/layout/+server.ts');
const refineApiSource = read('src/routes/api/refine/+server.ts');
const suggestApiSource = read('src/routes/api/suggest/+server.ts');
const routeGrantServerSource = read('src/lib/server/shopper-route-grant.ts');
assert('client bodies cannot select surface or sourceSurface', !/\b(sourceSurface|surface)\s*:/.test(inputSchemaSource(modelApiSource))
	&& !/\b(sourceSurface|surface)\s*:/.test(inputSchemaSource(refineApiSource))
	&& !/\b(sourceSurface|surface)\s*:/.test(inputSchemaSource(suggestApiSource)));
assert('model-zone surface selection is independent of request body fields', !modelApiSource.includes('trustedCartChromeContext')
	&& !/cartItemEntityIds[^\n]+route\.surface/.test(modelApiSource));
assert('global cart drawer has no dead cross-route model call or engine provenance badge',
	!read('src/lib/components/CartDrawer.svelte').includes("fetch('/api/layout'")
	&& !read('src/lib/components/CartDrawer.svelte').includes('data-zone-source="engine"')
	&& !read('src/lib/components/CartDrawer.svelte').includes('DevZoneBadge'));
assert('production model APIs fail closed without a configured server signing secret',
	routeGrantServerSource.includes('if (!secret) throw new Error')
	&& routeGrantServerSource.includes('AISLES_ROUTE_BINDING_SECRET is not configured'));
assert('route grants and browser bindings are HttpOnly, same-site, and Secure outside development',
	(routeGrantServerSource.match(/httpOnly: true/g)?.length ?? 0) >= 2
	&& (routeGrantServerSource.match(/sameSite: 'strict'/g)?.length ?? 0) >= 2
	&& (routeGrantServerSource.match(/secure: !dev/g)?.length ?? 0) >= 2
	&& routeGrantServerSource.includes("path: '/api'")
	&& !listFiles(routeRoot).filter((file) => file.endsWith('.svelte')).some((file) => readFileSync(resolve(routeRoot, file), 'utf8').includes('shopper-route-grant')));
assert('cart/checkout model API publishes decision envelopes, never whole layouts', modelApiSource.includes('envelopes')
	&& !modelApiSource.includes('validateRuntimeLayout') && !modelApiSource.includes('LayoutSchema'));
assert('fixed refine/suggest surfaces return the existing static route behavior', refineApiSource.includes('zones are fixed')
	&& suggestApiSource.includes('model suggestions are not authorized'));

const homeHeroPolicy = compileBrandCompositionPolicy('bealls', 'home', 'home.hero');
const homeHeroResolution = resolveZone({
	zoneId: 'home.hero', brandId: 'bealls', routePath: '/', policy: homeHeroPolicy,
});
const baseContext = createZoneDecisionContext({
	policy: homeHeroPolicy,
	routeId: '/',
	routePath: '/',
	zoneId: 'home.hero',
	viewportClass: 'mobile',
	catalogVersion: 'catalog-v1',
	contentVersion: 'merchant-none-v1',
	syntheticProvenance: { kind: 'parity-fixture', version: 'v1' },
	approvedInputHash: approvedInputHash({ brandId: 'bealls', routePath: '/', zoneId: 'home.hero' }),
});
const envelope = createZoneDecisionEnvelope(baseContext, homeHeroResolution);
const hit = revalidateCachedZoneDecision(structuredClone(envelope), baseContext);
assert('cache hit returns stored decision and provenance unchanged', JSON.stringify(hit) === JSON.stringify(envelope));

const checkoutAssuranceContent = {
	component: 'assurance-strip-checkout',
	props: { variant: 'first-time', items: [
		{ icon: 'secure', label: 'Secure checkout', body: 'Encrypted in transit.' },
		{ icon: 'returns', label: 'Easy returns', body: 'Returns accepted within 60 days.' },
	] },
};
const checkoutAssurancePolicy = compileBrandCompositionPolicy('bealls', 'checkout', 'checkout.assurance-strip');
const checkoutAssuranceContext = createZoneDecisionContext({
	policy: checkoutAssurancePolicy, routeId: '/checkout', routePath: '/checkout', zoneId: 'checkout.assurance-strip',
	viewportClass: 'desktop', catalogVersion: 'catalog-v1', contentVersion: 'merchant-v1',
	syntheticProvenance: { kind: 'none', version: 'live-v1' }, approvedInputHash: 'b'.repeat(64),
});
const checkoutExpectation = {
	organizationId: 'example-merchant', brandId: 'bealls', routeId: '/checkout', routePath: '/checkout',
	surface: 'checkout', zoneId: 'checkout.assurance-strip', component: 'assurance-strip-checkout',
};
const adminEnvelope = createZoneDecisionEnvelope(checkoutAssuranceContext, {
	zoneId: 'checkout.assurance-strip', family: 'checkout.assurance-strip', source: 'admin', terminal: 'materialized',
	content: checkoutAssuranceContent, policyProvenance: checkoutAssurancePolicy.provenance,
	merchantAuthority: 'lock', merchantContentVersion: 'merchant-v1',
});
const fallbackEnvelope = createZoneDecisionEnvelope(checkoutAssuranceContext, {
	zoneId: 'checkout.assurance-strip', family: 'checkout.assurance-strip', source: 'fallback', terminal: 'materialized',
	content: checkoutAssuranceContent, policyProvenance: checkoutAssurancePolicy.provenance,
});
const adminView = runtimeZoneViewFromEnvelope(adminEnvelope, checkoutExpectation);
const fallbackView = runtimeZoneViewFromEnvelope(fallbackEnvelope, checkoutExpectation);
assert('shared envelope adapter preserves admin and fallback provenance in DOM markers', !!adminView && !!fallbackView
	&& runtimeZoneDomAttributes(adminView)['data-zone-source'] === 'admin'
	&& runtimeZoneDomAttributes(adminView)['data-zone-terminal'] === 'materialized-admin'
	&& runtimeZoneDomAttributes(fallbackView)['data-zone-source'] === 'fallback'
	&& runtimeZoneDomAttributes(fallbackView)['data-zone-terminal'] === 'materialized-fallback');
assert('cart and checkout render model envelopes only through the shared provenance adapter',
	read('src/routes/cart/+page.svelte').includes('RuntimeEnvelopeZone')
	&& read('src/routes/checkout/+page.svelte').includes('RuntimeEnvelopeZone')
	&& !read('src/routes/cart/+page.svelte').includes('data-zone-source="engine"')
	&& !read('src/routes/checkout/+page.svelte').includes('data-zone-source="engine"'));

const cacheDimensions: Array<[string, ZoneDecisionContext]> = [
	['organization', { ...baseContext, organizationId: 'another-org' }],
	['brand', { ...baseContext, brandId: 'beallsflorida' }],
	['route', { ...baseContext, routePath: '/cart', routeId: '/cart' }],
	['surface', { ...baseContext, surface: 'cart' }],
	['expanded zone', { ...baseContext, zoneId: 'home.featured-row.1' }],
	['organization policy version', { ...baseContext, organizationPolicyVersion: 'org-v2' }],
	['brand policy version', { ...baseContext, brandPolicyVersion: 'brand-v2' }],
	['effective policy version', { ...baseContext, effectivePolicyVersion: 'effective-v2' }],
	['autonomy preset', { ...baseContext, autonomyPreset: 'assist' }],
	['decision mode', { ...baseContext, decisionMode: 'model' }],
	['publication mode', { ...baseContext, publicationMode: 'holdout' }],
	['capabilities', { ...baseContext, capabilities: ['rank_products'] }],
	['viewport', { ...baseContext, viewportClass: 'desktop' }],
	['catalog version', { ...baseContext, catalogVersion: 'catalog-v2' }],
	['content version', { ...baseContext, contentVersion: 'merchant-v2' }],
	['synthetic provenance', { ...baseContext, syntheticProvenance: { kind: 'none', version: 'live-v1' } }],
	['approved input hash', { ...baseContext, approvedInputHash: 'f'.repeat(64) }],
];
assert('every cache authority dimension changes the key and causes a miss', cacheDimensions.every(([, changed]) =>
	zoneDecisionCacheKey(changed) !== zoneDecisionCacheKey(baseContext)
	&& revalidateCachedZoneDecision(envelope, changed) === null));
const forgedReference = {
	...envelope,
	context: { ...envelope.context, reference: { state: 'uncontracted', id: 'invented', version: 'v1' } },
};
assert('uncontracted reference id/version invention invalidates a cached envelope', revalidateCachedZoneDecision(forgedReference, baseContext) === null);

const validHero = {
	component: 'editorial-header',
	props: { eyebrow: 'VALUE', headline: 'Trusted headline', body: 'Trusted body.' },
};
rejects('cart-summary cannot render in the home hero zone', () => validateZoneEngineOutput({
	brandId: 'bealls', allowedZoneIds: ['home.hero'], candidateProductIds: [],
	zones: { 'home.hero': { component: 'cart-summary', props: {} } },
}), /content is invalid/);
rejects('unsupported expanded zone IDs are rejected', () => validateZoneEngineOutput({
	brandId: 'bealls', allowedZoneIds: ['home.hero'], candidateProductIds: [],
	zones: { 'home.featured-row.7': validHero },
}), /unsupported zone/);
rejects('extra zone props are rejected', () => validateZoneEngineOutput({
	brandId: 'bealls', allowedZoneIds: ['home.hero'], candidateProductIds: [],
	zones: { 'home.hero': { ...validHero, props: { ...validHero.props, className: 'invented' } } },
}), /content is invalid/);
rejects('shopper copy bounds are enforced', () => validateZoneEngineOutput({
	brandId: 'bealls', allowedZoneIds: ['home.hero'], candidateProductIds: [],
	zones: { 'home.hero': { ...validHero, props: { ...validHero.props, body: 'x'.repeat(421) } } },
}), /content is invalid/);
rejects('component IDs outside the renderer vocabulary are rejected', () => validateZoneEngineOutput({
	brandId: 'bealls', allowedZoneIds: ['home.hero'], candidateProductIds: [],
	zones: { 'home.hero': { component: 'runtime-widget', props: {} } },
}), /content is invalid/);

const rendererSource = read('src/lib/foundation/ZoneRenderer.svelte');
const rendererBranches = [...rendererSource.matchAll(/item\.component === '([^']+)'/g)].map((match) => match[1]).sort();
assert('schema component vocabulary and renderer dispatch are exactly closed', JSON.stringify(rendererBranches)
	=== JSON.stringify([...RENDERABLE_ZONE_COMPONENT_IDS].sort()));

const pageRuntimeFiles = [
	'src/routes/+page.server.ts', 'src/routes/account/+page.server.ts', 'src/routes/cart/+page.server.ts',
	'src/routes/category/[slug]/+page.server.ts', 'src/routes/checkout/+page.server.ts',
	'src/routes/compare/+page.server.ts', 'src/routes/product/[slug]/+page.server.ts',
	'src/routes/search/+page.server.ts', 'src/routes/store-locator/+page.server.ts',
];
assert('every shopper page server executes its named route-zone contract', pageRuntimeFiles.every((file) =>
	/executeShopperPageRoute|executeRouteZones/.test(read(file))));
assert('root layout executes 404 zones only for an unmatched route and never executes empty zones globally',
	read('src/routes/+layout.server.ts').includes("route.id === null")
	&& read('src/routes/+layout.server.ts').includes("executeTrustedErrorZones(url, 'not-found')")
	&& !read('src/routes/+layout.server.ts').includes("executeTrustedErrorZones(url, 'empty')"));
assert('successful home and account components emit only their own route execution',
	read('src/routes/+page.svelte').includes('executions={[data.zoneExecution]}')
	&& read('src/routes/account/+page.svelte').includes('executions={[data.zoneExecution]}')
	&& !read('src/routes/+page.svelte').includes('emptyZoneExecution')
	&& !read('src/routes/account/+page.svelte').includes('emptyZoneExecution'));
assert('the actual error render consumes server-authorized thrown and unmatched 404 executions',
	read('src/routes/+error.svelte').includes('thrownZoneExecution')
	&& read('src/routes/+error.svelte').includes('data.notFoundZoneExecution ?? thrownZoneExecution')
	&& read('src/lib/server/shopper-route-runtime.ts').includes('throwShopperNotFound'));
assert('empty rescue zones execute only in server-confirmed cart, checkout, and search empty states', [
	'src/routes/cart/+page.server.ts', 'src/routes/checkout/+page.server.ts', 'src/routes/search/+page.server.ts',
].every((file) => read(file).includes("executeTrustedErrorZones(url, 'empty')")));
assert('operator, merchant-review, and test audiences are mechanically gated', read('src/routes/observe/+page.server.ts').includes('requireOperatorAccess')
	&& read('src/routes/style-guide/+page.server.ts').includes('requireMerchantReviewAccess')
	&& read('src/routes/test/+layout.server.ts').includes('requireDevelopmentRoute'));
assert('all observe data APIs use the same operator gate', [
	'enrichment', 'inference', 'logs', 'session', 'sessions',
].every((name) => read(`src/routes/api/observe/${name}/+server.ts`).includes('requireOperatorAccess')));

const contexts: TrustedShopperRouteContext[] = [
	normalizeTrustedShopperRoute('bealls', '/'),
	normalizeTrustedShopperRoute('bealls', '/account'),
	normalizeTrustedShopperRoute('bealls', '/cart'),
	normalizeTrustedShopperRoute('bealls', '/category/women'),
	normalizeTrustedShopperRoute('bealls', '/checkout'),
	normalizeTrustedShopperRoute('bealls', '/compare'),
	normalizeTrustedShopperRoute('bealls', '/product/parity-shirt'),
	normalizeTrustedShopperRoute('bealls', '/search'),
	normalizeTrustedShopperRoute('bealls', '/store-locator'),
	trustedErrorRouteContext('bealls', '/missing', 'not-found'),
	trustedErrorRouteContext('bealls', '/empty', 'empty'),
	normalizeTrustedShopperRoute('beallsflorida', '/'),
	normalizeTrustedShopperRoute('homecentric', '/'),
	normalizeTrustedShopperRoute('homecentric', '/category/bedroom'),
	normalizeTrustedShopperRoute('homecentric', '/store-locator'),
	trustedErrorRouteContext('homecentric', '/missing', 'not-found'),
];
const executions = await Promise.all(contexts.map((context) => executeRouteZones({
	context,
	merchantRecords: new Map(),
})));
assert('every applicable expanded zone terminates through named route execution', executions.every((execution) => {
	assertCompleteRouteZoneExecution(execution);
	return execution.decisions.length === execution.expectedZoneIds.length
		&& execution.decisions.every((decision) => decision.terminal === 'hidden' || decision.terminal.startsWith('materialized-'));
}));
assert('no route execution publishes whole-layout content', executions.every((execution) => execution.decisions.every((decision) =>
	decision.resolution.content === null
	|| Array.isArray(decision.resolution.content)
	|| typeof (decision.resolution.content as { component?: unknown }).component === 'string')));
const successfulHomeAndAccount = executions.filter((execution) => execution.routeId === '/' || execution.routeId === '/account');
assert('successful home and account executions contain no error-zone terminal', successfulHomeAndAccount.length >= 2
	&& successfulHomeAndAccount.every((execution) => execution.surface !== 'error-404'
		&& execution.surface !== 'error-empty'
		&& execution.decisions.every((decision) => !decision.zoneId.startsWith('error-'))));
const checkoutExecution = executions.find((execution) => execution.routeId === '/checkout');
assert('empty checkout narrows every named zone to an exact route-empty Hidden terminal', !!checkoutExecution
	&& applyTrustedEmptyRouteState(checkoutExecution).decisions.every((decision) => decision.terminal === 'hidden'
		&& decision.resolution.content === null && decision.resolution.hiddenReason === 'route-empty'));

// A decision legitimately created for another route remains non-consumable on
// the current route even when both routes are valid storefront routes.
const cartPolicy = compileBrandCompositionPolicy('bealls', 'cart', 'cart.above-checkout-cta');
const cartResolution = resolveZone({
	zoneId: 'cart.above-checkout-cta', brandId: 'bealls', routePath: '/cart', policy: cartPolicy,
});
const cartContext = createZoneDecisionContext({
	policy: cartPolicy, routeId: '/cart', routePath: '/cart', zoneId: 'cart.above-checkout-cta',
	viewportClass: 'desktop', catalogVersion: 'catalog-v1', contentVersion: 'none',
	syntheticProvenance: { kind: 'parity-fixture', version: 'v1' }, approvedInputHash: 'a'.repeat(64),
});
const cartEnvelope = createZoneDecisionEnvelope(cartContext, cartResolution);
const checkoutConsumer = { ...cartContext, routeId: '/checkout', routePath: '/checkout' };
assert('a caller selecting another valid route cannot make its output consumable here', revalidateCachedZoneDecision(cartEnvelope, checkoutConsumer) === null);

if (failures) throw new Error(`${failures} runtime contract test(s) failed`);

function grantScope(context: TrustedShopperRouteContext, bindingSessionId: string): ShopperRouteGrantScope {
	const policy = compileBrandCompositionPolicy(context.brandId, context.surface);
	return {
		version: 'shopper-route-grant-v1',
		bindingSessionId,
		organizationId: policy.provenance.organizationId,
		organizationPolicyVersion: policy.provenance.organizationPolicyVersion,
		brandId: context.brandId,
		brandPolicyVersion: policy.provenance.brandPolicyVersion,
		routeId: context.routeId,
		routePath: context.routePath,
		surface: context.surface,
		effectivePolicyVersion: policy.policyVersion,
		referenceState: 'uncontracted',
		referenceId: null,
		referenceVersion: null,
		catalogAuthorityVersion: 'bealls-family-catalog-v1',
		syntheticProvenance: 'parity-fixture-v1',
	};
}

function read(path: string): string {
	return readFileSync(resolve(repoRoot, path), 'utf8');
}

function inputSchemaSource(source: string): string {
	const start = source.indexOf('const InputSchema');
	const end = source.indexOf(';', start);
	return start >= 0 && end > start ? source.slice(start, end + 1) : '';
}

function discoverExecutableRoutes(directory: string): string[] {
	return listFiles(directory).flatMap((file) => {
		if (file === '+error.svelte') return ['/+error'];
		if (file.endsWith('/+page.svelte') || file === '+page.svelte') {
			const directoryName = file === '+page.svelte' ? '' : file.slice(0, -'/+page.svelte'.length);
			return [`/${directoryName}` || '/'];
		}
		if (file.endsWith('/+server.ts')) return [`/${file.slice(0, -'/+server.ts'.length)}`];
		return [];
	}).sort();
}

function discoverAddressableHandlers(directory: string): string[] {
	const files = listFiles(directory);
	const pages = files.flatMap((file) => {
		if (file === '+error.svelte') return ['GET /+error'];
		if (file.endsWith('/+page.svelte') || file === '+page.svelte') {
			const directoryName = file === '+page.svelte' ? '' : file.slice(0, -'/+page.svelte'.length);
			return [`GET /${directoryName}`.replace(/\/$/, '/')];
		}
		return [];
	});
	const methods = files.flatMap((file) => {
		if (!file.endsWith('/+server.ts')) return [];
		const routeId = `/${file.slice(0, -'/+server.ts'.length)}`;
		return [...readFileSync(resolve(routeRoot, file), 'utf8').matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)]
			.map((match) => `${match[1]} ${routeId}`);
	});
	return [...pages, ...methods].sort();
}

function listFiles(directory: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const absolutePath = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...listFiles(absolutePath));
		else if (entry.isFile()) files.push(relative(routeRoot, absolutePath).split(sep).join('/'));
	}
	return files;
}
