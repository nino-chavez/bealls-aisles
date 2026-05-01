/**
 * Tag-overlap product rerank — ADR-008 Phase A.
 *
 * Pure function over an enriched product list. Lives in its own module so
 * the unit test can import it without pulling in catalog.ts's BigCommerce
 * + Neon + SvelteKit-env transitive imports.
 */

export interface RerankProduct {
	personaFit: { gatherer: number; hunter: number; researcher: number; gifter: number } | null;
	semanticTags: string[];
}

/**
 * Filter + rerank an enriched product list by tag-overlap (primary) and
 * persona-fit (secondary). When `tagIntents` is empty/undefined, returns
 * the persona-only ranking (Q-012 fallback). When `tagIntents` is non-empty:
 *
 * 1. Drop products that share zero tags with the intent set.
 * 2. Sort by descending overlap count (intersection size).
 * 3. Tie-break by descending persona-fit for the requested persona.
 *
 * Tag matching is case-insensitive. Products with no enrichment tags are
 * dropped from the tag-filtered set (they can't match), but kept under the
 * persona-only fallback.
 */
export function rankByTagAndPersona<T extends RerankProduct>(
	products: T[],
	persona?: string,
	tagIntents?: string[],
): T[] {
	const fitOf = (p: T): number => {
		if (!persona || !p.personaFit) return 0.5;
		const fit = p.personaFit as Record<string, number>;
		return fit[persona] ?? 0.5;
	};

	if (!tagIntents || tagIntents.length === 0) {
		const sorted = [...products];
		if (persona) sorted.sort((a, b) => fitOf(b) - fitOf(a));
		return sorted;
	}

	const intentLower = new Set(tagIntents.map((t) => t.toLowerCase()));
	const overlapOf = (p: T): number => {
		if (!p.semanticTags || p.semanticTags.length === 0) return 0;
		let n = 0;
		for (const t of p.semanticTags) {
			if (intentLower.has(t.toLowerCase())) n++;
		}
		return n;
	};

	return products
		.map((p) => ({ p, overlap: overlapOf(p) }))
		.filter((x) => x.overlap > 0)
		.sort((a, b) => {
			if (b.overlap !== a.overlap) return b.overlap - a.overlap;
			return fitOf(b.p) - fitOf(a.p);
		})
		.map((x) => x.p);
}
