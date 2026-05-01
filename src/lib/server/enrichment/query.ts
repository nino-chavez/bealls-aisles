/**
 * Query enrichment data from Neon Postgres.
 * Used by page servers to merge persona-fit scores with BC product data.
 */

import { getDb } from '../db';
import type { PersonaFitScores } from './types';
import {
	scoreTagOverlap,
	type TagOverlapCandidate,
	type TagOverlapOpts,
	type TagOverlapResult,
} from './tag-overlap-score';

export type { TagOverlapResult, TagOverlapOpts, TagOverlapCandidate };

/**
 * In-process caches. Per ADR-008 Phase A/B: query once per process, reuse
 * for the lifetime of the function instance. Each Vercel deployment is
 * single-brand (BRAND_ID env-scoped), so a process-wide cache is
 * brand-scoped trivially.
 *
 * Bucket-keyed by `brandId` so a future multi-tenant DB doesn't quietly
 * leak data across brands; today the value is always the same per process.
 */
const tagVocabularyCache = new Map<string, { tags: string[]; cachedAt: number }>();
const TAG_VOCAB_TTL_MS = 1000 * 60 * 60; // 1 hour
const tagOverlapCache = new Map<string, { results: TagOverlapResult[]; cachedAt: number }>();
const TAG_OVERLAP_TTL_MS = 1000 * 60 * 60; // 1 hour — same as layout cache

export interface ProductEnrichment {
	bcEntityId: number;
	personaFit: PersonaFitScores;
	semanticTags: string[];
	compatibleWith: string[];
	priceTier: string | null;
	style: string | null;
	material: string | null;
}

/**
 * Fetch enrichment data for a list of BC entity IDs.
 * Returns a Map for O(1) lookup when merging with product data.
 */
export async function getEnrichmentByEntityIds(entityIds: number[]): Promise<Map<number, ProductEnrichment>> {
	if (entityIds.length === 0) return new Map();

	try {
		const sql = getDb();
		const rows = await sql`
			SELECT
				bc_entity_id,
				fit_gatherer, fit_hunter, fit_researcher, fit_gifter,
				semantic_tags, compatible_with, price_tier, style, material
			FROM enriched_products
			WHERE bc_entity_id = ANY(${entityIds})
		`;

		const map = new Map<number, ProductEnrichment>();
		for (const row of rows) {
			map.set(row.bc_entity_id as number, {
				bcEntityId: row.bc_entity_id as number,
				personaFit: {
					gatherer: row.fit_gatherer as number,
					hunter: row.fit_hunter as number,
					researcher: row.fit_researcher as number,
					gifter: row.fit_gifter as number,
				},
				semanticTags: (row.semantic_tags as string[]) || [],
				compatibleWith: (row.compatible_with as string[]) || [],
				priceTier: row.price_tier as string | null,
				style: row.style as string | null,
				material: row.material as string | null,
			});
		}
		return map;
	} catch (err) {
		console.warn('[enrichment] Failed to fetch enrichment data:', err);
		return new Map();
	}
}

/**
 * Return the brand's distinct semantic-tag vocabulary — the union of every
 * tag assigned by enrichment to this brand's catalog.
 *
 * Used by ADR-008 Phase A as a constraint on refinement-chat tag-intent
 * extraction: the AI may only return tags from this set, never a hallucinated
 * tag. Empty set is a valid (cold) state — caller should fall back to
 * persona-only behavior.
 *
 * Cached in-process for TAG_VOCAB_TTL_MS. Pass `force=true` to bypass.
 */
export async function getBrandTagVocabulary(brandId: string, force = false): Promise<string[]> {
	const cached = tagVocabularyCache.get(brandId);
	if (!force && cached && Date.now() - cached.cachedAt < TAG_VOCAB_TTL_MS) {
		return cached.tags;
	}

	try {
		const sql = getDb();
		// Order by frequency descending so the prompt's top-N cap shows the
		// most representative tags first. The brand's enrichment vocabulary
		// can grow to thousands of long-tail entries; without frequency
		// ordering, an alphabetical top-N skips common labels like
		// "casual wear" or "resort wear" in favor of long-tail noise.
		const rows = await sql`
			SELECT tag, count(*) AS freq
			FROM (SELECT unnest(semantic_tags) AS tag FROM enriched_products) t
			WHERE tag IS NOT NULL AND length(tag) > 0
			GROUP BY tag
			ORDER BY freq DESC, tag ASC
		`;
		const tags = rows.map((r) => String(r.tag)).filter(Boolean);
		tagVocabularyCache.set(brandId, { tags, cachedAt: Date.now() });
		return tags;
	} catch (err) {
		console.warn('[enrichment] Failed to load tag vocabulary:', err);
		return cached?.tags ?? [];
	}
}

/**
 * Find products in the brand's catalog whose semantic-tag set overlaps
 * with the seed product's. Ranked by Jaccard similarity desc, then by
 * persona-fit of the seed's primary persona as secondary sort.
 *
 * Cold-start safe: a seed with zero tags returns []. A seed whose
 * neighbourhood has fewer than `minOverlap` matches returns whatever
 * is available, never throws.
 *
 * Brand-scoped: each Vercel deployment is single-brand at the DB level
 * (BRAND_ID env → dedicated Neon DB), so brand-scoping is implicit.
 * `brandId` participates in the cache key for safety against future
 * multi-tenant DBs.
 *
 * Defaults: `minOverlap=2`, `limit=8`, `excludeEntityIds=[]`.
 */
export async function getProductsByTagOverlap(
	brandId: string,
	seedEntityId: number,
	opts: TagOverlapOpts = {},
): Promise<TagOverlapResult[]> {
	const minOverlap = opts.minOverlap ?? 2;
	const limit = opts.limit ?? 8;
	const excludeEntityIds = opts.excludeEntityIds ?? [];

	const cacheKey = [
		brandId,
		seedEntityId,
		minOverlap,
		limit,
		[...excludeEntityIds].sort((a, b) => a - b).join(','),
	].join('|');
	const cached = tagOverlapCache.get(cacheKey);
	if (cached && Date.now() - cached.cachedAt < TAG_OVERLAP_TTL_MS) {
		return cached.results;
	}

	try {
		const sql = getDb();

		// Fetch seed enrichment first — needed to compute Jaccard and to
		// determine the seed's primary persona for secondary sort.
		const seedRows = await sql`
			SELECT semantic_tags,
			       fit_gatherer, fit_hunter, fit_researcher, fit_gifter
			FROM enriched_products
			WHERE bc_entity_id = ${seedEntityId}
			LIMIT 1
		`;
		if (seedRows.length === 0) {
			tagOverlapCache.set(cacheKey, { results: [], cachedAt: Date.now() });
			return [];
		}
		const seedTags = ((seedRows[0].semantic_tags as string[]) ?? []).filter(Boolean);
		if (seedTags.length === 0) {
			// Cold-start: seed has no tags. Return empty rather than guessing.
			tagOverlapCache.set(cacheKey, { results: [], cachedAt: Date.now() });
			return [];
		}

		const seedFit: PersonaFitScores = {
			gatherer: seedRows[0].fit_gatherer as number,
			hunter: seedRows[0].fit_hunter as number,
			researcher: seedRows[0].fit_researcher as number,
			gifter: seedRows[0].fit_gifter as number,
		};

		// Pre-filter via the GIN index on semantic_tags: candidates share
		// at least one tag with the seed. Jaccard + secondary-sort math
		// is delegated to the pure scorer in `tag-overlap-score.ts` so the
		// test seam exercises the same code path without touching the DB.
		const allExcluded = [seedEntityId, ...excludeEntityIds];
		const rows = await sql`
			SELECT bc_entity_id, semantic_tags,
			       fit_gatherer, fit_hunter, fit_researcher, fit_gifter
			FROM enriched_products
			WHERE semantic_tags && ${seedTags}::text[]
			  AND bc_entity_id <> ALL(${allExcluded}::int[])
		`;

		const candidates: TagOverlapCandidate[] = rows.map((row) => ({
			bcEntityId: row.bc_entity_id as number,
			semanticTags: (row.semantic_tags as string[]) ?? [],
			personaFit: {
				gatherer: row.fit_gatherer as number,
				hunter: row.fit_hunter as number,
				researcher: row.fit_researcher as number,
				gifter: row.fit_gifter as number,
			},
		}));

		const results = scoreTagOverlap(seedTags, seedFit, candidates, opts);
		tagOverlapCache.set(cacheKey, { results, cachedAt: Date.now() });
		return results;
	} catch (err) {
		console.warn('[enrichment] Failed to compute tag-overlap neighborhood:', err);
		return cached?.results ?? [];
	}
}

/**
 * Test seam: clear in-process tag-overlap cache. Used by
 * `getProductsByTagOverlap.test.ts` to assert cache hit/miss behavior
 * without juggling TTLs. Not for production callers.
 */
export function _resetTagOverlapCacheForTest(): void {
	tagOverlapCache.clear();
}
