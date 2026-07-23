/**
 * JSON-LD builders for retail surfaces.
 *
 * Per `docs/audits/forge-site-2026-05-01/REPORT.md` §3 + SYSTEM.md §6 — this
 * is the seo-structured-data module for the transactional-retail archetype.
 * Every surface that has a structured-data binding emits Organization +
 * WebSite (root) and the surface-specific schemas (Product, Offer,
 * AggregateRating, BreadcrumbList, LocalBusiness, FAQPage as applicable).
 */

import type { BrandConfig } from '$lib/brand/config';

type JsonLd = Record<string, unknown>;

export function organizationLd(brand: BrandConfig, origin: string): JsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		'@id': `${origin}#organization`,
		name: brand.name,
		url: origin,
		description: brand.tagline,
		logo: `${origin}/favicon.png`,
	};
}

export function websiteLd(brand: BrandConfig, origin: string): JsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		'@id': `${origin}#website`,
		url: origin,
		name: brand.name,
		publisher: { '@id': `${origin}#organization` },
		potentialAction: {
			'@type': 'SearchAction',
			target: { '@type': 'EntryPoint', urlTemplate: `${origin}/search?q={query}` },
			'query-input': 'required name=query',
		},
	};
}

export function breadcrumbLd(items: Array<{ name: string; url: string }>): JsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((it, idx) => ({
			'@type': 'ListItem',
			position: idx + 1,
			name: it.name,
			item: it.url,
		})),
	};
}

export function productLd(opts: {
	id: string;
	name: string;
	description?: string;
	image?: string | string[];
	brand: string;
	sku?: string;
	price: number;
	priceCurrency?: string;
	availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
	url: string;
	rating?: { value: number; count: number } | null;
}): JsonLd {
	const offer: JsonLd = {
		'@type': 'Offer',
		price: opts.price.toFixed(2),
		priceCurrency: opts.priceCurrency ?? 'USD',
		availability: `https://schema.org/${opts.availability ?? 'InStock'}`,
		url: opts.url,
	};
	const ld: JsonLd = {
		'@context': 'https://schema.org',
		'@type': 'Product',
		'@id': `${opts.url}#product`,
		name: opts.name,
		description: opts.description,
		image: opts.image,
		brand: { '@type': 'Brand', name: opts.brand },
		sku: opts.sku ?? opts.id,
		offers: offer,
	};
	if (opts.rating && opts.rating.count > 0) {
		ld.aggregateRating = {
			'@type': 'AggregateRating',
			ratingValue: opts.rating.value.toFixed(1),
			reviewCount: opts.rating.count,
		};
	}
	return ld;
}

export function itemListLd(opts: {
	url: string;
	name: string;
	products: Array<{ id: string; name: string; url: string; image?: string }>;
}): JsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'ItemList',
		'@id': `${opts.url}#itemlist`,
		name: opts.name,
		itemListElement: opts.products.map((p, idx) => ({
			'@type': 'ListItem',
			position: idx + 1,
			url: p.url,
			name: p.name,
			image: p.image,
		})),
	};
}

export function localBusinessLd(opts: {
	id: string;
	name: string;
	url: string;
	address: string;
	geo?: { lat: number; lng: number };
	openingHours?: string[];
}): JsonLd {
	const ld: JsonLd = {
		'@context': 'https://schema.org',
		'@type': 'LocalBusiness',
		'@id': opts.id,
		name: opts.name,
		url: opts.url,
		address: opts.address,
	};
	if (opts.geo) {
		ld.geo = { '@type': 'GeoCoordinates', latitude: opts.geo.lat, longitude: opts.geo.lng };
	}
	if (opts.openingHours) {
		ld.openingHoursSpecification = opts.openingHours;
	}
	return ld;
}
