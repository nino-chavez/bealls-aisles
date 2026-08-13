import type { PageServerLoad } from './$types';
import { getBrand, getBrandMode } from '$lib/brand/config';
import { infer } from '$lib/signals/inference';
import { createStoreFromRequest } from '$lib/signals/request';
import { loadHomeProducts } from '$lib/server/catalog';
import { executeShopperPageRoute } from '$lib/server/shopper-route-runtime';
import { routeZoneDecision } from '$lib/server/route-zone-runtime';
import { projectShopperProducts } from '$lib/foundation/shopper-product';

export const load: PageServerLoad = async ({ url, cookies, request }) => {
	const brand = getBrand();
	const mode = getBrandMode(brand);

	// Persona inference for AI homepage layout — same pipeline as category pages
	const { store, visitCount } = await createStoreFromRequest({ url, request, cookies, category: 'home' });
	const inferenceContext = store.toInferenceContext();
	const inference = infer(inferenceContext);

	// Load homepage products via the same loader the AI uses, sorted by persona-fit.
	// Resilient to BC degradation — falls through to empty list (page renders chrome
	// + zones; AI body skips when products are absent).
	let homeProducts: Awaited<ReturnType<typeof loadHomeProducts>>['products'] = [];
	try {
		const result = await loadHomeProducts(inference.primary, 30);
		homeProducts = result.products;
	} catch (err) {
		console.warn('Home: loadHomeProducts failed, rendering with empty catalog', err);
	}

	// Pick featured products (first 4 from different price ranges) — used as static fallback only
	const shopperHomeProducts = projectShopperProducts(homeProducts);
	const featured = shopperHomeProducts.length >= 4
		? [shopperHomeProducts[0], shopperHomeProducts[Math.floor(shopperHomeProducts.length / 3)], shopperHomeProducts[Math.floor(shopperHomeProducts.length * 2 / 3)], shopperHomeProducts[shopperHomeProducts.length - 1]]
		: shopperHomeProducts.slice(0, 4);

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

	// Phase 2 vertical slice — resolve home.hero through the zone system.
	// Engine wiring (Phase 3) will pass engineOutput here; for now the
	// resolver falls through to the brand-aware static fallback.
	const zoneExecution = await executeShopperPageRoute(url, '/');
	const heroZone = routeZoneDecision(zoneExecution, 'home.hero').resolution;

	return {
		featured,
		homeProducts: shopperHomeProducts,
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
		heroZone,
		zoneExecution,
	};
};
