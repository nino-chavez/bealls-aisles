#!/usr/bin/env node
/**
 * Capture script for the bealls/admin/observe demo reel (post-2026-05-01).
 *
 * Auto-captures every scene that lives on the public storefronts (no auth).
 * Admin scenes (BC iframe) are captured manually — see README §Manual scenes.
 *
 * Run after pre-warming so the storefront screenshots show cached, sub-100ms
 * layouts. Run with FRESH=1 to capture cold-start states (showing the AI
 * loaders) instead.
 *
 * Output: scripts/demo-reel/screenshots/NN-name.png
 */

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const BEALLS = 'https://aisles-demo-1-signal-x-studio-labs.vercel.app';
const BEALLS_FL = 'https://aisles-demo-2-signal-x-studio-labs.vercel.app';
const HC = 'https://aisles-demo-3-signal-x-studio-labs.vercel.app';

const FRESH = process.env.FRESH === '1';
const FRESH_QS = FRESH ? 'fresh=1' : '';

/** Append a query param to a URL safely. */
function withQs(url, ...qs) {
	const params = qs.filter(Boolean).join('&');
	if (!params) return url;
	return url + (url.includes('?') ? '&' : '?') + params;
}

/** Capture a screenshot at the standard demo-reel resolution. */
async function shot(page, url, filename, opts = {}) {
	const { wait = 'networkidle', preWait = 0, postWait = 1500, scrollY = 0 } = opts;
	console.log(`  → ${url}`);
	await page.goto(url, { waitUntil: wait });
	if (preWait) await page.waitForTimeout(preWait);
	if (scrollY) await page.evaluate((y) => window.scrollTo(0, y), scrollY);
	await page.waitForTimeout(postWait);
	const fullPath = path.join(OUT, filename);
	await page.screenshot({ path: fullPath, fullPage: false });
	console.log(`    saved ${filename}`);
}

async function main() {
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		viewport: { width: 1440, height: 900 },
		deviceScaleFactor: 2,
	});
	const page = await context.newPage();

	console.log('--- Capturing storefront scenes ---');

	// 01 — Bealls home, warm cache, default persona
	await shot(page, withQs(BEALLS, FRESH_QS), '01-bealls-home-warm.png');

	// 02 — Same page with dev overlay active. Wait for badges to render.
	await shot(page, withQs(BEALLS, 'dev=1', FRESH_QS), '02-dev-overlay-active.png', {
		postWait: 2500,
	});

	// 03 — Persona switch on PLP (more visible than home, where the hero
	// is a static photographic asset that doesn't vary by persona).
	await shot(
		page,
		withQs(`${BEALLS}/category/women`, 'intent=hunter', FRESH_QS),
		'03-persona-hunter-plp.png',
	);

	// 04 — Women's PLP, default persona
	await shot(page, withQs(`${BEALLS}/category/women`, FRESH_QS), '04-plp-women-warm.png');

	// 05 — Refinement chat — open the chat overlay first
	await page.goto(withQs(`${BEALLS}/category/women`, FRESH_QS), { waitUntil: 'networkidle' });
	await page.waitForTimeout(1000);
	// Try to click the refinement chat trigger (selector may vary; adjust if needed)
	const chatTrigger = page.locator('[data-testid="refinement-chat-trigger"], button:has-text("Refine")').first();
	if (await chatTrigger.isVisible().catch(() => false)) {
		await chatTrigger.click();
		await page.waitForTimeout(1500);
	}
	await page.screenshot({ path: path.join(OUT, '05-refinement-chat.png'), fullPage: false });
	console.log('    saved 05-refinement-chat.png (verify chat panel is visible — manual recapture if not)');

	// 06 — PDP with BOPIS strip. Need a ZIP that geocodes (33701 = St Pete).
	// Find a PDP URL by clicking the first product card on the women's PLP.
	await page.goto(withQs(`${BEALLS}/category/women`, FRESH_QS), { waitUntil: 'networkidle' });
	await page.waitForTimeout(1000);
	const firstProduct = page.locator('a[href^="/product/"]').first();
	const productHref = await firstProduct.getAttribute('href');
	if (productHref) {
		await shot(page, withQs(`${BEALLS}${productHref}`, 'zip=33701', FRESH_QS), '06-pdp-with-bopis.png', {
			scrollY: 200,
			postWait: 3000,
		});
	} else {
		console.warn('    skipped 06 — no product link found on PLP. Capture manually.');
	}

	// 07 — Cart drawer with AI upsell. Need to add a product first.
	await page.goto(withQs(BEALLS, FRESH_QS), { waitUntil: 'networkidle' });
	await page.waitForTimeout(1500);
	// Click the first add-to-cart button we can find. Selectors are best-effort;
	// recapture manually if this misses.
	const atc = page.locator('button:has-text("Add to Cart"), [data-testid="add-to-cart"]').first();
	if (await atc.isVisible().catch(() => false)) {
		await atc.click();
		await page.waitForTimeout(2000);
		// Open cart drawer
		const cartIcon = page.locator('[aria-label*="Cart"], [data-testid="cart-icon"]').first();
		if (await cartIcon.isVisible().catch(() => false)) {
			await cartIcon.click();
			// Capture mid-loading so the AILoadingInline is visible
			await page.waitForTimeout(800);
			await page.screenshot({ path: path.join(OUT, '07-cart-drawer-loading.png'), fullPage: false });
			console.log('    saved 07-cart-drawer-loading.png');
		}
	} else {
		console.warn('    skipped 07 — no ATC button found. Capture manually.');
	}

	// 08 — Observe dashboard
	await shot(page, `${BEALLS}/observe`, '08-observe-dashboard.png', { postWait: 3000 });

	// 14 — Bealls Florida home
	await shot(page, withQs(BEALLS_FL, FRESH_QS), '14-bealls-florida-home.png');

	// 15 — Home Centric (content mode)
	await shot(page, withQs(HC, FRESH_QS), '15-homecentric-content-mode.png');

	console.log('\n--- Auto-capture complete ---');
	console.log('Manual captures still needed (see README §Manual scenes):');
	console.log('  09-admin-inspector-list.png        (BC admin → Aisles app → Decisions Inspector)');
	console.log('  10-admin-inspector-detail.png      (Inspector → click any Inspect button)');
	console.log('  11-admin-brand-voice.png           (Brand Voice tab — show form populated)');
	console.log('  12-admin-persona-fit.png           (Persona Fit tab — show 1+ override)');
	console.log('  13-admin-workspace-switcher.png    (top-right dropdown open, all 3 brands visible)');
	console.log('  16-architecture-three-layers.png   (manual: docs/architecture/ARCHITECTURE.md diagram or repo tree)');

	await browser.close();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
