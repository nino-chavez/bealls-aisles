/**
 * Domain-specific generation logging.
 *
 * Records every layout/refinement generation with context that the
 * AI Gateway doesn't have: persona, category, signal count, cache hit,
 * evaluation score. Stored in Neon Postgres alongside enrichment data.
 *
 * AI Gateway handles LLM-level observability (tokens, latency, cost).
 * This handles domain-level observability (persona, quality, conversion).
 */

import { getDb } from './db';

let tableCreated = false;

async function ensureTable() {
	if (tableCreated) return;
	const sql = getDb();
	await sql`
		CREATE TABLE IF NOT EXISTS generation_logs (
			id              SERIAL PRIMARY KEY,
			type            TEXT NOT NULL,
			persona         TEXT NOT NULL,
			category_slug   TEXT NOT NULL,
			cache_hit       BOOLEAN NOT NULL DEFAULT false,
			generation_ms   INTEGER NOT NULL,
			product_count   INTEGER,
			input_tokens    INTEGER,
			output_tokens   INTEGER,
			eval_score      REAL,
			prompt_version  TEXT DEFAULT 'v1',
			created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;
	tableCreated = true;
}

export interface GenerationLogEntry {
	type: 'layout' | 'refine';
	persona: string;
	categorySlug: string;
	cacheHit: boolean;
	generationTimeMs: number;
	productCount?: number;
	inputTokens?: number;
	outputTokens?: number;
	evalScore?: number;
}

export async function logGeneration(entry: GenerationLogEntry): Promise<void> {
	try {
		await ensureTable();
		const sql = getDb();
		await sql`
			INSERT INTO generation_logs (
				type, persona, category_slug, cache_hit, generation_ms,
				product_count, input_tokens, output_tokens, eval_score
			) VALUES (
				${entry.type}, ${entry.persona}, ${entry.categorySlug},
				${entry.cacheHit}, ${entry.generationTimeMs},
				${entry.productCount ?? null}, ${entry.inputTokens ?? null},
				${entry.outputTokens ?? null}, ${entry.evalScore ?? null}
			)
		`;
	} catch (err) {
		console.warn('[generation-log] Failed to log:', err instanceof Error ? err.message : err);
	}
}
