/**
 * Product search with semantic tag matching.
 *
 * Phase 3a: Postgres full-text search against enrichment data
 * (semantic tags, material, style, use case). Significantly better
 * than keyword matching against BC product names.
 *
 * Phase 3b: when embeddings are available, upgrades to pgvector
 * cosine similarity search. The interface stays the same.
 */

import { getDb } from './db';

export interface SearchResult {
	bcEntityId: number;
	bcProductPath: string;
	relevanceScore: number;
	personaFit: {
		gatherer: number;
		hunter: number;
		researcher: number;
		gifter: number;
	};
	semanticTags: string[];
	priceTier: string | null;
}

/**
 * Search products using enrichment data.
 * Matches against semantic tags, material, style, and use case.
 * Returns results ranked by relevance.
 */
export async function searchProducts(query: string, limit = 20): Promise<SearchResult[]> {
	try {
		const sql = getDb();

		// Convert query to tsquery-compatible format
		// "dorm room desk" → "dorm & room & desk"
		const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
		if (terms.length === 0) return [];

		// Search across semantic tags (array), material, style, use_case, and product path
		// Use ILIKE for flexible matching since semantic tags are short phrases
		const likePatterns = terms.map((t) => `%${t}%`);

		const rows = await sql`
			SELECT
				bc_entity_id,
				bc_product_path,
				fit_gatherer, fit_hunter, fit_researcher, fit_gifter,
				semantic_tags,
				price_tier,
				(
					-- Score: count how many query terms match across all searchable fields
					${sql`(
						SELECT COUNT(*)::int FROM unnest(${likePatterns}::text[]) AS term
						WHERE
							bc_product_path ILIKE term
							OR material ILIKE term
							OR style ILIKE term
							OR use_case ILIKE term
							OR EXISTS (
								SELECT 1 FROM unnest(semantic_tags) AS tag WHERE tag ILIKE term
							)
					)`}
				) as match_count
			FROM enriched_products
			WHERE (
				-- At least one term must match something
				${sql`EXISTS (
					SELECT 1 FROM unnest(${likePatterns}::text[]) AS term
					WHERE
						bc_product_path ILIKE term
						OR material ILIKE term
						OR style ILIKE term
						OR use_case ILIKE term
						OR EXISTS (
							SELECT 1 FROM unnest(semantic_tags) AS tag WHERE tag ILIKE term
						)
				)`}
			)
			ORDER BY match_count DESC, bc_entity_id
			LIMIT ${limit}
		`;

		return rows.map((r) => ({
			bcEntityId: r.bc_entity_id as number,
			bcProductPath: r.bc_product_path as string,
			relevanceScore: (r.match_count as number) / terms.length,
			personaFit: {
				gatherer: r.fit_gatherer as number,
				hunter: r.fit_hunter as number,
				researcher: r.fit_researcher as number,
				gifter: r.fit_gifter as number,
			},
			semanticTags: (r.semantic_tags as string[]) || [],
			priceTier: r.price_tier as string | null,
		}));
	} catch (err) {
		console.warn('[search] Enriched search failed:', err);
		return [];
	}
}
