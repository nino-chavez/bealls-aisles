import type { PageServerLoad } from './$types';
import { requireBrandSurface } from '$lib/server/brand-surface-guard';
import { executeShopperPageRoute } from '$lib/server/shopper-route-runtime';

export const load: PageServerLoad = async ({ url }) => {
	const zoneExecution = await executeShopperPageRoute(url, '/compare');
	requireBrandSurface('compare');
	return { zoneExecution };
};
