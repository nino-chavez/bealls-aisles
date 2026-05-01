/**
 * Storefront-side reads for the admin app's authored data.
 *
 * Three round-trips the demo needs:
 *
 *   1. Brand voice override   — admin/BrandVoiceTab → brand_overrides
 *      Storefront prompt construction picks this up ahead of brand-config
 *      voiceGuidance, so a brand manager edits voice in admin and the next
 *      AI generation reflects it (no code deploy).
 *
 *   2. Zone content           — admin/ContentAuthoringTab → zone_content
 *      The three-source resolver cascade (engine → admin → fallback) reads
 *      authored content here. Admin authors content for a zone; when the
 *      engine doesn't compose into that zone, the storefront falls through
 *      to the authored entry instead of the static fallback.
 *
 *   3. Persona-fit overrides  — admin/PersonaFitTab → persona_fit_overrides
 *      Catalog ranker layers per-product overrides on top of the
 *      enrichment-computed persona fit so a merchandiser can pin a product
 *      to "always rank top for hunter."
 *
 * Tables are created lazily by the admin app's API handlers; if the
 * storefront queries them before they exist (e.g. fresh deploy, admin
 * never opened), the queries return null gracefully. We don't try to
 * create them from the storefront — that's the admin's responsibility.
 *
 * Caching strategy: a tiny per-process Map with 60s TTL. Vercel lambdas
 * don't share memory but do reuse instances (Fluid Compute), so the cache
 * absorbs duplicate reads on a hot lambda. Crucially we *fail open* on
 * cache miss + DB error — empty override is the same as "no override
 * authored," which is the correct default behavior.
 */

import { getDb } from './db';
import { isCachingDisabledGlobally } from './cache-flags';

const TTL_MS = 60 * 1000;

interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

const voiceCache = new Map<string, CacheEntry<BrandVoiceOverride | null>>();
const zoneCache = new Map<string, CacheEntry<unknown | null>>();
const personaFitCache = new Map<string, CacheEntry<Map<string, PersonaFitOverride>>>();

let voiceTableMissing = false;
let zoneTableMissing = false;
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
 * Returns admin-authored content for a (brand, zone) pair, or null if none.
 * Only published entries are returned; drafts are admin-side only.
 */
export async function getZoneContent(brandId: string, zoneId: string): Promise<unknown | null> {
	if (zoneTableMissing) return null;

	const key = `${brandId}|${zoneId}`;
	if (!isCachingDisabledGlobally()) {
		const cached = zoneCache.get(key);
		if (cached && cached.expiresAt > Date.now()) return cached.value;
	}

	try {
		const sql = getDb();
		const rows = await sql`
			SELECT content FROM zone_content
			WHERE brand_id = ${brandId} AND zone_id = ${zoneId} AND published = true
			LIMIT 1
		`;
		const value = rows.length > 0 ? (rows[0].content as unknown) : null;
		zoneCache.set(key, { value, expiresAt: Date.now() + TTL_MS });
		return value;
	} catch (err) {
		if (isUndefinedTable(err)) zoneTableMissing = true;
		else console.warn('[admin-overrides] zone content fetch failed:', errMsg(err));
		return null;
	}
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
