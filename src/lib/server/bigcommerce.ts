/**
 * BigCommerce Storefront GraphQL Client
 *
 * Follows the Catalyst pattern: plain fetch, typed queries, Bearer token auth.
 * Server-side only — never import this from client components.
 */

import { getBrand } from '$lib/brand/config';
import { isParityFixtureEnabled, parityBCProducts, parityCategories } from './parity-fixture';

let queryAccessObserverForTest: (() => void) | null = null;

/** Test-only observer for proving fixture paths return before BigCommerce access. */
export function _setBigCommerceQueryAccessObserverForTest(observer: (() => void) | null): void {
	queryAccessObserverForTest = observer;
}

function getGraphQLConfig() {
	const brand = getBrand();
	const privateTokenKey = `${brand.id.toUpperCase()}_STOREFRONT_PRIVATE_TOKEN`;
	const legacyTokenKey = `${brand.id.toUpperCase()}_STOREFRONT_TOKEN`;
	const storeHash = process.env.BIGCOMMERCE_STORE_HASH;
	const storefrontToken =
		process.env[privateTokenKey] ||
		process.env.BIGCOMMERCE_STOREFRONT_PRIVATE_TOKEN ||
		process.env[legacyTokenKey] ||
		process.env.BIGCOMMERCE_STOREFRONT_TOKEN;

	if (!storeHash) throw new Error('BIGCOMMERCE_STORE_HASH not configured');
	if (!storefrontToken) throw new Error(`Storefront token not configured for ${brand.id}`);

	// Non-default channels need channel ID in the URL hostname
	const channelId = brand.bc.channelId;
	const host = channelId === 1
		? `store-${storeHash}.mybigcommerce.com`
		: `store-${storeHash}-${channelId}.mybigcommerce.com`;

	return {
		url: `https://${host}/graphql`,
		token: storefrontToken,
	};
}

interface GraphQLResponse<T> {
	data?: T;
	errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

async function query<T>(gql: string, variables?: Record<string, unknown>): Promise<T> {
	if (isParityFixtureEnabled()) {
		throw new Error('BigCommerce access is disabled by the parity fixture');
	}
	queryAccessObserverForTest?.();
	const { url, token } = getGraphQLConfig();
	const isMutation = /\bmutation\b/.test(gql);
	// Stateless server-to-server requests use a private Storefront token and
	// the opaque cart entity ID. They deliberately send no Origin or shopper
	// session cookie. See BigCommerce's current token guidance:
	// https://docs.bigcommerce.com/developer/api-reference/rest/admin/authentication-apis/storefront-api-tokens/overview
	let res: Response;
	try {
		res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ query: gql, variables }),
			signal: AbortSignal.timeout(20_000),
		});
	} catch {
		throw new BigCommerceGraphQLError('BigCommerce could not be reached.', {
			outcomeUnknown: isMutation,
		});
	}

	if (!res.ok) {
		throw new BigCommerceGraphQLError('BigCommerce rejected the request.', {
			status: res.status,
			outcomeUnknown: isMutation && res.status >= 500,
		});
	}

	let json: GraphQLResponse<T>;
	try {
		json = (await res.json()) as GraphQLResponse<T>;
	} catch {
		throw new BigCommerceGraphQLError('BigCommerce returned an unreadable response.', {
			outcomeUnknown: isMutation,
		});
	}

	if (json.errors?.length) {
		const providerCode = json.errors[0].extensions?.code;
		const hint = `${providerCode ?? ''} ${json.errors[0].message}`.toLowerCase();
		const conflict = hint.includes('conflict') || hint.includes('version');
		console.error('BigCommerce GraphQL request returned an application error.', {
			count: json.errors.length,
			code: providerCode ?? 'unspecified',
		});
		throw new BigCommerceGraphQLError(json.errors[0].message, {
			providerCode,
			outcomeUnknown: isMutation && !conflict,
		});
	}

	if (!json.data) {
		throw new BigCommerceGraphQLError('BigCommerce returned no data.', {
			outcomeUnknown: isMutation,
		});
	}
	return json.data;
}

export class BigCommerceGraphQLError extends Error {
	readonly status: number | null;
	readonly providerCode: string | null;
	readonly outcomeUnknown: boolean;

	constructor(
		message: string,
		options: { status?: number; providerCode?: string; outcomeUnknown?: boolean } = {},
	) {
		super(message);
		this.name = 'BigCommerceGraphQLError';
		this.status = options.status ?? null;
		this.providerCode = options.providerCode ?? null;
		this.outcomeUnknown = options.outcomeUnknown ?? false;
	}
}

// ─── Queries ────────────────────────────────────────────────────────

export interface BCProduct {
	entityId: number;
	name: string;
	sku: string;
	path: string;
	description: string;
	prices: {
		price: { value: number; currencyCode: string };
		salePrice: { value: number; currencyCode: string } | null;
	};
	defaultImage: {
		url: string;
		altText: string;
	} | null;
	customFields: {
		edges: Array<{
			node: { name: string; value: string };
		}>;
	};
	categories: {
		edges: Array<{
			node: { entityId: number; name: string; path: string };
		}>;
	};
}

interface ProductsResponse {
	site: {
		products: {
			edges: Array<{ node: BCProduct }>;
			pageInfo: { hasNextPage: boolean; endCursor: string };
		};
	};
}

interface CategoryProductsResponse {
	site: {
		category: {
			entityId: number;
			name: string;
			description: string;
			products: {
				edges: Array<{ node: BCProduct }>;
			};
		} | null;
	};
}

interface CategoriesResponse {
	site: {
		categoryTree: Array<{
			entityId: number;
			name: string;
			path: string;
			children: Array<{
				entityId: number;
				name: string;
				path: string;
			}>;
		}>;
	};
}

const PRODUCT_FRAGMENT = `
	entityId
	name
	sku
	path
	description
	prices {
		price { value currencyCode }
		salePrice { value currencyCode }
	}
	defaultImage {
		url(width: 800, height: 800)
		altText
	}
	customFields(first: 10) {
		edges {
			node { name value }
		}
	}
	categories(first: 5) {
		edges {
			node { entityId name path }
		}
	}
`;

export async function getProducts(limit = 30): Promise<BCProduct[]> {
	if (isParityFixtureEnabled()) return parityBCProducts().slice(0, limit);
	const data = await query<ProductsResponse>(`
		query GetProducts($first: Int!) {
			site {
				products(first: $first) {
					edges {
						node {
							${PRODUCT_FRAGMENT}
						}
					}
				}
			}
		}
	`, { first: limit });

	return data.site.products.edges.map((e) => e.node);
}

export async function getProductsByCategory(categoryEntityId: number): Promise<{ category: { name: string; description: string }; products: BCProduct[] }> {
	if (isParityFixtureEnabled()) {
		const category = parityCategories().find((candidate) => candidate.entityId === categoryEntityId);
		if (!category) throw new Error(`Category ${categoryEntityId} not found`);
		return { category: { name: category.name, description: '' }, products: parityBCProducts() };
	}
	const data = await query<CategoryProductsResponse>(`
		query GetCategoryProducts($categoryId: Int!) {
			site {
				category(entityId: $categoryId) {
					entityId
					name
					description
					products(first: 50) {
						edges {
							node {
								${PRODUCT_FRAGMENT}
							}
						}
					}
				}
			}
		}
	`, { categoryId: categoryEntityId });

	if (!data.site.category) {
		throw new Error(`Category ${categoryEntityId} not found`);
	}

	return {
		category: {
			name: data.site.category.name,
			description: data.site.category.description,
		},
		products: data.site.category.products.edges.map((e) => e.node),
	};
}

interface ProductByPathResponse {
	site: {
		route: {
			node: BCProduct | null;
		};
	};
}

export async function getProductByPath(path: string): Promise<BCProduct | null> {
	const fullPath = path.startsWith('/') ? path : `/${path}/`;
	if (isParityFixtureEnabled()) {
		const normalized = `/${fullPath.replace(/^\/+|\/+$/g, '')}/`;
		return parityBCProducts().find((product) => product.path === normalized) ?? null;
	}
	const data = await query<ProductByPathResponse>(`
		query GetProductByPath($path: String!) {
			site {
				route(path: $path) {
					node {
						... on Product {
							${PRODUCT_FRAGMENT}
						}
					}
				}
			}
		}
	`, { path: fullPath });

	return data.site.route.node;
}

/**
 * Bulk-fetch products by BC entityId. Used by tag-overlap retrieval
 * (PRD-ENG-019) to resolve neighborhood entityIds to full product data
 * in one round-trip rather than N parallel `getProductByEntityId` calls.
 *
 * BC's storefront `site.products` field accepts an `entityIds: [Int!]`
 * filter. Empty input returns []; missing entityIds are silently
 * dropped by BC (no error).
 */
export async function getProductsByEntityIds(entityIds: number[]): Promise<BCProduct[]> {
	if (entityIds.length === 0) return [];
	if (isParityFixtureEnabled()) {
		const ids = new Set(entityIds);
		return parityBCProducts().filter((product) => ids.has(product.entityId));
	}
	interface ProductsByIdsResponse {
		site: { products: { edges: Array<{ node: BCProduct }> } };
	}
	const data = await query<ProductsByIdsResponse>(`
		query GetProductsByEntityIds($ids: [Int!]!) {
			site {
				products(entityIds: $ids, first: 50) {
					edges {
						node {
							${PRODUCT_FRAGMENT}
						}
					}
				}
			}
		}
	`, { ids: entityIds });
	return data.site.products.edges.map((e) => e.node);
}

export async function getProductByEntityId(entityId: number): Promise<BCProduct | null> {
	if (isParityFixtureEnabled()) return parityBCProducts().find((product) => product.entityId === entityId) ?? null;
	interface SingleProductResponse {
		site: { product: BCProduct | null };
	}

	const data = await query<SingleProductResponse>(`
		query GetProduct($entityId: Int!) {
			site {
				product(entityId: $entityId) {
					${PRODUCT_FRAGMENT}
				}
			}
		}
	`, { entityId });

	return data.site.product;
}

export interface CartProductEligibility {
	entityId: number;
	isInStock: boolean;
	hasOptions: boolean;
}

/** Revalidate the minimum optionless, one-time cart boundary from provider-owned catalog data. */
export async function getCartProductEligibility(entityId: number): Promise<CartProductEligibility | null> {
	if (isParityFixtureEnabled()) {
		const product = parityBCProducts().find((candidate) => candidate.entityId === entityId);
		return product ? { entityId, isInStock: true, hasOptions: false } : null;
	}
	const data = await query<{
		site: {
			product: {
				entityId: number;
				inventory: { isInStock: boolean } | null;
				productOptions: { edges: Array<{ node: { entityId: number } }> };
			} | null;
		};
	}>(
		`
		query GetCartProductEligibility($entityId: Int!) {
			site {
				product(entityId: $entityId) {
					entityId
					inventory { isInStock }
					productOptions(first: 1) { edges { node { entityId } } }
				}
			}
		}
	`,
		{ entityId },
	);
	const product = data.site.product;
	if (!product) return null;
	return {
		entityId: product.entityId,
		isInStock: product.inventory?.isInStock === true,
		hasOptions: product.productOptions.edges.length > 0,
	};
}

/**
 * Per-process category tree cache. The brand's category tree is fetched by
 * every page that resolves a category slug or builds nav, plus inside
 * `/api/refine` and `/api/suggest`. BC has its own CDN caching but the
 * round-trip still adds ~50–100ms; a process-local cache (Vercel Fluid
 * Compute reuses lambdas) eliminates that for warm requests.
 *
 * 30 min TTL — categories change rarely (admin re-orgs).
 */
const CATEGORIES_TTL_MS = 1000 * 60 * 30;
let categoriesCache: { value: Awaited<ReturnType<typeof fetchCategoriesUncached>>; cachedAt: number } | null = null;

async function fetchCategoriesUncached() {
	const data = await query<CategoriesResponse>(`
		query GetCategories {
			site {
				categoryTree {
					entityId
					name
					path
					children {
						entityId
						name
						path
					}
				}
			}
		}
	`);
	return data.site.categoryTree;
}

export async function getCategories() {
	if (isParityFixtureEnabled()) return parityCategories();
	const { isCachingDisabledGlobally } = await import('./cache-flags');
	const now = Date.now();
	if (!isCachingDisabledGlobally() && categoriesCache && now - categoriesCache.cachedAt < CATEGORIES_TTL_MS) {
		return categoriesCache.value;
	}
	const value = await fetchCategoriesUncached();
	categoriesCache = { value, cachedAt: now };
	return value;
}

// ─── Cart Operations ────────────────────────────────────────────────

export interface CartResponse {
	entityId: string;
	version: number;
	currencyCode: string;
	amount: { value: number; currencyCode: string };
	baseAmount: { value: number; currencyCode: string };
	lineItems: {
		physicalItems: Array<{
			entityId: string;
			productEntityId: number;
			variantEntityId: number | null;
			name: string;
			quantity: number;
			salePrice: { value: number; currencyCode: string } | null;
			listPrice: { value: number; currencyCode: string };
			extendedSalePrice: { value: number; currencyCode: string } | null;
			extendedListPrice: { value: number; currencyCode: string };
			imageUrl: string | null;
			path: string;
			isMutable: boolean;
		}>;
	};
}

const CART_FRAGMENT = /* GraphQL */ `
	entityId
	version
	currencyCode
	amount { value currencyCode }
	baseAmount { value currencyCode }
	lineItems {
		physicalItems {
			entityId
			productEntityId
			variantEntityId
			name
			quantity
			salePrice { value currencyCode }
			listPrice { value currencyCode }
			extendedSalePrice { value currencyCode }
			extendedListPrice { value currencyCode }
			imageUrl
			path
			isMutable
		}
	}
`;


const parityCarts = new Map<string, CartResponse>();

function parityProductOrThrow(productEntityId: number): BCProduct {
	const product = parityBCProducts().find((candidate) => candidate.entityId === productEntityId);
	if (!product) throw new Error(`Parity product ${productEntityId} is outside the fixed catalog`);
	return product;
}

function parityLineItem(productEntityId: number, quantity: number): CartResponse['lineItems']['physicalItems'][number] {
	const product = parityProductOrThrow(productEntityId);
	const salePrice = product.prices.salePrice ?? product.prices.price;
	return {
		entityId: `parity-line-${productEntityId}`,
		productEntityId,
		variantEntityId: null,
		name: product.name,
		quantity,
		salePrice,
		listPrice: product.prices.price,
		extendedSalePrice: { ...salePrice, value: salePrice.value * quantity },
		extendedListPrice: { ...product.prices.price, value: product.prices.price.value * quantity },
		imageUrl: product.defaultImage?.url ?? null,
		path: product.path,
		isMutable: true,
	};
}

function recalculateParityCart(cart: CartResponse): void {
	for (const line of cart.lineItems.physicalItems) {
		const salePrice = line.salePrice ?? line.listPrice;
		line.extendedSalePrice = { ...salePrice, value: salePrice.value * line.quantity };
		line.extendedListPrice = { ...line.listPrice, value: line.listPrice.value * line.quantity };
	}
	const value = cart.lineItems.physicalItems.reduce(
		(sum, line) => sum + (line.salePrice ?? line.listPrice).value * line.quantity,
		0,
	);
	cart.amount = { value, currencyCode: cart.currencyCode };
	cart.baseAmount = { value, currencyCode: cart.currencyCode };
}

function parityCartSnapshot(cart: CartResponse): CartResponse {
	return structuredClone(cart);
}

function requireParityCart(cartEntityId: string, version?: number): CartResponse {
	const cart = parityCarts.get(cartEntityId);
	if (!cart) throw new Error(`Parity cart ${cartEntityId} does not exist`);
	if (version !== undefined && cart.version !== version) {
		throw new BigCommerceGraphQLError('Parity cart version conflict.', { status: 409 });
	}
	return cart;
}

/**
 * Headless cart operations use the current Storefront GraphQL cart API.
 * BigCommerce owns the cart, prices, and version used for optimistic concurrency.
 * Verified 2026-08-14 against:
 * https://docs.bigcommerce.com/developer/docs/admin/checkout-and-cart/custom-checkouts/graphql-storefront
 * and the current official Catalyst-generated GraphQL schema for Cart.version.
 */

export async function createCart(productEntityId: number, quantity = 1): Promise<CartResponse> {
	if (isParityFixtureEnabled()) {
		const cart: CartResponse = {
			entityId: `parity-cart-${getBrand().id}`,
			version: 1,
			currencyCode: 'USD',
			amount: { value: 0, currencyCode: 'USD' },
			baseAmount: { value: 0, currencyCode: 'USD' },
			lineItems: { physicalItems: [parityLineItem(productEntityId, quantity)] },
		};
		recalculateParityCart(cart);
		parityCarts.set(cart.entityId, cart);
		return parityCartSnapshot(cart);
	}

	interface CreateCartResponse {
		cart?: { createCart?: { cart?: CartResponse | null } | null } | null;
	}

	const data = await query<CreateCartResponse>(
		`
		mutation CreateCart($productId: Int!, $quantity: Int!) {
			cart {
				createCart(input: {
					lineItems: [{ productEntityId: $productId, quantity: $quantity }]
				}) {
					cart {
						${CART_FRAGMENT}
					}
				}
			}
		}
	`,
		{ productId: productEntityId, quantity },
	);

	return requireMutationCart(data.cart?.createCart?.cart, 'BigCommerce did not confirm cart creation.');
}

export async function addToCart(cartEntityId: string, productEntityId: number, quantity = 1, version?: number): Promise<CartResponse> {
	if (isParityFixtureEnabled()) {
		const cart = requireParityCart(cartEntityId, version);
		const line = cart.lineItems.physicalItems.find((candidate) => candidate.productEntityId === productEntityId);
		if (line) line.quantity += quantity;
		else cart.lineItems.physicalItems.push(parityLineItem(productEntityId, quantity));
		cart.version += 1;
		recalculateParityCart(cart);
		return parityCartSnapshot(cart);
	}

	interface AddToCartResponse {
		cart?: { addCartLineItems?: { cart?: CartResponse | null } | null } | null;
	}

	const data = await query<AddToCartResponse>(
		`
		mutation AddToCart($cartId: String!, $productId: Int!, $quantity: Int!, $version: Int) {
			cart {
				addCartLineItems(input: {
					cartEntityId: $cartId,
					version: $version,
					data: { lineItems: [{ productEntityId: $productId, quantity: $quantity }] }
				}) {
					cart {
						${CART_FRAGMENT}
					}
				}
			}
		}
	`,
		{ cartId: cartEntityId, productId: productEntityId, quantity, version },
	);

	return requireMutationCart(data.cart?.addCartLineItems?.cart, 'BigCommerce did not confirm the added item.');
}

export async function getCart(cartEntityId: string): Promise<CartResponse | null> {
	if (isParityFixtureEnabled()) {
		const cart = parityCarts.get(cartEntityId);
		return cart ? parityCartSnapshot(cart) : null;
	}

	interface GetCartResponse {
		site: { cart: CartResponse | null };
	}

	const data = await query<GetCartResponse>(
		`
		query GetCart($cartId: String!) {
			site {
				cart(entityId: $cartId) {
					${CART_FRAGMENT}
				}
			}
		}
	`,
		{ cartId: cartEntityId },
	);

	return data.site.cart;
}

export async function updateCartLineItem(cartEntityId: string, lineItemEntityId: string, productEntityId: number, quantity: number, version: number): Promise<CartResponse> {
	if (isParityFixtureEnabled()) {
		parityProductOrThrow(productEntityId);
		const cart = requireParityCart(cartEntityId, version);
		const line = cart.lineItems.physicalItems.find((candidate) => candidate.entityId === lineItemEntityId);
		if (!line) throw new Error(`Parity line item ${lineItemEntityId} does not exist`);
		line.quantity = quantity;
		cart.version += 1;
		recalculateParityCart(cart);
		return parityCartSnapshot(cart);
	}

	const data = await query<{
		cart?: { updateCartLineItem?: { cart?: CartResponse | null } | null } | null;
	}>(
		`
		mutation UpdateCartLineItem($cartId: String!, $lineId: String!, $productId: Int!, $quantity: Int!, $version: Int!) {
			cart {
				updateCartLineItem(input: {
					cartEntityId: $cartId,
					lineItemEntityId: $lineId,
					version: $version,
					data: { lineItem: { productEntityId: $productId, quantity: $quantity } }
				}) {
					cart { ${CART_FRAGMENT} }
				}
			}
		}
	`,
		{
			cartId: cartEntityId,
			lineId: lineItemEntityId,
			productId: productEntityId,
			quantity,
			version,
		},
	);
	return requireMutationCart(data.cart?.updateCartLineItem?.cart, 'BigCommerce did not confirm the quantity update.');
}

export async function deleteCartLineItem(cartEntityId: string, lineItemEntityId: string, version: number): Promise<CartResponse | null> {
	if (isParityFixtureEnabled()) {
		const cart = requireParityCart(cartEntityId, version);
		const index = cart.lineItems.physicalItems.findIndex((candidate) => candidate.entityId === lineItemEntityId);
		if (index < 0) throw new Error(`Parity line item ${lineItemEntityId} does not exist`);
		cart.lineItems.physicalItems.splice(index, 1);
		if (cart.lineItems.physicalItems.length === 0) {
			parityCarts.delete(cartEntityId);
			return null;
		}
		cart.version += 1;
		recalculateParityCart(cart);
		return parityCartSnapshot(cart);
	}

	const data = await query<{
		cart?: {
			deleteCartLineItem?: {
				cart?: CartResponse | null;
				deletedCartEntityId?: string | null;
			} | null;
		} | null;
	}>(
		`
		mutation DeleteCartLineItem($cartId: String!, $lineId: String!, $version: Int!) {
			cart {
				deleteCartLineItem(input: {
					cartEntityId: $cartId,
					lineItemEntityId: $lineId,
					version: $version
				}) {
					deletedCartEntityId
					cart { ${CART_FRAGMENT} }
				}
			}
		}
	`,
		{ cartId: cartEntityId, lineId: lineItemEntityId, version },
	);
	const result = data.cart?.deleteCartLineItem;
	if (result?.cart) return result.cart;
	if (result?.deletedCartEntityId === cartEntityId) return null;
	throw new BigCommerceGraphQLError('BigCommerce did not confirm line removal.', { outcomeUnknown: true });
}

export async function deleteCart(cartEntityId: string): Promise<void> {
	if (isParityFixtureEnabled()) {
		if (!parityCarts.delete(cartEntityId)) throw new Error(`Parity cart ${cartEntityId} does not exist`);
		return;
	}

	const data = await query<{
		cart: { deleteCart: { deletedCartEntityId: string | null } | null };
	}>(
		`
		mutation DeleteCart($cartId: String!) {
			cart {
				deleteCart(input: { cartEntityId: $cartId }) { deletedCartEntityId }
			}
		}
	`,
		{ cartId: cartEntityId },
	);
	if (data.cart.deleteCart?.deletedCartEntityId !== cartEntityId) {
		throw new BigCommerceGraphQLError('BigCommerce did not confirm the empty-cart operation.', { outcomeUnknown: true });
	}
}

/**
 * Mint a one-use hosted checkout URL only when the shopper asks to continue.
 * This does not create an order or collect payment in Aisles.
 * Verified 2026-08-14 against:
 * https://docs.bigcommerce.com/developer/learn/courses/composable-core/checkout/redirected-checkout
 */
export async function createCartRedirectUrl(cartEntityId: string): Promise<string> {
	if (isParityFixtureEnabled()) {
		requireParityCart(cartEntityId);
		return 'https://checkout.example.invalid/parity';
	}

	const data = await query<{
		cart?: {
			createCartRedirectUrls?: {
				redirectUrls: { redirectedCheckoutUrl: string | null } | null;
			} | null;
		} | null;
	}>(
		`
		mutation CreateCartRedirectUrl($cartId: String!) {
			cart {
				createCartRedirectUrls(input: { cartEntityId: $cartId }) {
					redirectUrls { redirectedCheckoutUrl }
				}
			}
		}
	`,
		{ cartId: cartEntityId },
	);
	const value = data.cart?.createCartRedirectUrls?.redirectUrls?.redirectedCheckoutUrl;
	if (!value) throw new BigCommerceGraphQLError('BigCommerce did not confirm a checkout handoff URL.', { outcomeUnknown: true });
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new BigCommerceGraphQLError('BigCommerce returned an invalid checkout handoff URL.');
	}
	if (url.protocol !== 'https:') {
		throw new BigCommerceGraphQLError('BigCommerce returned an insecure checkout handoff URL.');
	}
	return url.toString();
}

function requireMutationCart(cart: CartResponse | null | undefined, message: string): CartResponse {
	if (!cart) throw new BigCommerceGraphQLError(message, { outcomeUnknown: true });
	return cart;
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Extract custom fields into a key-value record */
export function customFieldsToRecord(product: BCProduct): Record<string, string> {
	const fields: Record<string, string> = {};
	for (const edge of product.customFields.edges) {
		fields[edge.node.name] = edge.node.value;
	}
	return fields;
}

/** Get the category slug from a BC category path (e.g., "/bealls-women/" → "bealls-women") */
export function categorySlug(path: string): string {
	return path.replace(/^\/|\/$/g, '');
}
