/**
 * PLP surface — static fallbacks per section-authoring.md §3.2.
 *
 * `plp.banner` falls back to a brand-aware locator-strip — universal
 * encouragement to visit a store, useful even when no engine output
 * targets the zone. Other PLP zones remain Hidden by default.
 */

import { getBrandById } from '$lib/brand/config';
import type { ZoneFallback } from './index';

export const plpFallbacks: Partial<Record<string, ZoneFallback>> = {
	'plp.banner': (brandId) => {
		const brand = getBrandById(brandId);
		if (!brand) return null;
		return {
			component: 'locator-strip',
			props: {
				eyebrow: 'FIND A STORE',
				headline: `Visit your nearest ${brand.name}`,
				body: 'Pickup, returns, and styling help in person.',
				ctaLabel: 'Find a Store',
				ctaHref: '/store-locator',
			},
		};
	},
};
