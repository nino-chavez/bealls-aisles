import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve, sep } from 'node:path';
import {
	BEALLS_FAMILY_BRAND_IDS,
	BEALLS_FAMILY_RUNTIME_ROUTES,
	EXTERNAL_REFERENCE_BOUNDARY,
	PARITY_VIEWPORTS,
	buildRuntimeCacheScope,
	compileBrandCompositionPolicy,
	getRuntimeZoneContracts,
	isBrandRouteAvailable,
	normalizeShopperRouteSurface,
} from './bealls-family-runtime-contract';
import { BEALLS_COMPOSITION_POLICY } from './composition-policy';
import { ZONE_IDS, ZONES } from '../foundation/zones';
import { resolveZone } from '../foundation/resolve-zone';
import { requireModelLayoutPolicy, validateRuntimeLayout } from '../server/layout-runtime-contract';

let failures = 0;
function assert(name: string, condition: boolean, detail = ''): void {
	if (condition) console.log(`PASS  ${name}`);
	else { console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); failures++; }
}
function rejects(name: string, action: () => unknown, expected: RegExp): void {
	try { action(); assert(name, false, 'did not reject'); }
	catch (error) { assert(name, expected.test(String(error)), String(error)); }
}

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const discoveredRoutes = discoverExecutableRoutes(resolve(repoRoot, 'src/routes'));
const declaredRoutes = [...BEALLS_FAMILY_RUNTIME_ROUTES].map((route) => route.routeId).sort();

assert('all 30 executable route endpoints are inventoried', discoveredRoutes.length === 30 && declaredRoutes.length === 30);
assert('route inventory exactly matches source', discoveredRoutes.join('\n') === declaredRoutes.join('\n'), `\nsource=${discoveredRoutes.join(',')}\ncontract=${declaredRoutes.join(',')}`);
assert('route IDs are unique', new Set(declaredRoutes).size === declaredRoutes.length);
assert('route regression matrix covers all 180 brand-route-viewport cells', BEALLS_FAMILY_RUNTIME_ROUTES.length
	* BEALLS_FAMILY_BRAND_IDS.length * Object.keys(PARITY_VIEWPORTS).length === 180);
assert('every route records chrome, commerce metadata, and a component tree', BEALLS_FAMILY_RUNTIME_ROUTES.every((route) => route.chrome
	&& route.commerce && route.componentTree.length > 0));
assert('every route states mount, exposure, and shopper-claim applicability', BEALLS_FAMILY_RUNTIME_ROUTES.every((route) => route.mounted
	&& route.exposure && (route.shopperClaim === (route.audience === 'shopper' ? 'included' : 'excluded'))));
assert('non-shopper routes carry explicit audiences', [
	['/observe', 'operator'], ['/style-guide', 'merchant-review'],
	['/test/cart-scaffold', 'development'], ['/test/components', 'development'],
	['/test/p0-blocks', 'development'], ['/test/pdp-scaffold', 'development'],
].every(([routeId, audience]) => BEALLS_FAMILY_RUNTIME_ROUTES.find((route) => route.routeId === routeId)?.audience === audience));
assert('compare is an explicit storefront shopper utility', BEALLS_FAMILY_RUNTIME_ROUTES.find((route) => route.routeId === '/compare')?.audience === 'shopper'
	&& isBrandRouteAvailable('bealls', '/compare') && !isBrandRouteAvailable('homecentric', '/compare'));

const expectedZoneCounts = { home: 5, plp: 6, pdp: 5, cart: 3, checkout: 2, search: 2, account: 2, locator: 1, 'error-404': 1, 'error-empty': 1 };
const actualZoneCounts = Object.fromEntries(Object.keys(expectedZoneCounts).map((surface) => [surface, ZONE_IDS.filter((zoneId) => ZONES[zoneId].surface === surface).length]));
assert('zone catalog contains the re-derived 28 zone IDs', ZONE_IDS.length === 28);
assert('zone counts match every declared surface', JSON.stringify(actualZoneCounts) === JSON.stringify(expectedZoneCounts));

const zoneContracts = BEALLS_FAMILY_BRAND_IDS.flatMap(getRuntimeZoneContracts);
assert('three distinct brand contracts cover all 84 brand-zone pairs', zoneContracts.length === 84
	&& new Set(zoneContracts.map(({ brandId, zoneId }) => `${brandId}/${zoneId}`)).size === 84);
assert('desktop/mobile parity matrix covers all 168 brand-zone-viewport pairs', zoneContracts.length * Object.keys(PARITY_VIEWPORTS).length === 168);
assert('storefront brands mount ten current zones and leave the other eighteen explicit', (['bealls', 'beallsflorida'] as const).every((brandId) => {
	const records = getRuntimeZoneContracts(brandId);
	return records.filter((record) => record.mount === 'mounted').length === 10
		&& records.filter((record) => record.mount === 'declared-only').length === 18;
}));
assert('Home Centric has eight applicable zones, two mounted and twenty not applicable', (() => {
	const records = getRuntimeZoneContracts('homecentric');
	return records.filter((record) => record.applicable).length === 8
		&& records.filter((record) => record.mount === 'mounted').length === 2
		&& records.filter((record) => record.mount === 'not-applicable').length === 20;
})());
assert('every applicable named zone has an explicit child policy override', zoneContracts.every((record) => !record.applicable
	|| Object.prototype.hasOwnProperty.call(BEALLS_COMPOSITION_POLICY.brands[record.brandId].surfaces[record.surface]?.zoneOverrides ?? {}, record.zoneId)));

assert('category normalization keeps Home Centric category distinct from storefront PLP', normalizeShopperRouteSurface('homecentric', '/category/[slug]') === 'category'
	&& normalizeShopperRouteSurface('bealls', '/category/[slug]') === 'plp');
assert('error normalization distinguishes not-found from other empty states', normalizeShopperRouteSurface('bealls', '/+error', { errorKind: 'not-found' }) === 'error-404'
	&& normalizeShopperRouteSurface('bealls', '/+error', { errorKind: 'empty' }) === 'error-empty');
assert('search and account are real storefront policies and fail closed for Home Centric', ['search', 'account'].every((surface) => {
	const beallsPolicy = compileBrandCompositionPolicy('bealls', surface as 'search' | 'account');
	return beallsPolicy.publicationMode === 'live';
}) && !isBrandRouteAvailable('homecentric', '/search') && !isBrandRouteAvailable('homecentric', '/account'));
rejects('PDP suggestion authority does not authorize free-form PDP layout generation', () => requireModelLayoutPolicy({
	brandId: 'bealls', surface: 'pdp',
}), /capabilities do not authorize/);
assert('external reference state remains uncontracted and claims regression parity only', EXTERNAL_REFERENCE_BOUNDARY.state === 'uncontracted'
	&& EXTERNAL_REFERENCE_BOUNDARY.claim === 'internal-regression-parity-only'
	&& BEALLS_FAMILY_BRAND_IDS.every((brandId) => BEALLS_COMPOSITION_POLICY.brands[brandId].reference.state === 'uncontracted'));

const cacheScopes = new Set([
	buildRuntimeCacheScope({ brandId: 'bealls', surface: 'home', viewport: 'desktop' }),
	buildRuntimeCacheScope({ brandId: 'bealls', surface: 'home', viewport: 'mobile' }),
	buildRuntimeCacheScope({ brandId: 'bealls', surface: 'plp', viewport: 'desktop' }),
	buildRuntimeCacheScope({ brandId: 'beallsflorida', surface: 'home', viewport: 'desktop' }),
	buildRuntimeCacheScope({ brandId: 'homecentric', surface: 'home', viewport: 'desktop' }),
]);
assert('cache provenance isolates viewport, surface, and sibling brands', cacheScopes.size === 5);

const fixedHeroPolicy = compileBrandCompositionPolicy('bealls', 'home', 'home.hero');
const engineHero = resolveZone({
	zoneId: 'home.hero', brandId: 'bealls', policy: fixedHeroPolicy, engineDecisionMode: 'model',
	engineCapabilities: ['generate_bounded_copy'],
	engineOutput: { zones: { 'home.hero': { component: 'editorial-header', props: { eyebrow: 'MODEL', headline: 'Invented', body: 'Invented' } } } },
});
assert('fixed zone policy rejects otherwise schema-valid model output', engineHero.source === 'fallback');
const relatedPolicy = compileBrandCompositionPolicy('bealls', 'pdp', 'pdp.related');
const relatedFixture = {
	component: 'product-carousel',
	props: {
		title: 'Related',
		products: ['one', 'two', 'three'].map((productId) => ({ productId, role: 'standard' as const })),
	},
};
const rulesRelated = resolveZone({
	zoneId: 'pdp.related', brandId: 'bealls', policy: relatedPolicy,
	engineDecisionMode: 'rules', engineCapabilities: ['rank_products', 'select_products'],
	engineOutput: { zones: { 'pdp.related': relatedFixture } },
});
assert('rules-authorized PDP product selection remains live', rulesRelated.source === 'engine');
const overAuthorityRelated = resolveZone({
	zoneId: 'pdp.related', brandId: 'bealls', policy: relatedPolicy,
	engineDecisionMode: 'model', engineCapabilities: ['select_page_recipe'],
	engineOutput: { zones: { 'pdp.related': relatedFixture } },
});
assert('over-authority PDP output preserves the fallback', overAuthorityRelated.source === 'fallback');
const approvalGatedAdminHero = resolveZone({
	zoneId: 'home.hero', brandId: 'bealls',
	policy: { ...fixedHeroPolicy, publicationMode: 'approval_required' },
	adminContent: { zones: { 'home.hero': { component: 'editorial-header', props: { eyebrow: 'ADMIN', headline: 'Unapproved', body: 'Unapproved' } } } },
});
assert('approval-gated zone output preserves the brand fallback', approvalGatedAdminHero.source === 'fallback');
const holdoutEngineHero = resolveZone({
	zoneId: 'home.hero', brandId: 'bealls',
	policy: { ...fixedHeroPolicy, decisionMode: 'model', publicationMode: 'holdout' },
	engineDecisionMode: 'model', engineCapabilities: ['generate_bounded_copy'],
	engineOutput: { zones: { 'home.hero': { component: 'editorial-header', props: { eyebrow: 'MODEL', headline: 'Holdout', body: 'Holdout' } } } },
});
assert('holdout model output preserves the brand fallback', holdoutEngineHero.source === 'fallback');

const validLayout = {
	persona: 'gatherer', reasoning: 'Fixture', productOrder: [],
	sections: [{ component: 'editorial-header', props: { eyebrow: 'VALUE', headline: 'Fixture', body: 'Fixture body' } }],
};
assert('registered brand layout passes the runtime vocabulary gate', validateRuntimeLayout({ brandId: 'bealls', surface: 'home', layout: validLayout, candidateProductIds: [] }) === validLayout);
rejects('runtime component invention is rejected', () => validateRuntimeLayout({
	brandId: 'bealls', surface: 'home', candidateProductIds: [],
	layout: { ...validLayout, sections: [{ component: 'runtime-widget', props: {} }] },
}), /unregistered component/);
rejects('runtime CSS invention is rejected', () => validateRuntimeLayout({
	brandId: 'bealls', surface: 'home', candidateProductIds: [],
	layout: { ...validLayout, sections: [{ component: 'editorial-header', props: { eyebrow: 'x', headline: 'x', body: 'x', className: 'invented' } }] },
}), /runtime styling key/);
rejects('runtime destination invention is rejected', () => validateRuntimeLayout({
	brandId: 'bealls', surface: 'home', candidateProductIds: [],
	layout: { ...validLayout, sections: [{ component: 'promo-strip', props: { headline: 'x', urgency: 'none', ctaHref: 'https://invented.invalid' } }] },
}), /destination/);
rejects('runtime product invention is rejected', () => validateRuntimeLayout({
	brandId: 'bealls', surface: 'home', candidateProductIds: ['known'],
	layout: { ...validLayout, productOrder: ['invented'] },
}), /outside the candidate set/);

if (failures) process.exitCode = 1;

function discoverExecutableRoutes(directory: string): string[] {
	const files = listFiles(directory);
	return files.flatMap((file) => {
		if (file === '+error.svelte') return ['/+error'];
		if (file.endsWith('/+page.svelte') || file === '+page.svelte') {
			const directoryName = file === '+page.svelte' ? '' : file.slice(0, -'/+page.svelte'.length);
			return [`/${directoryName}` || '/'];
		}
		if (file.endsWith('/+server.ts')) return [`/${file.slice(0, -'/+server.ts'.length)}`];
		return [];
	}).sort();
}

function listFiles(directory: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const absolutePath = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...listFiles(absolutePath));
		else if (entry.isFile()) files.push(relative(resolve(repoRoot, 'src/routes'), absolutePath).split(sep).join('/'));
	}
	return files;
}
