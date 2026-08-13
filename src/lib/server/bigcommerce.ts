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
	// Brand-specific storefront tokens: BEALLS_STOREFRONT_TOKEN, BEALLSFLORIDA_STOREFRONT_TOKEN, etc.
	const tokenKey = `${brand.id.toUpperCase()}_STOREFRONT_TOKEN`;
	const storeHash = process.env.BIGCOMMERCE_STORE_HASH;
	const storefrontToken = process.env[tokenKey] || process.env.BIGCOMMERCE_STOREFRONT_TOKEN;

	if (!storeHash) throw new Error('BIGCOMMERCE_STORE_HASH not configured');
	if (!storefrontToken) throw new Error(`Storefront token not configured (tried ${tokenKey} and BIGCOMMERCE_STOREFRONT_TOKEN)`);

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
	data: T;
	errors?: Array<{ message: string }>;
}

async function query<T>(gql: string, variables?: Record<string, unknown>): Promise<T> {
	const { data } = await rawQuery<T>(gql, variables);
	return data;
}

async function rawQuery<T>(
	gql: string,
	variables?: Record<string, unknown>,
	opts: { sessionCookie?: string } = {},
): Promise<{ data: T; sessionCookie: string | null }> {
	if (isParityFixtureEnabled()) {
		throw new Error('BigCommerce access is disabled by the parity fixture');
	}
	queryAccessObserverForTest?.();
	const { url, token } = getGraphQLConfig();
	// BC's Storefront GraphQL enforces an Origin check matching the token's
	// allowed_cors_origins. Server-to-server fetches sometimes have an Origin
	// implicitly added by the runtime; explicitly setting it to localhost
	// (which is in every token's allowed list) is the most reliable bridge.
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${token}`,
		Origin: 'http://localhost:5173',
	};
	// BC scopes cart mutations/queries to a visitor session. The session
	// cookie comes back from cart.createCart and must be replayed on
	// subsequent cart calls — otherwise BC returns "Cart does not exist".
	if (opts.sessionCookie) {
		headers.Cookie = opts.sessionCookie;
	}
	const res = await fetch(url, {
		method: 'POST',
		headers,
		body: JSON.stringify({ query: gql, variables }),
	});

	if (!res.ok) {
		throw new Error(`BigCommerce GraphQL error: ${res.status} ${res.statusText}`);
	}

	const json: GraphQLResponse<T> = await res.json();

	if (json.errors?.length) {
		console.error('GraphQL errors:', json.errors);
		throw new Error(json.errors[0].message);
	}

	return { data: json.data, sessionCookie: extractSessionCookie(res.headers) };
}

/**
 * BC may return multiple Set-Cookie headers. Concatenate the relevant
 * cart-session entries into a single Cookie header value for replay.
 */
function extractSessionCookie(headers: Headers): string | null {
	const raw =
		typeof (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === 'function'
			? (headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
			: headers.get('set-cookie')?.split(/,(?=\s*[A-Za-z0-9_\-]+=)/) ?? [];
	if (!raw.length) return null;
	const parts = raw.map((c) => c.split(';')[0].trim()).filter(Boolean);
	return parts.length ? parts.join('; ') : null;
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
	lineItems: {
		physicalItems: Array<{
			entityId: string;
			productEntityId: number;
			name: string;
			quantity: number;
			salePrice: { value: number; currencyCode: string };
			listPrice: { value: number; currencyCode: string };
			imageUrl: string;
			/** BC product path, e.g. "/women-s-floral-print-top/" — used by cart UI to link back to the PDP. */
			url?: string;
			/** Slug derived from url for `/product/[slug]` routing. */
			productSlug?: string;
		}>;
	};
}

const parityCarts = new Map<string, CartResponse>();

function parityProductOrThrow(productEntityId: number): BCProduct {
	const product = parityBCProducts().find((candidate) => candidate.entityId === productEntityId);
	if (!product) throw new Error(`Parity product ${productEntityId} is outside the fixed catalog`);
	return product;
}

function parityLineItem(productEntityId: number, quantity: number): CartResponse['lineItems']['physicalItems'][number] {
	const product = parityProductOrThrow(productEntityId);
	return {
		entityId: `parity-line-${productEntityId}`,
		productEntityId,
		name: product.name,
		quantity,
		salePrice: product.prices.salePrice ?? product.prices.price,
		listPrice: product.prices.price,
		imageUrl: product.defaultImage?.url ?? '',
		url: product.path,
		productSlug: product.path.replace(/^\/+|\/+$/g, ''),
	};
}

function parityCartId(): string {
	return `parity-cart-${getBrand().id}`;
}

function parityCartSnapshot(cart: CartResponse): CartResponse {
	return structuredClone(cart);
}

function requireParityCart(cartEntityId: string): CartResponse {
	const cart = parityCarts.get(cartEntityId);
	if (!cart) throw new Error(`Parity cart ${cartEntityId} does not exist`);
	return cart;
}

/**
 * Result of a cart mutation: the cart payload plus the BC visitor session
 * cookie that scoped it. The cookie must be replayed on subsequent cart
 * operations against the same cartEntityId — without it BC returns
 * "Cart does not exist" because the new request has no session linkage.
 */
export interface CartMutationResult {
	cart: CartResponse;
	sessionCookie: string | null;
}

export async function createCart(productEntityId: number, quantity = 1): Promise<CartMutationResult> {
	if (isParityFixtureEnabled()) {
		const cart: CartResponse = {
			entityId: parityCartId(),
			lineItems: { physicalItems: [parityLineItem(productEntityId, quantity)] },
		};
		parityCarts.set(cart.entityId, cart);
		return { cart: parityCartSnapshot(cart), sessionCookie: null };
	}
	interface CreateCartResponse { cart: { createCart: { cart: CartResponse } } }

	const { data, sessionCookie } = await rawQuery<CreateCartResponse>(`
		mutation CreateCart($productId: Int!, $quantity: Int!) {
			cart {
				createCart(input: {
					lineItems: [{ productEntityId: $productId, quantity: $quantity }]
				}) {
					cart {
						entityId
						lineItems {
							physicalItems {
								entityId
								productEntityId
								name
								quantity
								salePrice { value currencyCode }
								listPrice { value currencyCode }
								imageUrl
								url
							}
						}
					}
				}
			}
		}
	`, { productId: productEntityId, quantity });

	const cart = data.cart.createCart.cart;
	if (cart) decorateCartSlugs(cart);
	return { cart, sessionCookie };
}

export async function addToCart(
	cartEntityId: string,
	productEntityId: number,
	quantity = 1,
	sessionCookie?: string,
): Promise<CartMutationResult> {
	if (isParityFixtureEnabled()) {
		const cart = requireParityCart(cartEntityId);
		const item = cart.lineItems.physicalItems.find((candidate) => candidate.productEntityId === productEntityId);
		if (item) item.quantity += quantity;
		else cart.lineItems.physicalItems.push(parityLineItem(productEntityId, quantity));
		return { cart: parityCartSnapshot(cart), sessionCookie: null };
	}
	interface AddToCartResponse { cart: { addCartLineItems: { cart: CartResponse } } }

	const { data, sessionCookie: nextCookie } = await rawQuery<AddToCartResponse>(`
		mutation AddToCart($cartId: String!, $productId: Int!, $quantity: Int!) {
			cart {
				addCartLineItems(input: {
					cartEntityId: $cartId,
					data: { lineItems: [{ productEntityId: $productId, quantity: $quantity }] }
				}) {
					cart {
						entityId
						lineItems {
							physicalItems {
								entityId
								productEntityId
								name
								quantity
								salePrice { value currencyCode }
								listPrice { value currencyCode }
								imageUrl
								url
							}
						}
					}
				}
			}
		}
	`, { cartId: cartEntityId, productId: productEntityId, quantity }, { sessionCookie });

	const cart = data.cart.addCartLineItems.cart;
	if (cart) decorateCartSlugs(cart);
	return { cart, sessionCookie: nextCookie ?? sessionCookie ?? null };
}

export async function updateCartLineItem(
	cartEntityId: string,
	lineItemEntityId: string,
	productEntityId: number,
	quantity: number,
	sessionCookie?: string,
): Promise<CartMutationResult> {
	if (isParityFixtureEnabled()) {
		parityProductOrThrow(productEntityId);
		const cart = requireParityCart(cartEntityId);
		const item = cart.lineItems.physicalItems.find((candidate) => candidate.entityId === lineItemEntityId);
		if (!item) throw new Error(`Parity line item ${lineItemEntityId} does not exist`);
		item.quantity = quantity;
		return { cart: parityCartSnapshot(cart), sessionCookie: null };
	}
	interface UpdateLineItemResponse { cart: { updateCartLineItem: { cart: CartResponse } } }

	const { data, sessionCookie: nextCookie } = await rawQuery<UpdateLineItemResponse>(`
		mutation UpdateLineItem($cartId: String!, $lineItemId: String!, $productId: Int!, $quantity: Int!) {
			cart {
				updateCartLineItem(input: {
					cartEntityId: $cartId,
					lineItemEntityId: $lineItemId,
					data: { lineItem: { productEntityId: $productId, quantity: $quantity } }
				}) {
					cart {
						entityId
						lineItems {
							physicalItems {
								entityId
								productEntityId
								name
								quantity
								salePrice { value currencyCode }
								listPrice { value currencyCode }
								imageUrl
								url
							}
						}
					}
				}
			}
		}
	`, { cartId: cartEntityId, lineItemId: lineItemEntityId, productId: productEntityId, quantity }, { sessionCookie });

	const cart = data.cart.updateCartLineItem.cart;
	if (cart) decorateCartSlugs(cart);
	return { cart, sessionCookie: nextCookie ?? sessionCookie ?? null };
}

export async function deleteCartLineItem(
	cartEntityId: string,
	lineItemEntityId: string,
	sessionCookie?: string,
): Promise<{ cart: CartResponse | null; sessionCookie: string | null }> {
	if (isParityFixtureEnabled()) {
		const cart = requireParityCart(cartEntityId);
		const index = cart.lineItems.physicalItems.findIndex((candidate) => candidate.entityId === lineItemEntityId);
		if (index < 0) throw new Error(`Parity line item ${lineItemEntityId} does not exist`);
		cart.lineItems.physicalItems.splice(index, 1);
		if (cart.lineItems.physicalItems.length === 0) {
			parityCarts.delete(cartEntityId);
			return { cart: null, sessionCookie: null };
		}
		return { cart: parityCartSnapshot(cart), sessionCookie: null };
	}
	interface DeleteLineItemResponse { cart: { deleteCartLineItem: { cart: CartResponse | null } } }

	const { data, sessionCookie: nextCookie } = await rawQuery<DeleteLineItemResponse>(`
		mutation DeleteLineItem($cartId: String!, $lineItemId: String!) {
			cart {
				deleteCartLineItem(input: {
					cartEntityId: $cartId,
					lineItemEntityId: $lineItemId
				}) {
					cart {
						entityId
						lineItems {
							physicalItems {
								entityId
								productEntityId
								name
								quantity
								salePrice { value currencyCode }
								listPrice { value currencyCode }
								imageUrl
								url
							}
						}
					}
				}
			}
		}
	`, { cartId: cartEntityId, lineItemId: lineItemEntityId }, { sessionCookie });

	const cart = data.cart.deleteCartLineItem.cart;
	if (cart) decorateCartSlugs(cart);
	return { cart, sessionCookie: nextCookie ?? sessionCookie ?? null };
}

/**
 * Generate a BC Optimized Checkout redirect URL for a cart. BC's mutation
 * returns a short-lived signed URL that hands the shopper into BC's
 * hosted checkout with the cart contents + customer context attached.
 *
 * Trace: PRD-FND-010 (real checkout via BC Optimized One-Page handoff).
 */
export async function getCheckoutRedirectUrl(
	cartEntityId: string,
	sessionCookie?: string,
): Promise<string | null> {
	if (isParityFixtureEnabled()) {
		// Fixture evidence never mints an external checkout capability.
		return null;
	}
	interface RedirectUrlsResponse {
		cart: {
			createCartRedirectUrls: {
				redirectUrls: {
					redirectedCheckoutUrl?: string | null;
					embeddedCheckoutUrl?: string | null;
				} | null;
			} | null;
		};
	}

	try {
		const { data } = await rawQuery<RedirectUrlsResponse>(`
			mutation CartRedirectUrls($cartId: String!) {
				cart {
					createCartRedirectUrls(input: { cartEntityId: $cartId }) {
						redirectUrls {
							redirectedCheckoutUrl
							embeddedCheckoutUrl
						}
					}
				}
			}
		`, { cartId: cartEntityId }, { sessionCookie });

		const urls = data.cart?.createCartRedirectUrls?.redirectUrls;
		return urls?.redirectedCheckoutUrl ?? urls?.embeddedCheckoutUrl ?? null;
	} catch (err) {
		console.warn('getCheckoutRedirectUrl failed:', err instanceof Error ? err.message : err);
		return null;
	}
}

export async function getCart(cartEntityId: string, sessionCookie?: string): Promise<CartResponse | null> {
	if (isParityFixtureEnabled()) {
		const cart = parityCarts.get(cartEntityId);
		return cart ? parityCartSnapshot(cart) : null;
	}
	interface GetCartResponse { site: { cart: CartResponse | null } }

	const { data } = await rawQuery<GetCartResponse>(`
		query GetCart($cartId: String!) {
			site {
				cart(entityId: $cartId) {
					entityId
					lineItems {
						physicalItems {
							entityId
							productEntityId
							name
							quantity
							salePrice { value currencyCode }
							listPrice { value currencyCode }
							imageUrl
							url
						}
					}
				}
			}
		}
	`, { cartId: cartEntityId }, { sessionCookie });

	const cart = data.site.cart;
	if (cart) decorateCartSlugs(cart);
	return cart;
}

/** BC's `url` field comes back as `/{slug}/`; expose `productSlug` so cart UI can link back to /product/{slug}. */
function decorateCartSlugs(cart: CartResponse): void {
	for (const item of cart.lineItems.physicalItems) {
		if (item.url) {
			item.productSlug = item.url.replace(/^\/+|\/+$/g, '');
		}
	}
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
