/**
 * Server-side session manager for signal stores.
 *
 * In-memory Map<sessionId, SignalStore> with TTL cleanup.
 * Works in dev (single process) and on Vercel Fluid Compute
 * (instance reuse across requests). Does not survive cold starts.
 *
 * Phase 3: replace with Upstash Redis for durable sessions.
 */

import { SignalStore } from './store';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Clean every 5 minutes

interface SessionEntry {
	store: SignalStore;
	lastAccessed: number;
}

const sessions = new Map<string, SessionEntry>();

// Periodic cleanup of expired sessions
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
	if (cleanupTimer) return;
	cleanupTimer = setInterval(() => {
		const now = Date.now();
		for (const [id, entry] of sessions) {
			if (now - entry.lastAccessed > SESSION_TTL_MS) {
				sessions.delete(id);
			}
		}
		// Stop the timer if no sessions remain
		if (sessions.size === 0 && cleanupTimer) {
			clearInterval(cleanupTimer);
			cleanupTimer = null;
		}
	}, CLEANUP_INTERVAL_MS);
}

/**
 * Get an existing session store or create a new one.
 * Touches the session's lastAccessed timestamp.
 */
export function getSessionStore(sessionId: string): SignalStore {
	const existing = sessions.get(sessionId);
	if (existing) {
		existing.lastAccessed = Date.now();
		return existing.store;
	}

	const store = new SignalStore(sessionId);
	sessions.set(sessionId, { store, lastAccessed: Date.now() });
	ensureCleanup();
	return store;
}

/** Check if a session exists without creating one. */
export function hasSession(sessionId: string): boolean {
	return sessions.has(sessionId);
}

/** Number of active sessions (for observability). */
export function sessionCount(): number {
	return sessions.size;
}
