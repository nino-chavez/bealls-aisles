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
	BOPISPickerSection,
	BOPISStripSection,
	ClusterChipRowSection,
	LastChanceUpsellRowSection,
	AssuranceStripCheckoutSection,
	// P0 marketing/capture/service additions (PRD-ENG-020).
	EventCountdownSection,
	BrandSpotlightSection,
	TrendShopSection,
	EmailCaptureInlineSection,
	ServiceCalloutsGridSection,
	LocatorStripSection,
	// PDP scaffold blocks (description-tabs, reviews-summary, reviews-list, plus
	// the Slice 1 scaffold) are NOT zone-targeted per ADR-007 §3.3 — they're
	// part of the fixed PDP scaffold and rendered directly by +page.svelte.
} from '$lib/schema/blocks';
import type { ZoneId } from './zones';

// ─── Stub schemas for blocks not yet built (Phase 3+ tighten these) ─

function stubBlock<C extends string>(component: C) {
	return z.object({
		component: z.literal(component),
		props: z.looseObject({}),
	});
}

const EditorialArticleTeaserStub = stubBlock('editorial-article-teaser');
const EmptyStateRescueStub = stubBlock('empty-state-rescue');
const PaginationStub = stubBlock('pagination');
const ComparisonTableStub = stubBlock('comparison-table');
const CompleteTheLookStub = stubBlock('complete-the-look');
const RecentlyViewedRowStub = stubBlock('recently-viewed');
const BucksEarnRowStub = stubBlock('bucks-earn-row');
const AlsoBoughtCarouselStub = stubBlock('also-bought-carousel');
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
	'home.featured-row': z.union([
		ProductGridSection,
		ProductCarouselSection,
		EditorialHeaderSection,
		EventCountdownSection,
		BrandSpotlightSection,
		TrendShopSection,
	]),
	'home.editorial-strip': z.union([EditorialArticleTeaserStub, BrandSpotlightSection]),
	'home.brand-spotlight': BrandSpotlightSection,
	'home.below-fold': z.union([
		CategoryTileGridSection,
		PromoStripSection,
		BOPISStripSection,
		EmailCaptureInlineSection,
		ServiceCalloutsGridSection,
		LocatorStripSection,
	]),

	// PLP
	'plp.banner': z.union([
		PromoStripSection,
		CouponStripSection,
		EditorialHeaderSection,
		EventCountdownSection,
		BrandSpotlightSection,
		EmailCaptureInlineSection,
		ServiceCalloutsGridSection,
		LocatorStripSection,
	]),
	'plp.editorial-header': z.union([EditorialHeroSection, EditorialHeaderSection]),
	'plp.cluster-row': ClusterChipRowSection,
	'plp.between-thirds': z.union([EditorialArticleTeaserStub, PromoStripSection]),
	'plp.below-grid': z.union([CategoryTileGridSection, PaginationStub]),
	'plp.empty-state': EmptyStateRescueStub,

	// PDP — scaffold blocks (image-gallery, product-title-block, variant-selector,
	// stock-signal, add-to-cart-bar, description-tabs, reviews-summary, reviews-list)
	// are NOT zone-targeted per ADR-007 §3.3; rendered directly by +page.svelte.
	// Zones below are insertion points the engine/admin can compose into.
	'pdp.below-description': z.union([BrandSpotlightSection, EditorialArticleTeaserStub, ComparisonTableStub]),
	'pdp.related': ProductCarouselSection,
	'pdp.cross-sell': z.union([CompleteTheLookStub, ProductCarouselSection]),
	'pdp.recently-viewed': z.union([ProductCarouselSection, RecentlyViewedRowStub]),
	'pdp.below-recs': z.union([BOPISPickerSection, BucksEarnRowStub]),

	// Cart — Phase 3 specialization (PRD-ENG-015, ADR-007 §3.4).
	// `cart.above-checkout-cta` is the single AI-composed cart zone.
	// Foundation renders line items / summary / meter / promo entry / CTA
	// directly from cart state; they are NOT zone-targeted.
	'cart.above-checkout-cta': z.union([LastChanceUpsellRowSection, CouponStripSection]),
	'cart.below-fold': z.union([AlsoBoughtCarouselStub, RecentlyViewedRowStub, BeallsBucksCalloutSection]),
	'cart.empty-state': EmptyStateRescueStub,

	// Checkout — Phase 3 specialization (PRD-ENG-016, ADR-007 §3.5).
	// Both zones are AI-composed; BC handoff itself is foundation logic.
	'checkout.assurance-strip': AssuranceStripCheckoutSection,
	'checkout.last-chance-upsell': LastChanceUpsellRowSection,

	// Search
	'search.empty-state': EmptyStateRescueStub,
	'search.zero-results-rescue': z.union([CategoryTileGridSection, PopularSearchesRowStub, ProductCarouselSection]),

	// Account
	'account.welcome': z.union([AccountWelcomeCardStub, EmailCaptureInlineSection, ServiceCalloutsGridSection]),
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
