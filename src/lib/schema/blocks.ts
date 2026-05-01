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
