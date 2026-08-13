import type { PageServerLoad } from './$types';
import { getBrand } from '$lib/brand/config';
import { getStoresForBrand, type Store } from '$lib/server/locator/stores';
import { geocodeZip, nearestStores } from '$lib/server/locator/proximity';
import { executeShopperPageRoute } from '$lib/server/shopper-route-runtime';
import { routeZoneDecision } from '$lib/server/route-zone-runtime';

/**
 * Store locator surface (PRD-FND-014).
 *
 * GET /store-locator                — full list of brand stores, no proximity
 * GET /store-locator?zip=33701      — top 10 nearest stores from that ZIP
 *
 * Foundation behavior. Engine composes only the editorial intro at
 * `locator.editorial-intro` (PRD-FND-013 cascade); the list itself is data.
 */
export const load: PageServerLoad = async ({ url }) => {
	const brand = getBrand();
	const allStores = getStoresForBrand(brand.id);

	const zipParam = url.searchParams.get('zip')?.trim() || '';
	const origin = zipParam ? geocodeZip(zipParam) : null;

	const stores: Array<Store & { distanceMi?: number }> = origin
		? nearestStores(allStores, origin, { limit: 10 })
		: allStores;

	const zoneExecution = await executeShopperPageRoute(url, '/store-locator');
	const editorialIntroZone = routeZoneDecision(zoneExecution, 'locator.editorial-intro').resolution;

	return {
		brand: { id: brand.id, name: brand.prompt.storeName },
		zipQuery: zipParam,
		zipResolved: !!origin,
		zipResolvedLabel: origin?.label ?? null,
		stores,
		editorialIntroZone,
		zoneExecution,
	};
};
