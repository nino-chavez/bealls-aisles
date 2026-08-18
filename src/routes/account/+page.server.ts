import type { PageServerLoad } from './$types';
import { getBrand } from '$lib/brand/config';
import { requireBrandSurface } from '$lib/server/brand-surface-guard';
import { executeShopperPageRoute } from '$lib/server/shopper-route-runtime';
import { getCommerceServiceBoundary } from '$lib/server/commerce/boundary';

export const load: PageServerLoad = async ({ url }) => {
	requireBrandSurface('account');
	return {
		brandName: getBrand().name,
		services: getCommerceServiceBoundary(),
		zoneExecution: await executeShopperPageRoute(url, '/account'),
	};
};
