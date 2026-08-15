import type { PageServerLoad } from './$types';
import { loadProductsByTagOverlapAggregate } from '$lib/server/catalog';
import { getBrand } from '$lib/brand/config';
import { requireBrandSurface } from '$lib/server/brand-surface-guard';
import { executeBoundedShopperPageRoute, executeShopperPageRoute, executeTrustedErrorZones } from '$lib/server/shopper-route-runtime';
import { productCandidates } from '$lib/server/bounded-ai';
import { projectShopperProducts } from '$lib/foundation/shopper-product';
import { getCommerceServiceBoundary, isCommerceEnabled } from '$lib/server/commerce/boundary';
import { commerceService } from '$lib/server/commerce/service';
import { commerceSessionId } from '$lib/server/commerce/session';

export const load: PageServerLoad = async ({ cookies, url }) => {
	requireBrandSurface('cart');
	const brand = getBrand();
	const services = getCommerceServiceBoundary();
	const freeShippingThresholdMinor = brand.incentives?.freeShippingThresholdMinor ?? null;

	if (!isCommerceEnabled()) {
		const zoneExecution = await executeShopperPageRoute(url, '/cart');
		return {
			cart: null,
			itemCount: 0,
			subtotal: 0,
			cartError: null,
			services,
			freeShippingThreshold: freeShippingThresholdMinor != null ? freeShippingThresholdMinor / 100 : null,
			zoneExecution,
			emptyZoneExecution: await executeTrustedErrorZones(url, 'empty'),
		};
	}

	const result = await commerceService.read(commerceSessionId(cookies));
	const cart = result.ok ? result.data.cart : null;
	const cartError = result.ok ? null : result.error;
	const lines = cart?.lines ?? [];
	const itemCount = cart?.itemCount ?? 0;
	const subtotal = cart?.subtotal.value ?? 0;

	const candidateProducts = lines.length > 0
		? await loadProductsByTagOverlapAggregate(
				lines.map((line) => line.productEntityId),
				{ minOverlap: 2, limit: 8 },
			).catch(() => [])
		: [];
	const safeFallbackZones = candidateProducts.length > 0
		? {
				'cart.above-checkout-cta': {
					component: 'last-chance-upsell-row',
					props: {
						title: 'Complete your cart',
						products: candidateProducts.slice(0, 3).map((product) => ({ productId: product.id, role: 'standard' as const })),
					},
				},
			}
		: {};
	const bounded = await executeBoundedShopperPageRoute(url, '/cart', {
		persona: 'gatherer',
		candidates: productCandidates(candidateProducts),
		sessionKey: cookies.get('aisles_session') ?? undefined,
		safeFallbackZones,
	});

	return {
		cart,
		itemCount,
		subtotal,
		cartError,
		services,
		freeShippingThreshold: freeShippingThresholdMinor != null ? freeShippingThresholdMinor / 100 : null,
		zoneExecution: bounded.zoneExecution,
		upsellProducts: projectShopperProducts(candidateProducts),
		emptyZoneExecution: lines.length === 0 ? await executeTrustedErrorZones(url, 'empty') : null,
	};
};
