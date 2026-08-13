import { getBrandById } from './config';
import { BEALLS_COMPOSITION_POLICY, POLICY_BRAND_IDS, getBrandCompositionPolicy, supportsBrandCompositionSurface } from './composition-policy';

let failures = 0;
function assert(name: string, condition: boolean): void {
	if (condition) console.log(`PASS  ${name}`);
	else { console.error(`FAIL  ${name}`); failures++; }
}

assert('all three configured merchant brands have separate policy records', POLICY_BRAND_IDS.length === 3 && new Set(POLICY_BRAND_IDS).size === 3);
assert('all brand policies share one merchant organization', Object.values(BEALLS_COMPOSITION_POLICY.brands).every((policy) => policy.organizationId === 'example-merchant'));
assert('brand lookup does not accept inherited object properties', getBrandCompositionPolicy('toString') === undefined && getBrandById('__proto__') === undefined);
assert('policy records do not claim a reference contract', Object.values(BEALLS_COMPOSITION_POLICY.brands).every((policy) => policy.reference.state === 'uncontracted'));
assert('all brands expose the fixed style guide', POLICY_BRAND_IDS.every((brandId) => supportsBrandCompositionSurface(brandId, 'style-guide')));
assert('Home Centric omits checkout while storefront brands retain it', !supportsBrandCompositionSurface('homecentric', 'checkout')
	&& supportsBrandCompositionSurface('bealls', 'checkout')
	&& supportsBrandCompositionSurface('beallsflorida', 'checkout'));
assert('surface support lookup fails closed for inherited brand IDs', !supportsBrandCompositionSurface('__proto__', 'checkout'));

if (failures) process.exitCode = 1;
