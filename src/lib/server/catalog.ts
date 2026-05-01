/**
 * Catalog utilities shared between page servers and API endpoints.
 *
 * Handles the category slug → BC category mapping, product transformation,
 * and enrichment merging. This is the single source of truth for how
 * raw BC data becomes the product shape that layout generation consumes.
 */

import {
	getCategories,
	getProductsByCategory,
	getProducts,
	getProductsByEntityIds,
	customFieldsToRecord,
	type BCProduct,
} from './bigcommerce';
import { getEnrichmentByEntityIds, getProductsByTagOverlap, type TagOverlapOpts, type TagOverlapResult } from './enrichment/query';
import { rankByTagAndPersona } from './tag-rerank';
import { getPersonaFitOverridesForBrand, type PersonaFitOverride } from './admin-overrides';
import { getBrand, getBrandMode } from '$lib/brand/config';
import type { Product } from '$lib/types';

// Re-export so existing callers / tests can keep importing from catalog.
export { rankByTagAndPersona };

/** Category map — driven by the active brand config */
export const CATEGORY_MAP: Record<string, { bcName: string; displayName: string }> = getBrand().categories;

export interface EnrichedProduct extends Product {
	personaFit: { gatherer: number; hunter: number; researcher: number; gifter: number } | null;
	semanticTags: string[];
}

/**
 * Apply admin-authored persona-fit overrides on top of enrichment-computed
 * scores (PRD-ADM-006). For each product with an override, replace any
 * provided persona scores; missing personas keep their enrichment value.
 *
 * Bulk-fetches the override map once per call so a 30-product grid pays
 * one DB query instead of 30. The map has a 60s in-process cache.
 */
async function applyPersonaFitOverrides(products: EnrichedProduct[]): Promise<EnrichedProduct[]> {
	const brandId = getBrand().id;
	const overrides = await getPersonaFitOverridesForBrand(brandId);
	if (overrides.size === 0) return products;
	return products.map((p) => {
		const override = overrides.get(p.id);
		if (!override) return p;
		const merged = mergePersonaFit(p.personaFit, override);
		return { ...p, personaFit: merged };
	});
}

function mergePersonaFit(
	base: EnrichedProduct['personaFit'],
	override: PersonaFitOverride,
): EnrichedProduct['personaFit'] {
	const baseScores = base ?? { gatherer: 0.5, hunter: 0.5, researcher: 0.5, gifter: 0.5 };
	return {
		gatherer: override.gatherer ?? baseScores.gatherer,
		hunter: override.hunter ?? baseScores.hunter,
		researcher: override.researcher ?? baseScores.researcher,
		gifter: override.gifter ?? baseScores.gifter,
	};
}

/**
 * Tag-overlap product — `EnrichedProduct` plus the explainability fields
 * surfaced by the neighborhood query. `sharedTags` and `overlapScore` are
 * the contract from ADR-008 §"Decisions Inspector explainability sharpens"
 * — the Inspector renders "shown because tags X, Y, Z overlap" verbatim.
 */
export interface TagOverlapProduct extends EnrichedProduct {
	overlapScore: number;
	sharedTags: string[];
}

/**
 * Load products for a category slug, merged with enrichment data.
 * Sorted by persona-fit for the given persona.
 *
 * When `tagIntents` is non-empty (ADR-008 Phase A), products with at least
 * one matching semantic tag are filtered in and ranked by tag-overlap count
 * (most matches first), persona-fit secondary. Empty/undefined `tagIntents`
 * preserves the persona-only behavior (Q-012 fallback).
 *
 * Returns null if the category doesn't exist.
 */
export async function loadCategoryProducts(
	categorySlug: string,
	persona?: string,
	tagIntents?: string[],
): Promise<{ products: EnrichedProduct[]; categoryName: string } | null> {
	const catConfig = CATEGORY_MAP[categorySlug];
	if (!catConfig) return null;

	const categories = await getCategories();
	const bcCategory = categories.find((c) => c.name === catConfig.bcName);
	if (!bcCategory) return null;

	const { products: bcProducts } = await getProductsByCategory(bcCategory.entityId);
	const products = bcProducts.map(transformProduct);

	// Fetch enrichment in parallel (non-blocking — returns empty map on failure)
	const enrichmentMap = await getEnrichmentByEntityIds(products.map((p) => p.entityId));

	// Merge enrichment
	const enrichedProducts: EnrichedProduct[] = products.map((p) => {
		const enrichment = enrichmentMap.get(p.entityId);
		return {
			...p,
			personaFit: enrichment?.personaFit ?? null,
			semanticTags: enrichment?.semanticTags ?? [],
		};
	});

	const overridden = await applyPersonaFitOverrides(enrichedProducts);
	const ranked = rankByTagAndPersona(overridden, persona, tagIntents);
	return { products: ranked, categoryName: catConfig.displayName };
}

/**
 * Load products for the homepage — a curated cross-category set sorted by
 * persona-fit. Used by the AI layout for the "home" virtual category.
 *
 * Pulls top N from BC's global product query (default 30 — large enough that
 * the AI has variety, small enough to stay in the prompt's MAX_LAYOUT_PRODUCTS=15
 * window after persona-fit ranking).
 *
 * `tagIntents` (ADR-008 Phase A): when non-empty, filter+rerank by tag overlap
 * before persona-fit secondary. Empty/undefined preserves persona-only behavior.
 */
export async function loadHomeProducts(
	persona?: string,
	limit = 30,
	tagIntents?: string[],
): Promise<{ products: EnrichedProduct[]; categoryName: string }> {
	// Content-mode brands have no online catalog — AI generates from
	// content-mode component subset with empty products.
	if (getBrandMode(getBrand()) === 'content') {
		return { products: [], categoryName: 'Home' };
	}

	const bcProducts = await getProducts(limit);
	const products = bcProducts.map(transformProduct);

	const enrichmentMap = await getEnrichmentByEntityIds(products.map((p) => p.entityId));

	const enrichedProducts: EnrichedProduct[] = products.map((p) => {
		const enrichment = enrichmentMap.get(p.entityId);
		return {
			...p,
			personaFit: enrichment?.personaFit ?? null,
			semanticTags: enrichment?.semanticTags ?? [],
		};
	});

	const overridden = await applyPersonaFitOverrides(enrichedProducts);
	const ranked = rankByTagAndPersona(overridden, persona, tagIntents);
	return { products: ranked, categoryName: 'Home' };
}


/**
 * Resolve a tag-overlap neighborhood to fully-hydrated products (PRD-ENG-019).
 *
 * Calls `getProductsByTagOverlap` for the seed, then bulk-fetches BC product
 * data for the matching entityIds. Returns ordered (highest Jaccard first)
 * products with `overlapScore` + `sharedTags` exposed for the Decisions
 * Inspector — the explainability commitment from ADR-008.
 *
 * Cold-start safe: a seed with zero tags or fewer than `minOverlap` matches
 * returns whatever the neighborhood yields (possibly empty), never throws.
 */
export async function loadProductsByTagOverlap(
	seedEntityId: number,
	opts: TagOverlapOpts = {},
): Promise<TagOverlapProduct[]> {
	const brandId = getBrand().id;
	const matches: TagOverlapResult[] = await getProductsByTagOverlap(brandId, seedEntityId, opts);
	if (matches.length === 0) return [];

	// Bulk-fetch BC product data for the matched entityIds in one round-trip.
	// BC silently drops missing IDs, so a stale enrichment row that no longer
	// has a corresponding BC product simply doesn't appear in the result.
	const bcProducts = await getProductsByEntityIds(matches.map((m) => m.bcEntityId));
	const bcByEntity = new Map(bcProducts.map((p) => [p.entityId, p]));

	const out: TagOverlapProduct[] = [];
	for (const m of matches) {
		const bc = bcByEntity.get(m.bcEntityId);
		if (!bc) continue;
		const transformed = transformProduct(bc);
		out.push({
			...transformed,
			personaFit: m.personaFit,
			semanticTags: m.semanticTags,
			overlapScore: m.overlapScore,
			sharedTags: m.sharedTags,
		});
	}
	return out;
}

/**
 * Aggregate tag-overlap neighborhoods across multiple seeds (cart upsell —
 * PRD-ENG-019). For each seed, fetch the neighborhood; combine, dedupe by
 * entityId (keeping the highest overlapScore), drop seeds themselves and
 * any explicitly excluded entityIds, and return ordered.
 *
 * Used by `cart.cross-sell` / `last-chance-upsell-row`: each cart line
 * item is a seed; the union of their neighborhoods is the candidate set
 * for the AI composer.
 */
export async function loadProductsByTagOverlapAggregate(
	seedEntityIds: number[],
	opts: TagOverlapOpts = {},
): Promise<TagOverlapProduct[]> {
	if (seedEntityIds.length === 0) return [];
	const brandId = getBrand().id;
	const exclude = new Set([...(opts.excludeEntityIds ?? []), ...seedEntityIds]);

	const perSeed = await Promise.all(
		seedEntityIds.map((id) =>
			getProductsByTagOverlap(brandId, id, {
				minOverlap: opts.minOverlap ?? 2,
				limit: opts.limit ?? 8,
				excludeEntityIds: [...exclude],
			}),
		),
	);

	// Dedupe across seeds: keep the highest overlapScore per candidate.
	const merged = new Map<number, TagOverlapResult>();
	for (const list of perSeed) {
		for (const m of list) {
			const prior = merged.get(m.bcEntityId);
			if (!prior || m.overlapScore > prior.overlapScore) merged.set(m.bcEntityId, m);
		}
	}
	const ranked = [...merged.values()]
		.sort((a, b) => b.overlapScore - a.overlapScore)
		.slice(0, opts.limit ?? 8);
	if (ranked.length === 0) return [];

	const bcProducts = await getProductsByEntityIds(ranked.map((m) => m.bcEntityId));
	const bcByEntity = new Map(bcProducts.map((p) => [p.entityId, p]));

	const out: TagOverlapProduct[] = [];
	for (const m of ranked) {
		const bc = bcByEntity.get(m.bcEntityId);
		if (!bc) continue;
		const transformed = transformProduct(bc);
		out.push({
			...transformed,
			personaFit: m.personaFit,
			semanticTags: m.semanticTags,
			overlapScore: m.overlapScore,
			sharedTags: m.sharedTags,
		});
	}
	return out;
}

/** Transform a BC product into the shape our layout components expect */
function transformProduct(p: BCProduct): Product {
	const specs = customFieldsToRecord(p);

	return {
		id: p.path.replace(/^\/|\/$/g, '') || String(p.entityId),
		entityId: p.entityId,
		name: p.name,
		price: p.prices.price.value,
		salePrice: p.prices.salePrice?.value || undefined,
		image: p.defaultImage?.url || '',
		imageAlt: p.defaultImage?.altText || p.name,
		description: stripHtml(p.description),
		specs,
		tags: Object.values(specs).slice(0, 3),
		category: p.categories.edges[0]?.node.name || '',
	};
}

function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, '').trim();
}
