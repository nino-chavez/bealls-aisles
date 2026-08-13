/**
 * Zone-retrieval log — ADR-008 Phase B (PRD-ENG-019) explainability hook.
 *
 * For every cross-sell zone the engine populates, record which products
 * landed there and *why*: the seed product, the tag overlap with the seed,
 * and the Jaccard score. The Decisions Inspector (PRD-ADM-003 / Phase 4)
 * reads from this table to render "shown because tags X, Y, Z overlap"
 * verbatim — the explainability commitment from ADR-008
 * §"Decisions Inspector explainability sharpens".
 *
 * Persistence is best-effort: the structured-log line is always emitted
 * to stderr (so the same shape lands in Vercel logs as well as the
 * database), and the `zone_retrieval_logs` insert is fire-and-forget.
 * Observability must not break page loads.
 */

import { getDb } from './db';
import { isParityFixtureEnabled } from './parity-fixture';

let tableCreated = false;

async function ensureTable() {
	if (tableCreated) return;
	const sql = getDb();
	await sql`
		CREATE TABLE IF NOT EXISTS zone_retrieval_logs (
			id              BIGSERIAL PRIMARY KEY,
			surface         TEXT NOT NULL,
			seed_entity_id  BIGINT,
			seed_entity_ids BIGINT[],
			session_id      TEXT,
			brand_id        TEXT,
			zones           JSONB NOT NULL,
			created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;
	await sql`CREATE INDEX IF NOT EXISTS zone_retrieval_logs_created_idx ON zone_retrieval_logs (created_at DESC)`;
	await sql`CREATE INDEX IF NOT EXISTS zone_retrieval_logs_session_idx ON zone_retrieval_logs (session_id)`;
	tableCreated = true;
}

export interface ZoneRetrievalProductEntry {
	productId: string;
	entityId: number;
	overlapScore: number;
	sharedTags: string[];
}

export interface ZoneRetrievalLogEntry {
	surface: 'pdp' | 'cart';
	seedEntityId?: number;
	seedEntityIds?: number[];
	sessionId?: string;
	brandId?: string;
	zones: Record<string, ZoneRetrievalProductEntry[]>;
}

export function logZoneRetrieval(entry: ZoneRetrievalLogEntry): void {
	if (isParityFixtureEnabled()) return;
	// Always emit the structured log line (synchronous, in-band).
	try {
		console.info(
			JSON.stringify({
				evt: 'zone-retrieval',
				ts: new Date().toISOString(),
				...entry,
			}),
		);
	} catch {
		// Logging failure is non-fatal.
	}
	// Fire-and-forget DB insert. We deliberately do NOT await — the page
	// load doesn't wait on this and a DB outage cannot break the request.
	void persistZoneRetrieval(entry).catch((err) => {
		console.warn('[zone-retrieval-log] persist failed:', err instanceof Error ? err.message : err);
	});
}

async function persistZoneRetrieval(entry: ZoneRetrievalLogEntry): Promise<void> {
	if (!process.env.DATABASE_URL) return; // No DB in this environment — skip
	await ensureTable();
	const sql = getDb();
	await sql`
		INSERT INTO zone_retrieval_logs (
			surface, seed_entity_id, seed_entity_ids, session_id, brand_id, zones
		) VALUES (
			${entry.surface},
			${entry.seedEntityId ?? null},
			${entry.seedEntityIds ?? null},
			${entry.sessionId ?? null},
			${entry.brandId ?? null},
			${JSON.stringify(entry.zones)}::jsonb
		)
	`;
}
