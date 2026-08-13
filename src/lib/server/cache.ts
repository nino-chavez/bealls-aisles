/** Validated decision-envelope cache. Raw layouts are never cacheable. */

import { env } from '$env/dynamic/private';
import { isCachingDisabledGlobally } from './cache-flags';
import {
	revalidateCachedZoneDecision,
	zoneDecisionCacheKey,
	type ZoneDecisionContext,
	type ZoneDecisionEnvelope,
} from './zone-decision-envelope';

const DECISION_TTL_S = 60 * 60;
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

/** Cache hits preserve the stored provenance and must pass full-context revalidation. */
export async function getCachedZoneDecision(context: ZoneDecisionContext): Promise<ZoneDecisionEnvelope | null> {
	if (isCachingDisabledGlobally()) return null;
	const client = await getRedis();
	if (!client) return null;
	try {
		const raw = await client.get<unknown>(zoneDecisionCacheKey(context));
		return revalidateCachedZoneDecision(raw, context);
	} catch {
		return null;
	}
}

export async function cacheZoneDecision(envelope: ZoneDecisionEnvelope): Promise<void> {
	const validated = revalidateCachedZoneDecision(envelope, envelope.context);
	if (!validated) throw new Error('decision cache: refusing invalid envelope');
	const client = await getRedis();
	if (!client) return;
	try {
		await client.set(zoneDecisionCacheKey(validated.context), validated, { ex: DECISION_TTL_S });
	} catch {
		// A cache write never changes the already-validated live decision.
	}
}

export async function invalidateDecisionCache(brandId?: string): Promise<number> {
	const client = await getRedis();
	if (!client) return 0;
	try {
		const match = brandId ? `aisles:zone-decision:v1:*:${brandId}:*` : 'aisles:zone-decision:v1:*';
		const keys: string[] = [];
		let cursor = 0;
		do {
			const [next, found] = await client.scan(cursor, { match, count: 100 });
			cursor = Number(next);
			keys.push(...found);
		} while (cursor !== 0);
		return keys.length ? client.del(...keys) : 0;
	} catch {
		return 0;
	}
}
