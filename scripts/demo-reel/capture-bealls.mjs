#!/usr/bin/env node
/**
 * Playwright capture script for the BEALLS reel (builder narrative, 20 scenes).
 *
 * Captures into scripts/demo-reel/screenshots/ as bealls-NN-*.png.
 * The companion captions.json drives the rest of the pipeline (generate.mjs).
 *
 * Required environment:
 *   AISLES_URL          — local dev OR Bealls Vercel preview (default: http://localhost:5173)
 *   OBSERVE_KEY         — observe dashboard query key (default: aisles-observe)
 *
 * Optional:
 *   BEALLS_URL          — defaults to AISLES_URL
 *   BEALLS_FLORIDA_URL  — Vercel preview for the Bealls Florida brand
 *   HOMECENTRIC_URL     — Vercel preview for the Home Centric brand
 *   SKIP_SCENES         — comma-separated scene numbers to skip (e.g. "6,14,16")
 *   ONLY_SCENES         — comma-separated scene numbers to run alone
 *
 * Prereqs:
 *   - Dev server (bealls-aisles) reachable at AISLES_URL
 *   - Pre-warm cache first: in bealls-aisles, `node scripts/cache/prewarm.ts`
 *   - Playwright chromium installed: npx playwright install chromium
 *   - ImageMagick installed (for the brand-swap composite)
 *
 * Manual / fragile scenes (script attempts but may need touch-up):
 *   06 — refinement chat (selector best-guess; check screenshot, fine-tune if empty)
 *   07 — return-continuity (script simulates a return visit via cookies; verify Observe shows the rules)
 *   14 — brand swap composite (needs all three brand URLs reachable)
 *   16 — cost meter (script crops from /observe; verify the panel exists in current build)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'screenshots');
const TMP_DIR = path.join(__dirname, '.tmp-capture');

const BASE_URL = (process.env.AISLES_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const BRAND_URLS = {
	bealls: (process.env.BEALLS_URL ?? BASE_URL).replace(/\/$/, ''),
	beallsflorida: (process.env.BEALLS_FLORIDA_URL ?? '').replace(/\/$/, ''),
	homecentric: (process.env.HOMECENTRIC_URL ?? '').replace(/\/$/, ''),
};
const OBSERVE_KEY = process.env.OBSERVE_KEY ?? 'aisles-observe';

const VIEWPORT = { width: 1440, height: 900 };
const FULLPAGE = false; // Most reel frames want viewport, not fullpage. Override per-scene.

const SKIP = new Set((process.env.SKIP_SCENES ?? '').split(',').map((s) => s.trim()).filter(Boolean));
const ONLY = new Set((process.env.ONLY_SCENES ?? '').split(',').map((s) => s.trim()).filter(Boolean));

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

function log(msg) { console.log(`  ${msg}`); }
function step(n, name) {
	console.log(`\n[${String(n).padStart(2, '0')}] ${name}`);
}
function shouldRun(n) {
	const key = String(n).padStart(2, '0');
	const num = String(n);
	if (ONLY.size > 0) return ONLY.has(key) || ONLY.has(num);
	if (SKIP.has(key) || SKIP.has(num)) return false;
	return true;
}

async function newPage(context) {
	const page = await context.newPage();
	await page.setViewportSize(VIEWPORT);
	return page;
}

async function shot(page, filename, opts = {}) {
	const out = path.join(OUT_DIR, filename);
	await page.screenshot({ path: out, fullPage: opts.fullPage ?? FULLPAGE, clip: opts.clip });
	log(`✓ ${filename}`);
	return out;
}

/**
 * `?dev=0` explicitly turns dev mode OFF (clears localStorage, removes the
 * body class, unmounts the DevToolbar). Use for any scene that isn't about
 * the dev panel itself — otherwise localStorage persistence from earlier
 * scenes can leave the toolbar visible where it shouldn't be.
 */

// ─── Scene 01: home (clean) ──────────────────────────────────────────
async function scene01_homeClean(context) {
	const page = await newPage(context);
	await page.goto(`${BASE_URL}/?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(1500);
	await shot(page, 'bealls-01-home-clean.png');
	await page.close();
}

// ─── Scene 02: dev instrumentation on the category page ─────────────
// Both halves of the dev tooling shown together: per-zone badges on the
// real category layout AND the floating dev panel pinned in the corner.
//
// Approach: render at deviceScaleFactor=2 (so the page is drawn at 2x
// pixel density — 2880x1800 native), force a fresh AI generation so AI
// zones are present (badges have something to label), then crop a 1440x900
// region from the upper portion that catches the editorial/grid badges,
// AND a crop of the toolbar from the bottom-right. Composite them
// side-by-side at native 2x detail so both are crisp and legible.
async function scene02_devInstrumentation(context) {
	// Use a fresh context with 2x DPR so the rendered page is high-resolution.
	// Cropping a 1440x900 region of a 2880x1800 capture is true 2x zoom with
	// no upscale blur.
	const hiDpiContext = await context.browser().newContext({
		viewport: VIEWPORT,
		deviceScaleFactor: 2,
	});
	const page = await hiDpiContext.newPage();

	// Force a fresh AI generation so badges exist on AI zones
	await page.goto(`${BASE_URL}/category/women?dev=1&fresh=1`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(7500);

	// Native 2x capture (2880x1800)
	const raw = path.join(TMP_DIR, 'dev-instrumentation-raw.png');
	await page.screenshot({ path: raw });

	// Capture the toolbar element natively (typically ~480x600 logical, 960x1200 at 2x)
	const toolbar = page.locator('[class*="devtoolbar" i], [class*="aisles-dev-toolbar" i], [data-dev-toolbar]').first();
	const toolbarTile = path.join(TMP_DIR, 'dev-instrumentation-panel.png');
	if (await toolbar.count() > 0) {
		try { await toolbar.screenshot({ path: toolbarTile }); } catch { /* fall through */ }
	}
	await page.close();
	await hiDpiContext.close();

	// Build the 1440x900 frame:
	//   - Left 940x900: a crop from the LEFT/TOP region of the page where
	//     editorial header and product grid live (badges most likely visible).
	//   - Right 500x900: the panel composited on dark background.
	const leftCrop = path.join(TMP_DIR, 'dev-instrumentation-left.png');
	// Crop 1880x1800 from the left of the 2880x1800 image (2x = 940x900 logical),
	// then resize to 940x900 to fit the left portion of our 1440x900 frame.
	execFileSync('magick', [
		raw,
		'-crop', '1880x1800+0+0',
		'+repage',
		'-resize', '940x900',
		leftCrop,
	], { stdio: 'inherit' });

	const out = path.join(OUT_DIR, 'bealls-02-dev-instrumentation.png');
	if (fs.existsSync(toolbarTile)) {
		// Resize toolbar to fit the right 500x900 region with margin
		const toolbarSized = path.join(TMP_DIR, 'dev-instrumentation-panel-sized.png');
		execFileSync('magick', [
			toolbarTile,
			'-resize', '460x880>',
			toolbarSized,
		], { stdio: 'inherit' });
		// Composite: 1440x900 dark canvas, left crop at (0,0), toolbar centered in right 500x900
		execFileSync('magick', [
			'-size', '1440x900', 'xc:#0a0a0a',
			leftCrop, '-gravity', 'northwest', '-geometry', '+0+0', '-composite',
			'(', '-size', '4x900', 'xc:#10b981', ')', '-gravity', 'northwest', '-geometry', '+940+0', '-composite',
			toolbarSized, '-gravity', 'east', '-geometry', '+20+0', '-composite',
			out,
		], { stdio: 'inherit' });
		log(`✓ bealls-02-dev-instrumentation.png (page crop + native panel composite)`);
	} else {
		// Fallback: just the left crop centered
		execFileSync('magick', [
			'-size', '1440x900', 'xc:#0a0a0a',
			leftCrop, '-gravity', 'center', '-composite',
			out,
		], { stdio: 'inherit' });
		log(`✓ bealls-02-dev-instrumentation.png (page crop only — toolbar selector not found)`);
	}
}

// ─── Scene 04: ?fresh=1 forces regeneration; capture toolbar showing latency ──
async function scene04_freshRegen(context) {
	const page = await newPage(context);
	// First, prime ?dev=1 in localStorage
	await page.goto(`${BASE_URL}/?dev=1`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(1000);
	// Now hit a different category with ?fresh=1 to bust cache + regenerate
	await page.goto(`${BASE_URL}/category/women?dev=1&fresh=1`, { waitUntil: 'networkidle' });
	// Allow the regen to finish so the toolbar entry shows real latency
	await page.waitForTimeout(6500);
	await shot(page, 'bealls-04-fresh-regen.png');
	await page.close();
}

// ─── Scene 05: /observe — operator dashboard baseline ────────────────
// Warm a session in clean shopper mode (?dev=0) so the operator view is
// the only dev-mode surface; the storefront pages don't need badges.
async function scene05_observe(context) {
	const page = await newPage(context);
	await page.goto(`${BASE_URL}/?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(1500);
	await page.goto(`${BASE_URL}/category/women?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(1500);
	await page.goto(`${BASE_URL}/observe?key=${OBSERVE_KEY}`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(3000);
	await shot(page, 'bealls-05-observe.png');
	await page.close();
}

// ─── Scene 06: Refinement chat — type a constraint, capture result ───
// FRAGILE: chat selector is best-guess. If the screenshot comes out without
// a typed message, inspect the chat component and adjust the selectors.
// No dev mode — the chat is the subject; toolbar/badges would distract.
async function scene06_refinementChat(context) {
	const page = await newPage(context);
	await page.goto(`${BASE_URL}/category/women`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(1500);
	// Try a few possible triggers
	const triggers = [
		'button[aria-label*="refine" i]',
		'button[aria-label*="chat" i]',
		'[data-refine-trigger]',
		'.refinement-chat-trigger',
	];
	let opened = false;
	for (const sel of triggers) {
		const el = page.locator(sel).first();
		if (await el.count() > 0) {
			try { await el.click(); opened = true; break; } catch { /* try next */ }
		}
	}
	if (!opened) {
		log('⚠ refinement chat trigger not found — capturing PLP as-is for manual editing');
	} else {
		await page.waitForTimeout(800);
		// Type into the chat input
		const inputs = [
			'textarea[placeholder*="refine" i]',
			'textarea[placeholder*="chat" i]',
			'input[type="text"][placeholder*="refine" i]',
			'.refinement-chat textarea',
			'.refinement-chat input',
		];
		for (const sel of inputs) {
			const el = page.locator(sel).first();
			if (await el.count() > 0) {
				try {
					await el.fill('Under fifty dollars, casual');
					await el.press('Enter');
					await page.waitForTimeout(4000); // wait for /api/refine + recompose
					break;
				} catch { /* try next */ }
			}
		}
	}
	await shot(page, 'bealls-06-refinement-chat.png');
	await page.close();
}

// ─── Scene 07: Cross-session continuity — simulate a return visit ────
// FRAGILE: this depends on the cross-session signal logic firing on a
// returning-visitor cookie. Worst-case: the screenshot still shows /observe
// without the specific rules; user can re-capture after a real return visit.
async function scene07_returnContinuity(context) {
	const page = await newPage(context);
	// First visit — clean shopper view, browse a category, dwell
	await page.goto(`${BASE_URL}/category/women?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(3000);
	// Simulate session close + return: clear sessionStorage, keep cookies
	await page.evaluate(() => sessionStorage.clear());
	// Return visit
	await page.goto(`${BASE_URL}/category/women?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(2000);
	await page.goto(`${BASE_URL}/observe?key=${OBSERVE_KEY}`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(3000);
	await shot(page, 'bealls-07-return-continuity.png');
	await page.close();
}

// ─── Scenes 08-10: PLP / PDP / Cart — clean shopper view (?dev=0) ───
// Latitude is described conceptually in narration; no badges needed
// on-screen. Avoids the toolbar visual noise from prior dev-mode scenes.
async function scene08_plpLatitude(context) {
	const page = await newPage(context);
	await page.goto(`${BASE_URL}/category/women?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(2500);
	await shot(page, 'bealls-08-plp-latitude.png');
	await page.close();
}

async function scene09_pdpLatitude(context) {
	const page = await newPage(context);
	// Discover a product slug from a PLP first
	await page.goto(`${BASE_URL}/category/women?dev=0`, { waitUntil: 'networkidle' });
	const html = await page.content();
	const match = html.match(/href="(\/product\/[^"?#]+)"/);
	const slug = match ? match[1] : '/product/sample';
	await page.goto(`${BASE_URL}${slug}?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(2500);
	await shot(page, 'bealls-09-pdp-latitude.png');
	await page.close();
}

async function scene10_cartLatitude(context) {
	const page = await newPage(context);
	// Seed a cart line so the cart page isn't empty
	await page.goto(`${BASE_URL}/category/women?dev=0`, { waitUntil: 'networkidle' });
	const html = await page.content();
	const m = html.match(/entityId[":]+(\d+)/);
	if (m) {
		try {
			await page.request.post(`${BASE_URL}/api/cart`, {
				data: { productEntityId: parseInt(m[1], 10), quantity: 1 },
				headers: { 'Content-Type': 'application/json' },
			});
		} catch { /* cart may render empty — still acceptable */ }
	}
	await page.goto(`${BASE_URL}/cart?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(2000);
	await shot(page, 'bealls-10-cart-latitude.png');
	await page.close();
}

// ─── Scene 11: block catalog fixture (fullpage, clean view) ─────────
async function scene11_p0Blocks(context) {
	const page = await newPage(context);
	await page.goto(`${BASE_URL}/test/p0-blocks?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(2000);
	await shot(page, 'bealls-11-p0-blocks.png', { fullPage: true });
	await page.close();
}

// ─── Scene 12: Code beat — Zod schema + AI Gateway call ──────────────
// HTML-rendered slide. Curated literal — more pedagogical than dumping
// the first N lines of the real source file.
function loadCodeSnippet() {
	return {
		path: 'src/lib/schema/blocks.ts  +  src/lib/server/layout.ts',
		source: `import { z } from 'zod';
import { generateObject } from 'ai';
import { gateway } from '@ai-sdk/gateway';

// 1. Block schemas — the finite vocabulary the AI selects from
export const HeroProductSchema = z.object({
  type: z.literal('hero-product'),
  productEntityId: z.number(),
  copy: z.string().max(280),
});

export const ProductGridSchema = z.object({
  type: z.literal('product-grid'),
  productEntityIds: z.array(z.number()),
  density: z.enum(['dense', 'standard', 'spacious']),
});
// ...30+ more block types

// 2. Surface schemas — composition latitude is bounded by type
export const HomeLayoutSchema = z.object({
  surface: z.literal('home'),
  sections: z.array(z.discriminatedUnion('type', [
    HeroProductSchema, ProductGridSchema, /* ... */
  ])),
});

// 3. The composition call — structured output, no malformed JSON possible
const result = await generateObject({
  model: gateway('anthropic/claude-haiku-4-5'),
  schema: HomeLayoutSchema,
  prompt: buildPrompt({ brand, persona, signals }),
});`,
	};
}

async function scene12_codeBeat(context) {
	const page = await newPage(context);
	const snippet = loadCodeSnippet();
	const html = buildCodeSlideHtml({
		filepath: snippet.path,
		source: snippet.source,
		eyebrow: 'V invariant in code',
		accent: '#10b981',
	});
	await page.setContent(html, { waitUntil: 'networkidle' });
	await page.waitForTimeout(400);
	await shot(page, 'bealls-12-code-beat.png');
	await page.close();
}

// ─── Scene 13: Brand config — Bealls block ──────────────────────────
// Curated literal — the real config.ts bealls block is 90+ lines and
// renders too dense for one frame. The literal preserves the narrative beats.
async function scene13_brandConfig(context) {
	const page = await newPage(context);
	const source = `bealls: {
  id: 'bealls',
  name: 'Bealls',
  tagline: 'Find your favorites for less',
  domain: 'off-price family apparel',

  bc: { channelId: 1846321, categoryPrefix: 'Bealls' },
  categories: { /* women, men, kids, shoes, home, beauty, ... */ },
  theme: { /* Oswald display, wine accent */ },
  homepage: { /* hero + featured + shop-by-category */ },

  prompt: {
    storeName: 'Bealls',
    personaDefinitions: { gatherer, hunter, researcher, gifter },
    voiceGuidance: 'Off-price retail, family-friendly, comparable-value-first.',
  },

  incentives: {
    freeShipping: { threshold: 99 },
    loyalty: { program: 'Bealls Bucks', tiers: ['Member', 'Plus', 'VIP'] },
  },
}`;
	const html = buildCodeSlideHtml({
		filepath: 'src/lib/brand/config.ts → bealls',
		source,
		eyebrow: 'Configuration, not code',
		accent: '#a01441', // wine
	});
	await page.setContent(html, { waitUntil: 'networkidle' });
	await page.waitForTimeout(400);
	await shot(page, 'bealls-13-brand-config.png');
	await page.close();
}

// ─── Scene 14: Brand swap — three brands side by side ────────────────
async function scene14_brandSwap(context) {
	const urls = [BRAND_URLS.bealls, BRAND_URLS.beallsflorida, BRAND_URLS.homecentric].filter(Boolean);
	if (urls.length < 3) {
		log('⚠ scene 14 needs all three brand URLs (BEALLS_URL / BEALLS_FLORIDA_URL / HOMECENTRIC_URL).');
		log('   Falling back to a single-brand capture so the reel still renders.');
		const page = await newPage(context);
		await page.goto(`${BRAND_URLS.bealls}/?dev=0`, { waitUntil: 'networkidle' });
		await page.waitForTimeout(1500);
		await shot(page, 'bealls-14-brand-swap.png');
		await page.close();
		return;
	}
	// Capture each at a portrait viewport, then composite horizontally
	const tileViewport = { width: 480, height: 900 };
	const tilePaths = [];
	for (let i = 0; i < urls.length; i++) {
		const tilePage = await context.newPage();
		await tilePage.setViewportSize(tileViewport);
		await tilePage.goto(`${urls[i]}/?dev=0`, { waitUntil: 'networkidle' });
		await tilePage.waitForTimeout(1500);
		const tile = path.join(TMP_DIR, `brand-tile-${i}.png`);
		await tilePage.screenshot({ path: tile, fullPage: false });
		tilePaths.push(tile);
		await tilePage.close();
	}
	// Composite with ImageMagick: side by side, then add a thin divider
	const out = path.join(OUT_DIR, 'bealls-14-brand-swap.png');
	execFileSync('magick', [...tilePaths, '+append', out], { stdio: 'inherit' });
	log(`✓ bealls-14-brand-swap.png (composited from ${tilePaths.length} tiles)`);
}

// ─── Scene 15: Voucherify cart — reuse v4 capture if present ─────────
async function scene15_voucherifyCart(context) {
	const v4 = path.join(OUT_DIR, 'demo-14-cart-drawer.png');
	const dest = path.join(OUT_DIR, 'bealls-15-voucherify-cart.png');
	if (fs.existsSync(v4)) {
		fs.copyFileSync(v4, dest);
		log(`✓ bealls-15-voucherify-cart.png (reused v4 demo-14-cart-drawer.png)`);
		return;
	}
	// Fallback — capture cart drawer fresh from BEALLS_URL (may not have Voucherify)
	const page = await newPage(context);
	await page.goto(`${BASE_URL}/cart`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(1500);
	await shot(page, 'bealls-15-voucherify-cart.png');
	await page.close();
}

// ─── Scene 16: Cost meter zoom from /observe ─────────────────────────
// FRAGILE: depends on Observe surfacing per-generation cost. If the panel
// doesn't exist, falls back to a clip of the generation logs section.
async function scene16_costMeter(context) {
	const page = await newPage(context);
	await page.goto(`${BASE_URL}/?dev=0`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(1500);
	await page.goto(`${BASE_URL}/observe?key=${OBSERVE_KEY}`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(2500);
	const costPanel = page.locator('[class*="cost" i], [data-cost-panel], [class*="generation-log" i]').first();
	if (await costPanel.count() > 0) {
		try {
			const box = await costPanel.boundingBox();
			if (box) {
				const pad = 24;
				const clip = {
					x: Math.max(0, box.x - pad),
					y: Math.max(0, box.y - pad),
					width: Math.min(VIEWPORT.width - Math.max(0, box.x - pad), box.width + pad * 2),
					height: Math.min(VIEWPORT.height - Math.max(0, box.y - pad), box.height + pad * 2),
				};
				await shot(page, 'bealls-16-cost-meter.png', { clip });
				await page.close();
				return;
			}
		} catch { /* fall through */ }
	}
	// Fallback: full Observe shot (user can crop in post)
	await shot(page, 'bealls-16-cost-meter.png');
	await page.close();
}

// ─── Scenes 17-19: Concept slides (HTML-rendered) ───────────────────
async function scene17_adjacentInputs(context) {
	const page = await newPage(context);
	await page.setContent(buildConceptSlideHtml({
		eyebrow: 'Where this goes — adjacent inputs',
		title: 'Your BC stack already has more signals',
		columns: [
			{
				header: 'Today',
				accent: '#737373',
				items: [
					'Request context',
					'Navigation events',
					'Interaction signals',
					'Refinement messages',
				],
			},
			{
				header: 'Already in your stack',
				accent: '#10b981',
				items: [
					'Order history (BC Admin API)',
					'LTV cohorts (BigQuery / warehouse)',
					'Clean product attrs (Feedonomics / PIM)',
					'Audience segments (martech)',
				],
			},
		],
		footnote: 'Same pipeline. Same Bayesian update. Same V invariant. The engine doesn’t care where the signal comes from.',
	}), { waitUntil: 'networkidle' });
	await page.waitForTimeout(300);
	await shot(page, 'bealls-17-adjacent-inputs.png');
	await page.close();
}

async function scene18_returningShopper(context) {
	const page = await newPage(context);
	await page.setContent(buildConceptSlideHtml({
		eyebrow: 'What that unlocks',
		title: 'Returning shopper, warm cold-start',
		columns: [
			{
				header: 'Before',
				accent: '#737373',
				items: [
					'Anonymous visitor',
					'No prior signals',
					'Gatherer prior 0.30',
					'Fresh inference from scratch',
				],
			},
			{
				header: 'With BC order history',
				accent: '#10b981',
				items: [
					'Recognized customer (last order: 6mo ago)',
					'Family-shopper persona @ 0.60',
					'Layout already tuned',
					'Refinement chat pre-loaded',
				],
			},
		],
		footnote: 'A webhook handler you’d write in an afternoon. Not future-state speculation.',
	}), { waitUntil: 'networkidle' });
	await page.waitForTimeout(300);
	await shot(page, 'bealls-18-returning-shopper.png');
	await page.close();
}

async function scene19_beyondStorefront(context) {
	const page = await newPage(context);
	await page.setContent(buildConceptSlideHtml({
		eyebrow: 'Beyond the storefront',
		title: 'Same engine, different output union',
		columns: [
			{
				header: 'Today',
				accent: '#737373',
				items: [
					'Output: page layout',
					'Schema: HomeLayoutSchema | PLPLayoutSchema | …',
					'Surface: SvelteKit renderer',
				],
			},
			{
				header: 'Tomorrow',
				accent: '#10b981',
				items: [
					'Output: email variant, push, SMS, in-app',
					'Schema: EmailVariantSchema | PushSchema | …',
					'Surface: Klaviyo, OneSignal, Twilio, native',
				],
			},
		],
		footnote: 'One decisioning layer. Same V invariant. Same observability surface.',
	}), { waitUntil: 'networkidle' });
	await page.waitForTimeout(300);
	await shot(page, 'bealls-19-beyond-storefront.png');
	await page.close();
}

async function scene20_builderTakeaway(context) {
	const page = await newPage(context);
	await page.setContent(buildTakeawaySlideHtml(), { waitUntil: 'networkidle' });
	await page.waitForTimeout(300);
	await shot(page, 'bealls-20-builder-takeaway.png');
	await page.close();
}

// ─── HTML slide templates ────────────────────────────────────────────

function buildCodeSlideHtml({ filepath, source, eyebrow, accent }) {
	// Single-pass tokenizer — avoids the classic chained-regex bug where
	// later replacements match against already-inserted <span> markup.
	const KEYWORDS = new Set(['import', 'export', 'const', 'let', 'var', 'function', 'async', 'await', 'return', 'from', 'as', 'new', 'class', 'interface', 'type', 'enum', 'if', 'else']);
	const BOOLS = new Set(['true', 'false', 'null', 'undefined']);
	function escapeHtml(s) {
		return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
	}
	function tokenize(src) {
		const out = [];
		let i = 0;
		const n = src.length;
		while (i < n) {
			const ch = src[i];
			// line comment
			if (ch === '/' && src[i + 1] === '/') {
				let j = i;
				while (j < n && src[j] !== '\n') j++;
				out.push(`<span class="cm">${escapeHtml(src.slice(i, j))}</span>`);
				i = j;
				continue;
			}
			// block comment
			if (ch === '/' && src[i + 1] === '*') {
				let j = i + 2;
				while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j++;
				j = Math.min(n, j + 2);
				out.push(`<span class="cm">${escapeHtml(src.slice(i, j))}</span>`);
				i = j;
				continue;
			}
			// strings (single, double, template — no escape handling, demo-grade)
			if (ch === '\'' || ch === '"' || ch === '`') {
				const quote = ch;
				let j = i + 1;
				while (j < n && src[j] !== quote) {
					if (src[j] === '\\') j += 2; else j++;
				}
				j = Math.min(n, j + 1);
				out.push(`<span class="st">${escapeHtml(src.slice(i, j))}</span>`);
				i = j;
				continue;
			}
			// numbers
			if (/\d/.test(ch)) {
				let j = i;
				while (j < n && /[\d.]/.test(src[j])) j++;
				out.push(`<span class="nu">${escapeHtml(src.slice(i, j))}</span>`);
				i = j;
				continue;
			}
			// identifiers + keywords
			if (/[a-zA-Z_$]/.test(ch)) {
				let j = i;
				while (j < n && /[a-zA-Z0-9_$]/.test(src[j])) j++;
				const word = src.slice(i, j);
				// is it a property key? Look ahead for `:` after optional whitespace
				let k = j;
				while (k < n && (src[k] === ' ' || src[k] === '\t')) k++;
				const isProp = src[k] === ':' && /\s/.test(src[i - 1] || ' ');
				if (KEYWORDS.has(word)) out.push(`<span class="kw">${escapeHtml(word)}</span>`);
				else if (BOOLS.has(word)) out.push(`<span class="bo">${escapeHtml(word)}</span>`);
				else if (isProp) out.push(`<span class="pr">${escapeHtml(word)}</span>`);
				else out.push(escapeHtml(word));
				i = j;
				continue;
			}
			// fall-through char
			out.push(escapeHtml(ch));
			i++;
		}
		return out.join('');
	}
	const highlighted = tokenize(source);
	return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
		html,body{margin:0;padding:0;background:#0a0a0a;color:#e5e5e5;font-family:ui-sans-serif,system-ui,sans-serif}
		body{padding:48px 64px}
		.head{display:flex;align-items:baseline;gap:16px;margin-bottom:20px}
		.dot{width:10px;height:10px;border-radius:9999px;background:${accent}}
		.lbl{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#737373}
		.fp{font-family:ui-monospace,'JetBrains Mono',monospace;color:#fafafa;font-size:15px}
		.code{font-family:ui-monospace,'JetBrains Mono',monospace;font-size:14px;line-height:1.6;background:#171717;border:1px solid #262626;border-radius:8px;padding:26px 32px;white-space:pre;overflow:hidden}
		.kw{color:#a5b4fc}.st{color:#86efac}.nu{color:#fbbf24}.bo{color:#fb7185}.cm{color:#525252;font-style:italic}.pr{color:#e5e5e5}
	</style></head><body>
		<div class="head"><span class="dot"></span><span class="lbl">${filepath}</span><span class="lbl" style="margin-left:auto">${eyebrow}</span></div>
		<pre class="code">${highlighted}</pre>
	</body></html>`;
}

function buildConceptSlideHtml({ eyebrow, title, columns, footnote }) {
	const cols = columns.map((c) => `
		<div class="col">
			<div class="ch" style="border-color:${c.accent}"><span class="cd" style="background:${c.accent}"></span>${c.header}</div>
			<ul>${c.items.map((it) => `<li>${it}</li>`).join('')}</ul>
		</div>`).join('');
	return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
		*{box-sizing:border-box}
		html,body{margin:0;padding:0;background:#0a0a0a;color:#e5e5e5;font-family:ui-sans-serif,system-ui,sans-serif;height:100%}
		body{padding:60px 80px;display:flex;flex-direction:column;gap:36px}
		.eyebrow{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#10b981;font-weight:600}
		h1{font-size:42px;font-weight:700;letter-spacing:-.02em;margin:0;color:#fafafa;max-width:1100px;line-height:1.1}
		.cols{display:grid;grid-template-columns:1fr 1fr;gap:48px;flex:1}
		.col{display:flex;flex-direction:column;gap:18px}
		.ch{font-size:14px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#a3a3a3;padding-left:14px;border-left:3px solid;display:flex;align-items:center;gap:10px}
		.cd{width:8px;height:8px;border-radius:9999px}
		ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:14px}
		li{font-size:18px;line-height:1.4;color:#d4d4d4;padding-left:20px;position:relative}
		li::before{content:"";position:absolute;left:0;top:11px;width:8px;height:1px;background:#525252}
		.foot{font-size:15px;color:#737373;border-top:1px solid #262626;padding-top:18px;line-height:1.5;max-width:1000px}
	</style></head><body>
		<div class="eyebrow">${eyebrow}</div>
		<h1>${title}</h1>
		<div class="cols">${cols}</div>
		<div class="foot">${footnote}</div>
	</body></html>`;
}

function buildTakeawaySlideHtml() {
	const stack = [
		{ label: 'Vercel AI SDK + AI Gateway', detail: 'routing, structured output, provider fallback' },
		{ label: 'Zod schemas', detail: 'the V invariant in code' },
		{ label: 'Upstash Redis', detail: 'layout cache by (brandId, surface, persona, picksHash)' },
		{ label: 'Neon Postgres', detail: 'enrichment store (persona-fit + semantic tags)' },
		{ label: 'BigCommerce GraphQL Storefront', detail: 'catalog reads, cart, checkout' },
		{ label: 'SvelteKit', detail: 'renderer + SSE streaming endpoints' },
		{ label: '?dev=1', detail: 'in-app AI zone overlay + DevToolbar' },
		{ label: '/observe', detail: 'session-level inference dashboard' },
	];
	const rows = stack.map((s) => `<div class="r"><div class="k">${s.label}</div><div class="v">${s.detail}</div></div>`).join('');
	return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
		*{box-sizing:border-box}
		html,body{margin:0;padding:0;background:#0a0a0a;color:#e5e5e5;font-family:ui-sans-serif,system-ui,sans-serif;height:100%}
		body{padding:60px 80px;display:flex;flex-direction:column;gap:32px}
		.eyebrow{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#10b981;font-weight:600}
		h1{font-size:42px;font-weight:700;letter-spacing:-.02em;margin:0;color:#fafafa}
		.kit{display:flex;flex-direction:column;gap:6px;border-top:1px solid #262626;padding-top:18px}
		.r{display:grid;grid-template-columns:340px 1fr;gap:32px;padding:14px 0;border-bottom:1px solid #1a1a1a;align-items:baseline}
		.k{font-family:ui-monospace,'JetBrains Mono',monospace;color:#fafafa;font-size:17px}
		.v{color:#a3a3a3;font-size:15px;line-height:1.5}
		.foot{font-size:18px;color:#d4d4d4;border-top:1px solid #262626;padding-top:22px;line-height:1.5;font-style:italic}
		.foot strong{color:#10b981;font-style:normal;font-weight:600}
	</style></head><body>
		<div class="eyebrow">The kit</div>
		<h1>Pattern, not platform</h1>
		<div class="kit">${rows}</div>
		<div class="foot">Four signals. One storefront. <strong>Imagine what it does with your order history, your warehouse, and three surfaces.</strong></div>
	</body></html>`;
}

// ─── Main ────────────────────────────────────────────────────────────
// 19-scene reel. Old scene 3 (standalone DevToolbar zoom) was folded into
// scene 2 — both halves of the dev instrumentation on one category page
// view. All subsequent scenes shift down by one.
const SCENES = [
	[1, 'Home (clean)', scene01_homeClean],
	[2, 'Dev instrumentation (category, zoomed)', scene02_devInstrumentation],
	[3, 'Cache bypass / live regeneration', scene04_freshRegen],
	[4, 'Operator dashboard', scene05_observe],
	[5, 'Refinement chat', scene06_refinementChat],
	[6, 'Cross-session continuity', scene07_returnContinuity],
	[7, 'Medium latitude (category)', scene08_plpLatitude],
	[8, 'Narrow latitude (product)', scene09_pdpLatitude],
	[9, 'Fixed latitude (cart)', scene10_cartLatitude],
	[10, 'Block catalog', scene11_p0Blocks],
	[11, 'Schema-bound code', scene12_codeBeat],
	[12, 'Brands as configuration', scene13_brandConfig],
	[13, 'Three brands, one engine', scene14_brandSwap],
	[14, 'Marketplace apps as inputs', scene15_voucherifyCart],
	[15, 'Cost', scene16_costMeter],
	[16, 'Adjacent inputs slide', scene17_adjacentInputs],
	[17, 'Returning shopper slide', scene18_returningShopper],
	[18, 'Beyond the storefront slide', scene19_beyondStorefront],
	[19, 'Builder takeaway slide', scene20_builderTakeaway],
];

async function main() {
	console.log(`\nDemo reel capture — Bealls / builder narrative`);
	console.log(`  base URL:    ${BASE_URL}`);
	console.log(`  observe key: ${OBSERVE_KEY}`);
	console.log(`  output:      ${OUT_DIR}`);
	if (ONLY.size) console.log(`  only:        ${[...ONLY].join(',')}`);
	if (SKIP.size) console.log(`  skip:        ${[...SKIP].join(',')}`);
	console.log('');

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({ viewport: VIEWPORT });

	let failures = 0;
	try {
		for (const [n, name, fn] of SCENES) {
			if (!shouldRun(n)) {
				log(`[${String(n).padStart(2, '0')}] skipped — ${name}`);
				continue;
			}
			step(n, name);
			try {
				await fn(context);
			} catch (err) {
				failures++;
				console.error(`  ✗ scene ${n} failed: ${err.message}`);
			}
		}
	} finally {
		await context.close();
		await browser.close();
	}

	console.log(`\nDone. ${SCENES.length - failures}/${SCENES.length} captured.`);
	if (failures) process.exitCode = 1;
}

main().catch((err) => {
	console.error('\n✗', err.message);
	process.exit(1);
});
