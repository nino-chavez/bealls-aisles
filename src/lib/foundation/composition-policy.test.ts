import {
	CompositionPolicyValidationError,
	compileCompositionPolicy,
	type BrandCompositionPolicy,
	type CompositionPolicyRegistry,
} from './composition-policy';
import { BEALLS_COMPOSITION_POLICY } from '../brand/composition-policy';

let failures = 0;
function assert(name: string, condition: boolean, detail = ''): void {
	if (condition) console.log(`PASS  ${name}`);
	else { console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); failures++; }
}
function throws(name: string, action: () => void, expected: RegExp): void {
	try { action(); assert(name, false, 'did not throw'); }
	catch (error) { assert(name, error instanceof CompositionPolicyValidationError && expected.test(error.message), String(error)); }
}

const registry = BEALLS_COMPOSITION_POLICY;
const beallsHome = () => compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'bealls', surface: 'home', registry });

const home = beallsHome();
assert('Bealls home records live model composition', home.decisionMode === 'model' && home.publicationMode === 'live' && home.provenance.preset === 'compose');
const pdp = compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'bealls', surface: 'pdp', registry });
const pdpRelated = compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'bealls', surface: 'pdp', zoneId: 'pdp.related', registry });
const pdpBelowDescription = compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'bealls', surface: 'pdp', zoneId: 'pdp.below-description', registry });
assert('Bealls PDP records the existing model suggestion path while named zones narrow to rules or fixed', pdp.decisionMode === 'model'
	&& pdp.publicationMode === 'live'
	&& pdp.provenance.preset === 'assist'
	&& pdpRelated.decisionMode === 'rules'
	&& pdpBelowDescription.decisionMode === 'fixed');
const florida = compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'beallsflorida', surface: 'plp', registry });
assert('Bealls Florida remains a separate brand policy', florida.provenance.brandId === 'beallsflorida' && florida.policyVersion !== home.policyVersion);
const category = compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'homecentric', surface: 'category', registry });
const locator = compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'homecentric', surface: 'locator', registry });
assert('Home Centric category and locator are fixed', category.decisionMode === 'fixed' && locator.decisionMode === 'fixed' && category.capabilities.length === 0 && locator.capabilities.length === 0);
const styleGuide = compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'homecentric', surface: 'style-guide', registry });
assert('style guide compiles to fixed output with no model capabilities', styleGuide.decisionMode === 'fixed' && styleGuide.capabilities.length === 0 && styleGuide.provenance.preset === 'preserve');
assert('all policies state uncontracted reference truthfully', Object.values(registry.brands).every((policy) => policy.reference.state === 'uncontracted'));
assert('no observed surface uses live Explore', Object.values(registry.brands).every((policy) => Object.values(policy.surfaces).every((surface) => surface?.preset !== 'explore' || surface.publicationMode !== 'live')));

throws('rejects inherited organization lookup', () => compileCompositionPolicy({ organizationId: '__proto__', brandId: 'bealls', surface: 'home', registry }), /missing organization/);
throws('rejects inherited brand lookup', () => compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'toString', surface: 'home', registry }), /missing brand/);
throws('rejects a policy that crosses the organization boundary', () => compileCompositionPolicy({ organizationId: 'other-merchant', brandId: 'bealls', surface: 'home', registry }), /missing organization/);

const narrowedOrganization = {
	...registry.organizations['example-merchant'],
	maximum: { capabilities: ['rank_products'] as const, decisionMode: 'model' as const, publicationMode: 'live' as const },
};
const narrowedRegistry: CompositionPolicyRegistry = { ...registry, organizations: { 'example-merchant': narrowedOrganization } };
throws('rejects a brand expansion beyond the organization ceiling', () => compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'bealls', surface: 'home', registry: narrowedRegistry }), /brand maximum expands organization maximum/);

const narrowedBrand: BrandCompositionPolicy = {
	...registry.brands.bealls,
	maximum: {
		capabilities: ['rank_products', 'select_products', 'select_copy_variant', 'generate_bounded_copy', 'select_component_variant'],
		decisionMode: 'rules',
		publicationMode: 'live',
	},
};
const narrowBrandRegistry: CompositionPolicyRegistry = { ...registry, brands: { ...registry.brands, bealls: narrowedBrand } };
throws('rejects a surface expansion beyond the brand ceiling', () => compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'bealls', surface: 'home', registry: narrowBrandRegistry }), /home surface expands brand maximum/);

const expandedZone: BrandCompositionPolicy = {
	...registry.brands.bealls,
	surfaces: {
		...registry.brands.bealls.surfaces,
		home: {
			...registry.brands.bealls.surfaces.home!,
			capabilities: ['rank_products', 'select_products'],
			zoneOverrides: { 'home.hero': { capabilities: ['select_page_recipe'] } },
		},
	},
};
const expandedZoneRegistry: CompositionPolicyRegistry = { ...registry, brands: { ...registry.brands, bealls: expandedZone } };
throws('rejects a zone expansion beyond its surface', () => compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'bealls', surface: 'home', zoneId: 'home.hero', registry: expandedZoneRegistry }), /home.hero zone expands surface/);

if (failures) process.exitCode = 1;
