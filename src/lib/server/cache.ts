/**
 * Layout cache backed by Upstash Redis.
 *
 * Caches generated layouts by persona + category slug.
 * First visitor generates (8-13s), subsequent visitors get sub-100ms.
 *
 * Falls back gracefully — cache miss just means a fresh generation.
 */

import { env } from '$env/dynamic/private';
import type { Layout } from '$lib/schema/layout';
import { isCachingDisabledGlobally } from './cache-flags';

const LAYOUT_TTL_S = 60 * 60; // 1 hour

let redis: import('@upstash/redis').Redis | null = null;
let initialized = false;

async function getRedis(): Promise<import('@upstash/redis').Redis | null> {
	if (initialized) return redis;
	initialized = true;

	const url = env.KV_REST_API_URL;
	const token = env.KV_REST_API_TOKEN;
	if (!url || !token) return null;

	try {
		const { Redis } = await import('@upstash/redis');
		redis = new Redis({ url, token });
		return redis;
	} catch {
		return null;
	}
}

function layoutKey(brandId: string, persona: string, categorySlug: string, picksHash?: string): string {
	const base = `aisles:layout:${brandId}:${persona}:${categorySlug}`;
	return picksHash ? `${base}:picks:${picksHash}` : base;
}

/**
 * Simple hash of picks IDs for cache key differentiation.
 * Empty/undefined picks returns undefined (use standard cache).
 */
export function hashPicks(picksContext?: string): string | undefined {
	if (!picksContext) return undefined;
	// Simple hash: sum of char codes mod a large prime
	let hash = 0;
	for (let i = 0; i < picksContext.length; i++) {
		hash = ((hash << 5) - hash + picksContext.charCodeAt(i)) | 0;
	}
	return Math.abs(hash).toString(36);
}

/**
 * Get a cached layout for a persona + category + picks combination.
 * Returns null on cache miss or any error.
 */
export async function getCachedLayout(brandId: string, persona: string, categorySlug: string, picksHash?: string): Promise<Layout | null> {
	if (isCachingDisabledGlobally()) return null;
	const r = await getRedis();
	if (!r) return null;

	try {
		return await r.get<Layout>(layoutKey(brandId, persona, categorySlug, picksHash));
	} catch {
		return null;
	}
}

/**
 * Store a generated layout in the cache.
 */
export async function cacheLayout(brandId: string, persona: string, categorySlug: string, layout: Layout, picksHash?: string): Promise<void> {
	const r = await getRedis();
	if (!r) return;

	try {
		// Picks-specific layouts get shorter TTL (picks change more often)
		const ttl = picksHash ? Math.floor(LAYOUT_TTL_S / 4) : LAYOUT_TTL_S;
		await r.set(layoutKey(brandId, persona, categorySlug, picksHash), layout, { ex: ttl });
	} catch {
		// Cache write failure is non-fatal
	}
}

/**
 * Suggestion cache (PDP "pairs well with" + PicksTray suggestions).
 *
 * Pairings are deterministic per (brand × picks set) — the LLM has no
 * personalization input beyond the picks themselves. Without caching,
 * every PDP visit re-pays the 2–4s suggest latency for the same answer.
 * 1h TTL matches the layout cache; bust on enrichment runs alongside
 * the layout cache invalidation.
 */
const SUGGEST_TTL_S = 60 * 60; // 1h

function suggestKey(brandId: string, picksHash: string): string {
	return `aisles:suggest:${brandId}:${picksHash}`;
}

export interface SuggestionEntry {
	id: string;
	name: string;
	price: number;
	reason: string;
	type: 'accessory' | 'upsell' | 'cross-sell' | 'complement';
}

export async function getCachedSuggestions(brandId: string, picksHash: string): Promise<SuggestionEntry[] | null> {
	if (isCachingDisabledGlobally()) return null;
	const r = await getRedis();
	if (!r) return null;
	try {
		return await r.get<SuggestionEntry[]>(suggestKey(brandId, picksHash));
	} catch {
		return null;
	}
}

export async function cacheSuggestions(
	brandId: string,
	picksHash: string,
	suggestions: SuggestionEntry[],
): Promise<void> {
	const r = await getRedis();
	if (!r) return;
	try {
		await r.set(suggestKey(brandId, picksHash), suggestions, { ex: SUGGEST_TTL_S });
	} catch {
		// non-fatal
	}
}

/**
 * Invalidate cached layouts. Called after enrichment runs or manual flush.
 * If no args, invalidates all layout caches.
 */
export async function invalidateLayoutCache(brandId?: string, persona?: string, categorySlug?: string): Promise<number> {
	const r = await getRedis();
	if (!r) return 0;

	try {
		if (brandId && persona && categorySlug) {
			return await r.del(layoutKey(brandId, persona, categorySlug));
		}

		// Scan and delete layout keys (scoped to brand if provided)
		const match = brandId ? `aisles:layout:${brandId}:*` : 'aisles:layout:*';
		const keys: string[] = [];
		let cursor = 0;
		do {
			const [newCursor, found] = await r.scan(cursor, { match, count: 100 });
			cursor = Number(newCursor);
			keys.push(...found);
		} while (cursor !== 0);

		if (keys.length === 0) return 0;
		return await r.del(...keys);
	} catch {
		return 0;
	}
}
