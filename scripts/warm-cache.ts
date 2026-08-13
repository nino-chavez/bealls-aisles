/**
 * Retired whole-layout warmer.
 *
 * Named-zone decisions require a short-lived, page-issued route grant and a
 * full provenance envelope. A route-less script cannot mint that authority.
 * Keep this fail-closed stub so old operator commands cannot make requests.
 */

console.error(
	'Cache warming is retired: named-zone decisions require an exact signed consuming-route grant.',
);
process.exitCode = 1;
