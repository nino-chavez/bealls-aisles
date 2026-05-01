/**
 * Layout cache pre-warm.
 *
 * Hits /api/layout for each (brand × surface × persona) cell in
 * prewarm-cells.json. Cache writes happen as a side effect of normal
 * generation — same path live visitors hit, no Redis-direct writes.
 *
 * Layer: engine (cache pre-population for the AI composition layer).
 *
 * Scope rationale (mirrors docs/audits/perf/cold-start-baseline-2026-05-01.md):
 *   - home + PLP × {gatherer, hunter, researcher, gifter}: warmed
 *   - PDP: NOT warmed — zones are foundation-rendered from tag-overlap
 *     aggregates per ADR-008 Phase B; no /api/layout call to warm.
 *   - cart / checkout: NOT warmed — cart-state-dependent; meaningless without
 *     items.
 *   - empty / rescue: NOT warmed — generated only when needed.
 *   - HC PLP: NOT warmed — content-mode brands short-circuit in
 *     +page.server.ts and never hit /api/layout.
 *
 * Usage:
 *   npx tsx scripts/cache/prewarm.ts                       # all active brands
 *   npx tsx scripts/cache/prewarm.ts --brand=bealls        # single brand
 *   npx tsx scripts/cache/prewarm.ts --base-url=http://localhost:5173 --brand=bealls
 *
 * Idempotent: a second run is a no-op (cache hits all the way through).
 *
 * Deploy-time wire-up: set as a Vercel deploy hook or call from a
 * post-deploy CI step. The script is invocable via `npm run prewarm`.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CELLS_PATH = resolve(__dirname, 'prewarm-cells.json');

interface CellSurface {
	surface: 'home' | 'plp';
	categorySlug: string;
}

interface BrandCells {
	id: string;
	baseUrl: string;
	surfaces: CellSurface[];
}

interface CellsFile {
	_personas: string[];
	brands: BrandCells[];
}

interface CellResult {
	ok: boolean;
	timeMs: number;
	cacheHit: boolean;
	status?: number;
	error?: string;
}

function parseArgs(argv: string[]): { brand?: string; baseUrl?: string } {
	const out: { brand?: string; baseUrl?: string } = {};
	for (const arg of argv.slice(2)) {
		if (arg.startsWith('--brand=')) out.brand = arg.slice('--brand='.length);
		else if (arg.startsWith('--base-url=')) out.baseUrl = arg.slice('--base-url='.length);
	}
	return out;
}

async function warmCell(baseUrl: string, persona: string, categorySlug: string, surface: string): Promise<CellResult> {
	const start = Date.now();
	try {
		const res = await fetch(`${baseUrl}/api/layout`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ persona, categorySlug, surface }),
		});
		const timeMs = Date.now() - start;
		if (!res.ok) {
			return { ok: false, timeMs, cacheHit: false, status: res.status };
		}
		const data = await res.json();
		return { ok: true, timeMs, cacheHit: !!data?.meta?.cacheHit, status: res.status };
	} catch (err) {
		return {
			ok: false,
			timeMs: Date.now() - start,
			cacheHit: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

async function warmBrand(brand: BrandCells, personas: string[], baseUrlOverride?: string) {
	const baseUrl = baseUrlOverride ?? brand.baseUrl;
	const cells: Array<{ persona: string; categorySlug: string; surface: string }> = [];
	for (const s of brand.surfaces) {
		for (const persona of personas) {
			cells.push({ persona, categorySlug: s.categorySlug, surface: s.surface });
		}
	}

	console.log(`\n=== ${brand.id.toUpperCase()} (${baseUrl}) ===`);
	console.log(`${cells.length} cells\n`);

	const t0 = Date.now();
	let generated = 0, cached = 0, failed = 0;

	for (const cell of cells) {
		const cellId = `${cell.surface}:${cell.categorySlug}:${cell.persona}`;
		process.stdout.write(`  ${cellId.padEnd(40)} `);
		const r = await warmCell(baseUrl, cell.persona, cell.categorySlug, cell.surface);
		const tag = r.ok ? (r.cacheHit ? 'CACHED' : 'GENERATED') : 'FAILED';
		const detail = r.error ? ` (${r.error})` : r.status && !r.ok ? ` (HTTP ${r.status})` : '';
		console.log(`${tag.padEnd(10)} ${r.timeMs}ms${detail}`);
		if (!r.ok) failed++;
		else if (r.cacheHit) cached++;
		else generated++;
	}

	const totalMs = Date.now() - t0;
	console.log(`\n  ${generated} generated, ${cached} cached, ${failed} failed — ${(totalMs / 1000).toFixed(1)}s total`);
	return { generated, cached, failed, totalMs };
}

async function main() {
	const args = parseArgs(process.argv);
	const cells = JSON.parse(readFileSync(CELLS_PATH, 'utf-8')) as CellsFile;

	const brands = args.brand
		? cells.brands.filter((b) => b.id === args.brand)
		: cells.brands;

	if (brands.length === 0) {
		console.error(`No brands matched. Available: ${cells.brands.map((b) => b.id).join(', ')}`);
		process.exit(1);
	}

	const summary: Array<{ brand: string; generated: number; cached: number; failed: number }> = [];
	for (const brand of brands) {
		const r = await warmBrand(brand, cells._personas, args.baseUrl);
		summary.push({ brand: brand.id, ...r });
	}

	console.log('\n=== SUMMARY ===');
	for (const s of summary) {
		console.log(`  ${s.brand}: ${s.generated} generated, ${s.cached} cached, ${s.failed} failed`);
	}
}

main().catch((err) => {
	console.error('Pre-warm failed:', err);
	process.exit(1);
});
