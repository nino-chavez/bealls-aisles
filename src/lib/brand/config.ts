/**
 * Brand configuration — the single source of truth for multi-brand support.
 *
 * Selected via BRAND_ID env var (defaults to "bealls").
 * For the current Bealls-family implementation, brand-specific name, tagline,
 * colors, fonts, category mapping, prompt context, and voice come from here.
 * This configuration is not an external-merchant onboarding or preservation contract.
 */

export interface BrandConfig {
	/** Stable owner for this brand configuration. Metadata only in this implementation. */
	organizationId: string;
	id: string;
	name: string;
	tagline: string;
	domain: string;
	footerNote: string;

	/**
	 * Operating mode — selects between transactional storefront and content-only
	 * brand/locator site. Drives schema vocabulary, prompt vocabulary, and CTA
	 * routing. See docs/architecture/multi-brand.md.
	 *
	 * Defaults to 'storefront' if omitted (backwards compatible with existing brands).
	 */
	mode?: 'storefront' | 'content';

	/** BigCommerce channel config. Only required for storefront-mode brands. */
	bc: {
		channelId: number;
		categoryPrefix: string;
	};

	/** Category slug → BC category name + display name + optional tile image */
	categories: Record<string, { bcName: string; displayName: string; tileImage?: string }>;

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
		organizationId: 'example-merchant',
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
			'women': { bcName: 'Bealls Women', displayName: 'Women', tileImage: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80&auto=format&fit=crop' },
			'men': { bcName: 'Bealls Men', displayName: 'Men', tileImage: 'https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?w=800&q=80&auto=format&fit=crop' },
			'kids': { bcName: 'Bealls Kids', displayName: 'Kids', tileImage: 'https://images.unsplash.com/photo-1519278409-1f56fdda7fe5?w=800&q=80&auto=format&fit=crop' },
			'shoes': { bcName: 'Bealls Shoes', displayName: 'Shoes', tileImage: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80&auto=format&fit=crop' },
			'home': { bcName: 'Bealls Home', displayName: 'Home', tileImage: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80&auto=format&fit=crop' },
			'beauty': { bcName: 'Bealls Beauty', displayName: 'Beauty', tileImage: 'https://images.unsplash.com/photo-1522335789203-aaa83fbb1bff?w=800&q=80&auto=format&fit=crop' },
			'handbags': { bcName: 'Bealls Handbags', displayName: 'Handbags', tileImage: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=80&auto=format&fit=crop' },
			'accessories': { bcName: 'Bealls Accessories', displayName: 'Accessories', tileImage: 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=800&q=80&auto=format&fit=crop' },
		},

		// Path B (2026-05-02 reconciliation against real bealls.com):
		// - primary `#aa182c` (real Bealls cherry red, not the brighter `#c8102e`)
		// - secondary `#7d2540` (real promo-bar cranberry)
		// - accent `#330A3D` (real top-strip + footer wine, not flat black)
		// - fontBody Public Sans (open-license analogue to real Bealls' mr-eaves-xl-modern Adobe Typekit face)
		// - fontDisplay Oswald (open-license analogue to the condensed display face on the TRENDING/FOR YOU hero)
		theme: {
			primary: '#aa182c',         // real Bealls red (cherry, not bright)
			secondary: '#7d2540',       // real Bealls cranberry — promo-bar bg
			accent: '#330A3D',          // real Bealls wine — top brand-strip + footer
			surfaceBg: '#ffffff',
			surfaceFg: '#1a1a1a',
			surfaceCard: '#ffffff',
			surfaceCardFg: '#1a1a1a',
			surfaceMuted: '#f6f6f6',
			surfaceMutedFg: '#5a5a5a',
			surfaceBorder: '#e5e5e5',
			fontDisplay: "'Oswald', 'Bebas Neue', system-ui, sans-serif",
			fontBody: "'Public Sans', system-ui, sans-serif",
			fontMono: "ui-monospace, Menlo, monospace",
		},

		googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Public+Sans:wght@400;500;600;700&display=swap',

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
			voiceGuidance: 'Friendly, value-driven, broadly inclusive. Use comparable-value language ("Comparable value $20 — You save 50%") rather than "regular price." No fake urgency, no fashion pretension. Family-oriented copy. Inclusive across ages, sizes, and budgets.\n\nCASING RULES (real Bealls signature, load-bearing brand voice):\n- Editorial eyebrow + sub-headlines: lowercase ("celebrate mom", "shop women", "gifts under")\n- Hero headline (condensed display): UPPERCASE ("TRENDING FOR YOU", "MOTHER\'S DAY GIFTS")\n- Cluster / theme labels: TRACKING-WIDE UPPERCASE ("BOHEMIAN ROMANCE", "VACATION OUTFITS")\n- Product names + service rails: Title Case ("Bealls Bucks", "Find a Store", "Free Shipping")\n- Button labels: lowercase if editorial-tone CTA ("shop women"), Title Case if functional ("Add to Cart", "Continue Shopping")',
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
		organizationId: 'example-merchant',
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
			'women': { bcName: 'BeallsFlorida Women', displayName: 'Women', tileImage: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&q=80&auto=format&fit=crop' },
			'men': { bcName: 'BeallsFlorida Men', displayName: 'Men', tileImage: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&q=80&auto=format&fit=crop' },
			'kids': { bcName: 'BeallsFlorida Kids', displayName: 'Kids', tileImage: 'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=800&q=80&auto=format&fit=crop' },
			'shoes': { bcName: 'BeallsFlorida Shoes', displayName: 'Shoes', tileImage: 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=800&q=80&auto=format&fit=crop' },
			'home': { bcName: 'BeallsFlorida Home', displayName: 'Home', tileImage: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&q=80&auto=format&fit=crop' },
			'vacation': { bcName: 'BeallsFlorida Vacation', displayName: 'Vacation', tileImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80&auto=format&fit=crop' },
			'swim': { bcName: 'BeallsFlorida Swim & Beach', displayName: 'Swim & Beach', tileImage: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800&q=80&auto=format&fit=crop' },
			'accessories': { bcName: 'BeallsFlorida Accessories', displayName: 'Accessories', tileImage: 'https://images.unsplash.com/photo-1591348278863-a8fb3887e2aa?w=800&q=80&auto=format&fit=crop' },
		},

		// Path B reconciliation: real beallsflorida.com exposes brand values
		// via CSS custom props. `--brand-bealls-florida-primary: #037cc2`,
		// `--brand-bealls-florida-secondary: #02639c`, `--brand-bealls-orange: #cf4a29`
		// (the warm coral the brand uses as a Florida-vacation accent).
		// Promo bar is yellow `#fde047`-ish (coastal sunshine), not the cranberry
		// of the bealls red brand. Hero uses condensed serif `FLORIDA IS A` +
		// script italic `feeling` — open-license analogue: Playfair Display
		// (Italic) for the script feel + the condensed serif slot.
		theme: {
			primary: '#037cc2',         // real Bealls Florida coastal blue (deeper than our 0066b3)
			secondary: '#02639c',       // real BF deeper-blue secondary
			accent: '#cf4a29',          // real BF coral/orange (`--brand-bealls-orange`)
			surfaceBg: '#ffffff',
			surfaceFg: '#1a2842',
			surfaceCard: '#ffffff',
			surfaceCardFg: '#1a2842',
			surfaceMuted: '#f0f5fa',
			surfaceMutedFg: '#5a6c83',
			surfaceBorder: '#dde6f0',
			fontDisplay: "'Playfair Display', Georgia, serif",
			fontBody: "'Public Sans', system-ui, sans-serif",
			fontMono: "ui-monospace, Menlo, monospace",
		},

		googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Public+Sans:wght@400;500;600;700&display=swap',

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
			voiceGuidance: 'Coastal, lifestyle, casual confidence. Lead with the feeling, then the product. "Sunshine state living" beats "best-in-class shorts." Earn the editorial right by being specific about FL lifestyle (boat, beach, pool, porch) — not generic about "beach vibes."\n\nCASING RULES (real Bealls Florida brand voice):\n- Editorial body + sub-headlines: sentence case ("Sunshine state living never looked so good")\n- Hero headline (display): mixed-case editorial ("Florida is a feeling") OR short condensed-serif UPPERCASE ("FLORIDA IS A") with script italic emphasis word ("feeling")\n- Cluster / theme labels: TRACKING-WIDE UPPERCASE ("RESORT WEAR", "POOL DAYS", "BOAT NIGHTS")\n- Product names + service rails: Title Case\n- CTAs: SHOP WOMEN-style ALL-CAPS for editorial CTAs; Title Case for functional buttons',
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
		organizationId: 'example-merchant',
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
			'bedroom': { bcName: 'HomeCentric Bedroom', displayName: 'Bedroom', tileImage: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80&auto=format&fit=crop' },
			'bath': { bcName: 'HomeCentric Bath', displayName: 'Bath', tileImage: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=80&auto=format&fit=crop' },
			'rugs': { bcName: 'HomeCentric Rugs', displayName: 'Rugs', tileImage: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&q=80&auto=format&fit=crop' },
			'kitchen': { bcName: 'HomeCentric Kitchen', displayName: 'Kitchen & Dining', tileImage: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80&auto=format&fit=crop' },
			'lighting': { bcName: 'HomeCentric Lighting', displayName: 'Lighting', tileImage: 'https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=800&q=80&auto=format&fit=crop' },
			'decor': { bcName: 'HomeCentric Decor', displayName: 'Decor', tileImage: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&q=80&auto=format&fit=crop' },
			'furniture': { bcName: 'HomeCentric Furniture', displayName: 'Furniture', tileImage: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80&auto=format&fit=crop' },
		},

		// Path B reconciliation: real bealls.com exposes Home Centric brand
		// values in CSS custom properties (`--brand-home-centric-primary: #328812`,
		// `--brand-home-centric-secondary: #3a9f15`). Both are deeper / more
		// forest-green than our previous brighter values.
		theme: {
			primary: '#328812',         // real Home Centric forest green
			secondary: '#3a9f15',       // real lighter green (per real-Bealls CSS custom props)
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
