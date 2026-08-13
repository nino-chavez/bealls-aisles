import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve, sep } from 'node:path';
import { getBrandById } from './config';
import { BEALLS_COMPOSITION_POLICY, supportsBrandCompositionSurface } from './composition-policy';
import {
	BEALLS_FAMILY_RENDERER_CONTRACTS,
	BEALLS_FAMILY_LAYOUT_RENDERER_ROUTE_EVIDENCE,
	BEALLS_FAMILY_RENDERER_SOURCE_FILES,
	RendererContractValidationError,
	discoverBeallsFamilyLayoutRendererRoutes,
	getBeallsFamilyRendererContract,
	supportsRendererComponent,
	validateBeallsFamilyRendererContract,
	validateBeallsFamilyLayoutRendererRouteCoverage,
	validateBeallsFamilyRendererSourceSnapshot,
	type BeallsFamilyRendererContract,
	type RendererSourceFile,
} from './bealls-family-renderer-contract';

let failures = 0;
function assert(name: string, condition: boolean, detail = ''): void {
	if (condition) console.log(`PASS  ${name}`);
	else { console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); failures++; }
}
function throws(name: string, action: () => void, expected: RegExp): void {
	try { action(); assert(name, false, 'did not throw'); }
	catch (error) { assert(name, error instanceof RendererContractValidationError && expected.test(error.message), String(error)); }
}

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const readSourceFile = (path: RendererSourceFile): string => readFileSync(resolve(repoRoot, path), 'utf8');
const readRouteFile = (path: string): string => readFileSync(resolve(repoRoot, path), 'utf8');
const routeFiles = listSourceFiles(resolve(repoRoot, 'src/routes'));
const contracts = Object.values(BEALLS_FAMILY_RENDERER_CONTRACTS);

validateBeallsFamilyLayoutRendererRouteCoverage(routeFiles, readRouteFile);

for (const contract of contracts) {
	validateBeallsFamilyRendererContract(contract);
	validateBeallsFamilyRendererSourceSnapshot(contract, readSourceFile);
}

assert('three distinct Bealls-family contracts are declared', contracts.length === 3 && new Set(contracts.map((contract) => contract.brandId)).size === 3);
assert('each contract is versioned and tied to one configured brand', contracts.every((contract) => /^\d+\.\d+\.\d+$/.test(contract.contractVersion) && getBrandById(contract.brandId)?.name === contract.brandName));
assert('storefront brands inventory every shopper, locator, review, and rescue surface', ['bealls', 'beallsflorida'].every((brandId) => getBeallsFamilyRendererContract(brandId)?.supportedSurfaces.map((entry) => entry.surface).join(',') === 'home,plp,pdp,cart,checkout,search,account,compare,locator,style-guide,error-404,error-empty'));
assert('Home Centric inventories content routes, style guide, locator, and its actual 404 rescue', getBeallsFamilyRendererContract('homecentric')?.supportedSurfaces.map((entry) => entry.surface).join(',') === 'home,category,locator,style-guide,error-404');
assert('404 and storefront empty-rescue reason inventories match actual page insertions', contracts.every((contract) => {
	const error404 = contract.supportedSurfaces.find((entry) => entry.surface === 'error-404');
	const empty = contract.supportedSurfaces.find((entry) => entry.surface === 'error-empty');
	return error404?.rescueReasons.join(',') === 'not-found'
		&& (contract.mode === 'content' ? !empty : empty?.rescueReasons.join(',') === 'empty-cart,empty-search');
}));
assert('locator and applicable rescue surfaces are fixed because no current model producer publishes there', contracts.every((contract) => {
	const surfaces = BEALLS_COMPOSITION_POLICY.brands[contract.brandId].surfaces;
	return surfaces.locator?.preset === 'preserve'
		&& surfaces.locator.decisionMode === 'fixed'
		&& surfaces['error-404']?.preset === 'preserve'
		&& surfaces['error-404'].decisionMode === 'fixed'
		&& (contract.mode === 'content' || (surfaces['error-empty']?.preset === 'preserve'
			&& surfaces['error-empty'].decisionMode === 'fixed'));
}));
assert('style guide is a fixed shared surface with no model capabilities', contracts.every((contract) => {
	const surface = BEALLS_COMPOSITION_POLICY.brands[contract.brandId].surfaces['style-guide'];
	return surface?.preset === 'preserve'
		&& surface.decisionMode === 'fixed'
		&& surface.capabilities?.length === 0
		&& contract.supportedSurfaces.some((entry) => entry.surface === 'style-guide' && entry.recipeId === 'style-guide.shared');
}));
assert('all contracts link to observed policy without claiming preservation', contracts.every((contract) => contract.autonomy.referenceState === 'uncontracted' && BEALLS_COMPOSITION_POLICY.brands[contract.brandId].reference.state === 'uncontracted'));
assert('renderer lookup rejects inherited and prototype IDs', getBeallsFamilyRendererContract('toString') === undefined && getBeallsFamilyRendererContract('__proto__') === undefined);
assert('supported component checks are surface-specific', supportsRendererComponent(BEALLS_FAMILY_RENDERER_CONTRACTS.bealls, 'pdp', 'image-gallery') && !supportsRendererComponent(BEALLS_FAMILY_RENDERER_CONTRACTS.bealls, 'cart', 'image-gallery'));
assert('source snapshot records route, component, CSS, and runtime config owners', [
	'src/routes/+layout.svelte',
	'src/routes/+error.svelte',
	'src/routes/store-locator/+page.svelte',
	'src/routes/style-guide/+page.server.ts',
	'src/routes/style-guide/+page.svelte',
	'src/routes/test/components/+page.svelte',
	'src/lib/components/EmptyRescue.svelte',
	'src/lib/brand/config.ts',
	'src/lib/brand/bealls-family-runtime-contract.ts',
	'src/lib/server/route-zone-runtime.ts',
	'src/lib/server/zone-output-runtime.ts',
	'src/lib/server/zone-decision-envelope.ts',
	'src/lib/server/shopper-route-grant.ts',
	'src/lib/foundation/RuntimeEnvelopeZone.svelte',
	'src/lib/foundation/RuntimeZone.svelte',
	'src/lib/foundation/runtime-zone-envelope.ts',
	'src/lib/foundation/zone-decision-envelope-schema.ts',
	'src/lib/foundation/ZoneExecutionEvidence.svelte',
	'src/routes/observe/+page.server.ts',
	'src/routes/test/+layout.server.ts',
	'src/app.css',
].every((path) => BEALLS_FAMILY_RENDERER_SOURCE_FILES.includes(path as RendererSourceFile)));
const discoveredRendererRoutes = discoverBeallsFamilyLayoutRendererRoutes(routeFiles, readRouteFile);
assert('LayoutRenderer remains only on gated review/development surfaces', discoveredRendererRoutes.join(',') === [
	'src/routes/style-guide/+page.svelte',
	'src/routes/test/components/+page.svelte',
].join(','));
assert('Home Centric shopper category renders fixed sections without transitive whole-layout dispatch',
	!readFileSync(resolve(repoRoot, 'src/lib/components/layouts/ContentCategorySurface.svelte'), 'utf8').includes('LayoutRenderer'));
assert('style-guide route has explicit brand-surface evidence', BEALLS_FAMILY_LAYOUT_RENDERER_ROUTE_EVIDENCE.some((entry) => entry.file === 'src/routes/style-guide/+page.svelte'
	&& entry.kind === 'brand-surface'
	&& entry.surfaces.join(',') === 'style-guide'));

const homecentric = BEALLS_FAMILY_RENDERER_CONTRACTS.homecentric;
assert('Home Centric distinguishes mounted drawers from exposed controls', homecentric.mountedChromeIds.includes('cart-drawer')
	&& homecentric.mountedChromeIds.includes('picks-tray')
	&& !homecentric.exposedChromeIds.includes('cart-drawer')
	&& !homecentric.exposedChromeIds.includes('picks-tray'));
assert('Home Centric has no checkout surface while storefront brands retain checkout', !supportsBrandCompositionSurface('homecentric', 'checkout')
	&& supportsBrandCompositionSurface('bealls', 'checkout')
	&& supportsBrandCompositionSurface('beallsflorida', 'checkout')
	&& !supportsBrandCompositionSurface('__proto__', 'checkout'));
const footerSource = readFileSync(resolve(repoRoot, 'src/lib/components/Footer.svelte'), 'utf8');
const checkoutRouteSource = readFileSync(resolve(repoRoot, 'src/routes/checkout/+page.server.ts'), 'utf8');
const checkoutPolicyCall = "supportsBrandCompositionSurface(brand.id, 'checkout')";
assert('footer exposure and direct checkout access both use a fail-closed policy guard', footerSource.includes(checkoutPolicyCall)
	&& footerSource.includes('{#if checkoutSupported}')
	&& checkoutRouteSource.includes("requireBrandSurface('checkout')"));
assert('storefront chrome exposes the mounted cart and picks controls', ['bealls', 'beallsflorida'].every((brandId) => {
	const contract = getBeallsFamilyRendererContract(brandId);
	return contract?.exposedChromeIds.includes('cart-drawer') && contract.exposedChromeIds.includes('picks-tray');
}));

const bealls = BEALLS_FAMILY_RENDERER_CONTRACTS.bealls;
const beallsConfig = getBrandById('bealls');
if (!beallsConfig) throw new Error('test fixture: missing bealls config');

throws('rejects cross-brand BrandConfig linkage', () => validateBeallsFamilyRendererContract(bealls, {
	brandById: () => getBrandById('beallsflorida'),
	policyRegistry: BEALLS_COMPOSITION_POLICY,
}), /brand identity does not match BrandConfig/);
throws('rejects cross-organization contract identity', () => validateBeallsFamilyRendererContract({ ...bealls, organizationId: 'other-merchant' }), /Invalid input/);
throws('rejects policy-version mismatch', () => validateBeallsFamilyRendererContract({ ...bealls, autonomy: { ...bealls.autonomy, brandPolicyVersion: 'wrong-version' } }), /brand policy version does not match/);
throws('rejects Google Fonts URL drift against the recorded design snapshot', () => validateBeallsFamilyRendererContract(bealls, {
	brandById: () => ({ ...beallsConfig, googleFontsUrl: `${beallsConfig.googleFontsUrl}&drift=1` }),
	policyRegistry: BEALLS_COMPOSITION_POLICY,
}), /Google Fonts URL does not match BrandConfig/);
throws('rejects non-font config drift against the complete design snapshot', () => validateBeallsFamilyRendererContract(bealls, {
	brandById: () => ({ ...beallsConfig, homepage: { ...beallsConfig.homepage, heroHeadline: 'Drifted headline' } }),
	policyRegistry: BEALLS_COMPOSITION_POLICY,
}), /design-config snapshot fingerprint does not match BrandConfig/);
throws('rejects source drift against the recorded source snapshot', () => validateBeallsFamilyRendererSourceSnapshot(bealls, (path) => {
	const source = readSourceFile(path);
	return path === 'src/routes/+layout.svelte' ? `${source}\n<!-- drift fixture -->\n` : source;
}), /source snapshot fingerprint mismatch/);
const newRendererRoute = 'src/routes/new-renderer/+page.svelte';
throws('rejects a newly added SvelteKit LayoutRenderer route before it gains evidence and snapshot coverage', () => validateBeallsFamilyLayoutRendererRouteCoverage(
	[...routeFiles, newRendererRoute],
	(path) => path === newRendererRoute
		? `<script>import LayoutRenderer from '$lib/components/layouts/LayoutRenderer.svelte';</script><LayoutRenderer layout={layout} products={[]} />`
		: readRouteFile(path),
), /LayoutRenderer route lacks surface evidence.*new-renderer/);

const unsupportedSurface: BeallsFamilyRendererContract = {
	...bealls,
	supportedSurfaces: [...bealls.supportedSurfaces, { surface: 'category', recipeId: 'category.content', componentIds: ['content-category-surface'], rescueReasons: [] }],
};
throws('rejects a surface not supported by the storefront policy', () => validateBeallsFamilyRendererContract(unsupportedSurface), /absent from the brand policy/);

const unsupportedComponent: BeallsFamilyRendererContract = {
	...bealls,
	supportedSurfaces: bealls.supportedSurfaces.map((entry) => entry.surface === 'cart' ? { ...entry, componentIds: [...entry.componentIds, 'image-gallery'] } : entry),
};
throws('rejects a component inventory that diverges from its recipe', () => validateBeallsFamilyRendererContract(unsupportedComponent), /component inventory does not match recipe/);

if (failures) process.exitCode = 1;

function listSourceFiles(directory: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const absolutePath = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...listSourceFiles(absolutePath));
		else if (entry.isFile()) files.push(relative(repoRoot, absolutePath).split(sep).join('/'));
	}
	return files.sort();
}
