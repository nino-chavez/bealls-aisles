import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * POST /api/signals
 *
 * Receives batched client-side signal events. For Phase 2, this
 * endpoint validates and acknowledges. The server-side store is
 * per-request (not persistent), so these events are logged but
 * don't feed back into the current page's inference yet.
 *
 * Phase 3 (Upstash Redis): events are appended to the session's
 * persistent store, inference re-runs, and the response includes
 * an updated PersonaInference for the client to act on.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { events } = await request.json();

		if (!Array.isArray(events) || events.length === 0) {
			return json({ error: 'Expected non-empty events array' }, { status: 400 });
		}

		// Validate basic event shape
		for (const event of events) {
			if (!event.type || !event.source || !event.timestamp) {
				return json({ error: 'Invalid event: missing type, source, or timestamp' }, { status: 400 });
			}
		}

		// Phase 2: acknowledge receipt. Log for observability.
		// Phase 3: append to Redis session store, re-run inference, return updated vector.

		return json({
			received: events.length,
			// Placeholder — Phase 3 will return updated inference here
			inference: null,
		});
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}
};
