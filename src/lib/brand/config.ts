/**
 * Brand configuration — the single source of truth for multi-brand support.
 *
 * Selected via BRAND_ID env var (defaults to "haven").
 * Everything brand-specific — name, tagline, colors, fonts, category mapping,
 * prompt context, voice — comes from here.
 */

export interface BrandConfig {
	id: string;
	name: string;
	tagline: string;
	domain: string;
	footerNote: string;

	/** BigCommerce channel config */
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

	/** LLM prompt context — injected into layout/refine/enrichment prompts */
	prompt: {
		storeName: string;
		storeDescription: string;
		productDomain: string;
		personaDefinitions: Record<string, string>;
		voiceGuidance: string;
	};

}

const BRANDS: Record<string, BrandConfig> = {
	haven: {
		id: 'haven',
		name: 'Haven',
		tagline: 'Furniture for how you actually live',
		domain: 'DTC home furniture',
		footerNote: 'Haven is a demo storefront powered by Aisles',

		bc: {
			channelId: 1,
			categoryPrefix: 'Haven',
		},

		categories: {
			'living-room': { bcName: 'Haven Living Room', displayName: 'Living Room' },
			'office': { bcName: 'Haven Office', displayName: 'Office' },
			'bedroom': { bcName: 'Bedroom', displayName: 'Bedroom' },
			'dining': { bcName: 'Dining', displayName: 'Dining' },
			'outdoor': { bcName: 'Outdoor', displayName: 'Outdoor' },
			'kids': { bcName: 'Kids', displayName: 'Kids' },
		},

		theme: {
			primary: '#a3522d',
			secondary: '#8a4425',
			accent: '#2c6e63',
			surfaceBg: '#faf9f7',
			surfaceFg: '#231f1a',
			surfaceCard: '#ffffff',
			surfaceCardFg: '#353129',
			surfaceMuted: '#f5f3f0',
			surfaceMutedFg: '#6b6459',
			surfaceBorder: '#ebe8e3',
			fontDisplay: "'DM Serif Display', Georgia, serif",
			fontBody: "'DM Sans', system-ui, sans-serif",
			fontMono: "'JetBrains Mono', Menlo, monospace",
		},

		googleFontsUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&family=JetBrains+Mono:wght@400;500&display=swap',

		prompt: {
			storeName: 'Haven',
			storeDescription: 'a mid-market DTC furniture store — design-forward, approachable, livable',
			productDomain: 'furniture',
			personaDefinitions: {
				gatherer: 'Exploratory, inspiration-driven. Browsing aesthetics, lifestyle imagery, editorial storytelling. Wants to see full rooms, curated collections. Think: flipping through a shelter magazine.',
				hunter: 'Goal-oriented, efficiency-driven. Knows what they need, compares on price/specs, wants quick navigation and clear pricing. Think: "dorm room desk under $300."',
				researcher: 'Methodical, evidence-driven. Reads every spec, compares materials, checks dimensions. Wants side-by-side comparisons and detailed product info. Think: spending 20 minutes on one desk.',
				gifter: 'Shopping for someone else. Needs gift-appropriate price points, universal appeal, easy returns. Think: housewarming present, graduation gift.',
			},
			voiceGuidance: 'Warm and editorial. Lead with story, not specs. "Solid walnut with a waterfall edge" beats "high-quality wood table." No tech-speak, no fake urgency, no superlatives.',
		},

	},

	volt: {
		id: 'volt',
		name: 'Volt',
		tagline: 'Sound that moves with you',
		domain: 'consumer audio & electronics',
		footerNote: 'Volt is a demo storefront powered by Aisles',

		bc: {
			channelId: 1846321,
			categoryPrefix: 'Volt',
		},

		categories: {
			'headphones': { bcName: 'Volt Headphones', displayName: 'Headphones' },
			'earbuds': { bcName: 'Volt Earbuds', displayName: 'Earbuds' },
			'speakers': { bcName: 'Volt Speakers', displayName: 'Speakers' },
			'gaming': { bcName: 'Volt Gaming', displayName: 'Gaming' },
		},

		theme: {
			primary: '#6d28d9',
			secondary: '#5b21b6',
			accent: '#06b6d4',
			surfaceBg: '#0a0a0a',
			surfaceFg: '#f5f5f5',
			surfaceCard: '#171717',
			surfaceCardFg: '#e5e5e5',
			surfaceMuted: '#1a1a1a',
			surfaceMutedFg: '#a3a3a3',
			surfaceBorder: '#262626',
			fontDisplay: "'Space Grotesk', system-ui, sans-serif",
			fontBody: "'Inter', system-ui, sans-serif",
			fontMono: "'JetBrains Mono', Menlo, monospace",
		},

		googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',

		prompt: {
			storeName: 'Volt',
			storeDescription: 'a DTC audio and electronics brand — bold, technical, performance-driven',
			productDomain: 'audio electronics',
			personaDefinitions: {
				gatherer: 'Exploring options, not sure what they need. Wants to see popular picks, staff favorites, lifestyle imagery with products in use. Think: "I need new headphones but haven\'t decided what kind."',
				hunter: 'Knows exactly what they want. Comparing prices, checking specs, looking for deals. Wants filters, quick-add, and clear pricing. Think: "ANC headphones under $150, best battery life."',
				researcher: 'Deep-diving specs. Comparing driver sizes, frequency response, codec support, battery benchmarks. Wants side-by-side comparisons and technical detail. Think: "LDAC vs aptX Adaptive for my DAC setup."',
				gifter: 'Buying audio gear as a gift. Needs approachable products with universal appeal, good unboxing experience, safe price points. Think: "wireless earbuds for my teenager."',
			},
			voiceGuidance: 'Direct and technical. Lead with specs and performance. "40mm custom drivers, 30-hour battery, LDAC support" beats "amazing sound quality." No fluff, no lifestyle filler. Respect the audiophile.',
		},

	},

	ember: {
		id: 'ember',
		name: 'Ember',
		tagline: 'Gather around something real',
		domain: 'outdoor lifestyle & fire',
		footerNote: 'Ember is a demo storefront powered by Aisles',

		bc: {
			channelId: 1846324,
			categoryPrefix: 'Ember',
		},

		categories: {
			'fire-pits': { bcName: 'Ember Fire Pits', displayName: 'Fire Pits' },
			'camp-stoves': { bcName: 'Ember Camp Stoves', displayName: 'Camp Stoves' },
			'grills': { bcName: 'Ember Grills', displayName: 'Grills' },
			'accessories': { bcName: 'Ember Accessories', displayName: 'Accessories' },
		},

		theme: {
			primary: '#c2410c',
			secondary: '#9a3412',
			accent: '#65a30d',
			surfaceBg: '#faf5f0',
			surfaceFg: '#1c1917',
			surfaceCard: '#ffffff',
			surfaceCardFg: '#292524',
			surfaceMuted: '#f5ebe0',
			surfaceMutedFg: '#78716c',
			surfaceBorder: '#e7e0d8',
			fontDisplay: "'Libre Baskerville', Georgia, serif",
			fontBody: "'Source Sans 3', system-ui, sans-serif",
			fontMono: "'JetBrains Mono', Menlo, monospace",
		},

		googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Source+Sans+3:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',

		prompt: {
			storeName: 'Ember',
			storeDescription: 'an outdoor lifestyle brand centered on fire, gathering, and the backyard experience',
			productDomain: 'outdoor fire and cooking products',
			personaDefinitions: {
				gatherer: 'Dreaming about the backyard they want. Browsing fire pit setups, patio inspiration, seasonal entertaining ideas. Think: scrolling Instagram patio accounts.',
				hunter: 'Buying for a specific occasion — Memorial Day cookout, camping trip, new patio. Compares fuel types, portability, price. Think: "best portable fire pit under $200 for camping."',
				researcher: 'Deep in specs. BTU output, fuel efficiency, burn time, material durability, assembly complexity. Reads every review. Think: "stainless vs corten steel for a permanent fire pit."',
				gifter: 'Fire pit as a housewarming or holiday gift. Needs impressive presentation, reasonable shipping, and broad appeal. Think: "something impressive for my brother\'s new house."',
			},
			voiceGuidance: 'Warm and rugged. Evocative but honest. "Double-wall stainless, smokeless burn, 19-inch diameter — fits six chairs around it" beats "the ultimate outdoor experience." Seasonal urgency is real (spring/summer), not manufactured.',
		},

	},
};

/** Get the active brand config based on BRAND_ID env var */
export function getBrand(): BrandConfig {
	// In SvelteKit, use import.meta.env; in Node scripts, use process.env
	const brandId =
		(typeof import.meta !== 'undefined' && import.meta.env?.VITE_BRAND_ID) ||
		(typeof process !== 'undefined' && process.env?.BRAND_ID) ||
		'haven';

	return BRANDS[brandId] || BRANDS.haven;
}

/** Get a brand by explicit ID */
export function getBrandById(id: string): BrandConfig | undefined {
	return BRANDS[id];
}

/** All available brand IDs */
export const BRAND_IDS = Object.keys(BRANDS);
