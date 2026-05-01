/**
 * Static fallbacks for zone resolution.
 *
 * Phase 2 Session A ships an empty fallback registry — every zone falls
 * back to `null` (the "Hidden" semantic per section-authoring.md §5.4):
 * the foundation renders nothing for that zone when no engine output and
 * no admin content exist.
 *
 * Session B will add per-surface fallback modules (e.g., `./home.ts`)
 * with brand-aware content for zones that should always render something
 * (e.g., `home.hero` defaults to the brand's photographic hero,
 * `home.featured-row.1` defaults to a "Best Sellers" carousel).
 */

import type { ZoneId } from '../zones';

/**
 * A fallback may return either content (typed loosely here — the resolver
 * validates against the per-zone schema) or `null` for the Hidden semantic.
 *
 * Fallbacks must:
 * - Always return synchronously (no IO at request time).
 * - Be brand-aware via `getBrand()` if they need brand context.
 * - Match the zone's Zod schema (validated in tests).
 */
export type ZoneFallback = (brandId: string) => unknown | null;

/**
 * Default fallback — returns `null` (Hidden). Used for any zone family
 * that does not declare a specific fallback.
 */
const HIDDEN: ZoneFallback = () => null;

/**
 * Fallback registry. Phase 2 Session A: empty (every zone resolves to
 * Hidden). Session B fills the home surface.
 */
const FALLBACKS: Partial<Record<ZoneId, ZoneFallback>> = {};

/**
 * Resolve a static fallback for a zone family. Returns `null` (Hidden)
 * for any zone without a registered fallback.
 */
export function getFallback(family: ZoneId, brandId: string): unknown | null {
	return (FALLBACKS[family] ?? HIDDEN)(brandId);
}
