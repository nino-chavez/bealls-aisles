import type { PageServerLoad } from './$types';
import { requireOperatorAccess } from '$lib/server/access-gates';

export const load: PageServerLoad = ({ url, request }) => {
	requireOperatorAccess(url, request);
	return {};
};
