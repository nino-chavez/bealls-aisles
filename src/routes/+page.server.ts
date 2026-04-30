import type { PageServerLoad } from './$types';
import { getBrand, getBrandMode } from '$lib/brand/config';
import { infer } from '$lib/signals/inference';
import { createStoreFromRequest } from '$lib/signals/request';
import { loadHomeProducts } from '$lib/server/catalog';

export const load: PageServerLoad = async ({ url, cookies, request }) => {
	const brand = getBrand();
	const mode = getBrandMode(brand);

	// Persona inference for AI homepage layout — same pipeline as category pages
	const { store, visitCount } = await createStoreFromRequest({ url, request, cookies, category: 'home' });
	const inferenceContext = store.toInferenceContext();
	const inference = infer(inferenceContext);

	// Load homepage products via the same loader the AI uses, sorted by persona-fit
	const { products: homeProducts } = await loadHomeProducts(inference.primary, 30);

	// Pick featured products (first 4 from different price ranges) — used as static fallback only
	const featured = homeProducts.length >= 4
		? [homeProducts[0], homeProducts[Math.floor(homeProducts.length / 3)], homeProducts[Math.floor(homeProducts.length * 2 / 3)], homeProducts[homeProducts.length - 1]]
		: homeProducts.slice(0, 4);

	// Check for returning visitor persona
	const storedPersona = cookies.get('aisles_persona') || null;
	const storedCategory = cookies.get('aisles_last_category') || null;

	// Map categories for display — driven by brand config
	const categoryList = Object.entries(brand.categories).map(([slug, config]) => ({
		name: config.displayName,
		path: `/${slug}/`,
		slug,
	}));

	cookies.set('aisles_persona', inference.primary, { path: '/', maxAge: 60 * 60 * 24 * 30 });
	cookies.set('aisles_visits', String(visitCount), { path: '/', maxAge: 60 * 60 * 24 * 30 });

	return {
		featured,
		homeProducts,
		categories: categoryList,
		storedPersona,
		storedCategory,
		brandName: brand.name,
		brandTagline: brand.tagline,
		brandDomain: brand.domain,
		homepage: brand.homepage,
		mode,
		inference,
		persona: inference.primary,
		confidence: inference.confidence,
		probabilities: inference.probabilities,
		sessionId: cookies.get('aisles_session') || null,
	};
};
