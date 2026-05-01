/**
 * Home surface — static fallbacks per section-authoring.md §3.1.
 *
 * Every fallback is brand-aware via `getBrandById()` and synchronous (no IO
 * at request time per spec §5.3). Each must validate against its zone's
 * Zod schema; the resolver enforces this at request time.
 */

import { getBrandById } from '$lib/brand/config';
import type { ZoneFallback } from './index';

export const homeFallbacks: Partial<Record<string, ZoneFallback>> = {
	'home.hero': (brandId) => {
		const brand = getBrandById(brandId);
		if (!brand) return null;
		return {
			component: 'editorial-header',
			props: {
				eyebrow: brand.tagline.toUpperCase().slice(0, 60),
				headline: brand.homepage.editorialHeadline,
				body: brand.homepage.editorialBody,
			},
		};
	},

	// home.featured-row fallback would render a "Best Sellers" carousel, but
	// the spec requires fallbacks to be sync (no BC API call at request time).
	// Best-seller IDs are not yet in brand.config.ts; deferred to the phase
	// that adds curated best-sellers per brand. Hidden until then.
	// 'home.featured-row': (brandId) => null,

	// home.editorial-strip — Hidden per spec §3.1 (engine/admin populate; no
	// reasonable static default).

	// home.brand-spotlight — Hidden per spec §3.1.

	'home.below-fold': (brandId) => {
		const brand = getBrandById(brandId);
		if (!brand) return null;
		const tiles = Object.entries(brand.categories)
			.slice(0, 6)
			.map(([slug, cfg]) => ({
				label: cfg.displayName,
				image: '',
				href: `/category/${slug}`,
			}));
		if (tiles.length < 2) return null;
		return {
			component: 'category-tile-grid',
			props: {
				sectionLabel: 'Browse by category',
				columns: Math.min(tiles.length, 4) as 2 | 3 | 4,
				tiles,
			},
		};
	},
};
