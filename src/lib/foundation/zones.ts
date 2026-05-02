/**
 * Zone catalog — the foundation's named insertion points.
 *
 * Every zone is a stable, typed insertion point on a surface. This file
 * declares the catalog (which zones exist on which surface) plus the
 * metadata each zone exposes (multiplicity, whether engine and admin can
 * target it).
 *
 * Zone schemas live in `./zone-schemas.ts`. Static fallbacks live in
 * `./fallbacks/{surface}.ts`. The cascade resolver lives in `./resolve-zone.ts`.
 *
 * See ADR-007 for the design rationale and section-authoring.md for the
 * full per-zone spec including which schemas + fallbacks each zone references.
 */

export type Surface =
	| 'home'
	| 'plp'
	| 'pdp'
	| 'cart'
	| 'checkout'
	| 'search'
	| 'account'
	| 'locator'
	| 'error-404'
	| 'error-empty';

/**
 * - `singleton` — one zone instance; ID is the family name (e.g., `home.hero`).
 * - `indexed` — fixed-cardinality family; instances are `{family}.{1..maxIndex}`.
 * - `array` — variable-length list; the instance ID is the family name and the
 *   resolver returns an array of content (engine/admin can supply 0..maxItems).
 */
export type Multiplicity = 'singleton' | 'indexed' | 'array';

export interface ZoneMetadata {
	surface: Surface;
	multiplicity: Multiplicity;
	/** For `indexed` zones: max valid index (1-based, inclusive). */
	maxIndex?: number;
	/** For `array` zones: max number of items the resolver returns. */
	maxItems?: number;
	/** Can the AI engine target this zone via its surface schema? */
	engineComposable: boolean;
	/** Can merchants author content here via the admin app (Phase 5)? */
	adminAuthorable: boolean;
}

export const ZONES = {
	// Home — wide latitude, AI composes most zones
	'home.hero': { surface: 'home', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'home.featured-row': { surface: 'home', multiplicity: 'indexed', maxIndex: 6, engineComposable: true, adminAuthorable: true },
	'home.editorial-strip': { surface: 'home', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'home.brand-spotlight': { surface: 'home', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'home.below-fold': { surface: 'home', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },

	// PLP — medium latitude
	'plp.banner': { surface: 'plp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'plp.editorial-header': { surface: 'plp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	// `plp.cluster-row` — themed merchandising bins between editorial header
	// and product grid. Real-Bealls signature pattern (BOHEMIAN ROMANCE,
	// VACATION OUTFITS, RODEO STYLE). Engine + admin both compose; admin is
	// the merchandiser-curated path, engine the AI-detected-clusters path.
	'plp.cluster-row': { surface: 'plp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'plp.between-thirds': { surface: 'plp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'plp.below-grid': { surface: 'plp', multiplicity: 'singleton', engineComposable: false, adminAuthorable: true },
	'plp.empty-state': { surface: 'plp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },

	// PDP — narrow latitude, scaffold-fixed; only insertion zones declared here
	'pdp.below-description': { surface: 'pdp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'pdp.related': { surface: 'pdp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'pdp.cross-sell': { surface: 'pdp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'pdp.recently-viewed': { surface: 'pdp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: false },
	'pdp.below-recs': { surface: 'pdp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },

	// Cart — fixed scaffold; only upsell + below-fold zones
	'cart.above-checkout-cta': { surface: 'cart', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'cart.below-fold': { surface: 'cart', multiplicity: 'array', maxItems: 2, engineComposable: true, adminAuthorable: true },
	'cart.empty-state': { surface: 'cart', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },

	// Checkout — narrowest latitude
	'checkout.assurance-strip': { surface: 'checkout', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'checkout.last-chance-upsell': { surface: 'checkout', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },

	// Search — empty state + composable rescue body
	'search.empty-state': { surface: 'search', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'search.zero-results-rescue': { surface: 'search', multiplicity: 'array', maxItems: 3, engineComposable: true, adminAuthorable: true },

	// Account — medium latitude, known-shopper context
	'account.welcome': { surface: 'account', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'account.dashboard-pick': { surface: 'account', multiplicity: 'indexed', maxIndex: 4, engineComposable: true, adminAuthorable: true },

	// Locator — single editorial zone
	'locator.editorial-intro': { surface: 'locator', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },

	// Error / empty rescues
	'error-404.rescue': { surface: 'error-404', multiplicity: 'array', maxItems: 3, engineComposable: true, adminAuthorable: true },
	'error-empty.rescue': { surface: 'error-empty', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
} as const satisfies Record<string, ZoneMetadata>;

/** Family-level zone ID (e.g., `home.featured-row`, not `home.featured-row.1`). */
export type ZoneId = keyof typeof ZONES;

export const ZONE_IDS = Object.keys(ZONES) as ZoneId[];

// ─── Instance ID helpers ───────────────────────────────────────────

/**
 * A zone instance ID is the string the engine and admin actually emit.
 * For singleton + array zones, the instance ID is the family ID.
 * For indexed zones, the instance ID is `{family}.{index}` (1-based).
 */
export type ZoneInstanceId = string;

const INDEXED_INSTANCE_RE = /^(.+)\.(\d+)$/;

/**
 * Parse a zone instance ID into its family + optional index. Returns null if
 * the ID does not match a known family.
 */
export function parseZoneInstance(id: ZoneInstanceId): {
	family: ZoneId;
	index?: number;
} | null {
	if (id in ZONES) {
		// Direct match — singleton or array zone (or someone passed the family of an indexed zone)
		return { family: id as ZoneId };
	}
	const match = INDEXED_INSTANCE_RE.exec(id);
	if (match) {
		const [, candidate, indexStr] = match;
		if (candidate in ZONES) {
			const meta = ZONES[candidate as ZoneId] as ZoneMetadata;
			if (meta.multiplicity === 'indexed' && meta.maxIndex) {
				const index = Number(indexStr);
				if (index >= 1 && index <= meta.maxIndex) {
					return { family: candidate as ZoneId, index };
				}
			}
		}
	}
	return null;
}

/** Enumerate all valid instance IDs in the catalog (for tests + admin UI). */
export function enumerateZoneInstances(): ZoneInstanceId[] {
	const out: ZoneInstanceId[] = [];
	for (const id of ZONE_IDS) {
		const meta = ZONES[id] as ZoneMetadata;
		if (meta.multiplicity === 'indexed' && meta.maxIndex) {
			for (let i = 1; i <= meta.maxIndex; i++) out.push(`${id}.${i}`);
		} else {
			out.push(id);
		}
	}
	return out;
}

/** Filter the catalog to a single surface (for surface-typed schema generation). */
export function zonesForSurface(surface: Surface): ZoneId[] {
	return ZONE_IDS.filter((id) => ZONES[id].surface === surface);
}
