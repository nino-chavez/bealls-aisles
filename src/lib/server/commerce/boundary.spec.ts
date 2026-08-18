import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ dev: false }));

import { getCommerceServiceBoundary, isCommerceEnabled } from './boundary';

describe('Bealls commerce provider boundary', () => {
	beforeEach(() => {
		vi.stubEnv('BRAND_ID', 'bealls');
		vi.stubEnv('AISLES_COMMERCE_MODE', 'sandbox');
		vi.stubEnv('AISLES_CHECKOUT_MODE', 'off');
		vi.stubEnv('BIGCOMMERCE_STORE_HASH', '');
		vi.stubEnv('BEALLS_STOREFRONT_PRIVATE_TOKEN', '');
		vi.stubEnv('BIGCOMMERCE_STOREFRONT_PRIVATE_TOKEN', '');
		vi.stubEnv('KV_REST_API_URL', '');
		vi.stubEnv('KV_REST_API_TOKEN', '');
	});

	it('fails closed when the private provider token or durable session is missing', () => {
		expect(isCommerceEnabled()).toBe(false);
		vi.stubEnv('BEALLS_STOREFRONT_PRIVATE_TOKEN', 'configured');
		expect(isCommerceEnabled()).toBe(false);
		vi.stubEnv('BIGCOMMERCE_STORE_HASH', 'configured');
		expect(isCommerceEnabled()).toBe(false);
		expect(getCommerceServiceBoundary()).toMatchObject({
			mode: 'off',
			cart: 'not_connected',
			checkout: 'not_connected',
			account: 'not_configured',
			orderCreation: 'not_exposed',
			subscription: 'not_configured',
		});
	});

	it('does not treat a legacy browser Storefront token as commerce activation', () => {
		vi.stubEnv('BIGCOMMERCE_STORE_HASH', 'configured');
		vi.stubEnv('BEALLS_STOREFRONT_TOKEN', 'legacy-browser-token');
		vi.stubEnv('KV_REST_API_URL', 'https://redis.example.test');
		vi.stubEnv('KV_REST_API_TOKEN', 'configured');
		expect(isCommerceEnabled()).toBe(false);
	});

	it('advertises sandbox cart while hosted checkout remains separately gated', () => {
		vi.stubEnv('BIGCOMMERCE_STORE_HASH', 'configured');
		vi.stubEnv('BEALLS_STOREFRONT_PRIVATE_TOKEN', 'configured');
		vi.stubEnv('KV_REST_API_URL', 'https://redis.example.test');
		vi.stubEnv('KV_REST_API_TOKEN', 'configured');
		expect(getCommerceServiceBoundary()).toMatchObject({
			mode: 'sandbox',
			cart: 'bigcommerce_sandbox',
			checkout: 'not_connected',
		});
		vi.stubEnv('AISLES_CHECKOUT_MODE', 'hosted');
		expect(getCommerceServiceBoundary()).toMatchObject({
			mode: 'sandbox',
			cart: 'bigcommerce_sandbox',
			checkout: 'bigcommerce_hosted_handoff',
		});
	});
});
