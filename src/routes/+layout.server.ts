import type { LayoutServerLoad } from './$types';
import { getBrand } from '$lib/brand/config';

export const load: LayoutServerLoad = async () => {
	const brand = getBrand();
	return {
		brand: {
			id: brand.id,
			name: brand.name,
			tagline: brand.tagline,
			footerNote: brand.footerNote,
			googleFontsUrl: brand.googleFontsUrl,
			theme: brand.theme,
		},
	};
};
