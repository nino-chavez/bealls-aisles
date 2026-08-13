import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { getBrandById } from './config';
import { BEALLS_COMPOSITION_POLICY } from './composition-policy';
import {
	BEALLS_FAMILY_RENDERER_CONTRACTS,
	BEALLS_FAMILY_RENDERER_SOURCE_FILES,
	RendererContractValidationError,
	getBeallsFamilyRendererContract,
	supportsRendererComponent,
	validateBeallsFamilyRendererContract,
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
const contracts = Object.values(BEALLS_FAMILY_RENDERER_CONTRACTS);

for (const contract of contracts) {
	validateBeallsFamilyRendererContract(contract);
	validateBeallsFamilyRendererSourceSnapshot(contract, readSourceFile);
}

assert('three distinct Bealls-family contracts are declared', contracts.length === 3 && new Set(contracts.map((contract) => contract.brandId)).size === 3);
assert('each contract is versioned and tied to one configured brand', contracts.every((contract) => /^\d+\.\d+\.\d+$/.test(contract.contractVersion) && getBrandById(contract.brandId)?.name === contract.brandName));
assert('storefront brands inventory locator and universal rescue surfaces', ['bealls', 'beallsflorida'].every((brandId) => getBeallsFamilyRendererContract(brandId)?.supportedSurfaces.map((entry) => entry.surface).join(',') === 'home,plp,pdp,cart,checkout,locator,error-404,error-empty'));
assert('Home Centric inventories its content routes plus locator and universal rescues', getBeallsFamilyRendererContract('homecentric')?.supportedSurfaces.map((entry) => entry.surface).join(',') === 'home,category,locator,error-404,error-empty');
assert('404 and empty-rescue reason inventories match the mounted implementation', contracts.every((contract) => {
	const error404 = contract.supportedSurfaces.find((entry) => entry.surface === 'error-404');
	const empty = contract.supportedSurfaces.find((entry) => entry.surface === 'error-empty');
	return error404?.rescueReasons.join(',') === 'not-found' && empty?.rescueReasons.join(',') === 'empty-cart,empty-search,empty-wishlist';
}));
assert('locator is classified as fixed while rescue surfaces classify current model use', contracts.every((contract) => {
	const surfaces = BEALLS_COMPOSITION_POLICY.brands[contract.brandId].surfaces;
	return surfaces.locator?.preset === 'preserve'
		&& surfaces.locator.decisionMode === 'fixed'
		&& surfaces['error-404']?.preset === 'compose'
		&& surfaces['error-404'].decisionMode === 'model'
		&& surfaces['error-empty']?.preset === 'compose'
		&& surfaces['error-empty'].decisionMode === 'model';
}));
assert('all contracts link to observed policy without claiming preservation', contracts.every((contract) => contract.autonomy.referenceState === 'uncontracted' && BEALLS_COMPOSITION_POLICY.brands[contract.brandId].reference.state === 'uncontracted'));
assert('renderer lookup rejects inherited and prototype IDs', getBeallsFamilyRendererContract('toString') === undefined && getBeallsFamilyRendererContract('__proto__') === undefined);
assert('supported component checks are surface-specific', supportsRendererComponent(BEALLS_FAMILY_RENDERER_CONTRACTS.bealls, 'pdp', 'image-gallery') && !supportsRendererComponent(BEALLS_FAMILY_RENDERER_CONTRACTS.bealls, 'cart', 'image-gallery'));
assert('source snapshot records route, component, CSS, and runtime config owners', [
	'src/routes/+layout.svelte',
	'src/routes/+error.svelte',
	'src/routes/store-locator/+page.svelte',
	'src/lib/components/EmptyRescue.svelte',
	'src/lib/brand/config.ts',
	'src/app.css',
].every((path) => BEALLS_FAMILY_RENDERER_SOURCE_FILES.includes(path as RendererSourceFile)));

const homecentric = BEALLS_FAMILY_RENDERER_CONTRACTS.homecentric;
assert('Home Centric distinguishes mounted drawers from exposed controls', homecentric.mountedChromeIds.includes('cart-drawer')
	&& homecentric.mountedChromeIds.includes('picks-tray')
	&& !homecentric.exposedChromeIds.includes('cart-drawer')
	&& !homecentric.exposedChromeIds.includes('picks-tray'));
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
