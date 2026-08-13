import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Shopper-paid model execution is retired.
 *
 * A page visit is not merchant authorization to incur model cost. This
 * endpoint intentionally parses no client input, consults no cache-bypass
 * flag, loads no provider, and returns no decision envelope. A future model
 * path requires a separately authenticated merchant operation with an owned
 * cost, rate, and concurrency budget.
 */
export const POST: RequestHandler = async () => json({
	error: 'Shopper model-zone execution is not authorized',
	meta: { modelCalled: false },
}, { status: 403 });
