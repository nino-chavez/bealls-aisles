/**
 * Retired whole-layout warmer.
 *
 * Shopper model execution is retired. Keep this fail-closed stub so old
 * operator commands cannot make requests or revive client cache authority.
 */

console.error(
	'Cache warming is retired: shopper requests have no model or freshness authority.',
);
process.exitCode = 1;
