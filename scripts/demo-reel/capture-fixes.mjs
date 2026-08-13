#!/usr/bin/env node
/**
 * Targeted recapture for demo reel scenes that had narration/visual mismatches:
 *   04 — Bypass cache: 3 visually distinct states (cached, mid-regen, regenerated)
 *   08 — PLP latitude: different category from scene 06 to avoid visual duplication
 *   10 — Cart latitude: real /cart page (was PDP before)
 *   11 — Block catalog: viewport-fit crop (was unreadable fullpage)
 *   15 — Marketplace/Voucherify: Bealls cart with promo code applied (was Haven)
 *   16 — Cost meter: cropped SESSION COST panel (was full /observe)
 *
 * Outputs into screenshots/extracted/ (multi-frame scenes) and screenshots/
 * (single-image scenes) per captions.json conventions.
 *
 * Prereq: dev server at http://localhost:5173, ELEVENLABS not needed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, 'screenshots');
const EXTRACTED = path.join(SHOTS, 'extracted');
fs.mkdirSync(EXTRACTED, { recursive: true });

const BASE = (process.env.AISLES_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const OBSERVE_KEY = process.env.OBSERVE_KEY ?? 'aisles-observe';
const VIEWPORT = { width: 1440, height: 900 };

function log(msg) { console.log(`  ${msg}`); }

async function shot(page, file, opts = {}) {
	const out = file.startsWith('/') ? file : path.join(SHOTS, file);
	await page.screenshot({ path: out, fullPage: opts.fullPage ?? false, clip: opts.clip });
	log(`✓ ${path.relative(SHOTS, out)}`);
	return out;
}

// ─── Scene 04: repeated fixed-policy renders ─────────────────────
async function scene04(browser) {
	console.log('\n[04] Fixed category — repeatability evidence');
	const ctx = await browser.newContext({ viewport: VIEWPORT });
	const page = await ctx.newPage();

	await page.goto(`${BASE}/category/men?dev=1`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(1500);

	await page.goto(`${BASE}/category/men?dev=1`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(1000);
	await shot(page, 'extracted/03a-fixed-first.png');

	await page.reload({ waitUntil: 'networkidle' });
	await page.waitForTimeout(1000);
	await shot(page, 'extracted/03b-fixed-second.png');

	await page.reload({ waitUntil: 'networkidle' });
	await page.waitForTimeout(1000);
	await shot(page, 'extracted/03c-fixed-third.png');

	await page.close();
	await ctx.close();
}

// ─── Scene 08: PLP latitude — use a different category so it doesn't duplicate scene 06 ─
async function scene08(browser) {
	console.log('\n[08] PLP latitude — fresh category for visual distinction');
	const ctx = await browser.newContext({ viewport: VIEWPORT });
	const page = await ctx.newPage();
	// Scene 06's recomposed shot is /category/women in Hunter mode (dense grid).
	// Use /category/shoes to get a different layout/voice.
	await page.goto(`${BASE}/category/shoes?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(3500);
	await shot(page, 'bealls-08-plp-latitude.png');
	await page.close();
	await ctx.close();
}

// ─── Scene 10: real /cart page ──────────────────────────────────
async function scene10(browser) {
	console.log('\n[10] Cart latitude — real /cart with line items');
	const ctx = await browser.newContext({ viewport: VIEWPORT });
	const page = await ctx.newPage();

	// Find a product to add
	await page.goto(`${BASE}/category/women?dev=0`, { waitUntil: 'networkidle' });
	const html = await page.content();
	const m = html.match(/entityId[":]+(\d+)/);
	if (m) {
		try {
			await page.request.post(`${BASE}/api/cart`, {
				data: { productEntityId: parseInt(m[1], 10), quantity: 2 },
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (err) { log(`⚠ cart add failed: ${err.message}`); }
	}
	await page.goto(`${BASE}/cart?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(2500);
	await shot(page, 'extracted/09a-cart-page.png');

	// Second frame: scrolled down to show summary + promo + checkout
	await page.evaluate(() => window.scrollTo(0, 200));
	await page.waitForTimeout(500);
	await shot(page, 'extracted/09b-cart-scrolled.png');

	// Third frame: scrolled further if there's content (or summary close-up)
	await page.evaluate(() => window.scrollTo(0, 400));
	await page.waitForTimeout(500);
	await shot(page, 'extracted/09c-cart-summary.png');

	await page.close();
	await ctx.close();
}

// ─── Scene 11: block catalog — viewport-fit, multi-frame scroll ───
async function scene11(browser) {
	console.log('\n[11] Block catalog — viewport-fit scroll frames');
	const ctx = await browser.newContext({ viewport: VIEWPORT });
	const page = await ctx.newPage();
	await page.goto(`${BASE}/test/p0-blocks?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(2500);
	// Single viewport-fit shot (replaces the unreadable fullPage capture)
	await shot(page, 'bealls-11-p0-blocks.png');
	await page.close();
	await ctx.close();
}

// ─── Scene 15: Bealls cart with promo code applied ──────────────
async function scene15(browser) {
	console.log('\n[15] Marketplace input — Bealls cart with promo code');
	const ctx = await browser.newContext({ viewport: VIEWPORT });
	const page = await ctx.newPage();

	// Add 2 items to cart so the cart is meaningfully populated
	await page.goto(`${BASE}/category/women?dev=0`, { waitUntil: 'networkidle' });
	const html = await page.content();
	const m = html.match(/entityId[":]+(\d+)/);
	if (m) {
		try {
			await page.request.post(`${BASE}/api/cart`, {
				data: { productEntityId: parseInt(m[1], 10), quantity: 1 },
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (err) { log(`⚠ cart add failed: ${err.message}`); }
	}

	await page.goto(`${BASE}/cart?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(2000);

	// Apply a promo code
	const promoInput = page.locator('#promo-code-input').first();
	if (await promoInput.count() > 0) {
		await promoInput.fill('BEALLS10');
		await promoInput.press('Enter');
		await page.waitForTimeout(800);
	} else {
		log('⚠ promo input not found');
	}

	// Scroll so the promo code area is visible
	const promoEl = page.locator('#promo-code-input').first();
	if (await promoEl.count() > 0) {
		await promoEl.scrollIntoViewIfNeeded();
		await page.waitForTimeout(400);
	}
	await shot(page, 'bealls-15-voucherify-cart.png');
	await page.close();
	await ctx.close();
}

// ─── Scene 16: cost meter crop from /observe ────────────────────
async function scene16(browser) {
	console.log('\n[16] Cost meter — cropped SESSION COST panel');
	const ctx = await browser.newContext({ viewport: VIEWPORT });
	const page = await ctx.newPage();

	// Warm a session with a couple navs so there's something to display
	await page.goto(`${BASE}/category/women?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(2500);
	await page.goto(`${BASE}/category/men?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(2500);

	await page.goto(`${BASE}/observe?key=${OBSERVE_KEY}`, { waitUntil: 'networkidle' });
	await page.waitForFunction(() => {
		const sel = document.querySelector('select');
		return sel && sel.options && sel.options.length > 1;
	}, { timeout: 15000 }).catch(() => log('⚠ no session list'));
	await page.waitForTimeout(2500);

	// Find SESSION COST panel and crop to it + a bit of context above
	const costHeader = page.locator('text=SESSION COST').first();
	if (await costHeader.count() > 0) {
		const box = await costHeader.boundingBox();
		if (box) {
			// Crop a 720×420 region with the cost panel in the center, padded with
			// the layout-decision panel above so the frame has visual interest.
			const pad = 24;
			const clip = {
				x: Math.max(0, box.x - pad),
				y: Math.max(0, box.y - 220),       // include layout decision rows above
				width: Math.min(VIEWPORT.width - Math.max(0, box.x - pad), 480),
				height: 380,
			};
			await shot(page, 'bealls-16-cost-meter.png', { clip });
			await page.close();
			await ctx.close();
			return;
		}
	}
	log('⚠ SESSION COST not found, falling back to full observe');
	await shot(page, 'bealls-16-cost-meter.png');
	await page.close();
	await ctx.close();
}

async function main() {
	const only = (process.env.ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean);
	const should = (n) => only.length === 0 || only.includes(String(n));
	console.log(`Capture fixes — base: ${BASE}\n`);
	const browser = await chromium.launch({ headless: true });
	try {
		if (should(4)) await scene04(browser);
		if (should(8)) await scene08(browser);
		if (should(10)) await scene10(browser);
		if (should(11)) await scene11(browser);
		if (should(15)) await scene15(browser);
		if (should(16)) await scene16(browser);
	} finally {
		await browser.close();
	}
	console.log('\nDone.');
}

main().catch((err) => {
	console.error('\n✗', err.message);
	process.exit(1);
});
