import { resolveZone, type ResolveZoneOpts, type ZoneResolution } from '$lib/foundation/resolve-zone';
import { parseZoneInstance, ZONES } from '$lib/foundation/zones';
import { getZoneContent } from './admin-overrides';

/**
 * Resolve a zone with a merchant record that is bound to the same trusted
 * route/policy envelope. Database errors and legacy unbound rows fail closed
 * to the static fallback; they never become merchant authority.
 */
export async function resolveZoneAsync(opts: ResolveZoneOpts): Promise<ZoneResolution> {
	const parsed = parseZoneInstance(opts.zoneId);
	if (!parsed) throw new Error(`resolveZoneAsync: unknown zone instance "${opts.zoneId}"`);

	if (opts.adminRecord !== undefined) return resolveZone(opts);

	let adminRecord = null;
	try {
		adminRecord = await getZoneContent({
			organizationId: opts.policy.provenance.organizationId,
			brandId: opts.brandId,
			routePath: opts.routePath,
			surface: ZONES[parsed.family].surface,
			zoneId: opts.zoneId,
			policyVersion: opts.policy.policyVersion,
			referenceState: opts.policy.provenance.referenceState,
			referenceId: null,
			referenceVersion: null,
		});
	} catch {
		adminRecord = null;
	}

	return resolveZone({ ...opts, adminRecord });
}
