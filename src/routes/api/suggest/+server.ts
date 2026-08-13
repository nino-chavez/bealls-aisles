import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * The former suggestions response had no named renderer zone and let client
 * JSON select `pdp` or `picks`. PDP cross-sell is rules-only and Picks has no
 * registered zone, so model suggestions cannot be published today.
 */
export const POST: RequestHandler = async () => json({
	error: 'PDP recommendations are rules-driven; model suggestions are not authorized',
	suggestions: [],
}, { status: 403 });
