/**
 * Capture real aisles-admin BigDesign tabs from a local dev server.
 *
 * Prereq: aisles-admin dev server running at http://localhost:3456 with
 * `cd ~/Workspace/dev/ref/aisles-admin && PORT=3456 npm run dev`.
 *
 * Outputs scene-09/10/11 PNGs at 1440×680 (panel-mode aware).
 */

import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/Users/nino.chavez/Workspace/dev/ref/aisles-admin/');
const { SignJWT } = require('jose');

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'screenshots');
const VIEWPORT = { width: 1440, height: 680 };
const ADMIN_URL = 'http://localhost:3456/stores/cdfqf9k6zf';
const STORE_HASH = 'cdfqf9k6zf';

// Mint a session-token JWT so the admin's `authorize()` accepts API calls
// and analytics returns real data instead of empty state. Reads the same
// JWT_KEY the dev server was started with.
async function mintSessionCookie() {
	const adminEnv = readFileSync('/Users/nino.chavez/Workspace/dev/ref/aisles-admin/.env.local', 'utf8');
	const jwtKey = (adminEnv.match(/^JWT_KEY=(.+)$/m) || [])[1];
	if (!jwtKey) throw new Error('JWT_KEY missing from aisles-admin/.env.local');
	const token = await new SignJWT({
		userId: 1,
		email: 'demo@signal-x.dev',
		storeHash: STORE_HASH,
		channelId: 1,
	})
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(new TextEncoder().encode(jwtKey));
	return {
		name: 'session-token',
		value: token,
		domain: 'localhost',
		path: '/',
		httpOnly: false,
		secure: false,
		sameSite: 'Lax',
	};
}

async function captureTab(browser, tabId, file, sessionCookie) {
	console.log(`  ${file} ← admin tab=${tabId}`);
	const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
	await ctx.addCookies([sessionCookie]);
	const page = await ctx.newPage();
	try {
		await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
		await page.waitForSelector('text=Aisles', { timeout: 15000 });
		// Wait for React hydration: aria-selected toggling on tab click is the
		// cheapest hydration probe. Sleep gives Next/Turbopack time to bind
		// onClick handlers before we drive interaction.
		await page.waitForTimeout(2500);
		if (tabId !== 'rules') {
			await page.locator(`button#${tabId}[role="tab"]`).click();
			// Wait for aria-selected to flip on the target tab — confirms state changed.
			await page.waitForFunction(
				(id) => document.getElementById(id)?.getAttribute('aria-selected') === 'true',
				tabId,
				{ timeout: 10000 },
			);
		}
		await page.waitForTimeout(2000);
		await page.screenshot({ path: join(OUT_DIR, file), fullPage: false });
	} finally {
		await page.close();
		await ctx.close();
	}
}

async function main() {
	console.log(`Capturing admin tabs from ${ADMIN_URL} at ${VIEWPORT.width}×${VIEWPORT.height}`);
	const sessionCookie = await mintSessionCookie();
	const browser = await chromium.launch({ headless: true });
	try {
		await captureTab(browser, 'rules', 'scene-09-admin-rules.png', sessionCookie);
		await captureTab(browser, 'analytics', 'scene-10-admin-analytics.png', sessionCookie);
		await captureTab(browser, 'preview', 'scene-11-admin-preview.png', sessionCookie);
	} finally {
		await browser.close();
	}
	console.log(`\nDone. Inspect: ${OUT_DIR}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
