#!/usr/bin/env node
/**
 * Targeted capture for demo reel scenes 06 (refinement chat) and 07 (cross-session continuity).
 *
 * Replaces the existing extracted/05a-d and 06a-c frames, which never showed
 * the recomposed page or the observe dashboard the narration describes.
 *
 * Drives real user flows against a running dev server:
 *   - Scene 06: open chat → type constraint → submit → wait for recompose →
 *     close chat → screenshot recomposed PLP → navigate /observe → screenshot
 *   - Scene 07: first visit → dwell → clear sessionStorage (keep cookies) →
 *     return visit → screenshot warm-start PLP → navigate /observe → screenshot
 *
 * Outputs into screenshots/extracted/ to match captions.json image paths.
 *
 * Usage: node scripts/demo-reel/capture-scene-06-07.mjs
 * Prereq: dev server running at http://localhost:5173 (npm run dev)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'screenshots', 'extracted');
fs.mkdirSync(OUT, { recursive: true });

const BASE = (process.env.AISLES_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const OBSERVE_KEY = process.env.OBSERVE_KEY ?? 'aisles-observe';
const VIEWPORT = { width: 1440, height: 900 };

function log(msg) { console.log(`  ${msg}`); }

async function shot(page, name) {
	const out = path.join(OUT, name);
	await page.screenshot({ path: out, fullPage: false });
	log(`✓ ${name}`);
}

async function captureScene06(browser) {
	console.log('\n[06] Refinement chat — pill → typed → recomposed → observe');
	const context = await browser.newContext({ viewport: VIEWPORT });
	const page = await context.newPage();

	// 1. Trigger pill — clean PLP with chat closed
	await page.goto(`${BASE}/category/women?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(2500);
	await shot(page, '05a-trigger-pill.png');

	// Open chat
	const trigger = page.getByRole('button', { name: /narrowing|refine/i }).first();
	await trigger.waitFor({ timeout: 5000 });
	await trigger.click();
	await page.waitForTimeout(600);

	// 2. Typed constraint visible in input
	const input = page.locator('input[type="text"], textarea').filter({ hasText: '' }).last();
	const inputAlt = page.locator('form input').last();
	const target = (await input.count()) > 0 ? input : inputAlt;
	await target.fill('Under fifty dollars, casual');
	await page.waitForTimeout(400);
	await shot(page, '05c-typed.png');

	// Submit and wait for recompose
	await target.press('Enter');
	// /api/refine call + layout recompose: typically 3–8s
	await page.waitForTimeout(7000);

	// 3. Recomposed page — close chat so the body is unobstructed
	const x = page.locator('button:has(svg path[d*="M18 6 6 18"])').first();
	if (await x.count() > 0) {
		try { await x.click(); } catch {}
	} else {
		await page.keyboard.press('Escape');
	}
	await page.waitForTimeout(600);
	await shot(page, '05d-recomposed.png');

	// 4. Observe view — wait for session list to populate before screenshotting
	await page.goto(`${BASE}/observe?key=${OBSERVE_KEY}`, { waitUntil: 'networkidle' });
	// Poll until at least one session is registered (sessionIds populated by /api/observe/sessions)
	await page.waitForFunction(() => {
		const sel = document.querySelector('select');
		return sel && sel.options && sel.options.length > 1;
	}, { timeout: 15000 }).catch(() => log('⚠ session list never populated; capturing as-is'));
	await page.waitForTimeout(2500);
	await shot(page, '05e-observe.png');

	await page.close();
	await context.close();
}

async function captureScene07(browser) {
	console.log('\n[07] Cross-session continuity — first visit → return → observe');
	// Persistent context so cookies survive the simulated tab close
	const context = await browser.newContext({ viewport: VIEWPORT });
	const page = await context.newPage();

	// First visit — browse women, dwell, navigate to a couple of categories so
	// the cross-session visitCount > 1 on return.
	await page.goto(`${BASE}/category/women?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(3500);
	await shot(page, '06a-first-visit.png');

	// Browse a second category to accumulate signals
	await page.goto(`${BASE}/category/shoes?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(2500);

	// Simulate "close tab, come back later" — clear sessionStorage but keep cookies
	await page.evaluate(() => sessionStorage.clear());

	// Return visit — same category to trigger "same category revisit" signal
	await page.goto(`${BASE}/category/women?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(4000);
	await shot(page, '06c-warm-return.png');

	// Observe view showing the cross-session signals
	await page.goto(`${BASE}/observe?key=${OBSERVE_KEY}`, { waitUntil: 'networkidle' });
	await page.waitForFunction(() => {
		const sel = document.querySelector('select');
		return sel && sel.options && sel.options.length > 1;
	}, { timeout: 15000 }).catch(() => log('⚠ session list never populated; capturing as-is'));
	await page.waitForTimeout(2500);
	await shot(page, '06b-observe-cross-session.png');

	await page.close();
	await context.close();
}

async function main() {
	console.log(`Capture scenes 06 + 07`);
	console.log(`  base: ${BASE}`);
	console.log(`  observe key: ${OBSERVE_KEY}`);
	console.log(`  out: ${OUT}\n`);

	const browser = await chromium.launch({ headless: true });
	try {
		await captureScene06(browser);
		await captureScene07(browser);
	} finally {
		await browser.close();
	}
	console.log('\nDone.');
}

main().catch((err) => {
	console.error('\n✗', err.message);
	process.exit(1);
});
