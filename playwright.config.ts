import { defineConfig } from 'playwright/test';

export default defineConfig({
	testDir: './tests',
	fullyParallel: false,
	workers: 1,
	timeout: 45_000,
	use: {
		baseURL: 'http://127.0.0.1:4175',
		trace: 'retain-on-failure',
	},
	webServer: {
		command: 'npm run dev -- --host 127.0.0.1 --port 4175',
		url: 'http://127.0.0.1:4175',
		reuseExistingServer: false,
		timeout: 120_000,
		env: {
			NODE_ENV: 'development',
			VITE_BRAND_ID: 'bealls',
			BRAND_ID: 'bealls',
			AISLES_PARITY_FIXTURE: 'v1',
			AISLES_ZONE_CONTENT_SCHEMA_VERSION: 'route-bound-v1',
			AISLES_COMMERCE_MODE: 'sandbox',
			AISLES_CHECKOUT_MODE: 'hosted',
			BEALLS_STOREFRONT_PRIVATE_TOKEN: 'fixture-token',
			BIGCOMMERCE_STORE_HASH: 'fixture-store',
		},
	},
});
