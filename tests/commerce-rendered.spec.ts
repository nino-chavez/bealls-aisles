import { expect, test } from 'playwright/test';

test('rendered cart persists add, update, remove, empty, checkout handoff, and truthful account boundaries', async ({ page }) => {
	const openProduct = async () => {
		const cartReady = page.waitForResponse((response) =>
			response.request().method() === 'GET' && response.url().endsWith('/api/cart'),
		);
		await page.goto('/product/parity-coastal-shirt?dev=true');
		await cartReady;
	};
	const openCart = async () => {
		const cartReady = page.waitForResponse((response) =>
			response.request().method() === 'GET' && response.url().endsWith('/api/cart'),
		);
		await page.goto('/cart');
		await cartReady;
	};
	await page.route('https://checkout.example.invalid/**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'text/html',
			body: '<h1>Hosted checkout fixture</h1>',
		});
	});

	await openProduct();
	await page.getByRole('button', { name: /Add to Cart/ }).click();
	await expect(page.getByText('Added to cart (1 items)')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Cart (1 items)' })).toBeVisible();
	const commerceEvidence = page.locator('[data-commerce-evidence]');
	await expect(commerceEvidence).toContainText('cart.add');
	await expect(commerceEvidence).toContainText(/Attempted\s*yes/);
	await expect(commerceEvidence).toContainText(/Confirmed\s*yes/);
	await expect(commerceEvidence).toContainText(/Model calls\s*0/);

	await openCart();
	await expect(page.getByRole('link', { name: 'Parity Coastal Shirt' }).first()).toBeVisible();
	await page.getByRole('button', { name: 'Increase quantity of Parity Coastal Shirt' }).click();
	await expect(page.getByRole('button', { name: 'Cart (2 items)' })).toBeVisible();

	const reloadedCartReady = page.waitForResponse((response) =>
		response.request().method() === 'GET' && response.url().endsWith('/api/cart'),
	);
	await page.reload();
	await reloadedCartReady;
	await expect(page.getByText('$27.00 each')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Cart (2 items)' })).toBeVisible();

	await page.getByRole('button', { name: 'Remove' }).click();
	await expect(page.getByText('Your cart is empty')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Cart (0 items)' })).toBeVisible();

	await openProduct();
	await page.getByRole('button', { name: /Add to Cart/ }).click();
	await openCart();
	await page.getByRole('button', { name: 'Empty cart' }).click();
	await expect(page.getByText('Your cart is empty')).toBeVisible();

	await openProduct();
	await page.getByRole('button', { name: /Add to Cart/ }).click();
	let handoffRequests = 0;
	page.on('request', (request) => {
		if (request.url().endsWith('/api/checkout/redirect')) handoffRequests += 1;
	});
	const checkoutCartReady = page.waitForResponse((response) =>
		response.request().method() === 'GET' && response.url().endsWith('/api/cart'),
	);
	await page.goto('/checkout');
	await checkoutCartReady;
	await expect(page.getByRole('heading', { name: 'Almost done' })).toBeVisible();
	expect(handoffRequests).toBe(0);
	await page.getByRole('button', { name: 'Continue to secure checkout' }).click();
	await expect(page.getByRole('heading', { name: 'Hosted checkout fixture' })).toBeVisible();
	expect(handoffRequests).toBe(1);

	await page.goto('/account');
	await expect(page.getByRole('heading', { name: 'Customer accounts are not connected' })).toBeVisible();
	await expect(page.getByText('Provider and merchant policy are not configured')).toBeVisible();
	await expect(page.getByText('Sara')).toHaveCount(0);
	await expect(page.getByText('#10428')).toHaveCount(0);
});
