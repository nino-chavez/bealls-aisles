import { z } from 'zod';

/**
 * Block (component) schemas — the shared vocabulary that surface-typed
 * layout schemas compose. See ADR-006 for the architectural decision
 * to split blocks from layouts.
 *
 * Surface schemas in `./layouts/*.ts` import from here and constrain
 * which blocks are valid for each surface.
 *
 * Descriptions kept concise to minimize prompt token usage.
 */

// ─── Shared sub-schemas ────────────────────────────────────────────

export const ProductRef = z.object({
	productId: z.string().describe('Product ID from catalog'),
	role: z.enum(['hero', 'featured', 'standard', 'compact']).describe('Display treatment'),
});

const SubcategoryLink = z.object({
	label: z.string().describe('Subcategory label, e.g. "Tops"'),
	href: z.string().describe('Subcategory URL slug, e.g. "/c/women/tops"'),
});

const CategoryTile = z.object({
	label: z.string().describe('Tile label, e.g. "Vacation Outfits"'),
	image: z.string().describe('Tile image URL'),
	href: z.string().describe('Tile destination'),
	description: z.string().optional().describe('Optional descriptive copy below the tile'),
});

const PriceTier = z.object({
	label: z.string().describe('Tier label, e.g. "Under $25"'),
	image: z.string().describe('Tier hero image URL'),
	href: z.string().describe('Tier destination'),
	savingsBadge: z.string().optional().describe('Optional badge, e.g. "Up to 60% off"'),
});

// ─── Block schemas ─────────────────────────────────────────────────

export const EditorialHeaderSection = z.object({
	component: z.literal('editorial-header'),
	props: z.object({
		eyebrow: z.string().describe('Uppercase label, e.g. "THE OFFICE EDIT"'),
		headline: z.string().describe('Editorial heading, not generic'),
		body: z.string().describe('1-2 sentences, warm and specific'),
	}),
});

export const HeroProductSection = z.object({
	component: z.literal('hero-product'),
	props: z.object({
		product: ProductRef,
		showSpecs: z.boolean().describe('Show specs grid below description'),
	}),
});

export const ProductGridSection = z.object({
	component: z.literal('product-grid'),
	props: z.object({
		columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).describe('2=editorial, 3-4=dense'),
		products: z.array(ProductRef).describe('Products in display order'),
		imageRatio: z.enum(['landscape', 'square']).describe('landscape=4:3, square=1:1'),
		showDescription: z.boolean().describe('Show product description'),
		showSpecs: z.boolean().describe('Show specs line'),
		showQuickAdd: z.boolean().describe('Show Add to Cart button'),
		showRating: z.boolean().optional().describe('Show star rating + review count'),
		showBadges: z.boolean().optional().describe('Show per-product badges (e.g. New, Deal)'),
	}),
});

export const CategoryHeaderSection = z.object({
	component: z.literal('category-header'),
	props: z.object({
		title: z.string().describe('Category title'),
		subtitle: z.string().optional().describe('Subtitle or count'),
		showSort: z.boolean().describe('Show sort dropdown'),
		showFilter: z.boolean().describe('Show filter button'),
		heroImage: z.string().optional().describe('Optional banner image URL above title'),
		subcategories: z.array(SubcategoryLink).optional().describe('Optional sub-category text-link strip'),
	}),
});

export const PromoStripSection = z.object({
	component: z.literal('promo-strip'),
	props: z.object({
		eyebrow: z.string().optional().describe('Optional small label, e.g. "TRENDING NOW"'),
		headline: z.string().describe('Main promo message, e.g. "Free shipping on orders $99+"'),
		ctaLabel: z.string().optional().describe('CTA button label, e.g. "Shop Now"'),
		ctaHref: z.string().optional().describe('CTA destination'),
		urgency: z.enum(['none', 'soft', 'hard']).describe('Visual emphasis. none=subtle, soft=accent, hard=primary'),
	}),
});

export const CategoryTileGridSection = z.object({
	component: z.literal('category-tile-grid'),
	props: z.object({
		sectionLabel: z.string().optional().describe('Optional section heading above the tiles'),
		columns: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).describe('Number of tiles per row'),
		tiles: z.array(CategoryTile).min(2).describe('Category tiles in display order (2-5 ideal)'),
	}),
});

export const PriceRailSection = z.object({
	component: z.literal('price-rail'),
	props: z.object({
		columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).describe('Number of price tiers'),
		tiers: z.array(PriceTier).min(2).describe('Price tiers in display order (2-4 ideal)'),
	}),
});

export const ProductCarouselSection = z.object({
	component: z.literal('product-carousel'),
	props: z.object({
		title: z.string().describe('Section title, e.g. "Best Sellers"'),
		products: z.array(ProductRef).min(3).describe('Products in carousel order'),
		showRating: z.boolean().optional().describe('Show star rating + review count on cards'),
		showBadges: z.boolean().optional().describe('Show per-product badges'),
		showQuickAdd: z.boolean().optional().describe('Show Quick view / Add to Cart button on cards'),
	}),
});

export const CouponStripSection = z.object({
	component: z.literal('coupon-strip'),
	props: z.object({
		eyebrow: z.string().describe('Eyebrow label, e.g. "OFFER FOR YOU"'),
		headline: z.string().describe('Main offer, e.g. "Get $10 off when you spend $80+"'),
		body: z.string().optional().describe('Optional fine print or terms summary'),
		code: z.string().optional().describe('Coupon code to reveal/copy on click'),
		ctaLabel: z.string().describe('CTA button label, e.g. "Get Code"'),
	}),
});

export const EditorialHeroSection = z.object({
	component: z.literal('editorial-hero'),
	props: z.object({
		image: z.string().describe('Hero background image URL'),
		eyebrow: z.string().optional().describe('Optional small label, e.g. "NEW SEASON"'),
		headline: z.string().describe('Main editorial headline, can include line breaks'),
		body: z.string().optional().describe('Optional 1-2 sentence body copy'),
		ctaLabel: z.string().optional().describe('CTA label, e.g. "Shop Women"'),
		ctaHref: z.string().optional().describe('CTA destination'),
		textPosition: z.enum(['left', 'center', 'right']).describe('Where the text overlay sits on the image'),
	}),
});

export const BeallsBucksCalloutSection = z.object({
	component: z.literal('bealls-bucks-callout'),
	props: z.object({
		mode: z.enum(['earn', 'redeem', 'tier-progress']).describe('earn=preview earnings, redeem=spend balance, tier-progress=progress to next tier'),
		amount: z.number().describe('Dollar/point amount relevant to the mode'),
		unit: z.string().describe('Unit label, e.g. "Bealls Bucks", "points"'),
		threshold: z.number().optional().describe('Optional spend threshold or tier requirement'),
		tierLabel: z.string().optional().describe('Optional tier name for tier-progress mode'),
	}),
});

export const LifestylePriceHeroSection = z.object({
	component: z.literal('lifestyle-price-hero'),
	props: z.object({
		image: z.string().describe('Lifestyle image URL'),
		category: z.string().describe('Category label, e.g. "Handbags"'),
		priceLabel: z.string().describe('Price callout, e.g. "starting at $19.99"'),
		ctaLabel: z.string().describe('CTA label, e.g. "Shop Now"'),
		ctaHref: z.string().describe('CTA destination'),
	}),
});

export const ForYouRowSection = z.object({
	component: z.literal('for-you-row'),
	props: z.object({
		title: z.string().describe('Personalized title, e.g. "Picked for you" or "Based on your last visit"'),
		reasoning: z.string().optional().describe('Optional 1-line context, e.g. "Because you browsed home decor"'),
		products: z.array(ProductRef).min(3).describe('Persona-fit products in display order (4-6 ideal)'),
	}),
});

// ─── PDP scaffold blocks (Phase 3) ─────────────────────────────────

const ProductImage = z.object({
	url: z.string().describe('Image URL (BC catalog or CDN)'),
	alt: z.string().describe('Alt text — meaningful, not "product image"'),
});

export const ImageGallerySection = z.object({
	component: z.literal('image-gallery'),
	props: z.object({
		images: z.array(ProductImage).min(1).describe('Gallery images in display order; first is the lead image'),
		productName: z.string().describe('Product name — used for default alt fallback'),
	}),
});

export const ProductTitleBlockSection = z.object({
	component: z.literal('product-title-block'),
	props: z.object({
		productName: z.string().describe('Product name (h1)'),
		brandLabel: z.string().optional().describe('Optional brand/collection label above the name'),
		price: z.number().describe('Regular price in dollars'),
		salePrice: z.number().optional().describe('Optional sale price; renders strike-through when present'),
		rating: z.number().min(0).max(5).optional().describe('Average rating 0–5; renderer hides if absent'),
		reviewCount: z.number().int().nonnegative().optional().describe('Review count for the rating link'),
	}),
});

const VariantOption = z.object({
	id: z.string().describe('Stable variant ID (used for selection state)'),
	label: z.string().describe('Display label, e.g. "Medium" or "Walnut"'),
	available: z.boolean().describe('Whether this variant is in stock and selectable'),
	swatch: z.string().optional().describe('Optional swatch color or image URL for color-style variants'),
});

const VariantGroup = z.object({
	name: z.string().describe('Variant axis name, e.g. "Size", "Color"'),
	style: z.enum(['chip', 'swatch', 'dropdown']).describe('Visual treatment'),
	options: z.array(VariantOption).min(1).describe('Variant options for this axis'),
});

export const VariantSelectorSection = z.object({
	component: z.literal('variant-selector'),
	props: z.object({
		groups: z.array(VariantGroup).describe('Variant axes (size, color, etc.); empty array hides the block'),
	}),
});

export const StockSignalSection = z.object({
	component: z.literal('stock-signal'),
	props: z.object({
		level: z.enum(['plentiful', 'low', 'last-few', 'out']).describe('Inventory tier; renderer chooses copy + emphasis'),
		message: z.string().describe('Copy to display, e.g. "Only 3 left at this price"'),
		urgency: z.enum(['none', 'soft', 'hard']).describe('Visual emphasis; hard = primary accent'),
	}),
});

export const AddToCartBarSection = z.object({
	component: z.literal('add-to-cart-bar'),
	props: z.object({
		productEntityId: z.number().describe('BC product entity ID for the cart mutation'),
		ctaLabel: z.string().describe('Primary CTA label, e.g. "Add to Cart" or "Add to Bag"'),
		price: z.number().describe('Display price in dollars (post-variant, post-discount)'),
		showQuantity: z.boolean().describe('Whether to show the quantity stepper'),
		maxQuantity: z.number().int().min(1).optional().describe('Max selectable quantity (defaults to 10)'),
		secondaryAction: z
			.enum(['save-to-picks', 'find-in-store', 'none'])
			.describe('Secondary action surfaced beside the ATC button'),
	}),
});

// PDP Slice 2 — description, reviews, BOPIS. Description and reviews are
// scaffold blocks (not zone-targeted) per ADR-007 §3.3; BOPIS is a block
// option for the `pdp.below-recs` zone. Schemas live alongside scaffold
// blocks so the prompt taxonomy (when surface-typed PDP schemas land in
// Phase 3) sees the same vocabulary.

const DescriptionTab = z.object({
	label: z.string().describe('Tab label, e.g. "Description", "Specs"'),
	content: z.string().describe('Tab body — HTML or plain text'),
});

export const DescriptionTabsSection = z.object({
	component: z.literal('description-tabs'),
	props: z.object({
		tabs: z.array(DescriptionTab).min(1).describe('Tabs in display order; first is selected by default'),
		initialIndex: z.number().int().nonnegative().optional().describe('Optional initial-tab override'),
	}),
});

export const ReviewsSummarySection = z.object({
	component: z.literal('reviews-summary'),
	props: z.object({
		avgRating: z.number().min(0).max(5).describe('Average star rating, 0–5'),
		reviewCount: z.number().int().nonnegative().describe('Total review count'),
		histogram: z.array(z.number().int().nonnegative()).length(5).describe('Counts per star bucket: index 0 = 1-star, index 4 = 5-star'),
		writeReviewHref: z.string().optional().describe('CTA destination for the "Write a review" affordance'),
	}),
});

const Review = z.object({
	id: z.string().describe('Stable review ID'),
	author: z.string().describe('Reviewer display name'),
	date: z.string().describe('ISO 8601 date string'),
	rating: z.number().int().min(1).max(5).describe('Star rating, 1–5'),
	title: z.string().optional().describe('Optional review headline'),
	body: z.string().describe('Review body copy'),
	helpful: z.number().int().nonnegative().optional().describe('Optional helpful-vote count'),
	verifiedPurchase: z.boolean().optional().describe('Whether the reviewer is a verified buyer'),
});

export const ReviewsListSection = z.object({
	component: z.literal('reviews-list'),
	props: z.object({
		reviews: z.array(Review).describe('Reviews in catalog order; component sorts client-side'),
		filters: z
			.object({
				sort: z.enum(['recent', 'helpful', 'highest', 'lowest']).optional(),
			})
			.optional(),
	}),
});

const BOPISStore = z.object({
	id: z.string().describe('Stable store ID'),
	name: z.string().describe('Store display name, e.g. "Bealls Sarasota"'),
	address: z.string().describe('Single-line street address'),
	distanceMi: z.number().nonnegative().optional().describe('Distance from shopper ZIP, in miles'),
	hours: z.string().describe('Today\'s hours, e.g. "Open 10am–9pm"'),
	pickupReady: z.boolean().describe('Whether this store has stock for pickup'),
	readyByLabel: z.string().optional().describe('Optional "Ready by 4pm today" detail'),
});

export const BOPISPickerSection = z.object({
	component: z.literal('bopis-picker'),
	props: z.object({
		zip: z.string().optional().describe('Shopper-provided ZIP code (5-digit US)'),
		stores: z.array(BOPISStore).describe('Nearby stores; empty array shows search-only state'),
		productName: z.string().optional().describe('Product name surfaced in the picker subtitle'),
	}),
});

// ─── Cart + checkout blocks (Phase 3) ───────────────────────────────

const CartLineItem = z.object({
	entityId: z.string().describe('BC line item entity ID'),
	productEntityId: z.number().int().describe('BC product entity ID'),
	productSlug: z.string().optional().describe('Slug for the product detail link'),
	name: z.string().describe('Product display name'),
	quantity: z.number().int().min(1).describe('Line item quantity'),
	salePrice: z.object({ value: z.number() }).describe('Per-unit sale price (display)'),
	listPrice: z.object({ value: z.number() }).describe('Per-unit list price (display)'),
	imageUrl: z.string().describe('Product image URL'),
});

/**
 * cart-line-items — foundation primitive. Items come from cart state,
 * not AI composition. Schema exists so the block round-trips through
 * the layout shape if the AI ever needs to reference it (e.g. order
 * review pages); the engine should NOT compose this in cart.
 */
export const CartLineItemsSection = z.object({
	component: z.literal('cart-line-items'),
	props: z.object({
		items: z.array(CartLineItem).describe('Cart line items from cart state'),
		readonly: z.boolean().optional().describe('Hide qty stepper + remove (e.g. order review)'),
	}),
});

/**
 * cart-summary — foundation primitive. Subtotal/shipping/tax/total
 * computed from cart state. Like cart-line-items, the schema is here
 * for round-trip; engine should not emit it.
 */
export const CartSummarySection = z.object({
	component: z.literal('cart-summary'),
	props: z.object({
		subtotal: z.number().describe('Cart subtotal in display currency'),
		shipping: z.number().nullable().optional().describe('Shipping cost; null = "Calculated at checkout"'),
		tax: z.number().nullable().optional().describe('Tax amount; null = "Calculated at checkout"'),
		total: z.number().describe('Cart total in display currency'),
	}),
});

/**
 * free-shipping-meter — foundation primitive. Threshold from
 * brand.config.ts:incentives.freeShippingThresholdMinor (converted
 * to dollars by the parent).
 */
export const FreeShippingMeterSection = z.object({
	component: z.literal('free-shipping-meter'),
	props: z.object({
		current: z.number().describe('Cart subtotal in display currency'),
		threshold: z.number().describe('Threshold for free shipping in display currency'),
	}),
});

/**
 * promo-code-entry — foundation primitive. Local input UI; codes
 * are honored at BC Optimized Checkout (FND-010 handoff), not
 * applied client-side here.
 */
export const PromoCodeEntrySection = z.object({
	component: z.literal('promo-code-entry'),
	props: z.object({
		appliedCodes: z.array(z.object({
			code: z.string().describe('Coupon code'),
			label: z.string().describe('Display label, e.g. "Applied at checkout"'),
			value: z.number().describe('Discount value (0 if applied at handoff)'),
		})).optional().describe('Already-applied codes'),
	}),
});

/**
 * last-chance-upsell-row — engine-composed cart/checkout block.
 * AI emits ProductRef[]; the foundation resolves refs to Product
 * objects via the products payload from /api/layout. Candidate set
 * is the tag-overlap neighborhood of the cart's line items
 * (ADR-008 Phase B / PRD-ENG-019); the AI selects 3 + writes the title.
 */
export const LastChanceUpsellRowSection = z.object({
	component: z.literal('last-chance-upsell-row'),
	props: z.object({
		title: z.string().describe('Section title, e.g. "Last chance — pair these with your order"'),
		products: z.array(ProductRef).min(1).max(6).describe('Upsell products in display order (3 ideal)'),
	}),
});

/**
 * assurance-strip-checkout — engine-composed checkout block. AI selects
 * the variant by inferred shopper signal (first-time vs returning vs
 * loyalty-known) and emits matching items copy.
 */
export const AssuranceStripCheckoutSection = z.object({
	component: z.literal('assurance-strip-checkout'),
	props: z.object({
		items: z.array(z.object({
			icon: z.string().describe('Single emoji or short glyph, e.g. "🔒"'),
			label: z.string().describe('Short label, e.g. "Secure checkout"'),
			body: z.string().optional().describe('Optional 1-line elaboration'),
		})).min(2).max(4).describe('Assurance items (3 ideal)'),
		variant: z.enum(['first-time', 'returning', 'loyalty-known']).describe('Inferred shopper signal'),
	}),
});

// ─── P0 marketing / capture / service blocks (composition-taxonomy §3 P0 set) ──

/**
 * event-countdown — time-bound event with countdown.
 * Renderer hides itself once `endsAt` is past; treat as merchandising
 * urgency lever (Hunter, Gatherer biases per taxonomy §3.1).
 */
export const EventCountdownSection = z.object({
	component: z.literal('event-countdown'),
	props: z.object({
		eyebrow: z.string().optional().describe('Optional small label, e.g. "MEMORIAL DAY WEEKEND"'),
		headline: z.string().describe('Event headline, e.g. "Up to 70% off — Fri thru Mon"'),
		body: z.string().optional().describe('Optional 1-line elaboration'),
		endsAt: z.string().describe('Event end timestamp in ISO 8601 (e.g. "2026-05-26T23:59:59-05:00")'),
		ctaLabel: z.string().optional().describe('CTA button label, e.g. "Shop the Event"'),
		ctaHref: z.string().optional().describe('CTA destination'),
	}),
});

/**
 * brand-spotlight — featured-brand callout with image, story, CTA.
 * Visually distinct from editorial-hero (frames a brand story, not the
 * site's hero). Per taxonomy §3.1.
 */
export const BrandSpotlightSection = z.object({
	component: z.literal('brand-spotlight'),
	props: z.object({
		brandName: z.string().describe('Featured brand display name, e.g. "Reel Legends"'),
		eyebrow: z.string().optional().describe('Optional small label, e.g. "FEATURED BRAND"'),
		headline: z.string().describe('Editorial headline framing the brand story'),
		body: z.string().describe('1-3 sentences about the brand'),
		image: z.string().describe('Brand spotlight image URL'),
		ctaLabel: z.string().optional().describe('CTA label, e.g. "Shop Reel Legends"'),
		ctaHref: z.string().optional().describe('CTA destination'),
	}),
});

/**
 * trend-shop — themed seasonal collection card ("The Vacation Shop").
 * Single themed destination, distinct from category-tile-grid (nav).
 */
export const TrendShopSection = z.object({
	component: z.literal('trend-shop'),
	props: z.object({
		sectionLabel: z.string().optional().describe('Optional eyebrow above the card, e.g. "SHOP THE TREND"'),
		headline: z.string().describe('Theme headline, e.g. "The Vacation Shop"'),
		image: z.string().describe('Landscape collection image URL'),
		ctaLabel: z.string().describe('CTA label, e.g. "Shop Vacation"'),
		ctaHref: z.string().describe('CTA destination'),
	}),
});

/**
 * email-capture-inline — inline signup with offer reveal.
 * Submit handler posts to `/api/email-signup` (stub; logs to console
 * pending future CRM integration).
 */
export const EmailCaptureInlineSection = z.object({
	component: z.literal('email-capture-inline'),
	props: z.object({
		eyebrow: z.string().optional().describe('Optional small label, e.g. "JOIN US"'),
		headline: z.string().describe('Capture headline, e.g. "Sign up for emails"'),
		body: z.string().optional().describe('Optional 1-2 sentence value prop'),
		offerCopy: z.string().optional().describe('Offer revealed on success, e.g. "Use code WELCOME10 — $10 off your first order"'),
		ctaLabel: z.string().describe('CTA button label, e.g. "Sign Up"'),
		privacyNote: z.string().optional().describe('Optional small-print privacy note'),
	}),
});

const ServiceCallout = z.object({
	icon: z.string().describe('Single emoji or short glyph, e.g. "🚚"'),
	label: z.string().describe('Short label, e.g. "Free shipping over $99"'),
	body: z.string().optional().describe('Optional 1-line elaboration'),
});

/**
 * service-callouts-grid — cluster of icon callouts (shipping/returns/BOPIS/rewards).
 * Service trust strip; works as foundation fallback below the fold.
 */
export const ServiceCalloutsGridSection = z.object({
	component: z.literal('service-callouts-grid'),
	props: z.object({
		columns: z.union([z.literal(3), z.literal(4)]).describe('Number of callouts per row'),
		callouts: z.array(ServiceCallout).min(3).max(4).describe('Service callouts in display order'),
	}),
});

/**
 * locator-strip — "Visit your nearest store" thin horizontal strip.
 * Renders on home/PLP/empty surfaces. CTA points at /store-locator (PRD-FND-014).
 */
export const LocatorStripSection = z.object({
	component: z.literal('locator-strip'),
	props: z.object({
		eyebrow: z.string().optional().describe('Optional small label, e.g. "FIND A STORE"'),
		headline: z.string().describe('Strip headline, e.g. "Visit your nearest Bealls"'),
		body: z.string().optional().describe('Optional 1-line elaboration'),
		ctaLabel: z.string().describe('CTA label, e.g. "Find a Store"'),
		ctaHref: z.string().describe('CTA destination, e.g. "/store-locator"'),
	}),
});

/**
 * bopis-strip — proximity-aware "Free pickup at [Store] · Ready in 2 hours" strip.
 * Per PRD-ENG-017: foundation-rendered on PDP when shopper ZIP resolves to
 * a pickup-ready store within 30 miles. Distinct from BOPISPickerSection
 * (the larger ZIP+list selector for `pdp.below-recs`).
 *
 * The block is also AI-composable on home.below-fold for content-mode brands
 * to drive in-store engagement; in that path props come from the engine.
 */
export const BOPISStripSection = z.object({
	component: z.literal('bopis-strip'),
	props: z.object({
		storeName: z.string().describe('Nearest pickup-ready store, e.g. "Bealls Sarasota"'),
		distanceMi: z.number().nonnegative().describe('Distance in miles from shopper ZIP'),
		readyByLabel: z.string().describe('Pickup readiness, e.g. "Ready in 2 hours"'),
		productName: z.string().optional().describe('Product context, e.g. "this Tommy Bahama dress"'),
		ctaLabel: z.string().optional().describe('CTA label, defaults to "Check availability"'),
		ctaHref: z.string().optional().describe('CTA destination, defaults to "/store-locator"'),
	}),
});

/**
 * cluster-chip-row — a curated row of themed merchandising bins (e.g.
 * "BOHEMIAN ROMANCE", "VACATION OUTFITS", "RODEO STYLE") shown above a
 * PLP grid. Each chip links to a curation page or filtered view that
 * spans subcategories. The pattern is a common off-price PLP move.
 *
 * The vocabulary supports both a future trusted merchant record and bounded
 * engine composition. This repository does not ship the route-bound merchant
 * storage migration or write path; runtime database reads stay disabled until
 * a compatible schema is separately provisioned and version-enabled.
 *
 * Per the lowercase brand-voice rule, chip labels render in
 * TRACKING-WIDE UPPERCASE on the surface but are stored Title Case
 * in the data model so they're readable in admin tooling.
 */
export const ClusterChipRowSection = z.object({
	component: z.literal('cluster-chip-row'),
	props: z.object({
		sectionLabel: z.string().optional().describe('Optional row eyebrow, e.g. "Outfit collections" — sentence-case lowercase per brand voice'),
		chips: z
			.array(
				z.object({
					label: z.string().describe('Theme label, Title Case in storage; rendered TRACKING-WIDE UPPERCASE'),
					href: z.string().describe('Curation destination — category page with theme filter, /search?q=, or admin-authored landing'),
				}),
			)
			.min(3)
			.max(8)
			.describe('3–8 themed merchandising bins; spans subcategories'),
	}),
});

// ─── Vocabulary unions ─────────────────────────────────────────────

/**
 * Storefront-mode block vocabulary — the full transactional set.
 * Surface schemas can use a subset of this union.
 */
export const StorefrontBlocks = [
	EditorialHeaderSection,
	HeroProductSection,
	ProductGridSection,
	CategoryHeaderSection,
	PromoStripSection,
	CategoryTileGridSection,
	PriceRailSection,
	ProductCarouselSection,
	CouponStripSection,
	EditorialHeroSection,
	BeallsBucksCalloutSection,
	LifestylePriceHeroSection,
	ForYouRowSection,
	ImageGallerySection,
	ProductTitleBlockSection,
	VariantSelectorSection,
	StockSignalSection,
	AddToCartBarSection,
	DescriptionTabsSection,
	ReviewsSummarySection,
	ReviewsListSection,
	BOPISPickerSection,
	CartLineItemsSection,
	CartSummarySection,
	FreeShippingMeterSection,
	PromoCodeEntrySection,
	LastChanceUpsellRowSection,
	AssuranceStripCheckoutSection,
	EventCountdownSection,
	BrandSpotlightSection,
	TrendShopSection,
	EmailCaptureInlineSection,
	ServiceCalloutsGridSection,
	LocatorStripSection,
	BOPISStripSection,
	ClusterChipRowSection,
] as const;

/**
 * Content-mode block vocabulary — non-transactional subset.
 * Excludes hero-product, product-grid, product-carousel, price-rail, coupon-strip
 * (no products / no transactional offers in content mode).
 */
export const ContentBlocks = [
	EditorialHeaderSection,
	CategoryHeaderSection,
	PromoStripSection,
	CategoryTileGridSection,
	EditorialHeroSection,
	BeallsBucksCalloutSection,
] as const;
