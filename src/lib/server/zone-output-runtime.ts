import { getBrandById } from '$lib/brand/config';
import { validateZoneContent } from '$lib/foundation/resolve-zone';
import { parseZoneInstance, type ZoneInstanceId } from '$lib/foundation/zones';
import type { BeallsFamilyBrandId } from '$lib/brand/bealls-family-runtime-contract';

const FORBIDDEN_KEYS = new Set(['class', 'className', 'css', 'style', 'styles', 'stylesheet', 'html', 'innerHTML']);

/** Exact schema + catalog/asset/destination closure for generated zone content. */
export function validateZoneEngineOutput(input: {
	brandId: BeallsFamilyBrandId;
	allowedZoneIds: readonly ZoneInstanceId[];
	zones: unknown;
	candidateProductIds: readonly string[];
	candidateAssetUrls?: readonly string[];
}): { zones: Record<ZoneInstanceId, unknown> } {
	if (!input.zones || typeof input.zones !== 'object' || Array.isArray(input.zones)) {
		throw new Error('zone output contract: zones object is required');
	}
	const brand = getBrandById(input.brandId);
	if (!brand) throw new Error(`zone output contract: unknown brand "${input.brandId}"`);
	const allowedZoneIds = new Set(input.allowedZoneIds);
	const productIds = new Set(input.candidateProductIds.map(String));
	const allowedHrefs = new Set([
		'/', '/store-locator', '/search', '/cart', '/checkout',
		...Object.keys(brand.categories).map((slug) => `/category/${slug}`),
		...input.candidateProductIds.map((id) => `/product/${id}`),
	]);
	const assets = new Set([
		brand.homepage.heroImage,
		...Object.values(brand.categories).map((category) => category.tileImage),
		...(input.candidateAssetUrls ?? []),
	].filter((value): value is string => !!value));
	const validated: Record<ZoneInstanceId, unknown> = {};

	for (const [zoneId, raw] of Object.entries(input.zones as Record<string, unknown>)) {
		if (!allowedZoneIds.has(zoneId) || !parseZoneInstance(zoneId)) {
			throw new Error(`zone output contract: unsupported zone "${zoneId}"`);
		}
		const content = validateZoneContent(zoneId, raw);
		if (content === null) throw new Error(`zone output contract: content is invalid for "${zoneId}"`);
		walk(content, (key, value) => {
			if (FORBIDDEN_KEYS.has(key) || key.startsWith('--')) throw new Error(`zone output contract: forbidden key "${key}"`);
			if (key === 'productId' && typeof value === 'string' && !productIds.has(value)) {
				throw new Error(`zone output contract: product "${value}" is outside the approved catalog`);
			}
			if ((key === 'href' || key.endsWith('Href')) && typeof value === 'string' && !allowedHrefs.has(normalizeHref(value))) {
				throw new Error(`zone output contract: destination "${value}" is not registered`);
			}
			if ((key === 'image' || key === 'url' || key.endsWith('Image')) && typeof value === 'string' && !assets.has(value)) {
				throw new Error(`zone output contract: asset "${value}" is not registered`);
			}
		});
		validated[zoneId] = content;
	}
	return { zones: validated };
}

function normalizeHref(value: string): string {
	try {
		const parsed = new URL(value, 'https://runtime.invalid');
		return parsed.origin === 'https://runtime.invalid' ? parsed.pathname : value;
	} catch {
		return value;
	}
}

function walk(value: unknown, visit: (key: string, child: unknown) => void): void {
	if (Array.isArray(value)) {
		for (const item of value) walk(item, visit);
		return;
	}
	if (!value || typeof value !== 'object') return;
	for (const [key, child] of Object.entries(value)) {
		visit(key, child);
		walk(child, visit);
	}
}
