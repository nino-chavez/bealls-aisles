/**
 * Layout schema hub — re-exports surface-typed schemas + the helper
 * that routes a (surface, mode) pair to the right schema.
 *
 * Per ADR-006, the single LayoutSchema was split into per-surface
 * schemas (home, PLP, PDP, cart, checkout, empty) so each surface
 * can enforce appropriate composition latitude.
 *
 * Block (component) schemas are shared across surface schemas and
 * live in `./blocks.ts`.
 *
 * Existing call sites that import { LayoutSchema, Layout } from
 * '$lib/schema/layout' continue to work — those names are aliased to
 * the storefront variants of the home/PLP schemas, which together are
 * the only surfaces composed today.
 */

import { z } from 'zod';
import {
	HomeStorefrontLayoutSchema,
	HomeContentLayoutSchema,
	getHomeLayoutSchema,
} from './layouts/home';
import { getPLPLayoutSchema } from './layouts/plp';
import { PDPLayoutSchema } from './layouts/pdp';
import { CartLayoutSchema } from './layouts/cart';
import { CheckoutLayoutSchema } from './layouts/checkout';
import { getEmptyLayoutSchema } from './layouts/empty';

// ─── Surface enum ──────────────────────────────────────────────────

export const Surface = z.enum(['home', 'plp', 'pdp', 'cart', 'checkout', 'empty']);
export type Surface = z.infer<typeof Surface>;

/**
 * EmptyReason — the discriminator for empty/rescue surfaces.
 * Selects which rescue framing the AI uses when surface='empty'.
 *
 * - 'not-found' — 404. Shopper landed on a missing route. Rescue with
 *   popular categories + best-sellers + go-home affordance.
 * - 'empty-cart' — Cart drawer/page with no items. Rescue with popular
 *   products + free-shipping nudge + bealls-bucks reminder if known.
 * - 'empty-search' — Search returned zero results. Rescue with popular
 *   searches, related categories, semantic suggestions.
 * - 'empty-wishlist' — Picks/wishlist empty. Rescue with curated picks
 *   + "save what you love" framing.
 *
 * Per ADR-006, EmptyLayoutSchema is wide-latitude — the AI selects
 * whichever blocks fit the rescue framing.
 */
export const EmptyReason = z.enum([
	'not-found',
	'empty-cart',
	'empty-search',
	'empty-wishlist',
]);
export type EmptyReason = z.infer<typeof EmptyReason>;

// ─── Re-exports — block schemas ────────────────────────────────────

export {
	ProductRef,
	EditorialHeaderSection,
	HeroProductSection,
	ProductGridSection,
	CategoryHeaderSection,
	PromoStripSection,
	CategoryTileGridSection,
	PriceRailSection,
	ProductCarouselSection,
	CouponStripSection,
	EditorialHeroSection,
	BeallsBucksCalloutSection,
	LifestylePriceHeroSection,
	StorefrontBlocks,
	ContentBlocks,
} from './blocks';

// ─── Re-exports — surface schemas ──────────────────────────────────

export {
	HomeStorefrontLayoutSchema,
	HomeContentLayoutSchema,
	getHomeLayoutSchema,
} from './layouts/home';
export type { HomeStorefrontLayout, HomeContentLayout } from './layouts/home';

export {
	PLPStorefrontLayoutSchema,
	PLPContentLayoutSchema,
	getPLPLayoutSchema,
} from './layouts/plp';
export type { PLPStorefrontLayout, PLPContentLayout } from './layouts/plp';

export { PDPLayoutSchema } from './layouts/pdp';
export type { PDPLayout } from './layouts/pdp';

export { CartLayoutSchema } from './layouts/cart';
export type { CartLayout } from './layouts/cart';

export { CheckoutLayoutSchema } from './layouts/checkout';
export type { CheckoutLayout } from './layouts/checkout';

export {
	EmptyStorefrontLayoutSchema,
	EmptyContentLayoutSchema,
	getEmptyLayoutSchema,
} from './layouts/empty';
export type { EmptyStorefrontLayout, EmptyContentLayout } from './layouts/empty';

// ─── Backwards compatibility ───────────────────────────────────────

/**
 * Legacy storefront section vocabulary as a discriminated union.
 * Exported for back-compat with existing prompt construction code
 * that references `StorefrontSectionSchema`.
 */
import { StorefrontBlocks, ContentBlocks } from './blocks';
export const StorefrontSectionSchema = z.discriminatedUnion('component', [...StorefrontBlocks]);
export const ContentSectionSchema = z.discriminatedUnion('component', [...ContentBlocks]);
export const SectionSchema = StorefrontSectionSchema;

export type Section = z.infer<typeof StorefrontSectionSchema>;
export type ContentSection = z.infer<typeof ContentSectionSchema>;

/**
 * Legacy layout schema aliases. Today these resolve to the home
 * storefront / content schemas, which are wide-latitude and match
 * the original LayoutSchema shape. New call sites should import
 * the surface-typed schemas directly.
 */
export const StorefrontLayoutSchema = HomeStorefrontLayoutSchema;
export const ContentLayoutSchema = HomeContentLayoutSchema;
export const LayoutSchema = StorefrontLayoutSchema;

export type Layout = z.infer<typeof StorefrontLayoutSchema>;
export type ContentLayout = z.infer<typeof ContentLayoutSchema>;

/**
 * Legacy mode-only helper.
 * @deprecated Use `getLayoutSchemaForSurface(surface, mode)` instead.
 */
export function getLayoutSchema(mode: 'storefront' | 'content') {
	return mode === 'content' ? ContentLayoutSchema : StorefrontLayoutSchema;
}

// ─── Surface-typed router (the new API) ────────────────────────────

/**
 * Returns the appropriate layout schema for a (surface, mode) pair.
 *
 * Per ADR-006:
 * - home / PLP — wide / medium latitude; mode-aware (storefront vs content)
 * - PDP — narrow latitude; storefront-only (content brands have no PDP)
 * - cart / checkout — fixed scaffold; storefront-only
 * - empty — wide latitude rescue; mode-aware
 *
 * @example
 *   getLayoutSchemaForSurface('home', 'storefront') // HomeStorefrontLayoutSchema
 *   getLayoutSchemaForSurface('pdp', 'storefront')  // PDPLayoutSchema
 *   getLayoutSchemaForSurface('empty', 'content')   // EmptyContentLayoutSchema
 */
export function getLayoutSchemaForSurface(
	surface: Surface,
	mode: 'storefront' | 'content',
): z.ZodTypeAny {
	switch (surface) {
		case 'home':
			return getHomeLayoutSchema(mode);
		case 'plp':
			return getPLPLayoutSchema(mode);
		case 'pdp':
			return PDPLayoutSchema; // storefront-only; content brands have no PDP
		case 'cart':
			return CartLayoutSchema; // storefront-only
		case 'checkout':
			return CheckoutLayoutSchema; // storefront-only
		case 'empty':
			return getEmptyLayoutSchema(mode);
	}
}

/**
 * Infers a surface from a category slug for back-compat with API
 * endpoints that pass `categorySlug`. Today: `home` → 'home',
 * everything else → 'plp'. As Phase 3 ships, callers should pass
 * `surface` explicitly instead of relying on this inference.
 */
export function inferSurfaceFromCategorySlug(categorySlug: string): Surface {
	return categorySlug === 'home' ? 'home' : 'plp';
}
