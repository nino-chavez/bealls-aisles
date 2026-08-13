#!/usr/bin/env node
/**
 * Demo reel generator — TTS + captioned screenshots → MP4.
 *
 * Pipeline:
 *   1. Load captions.json
 *   2. For each scene: OpenAI TTS → audio/NN.mp3
 *   3. ffprobe each MP3 to get duration
 *   4. ImageMagick: letterbox screenshot + burn caption panel → frames/NN.png
 *   5. ffmpeg: per-scene clip (still image + audio + trailing silence) → clips/NN.mp4
 *   6. ffmpeg concat all clips → out/demo-reel.mp4
 *
 * Env:
 *   OPENAI_API_KEY — required. Auto-sourced from ~/Workspace/dev/apps/rally-hq/.env.local if missing.
 *   TTS_VOICE      — optional override (default: captions.voice or 'onyx')
 *   SKIP_TTS       — '1' to reuse existing audio/*.mp3 files (faster iteration)
 *   SKIP_FRAMES    — '1' to reuse existing frames/*.png files
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const captions = JSON.parse(fs.readFileSync(path.join(ROOT, 'captions.json'), 'utf-8'));
if (captions.status !== 'current') {
	throw new Error('Demo reel is a legacy archive and cannot be regenerated or published');
}
const SCREENSHOTS_DIR = path.join(ROOT, 'screenshots');
const AUDIO_DIR = path.join(ROOT, 'audio');
const FRAMES_DIR = path.join(ROOT, 'frames');
const CAPTION_BANDS_DIR = path.join(ROOT, 'caption-bands');
const RECORDINGS_DIR = path.join(ROOT, 'recordings');
const CLIPS_DIR = path.join(ROOT, 'clips');
const OUT_DIR = path.join(ROOT, 'out');

for (const d of [AUDIO_DIR, FRAMES_DIR, CAPTION_BANDS_DIR, RECORDINGS_DIR, CLIPS_DIR, OUT_DIR]) fs.mkdirSync(d, { recursive: true });

// ─── env ───────────────────────────────────────────────────────────
// ─── env ───────────────────────────────────────────────────────────
// Supports two TTS backends:
//   1. ElevenLabs (default if ELEVENLABS_API_KEY is set)
//   2. OpenAI (fallback)

function loadKey(name, searchPaths = []) {
	if (process.env[name]) return process.env[name];
	for (const p of searchPaths) {
		if (!fs.existsSync(p)) continue;
		const match = fs.readFileSync(p, 'utf-8').match(new RegExp(`^${name}=(.+)$`, 'm'));
		if (match) return match[1].trim().replace(/^["']|["']$/g, '');
	}
	return null;
}

const rallyEnv = path.resolve(process.env.HOME || '', 'Workspace/dev/apps/rally-hq/.env.local');
const projectEnvLocal = path.resolve(ROOT, '..', '..', '.env.local');
const projectEnv = path.resolve(ROOT, '..', '..', '.env');
const ELEVENLABS_API_KEY = loadKey('ELEVENLABS_API_KEY', [projectEnvLocal, projectEnv, rallyEnv, path.join(ROOT, '.env')]);
const OPENAI_API_KEY = loadKey('OPENAI_API_KEY', [projectEnvLocal, projectEnv, rallyEnv]);
const TTS_BACKEND = ELEVENLABS_API_KEY ? 'elevenlabs' : 'openai';

if (!ELEVENLABS_API_KEY && !OPENAI_API_KEY) {
	throw new Error('Set ELEVENLABS_API_KEY (preferred) or OPENAI_API_KEY for TTS');
}

// ─── config ────────────────────────────────────────────────────────
const VOICE = process.env.TTS_VOICE || captions.voice || 'coral';
const TTS_MODEL = process.env.TTS_MODEL || captions.model || 'eleven_multilingual_v2';
const TTS_INSTRUCTIONS = captions.instructions || null;
const DEFAULT_HOLD_S = captions.defaultHoldSeconds ?? 0.4;

// ElevenLabs voice IDs — narrator-grade stock voices that work well for
// technical/builder content. The default is `brian` (deep American narrator)
// — close to an "engineering podcast" register, low theatrical variance.
const ELEVENLABS_VOICES = {
	'brian': 'nPczCjzI2devNBz1zQrb',      // American, deep, narrator (default — best for tech demos)
	'bill': 'pqHfZKP75CvOlQylNhV4',        // American, mature, documentary narrator
	'daniel': 'onwK4e9ZLuTAKqWW03F9',      // British, authoritative, news-anchor
	'liam': 'TX3LPaxmHKxFdv7VOQHJ',        // American, articulate, younger
	'george': 'JBFqnCBsd6RMkjVDRZzb',      // British, warm, narration
	'rachel': '21m00Tcm4TlvDq8ikWAM',      // American, clear, professional
	'adam': 'pNInz6obpgDQGcFmaJgB',        // American, deep, confident
	'josh': 'TxGEqnHWrfWFTfGW9XjX',        // American, conversational
	'sam': 'yoZ06aMxZJJ28mfd3POQ',         // American, casual
	'charlie': 'IKne3meq5aSn9XLyUdCD',     // Australian, friendly
};

// Frame layout: screenshot on top, caption band below — no overlap.
// Captures are 1440×900; caption band occupies its own 220px region underneath
// so nothing in the screenshot is ever obscured.
const SCREENSHOT_W = 1440;
const SCREENSHOT_H = 900;
const CAPTION_BAND_H = 220;
const VIDEO_W = SCREENSHOT_W;
const VIDEO_H = SCREENSHOT_H + CAPTION_BAND_H; // 1120
const CAPTION_PAD_X = 60;
const CAPTION_PAD_TOP = 22;
const TITLE_FONT_SIZE = 30;
const CAPTION_FONT_SIZE = 20;
const COUNTER_FONT_SIZE = 14;
const BG_COLOR = '#0a0a0a';
const ACCENT_COLOR = '#10b981';

// ─── helpers ───────────────────────────────────────────────────────
function sh(cmd, args, opts = {}) {
	return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], ...opts }).toString().trim();
}

async function generateTTS(text, outputPath) {
	if (TTS_BACKEND === 'elevenlabs') {
		return generateTTS_ElevenLabs(text, outputPath);
	}
	return generateTTS_OpenAI(text, outputPath);
}

async function generateTTS_ElevenLabs(text, outputPath) {
	const voiceId = ELEVENLABS_VOICES[VOICE.toLowerCase()] || VOICE;
	const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
		method: 'POST',
		headers: {
			'xi-api-key': ELEVENLABS_API_KEY,
			'Content-Type': 'application/json',
			'Accept': 'audio/mpeg',
		},
		body: JSON.stringify({
			text,
			model_id: TTS_MODEL,
			voice_settings: {
				// Tuned for technical narration: high stability for consistent pacing,
				// no expressive style (which produces erratic cadence on tech content),
				// modest similarity boost. Closer to ElevenLabs' suggested narrator preset.
				stability: 0.7,
				similarity_boost: 0.8,
				style: 0.0,
				use_speaker_boost: true,
			},
		}),
	});
	if (!res.ok) throw new Error(`ElevenLabs TTS failed (${res.status}): ${await res.text()}`);
	const buf = Buffer.from(await res.arrayBuffer());
	fs.writeFileSync(outputPath, buf);
}

async function generateTTS_OpenAI(text, outputPath) {
	const payload = {
		model: TTS_MODEL,
		voice: VOICE,
		input: text,
		response_format: 'mp3',
	};
	if (TTS_INSTRUCTIONS && TTS_MODEL.startsWith('gpt-4o')) {
		payload.instructions = TTS_INSTRUCTIONS;
	}
	const res = await fetch('https://api.openai.com/v1/audio/speech', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${OPENAI_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});
	if (!res.ok) throw new Error(`OpenAI TTS failed (${res.status}): ${await res.text()}`);
	const buf = Buffer.from(await res.arrayBuffer());
	fs.writeFileSync(outputPath, buf);
}

function probeDuration(mp3Path) {
	const out = sh('ffprobe', [
		'-v', 'error',
		'-show_entries', 'format=duration',
		'-of', 'default=noprint_wrappers=1:nokey=1',
		mp3Path,
	]);
	return parseFloat(out);
}

// Build the caption band as a standalone 1440×220 PNG. Used both as an
// overlay on top of recorded video clips and (composited inline) in the
// full static-image frame. Returns the args after the leading source.
function captionBandComposite(scene, index, captionBandY) {
	const idx = String(index + 1).padStart(2, '0');
	const totalScenes = captions.scenes.length;
	const progress = `${idx} / ${String(totalScenes).padStart(2, '0')}`;
	const captionText = scene.caption;
	const titleText = scene.title;
	const textWidth = VIDEO_W - CAPTION_PAD_X * 2;
	const titleY = captionBandY + CAPTION_PAD_TOP;
	const bodyY = titleY + TITLE_FONT_SIZE + 14;

	return [
		// Caption band — solid background
		'(',
			'-size', `${VIDEO_W}x${CAPTION_BAND_H}`,
			`xc:${BG_COLOR}`,
		')',
		'-gravity', 'northwest',
		'-geometry', `+0+${captionBandY}`,
		'-composite',

		// Emerald hairline at the seam
		'(',
			'-size', `${VIDEO_W}x2`,
			`xc:${ACCENT_COLOR}`,
		')',
		'-gravity', 'northwest',
		'-geometry', `+0+${captionBandY}`,
		'-composite',

		// Scene counter
		'-font', 'Helvetica',
		'-pointsize', String(COUNTER_FONT_SIZE),
		'-fill', '#737373',
		'-gravity', 'northeast',
		'-annotate', `+${CAPTION_PAD_X}+${captionBandY + CAPTION_PAD_TOP + 6}`, progress,

		// Title
		'-font', 'Helvetica-Bold',
		'-pointsize', String(TITLE_FONT_SIZE),
		'-fill', '#f5f5f5',
		'-gravity', 'northwest',
		'-annotate', `+${CAPTION_PAD_X}+${titleY}`, titleText,

		// Caption body — wrapped via a temp caption: image
		'(',
			'-background', 'none',
			'-fill', '#d4d4d4',
			'-font', 'Helvetica',
			'-pointsize', String(CAPTION_FONT_SIZE),
			'-size', `${textWidth}x${CAPTION_BAND_H - (bodyY - captionBandY) - CAPTION_PAD_TOP}`,
			`caption:${captionText}`,
		')',
		'-gravity', 'northwest',
		'-geometry', `+${CAPTION_PAD_X}+${bodyY}`,
		'-composite',
	];
}

function buildCaptionBand(scene, index, bandPath) {
	// Standalone band: full-width transparent canvas with the band drawn at y=0.
	const args = [
		'-size', `${VIDEO_W}x${CAPTION_BAND_H}`,
		'xc:none',
		...captionBandComposite(scene, index, 0),
		bandPath,
	];
	execFileSync('magick', args, { stdio: ['ignore', 'inherit', 'inherit'] });
}

// Get the list of screenshot images for a scene. Supports either:
//   { image: "single.png" }                    — single image (N=1)
//   { images: ["a.png", "b.png", "c.png"] }    — N images cross-faded across audio
function getSceneImages(scene) {
	if (Array.isArray(scene.images) && scene.images.length > 0) return scene.images;
	if (scene.image) return [scene.image];
	throw new Error('Scene needs an `image` or `images` field');
}

const XFADE_S = 0.5; // cross-fade duration between successive images

// Unified per-scene clip builder. Takes N screenshot inputs, scales+letterboxes
// each into a 1440×900 stream, cross-fades them across the audio duration, pads
// to 1440×1120, overlays the static caption-band PNG at y=900, mux audio.
function buildSceneClip(sceneIndex, audioPath, bandPath, audioDur, clipPath) {
	const scene = captions.scenes[sceneIndex];
	const hold = scene.holdSeconds ?? DEFAULT_HOLD_S;
	const totalSec = audioDur + hold;
	const images = getSceneImages(scene).map((rel) => {
		const abs = path.join(SCREENSHOTS_DIR, rel);
		if (!fs.existsSync(abs)) throw new Error(`Screenshot not found: ${abs}`);
		return abs;
	});
	const N = images.length;

	// Per-image visible time: with N images and (N-1) cross-fades of XFADE_S each,
	// total = N*D - (N-1)*XFADE_S = totalSec  →  D = (totalSec + (N-1)*XFADE_S)/N
	const D = (totalSec + (N - 1) * XFADE_S) / N;

	// Build inputs: N image loops + 1 band loop + 1 audio
	const inputs = [];
	for (const img of images) {
		inputs.push('-loop', '1', '-t', D.toFixed(3), '-i', img);
	}
	inputs.push('-loop', '1', '-t', totalSec.toFixed(3), '-i', bandPath);
	inputs.push('-i', audioPath);

	// Filter graph: scale/letterbox each image to a SCREENSHOT_W×SCREENSHOT_H stream,
	// chain cross-fades, pad up to VIDEO_W×VIDEO_H, overlay band, pad audio.
	const filterParts = [];
	for (let i = 0; i < N; i++) {
		filterParts.push(
			`[${i}:v]scale=${SCREENSHOT_W}:${SCREENSHOT_H}:force_original_aspect_ratio=decrease,` +
			`pad=${SCREENSHOT_W}:${SCREENSHOT_H}:(ow-iw)/2:(oh-ih)/2:color=${BG_COLOR},` +
			`setsar=1,fps=30,format=yuv420p[s${i}]`
		);
	}
	let cur = '[s0]';
	for (let i = 1; i < N; i++) {
		const offset = i * (D - XFADE_S);
		const next = i === N - 1 ? '[xmain]' : `[x${i}]`;
		filterParts.push(`${cur}[s${i}]xfade=transition=fade:duration=${XFADE_S}:offset=${offset.toFixed(3)}${next}`);
		cur = next;
	}
	const screenStream = N === 1 ? '[s0]' : '[xmain]';
	filterParts.push(`${screenStream}pad=${VIDEO_W}:${VIDEO_H}:0:0:color=${BG_COLOR}[bg]`);
	filterParts.push(`[bg][${N}:v]overlay=0:${SCREENSHOT_H}[v]`);
	filterParts.push(`[${N + 1}:a]apad=pad_dur=${hold}[a]`);

	const args = [
		'-y',
		...inputs,
		'-filter_complex', filterParts.join(';'),
		'-map', '[v]', '-map', '[a]',
		'-c:v', 'libx264',
		'-pix_fmt', 'yuv420p',
		'-r', '30',
		'-c:a', 'aac', '-b:a', '192k',
		'-t', totalSec.toFixed(3),
		'-shortest',
		clipPath,
	];
	execFileSync('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] });
}

// ─── main ──────────────────────────────────────────────────────────
async function main() {
	const skipTTS = process.env.SKIP_TTS === '1';
	const skipFrames = process.env.SKIP_FRAMES === '1';

	console.log(`\nDemo reel generator`);
	console.log(`  voice: ${VOICE} (${TTS_BACKEND}: ${TTS_MODEL})`);
	console.log(`  scenes: ${captions.scenes.length}`);
	console.log(`  output: ${path.join(OUT_DIR, 'demo-reel.mp4')}\n`);

	// Step 1: TTS
	console.log('[1/4] Generating TTS audio');
	for (let i = 0; i < captions.scenes.length; i++) {
		const scene = captions.scenes[i];
		const idx = String(i + 1).padStart(2, '0');
		const audioPath = path.join(AUDIO_DIR, `${idx}.mp3`);
		if (skipTTS && fs.existsSync(audioPath)) {
			console.log(`  ${idx} cached`);
			continue;
		}
		// `tts` overrides `caption` for narration only — used when the visible
		// caption needs technical accuracy (a code-style label, a brand
		// spelling like "Bealls") but the spoken read should differ
		// (plain English, "Bells" pronunciation).
		const narration = scene.tts || scene.caption;
		console.log(`  ${idx} → ${narration.length} chars`);
		await generateTTS(narration, audioPath);
		await new Promise((r) => setTimeout(r, 800));
	}

	// Step 2: Caption bands (one 1440×220 PNG per scene)
	console.log('\n[2/4] Building caption bands');
	for (let i = 0; i < captions.scenes.length; i++) {
		const idx = String(i + 1).padStart(2, '0');
		const bandPath = path.join(CAPTION_BANDS_DIR, `${idx}.png`);
		if (skipFrames && fs.existsSync(bandPath)) {
			console.log(`  ${idx} cached`);
			continue;
		}
		const scene = captions.scenes[i];
		const imageList = getSceneImages(scene);
		console.log(`  ${idx} → ${imageList.length === 1 ? imageList[0] : `${imageList.length} images`}`);
		buildCaptionBand(scene, i, bandPath);
	}

	// Step 3: Per-scene clips (1+ stills cross-faded across audio + caption-band overlay)
	console.log('\n[3/4] Rendering per-scene clips');
	const clipPaths = [];
	for (let i = 0; i < captions.scenes.length; i++) {
		const idx = String(i + 1).padStart(2, '0');
		const scene = captions.scenes[i];
		const audioPath = path.join(AUDIO_DIR, `${idx}.mp3`);
		const bandPath = path.join(CAPTION_BANDS_DIR, `${idx}.png`);
		const clipPath = path.join(CLIPS_DIR, `${idx}.mp4`);
		const audioSec = probeDuration(audioPath);
		const totalSec = audioSec + (scene.holdSeconds ?? DEFAULT_HOLD_S);
		const N = getSceneImages(scene).length;
		console.log(`  ${idx} N=${N} audio=${audioSec.toFixed(2)}s total=${totalSec.toFixed(2)}s`);
		buildSceneClip(i, audioPath, bandPath, audioSec, clipPath);
		clipPaths.push(clipPath);
	}

	// Step 4: Concat
	console.log('\n[4/4] Concatenating clips');
	const concatFile = path.join(ROOT, 'concat.txt');
	fs.writeFileSync(
		concatFile,
		clipPaths.map((p) => `file '${p}'`).join('\n') + '\n',
	);
	const outFile = path.join(OUT_DIR, 'demo-reel.mp4');
	execFileSync(
		'ffmpeg',
		[
			'-y',
			'-f', 'concat',
			'-safe', '0',
			'-i', concatFile,
			'-c:v', 'libx264',
			'-pix_fmt', 'yuv420p',
			'-r', '30',
			'-c:a', 'aac',
			'-b:a', '192k',
			'-movflags', '+faststart',
			outFile,
		],
		{ stdio: ['ignore', 'inherit', 'inherit'] },
	);

	const stat = fs.statSync(outFile);
	console.log(`\n✓ ${outFile}`);
	console.log(`  ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((err) => {
	console.error('\n✗', err.message);
	process.exit(1);
});
