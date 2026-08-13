import { z } from 'zod';
import { getBrandById, getBrandMode, type BrandConfig } from './config';
import { BEALLS_COMPOSITION_POLICY } from './composition-policy';
import type { CompositionPolicyRegistry, PolicySurface } from '../foundation/composition-policy';

/**
 * Internal renderer contracts for the three configured example-merchant brands.
 *
 * This inventory names the implementation integrated in this repository. It is
 * separate from `BrandCompositionPolicy.reference`: a brand can have an internal
 * renderer contract while its external-reference state remains `uncontracted`.
 * Nothing here participates in route selection or rendering.
 */

const BRAND_IDS = ['bealls', 'beallsflorida', 'homecentric'] as const;
const MODES = ['storefront', 'content'] as const;
const SURFACES = ['home', 'plp', 'pdp', 'cart', 'checkout', 'category', 'locator'] as const;
const RECIPE_IDS = [
	'home.storefront', 'plp.storefront', 'pdp.storefront', 'cart.storefront', 'checkout.storefront',
	'home.content', 'category.content', 'locator.content',
] as const;
const CHROME_IDS = ['brand-strip-nav', 'primary-nav', 'footer', 'cart-drawer', 'picks-tray'] as const;
const COMPONENT_IDS = [
	'layout-renderer', 'zone-renderer', 'content-category-surface',
	'image-gallery', 'product-title-block', 'variant-selector', 'stock-signal', 'add-to-cart-bar',
	'description-tabs', 'reviews-summary', 'reviews-list', 'bopis-strip',
	'cart-line-items', 'cart-summary', 'free-shipping-meter', 'promo-code-entry',
	'last-chance-upsell-row', 'assurance-strip-checkout',
] as const;

export type RendererContractSurface = (typeof SURFACES)[number];
export type RendererComponentId = (typeof COMPONENT_IDS)[number];

const surfaceContractSchema = z.object({
	surface: z.enum(SURFACES),
	recipeId: z.enum(RECIPE_IDS),
	componentIds: z.array(z.enum(COMPONENT_IDS)).min(1),
}).strict();
const themeSnapshotSchema = z.object({
	primary: z.string(), secondary: z.string(), accent: z.string(),
	surfaceBg: z.string(), surfaceFg: z.string(), surfaceCard: z.string(), surfaceCardFg: z.string(),
	surfaceMuted: z.string(), surfaceMutedFg: z.string(), surfaceBorder: z.string(),
	fontDisplay: z.string(), fontBody: z.string(), fontMono: z.string(),
}).strict();

/** Strict, versioned schema for one integrated renderer contract. */
export const BeallsFamilyRendererContractSchema = z.object({
	contractVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
	organizationId: z.literal('example-merchant'),
	brandId: z.enum(BRAND_IDS),
	brandName: z.string().min(1),
	mode: z.enum(MODES),
	supportedSurfaces: z.array(surfaceContractSchema).min(1),
	ownedChromeIds: z.array(z.enum(CHROME_IDS)).min(1),
	/** Literal snapshot. Any renderer-consumed config drift requires a new contract version. */
	designConfigFingerprint: z.object({
		mode: z.enum(MODES),
		theme: themeSnapshotSchema,
		categorySlugs: z.array(z.string().min(1)).min(1),
		chromeIds: z.array(z.enum(CHROME_IDS)).min(1),
	}).strict(),
	tokenSource: z.object({
		id: z.literal('brand-config-theme-and-fonts'),
		configModule: z.literal('src/lib/brand/config.ts'),
		application: z.literal('root-layout-css-custom-properties-and-font-link'),
	}).strict(),
	responsiveStrategy: z.object({
		id: z.literal('shared-tailwind-breakpoints'),
		description: z.string().min(1),
	}).strict(),
	autonomy: z.object({
		policyRegistry: z.literal('BEALLS_COMPOSITION_POLICY'),
		organizationPolicyVersion: z.string().min(1),
		brandPolicyVersion: z.string().min(1),
		referenceState: z.literal('uncontracted'),
	}).strict(),
}).strict();
export type BeallsFamilyRendererContract = z.infer<typeof BeallsFamilyRendererContractSchema>;

const STORE_FRONT_SURFACES = [
	{ surface: 'home', recipeId: 'home.storefront', componentIds: ['layout-renderer', 'zone-renderer'] },
	{ surface: 'plp', recipeId: 'plp.storefront', componentIds: ['layout-renderer'] },
	{ surface: 'pdp', recipeId: 'pdp.storefront', componentIds: ['image-gallery', 'product-title-block', 'variant-selector', 'stock-signal', 'add-to-cart-bar', 'description-tabs', 'reviews-summary', 'reviews-list', 'bopis-strip', 'zone-renderer'] },
	{ surface: 'cart', recipeId: 'cart.storefront', componentIds: ['cart-line-items', 'cart-summary', 'free-shipping-meter', 'promo-code-entry', 'last-chance-upsell-row'] },
	{ surface: 'checkout', recipeId: 'checkout.storefront', componentIds: ['assurance-strip-checkout', 'last-chance-upsell-row'] },
] as const;

const SHARED_CHROME = ['brand-strip-nav', 'primary-nav', 'footer', 'cart-drawer', 'picks-tray'] as const;
const TOKEN_SOURCE = {
	id: 'brand-config-theme-and-fonts',
	configModule: 'src/lib/brand/config.ts',
	application: 'root-layout-css-custom-properties-and-font-link',
} as const;
const RESPONSIVE_STRATEGY = {
	id: 'shared-tailwind-breakpoints',
	description: 'Shared chrome and surface components use Tailwind responsive classes; the category nav is hidden below md, search controls adapt at sm, and surface grids and hero spacing step at sm and lg.',
} as const;

type DesignConfigFingerprint = BeallsFamilyRendererContract['designConfigFingerprint'];

function storefrontContract(brandId: 'bealls' | 'beallsflorida', brandName: string, brandPolicyVersion: string, designConfigFingerprint: DesignConfigFingerprint): BeallsFamilyRendererContract {
	return {
		contractVersion: '1.0.0', organizationId: 'example-merchant', brandId, brandName, mode: 'storefront',
		supportedSurfaces: STORE_FRONT_SURFACES.map((surface) => ({ ...surface, componentIds: [...surface.componentIds] })),
		ownedChromeIds: [...SHARED_CHROME], tokenSource: { ...TOKEN_SOURCE }, responsiveStrategy: { ...RESPONSIVE_STRATEGY },
		designConfigFingerprint,
		autonomy: { policyRegistry: 'BEALLS_COMPOSITION_POLICY', organizationPolicyVersion: 'bealls-family-org-observed-v1', brandPolicyVersion, referenceState: 'uncontracted' },
	};
}

/** One explicit record per brand, even where the renderer implementation is shared. */
export const BEALLS_FAMILY_RENDERER_CONTRACTS: Readonly<Record<(typeof BRAND_IDS)[number], BeallsFamilyRendererContract>> = {
	bealls: storefrontContract('bealls', 'bealls', 'bealls-observed-legacy-v1', {
		mode: 'storefront', chromeIds: [...SHARED_CHROME], categorySlugs: ['women', 'men', 'kids', 'shoes', 'home', 'beauty', 'handbags', 'accessories'],
		theme: { primary: '#aa182c', secondary: '#7d2540', accent: '#330A3D', surfaceBg: '#ffffff', surfaceFg: '#1a1a1a', surfaceCard: '#ffffff', surfaceCardFg: '#1a1a1a', surfaceMuted: '#f6f6f6', surfaceMutedFg: '#5a5a5a', surfaceBorder: '#e5e5e5', fontDisplay: "'Oswald', 'Bebas Neue', system-ui, sans-serif", fontBody: "'Public Sans', system-ui, sans-serif", fontMono: 'ui-monospace, Menlo, monospace' },
	}),
	beallsflorida: storefrontContract('beallsflorida', 'Bealls Florida', 'beallsflorida-observed-legacy-v1', {
		mode: 'storefront', chromeIds: [...SHARED_CHROME], categorySlugs: ['women', 'men', 'kids', 'shoes', 'home', 'vacation', 'swim', 'accessories'],
		theme: { primary: '#037cc2', secondary: '#02639c', accent: '#cf4a29', surfaceBg: '#ffffff', surfaceFg: '#1a2842', surfaceCard: '#ffffff', surfaceCardFg: '#1a2842', surfaceMuted: '#f0f5fa', surfaceMutedFg: '#5a6c83', surfaceBorder: '#dde6f0', fontDisplay: "'Playfair Display', Georgia, serif", fontBody: "'Public Sans', system-ui, sans-serif", fontMono: 'ui-monospace, Menlo, monospace' },
	}),
	homecentric: {
		contractVersion: '1.0.0', organizationId: 'example-merchant', brandId: 'homecentric', brandName: 'Home Centric', mode: 'content',
		supportedSurfaces: [
			{ surface: 'home', recipeId: 'home.content', componentIds: ['layout-renderer', 'zone-renderer'] },
			{ surface: 'category', recipeId: 'category.content', componentIds: ['content-category-surface'] },
			{ surface: 'locator', recipeId: 'locator.content', componentIds: ['zone-renderer'] },
		],
		ownedChromeIds: [...SHARED_CHROME], tokenSource: { ...TOKEN_SOURCE }, responsiveStrategy: { ...RESPONSIVE_STRATEGY },
		designConfigFingerprint: {
			mode: 'content', chromeIds: [...SHARED_CHROME], categorySlugs: ['bedroom', 'bath', 'rugs', 'kitchen', 'lighting', 'decor', 'furniture'],
			theme: { primary: '#328812', secondary: '#3a9f15', accent: '#d04429', surfaceBg: '#ffffff', surfaceFg: '#1a1a1a', surfaceCard: '#ffffff', surfaceCardFg: '#1a1a1a', surfaceMuted: '#f7f8f4', surfaceMutedFg: '#5a5a5a', surfaceBorder: '#e8eae5', fontDisplay: "'Lora', Georgia, serif", fontBody: "'Source Sans 3', system-ui, sans-serif", fontMono: "'JetBrains Mono', Menlo, monospace" },
		},
		autonomy: { policyRegistry: 'BEALLS_COMPOSITION_POLICY', organizationPolicyVersion: 'bealls-family-org-observed-v1', brandPolicyVersion: 'homecentric-observed-legacy-v1', referenceState: 'uncontracted' },
	},
};

export interface RendererContractValidationSources {
	brandById: (brandId: string) => BrandConfig | undefined;
	policyRegistry: CompositionPolicyRegistry;
}
const DEFAULT_SOURCES: RendererContractValidationSources = { brandById: getBrandById, policyRegistry: BEALLS_COMPOSITION_POLICY };

export class RendererContractValidationError extends Error {
	constructor(message: string) { super(`renderer contract: ${message}`); this.name = 'RendererContractValidationError'; }
}

/** Gets only a declared contract record; inherited and prototype keys fail closed. */
export function getBeallsFamilyRendererContract(brandId: string): BeallsFamilyRendererContract | undefined {
	return ownLookup(BEALLS_FAMILY_RENDERER_CONTRACTS, brandId);
}

/** Tests whether a component is supported by a declared surface in this contract. */
export function supportsRendererComponent(contract: BeallsFamilyRendererContract, surface: string, componentId: string): boolean {
	return contract.supportedSurfaces.some((entry) => entry.surface === surface && entry.componentIds.includes(componentId as RendererComponentId));
}

/**
 * Validates one contract against the configured brand and its policy record.
 * External-reference preservation remains an independent, explicit `uncontracted` axis.
 */
export function validateBeallsFamilyRendererContract(contract: unknown, sources: RendererContractValidationSources = DEFAULT_SOURCES): BeallsFamilyRendererContract {
	const parsed = BeallsFamilyRendererContractSchema.safeParse(contract);
	if (!parsed.success) throw new RendererContractValidationError(parsed.error.issues.map((issue) => issue.message).join('; '));
	const value = parsed.data;
	assertUnique(value.supportedSurfaces.map((surface) => surface.surface), 'supported surface');
	assertUnique(value.ownedChromeIds, 'owned chrome ID');

	const brand = sources.brandById(value.brandId);
	if (!brand) throw new RendererContractValidationError(`missing configured brand "${value.brandId}"`);
	if (brand.id !== value.brandId || brand.organizationId !== value.organizationId || brand.name !== value.brandName) throw new RendererContractValidationError('brand identity does not match BrandConfig');
	if (getBrandMode(brand) !== value.mode) throw new RendererContractValidationError('contract mode does not match BrandConfig');
	if (value.designConfigFingerprint.mode !== value.mode) throw new RendererContractValidationError('fingerprint mode does not match contract mode');
	if (!sameJson(value.designConfigFingerprint.theme, brand.theme)) throw new RendererContractValidationError('theme fingerprint does not match BrandConfig');
	if (!sameArray(value.designConfigFingerprint.categorySlugs, Object.keys(brand.categories))) throw new RendererContractValidationError('category fingerprint does not match BrandConfig');
	if (!sameArray(value.designConfigFingerprint.chromeIds, value.ownedChromeIds)) throw new RendererContractValidationError('chrome fingerprint does not match owned chrome IDs');

	const organization = ownLookup(sources.policyRegistry.organizations, value.organizationId);
	if (!organization) throw new RendererContractValidationError(`missing organization policy "${value.organizationId}"`);
	if (organization.policyVersion !== value.autonomy.organizationPolicyVersion) throw new RendererContractValidationError('organization policy version does not match autonomy linkage');
	const policy = ownLookup(sources.policyRegistry.brands, value.brandId);
	if (!policy || policy.organizationId !== value.organizationId || policy.brandId !== value.brandId) throw new RendererContractValidationError('brand policy does not match organization and brand identity');
	if (policy.policyVersion !== value.autonomy.brandPolicyVersion) throw new RendererContractValidationError('brand policy version does not match autonomy linkage');
	if (policy.reference.state !== 'uncontracted' || value.autonomy.referenceState !== 'uncontracted') throw new RendererContractValidationError('external reference state must remain explicitly uncontracted');

	for (const entry of value.supportedSurfaces) {
		if (!ownLookup(policy.surfaces, entry.surface as PolicySurface)) throw new RendererContractValidationError(`unsupported surface "${entry.surface}" is absent from the brand policy`);
		const expected = ownLookup(RECIPE_SURFACES, entry.recipeId);
		if (!expected || expected.surface !== entry.surface || expected.mode !== value.mode) throw new RendererContractValidationError(`recipe "${entry.recipeId}" does not support ${value.mode}/${entry.surface}`);
		for (const componentId of entry.componentIds) if (!supportsRecipeComponent(entry.recipeId, componentId)) throw new RendererContractValidationError(`component "${componentId}" is not supported by recipe "${entry.recipeId}"`);
	}
	return value;
}

const RECIPE_SURFACES: Record<(typeof RECIPE_IDS)[number], { surface: RendererContractSurface; mode: (typeof MODES)[number] }> = {
	'home.storefront': { surface: 'home', mode: 'storefront' }, 'plp.storefront': { surface: 'plp', mode: 'storefront' }, 'pdp.storefront': { surface: 'pdp', mode: 'storefront' }, 'cart.storefront': { surface: 'cart', mode: 'storefront' }, 'checkout.storefront': { surface: 'checkout', mode: 'storefront' },
	'home.content': { surface: 'home', mode: 'content' }, 'category.content': { surface: 'category', mode: 'content' }, 'locator.content': { surface: 'locator', mode: 'content' },
};
const RECIPE_COMPONENTS: Record<(typeof RECIPE_IDS)[number], readonly RendererComponentId[]> = {
	'home.storefront': ['layout-renderer', 'zone-renderer'], 'plp.storefront': ['layout-renderer'],
	'pdp.storefront': ['image-gallery', 'product-title-block', 'variant-selector', 'stock-signal', 'add-to-cart-bar', 'description-tabs', 'reviews-summary', 'reviews-list', 'bopis-strip', 'zone-renderer'],
	'cart.storefront': ['cart-line-items', 'cart-summary', 'free-shipping-meter', 'promo-code-entry', 'last-chance-upsell-row'], 'checkout.storefront': ['assurance-strip-checkout', 'last-chance-upsell-row'],
	'home.content': ['layout-renderer', 'zone-renderer'], 'category.content': ['content-category-surface'], 'locator.content': ['zone-renderer'],
};
function supportsRecipeComponent(recipeId: (typeof RECIPE_IDS)[number], componentId: RendererComponentId): boolean { return RECIPE_COMPONENTS[recipeId].includes(componentId); }
function ownLookup<T>(record: Readonly<Record<string, T>>, key: string): T | undefined { return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined; }
function assertUnique(values: readonly string[], label: string): void { if (new Set(values).size !== values.length) throw new RendererContractValidationError(`duplicate ${label}`); }
function sameArray(left: readonly string[], right: readonly string[]): boolean { return left.length === right.length && left.every((value, index) => value === right[index]); }
function sameJson(left: unknown, right: unknown): boolean { return JSON.stringify(left) === JSON.stringify(right); }
