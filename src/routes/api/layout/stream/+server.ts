import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Whole-layout streaming is intentionally retired. Partial model objects can
 * never be route/zone-authorized, cached, or safely consumed by a renderer.
 */
export const POST: RequestHandler = async () => json({
	error: 'Whole-layout streaming is retired; only complete named-zone decisions can publish',
}, { status: 410 });
