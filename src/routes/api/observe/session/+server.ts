import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionStore, hasSession } from '$lib/signals/session';
import { infer } from '$lib/signals/inference';
import { requireOperatorAccess } from '$lib/server/access-gates';

/**
 * GET /api/observe/session?id={sessionId}
 * Returns the full session state: events, inference, cross-session context.
 */
export const GET: RequestHandler = async ({ url, request }) => {
	requireOperatorAccess(url, request);
	const sessionId = url.searchParams.get('id');
	if (!sessionId) {
		return json({ error: 'Missing id parameter' }, { status: 400 });
	}

	if (!(await hasSession(sessionId))) {
		return json({ error: 'Session not found' }, { status: 404 });
	}

	const store = await getSessionStore(sessionId, { fresh: true });
	const events = store.getEvents();
	const inference = infer(store.toInferenceContext());
	const crossSession = store.getCrossSessionContext();

	return json({
		sessionId,
		events,
		inference,
		eventCount: events.length,
		crossSession,
	});
};
