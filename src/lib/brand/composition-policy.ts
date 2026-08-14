import { BRAND_IDS, getBrandById } from './config';
import {
	AUTONOMY_CAPABILITIES,
	type BrandCompositionPolicy,
	type CompositionPolicyRegistry,
	type OrganizationCompositionPolicy,
	type PolicySurface,
} from '../foundation/composition-policy';

const organization: OrganizationCompositionPolicy = {
	organizationId: 'example-merchant',
	policyVersion: 'bealls-family-org-observed-v2',
	maximum: { capabilities: AUTONOMY_CAPABILITIES, decisionMode: 'model', publicationMode: 'live' },
};

const STORE_FRONT_SURFACES = {
	home: { preset: 'assist', decisionMode: 'model', publicationMode: 'live' },
	plp: { preset: 'assist', decisionMode: 'model', publicationMode: 'live' },
	pdp: { preset: 'assist', decisionMode: 'model', publicationMode: 'live' },
	cart: { preset: 'assist', decisionMode: 'model', publicationMode: 'live' },
	checkout: { preset: 'assist', decisionMode: 'model', publicationMode: 'live' },
	search: { preset: 'assist', decisionMode: 'model', publicationMode: 'live' },
	account: { preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live' },
	compare: { preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live' },
	picks: { preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live' },
} as const;

const FIXED_ZONE = { capabilities: [], decisionMode: 'fixed' } as const;
const RULES_PRODUCT_ZONE = {
	capabilities: ['rank_products', 'select_products'],
	decisionMode: 'rules',
	trustedRule: { id: 'pdp-tag-overlap-v1', version: '1' },
} as const;
const MODEL_PRESENTATION_ZONE = {
	capabilities: ['select_copy_variant', 'generate_bounded_copy', 'select_component_variant'],
	decisionMode: 'model',
} as const;
const MODEL_PRODUCT_ZONE = {
	capabilities: ['rank_products', 'select_products', 'select_copy_variant', 'generate_bounded_copy', 'select_component_variant'],
	decisionMode: 'model',
} as const;
const MODEL_NARROW_PRODUCT_ZONE = {
	capabilities: ['rank_products', 'select_products', 'select_component_variant'],
	decisionMode: 'model',
} as const;
const MODEL_NARROW_PRESENTATION_ZONE = {
	capabilities: ['select_copy_variant', 'select_component_variant'],
	decisionMode: 'model',
} as const;

/**
 * Every catalog zone is explicit. A fixed override does not mean the route is
 * absent: it means the current renderer does not grant an engine decision at
 * that named insertion point. Mount/exposure state is recorded separately by
 * the executable runtime contract.
 */
const ZONE_OVERRIDES = {
	home: {
		'home.hero': MODEL_PRESENTATION_ZONE,
		'home.featured-row': FIXED_ZONE,
		'home.editorial-strip': MODEL_PRESENTATION_ZONE,
		'home.brand-spotlight': MODEL_PRESENTATION_ZONE,
		'home.below-fold': MODEL_PRESENTATION_ZONE,
	},
	plp: {
		'plp.banner': MODEL_PRESENTATION_ZONE,
		'plp.editorial-header': MODEL_PRESENTATION_ZONE,
		'plp.cluster-row': MODEL_PRESENTATION_ZONE,
		'plp.between-thirds': MODEL_PRESENTATION_ZONE,
		'plp.below-grid': FIXED_ZONE,
		'plp.empty-state': FIXED_ZONE,
	},
	pdp: {
		'pdp.below-description': MODEL_PRESENTATION_ZONE,
		'pdp.related': MODEL_PRODUCT_ZONE,
		'pdp.cross-sell': MODEL_PRODUCT_ZONE,
		'pdp.recently-viewed': RULES_PRODUCT_ZONE,
		'pdp.below-recs': FIXED_ZONE,
	},
	cart: {
		'cart.above-checkout-cta': MODEL_NARROW_PRODUCT_ZONE,
		'cart.below-fold': FIXED_ZONE,
		'cart.empty-state': FIXED_ZONE,
	},
	checkout: {
		'checkout.assurance-strip': MODEL_NARROW_PRESENTATION_ZONE,
		'checkout.last-chance-upsell': FIXED_ZONE,
	},
	search: {
		'search.empty-state': FIXED_ZONE,
		'search.zero-results-rescue': MODEL_NARROW_PRODUCT_ZONE,
	},
	account: {
		'account.welcome': FIXED_ZONE,
		'account.dashboard-pick': FIXED_ZONE,
	},
	locator: { 'locator.editorial-intro': FIXED_ZONE },
	'error-404': {
		'error-404.rescue': FIXED_ZONE,
	},
	'error-empty': {
		'error-empty.rescue': FIXED_ZONE,
	},
} as const;

// These surfaces are present for every configured family brand today.
// Locator and empty-rescue insertion points use fixed route scaffolds and
// named fallback/Hidden terminals; neither calls a shopper model endpoint.
const SHARED_SURFACES = {
	locator: { preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live', zoneOverrides: ZONE_OVERRIDES.locator },
	'style-guide': { preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live' },
	'error-404': { preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live', zoneOverrides: ZONE_OVERRIDES['error-404'] },
	'error-empty': { preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live', zoneOverrides: ZONE_OVERRIDES['error-empty'] },
} as const;

function observedStorefrontPolicy(brandId: 'bealls' | 'beallsflorida'): BrandCompositionPolicy {
	return {
		organizationId: 'example-merchant',
		brandId,
		policyVersion: `${brandId}-bounded-ai-runtime-v7`,
		maximum: { capabilities: AUTONOMY_CAPABILITIES, decisionMode: 'model', publicationMode: 'live' },
		reference: { state: 'uncontracted' },
		surfaces: {
			...STORE_FRONT_SURFACES,
			home: { ...STORE_FRONT_SURFACES.home, zoneOverrides: ZONE_OVERRIDES.home },
			plp: { ...STORE_FRONT_SURFACES.plp, zoneOverrides: ZONE_OVERRIDES.plp },
			pdp: { ...STORE_FRONT_SURFACES.pdp, zoneOverrides: ZONE_OVERRIDES.pdp },
			cart: { ...STORE_FRONT_SURFACES.cart, zoneOverrides: ZONE_OVERRIDES.cart },
			checkout: { ...STORE_FRONT_SURFACES.checkout, zoneOverrides: ZONE_OVERRIDES.checkout },
			search: { ...STORE_FRONT_SURFACES.search, zoneOverrides: ZONE_OVERRIDES.search },
			account: { ...STORE_FRONT_SURFACES.account, zoneOverrides: ZONE_OVERRIDES.account },
			...SHARED_SURFACES,
		},
	};
}

const homecentric: BrandCompositionPolicy = {
	organizationId: 'example-merchant',
	brandId: 'homecentric',
	policyVersion: 'homecentric-executable-runtime-v7',
	maximum: { capabilities: AUTONOMY_CAPABILITIES, decisionMode: 'model', publicationMode: 'live' },
	reference: { state: 'uncontracted' },
	surfaces: {
		home: { preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live', zoneOverrides: {
			'home.hero': FIXED_ZONE,
			'home.featured-row': FIXED_ZONE,
			'home.editorial-strip': FIXED_ZONE,
			'home.brand-spotlight': FIXED_ZONE,
			'home.below-fold': FIXED_ZONE,
		} },
		category: { preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live' },
		locator: SHARED_SURFACES.locator,
		'style-guide': SHARED_SURFACES['style-guide'],
		'error-404': SHARED_SURFACES['error-404'],
	},
};

export const BEALLS_COMPOSITION_POLICY: CompositionPolicyRegistry = {
	organizations: { [organization.organizationId]: organization },
	brands: {
		bealls: observedStorefrontPolicy('bealls'),
		beallsflorida: observedStorefrontPolicy('beallsflorida'),
		homecentric,
	},
};

/** True only for an existing runtime brand with an explicit policy record. */
export function getBrandCompositionPolicy(brandId: string): BrandCompositionPolicy | undefined {
	if (!getBrandById(brandId)) return undefined;
	return Object.prototype.hasOwnProperty.call(BEALLS_COMPOSITION_POLICY.brands, brandId)
		? BEALLS_COMPOSITION_POLICY.brands[brandId]
		: undefined;
}

/** Fails closed when a configured brand has no explicit policy for a surface. */
export function supportsBrandCompositionSurface(brandId: string, surface: PolicySurface): boolean {
	const policy = getBrandCompositionPolicy(brandId);
	return !!policy && Object.prototype.hasOwnProperty.call(policy.surfaces, surface);
}

/** Keeps the policy registry deliberately aligned with the configured merchant family. */
export const POLICY_BRAND_IDS = BRAND_IDS.filter((brandId) =>
	Object.prototype.hasOwnProperty.call(BEALLS_COMPOSITION_POLICY.brands, brandId),
);
