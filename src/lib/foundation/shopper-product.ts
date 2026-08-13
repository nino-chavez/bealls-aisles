import type { Product } from '$lib/types';

export const SHOPPER_PRODUCT_KEYS = [
	'id',
	'entityId',
	'name',
	'price',
	'salePrice',
	'image',
	'imageAlt',
	'category',
] as const satisfies readonly (keyof Product)[];

export type ShopperProduct = Pick<Product, (typeof SHOPPER_PRODUCT_KEYS)[number]>;

/**
 * Project server-ranked products to the exact catalog fields needed by the
 * cart and checkout shopper renderers. Inference scores, semantic tags, and
 * neighborhood explainability stay on the server/operator side.
 */
export function projectShopperProduct<T extends Product>(product: T): ShopperProduct {
	return {
		id: product.id,
		entityId: product.entityId,
		name: product.name,
		price: product.price,
		salePrice: product.salePrice,
		image: product.image,
		imageAlt: product.imageAlt,
		category: product.category,
	};
}

export function projectShopperProducts<T extends Product>(products: readonly T[]): ShopperProduct[] {
	return products.map(projectShopperProduct);
}
