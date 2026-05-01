import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * POST /api/email-signup
 *
 * Stub endpoint for the `email-capture-inline` block (PRD-ENG-020).
 * Logs the submission to the server console only — no CRM/ESP wiring.
 *
 * TODO: future merchant integration. When a brand connects an ESP
 * (Klaviyo, Bronto, BC Customer Group), forward `{ email, source }`
 * to the connected provider and dedupe by `(brandId, email)`.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: RequestHandler = async ({ request }) => {
	let payload: { email?: unknown; source?: unknown };
	try {
		payload = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const email = typeof payload.email === 'string' ? payload.email.trim() : '';
	const source = typeof payload.source === 'string' ? payload.source : 'unknown';

	if (!EMAIL_RE.test(email)) {
		return json({ error: 'Invalid email' }, { status: 400 });
	}

	console.log(`[email-signup] received email=${email} source=${source}`);

	return json({ ok: true });
};
