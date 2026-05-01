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
