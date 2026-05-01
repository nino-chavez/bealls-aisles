/**
 * PDP surface — static fallbacks per section-authoring.md §3.3.
 *
 * PDP scaffold blocks (gallery, title, variants, ATC, description, reviews)
 * are NOT zones — they render directly from +page.svelte and are populated
 * from the BC product. Only insertion-zone fallbacks live here.
 *
 * - pdp.below-description: Hidden by default (no fallback registered).
 * - pdp.related: Hidden as a fallback; +page.server populates via engineOutput
 *   from the tag-overlap neighborhood query (ADR-008 Phase B / PRD-ENG-019),
 *   minOverlap=3 for tighter pairing.
 * - pdp.cross-sell: same — Hidden default; +page.server populates from the
 *   tag-overlap neighborhood query, minOverlap=2.
 * - pdp.recently-viewed: behavioral; +page.server populates from tag-overlap
 *   as a cold-start substitute (ADR-008 §"Cold-start safe") until
 *   session-tracked viewed products land with PRD-FND-018.
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
