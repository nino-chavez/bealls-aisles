import { getBrandById } from './config';
import { BEALLS_COMPOSITION_POLICY } from './composition-policy';
import {
	BEALLS_FAMILY_RENDERER_CONTRACTS,
	RendererContractValidationError,
	getBeallsFamilyRendererContract,
	supportsRendererComponent,
	validateBeallsFamilyRendererContract,
	type BeallsFamilyRendererContract,
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

const contracts = Object.values(BEALLS_FAMILY_RENDERER_CONTRACTS);
for (const contract of contracts) validateBeallsFamilyRendererContract(contract);

assert('three distinct Bealls-family contracts are declared', contracts.length === 3 && new Set(contracts.map((contract) => contract.brandId)).size === 3);
assert('each contract is versioned and tied to one configured brand', contracts.every((contract) => /^\d+\.\d+\.\d+$/.test(contract.contractVersion) && getBrandById(contract.brandId)?.name === contract.brandName));
assert('storefront brands carry the actual storefront surfaces', ['bealls', 'beallsflorida'].every((brandId) => getBeallsFamilyRendererContract(brandId)?.supportedSurfaces.map((entry) => entry.surface).join(',') === 'home,plp,pdp,cart,checkout'));
assert('Home Centric keeps content, category, and locator boundaries', getBeallsFamilyRendererContract('homecentric')?.supportedSurfaces.map((entry) => entry.surface).join(',') === 'home,category,locator');
assert('all contracts link to observed policy without claiming preservation', contracts.every((contract) => contract.autonomy.referenceState === 'uncontracted' && BEALLS_COMPOSITION_POLICY.brands[contract.brandId].reference.state === 'uncontracted'));
assert('renderer lookup rejects inherited and prototype IDs', getBeallsFamilyRendererContract('toString') === undefined && getBeallsFamilyRendererContract('__proto__') === undefined);
assert('supported component checks are surface-specific', supportsRendererComponent(BEALLS_FAMILY_RENDERER_CONTRACTS.bealls, 'pdp', 'image-gallery') && !supportsRendererComponent(BEALLS_FAMILY_RENDERER_CONTRACTS.bealls, 'cart', 'image-gallery'));

const bealls = BEALLS_FAMILY_RENDERER_CONTRACTS.bealls;
throws('rejects cross-brand BrandConfig linkage', () => validateBeallsFamilyRendererContract(bealls, {
	brandById: () => getBrandById('beallsflorida'),
	policyRegistry: BEALLS_COMPOSITION_POLICY,
}), /brand identity does not match BrandConfig/);
throws('rejects cross-organization contract identity', () => validateBeallsFamilyRendererContract({ ...bealls, organizationId: 'other-merchant' }), /Invalid input/);
throws('rejects policy-version mismatch', () => validateBeallsFamilyRendererContract({ ...bealls, autonomy: { ...bealls.autonomy, brandPolicyVersion: 'wrong-version' } }), /brand policy version does not match/);
throws('rejects a theme change without a new contract fingerprint and version', () => validateBeallsFamilyRendererContract({
	...bealls,
	designConfigFingerprint: { ...bealls.designConfigFingerprint, theme: { ...bealls.designConfigFingerprint.theme, primary: '#000000' } },
}), /theme fingerprint does not match BrandConfig/);
throws('rejects category identity drift without a new contract fingerprint and version', () => validateBeallsFamilyRendererContract({
	...bealls,
	designConfigFingerprint: { ...bealls.designConfigFingerprint, categorySlugs: ['women'] },
}), /category fingerprint does not match BrandConfig/);

const unsupportedSurface: BeallsFamilyRendererContract = {
	...bealls,
	supportedSurfaces: [...bealls.supportedSurfaces, { surface: 'locator', recipeId: 'locator.content', componentIds: ['zone-renderer'] }],
};
throws('rejects a surface not supported by the storefront policy', () => validateBeallsFamilyRendererContract(unsupportedSurface), /absent from the brand policy/);

const unsupportedComponent: BeallsFamilyRendererContract = {
	...bealls,
	supportedSurfaces: bealls.supportedSurfaces.map((entry) => entry.surface === 'cart' ? { ...entry, componentIds: [...entry.componentIds, 'image-gallery'] } : entry),
};
throws('rejects a component unsupported by its recipe', () => validateBeallsFamilyRendererContract(unsupportedComponent), /not supported by recipe/);

if (failures) process.exitCode = 1;
