/**
 * PDP surface — static fallbacks per section-authoring.md §3.3.
 *
 * PDP scaffold blocks (gallery, title, variants, ATC, description, reviews)
 * are NOT zones — they render directly from +page.svelte and are populated
 * from the BC product. Only insertion-zone fallbacks live here.
 *
 * - pdp.below-description: Hidden by default (no fallback registered).
 * - pdp.related: Hidden as a fallback; +page.server populates via engineOutput
 *   from the BC same-category fetch. TODO PRD-ENG-019: swap in tag-overlap
 *   query when ADR-008 Phase B lands.
 * - pdp.cross-sell: same — Hidden default, populated by page-load.
 *   TODO PRD-ENG-019.
 * - pdp.recently-viewed: behavioral; Hidden until shopper has 3+ viewed
 *   products in session per spec §3.3.
 * - pdp.below-recs: BOPIS picker placeholder pointing at /locator. Storefront
 *   brands always render the placeholder until a real ZIP-aware fetch lands
 *   in Phase 6 (locator surface, PRD-FND-019).
 */

import { getBrandById } from '$lib/brand/config';
import type { ZoneFallback } from './index';

export const pdpFallbacks: Partial<Record<string, ZoneFallback>> = {
	'pdp.below-recs': (brandId) => {
		const brand = getBrandById(brandId);
		// Content-mode brands (Home Centric) skip BOPIS — no transactional path.
		if (!brand || brand.mode === 'content') return null;
		return {
			component: 'bopis-picker',
			props: {
				stores: [],
				productName: '',
			},
		};
	},
};
