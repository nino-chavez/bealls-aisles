import type { Product } from '$lib/types';

type ShopperRouteProductFields = {
	descriptionPlain?: string;
	categoryPath?: string;
};
type ShopperPublicProductKey = keyof Product | keyof ShopperRouteProductFields;

export const SHOPPER_PRODUCT_KEYS = [
	'id',
	'entityId',
	'name',
	'price',
	'salePrice',
	'image',
	'imageAlt',
	'description',
	'specs',
	'tags',
	'category',
	'brand',
	'rating',
	'reviewCount',
	'badges',
	'descriptionPlain',
	'categoryPath',
] as const satisfies readonly ShopperPublicProductKey[];

type ShopperProductKey = Exclude<(typeof SHOPPER_PRODUCT_KEYS)[number], keyof ShopperRouteProductFields>;
export type ShopperProduct = Pick<Product, ShopperProductKey> & ShopperRouteProductFields;
type ShopperProjection<T> = ShopperProduct & Pick<T, Extract<keyof T, keyof ShopperRouteProductFields>>;

/**
 * Project server-ranked products to the complete public Product contract.
 * Inference scores, semantic tags, and neighborhood explainability stay on
 * the server/operator side for every shopper SSR and JSON response.
 */
export function projectShopperProduct<T extends Product & ShopperRouteProductFields>(product: T): ShopperProjection<T> {
	return {
		id: product.id,
		entityId: product.entityId,
		name: product.name,
		price: product.price,
		salePrice: product.salePrice,
		image: product.image,
		imageAlt: product.imageAlt,
		description: product.description,
		specs: product.specs,
		tags: product.tags,
		category: product.category,
		brand: product.brand,
		rating: product.rating,
		reviewCount: product.reviewCount,
		badges: product.badges,
		descriptionPlain: product.descriptionPlain,
		categoryPath: product.categoryPath,
	} as ShopperProjection<T>;
}

export function projectShopperProducts<T extends Product & ShopperRouteProductFields>(products: readonly T[]): Array<ShopperProjection<T>> {
	return products.map(projectShopperProduct);
}
