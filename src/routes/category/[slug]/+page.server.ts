import type { PageServerLoad } from './$types';
import { getCategories, getProductsByCategory, customFieldsToRecord, type BCProduct } from '$lib/server/bigcommerce';
import { error } from '@sveltejs/kit';
import { infer } from '$lib/signals/inference';
import { createStoreFromRequest } from '$lib/signals/request';
import { getEnrichmentByEntityIds } from '$lib/server/enrichment/query';

/** Map BC category slugs to our category config */
const CATEGORY_MAP: Record<string, { bcName: string; displayName: string }> = {
	'living-room': { bcName: 'Haven Living Room', displayName: 'Living Room' },
	'office': { bcName: 'Haven Office', displayName: 'Office' },
};

export const load: PageServerLoad = async ({ params, url, cookies, request }) => {
	const slug = params.slug;
	const devMode = url.searchParams.get('dev') === 'true';

	const catConfig = CATEGORY_MAP[slug];
	if (!catConfig) {
		throw error(404, `Category "${slug}" not found`);
	}

	// Find the BC category by name
	const categories = await getCategories();
	const bcCategory = categories.find((c) => c.name === catConfig.bcName);

	if (!bcCategory) {
		throw error(404, `BigCommerce category "${catConfig.bcName}" not found`);
	}

	// Fetch products + enrichment in parallel
	const { products: bcProducts } = await getProductsByCategory(bcCategory.entityId);
	const products = bcProducts.map((p) => transformProduct(p));

	// ─── Signal Store: emit request-time signals, then infer ───────
	const [{ store, visitCount }, enrichmentMap] = await Promise.all([
		createStoreFromRequest({ url, request, cookies, category: slug }),
		getEnrichmentByEntityIds(products.map((p) => p.entityId)),
	]);
	const inferenceContext = store.toInferenceContext();
	const inference = infer(inferenceContext);

	// Sort products by persona-fit score for the inferred persona
	const persona = inference.primary;
	products.sort((a, b) => {
		const fitA = enrichmentMap.get(a.entityId)?.personaFit[persona] ?? 0.5;
		const fitB = enrichmentMap.get(b.entityId)?.personaFit[persona] ?? 0.5;
		return fitB - fitA; // Higher fit first
	});
	cookies.set('aisles_persona', inference.primary, { path: '/', maxAge: 60 * 60 * 24 * 30 });
	cookies.set('aisles_last_category', slug, { path: '/', maxAge: 60 * 60 * 24 * 30 });
	cookies.set('aisles_visits', String(visitCount), { path: '/', maxAge: 60 * 60 * 24 * 30 });

	// Attach enrichment to products for the client
	const enrichedProducts = products.map((p) => {
		const enrichment = enrichmentMap.get(p.entityId);
		return {
			...p,
			personaFit: enrichment?.personaFit ?? null,
			semanticTags: enrichment?.semanticTags ?? [],
		};
	});

	return {
		category: {
			slug,
			name: catConfig.displayName,
			description: '',
		},
		products: enrichedProducts,
		inference,
		persona: inference.primary,
		confidence: inference.confidence,
		devMode,
		sessionContext: {
			personaSource: inference.dominantSource,
			personaShift: inference.shift.detected,
			storedPersona: inferenceContext.storedPersona,
			storedCategory: inferenceContext.storedCategory,
			visitCount,
			searchQuery: inferenceContext.searchQuery,
			signalCount: store.eventCount,
		},
	};
};

/** Transform a BC product into the shape our layout components expect */
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
		description: stripHtml(p.description),
		specs,
		tags: Object.values(specs).slice(0, 3),
		category: p.categories.edges[0]?.node.name || '',
	};
}

function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, '').trim();
}
