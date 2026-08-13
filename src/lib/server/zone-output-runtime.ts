import { validateZonePublicationContent } from '$lib/foundation/resolve-zone';
import { parseZoneInstance, type ZoneInstanceId } from '$lib/foundation/zones';
import type { BeallsFamilyBrandId } from '$lib/brand/bealls-family-runtime-contract';

/** Exact schema + catalog/asset/destination closure for generated zone content. */
export function validateZoneEngineOutput(input: {
	brandId: BeallsFamilyBrandId;
	allowedZoneIds: readonly ZoneInstanceId[];
	zones: unknown;
	candidateProductIds: readonly string[];
	candidateAssetUrls?: readonly string[];
}): { zones: Record<ZoneInstanceId, unknown> } {
	if (!input.zones || typeof input.zones !== 'object' || Array.isArray(input.zones)) {
		throw new Error('zone output contract: zones object is required');
	}
	const allowedZoneIds = new Set(input.allowedZoneIds);
	const validated: Record<ZoneInstanceId, unknown> = {};

	for (const [zoneId, raw] of Object.entries(input.zones as Record<string, unknown>)) {
		if (!allowedZoneIds.has(zoneId) || !parseZoneInstance(zoneId)) {
			throw new Error(`zone output contract: unsupported zone "${zoneId}"`);
		}
		try {
			validated[zoneId] = validateZonePublicationContent({
				brandId: input.brandId,
				zoneId,
				raw,
				publicationContext: {
					candidateProductIds: input.candidateProductIds,
					candidateAssetUrls: input.candidateAssetUrls,
				},
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(message.replace('zone publication contract:', 'zone output contract:'));
		}
	}
	return { zones: validated };
}
