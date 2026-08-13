import type { LayoutServerLoad } from './$types';
import { getBrand, getBrandMode } from '$lib/brand/config';
import { executeTrustedErrorZones } from '$lib/server/shopper-route-runtime';

export const load: LayoutServerLoad = async ({ url, cookies, route }) => {
	const brand = getBrand();

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

	// Surface a server-side persona hint for fixed empty-state and picks UI.
	// It does not grant model execution or cache authority.
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
