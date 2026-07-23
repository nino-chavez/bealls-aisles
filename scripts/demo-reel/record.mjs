#!/usr/bin/env node
/**
 * Per-scene Playwright recorder for demo-reel video scenes.
 *
 * Reads captions.json and, for any scene with a `video` field, drives a
 * Chromium session through the declared action sequence while Playwright
 * records video to recordings/NN.mp4. The recording is then trimmed/padded
 * to the target duration (TTS audio length + holdSeconds) and transcoded
 * to MP4 at 30fps so it concatenates cleanly with the static-image clips.
 *
 * Action types supported in `video.actions`:
 *   { type: "goto",   url: "<full or relative>" }      — navigate
 *   { type: "wait",   ms: <number> | "fill" }          — pause; "fill" = pad to target duration
 *   { type: "click",  selector: "<css>" }
 *   { type: "type",   selector: "<css>", text: "...", delay?: <ms> }
 *   { type: "press",  key: "Enter" }
 *   { type: "scroll", y: <number> }                    — window.scrollTo(0, y)
 *   { type: "hover",  selector: "<css>" }
 *   { type: "eval",   script: "<js expression>" }      — escape hatch
 *
 * Usage:
 *   node record.mjs                     # record any scene with `video` and missing recording
 *   node record.mjs --force             # re-record even if recording exists
 *   node record.mjs --scene 14          # record only scene 14 (1-based)
 *
 * Env:
 *   PWDEBUG=1                            # opens inspector for debugging
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const AUDIO_DIR = path.join(ROOT, 'audio');
const RECORDINGS_DIR = path.join(ROOT, 'recordings');
const TMP_DIR = path.join(ROOT, '.tmp-record');

fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

const captions = JSON.parse(fs.readFileSync(path.join(ROOT, 'captions.json'), 'utf-8'));
const DEFAULT_HOLD_S = captions.defaultHoldSeconds ?? 0.5;

const VIEWPORT_W = 1440;
const VIEWPORT_H = 900;

// CLI flags
const argv = process.argv.slice(2);
const FORCE = argv.includes('--force');
const SCENE_FLAG_IDX = argv.indexOf('--scene');
const ONLY_SCENE = SCENE_FLAG_IDX !== -1 ? parseInt(argv[SCENE_FLAG_IDX + 1], 10) : null;

function probeDuration(filePath) {
	const out = execFileSync('ffprobe', [
		'-v', 'error',
		'-show_entries', 'format=duration',
		'-of', 'default=noprint_wrappers=1:nokey=1',
		filePath,
	]).toString().trim();
	return parseFloat(out);
}

// Resolve a selector string to a Playwright Locator. Prefixed forms beat
// brittle CSS for production demos:
//   text:Some text            → getByText (exact)
//   role:button|name=Send     → getByRole({ name })
//   placeholder:Under $30...  → getByPlaceholder
//   label:Email               → getByLabel
//   <anything else>           → CSS
function locator(page, sel) {
	if (sel.startsWith('text:'))        return page.getByText(sel.slice(5));                        // substring (robust to dynamic copy like "Add to Cart — $19.99")
	if (sel.startsWith('text!:'))       return page.getByText(sel.slice(6), { exact: true });
	if (sel.startsWith('placeholder:')) return page.getByPlaceholder(sel.slice(12));
	if (sel.startsWith('label:'))       return page.getByLabel(sel.slice(6));
	if (sel.startsWith('role:')) {
		const [role, ...rest] = sel.slice(5).split('|');
		const opts = {};
		for (const part of rest) {
			const [k, v] = part.split('=');
			if (k === 'name') opts.name = v;
		}
		return page.getByRole(role, opts);
	}
	return page.locator(sel);
}

async function executeActions(page, actions, targetDurationMs) {
	const start = Date.now();
	for (const action of actions) {
		switch (action.type) {
			case 'goto':
				await page.goto(action.url, { waitUntil: 'load', timeout: 45000 });
				break;
			case 'wait':
				if (action.ms === 'fill') {
					const elapsed = Date.now() - start;
					const remaining = Math.max(500, targetDurationMs - elapsed);
					await page.waitForTimeout(remaining);
				} else {
					await page.waitForTimeout(action.ms);
				}
				break;
			case 'click':
				await locator(page, action.selector).click({ timeout: 5000 });
				break;
			case 'type':
				await locator(page, action.selector).fill(''); // clear
				await locator(page, action.selector).type(action.text, { delay: action.delay ?? 50 });
				break;
			case 'press':
				await page.keyboard.press(action.key);
				break;
			case 'scroll':
				await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), action.y);
				break;
			case 'hover':
				await locator(page, action.selector).hover();
				break;
			case 'eval':
				await page.evaluate(action.script);
				break;
			default:
				throw new Error(`Unknown action type: ${action.type}`);
		}
	}
}

async function recordScene(sceneIndex) {
	const scene = captions.scenes[sceneIndex];
	if (!scene.video) return null;

	const idx = String(sceneIndex + 1).padStart(2, '0');
	const audioPath = path.join(AUDIO_DIR, `${idx}.mp3`);
	const finalPath = path.join(RECORDINGS_DIR, `${idx}.mp4`);

	if (fs.existsSync(finalPath) && !FORCE) {
		console.log(`  ${idx} cached`);
		return finalPath;
	}

	if (!fs.existsSync(audioPath)) {
		throw new Error(`Audio missing for scene ${idx} — run TTS step first`);
	}

	const audioDur = probeDuration(audioPath);
	const holdSec = scene.holdSeconds ?? DEFAULT_HOLD_S;
	const targetSec = audioDur + holdSec;
	const targetMs = targetSec * 1000;

	console.log(`  ${idx} → recording (target ${targetSec.toFixed(2)}s)`);

	const sceneTmp = path.join(TMP_DIR, idx);
	fs.rmSync(sceneTmp, { recursive: true, force: true });
	fs.mkdirSync(sceneTmp, { recursive: true });

	const browser = await chromium.launch({ headless: true });
	const ctx = await browser.newContext({
		viewport: { width: VIEWPORT_W, height: VIEWPORT_H },
		deviceScaleFactor: 1,
		recordVideo: { dir: sceneTmp, size: { width: VIEWPORT_W, height: VIEWPORT_H } },
	});
	const page = await ctx.newPage();

	try {
		await executeActions(page, scene.video.actions, targetMs);
		await page.waitForTimeout(300);
	} finally {
		await page.close();
		await ctx.close();
		await browser.close();
	}

	// Playwright dumps a single .webm into sceneTmp on context close
	const webmFiles = fs.readdirSync(sceneTmp).filter((f) => f.endsWith('.webm'));
	if (webmFiles.length === 0) throw new Error(`No webm produced for scene ${idx}`);
	const webmPath = path.join(sceneTmp, webmFiles[0]);

	// Trim/pad to exact target duration. ffmpeg `-t` truncates, `tpad` extends.
	// Strategy: transcode webm→mp4 at 30fps, set duration with `-t`, and use
	// tpad to extend the final frame if the recording is shorter than target.
	execFileSync('ffmpeg', [
		'-y',
		'-i', webmPath,
		'-vf', `tpad=stop_mode=clone:stop_duration=${holdSec.toFixed(2)},fps=30,scale=${VIEWPORT_W}:${VIEWPORT_H}:flags=lanczos`,
		'-c:v', 'libx264',
		'-pix_fmt', 'yuv420p',
		'-r', '30',
		'-an',
		'-t', targetSec.toFixed(3),
		finalPath,
	], { stdio: ['ignore', 'inherit', 'inherit'] });

	return finalPath;
}

async function main() {
	console.log('Demo-reel video recorder');
	const videoSceneNumbers = captions.scenes.flatMap((s, i) => (s.video ? [i + 1] : []));
	console.log(`  scenes with video: ${videoSceneNumbers.join(', ') || '(none)'}\n`);

	for (let i = 0; i < captions.scenes.length; i++) {
		if (ONLY_SCENE !== null && i + 1 !== ONLY_SCENE) continue;
		if (!captions.scenes[i].video) continue;
		await recordScene(i);
	}
	console.log('\n✓ recordings up-to-date');
}

main().catch((err) => {
	console.error('\n✗', err.message);
	process.exit(1);
});
