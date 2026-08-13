import type { Layout, Surface as LayoutSurface, EmptyReason } from '$lib/schema/layout';
import { getBrandById } from '$lib/brand/config';
import {
	BEALLS_FAMILY_BRAND_IDS,
	buildRuntimeCacheScope,
	compileBrandCompositionPolicy,
	registeredComponentsForLayout,
	type BeallsFamilyBrandId,
} from '$lib/brand/bealls-family-runtime-contract';
import type { EffectiveCompositionPolicy, PolicySurface } from '$lib/foundation/composition-policy';

export function policySurfaceForLayout(surface: LayoutSurface, reason?: EmptyReason): PolicySurface {
	if (surface !== 'empty') return surface;
	return reason === 'not-found' ? 'error-404' : 'error-empty';
}

export function requireModelLayoutPolicy(input: {
	brandId: string;
	surface: LayoutSurface;
	reason?: EmptyReason;
}): EffectiveCompositionPolicy {
	if (!BEALLS_FAMILY_BRAND_IDS.includes(input.brandId as BeallsFamilyBrandId)) {
		throw new Error(`layout runtime contract: unknown brand "${input.brandId}"`);
	}
	const policySurface = policySurfaceForLayout(input.surface, input.reason);
	const policy = compileBrandCompositionPolicy(input.brandId as BeallsFamilyBrandId, policySurface);
	if (policy.publicationMode !== 'live' || policy.decisionMode !== 'model') {
		throw new Error(`layout runtime contract: model publication is not live for ${input.brandId}/${policySurface}`);
	}
	const requiredCapabilities = input.surface === 'pdp'
		? ['select_component_variant', 'reorder_zones'] as const
		: input.surface === 'home' || input.surface === 'plp' || input.surface === 'empty'
			? ['select_component_variant', 'reorder_zones', 'select_page_recipe'] as const
			: ['rank_products', 'select_products', 'select_component_variant'] as const;
	if (!requiredCapabilities.every((capability) => policy.capabilities.includes(capability))) {
		throw new Error(`layout runtime contract: capabilities do not authorize ${input.brandId}/${policySurface} layout composition`);
	}
	return policy;
}

export function scopedLayoutCacheSlug(input: {
	brandId: BeallsFamilyBrandId;
	surface: LayoutSurface;
	reason?: EmptyReason;
	categorySlug: string;
}): string {
	const policySurface = policySurfaceForLayout(input.surface, input.reason);
	const scope = buildRuntimeCacheScope({ brandId: input.brandId, surface: policySurface, viewport: 'responsive' });
	const subject = input.surface === 'empty' ? `empty:${input.reason}` : input.categorySlug;
	return `${scope}:${subject}`;
}

const FORBIDDEN_RUNTIME_KEYS = new Set(['class', 'className', 'css', 'style', 'styles', 'stylesheet']);

/**
 * Second boundary after Zod: bind output to the registered component set,
 * current catalog IDs, configured assets, and internal route targets. This
 * prevents a model from inventing CSS, components, products, or destinations.
 */
export function validateRuntimeLayout(input: {
	brandId: BeallsFamilyBrandId;
	surface: LayoutSurface;
	layout: unknown;
	candidateProductIds: readonly string[];
	candidateAssetUrls?: readonly string[];
}): Layout {
	if (!input.layout || typeof input.layout !== 'object') throw new Error('layout runtime contract: layout is required');
	const layout = input.layout as Layout;
	const allowedComponents = new Set(registeredComponentsForLayout(input.brandId, input.surface));
	for (const section of layout.sections ?? []) {
		if (!allowedComponents.has(section.component)) {
			throw new Error(`layout runtime contract: unregistered component "${section.component}"`);
		}
	}

	const brand = getBrandById(input.brandId);
	if (!brand) throw new Error(`layout runtime contract: unknown brand "${input.brandId}"`);
	const allowedProductIds = new Set(input.candidateProductIds.map(String));
	const allowedHrefs = new Set([
		'/', '/store-locator', '/search',
		...Object.keys(brand.categories).map((slug) => `/category/${slug}`),
		...input.candidateProductIds.map((id) => `/product/${id}`),
	]);
	const allowedAssets = new Set([
		brand.homepage.heroImage,
		...Object.values(brand.categories).map((category) => category.tileImage),
		...(input.candidateAssetUrls ?? []),
	].filter((value): value is string => !!value));

	walkRuntimeValue(layout, (key, value) => {
		if (FORBIDDEN_RUNTIME_KEYS.has(key) || key.startsWith('--')) {
			throw new Error(`layout runtime contract: runtime styling key "${key}" is forbidden`);
		}
		if ((key === 'productId' || key === 'productOrder') && typeof value === 'string' && !allowedProductIds.has(value)) {
			throw new Error(`layout runtime contract: product "${value}" is outside the candidate set`);
		}
		if ((key === 'href' || key.endsWith('Href')) && typeof value === 'string' && !allowedHrefs.has(normalizeHref(value))) {
			throw new Error(`layout runtime contract: destination "${value}" is not registered`);
		}
		if ((key === 'image' || key === 'url' || key.endsWith('Image')) && typeof value === 'string' && !allowedAssets.has(value)) {
			throw new Error(`layout runtime contract: asset "${value}" is not registered`);
		}
		if (typeof value === 'string' && /^(?:https?:)?\/\//i.test(value) && !allowedAssets.has(value)) {
			throw new Error(`layout runtime contract: URL "${value}" is not registered`);
		}
	});
	for (const productId of layout.productOrder ?? []) {
		if (!allowedProductIds.has(String(productId))) {
			throw new Error(`layout runtime contract: product "${productId}" is outside the candidate set`);
		}
	}
	return layout;
}

function normalizeHref(value: string): string {
	try {
		const base = 'https://runtime.invalid';
		const parsed = new URL(value, base);
		if (parsed.origin !== base) return value;
		return parsed.pathname;
	} catch {
		return value;
	}
}

function walkRuntimeValue(value: unknown, visit: (key: string, value: unknown) => void): void {
	if (Array.isArray(value)) {
		for (const item of value) walkRuntimeValue(item, visit);
		return;
	}
	if (!value || typeof value !== 'object') return;
	for (const [key, child] of Object.entries(value)) {
		visit(key, child);
		walkRuntimeValue(child, visit);
	}
}
