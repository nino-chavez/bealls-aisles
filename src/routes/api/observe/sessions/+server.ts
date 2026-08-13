import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listSessionIds, getSessionStore } from '$lib/signals/session';
import { requireOperatorAccess } from '$lib/server/access-gates';

/**
 * GET /api/observe/sessions
 * Returns active session IDs sorted by most recent event timestamp
 * so "watch latest" actually picks the freshest session.
 */
export const GET: RequestHandler = async ({ url, request }) => {
	requireOperatorAccess(url, request);
	const ids = await listSessionIds();

	const withActivity = await Promise.all(
		ids.map(async (id) => {
			try {
				const store = await getSessionStore(id);
				const events = store.getEvents();
				const last = events.length > 0 ? events[events.length - 1].timestamp : 0;
				return { id, last };
			} catch {
				return { id, last: 0 };
			}
		})
	);

	withActivity.sort((a, b) => b.last - a.last);
	return json({ sessionIds: withActivity.map((s) => s.id) });
};
