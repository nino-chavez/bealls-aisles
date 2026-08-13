import type { LayoutServerLoad } from './$types';
import { requireDevelopmentRoute } from '$lib/server/access-gates';

export const load: LayoutServerLoad = () => {
	requireDevelopmentRoute();
	return {};
};
