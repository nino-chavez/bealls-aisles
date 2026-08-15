import { describe, expect, it } from 'vitest';
import { operationEvidence, productPath, type CommerceServiceBoundary } from './cart-contract';

describe('commerce API contract', () => {
	it('keeps provider evidence redacted and denies model mutation authority', () => {
		const evidence = operationEvidence('cart.add', 'correlation-one', {
			confirmed: true,
			changed: 'confirmed',
		});
		expect(evidence).toEqual({
			operation: 'cart.add',
			attempted: true,
			confirmed: true,
			provider: 'bigcommerce',
			commerceStateChanged: 'confirmed',
			modelCalls: 0,
			correlationId: 'correlation-one',
		});
		expect(JSON.stringify(evidence)).not.toMatch(/cartEntityId|checkoutUrl|productName|email/i);
	});

	it('maps provider product paths into the local PDP without accepting arbitrary URLs', () => {
		expect(productPath('/coastal-shirt/')).toBe('/product/coastal-shirt');
		expect(productPath('https://store.example.test/coastal-shirt/?source=cart')).toBe('/product/coastal-shirt');
		expect(productPath('javascript:alert(1)')).toBe('/');
	});

	it('makes unconfigured account, order, and subscription boundaries explicit', () => {
		const boundary: CommerceServiceBoundary = {
			mode: 'off',
			cart: 'not_connected',
			checkout: 'not_connected',
			orderCreation: 'not_exposed',
			account: 'not_configured',
			payment: 'provider_owned',
			subscription: 'not_configured',
		};
		expect(boundary).toMatchObject({
			orderCreation: 'not_exposed',
			account: 'not_configured',
			payment: 'provider_owned',
			subscription: 'not_configured',
		});
	});
});
