export const TRUSTED_ZONE_CONTENT_SCHEMA_VERSION = 'route-bound-v1';

export interface CompatibleZoneContentReadState {
	unavailable: boolean;
	cooldownUntil?: number;
	inFlight?: Promise<unknown | null>;
}

export const ZONE_CONTENT_TRANSIENT_COOLDOWN_MS = 5_000;

/**
 * Fail closed before querying unless operators explicitly attest that the
 * pre-existing admin table has the route-bound v1 columns. Missing-table and
 * missing-column responses permanently disable reads for this process.
 */
export async function readCompatibleZoneContentRows<T>(input: {
	configuredSchemaVersion?: string;
	state: CompatibleZoneContentReadState;
	query: () => Promise<T>;
	now?: () => number;
	transientCooldownMs?: number;
	onTransientError?: (error: unknown) => void;
}): Promise<T | null> {
	if (input.configuredSchemaVersion !== TRUSTED_ZONE_CONTENT_SCHEMA_VERSION || input.state.unavailable) return null;
	const now = input.now?.() ?? Date.now();
	if ((input.state.cooldownUntil ?? 0) > now) return null;
	if (input.state.inFlight) return await input.state.inFlight as T | null;

	const operation: Promise<T | null> = (async () => {
		try {
			const value = await input.query();
			input.state.cooldownUntil = undefined;
			return value;
		} catch (error) {
			if (isUnavailableZoneStoreSchema(error)) {
				input.state.unavailable = true;
				return null;
			}
			input.state.cooldownUntil = (input.now?.() ?? Date.now())
				+ (input.transientCooldownMs ?? ZONE_CONTENT_TRANSIENT_COOLDOWN_MS);
			try { input.onTransientError?.(error); } catch { /* diagnostics cannot reopen authority */ }
			return null;
		}
	})();
	input.state.inFlight = operation;
	const value = await operation;
	if (input.state.inFlight === operation) input.state.inFlight = undefined;
	return value;
}

function isUnavailableZoneStoreSchema(error: unknown): boolean {
	if (typeof error !== 'object' || error === null) return false;
	const code = (error as { code?: string }).code;
	return code === '42P01' || code === '42703';
}
