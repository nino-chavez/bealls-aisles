import type { LayoutServerLoad } from './$types';
import { getBrand, getBrandMode } from '$lib/brand/config';
import { executeTrustedErrorZones } from '$lib/server/shopper-route-runtime';
import { bindShopperRouteGrant } from '$lib/server/shopper-route-grant';
import type { BeallsFamilyBrandId } from '$lib/brand/bealls-family-runtime-contract';

export const load: LayoutServerLoad = async ({ url, cookies, route }) => {
	const brand = getBrand();
	bindShopperRouteGrant(url.pathname, brand.id as BeallsFamilyBrandId, cookies);

	// Dev mode: ?dev=true turns it on, ?dev=false turns it off, cookie persists
	const devParam = url.searchParams.get('dev');
	if (devParam === 'true') {
		cookies.set('aisles_dev', '1', { path: '/', maxAge: 60 * 60 * 24 });
	} else if (devParam === 'false') {
		cookies.delete('aisles_dev', { path: '/' });
	}
	const devMode = devParam === 'true' || (devParam !== 'false' && cookies.get('aisles_dev') === '1');

	const freeShippingThreshold = brand.incentives?.freeShippingThresholdMinor;
	const shippingPromo = freeShippingThreshold && freeShippingThreshold > 0
		? `FREE SHIPPING when you spend $${(freeShippingThreshold / 100).toFixed(0)}+`
		: null;

	// Surface a server-side persona hint so client-only routes (+error.svelte,
	// empty-state rescues in CartDrawer/PicksTray) can call /api/layout with
	// a sensible persona. The aisles_persona cookie is httpOnly by default,
	// so without this hint the client cannot read it. Default to 'gatherer'
	// (the cold-start prior) when no cookie is set.
	const personaHint = cookies.get('aisles_persona') || 'gatherer';
	// SvelteKit has no +error.server load. An unmatched route is the one
	// server-trusted condition available before +error.svelte renders. Matched
	// success routes never execute or inherit rescue-zone evidence.
	const notFoundZoneExecution = route.id === null
		? await executeTrustedErrorZones(url, 'not-found')
		: null;

	return {
		brand: {
			id: brand.id,
			name: brand.name,
			tagline: brand.tagline,
			footerNote: brand.footerNote,
			googleFontsUrl: brand.googleFontsUrl,
			theme: brand.theme,
			mode: getBrandMode(brand),
			shippingPromo,
		},
		devMode,
		personaHint,
		notFoundZoneExecution,
	};
};
