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
const merchantVariantCapabilities = new Set(['rank_products', 'select_products', 'select_copy_variant', 'select_component_variant']);
const usesOnlyMerchantVariantCapabilities = (capabilities: readonly string[]) => capabilities.every((capability) => merchantVariantCapabilities.has(capability));
const beallsHome = () => compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'bealls', surface: 'home', registry });

const home = beallsHome();
assert('Bealls home records bounded live model zones', home.decisionMode === 'model'
	&& home.publicationMode === 'live' && home.provenance.preset === 'assist'
	&& home.capabilities.includes('select_component_variant')
	&& usesOnlyMerchantVariantCapabilities(home.capabilities));
const pdp = compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'bealls', surface: 'pdp', registry });
const pdpRelated = compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'bealls', surface: 'pdp', zoneId: 'pdp.related', registry });
const pdpBelowDescription = compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'bealls', surface: 'pdp', zoneId: 'pdp.below-description', registry });
const cartAboveCheckout = compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'bealls', surface: 'cart', zoneId: 'cart.above-checkout-cta', registry });
const checkoutAssurance = compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'bealls', surface: 'checkout', zoneId: 'checkout.assurance-strip', registry });
const searchRescue = compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'bealls', surface: 'search', zoneId: 'search.zero-results-rescue', registry });

assert('Bealls PDP permits bounded model zones while recently-viewed remains a trusted rule', pdp.decisionMode === 'model'
	&& pdp.publicationMode === 'live'
	&& pdp.provenance.preset === 'assist'
	&& pdpRelated.decisionMode === 'model'
	&& pdpRelated.trustedRule === null
	&& pdpBelowDescription.decisionMode === 'model'
	&& pdpBelowDescription.trustedRule === null);
assert('Home, PLP, and PDP model zones select merchant-owned variants without copy generation',
	usesOnlyMerchantVariantCapabilities(home.capabilities)
	&& usesOnlyMerchantVariantCapabilities(pdpRelated.capabilities)
	&& usesOnlyMerchantVariantCapabilities(pdpBelowDescription.capabilities)
	&& usesOnlyMerchantVariantCapabilities(compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'bealls', surface: 'plp', zoneId: 'plp.banner', registry }).capabilities));
assert('cart, checkout, and search keep narrower approved capabilities', usesOnlyMerchantVariantCapabilities(cartAboveCheckout.capabilities)
	&& usesOnlyMerchantVariantCapabilities(checkoutAssurance.capabilities)
	&& usesOnlyMerchantVariantCapabilities(searchRescue.capabilities));
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
		capabilities: ['rank_products', 'select_products', 'select_copy_variant', 'select_component_variant'],
		decisionMode: 'rules',
		publicationMode: 'live',
	},
	surfaces: {
		...registry.brands.bealls.surfaces,
		cart: { ...registry.brands.bealls.surfaces.cart!, decisionMode: 'model' },
	},
};
const narrowBrandRegistry: CompositionPolicyRegistry = { ...registry, brands: { ...registry.brands, bealls: narrowedBrand } };
throws('rejects a surface expansion beyond the brand ceiling', () => compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'bealls', surface: 'cart', registry: narrowBrandRegistry }), /cart surface expands decision mode/);

const expandedZone: BrandCompositionPolicy = {
	...registry.brands.bealls,
	surfaces: {
		...registry.brands.bealls.surfaces,
		cart: {
			...registry.brands.bealls.surfaces.cart!,
			capabilities: ['rank_products'],
			zoneOverrides: { 'cart.empty-state': { capabilities: ['select_products'] } },
		},
	},
};
const expandedZoneRegistry: CompositionPolicyRegistry = { ...registry, brands: { ...registry.brands, bealls: expandedZone } };
throws('rejects a zone expansion beyond its surface', () => compileCompositionPolicy({ organizationId: 'example-merchant', brandId: 'bealls', surface: 'cart', zoneId: 'cart.empty-state', registry: expandedZoneRegistry }), /cart.empty-state zone expands surface/);

const forgedRuleRegistry = structuredClone(registry) as CompositionPolicyRegistry;
(forgedRuleRegistry.brands.bealls.surfaces.pdp!.zoneOverrides!['pdp.related'] as unknown as {
	trustedRule: { id: string; version: string };
}).trustedRule = { id: 'arbitrary-unregistered-rule', version: '999' };
throws('rejects an unregistered rule identity in effective policy', () => compileCompositionPolicy({
	organizationId: 'example-merchant', brandId: 'bealls', surface: 'pdp', zoneId: 'pdp.related', registry: forgedRuleRegistry,
}), /unregistered trusted rule/);

if (failures) process.exitCode = 1;
