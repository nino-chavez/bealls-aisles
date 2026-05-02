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

	// home.below-fold — brand-aware service-trust callouts. Universal across
	// brands (shipping / returns / BOPIS / rewards) and degrades gracefully
	// for content-mode brands that have no transactional callouts. The
	// AI may override this with a richer composition; see PRD-ENG-020.
	'home.below-fold': (brandId) => {
		const brand = getBrandById(brandId);
		if (!brand) return null;
		const isContent = brand.mode === 'content';
		// Icon names map to named SVG keys in ServiceCalloutsGrid (no emoji).
		const callouts = isContent
			? [
				{ icon: 'store', label: 'Find a store', body: 'Locator with hours + directions' },
				{ icon: 'support', label: 'Newsletter', body: 'Be first to know when stores open' },
				{ icon: 'support', label: 'In-store help', body: 'Ask any associate' },
			]
			: [
				{ icon: 'shipping', label: 'Free shipping', body: 'On orders $99+' },
				{ icon: 'returns', label: 'Easy returns', body: '30 days, in store or by mail' },
				{ icon: 'store', label: 'Buy online, pick up', body: 'Ready in 2 hours' },
				{ icon: 'rewards', label: brand.incentives ? 'Bealls Bucks rewards' : 'Member perks', body: 'Earn on every order' },
			];
		const columns = (callouts.length === 4 ? 4 : 3) as 3 | 4;
		return {
			component: 'service-callouts-grid',
			props: { columns, callouts },
		};
	},
};
