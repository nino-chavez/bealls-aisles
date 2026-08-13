import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadCategoryProducts } from '$lib/server/catalog';
import { requireOperatorAccess } from '$lib/server/access-gates';

/**
 * GET /api/observe/enrichment?category={slug}&persona={persona}
 * Returns enriched products for a category, sorted by persona-fit.
 */
export const GET: RequestHandler = async ({ url, request }) => {
	requireOperatorAccess(url, request);
	const category = url.searchParams.get('category');
	const persona = url.searchParams.get('persona') || 'gatherer';

	if (!category) {
		return json({ error: 'Missing category parameter' }, { status: 400 });
	}

	const result = await loadCategoryProducts(category, persona);
	if (!result) {
		return json({ products: [], categoryName: null });
	}

	const products = result.products.map((p) => ({
		id: p.id,
		entityId: p.entityId,
		name: p.name,
		price: p.price,
		salePrice: p.salePrice,
		personaFit: p.personaFit,
		semanticTags: p.semanticTags,
	}));

	return json({ products, categoryName: result.categoryName });
};
