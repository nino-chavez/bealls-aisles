import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getBrandById, getBrandMode, type BrandConfig } from './config';
import { BEALLS_COMPOSITION_POLICY } from './composition-policy';
import type { CompositionPolicyRegistry, PolicySurface } from '../foundation/composition-policy';

/**
 * Internal renderer contracts for the three configured example-merchant brands.
 *
 * This is a versioned snapshot of the implementation integrated in this
 * repository. It does not participate in route selection or rendering. The
 * focused contract test reads the recorded source files and recomputes their
 * fingerprint; Git itself cannot require a contract-version bump.
 *
 * This inventory is separate from `BrandCompositionPolicy.reference`: every
 * external-reference state remains explicitly `uncontracted`.
 */

const BRAND_IDS = ['bealls', 'beallsflorida', 'homecentric'] as const;
const MODES = ['storefront', 'content'] as const;
const SURFACES = [
	'home', 'plp', 'pdp', 'cart', 'checkout', 'search', 'account', 'compare', 'category', 'locator', 'style-guide', 'error-404', 'error-empty',
] as const;
const RESCUE_REASONS = ['not-found', 'empty-cart', 'empty-search'] as const;
const RECIPE_IDS = [
	'home.storefront', 'plp.storefront', 'pdp.storefront', 'cart.storefront', 'checkout.storefront',
	'search.storefront', 'account.storefront', 'compare.storefront',
	'home.content', 'category.content', 'locator.shared', 'style-guide.shared', 'error-404.shared',
	'error-empty.storefront',
] as const;
const CHROME_IDS = ['brand-strip-nav', 'primary-nav', 'footer', 'cart-drawer', 'picks-tray'] as const;
const COMPONENT_IDS = [
	'layout-renderer', 'zone-renderer', 'content-category-surface', 'store-locator-surface', 'empty-rescue',
	'image-gallery', 'product-title-block', 'variant-selector', 'stock-signal', 'add-to-cart-bar',
	'description-tabs', 'reviews-summary', 'reviews-list', 'bopis-strip',
	'cart-line-items', 'cart-summary', 'free-shipping-meter', 'promo-code-entry',
	'last-chance-upsell-row', 'assurance-strip-checkout',
	'search-results', 'account-dashboard', 'persona-ranked-product-row', 'comparison-table',
] as const;

/**
 * Bounded owners of the route, chrome, renderer, schema, and runtime design
 * configuration represented by this snapshot. Transitive data-service code is
 * deliberately outside this renderer gate.
 */
export const BEALLS_FAMILY_RENDERER_SOURCE_FILES = [
	'src/app.css',
	'src/lib/brand/composition-policy.ts',
	'src/lib/brand/bealls-family-runtime-contract.ts',
	'src/lib/brand/config.ts',
	'src/lib/brand/pricing.ts',
	'src/lib/components/AILoadingInline.svelte',
	'src/lib/components/BrandStripNav.svelte',
	'src/lib/components/CartDrawer.svelte',
	'src/lib/components/EmptyRescue.svelte',
	'src/lib/components/Footer.svelte',
	'src/lib/components/LayoutBuildingState.svelte',
	'src/lib/components/Nav.svelte',
	'src/lib/components/PicksTray.svelte',
	'src/lib/components/dev/DevToolbar.svelte',
	'src/lib/components/dev/DevZoneBadge.svelte',
	'src/lib/components/layouts/ContentCategorySurface.svelte',
	'src/lib/components/layouts/GathererLayout.svelte',
	'src/lib/components/layouts/GifterLayout.svelte',
	'src/lib/components/layouts/HunterLayout.svelte',
	'src/lib/components/layouts/LayoutRenderer.svelte',
	'src/lib/components/layouts/LayoutSkeleton.svelte',
	'src/lib/components/layouts/ResearcherLayout.svelte',
	'src/lib/components/layouts/sections/AddToCartBar.svelte',
	'src/lib/components/layouts/sections/AssuranceStripCheckout.svelte',
	'src/lib/components/layouts/sections/BOPISPicker.svelte',
	'src/lib/components/layouts/sections/BOPISStrip.svelte',
	'src/lib/components/layouts/sections/BeallsBucksCallout.svelte',
	'src/lib/components/layouts/sections/BrandSpotlight.svelte',
	'src/lib/components/layouts/sections/CartLineItems.svelte',
	'src/lib/components/layouts/sections/CartSummary.svelte',
	'src/lib/components/layouts/sections/CategoryHeader.svelte',
	'src/lib/components/layouts/sections/CategoryTileGrid.svelte',
	'src/lib/components/layouts/sections/ClusterChipRow.svelte',
	'src/lib/components/layouts/sections/CouponStrip.svelte',
	'src/lib/components/layouts/sections/DescriptionTabs.svelte',
	'src/lib/components/layouts/sections/EditorialHeader.svelte',
	'src/lib/components/layouts/sections/EditorialHero.svelte',
	'src/lib/components/layouts/sections/EmailCaptureInline.svelte',
	'src/lib/components/layouts/sections/EventCountdown.svelte',
	'src/lib/components/layouts/sections/FreeShippingMeter.svelte',
	'src/lib/components/layouts/sections/ForYouRow.svelte',
	'src/lib/components/layouts/sections/HeroProduct.svelte',
	'src/lib/components/layouts/sections/ImageGallery.svelte',
	'src/lib/components/layouts/sections/LastChanceUpsellRow.svelte',
	'src/lib/components/layouts/sections/LifestylePriceHero.svelte',
	'src/lib/components/layouts/sections/LocatorStrip.svelte',
	'src/lib/components/layouts/sections/PriceRail.svelte',
	'src/lib/components/layouts/sections/ProductCarousel.svelte',
	'src/lib/components/layouts/sections/ProductGrid.svelte',
	'src/lib/components/layouts/sections/ProductTitleBlock.svelte',
	'src/lib/components/layouts/sections/PromoCodeEntry.svelte',
	'src/lib/components/layouts/sections/PromoStrip.svelte',
	'src/lib/components/layouts/sections/ReviewsList.svelte',
	'src/lib/components/layouts/sections/ReviewsSummary.svelte',
	'src/lib/components/layouts/sections/ServiceCalloutsGrid.svelte',
	'src/lib/components/layouts/sections/StockSignal.svelte',
	'src/lib/components/layouts/sections/TrendShop.svelte',
	'src/lib/components/layouts/sections/VariantSelector.svelte',
	'src/lib/components/primitives/Button.svelte',
	'src/lib/components/primitives/Chip.svelte',
	'src/lib/components/primitives/FilterStrip.svelte',
	'src/lib/components/primitives/PriceLabel.svelte',
	'src/lib/components/primitives/ProductCard.svelte',
	'src/lib/components/primitives/SortSelector.svelte',
	'src/lib/components/primitives/StructuredData.svelte',
	'src/lib/components/primitives/Toast.svelte',
	'src/lib/foundation/RuntimeZone.svelte',
	'src/lib/foundation/RuntimeEnvelopeZone.svelte',
	'src/lib/foundation/ZoneRenderer.svelte',
	'src/lib/foundation/ZoneExecutionEvidence.svelte',
	'src/lib/foundation/composition-policy.ts',
	'src/lib/foundation/fallbacks/cart.ts',
	'src/lib/foundation/fallbacks/checkout.ts',
	'src/lib/foundation/fallbacks/home.ts',
	'src/lib/foundation/fallbacks/index.ts',
	'src/lib/foundation/fallbacks/pdp.ts',
	'src/lib/foundation/fallbacks/plp.ts',
	'src/lib/foundation/resolve-zone.ts',
	'src/lib/foundation/runtime-zone-envelope.ts',
	'src/lib/foundation/shopper-product.ts',
	'src/lib/foundation/zone-decision-envelope-schema.ts',
	'src/lib/foundation/zone-schemas.ts',
	'src/lib/foundation/zones.ts',
	'src/lib/schema/blocks.ts',
	'src/lib/schema/layout.ts',
	'src/lib/schema/layouts/cart.ts',
	'src/lib/schema/layouts/checkout.ts',
	'src/lib/schema/layouts/empty.ts',
	'src/lib/schema/layouts/home.ts',
	'src/lib/schema/layouts/pdp.ts',
	'src/lib/schema/layouts/plp.ts',
	'src/lib/server/layout-prompt.ts',
	'src/lib/server/access-gates.ts',
	'src/lib/server/admin-overrides.ts',
	'src/lib/server/bigcommerce.ts',
	'src/lib/server/cache.ts',
	'src/lib/server/parity-fixture.ts',
	'src/lib/server/route-zone-runtime.ts',
	'src/lib/server/shopper-route-runtime.ts',
	'src/lib/server/zone-output-runtime.ts',
	'src/lib/server/zone-decision-envelope.ts',
	'src/lib/server/zone-content-store-gate.ts',
	'src/lib/server/brand-surface-guard.ts',
	'src/lib/server/resolve-zone-async.ts',
	'src/lib/stores/picks.svelte.ts',
	'src/routes/+error.svelte',
	'src/routes/+layout.server.ts',
	'src/routes/+layout.svelte',
	'src/routes/+page.server.ts',
	'src/routes/+page.svelte',
	'src/routes/api/layout/+server.ts',
	'src/routes/api/layout/stream/+server.ts',
	'src/routes/api/observe/enrichment/+server.ts',
	'src/routes/api/observe/inference/+server.ts',
	'src/routes/api/observe/logs/+server.ts',
	'src/routes/api/observe/session/+server.ts',
	'src/routes/api/observe/sessions/+server.ts',
	'src/routes/api/refine/+server.ts',
	'src/routes/api/suggest/+server.ts',
	'src/routes/account/+page.server.ts',
	'src/routes/account/+page.svelte',
	'src/routes/cart/+page.server.ts',
	'src/routes/cart/+page.svelte',
	'src/routes/category/[slug]/+page.server.ts',
	'src/routes/category/[slug]/+page.svelte',
	'src/routes/checkout/+page.server.ts',
	'src/routes/checkout/+page.svelte',
	'src/routes/compare/+page.server.ts',
	'src/routes/compare/+page.svelte',
	'src/routes/product/[slug]/+page.server.ts',
	'src/routes/product/[slug]/+page.svelte',
	'src/routes/observe/+page.server.ts',
	'src/routes/search/+page.server.ts',
	'src/routes/search/+page.svelte',
	'src/routes/store-locator/+page.server.ts',
	'src/routes/store-locator/+page.svelte',
	'src/routes/style-guide/+page.server.ts',
	'src/routes/style-guide/+page.svelte',
	'src/routes/test/+layout.server.ts',
	'src/routes/test/components/+page.svelte',
] as const;

const DESIGN_CONFIG_INPUTS = [
	'organizationId', 'id', 'name', 'tagline', 'domain', 'footerNote', 'mode', 'bc', 'categories',
	'theme', 'googleFontsUrl', 'homepage', 'prompt', 'incentives', 'pricingStyle',
] as const;

export type RendererContractSurface = (typeof SURFACES)[number];
export type RendererComponentId = (typeof COMPONENT_IDS)[number];
export type RendererSourceFile = (typeof BEALLS_FAMILY_RENDERER_SOURCE_FILES)[number];

export interface RendererRouteEvidence {
	file: RendererSourceFile;
	kind: 'brand-surface' | 'development-harness';
	surfaces: readonly RendererContractSurface[];
}

/**
 * Every SvelteKit route that directly imports or renders LayoutRenderer must
 * declare why it exists. The harness route is deliberately tracked by the
 * source snapshot without being presented as a supported shopper surface.
 */
export const BEALLS_FAMILY_LAYOUT_RENDERER_ROUTE_EVIDENCE = [
	{ file: 'src/routes/style-guide/+page.svelte', kind: 'brand-surface', surfaces: ['style-guide'] },
	{ file: 'src/routes/test/components/+page.svelte', kind: 'development-harness', surfaces: [] },
] as const satisfies readonly RendererRouteEvidence[];

const surfaceContractSchema = z.object({
	surface: z.enum(SURFACES),
	recipeId: z.enum(RECIPE_IDS),
	componentIds: z.array(z.enum(COMPONENT_IDS)).min(1),
	rescueReasons: z.array(z.enum(RESCUE_REASONS)),
}).strict();
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

/** Strict, versioned schema for one integrated renderer snapshot. */
export const BeallsFamilyRendererContractSchema = z.object({
	contractVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
	organizationId: z.literal('example-merchant'),
	brandId: z.enum(BRAND_IDS),
	brandName: z.string().min(1),
	mode: z.enum(MODES),
	supportedSurfaces: z.array(surfaceContractSchema).min(1),
	mountedChromeIds: z.array(z.enum(CHROME_IDS)).min(1),
	exposedChromeIds: z.array(z.enum(CHROME_IDS)).min(1),
	designConfigSnapshot: z.object({
		algorithm: z.literal('sha256'),
		inputs: z.array(z.enum(DESIGN_CONFIG_INPUTS)).min(1),
		googleFontsUrl: z.string().url(),
		fingerprint: sha256Schema,
	}).strict(),
	sourceSnapshot: z.object({
		algorithm: z.literal('sha256'),
		files: z.array(z.enum(BEALLS_FAMILY_RENDERER_SOURCE_FILES)).min(1),
		fingerprint: sha256Schema,
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

const STOREFRONT_SURFACES = [
	{ surface: 'home', recipeId: 'home.storefront', componentIds: ['zone-renderer'], rescueReasons: [] },
	{ surface: 'plp', recipeId: 'plp.storefront', componentIds: ['zone-renderer'], rescueReasons: [] },
	{ surface: 'pdp', recipeId: 'pdp.storefront', componentIds: ['image-gallery', 'product-title-block', 'variant-selector', 'stock-signal', 'add-to-cart-bar', 'description-tabs', 'reviews-summary', 'reviews-list', 'bopis-strip', 'zone-renderer'], rescueReasons: [] },
	{ surface: 'cart', recipeId: 'cart.storefront', componentIds: ['cart-line-items', 'cart-summary', 'free-shipping-meter', 'promo-code-entry', 'last-chance-upsell-row'], rescueReasons: [] },
	{ surface: 'checkout', recipeId: 'checkout.storefront', componentIds: ['assurance-strip-checkout', 'last-chance-upsell-row'], rescueReasons: [] },
	{ surface: 'search', recipeId: 'search.storefront', componentIds: ['search-results', 'empty-rescue'], rescueReasons: [] },
	{ surface: 'account', recipeId: 'account.storefront', componentIds: ['account-dashboard', 'persona-ranked-product-row'], rescueReasons: [] },
	{ surface: 'compare', recipeId: 'compare.storefront', componentIds: ['comparison-table'], rescueReasons: [] },
] as const;
const LOCATOR_SURFACE = {
	surface: 'locator', recipeId: 'locator.shared',
	componentIds: ['store-locator-surface', 'zone-renderer'], rescueReasons: [],
} as const;
const STYLE_GUIDE_SURFACE = {
	surface: 'style-guide', recipeId: 'style-guide.shared',
	componentIds: ['layout-renderer'], rescueReasons: [],
} as const;
const ERROR_404_SURFACE = {
	surface: 'error-404', recipeId: 'error-404.shared',
	componentIds: ['empty-rescue'], rescueReasons: ['not-found'],
} as const;
const STOREFRONT_EMPTY_SURFACE = {
	surface: 'error-empty', recipeId: 'error-empty.storefront',
	componentIds: ['empty-rescue'],
	rescueReasons: ['empty-cart', 'empty-search'],
} as const;

const MOUNTED_CHROME = ['brand-strip-nav', 'primary-nav', 'footer', 'cart-drawer', 'picks-tray'] as const;
const STOREFRONT_EXPOSED_CHROME = [...MOUNTED_CHROME] as const;
const CONTENT_EXPOSED_CHROME = ['brand-strip-nav', 'primary-nav', 'footer'] as const;
const TOKEN_SOURCE = {
	id: 'brand-config-theme-and-fonts',
	configModule: 'src/lib/brand/config.ts',
	application: 'root-layout-css-custom-properties-and-font-link',
} as const;
const RESPONSIVE_STRATEGY = {
	id: 'shared-tailwind-breakpoints',
	description: 'Shared chrome and surface components use Tailwind responsive classes; the category nav is hidden below md, search controls adapt at sm, and surface grids and hero spacing step at sm and lg.',
} as const;

const SOURCE_SNAPSHOT = {
	algorithm: 'sha256',
	files: [...BEALLS_FAMILY_RENDERER_SOURCE_FILES],
	fingerprint: '6697c299eb641849e9781dee452f89416dd3e1ef63ef3936e6fa6847abf1c997',
} as const;

interface DesignSnapshotLiteral {
	googleFontsUrl: string;
	fingerprint: string;
}

function storefrontContract(
	brandId: 'bealls' | 'beallsflorida',
	brandName: string,
	brandPolicyVersion: string,
	designSnapshot: DesignSnapshotLiteral,
): BeallsFamilyRendererContract {
	return {
		contractVersion: '2.4.0', organizationId: 'example-merchant', brandId, brandName, mode: 'storefront',
		supportedSurfaces: [...STOREFRONT_SURFACES, LOCATOR_SURFACE, STYLE_GUIDE_SURFACE, ERROR_404_SURFACE, STOREFRONT_EMPTY_SURFACE].map(cloneSurface),
		mountedChromeIds: [...MOUNTED_CHROME], exposedChromeIds: [...STOREFRONT_EXPOSED_CHROME],
		designConfigSnapshot: { algorithm: 'sha256', inputs: [...DESIGN_CONFIG_INPUTS], ...designSnapshot },
		sourceSnapshot: { ...SOURCE_SNAPSHOT, files: [...SOURCE_SNAPSHOT.files] },
		tokenSource: { ...TOKEN_SOURCE }, responsiveStrategy: { ...RESPONSIVE_STRATEGY },
		autonomy: { policyRegistry: 'BEALLS_COMPOSITION_POLICY', organizationPolicyVersion: 'bealls-family-org-observed-v2', brandPolicyVersion, referenceState: 'uncontracted' },
	};
}

/** One explicit record per brand, even where the renderer implementation is shared. */
export const BEALLS_FAMILY_RENDERER_CONTRACTS: Readonly<Record<(typeof BRAND_IDS)[number], BeallsFamilyRendererContract>> = {
	bealls: storefrontContract('bealls', 'bealls', 'bealls-executable-runtime-v6', {
		googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Public+Sans:wght@400;500;600;700&display=swap',
		fingerprint: '789eb043880e8daed628c65a483591a8aa4367d560a846cfc7b4e4c1cdd2052b',
	}),
	beallsflorida: storefrontContract('beallsflorida', 'Bealls Florida', 'beallsflorida-executable-runtime-v6', {
		googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Public+Sans:wght@400;500;600;700&display=swap',
		fingerprint: '746ae8604bccee7b0169b1a961bc0104186f95b2c314dac8c5e191e94fe34222',
	}),
	homecentric: {
		contractVersion: '2.4.0', organizationId: 'example-merchant', brandId: 'homecentric', brandName: 'Home Centric', mode: 'content',
		supportedSurfaces: ([
			{ surface: 'home', recipeId: 'home.content', componentIds: ['zone-renderer'], rescueReasons: [] },
			{ surface: 'category', recipeId: 'category.content', componentIds: ['content-category-surface'], rescueReasons: [] },
			LOCATOR_SURFACE, STYLE_GUIDE_SURFACE, ERROR_404_SURFACE,
		] as const).map(cloneSurface),
		mountedChromeIds: [...MOUNTED_CHROME], exposedChromeIds: [...CONTENT_EXPOSED_CHROME],
		designConfigSnapshot: {
			algorithm: 'sha256', inputs: [...DESIGN_CONFIG_INPUTS],
			googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,600&family=Source+Sans+3:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
			fingerprint: '048b018b0fa74f7743bbbc294abf0ec4e67d060f01ed71e3624b0bf886598590',
		},
		sourceSnapshot: { ...SOURCE_SNAPSHOT, files: [...SOURCE_SNAPSHOT.files] },
		tokenSource: { ...TOKEN_SOURCE }, responsiveStrategy: { ...RESPONSIVE_STRATEGY },
		autonomy: { policyRegistry: 'BEALLS_COMPOSITION_POLICY', organizationPolicyVersion: 'bealls-family-org-observed-v2', brandPolicyVersion: 'homecentric-executable-runtime-v6', referenceState: 'uncontracted' },
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
 * Validates one contract against current brand inputs and policy records.
 * The focused package test separately validates the recorded source snapshot.
 */
export function validateBeallsFamilyRendererContract(
	contract: unknown,
	sources: RendererContractValidationSources = DEFAULT_SOURCES,
): BeallsFamilyRendererContract {
	const parsed = BeallsFamilyRendererContractSchema.safeParse(contract);
	if (!parsed.success) throw new RendererContractValidationError(parsed.error.issues.map((issue) => issue.message).join('; '));
	const value = parsed.data;
	assertUnique(value.supportedSurfaces.map((surface) => surface.surface), 'supported surface');
	assertUnique(value.mountedChromeIds, 'mounted chrome ID');
	assertUnique(value.exposedChromeIds, 'exposed chrome ID');
	assertUnique(value.sourceSnapshot.files, 'source file');
	assertSubset(value.exposedChromeIds, value.mountedChromeIds, 'exposed chrome', 'mounted chrome');

	const brand = sources.brandById(value.brandId);
	if (!brand) throw new RendererContractValidationError(`missing configured brand "${value.brandId}"`);
	if (brand.id !== value.brandId || brand.organizationId !== value.organizationId || brand.name !== value.brandName) throw new RendererContractValidationError('brand identity does not match BrandConfig');
	if (getBrandMode(brand) !== value.mode) throw new RendererContractValidationError('contract mode does not match BrandConfig');
	if (!sameArray(value.designConfigSnapshot.inputs, DESIGN_CONFIG_INPUTS)) throw new RendererContractValidationError('design-config input inventory is incomplete or out of order');
	if (value.designConfigSnapshot.googleFontsUrl !== brand.googleFontsUrl) throw new RendererContractValidationError('Google Fonts URL does not match BrandConfig');
	if (value.designConfigSnapshot.fingerprint !== fingerprintRendererDesignConfig(brand)) throw new RendererContractValidationError('design-config snapshot fingerprint does not match BrandConfig');
	if (!sameArray(value.sourceSnapshot.files, BEALLS_FAMILY_RENDERER_SOURCE_FILES)) throw new RendererContractValidationError('source-file inventory is incomplete or out of order');

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
		if (!expected || expected.surface !== entry.surface || !expected.modes.includes(value.mode)) throw new RendererContractValidationError(`recipe "${entry.recipeId}" does not support ${value.mode}/${entry.surface}`);
		if (!sameArray(entry.componentIds, RECIPE_COMPONENTS[entry.recipeId])) throw new RendererContractValidationError(`component inventory does not match recipe "${entry.recipeId}"`);
		if (!sameArray(entry.rescueReasons, RECIPE_RESCUE_REASONS[entry.recipeId])) throw new RendererContractValidationError(`rescue-reason inventory does not match recipe "${entry.recipeId}"`);
	}
	return value;
}

/** Recomputes and validates the bounded source snapshot recorded by a contract. */
export function validateBeallsFamilyRendererSourceSnapshot(
	contract: BeallsFamilyRendererContract,
	readSourceFile: (path: RendererSourceFile) => string,
): void {
	const actual = fingerprintRendererSourceFiles(contract.sourceSnapshot.files, readSourceFile);
	if (actual !== contract.sourceSnapshot.fingerprint) throw new RendererContractValidationError('source snapshot fingerprint mismatch');
}

/** Finds SvelteKit route components that directly consume LayoutRenderer. */
export function discoverBeallsFamilyLayoutRendererRoutes(
	routeFiles: readonly string[],
	readRouteFile: (path: string) => string,
): string[] {
	return [...new Set(routeFiles)]
		.filter(isSvelteKitRouteComponent)
		.filter((path) => sourceUsesGovernedLayoutRenderer(readRouteFile(path)))
		.sort();
}

/**
 * Fails closed when a LayoutRenderer route lacks route evidence or when that
 * route and its sibling load module are absent from the source snapshot.
 */
export function validateBeallsFamilyLayoutRendererRouteCoverage(
	routeFiles: readonly string[],
	readRouteFile: (path: string) => string,
): void {
	const discovered = discoverBeallsFamilyLayoutRendererRoutes(routeFiles, readRouteFile);
	const evidenceFiles = BEALLS_FAMILY_LAYOUT_RENDERER_ROUTE_EVIDENCE.map((entry) => entry.file);
	const evidenceSet = new Set<string>(evidenceFiles);
	const discoveredSet = new Set(discovered);
	const missingEvidence = discovered.filter((path) => !evidenceSet.has(path));
	const staleEvidence = evidenceFiles.filter((path) => !discoveredSet.has(path));
	if (missingEvidence.length) throw new RendererContractValidationError(`LayoutRenderer route lacks surface evidence: ${missingEvidence.join(', ')}`);
	if (staleEvidence.length) throw new RendererContractValidationError(`LayoutRenderer route evidence is stale: ${staleEvidence.join(', ')}`);

	const snapshotFiles = new Set<string>(BEALLS_FAMILY_RENDERER_SOURCE_FILES);
	const governedSources = relatedSvelteKitRouteSources(discovered, routeFiles);
	const untrackedSources = governedSources.filter((path) => !snapshotFiles.has(path));
	if (untrackedSources.length) throw new RendererContractValidationError(`LayoutRenderer route source is absent from snapshot: ${untrackedSources.join(', ')}`);
}

/** Stable SHA-256 over the runtime BrandConfig inputs that affect rendered surfaces. */
export function fingerprintRendererDesignConfig(brand: BrandConfig): string {
	return sha256(stableJson({
		organizationId: brand.organizationId,
		id: brand.id,
		name: brand.name,
		tagline: brand.tagline,
		domain: brand.domain,
		footerNote: brand.footerNote,
		mode: getBrandMode(brand),
		bc: brand.bc,
		categories: brand.categories,
		theme: brand.theme,
		googleFontsUrl: brand.googleFontsUrl,
		homepage: brand.homepage,
		prompt: brand.prompt,
		incentives: brand.incentives ?? null,
		pricingStyle: brand.pricingStyle ?? 'standard',
	}));
}

/** Stable SHA-256 over normalized paths and source text, independent of list order. */
export function fingerprintRendererSourceFiles(
	files: readonly RendererSourceFile[],
	readSourceFile: (path: RendererSourceFile) => string,
): string {
	const hash = createHash('sha256');
	for (const path of [...files].sort()) {
		const source = readSourceFile(path).replace(/\r\n/g, '\n');
		hash.update(path, 'utf8');
		hash.update('\0', 'utf8');
		hash.update(source, 'utf8');
		hash.update('\0', 'utf8');
	}
	return hash.digest('hex');
}

const RECIPE_SURFACES: Record<(typeof RECIPE_IDS)[number], { surface: RendererContractSurface; modes: readonly (typeof MODES)[number][] }> = {
	'home.storefront': { surface: 'home', modes: ['storefront'] },
	'plp.storefront': { surface: 'plp', modes: ['storefront'] },
	'pdp.storefront': { surface: 'pdp', modes: ['storefront'] },
	'cart.storefront': { surface: 'cart', modes: ['storefront'] },
	'checkout.storefront': { surface: 'checkout', modes: ['storefront'] },
	'search.storefront': { surface: 'search', modes: ['storefront'] },
	'account.storefront': { surface: 'account', modes: ['storefront'] },
	'compare.storefront': { surface: 'compare', modes: ['storefront'] },
	'home.content': { surface: 'home', modes: ['content'] },
	'category.content': { surface: 'category', modes: ['content'] },
	'locator.shared': { surface: 'locator', modes: ['storefront', 'content'] },
	'style-guide.shared': { surface: 'style-guide', modes: ['storefront', 'content'] },
	'error-404.shared': { surface: 'error-404', modes: ['storefront', 'content'] },
	'error-empty.storefront': { surface: 'error-empty', modes: ['storefront'] },
};
const RECIPE_COMPONENTS: Record<(typeof RECIPE_IDS)[number], readonly RendererComponentId[]> = {
	'home.storefront': ['zone-renderer'],
	'plp.storefront': ['zone-renderer'],
	'pdp.storefront': ['image-gallery', 'product-title-block', 'variant-selector', 'stock-signal', 'add-to-cart-bar', 'description-tabs', 'reviews-summary', 'reviews-list', 'bopis-strip', 'zone-renderer'],
	'cart.storefront': ['cart-line-items', 'cart-summary', 'free-shipping-meter', 'promo-code-entry', 'last-chance-upsell-row'],
	'checkout.storefront': ['assurance-strip-checkout', 'last-chance-upsell-row'],
	'search.storefront': ['search-results', 'empty-rescue'],
	'account.storefront': ['account-dashboard', 'persona-ranked-product-row'],
	'compare.storefront': ['comparison-table'],
	'home.content': ['zone-renderer'],
	'category.content': ['content-category-surface'],
	'locator.shared': ['store-locator-surface', 'zone-renderer'],
	'style-guide.shared': ['layout-renderer'],
	'error-404.shared': ['empty-rescue'],
	'error-empty.storefront': ['empty-rescue'],
};
const RECIPE_RESCUE_REASONS: Record<(typeof RECIPE_IDS)[number], readonly (typeof RESCUE_REASONS)[number][]> = {
	'home.storefront': [], 'plp.storefront': [], 'pdp.storefront': [], 'cart.storefront': [], 'checkout.storefront': [],
	'search.storefront': [], 'account.storefront': [], 'compare.storefront': [],
	'home.content': [], 'category.content': [], 'locator.shared': [], 'style-guide.shared': [],
	'error-404.shared': ['not-found'],
	'error-empty.storefront': ['empty-cart', 'empty-search'],
};

function cloneSurface<T extends { componentIds: readonly RendererComponentId[]; rescueReasons: readonly (typeof RESCUE_REASONS)[number][] }>(surface: T) {
	return { ...surface, componentIds: [...surface.componentIds], rescueReasons: [...surface.rescueReasons] };
}
function ownLookup<T>(record: Readonly<Record<string, T>>, key: string): T | undefined { return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined; }
function assertUnique(values: readonly string[], label: string): void { if (new Set(values).size !== values.length) throw new RendererContractValidationError(`duplicate ${label}`); }
function assertSubset(child: readonly string[], parent: readonly string[], childLabel: string, parentLabel: string): void {
	const parentValues = new Set(parent);
	const missing = child.filter((value) => !parentValues.has(value));
	if (missing.length) throw new RendererContractValidationError(`${childLabel} is not present in ${parentLabel}: ${missing.join(', ')}`);
}
function sameArray(left: readonly string[], right: readonly string[]): boolean { return left.length === right.length && left.every((value, index) => value === right[index]); }
function isSvelteKitRouteComponent(path: string): boolean {
	const fileName = path.slice(path.lastIndexOf('/') + 1);
	return /^\+(?:page|layout)(?:@[^.]*)?\.svelte$/.test(fileName) || fileName === '+error.svelte';
}
function sourceUsesGovernedLayoutRenderer(source: string): boolean {
	return source.includes('LayoutRenderer.svelte') || /<LayoutRenderer(?:\s|\/|>)/.test(source);
}
function relatedSvelteKitRouteSources(rendererRoutes: readonly string[], routeFiles: readonly string[]): string[] {
	const sources = new Set<string>();
	for (const rendererRoute of rendererRoutes) {
		const splitAt = rendererRoute.lastIndexOf('/');
		const directory = rendererRoute.slice(0, splitAt);
		const fileName = rendererRoute.slice(splitAt + 1);
		const kind = /^\+(page|layout|error)/.exec(fileName)?.[1];
		if (!kind) continue;
		for (const candidate of routeFiles) {
			const candidateSplitAt = candidate.lastIndexOf('/');
			if (candidate.slice(0, candidateSplitAt) !== directory) continue;
			const candidateName = candidate.slice(candidateSplitAt + 1);
			if (new RegExp(`^\\+${kind}(?:@[^.]*)?\\.(?:svelte|server\\.(?:ts|js)|ts|js)$`).test(candidateName)) sources.add(candidate);
		}
	}
	return [...sources].sort();
}
function sha256(value: string): string { return createHash('sha256').update(value, 'utf8').digest('hex'); }
function stableJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}
