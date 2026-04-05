import type { PageServerLoad } from './$types';
import { getProducts, getCategories, customFieldsToRecord, type BCProduct } from '$lib/server/bigcommerce';

export const load: PageServerLoad = async ({ cookies }) => {
	// Fetch featured products and categories from BC
	const [allProducts, categories] = await Promise.all([
		getProducts(30),
		getCategories(),
	]);

	// Check for returning visitor persona
	const storedPersona = cookies.get('aisles_persona') || null;
	const storedCategory = cookies.get('aisles_last_category') || null;

	// Transform products
	const products = allProducts.map(transformProduct);

	// Pick featured products (first 4 from different price ranges)
	const sorted = [...products].sort((a, b) => b.price - a.price);
	const featured = [sorted[0], sorted[Math.floor(sorted.length / 3)], sorted[Math.floor(sorted.length * 2 / 3)], sorted[sorted.length - 1]];

	// Map categories for display
	const categoryList = categories
		.filter((c) => c.name.startsWith('Haven'))
		.map((c) => ({
			name: c.name.replace('Haven ', ''),
			path: c.path,
			slug: c.path.replace(/^\/|\/$/g, '').replace('haven-', ''),
		}));

	return {
		featured,
		categories: categoryList,
		storedPersona,
		storedCategory,
	};
};

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
	};
}
