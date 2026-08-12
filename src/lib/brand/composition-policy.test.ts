import { getBrandById } from './config';
import { BEALLS_COMPOSITION_POLICY, POLICY_BRAND_IDS, getBrandCompositionPolicy } from './composition-policy';

let failures = 0;
function assert(name: string, condition: boolean): void {
	if (condition) console.log(`PASS  ${name}`);
	else { console.error(`FAIL  ${name}`); failures++; }
}

assert('all three configured merchant brands have separate policy records', POLICY_BRAND_IDS.length === 3 && new Set(POLICY_BRAND_IDS).size === 3);
assert('all brand policies share one merchant organization', Object.values(BEALLS_COMPOSITION_POLICY.brands).every((policy) => policy.organizationId === 'example-merchant'));
assert('brand lookup does not accept inherited object properties', getBrandCompositionPolicy('toString') === undefined && getBrandById('__proto__') === undefined);
assert('policy records do not claim a reference contract', Object.values(BEALLS_COMPOSITION_POLICY.brands).every((policy) => policy.reference.state === 'uncontracted'));

if (failures) process.exitCode = 1;
