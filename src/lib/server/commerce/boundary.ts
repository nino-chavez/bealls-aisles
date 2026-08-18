import { dev } from '$app/environment';
import { getBrand, getBrandMode } from '$lib/brand/config';
import type { CommerceServiceBoundary } from '$lib/commerce/cart-contract';

function privateStorefrontTokenConfigured(): boolean {
	const brand = getBrand();
	// BigCommerce's current private Storefront token is the stateless
	// server-to-server credential. Legacy browser-token variables may still
	// serve catalog reads during migration, but cannot activate commerce.
	// https://docs.bigcommerce.com/developer/api-reference/rest/admin/authentication-apis/storefront-api-tokens/overview
	const tokenKey = `${brand.id.toUpperCase()}_STOREFRONT_PRIVATE_TOKEN`;
	return Boolean(process.env[tokenKey] || process.env.BIGCOMMERCE_STOREFRONT_PRIVATE_TOKEN);
}

export function getCommerceServiceBoundary(): CommerceServiceBoundary {
	const brand = getBrand();
	const storefrontBrand = getBrandMode(brand) === 'storefront';
	const providerConfigured = Boolean(process.env.BIGCOMMERCE_STORE_HASH && privateStorefrontTokenConfigured());
	const durableSessionConfigured = dev || Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
	const enabled =
		storefrontBrand &&
		process.env.AISLES_COMMERCE_MODE === 'sandbox' &&
		providerConfigured &&
		durableSessionConfigured;
	const checkoutEnabled = enabled && process.env.AISLES_CHECKOUT_MODE === 'hosted';

	return {
		mode: enabled ? 'sandbox' : 'off',
		cart: enabled ? 'bigcommerce_sandbox' : 'not_connected',
		checkout: checkoutEnabled ? 'bigcommerce_hosted_handoff' : 'not_connected',
		orderCreation: 'not_exposed',
		account: 'not_configured',
		payment: 'provider_owned',
		subscription: 'not_configured',
	};
}

export function isCommerceEnabled(): boolean {
	return getCommerceServiceBoundary().mode === 'sandbox';
}

export function isHostedCheckoutEnabled(): boolean {
	return getCommerceServiceBoundary().checkout === 'bigcommerce_hosted_handoff';
}
