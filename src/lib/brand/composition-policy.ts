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
	policyVersion: 'bealls-family-org-observed-v1',
	maximum: { capabilities: AUTONOMY_CAPABILITIES, decisionMode: 'model', publicationMode: 'live' },
};

const STORE_FRONT_SURFACES = {
	home: { preset: 'compose', decisionMode: 'model', publicationMode: 'live' },
	plp: { preset: 'compose', decisionMode: 'model', publicationMode: 'live' },
	pdp: { preset: 'assist', decisionMode: 'rules', publicationMode: 'live' },
	cart: { preset: 'assist', decisionMode: 'model', publicationMode: 'live' },
	checkout: { preset: 'assist', decisionMode: 'model', publicationMode: 'live' },
} as const;

// These surfaces are present for every configured family brand today.
// Locator keeps a fixed route scaffold; its current load path supplies no
// engine output. EmptyRescue calls the layout API and falls back statically.
const SHARED_SURFACES = {
	locator: { preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live' },
	'style-guide': { preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live' },
	'error-404': { preset: 'compose', decisionMode: 'model', publicationMode: 'live' },
	'error-empty': { preset: 'compose', decisionMode: 'model', publicationMode: 'live' },
} as const;

function observedStorefrontPolicy(brandId: 'bealls' | 'beallsflorida'): BrandCompositionPolicy {
	return {
		organizationId: 'example-merchant',
		brandId,
		policyVersion: `${brandId}-observed-legacy-v3`,
		maximum: { capabilities: AUTONOMY_CAPABILITIES, decisionMode: 'model', publicationMode: 'live' },
		reference: { state: 'uncontracted' },
		surfaces: { ...STORE_FRONT_SURFACES, ...SHARED_SURFACES },
	};
}

const homecentric: BrandCompositionPolicy = {
	organizationId: 'example-merchant',
	brandId: 'homecentric',
	policyVersion: 'homecentric-observed-legacy-v3',
	maximum: { capabilities: AUTONOMY_CAPABILITIES, decisionMode: 'model', publicationMode: 'live' },
	reference: { state: 'uncontracted' },
	surfaces: {
		home: { preset: 'compose', decisionMode: 'model', publicationMode: 'live' },
		category: { preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live' },
		...SHARED_SURFACES,
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
