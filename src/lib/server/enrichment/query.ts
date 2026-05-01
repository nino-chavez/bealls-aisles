/**
 * Query enrichment data from Neon Postgres.
 * Used by page servers to merge persona-fit scores with BC product data.
 */

import { getDb } from '../db';
import type { PersonaFitScores } from './types';

/**
 * In-process vocabulary cache. Per ADR-008 Phase A: query once per process,
 * reuse for the lifetime of the function instance. Each Vercel deployment
 * is single-brand (BRAND_ID env-scoped), so a process-wide cache is
 * brand-scoped trivially.
 *
 * Bucket-keyed by `brandId` so a future multi-tenant DB doesn't quietly
 * leak vocab across brands; today the value is always the same per process.
 */
const tagVocabularyCache = new Map<string, { tags: string[]; cachedAt: number }>();
const TAG_VOCAB_TTL_MS = 1000 * 60 * 60; // 1 hour

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
