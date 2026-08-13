/**
 * Server-only async variant of `resolveZone` that fetches admin-authored
 * content from `zone_content` (XLAYER-004 round-trip) before applying
 * the cascade.
 *
 * Lives under `$lib/server/` because the underlying `getZoneContent`
 * lookup hits Postgres. The pure-sync `resolveZone` stays in
 * `$lib/foundation/` so client components (e.g. checkout/+page.svelte)
 * can import it without pulling DB code into the browser bundle.
 *
 * Per-request fan-out is fine — `getZoneContent` has a 60s in-process
 * cache that absorbs duplicate lookups for the same (brand, zone).
 */

import { resolveZone, type ResolveZoneOpts, type ZoneResolution } from '$lib/foundation/resolve-zone';
import { parseZoneInstance, ZONES, type ZoneInstanceId } from '$lib/foundation/zones';
import { compileCompositionPolicy } from '$lib/foundation/composition-policy';
import { BEALLS_COMPOSITION_POLICY } from '$lib/brand/composition-policy';
import { getZoneContent } from './admin-overrides';

export async function resolveZoneAsync(opts: ResolveZoneOpts): Promise<ZoneResolution> {
	const parsed = parseZoneInstance(opts.zoneId);
	if (!parsed) throw new Error(`resolveZoneAsync: unknown zone instance "${opts.zoneId}"`);
	const policy = opts.policy ?? compileCompositionPolicy({
		organizationId: 'example-merchant',
		brandId: opts.brandId,
		surface: ZONES[parsed.family].surface,
		zoneId: parsed.family,
		registry: BEALLS_COMPOSITION_POLICY,
	});
	const policyOpts = { ...opts, policy };
	if (opts.adminContent !== undefined) {
		// Caller already supplied admin content (e.g., bulk pre-fetched).
		// Don't re-fetch; honor the explicit value.
		return resolveZone(policyOpts);
	}

	let admin: { zones: Record<ZoneInstanceId, unknown> } | undefined;
	try {
		const authored = await getZoneContent(opts.brandId, opts.zoneId);
		if (authored !== null && authored !== undefined) {
			admin = { zones: { [opts.zoneId]: authored } };
		}
	} catch {
		// Fail open — admin lookup failure should not break the page.
	}

	return resolveZone({ ...policyOpts, adminContent: admin });
}
