import { ZONES, type Surface, type ZoneId } from './zones';

/** Policy-only surfaces may sit outside the generated-layout schema. */
export type PolicySurface = Surface | 'category' | 'compare' | 'picks' | 'style-guide';

export const AUTONOMY_CAPABILITIES = [
	'rank_products',
	'select_products',
	'select_copy_variant',
	'generate_bounded_copy',
	'select_component_variant',
	'toggle_zone',
	'reorder_zones',
	'select_page_recipe',
] as const;
export type AutonomyCapability = (typeof AUTONOMY_CAPABILITIES)[number];

export const AUTONOMY_PRESETS = ['preserve', 'assist', 'compose', 'explore'] as const;
export type AutonomyPreset = (typeof AUTONOMY_PRESETS)[number];
export const DECISION_MODES = ['fixed', 'rules', 'model'] as const;
export type DecisionMode = (typeof DECISION_MODES)[number];
export const PUBLICATION_MODES = ['live', 'holdout', 'approval_required'] as const;
export type PublicationMode = (typeof PUBLICATION_MODES)[number];

const PRESET_CAPABILITIES = {
	preserve: ['rank_products', 'select_products'],
	assist: [
		'rank_products',
		'select_products',
		'select_copy_variant',
		'generate_bounded_copy',
		'select_component_variant',
	],
	compose: [...AUTONOMY_CAPABILITIES],
	explore: [...AUTONOMY_CAPABILITIES],
} as const satisfies Record<AutonomyPreset, readonly AutonomyCapability[]>;

export interface PolicyMaximum {
	capabilities: readonly AutonomyCapability[];
	decisionMode: DecisionMode;
	publicationMode: PublicationMode;
}

export interface OrganizationCompositionPolicy {
	organizationId: string;
	policyVersion: string;
	maximum: PolicyMaximum;
}

export interface ZoneCompositionPolicy {
	capabilities?: readonly AutonomyCapability[];
	decisionMode?: DecisionMode;
	publicationMode?: PublicationMode;
}

export interface SurfaceCompositionPolicy {
	preset: AutonomyPreset;
	capabilities?: readonly AutonomyCapability[];
	decisionMode: DecisionMode;
	publicationMode: PublicationMode;
	zoneOverrides?: Partial<Record<ZoneId, ZoneCompositionPolicy>>;
}

/**
 * `uncontracted` means the configuration is a current observed classification,
 * not a named reference implementation or a preservation guarantee.
 */
export type BrandReferenceState = { state: 'uncontracted' };

export interface BrandCompositionPolicy {
	organizationId: string;
	brandId: string;
	policyVersion: string;
	maximum: PolicyMaximum;
	reference: BrandReferenceState;
	surfaces: Partial<Record<PolicySurface, SurfaceCompositionPolicy>>;
}

export interface CompositionPolicyRegistry {
	organizations: Readonly<Record<string, OrganizationCompositionPolicy>>;
	brands: Readonly<Record<string, BrandCompositionPolicy>>;
}

export interface CompileCompositionPolicyInput {
	organizationId: string;
	brandId: string;
	surface: PolicySurface;
	zoneId?: ZoneId;
	registry: CompositionPolicyRegistry;
}

export interface EffectiveCompositionPolicy {
	policyVersion: string;
	capabilities: readonly AutonomyCapability[];
	decisionMode: DecisionMode;
	publicationMode: PublicationMode;
	provenance: {
		kind: 'observed_legacy_classification';
		organizationId: string;
		organizationPolicyVersion: string;
		brandId: string;
		brandPolicyVersion: string;
		referenceState: 'uncontracted';
		surface: PolicySurface;
		zoneId: ZoneId | null;
		preset: AutonomyPreset;
	};
}

export class CompositionPolicyValidationError extends Error {
	constructor(message: string) {
		super(`composition policy: ${message}`);
		this.name = 'CompositionPolicyValidationError';
	}
}

export function compileAutonomyPreset(preset: AutonomyPreset): readonly AutonomyCapability[] {
	if (!Object.prototype.hasOwnProperty.call(PRESET_CAPABILITIES, preset)) {
		throw new CompositionPolicyValidationError(`unknown autonomy preset "${preset}"`);
	}
	return [...PRESET_CAPABILITIES[preset]];
}

export function compileCompositionPolicy(input: CompileCompositionPolicyInput): EffectiveCompositionPolicy {
	assertNonBlank(input.organizationId, 'organization identity');
	assertNonBlank(input.brandId, 'brand identity');
	const organization = ownLookup(input.registry.organizations, input.organizationId);
	if (!organization) throw new CompositionPolicyValidationError(`missing organization policy "${input.organizationId}"`);
	if (organization.organizationId !== input.organizationId) {
		throw new CompositionPolicyValidationError('organization policy key does not match its identity');
	}
	assertMaximum(organization.maximum, 'organization maximum');

	const brand = ownLookup(input.registry.brands, input.brandId);
	if (!brand) throw new CompositionPolicyValidationError(`missing brand policy "${input.brandId}"`);
	if (brand.brandId !== input.brandId || brand.organizationId !== input.organizationId) {
		throw new CompositionPolicyValidationError(`brand policy "${input.brandId}" does not belong to this organization`);
	}
	assertMaximum(brand.maximum, 'brand maximum');
	assertNarrowerMaximum(brand.maximum, organization.maximum, 'brand maximum');
	if (brand.reference?.state !== 'uncontracted') {
		throw new CompositionPolicyValidationError('brand reference state must be explicit and uncontracted');
	}

	if (!POLICY_SURFACES.has(input.surface)) {
		throw new CompositionPolicyValidationError(`unknown surface "${input.surface}"`);
	}
	const surface = ownLookup(brand.surfaces, input.surface);
	if (!surface) throw new CompositionPolicyValidationError(`missing surface policy "${input.surface}" for brand "${input.brandId}"`);
	const presetCapabilities = compileAutonomyPreset(surface.preset);
	const surfaceCapabilities = surface.capabilities
		? uniqueCapabilities(surface.capabilities, `${input.surface} surface`)
		: presetCapabilities;
	if (surface.capabilities) assertSubset(surfaceCapabilities, presetCapabilities, `${input.surface} surface`, 'preset');
	assertSubset(surfaceCapabilities, brand.maximum.capabilities, `${input.surface} surface`, 'brand maximum');
	assertDecisionNarrower(surface.decisionMode, brand.maximum.decisionMode, `${input.surface} surface`);
	assertPublicationNarrower(surface.publicationMode, brand.maximum.publicationMode, `${input.surface} surface`);
	if (surface.preset === 'explore' && surface.publicationMode === 'live') {
		throw new CompositionPolicyValidationError('explore surface requires holdout or approval publication');
	}

	validateZoneOverrideKeys(surface, input.surface);
	let zone: ZoneCompositionPolicy | undefined;
	if (input.zoneId) {
		const metadata = ZONES[input.zoneId];
		if (!metadata || metadata.surface !== input.surface) {
			throw new CompositionPolicyValidationError(`unknown zone "${input.zoneId}" for surface "${input.surface}"`);
		}
		zone = surface.zoneOverrides?.[input.zoneId];
	}
	const capabilities = zone?.capabilities
		? uniqueCapabilities(zone.capabilities, `${input.zoneId} zone`)
		: surfaceCapabilities;
	if (zone?.capabilities) assertSubset(capabilities, surfaceCapabilities, `${input.zoneId} zone`, 'surface');
	const decisionMode = zone?.decisionMode ?? surface.decisionMode;
	const publicationMode = zone?.publicationMode ?? surface.publicationMode;
	assertDecisionNarrower(decisionMode, surface.decisionMode, `${input.zoneId ?? input.surface} effective policy`);
	assertPublicationNarrower(publicationMode, surface.publicationMode, `${input.zoneId ?? input.surface} effective policy`);

	return {
		policyVersion: composeEffectivePolicyVersion(organization.policyVersion, brand.policyVersion),
		capabilities: AUTONOMY_CAPABILITIES.filter((capability) =>
			[organization.maximum.capabilities, brand.maximum.capabilities, presetCapabilities, surfaceCapabilities, capabilities]
				.every((list) => list.includes(capability)),
		),
		decisionMode,
		publicationMode,
		provenance: {
			kind: 'observed_legacy_classification',
			organizationId: input.organizationId,
			organizationPolicyVersion: organization.policyVersion,
			brandId: input.brandId,
			brandPolicyVersion: brand.policyVersion,
			referenceState: 'uncontracted',
			surface: input.surface,
			zoneId: input.zoneId ?? null,
			preset: surface.preset,
		},
	};
}

export function composeEffectivePolicyVersion(organizationVersion: string, brandVersion: string): string {
	return `org:${organizationVersion.length}:${organizationVersion}|brand:${brandVersion.length}:${brandVersion}`;
}

const POLICY_SURFACES = new Set<PolicySurface>([
	'home', 'plp', 'pdp', 'cart', 'checkout', 'search', 'account', 'locator', 'error-404', 'error-empty', 'category', 'compare', 'picks', 'style-guide',
]);
const CAPABILITIES = new Set<string>(AUTONOMY_CAPABILITIES);
const DECISION_AUTHORITY: Record<DecisionMode, number> = { fixed: 0, rules: 1, model: 2 };

function assertMaximum(maximum: PolicyMaximum, label: string): void {
	uniqueCapabilities(maximum.capabilities, label);
	assertDecisionMode(maximum.decisionMode, label);
	assertPublicationMode(maximum.publicationMode, label);
}
function assertNarrowerMaximum(child: PolicyMaximum, parent: PolicyMaximum, label: string): void {
	assertSubset(child.capabilities, parent.capabilities, label, 'organization maximum');
	assertDecisionNarrower(child.decisionMode, parent.decisionMode, label);
	assertPublicationNarrower(child.publicationMode, parent.publicationMode, label);
}
function assertDecisionNarrower(child: DecisionMode, parent: DecisionMode, label: string): void {
	assertDecisionMode(child, label); assertDecisionMode(parent, 'parent');
	if (DECISION_AUTHORITY[child] > DECISION_AUTHORITY[parent]) throw new CompositionPolicyValidationError(`${label} expands decision mode beyond "${parent}"`);
}
function assertPublicationNarrower(child: PublicationMode, parent: PublicationMode, label: string): void {
	assertPublicationMode(child, label); assertPublicationMode(parent, 'parent');
	if (child !== parent && parent !== 'live') throw new CompositionPolicyValidationError(`${label} expands publication mode beyond "${parent}"`);
}
function assertDecisionMode(mode: DecisionMode, label: string): void {
	if (!DECISION_MODES.includes(mode)) throw new CompositionPolicyValidationError(`${label} has unknown decision mode "${mode}"`);
}
function assertPublicationMode(mode: PublicationMode, label: string): void {
	if (!PUBLICATION_MODES.includes(mode)) throw new CompositionPolicyValidationError(`${label} has unknown publication mode "${mode}"`);
}
function uniqueCapabilities(values: readonly AutonomyCapability[], label: string): AutonomyCapability[] {
	for (const value of values) if (!CAPABILITIES.has(value)) throw new CompositionPolicyValidationError(`${label} has unknown capability "${value}"`);
	return [...new Set(values)];
}
function assertSubset<T extends string>(child: readonly T[], parent: readonly T[], childLabel: string, parentLabel: string): void {
	const parentSet = new Set(parent);
	const expansion = child.filter((value) => !parentSet.has(value));
	if (expansion.length) throw new CompositionPolicyValidationError(`${childLabel} expands ${parentLabel} with ${[...new Set(expansion)].join(', ')}`);
}
function assertNonBlank(value: string, label: string): void {
	if (typeof value !== 'string' || value.trim() === '') throw new CompositionPolicyValidationError(`${label} is required`);
}
function ownLookup<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
	return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}
function validateZoneOverrideKeys(policy: SurfaceCompositionPolicy, surface: PolicySurface): void {
	for (const zoneId of Object.keys(policy.zoneOverrides ?? {})) {
		const metadata = ZONES[zoneId as ZoneId];
		if (!metadata || metadata.surface !== surface) throw new CompositionPolicyValidationError(`unknown zone override "${zoneId}" for surface "${surface}"`);
	}
}
