import { error } from '@sveltejs/kit';
import { getBrand } from '$lib/brand/config';
import {
	normalizeTrustedShopperRoute,
	ShopperRouteContractError,
	trustedErrorRouteContext,
	type BeallsFamilyBrandId,
	type ShopperRouteId,
} from '$lib/brand/bealls-family-runtime-contract';
import { executeRouteZones, type RouteZoneExecution } from './route-zone-runtime';

export async function executeShopperPageRoute(url: URL, expectedRouteId: ShopperRouteId): Promise<RouteZoneExecution> {
	const context = await requireTrustedShopperPageContext(url, expectedRouteId);
	return executeRouteZones({ context });
}

export async function requireTrustedShopperPageContext(
	url: URL,
	expectedRouteId: ShopperRouteId,
): Promise<ReturnType<typeof normalizeTrustedShopperRoute>> {
	const brand = getBrand();
	let context: ReturnType<typeof normalizeTrustedShopperRoute>;
	try {
		context = normalizeTrustedShopperRoute(brand.id as BeallsFamilyBrandId, url.pathname);
		if (context.routeId !== expectedRouteId) throw new Error('route identity mismatch');
	} catch (cause) {
		if (cause instanceof ShopperRouteContractError || String(cause).includes('route identity mismatch')) {
			return throwShopperNotFound(url, `Route is not available for ${brand.name}`);
		}
		throw cause;
	}
	return context;
}

export async function executeTrustedErrorZones(
	url: URL,
	kind: 'not-found' | 'empty',
): Promise<RouteZoneExecution> {
	const brand = getBrand();
	const context = trustedErrorRouteContext(brand.id as BeallsFamilyBrandId, url.pathname, kind);
	return executeRouteZones({ context });
}

/** Attach the server-authorized 404 terminal to the framework error render. */
export async function throwShopperNotFound(url: URL, message: string): Promise<never> {
	const zoneExecution = await executeTrustedErrorZones(url, 'not-found');
	throw error(404, { message, zoneExecution } as App.Error & { zoneExecution: RouteZoneExecution });
}
