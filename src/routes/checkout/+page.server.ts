import type { PageServerLoad } from './$types';
import { requireBrandSurface } from '$lib/server/brand-surface-guard';
import { executeBoundedShopperPageRoute, executeShopperPageRoute, executeTrustedErrorZones } from '$lib/server/shopper-route-runtime';
import { applyTrustedEmptyRouteState } from '$lib/server/route-zone-runtime';
import { getCommerceServiceBoundary, isCommerceEnabled } from '$lib/server/commerce/boundary';
import { commerceService } from '$lib/server/commerce/service';
import { commerceSessionId } from '$lib/server/commerce/session';

export const load: PageServerLoad = async ({ cookies, url }) => {
	requireBrandSurface('checkout');
	const services = getCommerceServiceBoundary();

	if (!isCommerceEnabled()) {
		return {
			reason: 'disabled' as const,
			itemCount: 0,
			subtotal: 0,
			services,
			zoneExecution: await executeShopperPageRoute(url, '/checkout'),
			emptyZoneExecution: null,
		};
	}

	const result = await commerceService.read(commerceSessionId(cookies));
	if (!result.ok) {
		return {
			reason: 'unavailable' as const,
			itemCount: 0,
			subtotal: 0,
			services,
			cartError: result.error,
			zoneExecution: await executeShopperPageRoute(url, '/checkout'),
			emptyZoneExecution: null,
		};
	}
	if (!result.data.cart || result.data.cart.lines.length === 0) {
		const zoneExecution = await executeShopperPageRoute(url, '/checkout');
		return {
			reason: 'empty' as const,
			itemCount: 0,
			subtotal: 0,
			services,
			zoneExecution: applyTrustedEmptyRouteState(zoneExecution),
			emptyZoneExecution: await executeTrustedErrorZones(url, 'empty'),
		};
	}

	const bounded = await executeBoundedShopperPageRoute(url, '/checkout', {
		persona: cookies.get('aisles_persona') ?? 'gatherer',
		returningShopper: Number(cookies.get('aisles_visits') ?? '0') > 1,
		sessionKey: cookies.get('aisles_session') ?? undefined,
	});

	return {
		reason: services.checkout === 'bigcommerce_hosted_handoff' ? 'handoff' as const : 'checkout-disabled' as const,
		itemCount: result.data.cart.itemCount,
		subtotal: result.data.cart.subtotal.value,
		services,
		zoneExecution: bounded.zoneExecution,
		emptyZoneExecution: null,
	};
};
