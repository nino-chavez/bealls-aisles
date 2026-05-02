/**
 * Checkout surface — static fallbacks per section-authoring.md §3.5.
 *
 * Checkout is the narrowest-latitude surface. Two zones:
 *
 * - checkout.assurance-strip: brand-default trust strip
 *   (returns / shipping / secure-checkout). The AI overrides with a
 *   variant by inferred shopper signal (first-time → safety/return,
 *   returning → speed/welcome-back, loyalty-known → tier benefits).
 * - checkout.last-chance-upsell: Hidden by default. AI populates when
 *   it finds qualifying neighborhood products; otherwise no upsell.
 */

import { getBrandById } from '$lib/brand/config';
import type { ZoneFallback } from './index';

export const checkoutFallbacks: Partial<Record<string, ZoneFallback>> = {
	'checkout.assurance-strip': (brandId) => {
		const brand = getBrandById(brandId);
		if (!brand) return null;
		const hasFreeShipping = brand.incentives?.freeShippingThresholdMinor != null;
		return {
			component: 'assurance-strip-checkout',
			props: {
				variant: 'first-time',
				items: [
					{
						icon: 'secure',
						label: 'Secure checkout',
						body: 'PCI-compliant payment, encrypted in transit.',
					},
					{
						icon: 'returns',
						label: 'Easy returns',
						body: 'Return online orders for free within 60 days.',
					},
					hasFreeShipping
						? {
								icon: 'shipping',
								label: 'Free shipping',
								body: `Standard shipping is on us at qualifying order totals.`,
							}
						: {
								icon: 'quality',
								label: 'Trusted checkout',
								body: 'Hosted by BigCommerce. Branded by the merchant.',
							},
				],
			},
		};
	},

	// checkout.last-chance-upsell — Hidden default. Engine populates per request.
};
