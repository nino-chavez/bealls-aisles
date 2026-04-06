/**
 * Pre-generate and cache layouts for common persona+category combinations.
 * Run after deployment to fill the cache so first visitors get instant layouts.
 *
 * Usage: npx tsx scripts/warm-cache.ts [base-url]
 * Default: https://aisles-signal-x-studio-labs.vercel.app
 */

const BASE_URL = process.argv[2] || 'https://aisles-signal-x-studio-labs.vercel.app';

const PERSONAS = ['gatherer', 'hunter', 'researcher', 'gifter'];
const CATEGORIES = ['living-room', 'bedroom', 'dining', 'office', 'outdoor', 'kids'];

// Prioritize the most common combinations first
const PRIORITY_COMBOS = [
	// Default persona for each category (first visit)
	...CATEGORIES.map((c) => ({ persona: 'gatherer', categorySlug: c })),
	// Hunter variants (second most common from search signals)
	...CATEGORIES.map((c) => ({ persona: 'hunter', categorySlug: c })),
];

async function warmOne(persona: string, categorySlug: string): Promise<{ ok: boolean; timeMs: number }> {
	const start = Date.now();
	try {
		const res = await fetch(`${BASE_URL}/api/layout`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ persona, categorySlug }),
		});
		const data = await res.json();
		const timeMs = Date.now() - start;

		if (data.meta?.cacheHit) {
			return { ok: true, timeMs };
		}
		return { ok: res.ok, timeMs };
	} catch {
		return { ok: false, timeMs: Date.now() - start };
	}
}

async function main() {
	console.log(`Warming cache at ${BASE_URL}`);
	console.log(`${PRIORITY_COMBOS.length} combinations to warm\n`);

	let cached = 0;
	let generated = 0;
	let failed = 0;

	for (const { persona, categorySlug } of PRIORITY_COMBOS) {
		process.stdout.write(`  ${persona}:${categorySlug}... `);
		const result = await warmOne(persona, categorySlug);

		if (!result.ok) {
			console.log(`FAILED (${result.timeMs}ms)`);
			failed++;
		} else if (result.timeMs < 500) {
			console.log(`CACHED (${result.timeMs}ms)`);
			cached++;
		} else {
			console.log(`GENERATED (${result.timeMs}ms)`);
			generated++;
		}
	}

	console.log(`\nDone: ${generated} generated, ${cached} already cached, ${failed} failed`);
}

main();
