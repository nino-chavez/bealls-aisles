import type { TrustedShopperRouteContext } from '$lib/brand/bealls-family-runtime-contract';
import { getRouteZoneContents } from './admin-overrides';

/** Load one exact route's merchant records in a single fail-closed read. */
export async function loadRouteZoneRecords(
	context: TrustedShopperRouteContext,
	policyVersion: string,
) {
	return getRouteZoneContents({
		organizationId: context.organizationId,
		brandId: context.brandId,
		routePath: context.routePath,
		surface: context.surface,
		zoneIds: context.zoneInstanceIds,
		policyVersion,
		referenceState: 'uncontracted',
		referenceId: null,
		referenceVersion: null,
	});
}
