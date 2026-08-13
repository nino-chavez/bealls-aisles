#!/usr/bin/env node
/**
 * Internal desktop/mobile regression capture for one locally running brand.
 * Model endpoints are blocked so the capture exercises existing fallbacks and
 * cannot make a paid generation call. This is not an external-reference gate.
 *
 * Required: PARITY_BRAND, PARITY_BASE_URL
 * Storefront brands also require PARITY_PRODUCT_SLUG for a real PDP fixture.
 * Optional: PARITY_OUTPUT (default validation/runtime-parity)
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const brand = process.env.PARITY_BRAND;
const baseUrl = process.env.PARITY_BASE_URL?.replace(/\/$/, '');
const productSlug = process.env.PARITY_PRODUCT_SLUG;
const outputRoot = path.resolve(process.env.PARITY_OUTPUT ?? 'validation/runtime-parity');
const brandConfigs = {
	bealls: { category: 'women', storefront: true },
	beallsflorida: { category: 'women', storefront: true },
	homecentric: { category: 'bedroom', storefront: false },
};
const routeSelection = new Set((process.env.PARITY_ROUTE_IDS ?? '').split(',').map((value) => value.trim()).filter(Boolean));

if (!brand || !(brand in brandConfigs) || !baseUrl) {
	throw new Error('Set PARITY_BRAND=bealls|beallsflorida|homecentric and PARITY_BASE_URL');
}
const config = brandConfigs[brand];
if (config.storefront && !productSlug && (routeSelection.size === 0 || routeSelection.has('product'))) {
	throw new Error('PARITY_PRODUCT_SLUG is required for storefront PDP parity');
}

const routes = [
	{ id: 'home', path: '/', expected: 200 },
	{ id: 'account', path: '/account', expected: config.storefront ? 200 : 404 },
	{ id: 'cart', path: '/cart', expected: config.storefront ? 200 : 404 },
	{ id: 'category', path: `/category/${config.category}`, expected: 200 },
	{ id: 'checkout', path: '/checkout', expected: config.storefront ? 200 : 404 },
	{ id: 'compare', path: '/compare', expected: config.storefront ? 200 : 404 },
	{ id: 'observe', path: '/observe', expected: 200 },
	{ id: 'product', path: `/product/${productSlug ?? '__not-applicable__'}`, expected: config.storefront ? 200 : 404 },
	{ id: 'search', path: '/search?q=shirt', expected: config.storefront ? 200 : 404 },
	{ id: 'locator', path: '/store-locator', expected: 200 },
	{ id: 'style-guide', path: '/style-guide', expected: 200 },
	{ id: 'test-cart', path: '/test/cart-scaffold', expected: 200 },
	{ id: 'test-components', path: '/test/components', expected: 200 },
	{ id: 'test-p0', path: '/test/p0-blocks', expected: 200 },
	{ id: 'test-pdp', path: '/test/pdp-scaffold', expected: 200 },
	{ id: 'error-404', path: '/__runtime-parity-missing__', expected: 404 },
].filter((route) => routeSelection.size === 0 || routeSelection.has(route.id));
const viewports = {
	desktop: { width: 1440, height: 900 },
	mobile: { width: 390, height: 844 },
};

fs.mkdirSync(outputRoot, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const evidence = [];
let failed = false;

for (const [viewportName, viewport] of Object.entries(viewports)) {
	const context = await browser.newContext({ viewport });
	await context.route(/\/api\/(layout(?:\/stream)?|refine|suggest)(?:\?|$)/, async (route) => {
		await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'blocked by internal parity capture' }) });
	});
	for (const route of routes) {
		const page = await context.newPage();
		const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
		const status = response?.status() ?? 0;
		await page.evaluate(async () => {
			await document.fonts.ready;
			await Promise.race([
				Promise.all([...document.images].map((image) => image.complete
					? Promise.resolve()
					: new Promise((resolve) => {
						image.addEventListener('load', resolve, { once: true });
						image.addEventListener('error', resolve, { once: true });
					}))),
				new Promise((resolve) => setTimeout(resolve, 2_000)),
			]);
		});
		await page.waitForTimeout(250);
		const directory = path.join(outputRoot, brand, viewportName);
		fs.mkdirSync(directory, { recursive: true });
		const screenshot = path.join(directory, `${route.id}.png`);
		await page.screenshot({ path: screenshot, fullPage: false });
		const matches = status === route.expected;
		failed ||= !matches;
		evidence.push({ brand, viewport: viewportName, routeId: route.id, path: route.path, expectedStatus: route.expected, status, matches, screenshot });
		await page.close();
	}
	await context.close();
}

await browser.close();
const manifestPath = path.join(outputRoot, brand, 'manifest.json');
fs.writeFileSync(manifestPath, `${JSON.stringify({
	kind: 'internal-regression-parity', externalReferenceState: 'uncontracted', modelRequests: 'blocked', evidence,
}, null, 2)}\n`);
console.log(manifestPath);
if (failed) process.exitCode = 1;
