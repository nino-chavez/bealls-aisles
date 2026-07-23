/** Product shape used by layout components — transformed from BC data */
export interface Product {
	id: string;
	entityId: number;
	name: string;
	price: number;
	salePrice?: number;
	image: string;
	imageAlt: string;
	description: string;
	specs: Record<string, string>;
	tags: string[];
	category: string;
	/** Optional brand name (shown above product title on Bealls-style cards). */
	brand?: string;
	/** Average review rating, 0–5. Optional; renderer hides if absent. */
	rating?: number;
	/** Review count, used alongside rating. */
	reviewCount?: number;
	/** Per-product badges, e.g. ["New", "Deal"]. Multi-badge stacking supported. */
	badges?: string[];
}

/** Content item shape used by content-mode brands (HomeCentric and similar). */
export interface ContentItem {
	id: string;
	kind: 'category-pillar' | 'lifestyle-scene' | 'store-feature' | 'brand-story';
	title: string;
	subtitle?: string;
	body?: string;
	image: string;
	imageAlt?: string;
	cta: {
		label: string;
		intent: 'locate' | 'subscribe' | 'rsvp' | 'browse';
		href?: string;
	};
	/** Persona-fit, mirrors Product persona-fit shape. Hand-curated for content items. */
	personaFit?: {
		gatherer: number;
		hunter: number;
		researcher: number;
		gifter: number;
	};
}
