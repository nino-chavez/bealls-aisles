/**
 * Neon Postgres client for server-side use.
 *
 * Uses the Neon serverless driver which works over HTTP —
 * no persistent TCP connections needed on Vercel Functions.
 */

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { isParityFixtureEnabled } from './parity-fixture';

let _sql: NeonQueryFunction<false, false> | null = null;
let dbAccessObserverForTest: (() => void) | null = null;

export function getDb() {
	dbAccessObserverForTest?.();
	if (isParityFixtureEnabled()) throw new Error('Database access is disabled by the parity fixture');
	if (!_sql) {
		if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not configured');
		_sql = neon(process.env.DATABASE_URL);
	}
	return _sql;
}

/** Test-only observer for proving fixture paths return before DB acquisition. */
export function _setDbAccessObserverForTest(observer: (() => void) | null): void {
	dbAccessObserverForTest = observer;
}
