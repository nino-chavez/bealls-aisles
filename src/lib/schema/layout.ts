import { z } from 'zod';

/**
 * Layout Schema — the contract between the AI and the renderer.
 * Descriptions kept concise to minimize prompt token usage.
 */

const ProductRef = z.object({
	productId: z.string().describe('Product ID from catalog'),
	role: z.enum(['hero', 'featured', 'standard', 'compact']).describe('Display treatment'),
});

const EditorialHeaderSection = z.object({
	component: z.literal('editorial-header'),
	props: z.object({
		eyebrow: z.string().describe('Uppercase label, e.g. "THE OFFICE EDIT"'),
		headline: z.string().describe('Editorial heading, not generic'),
		body: z.string().describe('1-2 sentences, warm and specific'),
	}),
});

const HeroProductSection = z.object({
	component: z.literal('hero-product'),
	props: z.object({
		product: ProductRef,
		showSpecs: z.boolean().describe('Show specs grid below description'),
	}),
});

const ProductGridSection = z.object({
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

const SubcategoryLink = z.object({
	label: z.string().describe('Subcategory label, e.g. "Tops"'),
	href: z.string().describe('Subcategory URL slug, e.g. "/c/women/tops"'),
});

const CategoryHeaderSection = z.object({
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

const PromoStripSection = z.object({
	component: z.literal('promo-strip'),
	props: z.object({
		eyebrow: z.string().optional().describe('Optional small label, e.g. "TRENDING NOW"'),
		headline: z.string().describe('Main promo message, e.g. "Free shipping on orders $99+"'),
		ctaLabel: z.string().optional().describe('CTA button label, e.g. "Shop Now"'),
		ctaHref: z.string().optional().describe('CTA destination'),
		urgency: z.enum(['none', 'soft', 'hard']).describe('Visual emphasis. none=subtle, soft=accent, hard=primary'),
	}),
});

const CategoryTile = z.object({
	label: z.string().describe('Tile label, e.g. "Vacation Outfits"'),
	image: z.string().describe('Tile image URL'),
	href: z.string().describe('Tile destination'),
	description: z.string().optional().describe('Optional descriptive copy below the tile'),
});

const CategoryTileGridSection = z.object({
	component: z.literal('category-tile-grid'),
	props: z.object({
		sectionLabel: z.string().optional().describe('Optional section heading above the tiles'),
		columns: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).describe('Number of tiles per row'),
		tiles: z.array(CategoryTile).min(2).max(5).describe('Category tiles in display order'),
	}),
});

const PriceTier = z.object({
	label: z.string().describe('Tier label, e.g. "Under $25"'),
	image: z.string().describe('Tier hero image URL'),
	href: z.string().describe('Tier destination'),
	savingsBadge: z.string().optional().describe('Optional badge, e.g. "Up to 60% off"'),
});

const PriceRailSection = z.object({
	component: z.literal('price-rail'),
	props: z.object({
		columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).describe('Number of price tiers'),
		tiers: z.array(PriceTier).min(2).max(4).describe('Price tiers in display order'),
	}),
});

const ProductCarouselSection = z.object({
	component: z.literal('product-carousel'),
	props: z.object({
		title: z.string().describe('Section title, e.g. "Best Sellers"'),
		products: z.array(ProductRef).min(3).describe('Products in carousel order'),
		showRating: z.boolean().optional().describe('Show star rating + review count on cards'),
		showBadges: z.boolean().optional().describe('Show per-product badges'),
		showQuickAdd: z.boolean().optional().describe('Show Quick view / Add to Cart button on cards'),
	}),
});

const CouponStripSection = z.object({
	component: z.literal('coupon-strip'),
	props: z.object({
		eyebrow: z.string().describe('Eyebrow label, e.g. "OFFER FOR YOU"'),
		headline: z.string().describe('Main offer, e.g. "Get $10 off when you spend $80+"'),
		body: z.string().optional().describe('Optional fine print or terms summary'),
		code: z.string().optional().describe('Coupon code to reveal/copy on click'),
		ctaLabel: z.string().describe('CTA button label, e.g. "Get Code"'),
	}),
});

/**
 * Storefront-mode section vocabulary — the full transactional set.
 * Includes editorial, products, grids, headers, and Bealls-family
 * promotional/merchandising components.
 */
export const StorefrontSectionSchema = z.discriminatedUnion('component', [
	EditorialHeaderSection,
	HeroProductSection,
	ProductGridSection,
	CategoryHeaderSection,
	PromoStripSection,
	CategoryTileGridSection,
	PriceRailSection,
	ProductCarouselSection,
	CouponStripSection,
]);

/**
 * Content-mode section vocabulary — non-transactional subset.
 * Excludes hero-product, product-grid, product-carousel, price-rail, coupon-strip
 * (no products / no transactional offers in content mode).
 * Includes promo-strip (used for newsletter / event callouts) and
 * category-tile-grid (used for brand-pillar tiles).
 */
export const ContentSectionSchema = z.discriminatedUnion('component', [
	EditorialHeaderSection,
	CategoryHeaderSection,
	PromoStripSection,
	CategoryTileGridSection,
]);

/** Universal section schema — used for parsing without mode constraint. */
export const SectionSchema = StorefrontSectionSchema;

export type Section = z.infer<typeof StorefrontSectionSchema>;
export type ContentSection = z.infer<typeof ContentSectionSchema>;

const layoutBase = {
	persona: z.enum(['gatherer', 'hunter', 'researcher', 'gifter']).describe('Detected persona'),
	reasoning: z.string().describe('Why this layout was chosen (1-2 sentences)'),
	productOrder: z.array(z.string()).describe('Product IDs in display order (empty array for content-mode brands)'),
};

export const StorefrontLayoutSchema = z.object({
	...layoutBase,
	sections: z.array(StorefrontSectionSchema).min(1).max(8).describe('Ordered UI sections'),
});

export const ContentLayoutSchema = z.object({
	...layoutBase,
	sections: z.array(ContentSectionSchema).min(1).max(8).describe('Ordered UI sections'),
});

/** Universal layout schema — kept as the storefront variant for backwards compatibility. */
export const LayoutSchema = StorefrontLayoutSchema;

export type Layout = z.infer<typeof StorefrontLayoutSchema>;
export type ContentLayout = z.infer<typeof ContentLayoutSchema>;

/**
 * Returns the appropriate layout schema for a brand's operating mode.
 * See docs/decisions/005-storefront-vs-content-modes.md.
 */
export function getLayoutSchema(mode: 'storefront' | 'content') {
	return mode === 'content' ? ContentLayoutSchema : StorefrontLayoutSchema;
}
