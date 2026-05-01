/**
 * Brand configuration — the single source of truth for multi-brand support.
 *
 * Selected via BRAND_ID env var (defaults to "bealls").
 * Everything brand-specific — name, tagline, colors, fonts, category mapping,
 * prompt context, voice — comes from here.
 */

export interface BrandConfig {
	id: string;
	name: string;
	tagline: string;
	domain: string;
	footerNote: string;

	/**
	 * Operating mode — selects between transactional storefront and content-only
	 * brand/locator site. Drives schema vocabulary, prompt vocabulary, and CTA
	 * routing. See docs/decisions/005-storefront-vs-content-modes.md.
	 *
	 * Defaults to 'storefront' if omitted (backwards compatible with existing brands).
	 */
	mode?: 'storefront' | 'content';

	/** BigCommerce channel config. Only required for storefront-mode brands. */
	bc: {
		channelId: number;
		categoryPrefix: string;
	};

	/** Category slug → BC category name + display name */
	categories: Record<string, { bcName: string; displayName: string }>;

	/** CSS theme tokens (injected into :root) */
	theme: {
		primary: string;
		secondary: string;
		accent: string;
		surfaceBg: string;
		surfaceFg: string;
		surfaceCard: string;
		surfaceCardFg: string;
		surfaceMuted: string;
		surfaceMutedFg: string;
		surfaceBorder: string;
		fontDisplay: string;
		fontBody: string;
		fontMono: string;
	};

	/** Google Fonts import URL */
	googleFontsUrl: string;

	/** Homepage content — brand-specific editorial copy */
	homepage: {
		heroHeadline: string;
		heroBody: string;
		heroImage?: string;
		editorialHeadline: string;
		editorialBody: string;
		valueProps: Array<{ title: string; body: string }>;
	};

	/** LLM prompt context — injected into layout/refine/enrichment prompts */
	prompt: {
		storeName: string;
		storeDescription: string;
		productDomain: string;
		personaDefinitions: Record<string, string>;
		voiceGuidance: string;
	};

	/** Incentives config — drives bealls-bucks-callout, coupon-strip, free-shipping promos. Optional; brands without loyalty omit it. */
	incentives?: BrandIncentivesConfig;

	/**
	 * Pricing language style.
	 * - 'standard' (default): regular price → sale price strikethrough
	 * - 'off-price': "Comparable value $X" label + "You save X%" badge (Bealls family pattern)
	 */
	pricingStyle?: 'standard' | 'off-price';

}

export interface BrandIncentivesConfig {
	/** Cart subtotal (minor units / cents) at which free shipping kicks in. Null = no threshold promo. */
	freeShippingThresholdMinor?: number | null;
	/** Loyalty program shape. Omit if brand has no points program. */
	loyalty?: {
		programId: string;
		programName: string;
		/** Unit label, e.g. "points", "Bealls Bucks", "stars". */
		unit: string;
		/** Ordered tiers from lowest to highest. First is the entry tier. */
		tiers?: Array<{ name: string; unitsRequired: number }>;
	};
}

const BRANDS: Record<string, BrandConfig> = {
	bealls: {
		id: 'bealls',
		name: 'bealls',
		tagline: 'Clothing, shoes, home & gifts for everyone',
		domain: 'family apparel, shoes, home, and gifts',
		footerNote: 'bealls is a demo storefront powered by Aisles',

		bc: {
			channelId: 1846324, // bealls headless channel
			categoryPrefix: 'Bealls',
		},

		categories: {
			'women': { bcName: 'Bealls Women', displayName: 'Women' },
			'men': { bcName: 'Bealls Men', displayName: 'Men' },
			'kids': { bcName: 'Bealls Kids', displayName: 'Kids' },
			'shoes': { bcName: 'Bealls Shoes', displayName: 'Shoes' },
			'home': { bcName: 'Bealls Home', displayName: 'Home' },
			'beauty': { bcName: 'Bealls Beauty', displayName: 'Beauty' },
			'handbags': { bcName: 'Bealls Handbags', displayName: 'Handbags' },
			'accessories': { bcName: 'Bealls Accessories', displayName: 'Accessories' },
		},

		theme: {
			primary: '#c8102e',         // Bealls red
			secondary: '#a00d24',       // deeper red for hover
			accent: '#1a1a1a',          // black accent
			surfaceBg: '#ffffff',
			surfaceFg: '#1a1a1a',
			surfaceCard: '#ffffff',
			surfaceCardFg: '#1a1a1a',
			surfaceMuted: '#f6f6f6',
			surfaceMutedFg: '#5a5a5a',
			surfaceBorder: '#e5e5e5',
			fontDisplay: "'Plus Jakarta Sans', system-ui, sans-serif",
			fontBody: "'Inter', system-ui, sans-serif",
			fontMono: "'JetBrains Mono', Menlo, monospace",
		},

		googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',

		homepage: {
			heroHeadline: 'Find your favorites for less',
			heroBody: 'Clothing, shoes, home, and gifts at comparable values up to 70% off. New arrivals every week — for everyone in the family.',
			heroImage: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1920&q=80&auto=format&fit=crop',
			editorialHeadline: 'Real names. Real value. Real every day.',
			editorialBody: 'Off-price means top brands at off-price prices. Browse the comparable values, shop the savings, take it home today.',
			valueProps: [
				{ title: 'Free shipping over $99', body: 'Standard shipping is on us when your order tops $99. No code needed.' },
				{ title: 'Easy returns', body: 'Return online orders for free at any bealls store, or by mail within 60 days.' },
				{ title: 'Earn Bealls Bucks', body: 'Members earn $5 for every $100 spent — shop, save, and earn rewards on every order.' },
			],
		},

		prompt: {
			storeName: 'bealls',
			storeDescription: "an off-price family retailer offering clothing, shoes, home, and gifts at comparable values up to 70% off",
			productDomain: 'family apparel, shoes, home, and gifts',
			personaDefinitions: {
				gatherer: 'Browsing for vacation outfits, seasonal updates, family wardrobes. Loves a deal but takes time to discover. Open to inspiration tiles, seasonal edits, and outfit ideas.',
				hunter: 'Restocking essentials on coupon. Knows what they need — kids\' shorts under $10, work tops on sale, beach essentials. Wants filters, sale prices, fast checkout.',
				researcher: 'Reading reviews, comparing fabric content and sizing. Wants confidence on fit and quality before clicking buy. Methodical, value-oriented.',
				gifter: 'Snowbird grandparents, holiday gifts for kids/grandkids, broad-appeal gifts at reasonable price points. Wants safe choices that feel generous.',
			},
			voiceGuidance: 'Friendly, value-driven, broadly inclusive. Use comparable-value language ("Comparable value $20 — You save 50%") rather than "regular price." No fake urgency, no fashion pretension. Family-oriented copy. Inclusive across ages, sizes, and budgets.',
		},

		incentives: {
			freeShippingThresholdMinor: 9900,
			loyalty: {
				programId: 'bealls-bucks',
				programName: 'Bealls Rewards',
				unit: 'Bealls Bucks',
				tiers: [
					{ name: 'Member', unitsRequired: 0 },
					{ name: 'Insider', unitsRequired: 5000 },
					{ name: 'VIP', unitsRequired: 25000 },
				],
			},
		},

		pricingStyle: 'off-price',

	},

	beallsflorida: {
		id: 'beallsflorida',
		name: 'Bealls Florida',
		tagline: 'Florida is a feeling',
		domain: 'coastal apparel and lifestyle',
		footerNote: 'Bealls Florida is a demo storefront powered by Aisles',

		bc: {
			channelId: 1846321, // Bealls Florida headless channel
			categoryPrefix: 'BeallsFlorida',
		},

		categories: {
			'women': { bcName: 'BeallsFlorida Women', displayName: 'Women' },
			'men': { bcName: 'BeallsFlorida Men', displayName: 'Men' },
			'kids': { bcName: 'BeallsFlorida Kids', displayName: 'Kids' },
			'shoes': { bcName: 'BeallsFlorida Shoes', displayName: 'Shoes' },
			'home': { bcName: 'BeallsFlorida Home', displayName: 'Home' },
			'vacation': { bcName: 'BeallsFlorida Vacation', displayName: 'Vacation' },
			'swim': { bcName: 'BeallsFlorida Swim & Beach', displayName: 'Swim & Beach' },
			'accessories': { bcName: 'BeallsFlorida Accessories', displayName: 'Accessories' },
		},

		theme: {
			primary: '#0066b3',         // Bealls Florida blue
			secondary: '#004d8a',       // deeper blue for hover
			accent: '#00a3c4',          // teal accent
			surfaceBg: '#ffffff',
			surfaceFg: '#1a2842',
			surfaceCard: '#ffffff',
			surfaceCardFg: '#1a2842',
			surfaceMuted: '#f0f5fa',
			surfaceMutedFg: '#5a6c83',
			surfaceBorder: '#dde6f0',
			fontDisplay: "'Playfair Display', Georgia, serif",
			fontBody: "'Inter', system-ui, sans-serif",
			fontMono: "'JetBrains Mono', Menlo, monospace",
		},

		googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',

		homepage: {
			heroHeadline: 'Florida is a feeling',
			heroBody: 'Sunshine state living never looked so good. Resort wear, beach essentials, and easy weekends — for everyone in the family.',
			heroImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80&auto=format&fit=crop',
			editorialHeadline: 'Fashion. Fitness. Family. Fun.',
			editorialBody: 'Coastal style at off-price values. Designed for the way Floridians actually live — at the beach, on the boat, around the pool, on the porch.',
			valueProps: [
				{ title: 'Free shipping over $99', body: 'Standard shipping on us once your order tops $99 — including resort gear and beach essentials.' },
				{ title: '60-day returns', body: 'Pack it for a vacation; if it doesn\'t work out, send it back within 60 days.' },
				{ title: 'Earn Bealls Bucks', body: 'Same Bealls Rewards program across all stores — earn $5 for every $100 spent.' },
			],
		},

		prompt: {
			storeName: 'Bealls Florida',
			storeDescription: "a Florida lifestyle brand selling coastal apparel, beach essentials, and resort wear at off-price values",
			productDomain: 'coastal lifestyle apparel',
			personaDefinitions: {
				gatherer: 'Resort/beach wear inspiration. Browsing for the next vacation, the next pool weekend, the next casual outing. Wants the lifestyle scene before the SKU.',
				hunter: 'Outfit completion. "Matching cover-up for this swimsuit." "Need shorts for the boat trip." Knows the occasion; needs the missing piece. Fast and specific.',
				researcher: 'Quality of materials matters here for durability — saltwater, sun, chlorine. Reads fabric content, UPF ratings, care instructions.',
				gifter: 'Gifts for FL relatives — the snowbird parents, the retiree who moved south, the visiting grandkids. Coastal taste, broad appeal.',
			},
			voiceGuidance: 'Coastal, lifestyle, casual confidence. Lead with the feeling, then the product. "Sunshine state living" beats "best-in-class shorts." Earn the editorial right by being specific about FL lifestyle (boat, beach, pool, porch) — not generic about "beach vibes."',
		},

		incentives: {
			freeShippingThresholdMinor: 9900,
			loyalty: {
				programId: 'bealls-bucks',
				programName: 'Bealls Rewards',
				unit: 'Bealls Bucks',
				tiers: [
					{ name: 'Member', unitsRequired: 0 },
					{ name: 'Insider', unitsRequired: 5000 },
					{ name: 'VIP', unitsRequired: 25000 },
				],
			},
		},

		pricingStyle: 'off-price',

	},

	homecentric: {
		id: 'homecentric',
		name: 'Home Centric',
		tagline: 'Inspired Living for Less',
		domain: 'home decor and furnishings (in-store discovery)',
		footerNote: 'Home Centric is a demo brand site powered by Aisles',

		mode: 'content', // content/locator site — no online catalog

		bc: {
			channelId: 0, // unused in content mode
			categoryPrefix: 'HomeCentric',
		},

		// In content mode, "categories" map to brand pillars (in-store sections),
		// not online catalog routes. Each "category" is a content surface, not a PLP.
		categories: {
			'bedroom': { bcName: 'HomeCentric Bedroom', displayName: 'Bedroom' },
			'bath': { bcName: 'HomeCentric Bath', displayName: 'Bath' },
			'rugs': { bcName: 'HomeCentric Rugs', displayName: 'Rugs' },
			'kitchen': { bcName: 'HomeCentric Kitchen', displayName: 'Kitchen & Dining' },
			'lighting': { bcName: 'HomeCentric Lighting', displayName: 'Lighting' },
			'decor': { bcName: 'HomeCentric Decor', displayName: 'Decor' },
			'furniture': { bcName: 'HomeCentric Furniture', displayName: 'Furniture' },
		},

		theme: {
			primary: '#76b82a',         // Home Centric green
			secondary: '#5a8f1e',       // deeper green for hover
			accent: '#d04429',          // red accent (the "centric" wordmark dots)
			surfaceBg: '#ffffff',
			surfaceFg: '#1a1a1a',
			surfaceCard: '#ffffff',
			surfaceCardFg: '#1a1a1a',
			surfaceMuted: '#f7f8f4',
			surfaceMutedFg: '#5a5a5a',
			surfaceBorder: '#e8eae5',
			fontDisplay: "'Lora', Georgia, serif",
			fontBody: "'Source Sans 3', system-ui, sans-serif",
			fontMono: "'JetBrains Mono', Menlo, monospace",
		},

		googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,600&family=Source+Sans+3:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',

		homepage: {
			heroHeadline: 'New Inspiration for Less',
			heroBody: 'The latest trends and unique decor at unbelievable prices — discovered in store, refreshed often.',
			heroImage: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1920&q=80&auto=format&fit=crop',
			editorialHeadline: 'Get Inspired',
			editorialBody: 'Furniture, decor, rugs, lighting, bedroom, and bath. Everything that makes a house feel like home — visit your nearest store to see what arrived this week.',
			valueProps: [
				{ title: 'Find a store near you', body: 'New stores opening across the Southeast. Use our locator to find the nearest Home Centric.' },
				{ title: 'New shipments weekly', body: 'Inventory refreshes constantly — what you see today may be gone tomorrow. That\'s the treasure-hunt promise.' },
				{ title: 'Earn Bealls Bucks', body: 'Same Bealls Rewards program — earn $5 for every $100 spent across the family of brands.' },
			],
		},

		prompt: {
			storeName: 'Home Centric',
			storeDescription: "an off-price home decor and furnishings brand operating as a content/locator site (no online catalog) — every visit drives in-store discovery",
			productDomain: 'home decor inspiration',
			personaDefinitions: {
				gatherer: 'Browsing for room inspiration, decor moodboards, lifestyle imagery. Wants the editorial feel before deciding to visit a store.',
				hunter: 'Specific need — new bath towels, a lamp, a rug. Wants the locator first ("nearest store, hours, fresh shipments") and brand engagement second.',
				researcher: 'Larger purchases (rug, lighting, sofa). Wants depth on materials, sizing, durability, brand story before committing to an in-store visit.',
				gifter: 'Housewarming, registry-adjacent. Looking for "something nice for someone\'s new place" with universal appeal — visits the store to choose in person.',
			},
			voiceGuidance: 'Editorial, calm, value-conscious. "Inspired" not "amazing." "Unique" not "exclusive." This brand operates as a content/locator site — every CTA drives in-store discovery, never imply online ordering. Use language like "Visit your store" or "Browse the collection" rather than "Buy now" or "Order today."',
		},

		// Loyalty is shared across the Bealls family. In content mode, used for
		// brand-awareness callouts only — not transactional flows.
		incentives: {
			loyalty: {
				programId: 'bealls-bucks',
				programName: 'Bealls Rewards',
				unit: 'Bealls Bucks',
				tiers: [
					{ name: 'Member', unitsRequired: 0 },
					{ name: 'Insider', unitsRequired: 5000 },
					{ name: 'VIP', unitsRequired: 25000 },
				],
			},
		},

	},
};

/** Get the active brand config based on BRAND_ID env var */
export function getBrand(): BrandConfig {
	// In SvelteKit, use import.meta.env; in Node scripts, use process.env
	const brandId =
		(typeof import.meta !== 'undefined' && import.meta.env?.VITE_BRAND_ID) ||
		(typeof process !== 'undefined' && process.env?.BRAND_ID) ||
		'bealls';

	return BRANDS[brandId] || BRANDS.bealls;
}

/** Get a brand by explicit ID */
export function getBrandById(id: string): BrandConfig | undefined {
	return BRANDS[id];
}

/** All available brand IDs */
export const BRAND_IDS = Object.keys(BRANDS);

/** Resolved operating mode for a brand — defaults to 'storefront' for backwards compat. */
export function getBrandMode(brand: BrandConfig): 'storefront' | 'content' {
	return brand.mode ?? 'storefront';
}
