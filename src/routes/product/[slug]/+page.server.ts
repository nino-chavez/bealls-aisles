import type { PageServerLoad } from './$types';
import { getProductByPath, getProductsByCategory, customFieldsToRecord, type BCProduct } from '$lib/server/bigcommerce';
import { error } from '@sveltejs/kit';
import { getBrand } from '$lib/brand/config';
import { resolveZone } from '$lib/foundation/resolve-zone';

export const load: PageServerLoad = async ({ params, url, parent }) => {
	const slug = params.slug;
	const { devMode } = await parent();
	const persona = url.searchParams.get('intent') || 'gatherer';
	const brand = getBrand();

	// Fetch the product by its URL path
	const bcProduct = await getProductByPath(`/${slug}/`);

	if (!bcProduct) {
		throw error(404, `Product "${slug}" not found`);
	}

	const product = transformProduct(bcProduct);

	// Fetch related products from the same category
	let relatedProducts: ReturnType<typeof transformProduct>[] = [];
	const firstCategory = bcProduct.categories.edges[0]?.node;
	if (firstCategory) {
		try {
			const { products: categoryProducts } = await getProductsByCategory(firstCategory.entityId);
			relatedProducts = categoryProducts
				.filter((p) => p.entityId !== bcProduct.entityId)
				.slice(0, 4)
				.map(transformProduct);
		} catch {
			// Related products are optional — fail silently
		}
	}

	// Phase 3 PDP scaffold — derive scaffold-block props from the product.
	// Mock data here stands in for fields the BC catalog/inventory pipeline
	// doesn't yet surface (variants from BC product options, stock from
	// BC inventory). Phase 3 engine wiring sources these from the real
	// signals.
	const galleryImages = product.image
		? [{ url: product.image, alt: product.imageAlt }]
		: [];
	const variantGroups = synthesizeVariants(product.specs);
	const stockSignal = synthesizeStockSignal(product.entityId, product.salePrice ?? product.price);

	// pdp.below-description zone — falls through to Hidden until Phase 3
	// engine wiring or admin authoring lands. Pattern is wired so the
	// page renders zone content the moment a source provides it.
	const belowDescriptionZone = resolveZone({
		zoneId: 'pdp.below-description',
		brandId: brand.id,
	});

	return {
		product,
		relatedProducts,
		persona,
		devMode,
		galleryImages,
		variantGroups,
		stockSignal,
		belowDescriptionZone,
	};
};

const VARIANT_AXES = ['Size', 'Color', 'Material', 'Finish', 'Configuration'];

function synthesizeVariants(specs: Record<string, string>) {
	// Produce variant groups from any spec keys that match common variant axes.
	// Returns [] when no axis matches → VariantSelector hides itself.
	const groups: Array<{
		name: string;
		style: 'chip' | 'swatch' | 'dropdown';
		options: Array<{ id: string; label: string; available: boolean; swatch?: string }>;
	}> = [];
	for (const axis of VARIANT_AXES) {
		const value = specs[axis];
		if (!value) continue;
		// Single-value spec → one option, marked available, demonstrates the chip UI.
		groups.push({
			name: axis,
			style: axis === 'Color' ? 'swatch' : 'chip',
			options: [{ id: value.toLowerCase().replace(/\s+/g, '-'), label: value, available: true }],
		});
	}
	return groups;
}

function synthesizeStockSignal(entityId: number, _price: number):
	| { level: 'plentiful' | 'low' | 'last-few' | 'out'; message: string; urgency: 'none' | 'soft' | 'hard' }
	| null {
	// Deterministic per-product so demo runs are stable across reloads.
	const bucket = entityId % 10;
	if (bucket < 6) return null; // most products show no signal
	if (bucket < 8) return { level: 'low', message: 'Selling fast — low stock', urgency: 'soft' };
	if (bucket < 9) return { level: 'last-few', message: 'Only 3 left at this price', urgency: 'hard' };
	return { level: 'out', message: 'Out of stock', urgency: 'soft' };
}

function transformProduct(p: BCProduct) {
	const specs = customFieldsToRecord(p);
	return {
		id: p.path.replace(/^\/|\/$/g, '') || String(p.entityId),
		entityId: p.entityId,
		name: p.name,
		price: p.prices.price.value,
		salePrice: p.prices.salePrice?.value || undefined,
		image: p.defaultImage?.url || '',
		imageAlt: p.defaultImage?.altText || p.name,
		description: p.description, // Keep HTML for PDP — render rich content
		descriptionPlain: p.description.replace(/<[^>]*>/g, '').trim(),
		specs,
		tags: Object.values(specs).slice(0, 3),
		category: p.categories.edges[0]?.node.name || '',
		categoryPath: p.categories.edges[0]?.node.path || '',
	};
}
