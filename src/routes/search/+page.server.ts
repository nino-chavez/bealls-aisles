import type { PageServerLoad } from './$types';
import { getProducts, customFieldsToRecord, type BCProduct } from '$lib/server/bigcommerce';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const query = url.searchParams.get('q') || '';
	const devMode = url.searchParams.get('dev') === 'true';

	if (!query.trim()) {
		throw redirect(302, '/');
	}

	// Fetch all products and filter by search query (basic text search for now)
	const allProducts = await getProducts(50);
	const q = query.toLowerCase();

	const matched = allProducts
		.filter((p) => {
			const searchable = `${p.name} ${p.description} ${p.sku}`.toLowerCase();
			const fields = p.customFields.edges.map((e) => e.node.value).join(' ').toLowerCase();
			return searchable.includes(q) || fields.includes(q);
		})
		.map(transformProduct);

	// Detect persona from query
	const storedPersona = cookies.get('prism_persona') || null;
	let persona = 'gatherer';
	let confidence = 0.6;
	let personaShift = false;

	if (/cheap|budget|deal|dorm|under \$|affordable|compact|student/i.test(q)) {
		persona = 'hunter';
		confidence = 0.8;
	} else if (/review|compare|spec|vs|best/i.test(q)) {
		persona = 'researcher';
		confidence = 0.75;
	} else if (/gift|birthday|anniversary/i.test(q)) {
		persona = 'gifter';
		confidence = 0.8;
	}

	if (storedPersona && storedPersona !== persona && confidence > 0.7) {
		personaShift = true;
	}

	// Update stored persona
	cookies.set('prism_persona', persona, { path: '/', maxAge: 60 * 60 * 24 * 30 });

	// Determine which category to route to based on results
	const categorySlug = inferCategory(matched, q);

	return {
		query,
		results: matched,
		resultCount: matched.length,
		persona,
		confidence,
		personaShift,
		storedPersona,
		suggestedCategory: categorySlug,
		devMode,
	};
};

function inferCategory(products: Array<{ category: string }>, query: string): string | null {
	if (/desk|chair|office|dorm|storage|bookshelf|monitor/i.test(query)) return 'office';
	if (/sofa|couch|sectional|table|lamp|rug|living/i.test(query)) return 'living-room';

	// Check product categories
	const categories = products.map((p) => p.category);
	if (categories.filter((c) => c.includes('Office')).length > categories.length / 2) return 'office';
	if (categories.filter((c) => c.includes('Living')).length > categories.length / 2) return 'living-room';

	return null;
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
		description: p.description.replace(/<[^>]*>/g, '').trim(),
		specs,
		tags: Object.values(specs).slice(0, 3),
		category: p.categories.edges[0]?.node.name || '',
	};
}
