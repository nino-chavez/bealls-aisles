/**
 * Storefront-side reads for the admin app's authored data.
 *
 * Three narrowly scoped admin-side readers:
 *
 *   1. Brand voice override   — admin/BrandVoiceTab → brand_overrides
 *      Retained for explicit operator/offline tooling. No current shopper
 *      model path consumes it.
 *
 *   2. Zone content           — optional, separately provisioned zone_content
 *      The resolver can consume a route-bound merchant record, but this repo
 *      ships neither the compatible table migration nor a write path. Reads
 *      remain disabled unless the operator explicitly enables the supported
 *      schema version. Legacy brand+zone records never become authority.
 *
 *   3. Persona-fit overrides  — admin/PersonaFitTab → persona_fit_overrides
 *      Catalog ranker layers per-product overrides on top of the
 *      enrichment-computed persona fit so a merchandiser can pin a product
 *      to "always rank top for hunter."
 *
 * The voice and persona tables are created lazily by the admin app's API
 * handlers. The route-bound zone table is different: no compatible schema is
 * supplied by this repo, and storefront code never creates or writes it.
 *
 * Caching strategy: a tiny per-process Map with 60s TTL. Vercel lambdas
 * don't share memory but do reuse instances (Fluid Compute), so the cache
 * absorbs duplicate reads on a hot lambda. Voice/persona DB failures preserve
 * their current no-override behavior. Zone authority fails closed: an absent,
 * legacy, or incompatible schema cannot supply merchant content.
 */

import { getDb } from './db';
import { isCachingDisabledGlobally } from './cache-flags';
import type { TrustedMerchantZoneRecord } from '$lib/foundation/resolve-zone';
import { env } from '$env/dynamic/private';
import { readCompatibleZoneContentRows, TRUSTED_ZONE_CONTENT_SCHEMA_VERSION } from './zone-content-store-gate';
import { parseZoneInstance, type ZoneInstanceId } from '$lib/foundation/zones';

const TTL_MS = 60 * 1000;

interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

const voiceCache = new Map<string, CacheEntry<BrandVoiceOverride | null>>();
const zoneCache = new Map<string, CacheEntry<ReadonlyMap<string, TrustedMerchantZoneRecord>>>();
const personaFitCache = new Map<string, CacheEntry<Map<string, PersonaFitOverride>>>();

let voiceTableMissing = false;
let zoneStoreUnavailable = false;
const zoneStoreStates = new Map<string, { unavailable: boolean; cooldownUntil?: number; inFlight?: Promise<unknown | null> }>();
let personaFitTableMissing = false;

export interface BrandVoiceOverride {
	voiceGuidance: string | null;
	toneKeywords: string[];
	forbiddenTerms: string[];
}

export interface PersonaFitOverride {
	gatherer?: number;
	hunter?: number;
	researcher?: number;
	gifter?: number;
	reason?: string;
}

/** Returns the brand voice override for a brand, or null if none authored. */
export async function getBrandVoiceOverride(brandId: string): Promise<BrandVoiceOverride | null> {
	if (voiceTableMissing) return null;

	if (!isCachingDisabledGlobally()) {
		const cached = voiceCache.get(brandId);
		if (cached && cached.expiresAt > Date.now()) return cached.value;
	}

	try {
		const sql = getDb();
		const rows = await sql`
			SELECT voice_guidance, tone_keywords, forbidden_terms
			FROM brand_overrides
			WHERE brand_id = ${brandId}
			LIMIT 1
		`;
		const value = rows.length > 0
			? {
					voiceGuidance: (rows[0].voice_guidance as string | null) ?? null,
					toneKeywords: (rows[0].tone_keywords as string[] | null) ?? [],
					forbiddenTerms: (rows[0].forbidden_terms as string[] | null) ?? [],
				}
			: null;
		voiceCache.set(brandId, { value, expiresAt: Date.now() + TTL_MS });
		return value;
	} catch (err) {
		if (isUndefinedTable(err)) voiceTableMissing = true;
		else console.warn('[admin-overrides] brand voice fetch failed:', errMsg(err));
		return null;
	}
}

/**
 * Returns a merchant record only when its stored authority is bound to the
 * complete runtime decision context. Legacy `(brand_id, zone_id, content)`
 * rows are deliberately not authority and therefore cannot be returned.
 */
export interface RouteZoneContentBinding {
	organizationId: string;
	brandId: string;
	routePath: string;
	surface: string;
	policyVersion: string;
	referenceState: 'uncontracted';
	referenceId: string | null;
	referenceVersion: string | null;
}

/**
 * Bulk-read every expected zone for one trusted route in one store query.
 * Per-route single-flight and cooldown state prevent a transient failure from
 * multiplying into one retry per zone.
 */
export async function getRouteZoneContents(input: RouteZoneContentBinding & {
	zoneIds: readonly string[];
}): Promise<ReadonlyMap<string, TrustedMerchantZoneRecord>> {
	if (env.AISLES_ZONE_CONTENT_SCHEMA_VERSION !== TRUSTED_ZONE_CONTENT_SCHEMA_VERSION || zoneStoreUnavailable) return new Map();

	const key = [
		input.organizationId, input.brandId, input.routePath, input.surface,
		input.policyVersion, input.referenceState, input.referenceId ?? '', input.referenceVersion ?? '',
	].join('|');
	const expectedZoneIds = new Set(input.zoneIds);
	if (!isCachingDisabledGlobally()) {
		const cached = zoneCache.get(key);
		if (cached && cached.expiresAt > Date.now()) return selectExpectedZoneRecords(cached.value, expectedZoneIds);
	}
	const state = zoneStoreStates.get(key) ?? { unavailable: false };
	zoneStoreStates.set(key, state);

	const rows = await readCompatibleZoneContentRows({
		configuredSchemaVersion: env.AISLES_ZONE_CONTENT_SCHEMA_VERSION,
		state,
		query: async () => {
			const sql = getDb();
			return sql`
				SELECT
					content, content_version, merchant_authority,
					organization_id, brand_id, route_path, surface, zone_id,
					policy_version, reference_state, reference_id, reference_version
				FROM zone_content
				WHERE organization_id = ${input.organizationId}
					AND brand_id = ${input.brandId}
					AND route_path = ${input.routePath}
					AND surface = ${input.surface}
					AND policy_version = ${input.policyVersion}
					AND reference_state = ${input.referenceState}
					AND reference_id IS NOT DISTINCT FROM ${input.referenceId}
					AND reference_version IS NOT DISTINCT FROM ${input.referenceVersion}
					AND published = true
				LIMIT 64
			`;
		},
		onTransientError: (error) => console.warn('[admin-overrides] route zone content fetch failed:', errMsg(error)),
	});
	if (state.unavailable) zoneStoreUnavailable = true;
	if (rows === null) return new Map();

	const value = new Map<string, TrustedMerchantZoneRecord>();
	for (const row of rows) {
		const zoneId = String(row.zone_id);
		const authority = row.merchant_authority;
		if (!parseZoneInstance(zoneId)
			|| (authority !== 'authored' && authority !== 'pin' && authority !== 'lock')
			|| String(row.organization_id) !== input.organizationId
			|| String(row.brand_id) !== input.brandId
			|| String(row.route_path) !== input.routePath
			|| String(row.surface) !== input.surface
			|| String(row.policy_version) !== input.policyVersion
			|| String(row.reference_state) !== input.referenceState
			|| (row.reference_id == null ? null : String(row.reference_id)) !== input.referenceId
			|| (row.reference_version == null ? null : String(row.reference_version)) !== input.referenceVersion) continue;
		value.set(zoneId, {
			authority,
			contentVersion: String(row.content_version ?? ''),
			content: row.content,
			binding: {
				organizationId: String(row.organization_id),
				brandId: String(row.brand_id),
				routePath: String(row.route_path),
				surface: String(row.surface),
				zoneId: zoneId as ZoneInstanceId,
				policyVersion: String(row.policy_version),
				referenceState: 'uncontracted',
				referenceId: row.reference_id == null ? null : String(row.reference_id),
				referenceVersion: row.reference_version == null ? null : String(row.reference_version),
			},
		});
	}
	zoneCache.set(key, { value, expiresAt: Date.now() + TTL_MS });
	return selectExpectedZoneRecords(value, expectedZoneIds);
}

function selectExpectedZoneRecords(
	records: ReadonlyMap<string, TrustedMerchantZoneRecord>,
	expected: ReadonlySet<string>,
): ReadonlyMap<string, TrustedMerchantZoneRecord> {
	return new Map([...records].filter(([zoneId]) => expected.has(zoneId)));
}

/**
 * Returns the full set of persona-fit overrides for a brand, keyed by
 * productId. Bulk-fetched once per brand so the catalog ranker can apply
 * overrides to many products without N round-trips.
 */
export async function getPersonaFitOverridesForBrand(
	brandId: string,
): Promise<Map<string, PersonaFitOverride>> {
	if (personaFitTableMissing) return new Map();

	if (!isCachingDisabledGlobally()) {
		const cached = personaFitCache.get(brandId);
		if (cached && cached.expiresAt > Date.now()) return cached.value;
	}

	try {
		const sql = getDb();
		const rows = await sql`
			SELECT product_id, overrides, reason
			FROM persona_fit_overrides
			WHERE brand_id = ${brandId}
		`;
		const map = new Map<string, PersonaFitOverride>();
		for (const r of rows) {
			const overrides = (r.overrides as PersonaFitOverride | null) ?? {};
			const reason = (r.reason as string | null) ?? undefined;
			map.set(r.product_id as string, { ...overrides, ...(reason ? { reason } : {}) });
		}
		personaFitCache.set(brandId, { value: map, expiresAt: Date.now() + TTL_MS });
		return map;
	} catch (err) {
		if (isUndefinedTable(err)) personaFitTableMissing = true;
		else console.warn('[admin-overrides] persona-fit fetch failed:', errMsg(err));
		return new Map();
	}
}

function isUndefinedTable(err: unknown): boolean {
	return typeof err === 'object' && err !== null && (err as { code?: string }).code === '42P01';
}

function errMsg(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
