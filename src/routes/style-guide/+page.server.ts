import type { PageServerLoad } from './$types';
import { getBrand, getBrandMode } from '$lib/brand/config';
import { requireMerchantReviewAccess } from '$lib/server/access-gates';

export const load: PageServerLoad = async ({ url, request }) => {
	requireMerchantReviewAccess(url, request);
	const brand = getBrand();
	const mode = getBrandMode(brand);

	return {
		brand: {
			id: brand.id,
			name: brand.name,
			tagline: brand.tagline,
			domain: brand.domain,
			mode,
			theme: brand.theme,
			googleFontsUrl: brand.googleFontsUrl,
			homepage: brand.homepage,
			prompt: brand.prompt,
			incentives: brand.incentives ?? null,
			categories: Object.entries(brand.categories).map(([slug, c]) => ({
				slug,
				displayName: c.displayName,
			})),
		},
	};
};
