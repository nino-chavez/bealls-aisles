/**
 * Proximity utilities for the locator surface.
 *
 * Layer: foundation. Drives PRD-ENG-017 (proximity-aware bopis-strip on PDP)
 * and PRD-FND-014 (locator surface ZIP → nearest stores).
 *
 * Approach is intentionally lightweight:
 *   - Haversine for distance (no PostGIS, no third-party geocoding).
 *   - A small ZIP → (lat, lng) table for shopper-side lookup. The table
 *     covers the Bealls service-area centroids; ZIPs outside the table
 *     get null geo (caller treats as "no proximity context", BOPIS strip
 *     does not render).
 *
 * Production pattern would back this with a real ZIP → lat/lng database
 * (e.g. SimpleMaps US ZIP database) or a geocoding service. For the
 * prototype, this table is sufficient.
 */

import type { Store } from './stores';

const EARTH_RADIUS_MI = 3958.8;

/** Distance in miles between two (lat, lng) pairs via haversine. */
export function haversineMiles(
	a: { lat: number; lng: number },
	b: { lat: number; lng: number }
): number {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

/**
 * Tiny ZIP-prefix → (lat, lng) table covering Bealls service-area centroids.
 * Match by 3-digit prefix (ZCTA-3) so a shopper ZIP like "33701" maps to
 * the St. Petersburg cluster centroid. Outside the table → null.
 */
const ZIP3_GEO: Record<string, { lat: number; lng: number; label: string }> = {
	'320': { lat: 30.3322, lng: -81.6557, label: 'Jacksonville, FL' },
	'322': { lat: 30.3322, lng: -81.6557, label: 'Jacksonville, FL' },
	'325': { lat: 30.4383, lng: -84.2807, label: 'Tallahassee, FL' },
	'328': { lat: 28.5383, lng: -81.3792, label: 'Orlando, FL' },
	'329': { lat: 28.5383, lng: -81.3792, label: 'Orlando, FL' },
	'330': { lat: 25.7617, lng: -80.1918, label: 'Miami, FL' },
	'331': { lat: 25.7617, lng: -80.1918, label: 'Miami, FL' },
	'332': { lat: 25.7617, lng: -80.1918, label: 'Miami, FL' },
	'333': { lat: 26.1224, lng: -80.1373, label: 'Fort Lauderdale, FL' },
	'334': { lat: 26.7153, lng: -80.0534, label: 'West Palm Beach, FL' },
	'336': { lat: 27.9506, lng: -82.4572, label: 'Tampa, FL' },
	'337': { lat: 27.9506, lng: -82.4572, label: 'Tampa, FL' },
	'341': { lat: 27.3364, lng: -82.5307, label: 'Sarasota, FL' },
	'342': { lat: 27.3364, lng: -82.5307, label: 'Sarasota, FL' },
	'314': { lat: 31.9923, lng: -81.1762, label: 'Savannah, GA' },
	'366': { lat: 30.6741, lng: -88.1077, label: 'Mobile, AL' },
	'282': { lat: 35.2271, lng: -80.8431, label: 'Charlotte, NC' },
	'850': { lat: 33.4484, lng: -112.074, label: 'Phoenix, AZ' },
	'851': { lat: 33.4484, lng: -112.074, label: 'Phoenix, AZ' },
};

/** Resolve a US ZIP (5-digit) to an approximate (lat, lng). Null if unknown. */
export function geocodeZip(zip: string): { lat: number; lng: number; label: string } | null {
	const normalized = zip.trim().slice(0, 5);
	if (!/^\d{5}$/.test(normalized)) return null;
	return ZIP3_GEO[normalized.slice(0, 3)] ?? null;
}

export type StoreWithDistance = Store & { distanceMi: number };

/**
 * Rank stores by haversine distance from a (lat, lng). Returns up to `limit`
 * results sorted ascending. If `maxMiles` is provided, results beyond that
 * radius are filtered out.
 */
export function nearestStores(
	stores: Store[],
	origin: { lat: number; lng: number },
	opts: { limit?: number; maxMiles?: number } = {}
): StoreWithDistance[] {
	const { limit = 10, maxMiles } = opts;
	const ranked = stores
		.map((s) => ({ ...s, distanceMi: haversineMiles(origin, { lat: s.lat, lng: s.lng }) }))
		.sort((a, b) => a.distanceMi - b.distanceMi);
	const filtered = maxMiles !== undefined ? ranked.filter((s) => s.distanceMi <= maxMiles) : ranked;
	return filtered.slice(0, limit);
}

/**
 * Determine BOPIS proximity context for a given shopper ZIP + brand.
 * Returns the nearest pickup-ready store within the BOPIS radius, plus a
 * synthesized "ready by" label. Null if the ZIP is unknown or no store is
 * within range.
 *
 * BOPIS_RADIUS_MI of 30 matches PRD-ENG-017 acceptance copy.
 */
const BOPIS_RADIUS_MI = 30;

export type BOPISContext = {
	store: StoreWithDistance;
	readyByLabel: string;
};

export function getBOPISContext(stores: Store[], shopperZip: string | null | undefined): BOPISContext | null {
	if (!shopperZip) return null;
	const origin = geocodeZip(shopperZip);
	if (!origin) return null;
	const nearby = nearestStores(stores, origin, { limit: 1, maxMiles: BOPIS_RADIUS_MI });
	const store = nearby.find((s) => s.pickupReady);
	if (!store) return null;
	return { store, readyByLabel: 'Ready in 2 hours' };
}
