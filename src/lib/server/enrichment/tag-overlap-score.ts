/**
 * Tag-overlap scorer — ADR-008 Phase B (PRD-ENG-019).
 *
 * Pure function over a candidate set; lives in its own module so the
 * unit test can import without pulling in `$env`-dependent DB code.
 * The DB-bound `getProductsByTagOverlap` (in `./query.ts`) wraps this
 * scorer behind the SQL pre-filter — same Jaccard + secondary-sort math.
 *
 * `sharedTags` is exposed on every result so the Decisions Inspector
 * can render "shown because tags X, Y, Z overlap" verbatim — the
 * explainability commitment from ADR-008
 * §"Decisions Inspector explainability sharpens".
 */

import type { PersonaFitScores } from './types';

export interface TagOverlapResult {
	bcEntityId: number;
	overlapScore: number; // Jaccard similarity, 0..1
	sharedTags: string[];
	semanticTags: string[];
	personaFit: PersonaFitScores;
}

export interface TagOverlapOpts {
	minOverlap?: number;
	limit?: number;
	excludeEntityIds?: number[];
}

export interface TagOverlapCandidate {
	bcEntityId: number;
	semanticTags: string[];
	personaFit: PersonaFitScores;
}

/**
 * Rank candidates by Jaccard similarity to the seed's tag set, with
 * persona-fit of the seed's primary persona as secondary sort.
 *
 * Cold-start safe: empty `seedTags` returns []. Sparse neighborhood
 * (fewer than `minOverlap` matches) returns whatever qualifies.
 *
 * Defaults: `minOverlap=2`, `limit=8`, `excludeEntityIds=[]`.
 */
export function scoreTagOverlap(
	seedTags: string[],
	seedFit: PersonaFitScores,
	candidates: TagOverlapCandidate[],
	opts: TagOverlapOpts = {},
): TagOverlapResult[] {
	const minOverlap = opts.minOverlap ?? 2;
	const limit = opts.limit ?? 8;
	const excludeEntityIds = new Set(opts.excludeEntityIds ?? []);

	if (seedTags.length === 0) return [];

	const primaryPersona = (Object.entries(seedFit) as Array<[keyof PersonaFitScores, number]>)
		.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];

	const seedTagSet = new Set(seedTags);
	const scored: TagOverlapResult[] = [];
	for (const c of candidates) {
		if (excludeEntityIds.has(c.bcEntityId)) continue;
		const rowTags = c.semanticTags.filter(Boolean);
		if (rowTags.length === 0) continue;
		const shared: string[] = [];
		for (const t of rowTags) if (seedTagSet.has(t)) shared.push(t);
		if (shared.length < minOverlap) continue;
		const unionSize = seedTagSet.size + rowTags.length - shared.length;
		const overlapScore = unionSize > 0 ? shared.length / unionSize : 0;
		scored.push({
			bcEntityId: c.bcEntityId,
			overlapScore,
			sharedTags: shared,
			semanticTags: rowTags,
			personaFit: c.personaFit,
		});
	}

	scored.sort((a, b) => {
		if (b.overlapScore !== a.overlapScore) return b.overlapScore - a.overlapScore;
		return (b.personaFit[primaryPersona] ?? 0) - (a.personaFit[primaryPersona] ?? 0);
	});
	return scored.slice(0, limit);
}
