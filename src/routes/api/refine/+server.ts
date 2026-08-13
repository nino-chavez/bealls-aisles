import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Refinement previously returned a whole PLP layout selected by
 * `sourceSurface` in client JSON. PLP and search zones are fixed today, so no
 * model refinement has a publishable named target. Fail closed to the current
 * static route instead of manufacturing authority.
 */
export const POST: RequestHandler = async () => json({
	error: 'All PLP and search zones are fixed; the existing route remains in control',
}, { status: 403 });
