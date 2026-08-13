import type { PageServerLoad } from './$types';
import { requireBrandSurface } from '$lib/server/brand-surface-guard';

export const load: PageServerLoad = () => {
	requireBrandSurface('compare');
	return {};
};
