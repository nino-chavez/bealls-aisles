import type { LayoutServerLoad } from './$types';
import { getBrand, getBrandMode } from '$lib/brand/config';

export const load: LayoutServerLoad = async ({ url, cookies }) => {
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

	// Surface a server-side persona hint so client-only routes (+error.svelte,
	// empty-state rescues in CartDrawer/PicksTray) can call /api/layout with
	// a sensible persona. The aisles_persona cookie is httpOnly by default,
	// so without this hint the client cannot read it. Default to 'gatherer'
	// (the cold-start prior) when no cookie is set.
	const personaHint = cookies.get('aisles_persona') || 'gatherer';

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
	};
};
