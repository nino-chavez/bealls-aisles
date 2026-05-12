#!/usr/bin/env node
// scripts/demo-reel/capture.mjs
//
// Captures all 12 screenshots for the Aisles artifact-reaction reel.
// Three classes of capture:
//   - Live storefront: 1, 2, 3 (Bealls/BF/HC/Sleep Country montage + hunter/researcher)
//   - Live observe dashboard: 4, 5
//   - HTML mocks (dev panel, admin tabs, text cards): 6, 7, 8, 9, 10, 11, 12
//
// All output 1440×680 to match the panel-mode caption band layout
// documented in NARRATION.md (caption band sits adjacent to image,
// not on top of it).

import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(SCRIPT_DIR, 'screenshots');
const VIEWPORT = { width: 1440, height: 680 };

// Deployments
const SC_DEPLOY = 'https://aisles-demo-4.bigcommerce-testing-7727.workers.dev';
const BEALLS_DEPLOY = 'https://aisles-demo-1.biq.workers.dev';
const BF_DEPLOY = 'https://aisles-demo-2.biq.workers.dev';
const HC_DEPLOY = 'https://aisles-demo-3.biq.workers.dev';

const filter = process.argv.slice(2);
const want = (id) => filter.length === 0 || filter.some((f) => id.startsWith(f));

await mkdir(OUT_DIR, { recursive: true });
console.log(`Capturing to ${OUT_DIR} at ${VIEWPORT.width}×${VIEWPORT.height}\n`);

const browser = await chromium.launch();

try {
	if (want('scene-01')) await captureFourMerchantsMontage(browser);
	if (want('scene-02a')) await captureAIBuildingState(browser, 'hunter', 'scene-02a-ai-building.png');
	if (want('scene-02')) await captureStorefrontPersona(browser, 'hunter', 'scene-02-hunter-layout.png');
	if (want('scene-03')) await captureStorefrontPersona(browser, 'researcher', 'scene-03-researcher-layout.png');
	if (want('scene-04')) await captureObserveSession(browser);
	if (want('scene-05')) await captureObserveLogs(browser);
	if (want('scene-06')) await renderBigQueryDataCard(browser);
	if (want('scene-07')) await renderCalibrationVerdict(browser);
	if (want('scene-08')) await renderReplayRunning(browser);
	if (want('scene-09')) await renderAdminRules(browser);
	if (want('scene-10')) await renderAdminAnalytics(browser);
	if (want('scene-11')) await renderAdminPreview(browser);
	if (want('scene-12')) await renderClose(browser);
} finally {
	await browser.close();
}

console.log(`\nDone. Inspect: ${OUT_DIR}`);

// ─── Live captures ─────────────────────────────────────────────────

async function captureFourMerchantsMontage(browser) {
	console.log('  scene-01-four-merchants.png ← four-deploy montage');
	// Capture each at full size (1440 wide so the homepage hero/nav reads),
	// then downsample sharply in the composite. Avoids aliasing from a tiny
	// viewport.
	const CAPTURE = { width: 1440, height: 680 };
	const ctx = await browser.newContext({ viewport: CAPTURE });

	const merchants = [
		{ url: BEALLS_DEPLOY, label: 'Bealls', file: '/tmp/montage-bealls.png' },
		{ url: BF_DEPLOY, label: 'Bealls Florida', file: '/tmp/montage-bf.png' },
		{ url: HC_DEPLOY, label: 'Home Centric', file: '/tmp/montage-hc.png' },
		{ url: SC_DEPLOY, label: 'Sleep Country', file: '/tmp/montage-sc.png' },
	];

	for (const m of merchants) {
		const page = await ctx.newPage();
		try {
			await page.goto(m.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
			await page.waitForTimeout(6000);
			await page.screenshot({ path: m.file, fullPage: false });
			console.log(`    ${m.label} captured`);
		} catch (err) {
			console.log(`    ${m.label} ${err.message}`);
		} finally {
			await page.close();
		}
	}
	await ctx.close();

	const out = join(OUT_DIR, 'scene-01-four-merchants.png');
	// Build 2x2: each source resized to 720x340, composited at one of four
	// origins, with a brand label burned in at the right offset for that
	// quadrant. Each quadrant is built as a sub-magick command via -annotate
	// after compositing, with explicit absolute coordinates.
	const ANNOTATE_FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf';
	const POS = [
		{ file: merchants[0].file, x: 0,   y: 0,   label: 'Bealls' },
		{ file: merchants[1].file, x: 720, y: 0,   label: 'Bealls Florida' },
		{ file: merchants[2].file, x: 0,   y: 340, label: 'Home Centric' },
		{ file: merchants[3].file, x: 720, y: 340, label: 'Sleep Country' },
	];

	const args = ['-size', '1440x680', 'xc:#0a0a0a'];
	// Composite all four downsampled tiles first
	for (const p of POS) {
		args.push(
			'(', p.file, '-resize', '720x340', ')',
			'-gravity', 'northwest',
			'-geometry', `+${p.x}+${p.y}`,
			'-composite',
		);
	}
	// Thin grid lines
	args.push('-fill', '#0a0a0a',
		'-draw', 'rectangle 718,0 722,680',
		'-draw', 'rectangle 0,338 1440,342',
	);
	// Brand labels — annotate uses gravity+offset; use NW gravity and
	// per-quadrant absolute offsets. Each label gets a translucent dark
	// pill background so it reads over any homepage hero color.
	args.push('-gravity', 'northwest', '-font', ANNOTATE_FONT);
	for (const p of POS) {
		const lx = p.x + 16;
		const ly = p.y + 16;
		// Background pill
		args.push(
			'(', '-size', '180x32', 'xc:rgba(10,10,10,0.78)', ')',
			'-geometry', `+${lx - 8}+${ly - 8}`, '-composite',
		);
		// Label text
		args.push(
			'-fill', '#fafafa',
			'-pointsize', '18',
			'-annotate', `+${lx}+${ly + 14}`, p.label,
		);
	}
	args.push(out);
	execSync(`magick ${args.map((a) => JSON.stringify(a)).join(' ')}`, { stdio: 'inherit' });
}

async function captureStorefrontPersona(browser, persona, file) {
	console.log(`  ${file} ← Sleep Country PLP, intent=${persona}, dev badges visible`);
	const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
	const page = await ctx.newPage();
	try {
		// `dev=true` exposes the orange "AI <block> · <persona>" badges on each
		// AI-composed block so the screenshot shows engine provenance, not just
		// a finished page. `fresh=1` busts the layout cache so we always capture
		// a freshly composed view (matches the persona we're forcing).
		await page.goto(`${SC_DEPLOY}/category/mattresses?intent=${persona}&dev=true&fresh=1`, {
			waitUntil: 'networkidle',
			timeout: 30000,
		});
		// AI stream typically completes in 6–10s; wait long enough that all
		// blocks settle and the dev badges render.
		await page.waitForTimeout(15000);
		await page.screenshot({ path: join(OUT_DIR, file), fullPage: false });
	} finally {
		await page.close();
		await ctx.close();
	}
}

// Capture the AI-building moment: cold load with `fresh=1` so cache is bypassed,
// screenshot ~1.5s in when the "AI Personalization in progress / Building your
// next steps for X" intermediate state is visible. This is the dynamic shot —
// proves the engine is actually composing, not pre-baked.
async function captureAIBuildingState(browser, persona, file) {
	console.log(`  ${file} ← Sleep Country PLP, ${persona} BUILDING state`);
	const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
	const page = await ctx.newPage();
	try {
		// Don't wait for networkidle — we WANT to capture mid-flight.
		const nav = page.goto(`${SC_DEPLOY}/category/mattresses?intent=${persona}&dev=true&fresh=1`, {
			waitUntil: 'commit',
			timeout: 30000,
		});
		await nav;
		// Wait long enough for the layout-building section to render but not so
		// long that the AI completes and replaces it. The "AI Personalization in
		// progress" panel appears almost immediately and stays for ~6–10s.
		await page.waitForSelector('[aria-busy="true"]', { timeout: 5000 });
		await page.waitForTimeout(800);
		await page.screenshot({ path: join(OUT_DIR, file), fullPage: false });
	} finally {
		await page.close();
		await ctx.close();
	}
}

async function captureObserveSession(browser) {
	const file = 'scene-04-observe-session.png';
	console.log(`  ${file} ← /observe (session view)`);
	const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
	const page = await ctx.newPage();
	try {
		// First, generate some session signal by visiting a category
		await page.goto(`${SC_DEPLOY}/category/mattresses?dev=1&_replay_ref=facebook.com`, { waitUntil: 'networkidle', timeout: 30000 });
		await page.waitForTimeout(8000);
		// Then visit /observe to see telemetry of that session
		await page.goto(`${SC_DEPLOY}/observe`, { waitUntil: 'networkidle', timeout: 30000 });
		await page.waitForTimeout(4000);
		await page.screenshot({ path: join(OUT_DIR, file), fullPage: false });
	} finally {
		await page.close();
		await ctx.close();
	}
}

async function captureObserveLogs(browser) {
	const file = 'scene-05-observe-logs.png';
	console.log(`  ${file} ← /observe (cost/latency/cache panel)`);
	const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
	const page = await ctx.newPage();
	try {
		// Trigger fresh AI generations across two personas so the cost panel
		// has data — both `latestLog` and `cumulativeStats` need >=1 gen.
		await page.goto(`${SC_DEPLOY}/category/mattresses?intent=hunter&fresh=1`, { waitUntil: 'networkidle', timeout: 30000 });
		await page.waitForTimeout(10000);
		await page.goto(`${SC_DEPLOY}/category/pillows?intent=researcher&fresh=1`, { waitUntil: 'networkidle', timeout: 30000 });
		await page.waitForTimeout(10000);
		// Now visit /observe — latestLog + Session Cost panel will render
		await page.goto(`${SC_DEPLOY}/observe`, { waitUntil: 'networkidle', timeout: 30000 });
		await page.waitForTimeout(4000);
		// Scroll the LAYOUT DECISION / Session Cost block into view
		await page.evaluate(() => {
			const heading = Array.from(document.querySelectorAll('h2, h3')).find((h) =>
				/layout decision|session cost|generation|log/i.test(h.textContent || ''),
			);
			heading?.scrollIntoView({ block: 'start' });
		});
		await page.waitForTimeout(800);
		await page.screenshot({ path: join(OUT_DIR, file), fullPage: false });
	} finally {
		await page.close();
		await ctx.close();
	}
}

// ─── HTML/text card renders ────────────────────────────────────────

async function renderBigQueryDataCard(browser) {
	const file = 'scene-06-bigquery-data.png';
	console.log(`  ${file} ← BigQuery data card`);
	await renderCard(browser, file, `
		<div class="card-eyebrow">Sleep Country · BigQuery extract</div>
		<div class="card-stat">11,629 sessions</div>
		<div class="card-stat">29,870 events</div>
		<div class="card-stat-sub">7-week window · Feb 7 – Mar 27</div>
		<div class="card-footnote">hashed IDs · hour-bucketed · no PII · privacy-filtered before extract</div>
	`, { stat: '#fbbf24' });
}

async function renderCalibrationVerdict(browser) {
	const file = 'scene-07-calibration-verdict.png';
	console.log(`  ${file} ← calibration verdict card`);
	await renderHtmlPage(browser, file, `
		<h2>Calibration verdict — sleep retail</h2>
		<div class="row">
			<div class="rule">
				<div class="rule-name"><code>referrer-social</code></div>
				<div class="bad">Off-target</div>
				<div class="metric"><span class="num">0.2%</span> on gatherer</div>
				<div class="fix">→ flips to <strong>hunter</strong></div>
			</div>
			<div class="rule">
				<div class="rule-name"><code>in-session-search</code></div>
				<div class="bad">Half-wrong</div>
				<div class="metric"><span class="num">1.4%</span> hunter · <span class="num good">95.0%</span> researcher</div>
				<div class="fix">→ drops hunter half</div>
			</div>
			<div class="rule">
				<div class="rule-name"><code>single-category-focus</code></div>
				<div class="bad">Inverted</div>
				<div class="metric"><span class="num">0.0%</span> on hunter</div>
				<div class="fix">→ flips to <strong>researcher</strong></div>
			</div>
		</div>
		<div class="footer">6 of 10 testable rules transferred unchanged · 3 corrected per-brand · ADR-011</div>
	`);
}

async function renderReplayRunning(browser) {
	const file = 'scene-08-replay-running.png';
	console.log(`  ${file} ← replay-running mock`);
	const html = `
		<div class="page-strip">aisles-demo-4 · sleepcountry · /category/bedding · ?_replay_ref=facebook.com</div>
		<div class="dev-panel">
			<div class="header">
				<span class="dot"></span>
				<span class="title">DEV</span>
				<span class="surface">/category/bedding</span>
				<span class="primary">
					<span class="primary-name">hunter</span>
					<span class="primary-prob">86%</span>
				</span>
			</div>
			<div class="body">
				<div class="line">
					Primary: <strong>hunter</strong> (86% prob, 6% gap)
					· Source: <strong>request</strong> · Signals: 4
					<span class="hit">· primed by: facebook</span>
				</div>
				<div class="probs">
					<div class="prob"><span class="prob-name">gatherer</span><div class="prob-bar"><div class="prob-fill" style="width:6%"></div></div><span class="prob-pct">6%</span></div>
					<div class="prob primary"><span class="prob-name">hunter</span><div class="prob-bar"><div class="prob-fill" style="width:86%"></div></div><span class="prob-pct">86%</span></div>
					<div class="prob"><span class="prob-name">researcher</span><div class="prob-bar"><div class="prob-fill" style="width:5%"></div></div><span class="prob-pct">5%</span></div>
					<div class="prob"><span class="prob-name">gifter</span><div class="prob-bar"><div class="prob-fill" style="width:3%"></div></div><span class="prob-pct">3%</span></div>
				</div>
				<div class="replay">
					<div class="replay-head">
						<select class="picker"><option selected>Hunter: Facebook ad → bedding cart (6 ev, GT:hunter)</option></select>
						<button class="stop-btn">⏹ Stop</button>
					</div>
					<div class="narrative">Real shopper from a Meta paid-social ad — anonymized, hour-bucketed, but real.</div>
					<div class="status-line">Playing <strong>Hunter: Facebook ad → bedding cart</strong> · ground truth: <span class="gt">Hunter</span></div>
					<div class="bar"><div class="bar-fill" style="width:67%"></div></div>
					<div class="status-line">4/6 · last: <code>VIEW_PRODUCT</code> <span class="product">Nautica Jettison Quilt Set</span> · next: <code>ADD_TO_CART</code> in 2.4s</div>
				</div>
			</div>
		</div>
	`;
	await renderHtmlPage(browser, file, html);
}

async function renderAdminRules(browser) {
	const file = 'scene-09-admin-rules.png';
	console.log(`  ${file} ← admin Merchandising Rules tab`);
	await renderAdminPage(browser, file, 'rules', `
		<div class="admin-toolbar">
			<button class="btn-primary">+ Add Rule</button>
			<select class="filter"><option>All Personas</option></select>
			<select class="filter"><option>All Categories</option></select>
		</div>
		<table class="admin-table">
			<thead><tr><th>Type</th><th>Persona</th><th>Category</th><th>Product</th><th>Window</th><th>Status</th></tr></thead>
			<tbody>
				<tr><td><span class="tag pin">Pin</span></td><td>Hunter</td><td>Mattresses</td><td>SC-MAT-005 — Endy Queen</td><td>—</td><td><span class="status-on">Active</span></td></tr>
				<tr><td><span class="tag boost">Boost</span></td><td>Researcher</td><td>Mattresses</td><td>—</td><td>Mar 1 – Mar 31</td><td><span class="status-on">Active</span></td></tr>
				<tr><td><span class="tag exclude">Exclude</span></td><td>—</td><td>Pillows</td><td>SC-PIL-005 — Bamboo Charcoal</td><td>—</td><td><span class="status-on">Active</span></td></tr>
				<tr><td><span class="tag seasonal">Seasonal</span></td><td>Gifter</td><td>Bedding</td><td>—</td><td>May 1 – May 14</td><td><span class="status-off">Scheduled</span></td></tr>
				<tr><td><span class="tag pin">Pin</span></td><td>Hunter</td><td>Bedding</td><td>SC-BED-005 — Hutterite Down Duvet</td><td>—</td><td><span class="status-on">Active</span></td></tr>
			</tbody>
		</table>
		<div class="footer-line">5 active rules · 1 scheduled · last edit by merchandising@sleepcountry.ca · 2 hours ago</div>
	`);
}

async function renderAdminAnalytics(browser) {
	const file = 'scene-10-admin-analytics.png';
	console.log(`  ${file} ← admin Analytics tab`);
	await renderAdminPage(browser, file, 'analytics', `
		<div class="stat-grid">
			<div class="stat-card"><div class="stat-label">Total generations</div><div class="stat-value">2,847</div><div class="stat-detail">+18% vs prior 7d</div></div>
			<div class="stat-card"><div class="stat-label">Cache hit rate</div><div class="stat-value">68%</div><div class="stat-detail">1,936 / 2,847</div></div>
			<div class="stat-card"><div class="stat-label">7-day cost</div><div class="stat-value">$8.42</div><div class="stat-detail">avg $1.20/day</div></div>
			<div class="stat-card"><div class="stat-label">Avg generation</div><div class="stat-value">847ms</div><div class="stat-detail">cold-start: 6.2s</div></div>
		</div>
		<div class="admin-section">
			<div class="section-h">Cost by persona, last 7 days</div>
			<table class="admin-table">
				<thead><tr><th>Persona</th><th>Generations</th><th>Cost</th><th>Cache hits</th></tr></thead>
				<tbody>
					<tr><td>Researcher</td><td>1,124</td><td>$3.21</td><td>743 (66%)</td></tr>
					<tr><td>Hunter</td><td>892</td><td>$2.84</td><td>638 (72%)</td></tr>
					<tr><td>Gatherer</td><td>614</td><td>$1.92</td><td>421 (69%)</td></tr>
					<tr><td>Gifter</td><td>217</td><td>$0.45</td><td>134 (62%)</td></tr>
				</tbody>
			</table>
		</div>
	`);
}

async function renderAdminPreview(browser) {
	const file = 'scene-11-admin-preview.png';
	console.log(`  ${file} ← admin Layout Preview tab`);
	await renderAdminPage(browser, file, 'preview', `
		<div class="preview-controls">
			<label>Surface</label><select class="filter"><option>Category PLP</option></select>
			<label>Category</label><select class="filter"><option>Mattresses</option></select>
			<label>Persona</label><select class="filter"><option>Researcher</option></select>
			<button class="btn-primary">↻ Regenerate</button>
		</div>
		<div class="preview-frame">
			<div class="preview-tag">Live preview · pending edits applied · last regenerated 12 sec ago</div>
			<div class="preview-stack">
				<div class="preview-block ai">▸ category-header · "Compare 14 mattresses by feel and firmness"</div>
				<div class="preview-block ai">▸ comparison-table · 4 cols · spec-forward (researcher)</div>
				<div class="preview-block authored">▸ pinned-product · SC-MAT-005 (rule: Hunter pin override deferred to researcher view)</div>
				<div class="preview-block ai">▸ product-grid · 12 items · sort: rating-desc</div>
				<div class="preview-block ai">▸ trust-strip · "Try it risk-free for 100 nights"</div>
				<div class="preview-block fallback">▸ footer · static</div>
			</div>
		</div>
	`);
}

async function renderClose(browser) {
	const file = 'scene-12-close.png';
	console.log(`  ${file} ← close card`);
	await renderCard(browser, file, `
		<div class="card-brand">AISLES</div>
		<div class="card-tagline">Calibrated, not heuristic.</div>
	`, { stat: '#fbbf24', size: 'close' });
}

// ─── Render helpers ────────────────────────────────────────────────

async function renderCard(browser, file, bodyHtml, opts = {}) {
	const accent = opts.stat || '#fbbf24';
	const isClose = opts.size === 'close';
	const ctx = await browser.newContext({ viewport: VIEWPORT });
	const page = await ctx.newPage();
	try {
		const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 64px 80px; background: #0a0a0c; color: #e4e4e7; font: 16px/1.55 -apple-system, system-ui, sans-serif; height: ${VIEWPORT.height}px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
  .card-eyebrow { color: ${accent}; font-size: 28px; font-weight: 700; letter-spacing: 0.04em; margin-bottom: 56px; }
  .card-stat { font-size: 76px; font-weight: 800; color: #f4f4f5; line-height: 1.1; }
  .card-stat-sub { font-size: 36px; color: #d4d4d8; margin-top: 32px; font-weight: 600; }
  .card-footnote { color: #71717a; font-size: 18px; margin-top: 56px; letter-spacing: 0.02em; }
  .card-brand { color: ${accent}; font-size: 88px; font-weight: 800; letter-spacing: 0.04em; }
  .card-tagline { color: #f4f4f5; font-size: 44px; font-weight: 600; margin-top: 40px; }
</style></head><body>${bodyHtml}</body></html>`;
		await page.setContent(html, { waitUntil: 'load' });
		await page.screenshot({ path: join(OUT_DIR, file), fullPage: false });
	} finally {
		await page.close();
		await ctx.close();
	}
}

async function renderHtmlPage(browser, file, bodyHtml) {
	const ctx = await browser.newContext({ viewport: VIEWPORT });
	const page = await ctx.newPage();
	try {
		const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
${commonStyles()}
${devPanelStyles()}
${calibrationStyles()}
</style></head><body>${bodyHtml}</body></html>`;
		await page.setContent(html, { waitUntil: 'load' });
		await page.screenshot({ path: join(OUT_DIR, file), fullPage: false });
	} finally {
		await page.close();
		await ctx.close();
	}
}

async function renderAdminPage(browser, file, activeTab, bodyHtml) {
	const ctx = await browser.newContext({ viewport: VIEWPORT });
	const page = await ctx.newPage();
	try {
		const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
${commonStyles()}
${adminStyles()}
</style></head><body>
<div class="admin-shell">
	<div class="admin-header">
		<div class="bc-chrome">
			<span class="bc-store">SLEEP COUNTRY · cdfqf9k6zf.mybigcommerce.com</span>
			<span class="bc-app">Apps › Aisles</span>
		</div>
		<h1>Aisles</h1>
		<div class="admin-sub">AI-powered storefront personalization</div>
		<div class="admin-tabs">
			<div class="tab ${activeTab === 'rules' ? 'active' : ''}">Merchandising Rules</div>
			<div class="tab ${activeTab === 'analytics' ? 'active' : ''}">Analytics</div>
			<div class="tab ${activeTab === 'preview' ? 'active' : ''}">Layout Preview</div>
		</div>
	</div>
	<div class="admin-body">${bodyHtml}</div>
</div>
</body></html>`;
		await page.setContent(html, { waitUntil: 'load' });
		await page.screenshot({ path: join(OUT_DIR, file), fullPage: false });
	} finally {
		await page.close();
		await ctx.close();
	}
}

function commonStyles() {
	return `
		* { box-sizing: border-box; }
		body { margin: 0; padding: 0; background: #f9fafb; color: #18181b; font: 14px/1.5 -apple-system, system-ui, sans-serif; height: ${VIEWPORT.height}px; }
	`;
}

function calibrationStyles() {
	return `
		body { padding: 48px 72px; background: #0a0a0c; color: #e4e4e7; }
		h2 { color: #fbbf24; font-size: 28px; font-weight: 700; margin: 0 0 28px; }
		.row { display: flex; flex-direction: column; gap: 16px; }
		.rule { display: grid; grid-template-columns: 280px 100px 1fr 1fr; gap: 24px; align-items: center; padding: 16px 22px; background: #18181b; border-left: 4px solid #ef4444; border-radius: 6px; }
		.rule-name code { font-family: 'JetBrains Mono', monospace; font-size: 16px; color: #fbbf24; background: transparent; }
		.bad { color: #fca5a5; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
		.metric { color: #d4d4d8; font-size: 15px; }
		.num { font-family: 'JetBrains Mono', monospace; color: #fca5a5; font-weight: 700; }
		.num.good { color: #86efac; }
		.fix { color: #93c5fd; font-size: 15px; }
		.fix strong { color: #fff; }
		.footer { margin-top: 28px; padding-top: 20px; border-top: 1px solid #27272a; color: #71717a; font-size: 13px; text-align: center; }
	`;
}

function devPanelStyles() {
	return `
		body { padding: 56px 72px; background: #0a0a0c; color: #e4e4e7; font: 13px/1.5 -apple-system, system-ui, sans-serif; }
		.page-strip { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #71717a; padding: 6px 14px; background: #18181b; border-radius: 4px; margin-bottom: 16px; display: inline-block; }
		.dev-panel { background: #09090b; border: 1px solid #27272a; border-radius: 8px; max-width: 1100px; }
		.dev-panel .header { display: flex; align-items: center; gap: 10px; padding: 12px 18px; background: linear-gradient(180deg, #18181b, #09090b); border-bottom: 1px solid #27272a; border-radius: 8px 8px 0 0; }
		.dev-panel .dot { width: 7px; height: 7px; background: #ef4444; border-radius: 50%; box-shadow: 0 0 6px rgba(239, 68, 68, 0.6); }
		.dev-panel .title { font-size: 12px; font-weight: 600; color: #fafafa; letter-spacing: 0.04em; }
		.dev-panel .surface { font-size: 12px; color: #71717a; font-family: 'JetBrains Mono', monospace; }
		.dev-panel .primary { margin-left: auto; display: flex; align-items: center; gap: 6px; }
		.dev-panel .primary-name { color: #fbbf24; font-weight: 700; text-transform: capitalize; font-size: 13px; }
		.dev-panel .primary-prob { color: #d4d4d8; font-family: 'JetBrains Mono', monospace; font-size: 13px; }
		.dev-panel .body { padding: 16px 22px; }
		.dev-panel .line { font-size: 13px; color: #d4d4d8; margin-bottom: 14px; line-height: 1.55; }
		.dev-panel .line strong { color: #fff; font-weight: 600; }
		.dev-panel .hit { color: #86efac; }
		.dev-panel .probs { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
		.dev-panel .prob { display: grid; grid-template-columns: 100px 1fr 50px; align-items: center; gap: 12px; }
		.dev-panel .prob-name { font-size: 12px; color: #71717a; text-transform: capitalize; font-family: 'JetBrains Mono', monospace; }
		.dev-panel .prob.primary .prob-name { color: #fbbf24; font-weight: 700; }
		.dev-panel .prob-bar { height: 6px; background: #18181b; border-radius: 3px; overflow: hidden; }
		.dev-panel .prob-fill { height: 100%; background: #3f3f46; }
		.dev-panel .prob.primary .prob-fill { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
		.dev-panel .prob-pct { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #d4d4d8; text-align: right; }
		.replay { padding-top: 14px; border-top: 1px solid #27272a; }
		.replay-head { display: flex; gap: 10px; margin-bottom: 8px; }
		.picker { flex: 1; background: #18181b; color: #f4f4f5; border: 1px solid #3f3f46; border-radius: 4px; padding: 7px 11px; font-size: 12px; }
		.stop-btn { background: rgba(220, 38, 38, 0.18); border: 1px solid rgba(220, 38, 38, 0.4); color: #fca5a5; border-radius: 4px; padding: 7px 14px; font-size: 12px; }
		.narrative { font-size: 11px; color: #71717a; font-style: italic; margin-bottom: 10px; }
		.status-line { font-size: 11px; color: #d4d4d8; margin: 6px 0; }
		.status-line code { background: #27272a; padding: 1px 5px; border-radius: 3px; font-size: 10px; font-family: 'JetBrains Mono', monospace; color: #fbbf24; }
		.gt { color: #fbbf24; font-weight: 600; }
		.product { color: #93c5fd; }
		.bar { height: 4px; background: #27272a; border-radius: 2px; margin: 8px 0; }
		.bar-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); border-radius: 2px; }
	`;
}

function adminStyles() {
	return `
		.admin-shell { background: #fff; }
		.bc-chrome { display: flex; gap: 16px; padding: 8px 32px; background: #1d2530; color: #b0b8c4; font-size: 11px; letter-spacing: 0.04em; }
		.bc-store { font-weight: 700; color: #fff; }
		.bc-app { color: #93a3b8; }
		.admin-header { padding: 24px 40px 0; border-bottom: 1px solid #e5e7eb; }
		.admin-header h1 { margin: 0; font-size: 28px; font-weight: 700; color: #18181b; }
		.admin-sub { color: #6b7280; font-size: 13px; margin-top: 4px; }
		.admin-tabs { display: flex; gap: 0; margin-top: 24px; }
		.tab { padding: 12px 20px; font-size: 13px; font-weight: 600; color: #6b7280; border-bottom: 2px solid transparent; cursor: pointer; }
		.tab.active { color: #2563eb; border-bottom-color: #2563eb; }
		.admin-body { padding: 24px 40px; }
		.admin-toolbar { display: flex; gap: 12px; margin-bottom: 20px; align-items: center; }
		.btn-primary { background: #2563eb; color: #fff; border: 0; padding: 8px 14px; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer; }
		.filter { padding: 7px 12px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; color: #18181b; font-size: 13px; }
		.admin-table { width: 100%; border-collapse: collapse; font-size: 12px; }
		.admin-table th, .admin-table td { text-align: left; padding: 10px 14px; border-bottom: 1px solid #e5e7eb; }
		.admin-table th { color: #6b7280; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; background: #f9fafb; }
		.admin-table td { color: #18181b; }
		.tag { display: inline-block; padding: 2px 8px; font-size: 10px; font-weight: 700; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.04em; }
		.tag.pin { background: #ddd6fe; color: #5b21b6; }
		.tag.boost { background: #d1fae5; color: #065f46; }
		.tag.exclude { background: #fecaca; color: #991b1b; }
		.tag.seasonal { background: #fed7aa; color: #9a3412; }
		.status-on { color: #059669; font-weight: 600; }
		.status-off { color: #d97706; font-weight: 600; }
		.footer-line { margin-top: 16px; color: #6b7280; font-size: 11px; }
		.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
		.stat-card { padding: 14px 18px; border: 1px solid #e5e7eb; border-radius: 6px; }
		.stat-label { color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
		.stat-value { font-size: 26px; font-weight: 700; color: #18181b; margin-top: 4px; }
		.stat-detail { font-size: 11px; color: #6b7280; margin-top: 2px; }
		.admin-section { margin-top: 8px; }
		.section-h { font-size: 13px; font-weight: 700; color: #18181b; margin-bottom: 10px; }
		.preview-controls { display: flex; gap: 12px; margin-bottom: 20px; align-items: center; }
		.preview-controls label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
		.preview-frame { border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; background: #f9fafb; }
		.preview-tag { font-size: 11px; color: #2563eb; margin-bottom: 12px; font-weight: 600; }
		.preview-stack { display: flex; flex-direction: column; gap: 6px; }
		.preview-block { padding: 9px 12px; border-radius: 4px; font-size: 12px; font-family: 'JetBrains Mono', monospace; }
		.preview-block.ai { background: #fef3c7; color: #92400e; border-left: 3px solid #f59e0b; }
		.preview-block.authored { background: #dbeafe; color: #1e40af; border-left: 3px solid #2563eb; }
		.preview-block.fallback { background: #f3f4f6; color: #374151; border-left: 3px solid #9ca3af; }
	`;
}
