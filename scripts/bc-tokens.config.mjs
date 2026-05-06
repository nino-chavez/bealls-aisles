/**
 * Canonical config for BC Storefront API token allowed_cors_origins.
 *
 * Single source of truth — any token regeneration reads from here so
 * dev-port drift and prod-alias additions can't silently invalidate
 * tokens. Adding a brand or updating origins? Edit this file, then
 * run `node scripts/regen-storefront-tokens.mjs`.
 *
 * BC constraint (discovered the hard way): allowed_cors_origins is
 * capped at 2 entries per token. This forces us to pick: 1 dev origin
 * + 1 prod origin (or 2 dev origins for brands that don't deploy).
 * If you change Vite's dev port, regenerate tokens — there's no
 * room to pre-allow multiple ports.
 *
 * Active brands (2026-05-01): bealls, beallsflorida. Home Centric is
 * content-mode (no online catalog, channel 0) and doesn't need a
 * Storefront token. Haven, Volt, and Ember are deprecated channels —
 * removed from this config 2026-05-01. Their env vars
 * (BIGCOMMERCE_STOREFRONT_TOKEN, VOLT_STOREFRONT_TOKEN,
 * EMBER_STOREFRONT_TOKEN) are dead and can be deleted from .env.
 */

/** Current Vite dev-server origin. If the project changes this, regen. */
export const DEV_ORIGIN = 'http://localhost:5173';

/**
 * Per-brand metadata for Storefront API token issuance.
 * - channelId: BC channel the token is scoped to
 * - envKey: which .env var holds the storefront token for this brand
 * - origins: full allowed_cors_origins list (max 2 per BC). The first
 *   entry should always be DEV_ORIGIN; the second is the brand's prod
 *   alias.
 */
export const BRAND_TOKENS = [
	{
		brand: 'bealls',
		channelId: 1846324,
		envKey: 'BEALLS_STOREFRONT_TOKEN',
		origins: [DEV_ORIGIN, 'https://aisles-demo-1-signal-x-studio-labs.vercel.app'],
	},
	{
		brand: 'beallsflorida',
		channelId: 1846321,
		envKey: 'BEALLSFLORIDA_STOREFRONT_TOKEN',
		origins: [DEV_ORIGIN, 'https://aisles-demo-2-signal-x-studio-labs.vercel.app'],
	},
	{
		brand: 'sleepcountry',
		channelId: 1, // Demo channel, BC sample/Stencil platform; activated 2026-05-06
		envKey: 'SLEEPCOUNTRY_STOREFRONT_TOKEN',
		origins: [DEV_ORIGIN, 'https://aisles-demo-4.biq.workers.dev'],
	},
];

/** Token lifetime in seconds (1 year — matches prior issuance). */
export const TOKEN_LIFETIME_SECONDS = 365 * 24 * 60 * 60;
