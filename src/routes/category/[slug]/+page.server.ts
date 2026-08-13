import type { PageServerLoad } from './$types';
import { infer } from '$lib/signals/inference';
import { createStoreFromRequest } from '$lib/signals/request';
import { loadCategoryProducts, CATEGORY_MAP } from '$lib/server/catalog';
import { getBrand, getBrandMode } from '$lib/brand/config';
import { requireBrandSurface } from '$lib/server/brand-surface-guard';
import { executeShopperPageRoute, throwShopperNotFound } from '$lib/server/shopper-route-runtime';
import { projectShopperProducts } from '$lib/foundation/shopper-product';

export const load: PageServerLoad = async ({ params, url, cookies, request, parent }) => {
	const slug = params.slug;
	const zoneExecution = await executeShopperPageRoute(url, '/category/[slug]');
	const { devMode } = await parent();

	if (!CATEGORY_MAP[slug]) {
		return throwShopperNotFound(url, `Category "${slug}" not found`);
	}

	// ─── Content-mode short-circuit ────────────────────────────────
	// Content brands (e.g., HomeCentric) have no online catalog. Render a
	// content surface directly — locator CTA + brand-pillar tiles — without
	// touching BC, the AI layout API, or persona inference.
	const brand = getBrand();
	const mode = getBrandMode(brand);
	requireBrandSurface(mode === 'content' ? 'category' : 'plp');
	if (mode === 'content') {
		const categoryDisplayName = brand.categories[slug]?.displayName ?? slug;
		const otherCategories = Object.entries(brand.categories)
			.filter(([s]) => s !== slug)
			.slice(0, 4)
			.map(([s, c]) => ({
				label: c.displayName,
				image: `https://picsum.photos/seed/${brand.id}-${s}/600/450`,
				href: `/category/${s}`,
			}));

		return {
			contentMode: true as const,
			category: { slug, name: categoryDisplayName, description: '' },
			brandPillars: otherCategories,
			heroImage: `https://picsum.photos/seed/${brand.id}-${slug}-hero/1600/700`,
			heroBody: brand.homepage.editorialBody,
			heroEyebrow: 'IN STORE',
			locatorCta: 'Find a Store Near You',
			locatorBody: `${categoryDisplayName} arrivals refresh weekly. Visit your nearest ${brand.name} store to see what's new.`,
			devMode,
			zoneExecution,
		};
	}

	// ─── Signal Store: emit request-time signals, then infer ───────
	const { store, visitCount } = await createStoreFromRequest({ url, request, cookies, category: slug });
	const inferenceContext = store.toInferenceContext();
	const inference = infer(inferenceContext);

	// ─── Load products with enrichment, sorted by persona-fit ──────
	const result = await loadCategoryProducts(slug, inference.primary);
	if (!result) {
		return throwShopperNotFound(url, `Category "${slug}" not found in BigCommerce`);
	}

	// 2026-05-02 audit P0 §3.4 fix — an empty Bealls Home category once
	// reached the retired whole-layout fallback and rendered Women's content.
	// Keep the fail-closed 404 rather than publishing off-category content.
	if (result.products.length === 0) {
		return throwShopperNotFound(url, `Category "${slug}" has no products available`);
	}

	// Store current session state in cookies
	cookies.set('aisles_persona', inference.primary, { path: '/', maxAge: 60 * 60 * 24 * 30 });
	cookies.set('aisles_last_category', slug, { path: '/', maxAge: 60 * 60 * 24 * 30 });
	cookies.set('aisles_visits', String(visitCount), { path: '/', maxAge: 60 * 60 * 24 * 30 });

	return {
		contentMode: false as const,
		category: {
			slug,
			name: result.categoryName,
			description: '',
		},
		products: projectShopperProducts(result.products),
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
		sessionId: cookies.get('aisles_session') || null,
		zoneExecution,
	};
};
