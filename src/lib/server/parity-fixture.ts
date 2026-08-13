import { env } from '$env/dynamic/private';
import { getBrand } from '$lib/brand/config';
import type { BCProduct } from './bigcommerce';

export const PARITY_FIXTURE_VERSION = 'bealls-family-catalog-v1';

export function isParityFixtureEnabled(): boolean {
	return env.AISLES_PARITY_FIXTURE === 'v1';
}

export function parityCategories() {
	return Object.entries(getBrand().categories).map(([slug, category], index) => ({
		entityId: 9_000 + index,
		name: category.bcName,
		path: `/${slug}/`,
		children: [],
	}));
}

export function parityBCProducts(): BCProduct[] {
	const brand = getBrand();
	const primaryCategory = Object.entries(brand.categories)[0];
	if (!primaryCategory) return [];
	const [categorySlug, category] = primaryCategory;
	const palette = ['Coastal Blue', 'Sand', 'Coral', 'White', 'Navy', 'Sea Glass'];
	return Array.from({ length: 12 }, (_, index) => {
		const number = index + 1;
		const slug = number === 1 ? 'parity-coastal-shirt' : `parity-product-${number}`;
		return {
			entityId: 8_000 + number,
			name: number === 1 ? 'Parity Coastal Shirt' : `Parity Catalog Product ${number}`,
			sku: `PARITY-${String(number).padStart(3, '0')}`,
			path: `/${slug}/`,
			description: `<p>Deterministic ${brand.name} catalog fixture for local regression evidence.</p>`,
			prices: {
				price: { value: 24 + number * 3, currencyCode: 'USD' },
				salePrice: number % 2 === 0 ? { value: 19 + number * 2, currencyCode: 'USD' } : null,
			},
			defaultImage: { url: `data:image/svg+xml,${encodeURIComponent(parityProductImageSvg(number))}`, altText: `Parity product ${number}` },
			customFields: { edges: [
				{ node: { name: 'Color', value: palette[index % palette.length] } },
				{ node: { name: 'Material', value: number % 2 === 0 ? 'Cotton' : 'Linen Blend' } },
			] },
			categories: { edges: [{ node: { entityId: 9_000, name: category.bcName, path: `/${categorySlug}/` } }] },
		};
	});
}

export function parityProductImageSvg(productNumber: number): string {
	const number = Number.isInteger(productNumber) && productNumber >= 1 && productNumber <= 12 ? productNumber : 1;
	const palettes = [
		['#163f73', '#f2d4ad'], ['#aa182c', '#f8e4d7'], ['#037cc2', '#dff3fb'],
		['#328812', '#edf4df'], ['#7d2540', '#f4dfe7'], ['#cf4a29', '#f8e1d8'],
	];
	const [primary, background] = palettes[(number - 1) % palettes.length];
	return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="${background}"/><circle cx="400" cy="330" r="190" fill="${primary}" opacity=".92"/><path d="M250 570h300l-46-120H296z" fill="${primary}"/><text x="400" y="720" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" fill="#1a1a1a">PARITY PRODUCT ${number}</text></svg>`;
}
