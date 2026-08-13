import { z } from 'zod';
import type { ZoneId } from './zones';

/**
 * Runtime zone vocabulary.
 *
 * These schemas intentionally do not reuse the broader prompt/layout schemas.
 * A zone may accept only a component that ZoneRenderer can actually dispatch,
 * every object is strict, and shopper-visible strings/collections are bounded.
 * A `z.never()` zone is Hidden-only until a real renderer contract lands.
 */

const label = z.string().trim().min(1).max(80);
const headline = z.string().trim().min(1).max(140);
const body = z.string().trim().min(1).max(420);
const href = z.string().trim().min(1).max(256);
const asset = z.string().trim().min(1).max(2048);
const productId = z.string().trim().min(1).max(128);

const ProductRef = z.strictObject({
	productId,
	role: z.enum(['hero', 'featured', 'standard', 'compact']),
});

const EditorialHeader = z.strictObject({
	component: z.literal('editorial-header'),
	props: z.strictObject({ eyebrow: label, headline, body }),
});

const EditorialHero = z.strictObject({
	component: z.literal('editorial-hero'),
	props: z.strictObject({
		image: asset,
		eyebrow: label.optional(),
		headline,
		body: body.optional(),
		ctaLabel: label.optional(),
		ctaHref: href.optional(),
		textPosition: z.enum(['left', 'center', 'right']),
	}),
});

const LifestylePriceHero = z.strictObject({
	component: z.literal('lifestyle-price-hero'),
	props: z.strictObject({ image: asset, category: label, priceLabel: label, ctaLabel: label, ctaHref: href }),
});

const ProductGrid = z.strictObject({
	component: z.literal('product-grid'),
	props: z.strictObject({
		columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
		products: z.array(ProductRef).min(1).max(24),
		imageRatio: z.enum(['landscape', 'square']),
		showDescription: z.boolean(),
		showSpecs: z.boolean(),
		showQuickAdd: z.boolean(),
		showRating: z.boolean().optional(),
		showBadges: z.boolean().optional(),
	}),
});

const ProductCarousel = z.strictObject({
	component: z.literal('product-carousel'),
	props: z.strictObject({
		title: headline,
		products: z.array(ProductRef).min(1).max(12),
		showRating: z.boolean().optional(),
		showBadges: z.boolean().optional(),
		showQuickAdd: z.boolean().optional(),
	}),
});

const CategoryTile = z.strictObject({ label, image: asset, href, description: body.optional() });
const CategoryTileGrid = z.strictObject({
	component: z.literal('category-tile-grid'),
	props: z.strictObject({
		sectionLabel: label.optional(),
		columns: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
		tiles: z.array(CategoryTile).min(1).max(8),
	}),
});

const PromoStrip = z.strictObject({
	component: z.literal('promo-strip'),
	props: z.strictObject({
		eyebrow: label.optional(), headline, ctaLabel: label.optional(), ctaHref: href.optional(),
		urgency: z.enum(['none', 'soft', 'hard']),
	}),
});

const CouponStrip = z.strictObject({
	component: z.literal('coupon-strip'),
	props: z.strictObject({
		eyebrow: label, headline, body: body.optional(), code: z.string().trim().min(1).max(32).optional(), ctaLabel: label,
	}),
});

const BrandSpotlight = z.strictObject({
	component: z.literal('brand-spotlight'),
	props: z.strictObject({
		brandName: label, eyebrow: label.optional(), headline, body, image: asset,
		ctaLabel: label.optional(), ctaHref: href.optional(),
	}),
});

const EventCountdown = z.strictObject({
	component: z.literal('event-countdown'),
	props: z.strictObject({
		eyebrow: label.optional(), headline, body: body.optional(), endsAt: z.string().trim().min(1).max(64),
		ctaLabel: label.optional(), ctaHref: href.optional(),
	}),
});

const TrendShop = z.strictObject({
	component: z.literal('trend-shop'),
	props: z.strictObject({ sectionLabel: label.optional(), headline, image: asset, ctaLabel: label, ctaHref: href }),
});

const EmailCaptureInline = z.strictObject({
	component: z.literal('email-capture-inline'),
	props: z.strictObject({
		eyebrow: label.optional(), headline, body: body.optional(), offerCopy: body.optional(), ctaLabel: label,
		privacyNote: body.optional(),
	}),
});

const Callout = z.strictObject({ icon: label, label, body: body.optional() });
const ServiceCalloutsGrid = z.strictObject({
	component: z.literal('service-callouts-grid'),
	props: z.strictObject({ columns: z.union([z.literal(3), z.literal(4)]), callouts: z.array(Callout).min(1).max(4) }),
});

const LocatorStrip = z.strictObject({
	component: z.literal('locator-strip'),
	props: z.strictObject({ eyebrow: label.optional(), headline, body: body.optional(), ctaLabel: label, ctaHref: href }),
});

const BOPISStrip = z.strictObject({
	component: z.literal('bopis-strip'),
	props: z.strictObject({
		storeName: label, distanceMi: z.number().nonnegative().max(500), readyByLabel: label,
		productName: label.optional(), ctaLabel: label.optional(), ctaHref: href.optional(),
	}),
});

const ClusterChipRow = z.strictObject({
	component: z.literal('cluster-chip-row'),
	props: z.strictObject({
		sectionLabel: label.optional(),
		chips: z.array(z.strictObject({ label, href })).min(1).max(12),
	}),
});

const LastChanceUpsellRow = z.strictObject({
	component: z.literal('last-chance-upsell-row'),
	props: z.strictObject({ title: headline, products: z.array(ProductRef).min(1).max(6) }),
});

const AssuranceStripCheckout = z.strictObject({
	component: z.literal('assurance-strip-checkout'),
	props: z.strictObject({
		items: z.array(z.strictObject({ icon: label, label, body: body.optional() })).min(2).max(4),
		variant: z.enum(['first-time', 'returning', 'loyalty-known']),
	}),
});

const ForYouRow = z.strictObject({
	component: z.literal('for-you-row'),
	props: z.strictObject({ title: headline, reasoning: body.optional(), products: z.array(ProductRef).min(1).max(8) }),
});

const BOPISPicker = z.strictObject({
	component: z.literal('bopis-picker'),
	props: z.strictObject({
		zip: z.string().regex(/^\d{5}$/).optional(),
		stores: z.array(z.strictObject({
			id: productId, name: label, address: body, distanceMi: z.number().nonnegative().max(500).optional(),
			hours: label, pickupReady: z.boolean(), readyByLabel: label.optional(),
		})).max(12),
		productName: label.optional(),
	}),
});

const BeallsBucksCallout = z.strictObject({
	component: z.literal('bealls-bucks-callout'),
	props: z.strictObject({
		mode: z.enum(['earn', 'redeem', 'tier-progress']), amount: z.number().finite(), unit: label,
		threshold: z.number().finite().optional(), tierLabel: label.optional(),
	}),
});

const HiddenOnly = z.never();

export const ZoneSchemas = {
	'home.hero': z.union([EditorialHero, LifestylePriceHero, EditorialHeader]),
	'home.featured-row': z.union([ProductGrid, ProductCarousel, EditorialHeader, EventCountdown, BrandSpotlight, TrendShop]),
	'home.editorial-strip': z.union([CategoryTileGrid, BrandSpotlight]),
	'home.brand-spotlight': BrandSpotlight,
	'home.below-fold': z.union([CategoryTileGrid, PromoStrip, BOPISStrip, EmailCaptureInline, ServiceCalloutsGrid, LocatorStrip]),

	'plp.banner': z.union([PromoStrip, CouponStrip, EditorialHeader, EventCountdown, BrandSpotlight, EmailCaptureInline, ServiceCalloutsGrid, LocatorStrip]),
	'plp.editorial-header': z.union([EditorialHero, EditorialHeader]),
	'plp.cluster-row': ClusterChipRow,
	'plp.between-thirds': PromoStrip,
	'plp.below-grid': CategoryTileGrid,
	'plp.empty-state': HiddenOnly,

	'pdp.below-description': BrandSpotlight,
	'pdp.related': ProductCarousel,
	'pdp.cross-sell': ProductCarousel,
	'pdp.recently-viewed': ProductCarousel,
	'pdp.below-recs': BOPISPicker,

	'cart.above-checkout-cta': LastChanceUpsellRow,
	'cart.below-fold': z.union([ProductCarousel, BeallsBucksCallout]),
	'cart.empty-state': HiddenOnly,

	'checkout.assurance-strip': AssuranceStripCheckout,
	'checkout.last-chance-upsell': LastChanceUpsellRow,

	'search.empty-state': HiddenOnly,
	'search.zero-results-rescue': z.union([CategoryTileGrid, ProductCarousel]),

	'account.welcome': z.union([EmailCaptureInline, ServiceCalloutsGrid]),
	'account.dashboard-pick': ForYouRow,

	'locator.editorial-intro': EditorialHeader,

	'error-404.rescue': z.union([CategoryTileGrid, ProductCarousel]),
	'error-empty.rescue': HiddenOnly,
} as const satisfies Record<ZoneId, z.ZodTypeAny>;

export const RENDERABLE_ZONE_COMPONENT_IDS = [
	'editorial-header', 'editorial-hero', 'lifestyle-price-hero', 'product-grid', 'product-carousel',
	'category-tile-grid', 'promo-strip', 'coupon-strip', 'brand-spotlight', 'event-countdown',
	'trend-shop', 'email-capture-inline', 'service-callouts-grid', 'locator-strip', 'bopis-strip',
	'cluster-chip-row', 'last-chance-upsell-row', 'assurance-strip-checkout', 'for-you-row',
	'bopis-picker', 'bealls-bucks-callout',
] as const;

export type RenderableZoneComponentId = (typeof RENDERABLE_ZONE_COMPONENT_IDS)[number];
export type ZoneContent<Z extends ZoneId> = z.infer<(typeof ZoneSchemas)[Z]>;
