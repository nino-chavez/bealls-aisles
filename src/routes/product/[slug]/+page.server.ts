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
				.slice(0, 8)
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

	// Slice 2 — descriptions + reviews scaffold props. Reviews use synthetic
	// data until a real reviews integration ships. The shape matches
	// ReviewsListSection / ReviewsSummarySection so a real-reviews swap is
	// drop-in when the integration lands.
	const descriptionTabs = synthesizeDescriptionTabs(product);
	const reviewsSummary = synthesizeReviewsSummary(product.entityId);
	const reviewsList = synthesizeReviewsList(product.entityId);

	// Slice 2 — populate PDP zones from page-load context. Until engine
	// composition extends to PDP (Phase 3) and the tag-overlap retrieval
	// query lands (PRD-ENG-019, ADR-008 Phase B), we shape the engine output
	// here from the same-category BC fetch.
	//
	// TODO PRD-ENG-019: replace these synthetic engine payloads with a
	// `getProductsByTagOverlap(productId, ...)` call once Phase B ships.
	// The cascade then resolves naturally — engine output wins, this stub
	// disappears.
	const relatedRefs = relatedProducts.slice(0, 4).map((p) => ({ productId: p.id, role: 'standard' as const }));
	const crossSellRefs = relatedProducts.slice(4, 8).map((p) => ({ productId: p.id, role: 'standard' as const }));

	const engineOutput = {
		zones: {
			...(relatedRefs.length >= 3
				? {
						'pdp.related': {
							component: 'product-carousel',
							props: { title: 'You might also like', products: relatedRefs, showRating: true },
						},
					}
				: {}),
			...(crossSellRefs.length >= 3
				? {
						'pdp.cross-sell': {
							component: 'product-carousel',
							props: { title: 'Pairs well with', products: crossSellRefs, showRating: false },
						},
					}
				: {}),
		},
	};

	const belowDescriptionZone = resolveZone({ zoneId: 'pdp.below-description', brandId: brand.id, engineOutput });
	const relatedZone = resolveZone({ zoneId: 'pdp.related', brandId: brand.id, engineOutput });
	const crossSellZone = resolveZone({ zoneId: 'pdp.cross-sell', brandId: brand.id, engineOutput });
	const recentlyViewedZone = resolveZone({ zoneId: 'pdp.recently-viewed', brandId: brand.id, engineOutput });
	const belowRecsZone = (() => {
		const base = resolveZone({ zoneId: 'pdp.below-recs', brandId: brand.id, engineOutput });
		// Surface the product name into the BOPIS placeholder fallback so the
		// picker subtitle reads naturally without each fallback knowing the
		// per-request product context.
		if (
			base.source === 'fallback' &&
			base.content &&
			typeof base.content === 'object' &&
			(base.content as { component?: string }).component === 'bopis-picker'
		) {
			const c = base.content as { component: string; props: { productName?: string; stores: unknown[] } };
			return { ...base, content: { ...c, props: { ...c.props, productName: product.name } } };
		}
		return base;
	})();

	return {
		product,
		relatedProducts,
		persona,
		devMode,
		galleryImages,
		variantGroups,
		stockSignal,
		descriptionTabs,
		reviewsSummary,
		reviewsList,
		belowDescriptionZone,
		relatedZone,
		crossSellZone,
		recentlyViewedZone,
		belowRecsZone,
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

function synthesizeDescriptionTabs(product: ReturnType<typeof transformProduct>): Array<{ label: string; content: string }> {
	const tabs: Array<{ label: string; content: string }> = [
		{ label: 'Description', content: product.description || '<p>No description available.</p>' },
	];

	if (Object.keys(product.specs).length > 0) {
		const rows = Object.entries(product.specs)
			.map(([k, v]) => `<tr><th class="py-2 pr-6 text-left text-surface-muted-fg font-normal">${escapeHtml(k)}</th><td class="py-2 font-medium">${escapeHtml(v)}</td></tr>`)
			.join('');
		tabs.push({ label: 'Specs', content: `<table class="w-full border-collapse text-sm">${rows}</table>` });
	}

	tabs.push({
		label: 'Shipping & returns',
		content:
			'<p>Free shipping on orders $99+. Standard delivery 3–5 business days.</p>' +
			'<p>Free returns within 60 days, in store or by mail.</p>',
	});

	return tabs;
}

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function synthesizeReviewsSummary(entityId: number): {
	avgRating: number;
	reviewCount: number;
	histogram: number[];
	writeReviewHref: string;
} {
	// Deterministic per-product so the demo is stable. Real reviews integration
	// is out of scope for this session.
	const seed = entityId % 100;
	if (seed < 30) {
		// "Be the first to review" placeholder — synthetic 3-star middle of the road
		return { avgRating: 0, reviewCount: 0, histogram: [0, 0, 0, 0, 0], writeReviewHref: '#write-review' };
	}
	const reviewCount = 12 + (seed % 50);
	const fives = Math.round(reviewCount * (0.45 + (seed % 10) / 50));
	const fours = Math.round(reviewCount * 0.3);
	const threes = Math.round(reviewCount * 0.15);
	const twos = Math.round(reviewCount * 0.06);
	const ones = Math.max(0, reviewCount - (fives + fours + threes + twos));
	const histogram = [ones, twos, threes, fours, fives];
	const total = histogram.reduce((s, n) => s + n, 0);
	const avg = total === 0 ? 0 : (1 * ones + 2 * twos + 3 * threes + 4 * fours + 5 * fives) / total;
	return { avgRating: Math.round(avg * 10) / 10, reviewCount: total, histogram, writeReviewHref: '#write-review' };
}

function synthesizeReviewsList(entityId: number): Array<{
	id: string;
	author: string;
	date: string;
	rating: number;
	title?: string;
	body: string;
	helpful?: number;
	verifiedPurchase?: boolean;
}> {
	const seed = entityId % 100;
	if (seed < 30) return []; // matches "be the first to review" path

	const samples = [
		{ author: 'Margaret W.', rating: 5, title: 'Better than expected', body: 'Quality is great for the price. Got several compliments already.', helpful: 8, verifiedPurchase: true },
		{ author: 'Jordan T.', rating: 4, title: 'Nice but runs small', body: 'Material is comfortable. Sized up half a size and it fit well.', helpful: 3, verifiedPurchase: true },
		{ author: 'Anna L.', rating: 5, body: 'Exactly as described. Fast shipping. Will buy again.', helpful: 5, verifiedPurchase: true },
		{ author: 'Robin C.', rating: 3, title: 'Decent', body: 'Good for the price but the color is slightly different than the photo.', helpful: 2 },
		{ author: 'Sam K.', rating: 4, body: 'Solid pick. Stitching looks neat. Wash and wear so far holding up.', helpful: 4, verifiedPurchase: true },
	];

	const count = Math.min(5, 1 + (seed % 5));
	const baseDate = Date.parse('2026-04-15T00:00:00Z');
	return samples.slice(0, count).map((s, i) => ({
		id: `r-${entityId}-${i}`,
		author: s.author,
		rating: s.rating,
		title: s.title,
		body: s.body,
		helpful: s.helpful,
		verifiedPurchase: s.verifiedPurchase,
		date: new Date(baseDate - (i + (seed % 10)) * 24 * 60 * 60 * 1000).toISOString(),
	}));
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
