/**
 * Zone schemas — Zod unions per zone, declared per the per-zone spec in
 * `docs/architecture/foundation/section-authoring.md` §3.
 *
 * Where a referenced block schema exists in `$lib/schema/blocks.ts`, the
 * existing schema is reused. Where a block schema does not yet exist
 * (P0 / P1 missing per `composition-taxonomy.md` §7), a stub schema is
 * declared inline in this file. Stubs accept any `props` shape so that
 * Phase 3+ can tighten them when the block lands without breaking the
 * zone contract.
 *
 * The discriminator on every zone is `component` — matching the existing
 * block-schema convention.
 */

import { z } from 'zod';
import {
	EditorialHeaderSection,
	EditorialHeroSection,
	LifestylePriceHeroSection,
	ProductGridSection,
	ProductCarouselSection,
	CategoryTileGridSection,
	PromoStripSection,
	CouponStripSection,
	BeallsBucksCalloutSection,
	ForYouRowSection,
} from '$lib/schema/blocks';
import type { ZoneId } from './zones';

// ─── Stub schemas for blocks not yet built (Phase 3+ tighten these) ─

function stubBlock<C extends string>(component: C) {
	return z.object({
		component: z.literal(component),
		props: z.looseObject({}),
	});
}

const BoPISStripStub = stubBlock('bopis-strip');
const BrandSpotlightStub = stubBlock('brand-spotlight');
const EditorialArticleTeaserStub = stubBlock('editorial-article-teaser');
const EmptyStateRescueStub = stubBlock('empty-state-rescue');
const PaginationStub = stubBlock('pagination');
const ComparisonTableStub = stubBlock('comparison-table');
const CompleteTheLookStub = stubBlock('complete-the-look');
const RecentlyViewedRowStub = stubBlock('recently-viewed');
const BucksEarnRowStub = stubBlock('bucks-earn-row');
const LastChanceUpsellRowStub = stubBlock('last-chance-upsell-row');
const AlsoBoughtCarouselStub = stubBlock('also-bought-carousel');
const AssuranceStripCheckoutStub = stubBlock('assurance-strip-checkout');
const PopularSearchesRowStub = stubBlock('popular-searches-row');
const AccountWelcomeCardStub = stubBlock('account-welcome-card');
const OrderHistoryListStub = stubBlock('order-history-list');
const WishlistGridStub = stubBlock('wishlist-grid');
const TierStatusCardStub = stubBlock('tier-status-card');
const BackInStockAlertCardStub = stubBlock('back-in-stock-alert-card');
const ReviewsToWriteRowStub = stubBlock('reviews-to-write-row');

// ─── Per-zone schemas ──────────────────────────────────────────────

/**
 * Schema per zone family. Per section-authoring.md §4: indexed zones share
 * the schema for their family — the index is bookkeeping for ordering,
 * not a separate type.
 *
 * Multiplicity is encoded in the registry, not the schema. The schema
 * always describes ONE item; array zones validate each list element
 * independently in the resolver.
 */
export const ZoneSchemas = {
	// Home
	'home.hero': z.union([EditorialHeroSection, LifestylePriceHeroSection, EditorialHeaderSection]),
	'home.featured-row': z.union([ProductGridSection, ProductCarouselSection, EditorialHeaderSection]),
	'home.editorial-strip': z.union([EditorialArticleTeaserStub, BrandSpotlightStub]),
	'home.brand-spotlight': BrandSpotlightStub,
	'home.below-fold': z.union([CategoryTileGridSection, PromoStripSection, BoPISStripStub]),

	// PLP
	'plp.banner': z.union([PromoStripSection, CouponStripSection, EditorialHeaderSection]),
	'plp.editorial-header': z.union([EditorialHeroSection, EditorialHeaderSection]),
	'plp.between-thirds': z.union([EditorialArticleTeaserStub, PromoStripSection]),
	'plp.below-grid': z.union([CategoryTileGridSection, PaginationStub]),
	'plp.empty-state': EmptyStateRescueStub,

	// PDP
	'pdp.below-description': z.union([BrandSpotlightStub, EditorialArticleTeaserStub, ComparisonTableStub]),
	'pdp.related': ProductCarouselSection,
	'pdp.cross-sell': z.union([CompleteTheLookStub, ProductCarouselSection]),
	'pdp.recently-viewed': RecentlyViewedRowStub,
	'pdp.below-recs': z.union([BoPISStripStub, BucksEarnRowStub]),

	// Cart
	'cart.above-checkout-cta': z.union([LastChanceUpsellRowStub, CouponStripSection]),
	'cart.below-fold': z.union([AlsoBoughtCarouselStub, RecentlyViewedRowStub, BeallsBucksCalloutSection]),
	'cart.empty-state': EmptyStateRescueStub,

	// Checkout
	'checkout.assurance-strip': AssuranceStripCheckoutStub,
	'checkout.last-chance-upsell': LastChanceUpsellRowStub,

	// Search
	'search.empty-state': EmptyStateRescueStub,
	'search.zero-results-rescue': z.union([CategoryTileGridSection, PopularSearchesRowStub, ProductCarouselSection]),

	// Account
	'account.welcome': AccountWelcomeCardStub,
	'account.dashboard-pick': z.union([
		OrderHistoryListStub,
		WishlistGridStub,
		TierStatusCardStub,
		ForYouRowSection,
		BackInStockAlertCardStub,
		ReviewsToWriteRowStub,
	]),

	// Locator
	'locator.editorial-intro': EditorialHeaderSection,

	// Error
	'error-404.rescue': z.union([EmptyStateRescueStub, CategoryTileGridSection, ProductCarouselSection]),
	'error-empty.rescue': EmptyStateRescueStub,
} as const satisfies Record<ZoneId, z.ZodTypeAny>;

export type ZoneContent<Z extends ZoneId> = z.infer<(typeof ZoneSchemas)[Z]>;
