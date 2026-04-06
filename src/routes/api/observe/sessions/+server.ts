import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listSessionIds } from '$lib/signals/session';

const OBSERVE_KEY = 'aisles-observe';

/**
 * GET /api/observe/sessions
 * Returns active session IDs from Redis so the dashboard can pick one to watch.
 */
export const GET: RequestHandler = async ({ url }) => {
	if (url.searchParams.get('key') !== OBSERVE_KEY) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const sessionIds = await listSessionIds();
	return json({ sessionIds });
};
