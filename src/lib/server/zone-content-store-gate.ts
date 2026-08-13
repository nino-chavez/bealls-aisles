export const TRUSTED_ZONE_CONTENT_SCHEMA_VERSION = 'route-bound-v1';

export interface CompatibleZoneContentReadState {
	unavailable: boolean;
}

/**
 * Fail closed before querying unless operators explicitly attest that the
 * pre-existing admin table has the route-bound v1 columns. Missing-table and
 * missing-column responses permanently disable reads for this process.
 */
export async function readCompatibleZoneContentRows<T>(input: {
	configuredSchemaVersion?: string;
	state: CompatibleZoneContentReadState;
	query: () => Promise<T>;
}): Promise<T | null> {
	if (input.configuredSchemaVersion !== TRUSTED_ZONE_CONTENT_SCHEMA_VERSION || input.state.unavailable) return null;
	try {
		return await input.query();
	} catch (error) {
		if (isUnavailableZoneStoreSchema(error)) {
			input.state.unavailable = true;
			return null;
		}
		throw error;
	}
}

function isUnavailableZoneStoreSchema(error: unknown): boolean {
	if (typeof error !== 'object' || error === null) return false;
	const code = (error as { code?: string }).code;
	return code === '42P01' || code === '42703';
}
