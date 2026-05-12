#!/usr/bin/env node
/**
 * Demo reel generator — TTS + captioned screenshots → MP4.
 *
 * Pipeline:
 *   1. Load captions.json
 *   2. For each scene: TTS → audio/NN.mp3 (ElevenLabs preferred, OpenAI fallback)
 *   3. ffprobe each MP3 to get duration
 *   4. ImageMagick: full-bleed screenshot + burn caption panel → frames/NN.png
 *   5. ffmpeg: per-scene clip (still image + audio + trailing silence) → clips/NN.mp4
 *   6. ffmpeg concat all clips → out/demo-reel.mp4
 *
 * Env (auto-loaded from ./.env or ~/.demo-reel.env if not exported):
 *   ELEVENLABS_API_KEY — preferred TTS backend
 *   OPENAI_API_KEY     — fallback TTS backend
 *   TTS_VOICE          — override captions.voice
 *   TTS_MODEL          — override captions.model
 *   SKIP_TTS=1         — reuse existing audio/*.mp3
 *   SKIP_FRAMES=1      — reuse existing frames/*.png
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const SCREENSHOTS_DIR = path.join(ROOT, 'screenshots');
const AUDIO_DIR = path.join(ROOT, 'audio');
const FRAMES_DIR = path.join(ROOT, 'frames');
const CLIPS_DIR = path.join(ROOT, 'clips');
const OUT_DIR = path.join(ROOT, 'out');

for (const d of [AUDIO_DIR, FRAMES_DIR, CLIPS_DIR, OUT_DIR]) fs.mkdirSync(d, { recursive: true });

// ─── env ───────────────────────────────────────────────────────────
// Looks up env vars from (in order): process.env, ./.env, ~/.demo-reel.env.
// Add more search paths via DEMO_REEL_ENV_PATHS=path1:path2.

function loadKey(name, searchPaths = []) {
	if (process.env[name]) return process.env[name];
	for (const p of searchPaths) {
		if (!p || !fs.existsSync(p)) continue;
		const match = fs.readFileSync(p, 'utf-8').match(new RegExp(`^${name}=(.+)$`, 'm'));
		if (match) return match[1].trim().replace(/^["']|["']$/g, '');
	}
	return null;
}

const extraEnvPaths = (process.env.DEMO_REEL_ENV_PATHS || '').split(':').filter(Boolean);
const envSearchPaths = [
	path.join(ROOT, '.env'),
	path.resolve(process.env.HOME || '', '.demo-reel.env'),
	...extraEnvPaths,
];

const ELEVENLABS_API_KEY = loadKey('ELEVENLABS_API_KEY', envSearchPaths);
const OPENAI_API_KEY = loadKey('OPENAI_API_KEY', envSearchPaths);
const TTS_BACKEND = ELEVENLABS_API_KEY ? 'elevenlabs' : (OPENAI_API_KEY ? 'openai' : 'silent');

if (!ELEVENLABS_API_KEY && !OPENAI_API_KEY) {
	console.warn('⚠ No TTS key found — generating silent reel (caption-only mode).');
	console.warn('  Set ELEVENLABS_API_KEY or OPENAI_API_KEY to enable narration.');
}

// ─── config ────────────────────────────────────────────────────────
const captions = JSON.parse(fs.readFileSync(path.join(ROOT, 'captions.json'), 'utf-8'));
const VOICE = process.env.TTS_VOICE || captions.voice || 'adam';
const TTS_MODEL = process.env.TTS_MODEL || captions.model || (TTS_BACKEND === 'elevenlabs' ? 'eleven_multilingual_v2' : 'gpt-4o-mini-tts');
const TTS_INSTRUCTIONS = captions.instructions || null;
const DEFAULT_HOLD_S = captions.defaultHoldSeconds ?? 0.4;

// Pronunciation overrides: brand or jargon spelled in the on-screen caption
// won't always TTS the way the speaker should pronounce it (e.g. "Bealls" →
// "Bells", "BigCommerce" → "Big Commerce"). Define `pronunciations` in
// captions.json as a map of `displayed → spoken`. Applied to caption text
// just before TTS — the on-screen text is unaffected. Word-boundary,
// case-insensitive; longest keys are replaced first so multi-word entries
// ("Bealls Florida") win over single-word entries ("Bealls").
const PRONUNCIATIONS = captions.pronunciations || {};
const PRONUNCIATION_KEYS = Object.keys(PRONUNCIATIONS).sort((a, b) => b.length - a.length);
function applyPronunciations(text) {
	let out = text;
	for (const k of PRONUNCIATION_KEYS) {
		const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		out = out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), PRONUNCIATIONS[k]);
	}
	return out;
}

// ElevenLabs pre-built voice IDs (pass the name, gets resolved to ID).
const ELEVENLABS_VOICES = {
	'brian': 'nPczCjzI2devNBz1zQrb',       // American, natural cadence — modern software-demo default
	'daniel': 'onwK4e9ZLuTAKqWW03F9',       // UK professional, common in AI/dev-tool demos
	'bill': 'pqHfZKP75CvOlQylNhV4',         // American, conversational, modern
	'george': 'JBFqnCBsd6RMkjVDRZzb',     // British, warm, narration
	'rachel': '21m00Tcm4TlvDq8ikWAM',     // American, clear — older, neutral
	'adam': 'pNInz6obpgDQGcFmaJgB',        // American, deep — sounds documentary/trailer, avoid for software demos
	'josh': 'TxGEqnHWrfWFTfGW9XjX',       // American, conversational
	'sam': 'yoZ06aMxZJJ28mfd3POQ',         // American, casual
	'charlie': 'IKne3meq5aSn9XLyUdCD',     // Australian, friendly
};

// Landscape 16:10. Default layout is "panel" — the caption band lives
// alongside the screenshot, not on top of it. Screenshots fit into
// `VIDEO_W × IMAGE_AREA_H` and are letterboxed if their aspect doesn't
// match. Set `captionMode: "overlay"` per scene (or via env var
// DEMO_REEL_CAPTION_MODE=overlay) to opt into the legacy full-bleed
// behavior — only sensible when the screenshot has intentional empty
// space at the chosen edge.
const VIDEO_W = 1440;
const VIDEO_H = 900;
const CAPTION_BAND_H = 220;
const IMAGE_AREA_H = VIDEO_H - CAPTION_BAND_H;
const CAPTION_PAD_X = 60;
const CAPTION_PAD_TOP = 22;
const TITLE_FONT_SIZE = 30;
const CAPTION_FONT_SIZE = 20;
const COUNTER_FONT_SIZE = 14;
const BG_COLOR = '#0a0a0a';
const ACCENT_COLOR = '#10b981';
const DEFAULT_CAPTION_MODE = process.env.DEMO_REEL_CAPTION_MODE === 'overlay' ? 'overlay' : 'panel';

// ─── fonts ─────────────────────────────────────────────────────────
// ImageMagick on macOS doesn't auto-index system fonts, so calls like
// `-font Helvetica` fail with "unable to read font". Resolve to absolute
// paths on darwin; fall back to font names on Linux (where fonts-liberation
// or equivalent is expected per SETUP.md). DEMO_REEL_FONT_REGULAR /
// DEMO_REEL_FONT_BOLD env vars override either path if the user wants to
// pick their own.

function resolveFont({ envVar, macPath, linuxName }) {
	if (process.env[envVar]) return process.env[envVar];
	if (process.platform === 'darwin' && fs.existsSync(macPath)) return macPath;
	return linuxName;
}

const FONT_REGULAR = resolveFont({
	envVar: 'DEMO_REEL_FONT_REGULAR',
	macPath: '/System/Library/Fonts/Supplemental/Arial.ttf',
	linuxName: 'Liberation-Sans',
});
const FONT_BOLD = resolveFont({
	envVar: 'DEMO_REEL_FONT_BOLD',
	macPath: '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
	linuxName: 'Liberation-Sans-Bold',
});

// ─── helpers ───────────────────────────────────────────────────────
function sh(cmd, args, opts = {}) {
	return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], ...opts }).toString().trim();
}

async function generateTTS(text, outputPath) {
	if (TTS_BACKEND === 'elevenlabs') return generateTTS_ElevenLabs(text, outputPath);
	if (TTS_BACKEND === 'openai') return generateTTS_OpenAI(text, outputPath);
	return generateSilent(text, outputPath);
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
				stability: 0.55,
				similarity_boost: 0.80,
				style: 0.25,
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

async function generateSilent(text, outputPath) {
	// Caption-only mode: produce a short silent MP3 sized to be readable.
	// Aim ~80ms per character with a 2s floor and 8s ceiling.
	const seconds = Math.max(2, Math.min(8, text.length * 0.08));
	execFileSync('ffmpeg', [
		'-y',
		'-f', 'lavfi',
		'-i', `anullsrc=channel_layout=mono:sample_rate=44100`,
		'-t', seconds.toFixed(2),
		'-q:a', '9',
		'-acodec', 'libmp3lame',
		outputPath,
	], { stdio: ['ignore', 'inherit', 'inherit'] });
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

function buildFrame(scene, index, framePath) {
	const src = path.join(SCREENSHOTS_DIR, scene.image);
	if (!fs.existsSync(src)) throw new Error(`Screenshot not found: ${src}`);

	const idx = String(index + 1).padStart(2, '0');
	const totalScenes = captions.scenes.length;
	const progress = `${idx} / ${String(totalScenes).padStart(2, '0')}`;

	const captionText = scene.caption;
	const titleText = scene.title;

	const mode = scene.captionMode || DEFAULT_CAPTION_MODE;
	const position = scene.captionPosition || 'bottom';
	const textWidth = VIDEO_W - CAPTION_PAD_X * 2;

	// In panel mode the screenshot occupies VIDEO_W × IMAGE_AREA_H and the
	// caption band occupies the remaining VIDEO_H - IMAGE_AREA_H. In overlay
	// mode the screenshot is full-bleed and the band sits on top of it.
	const imageH = mode === 'panel' ? IMAGE_AREA_H : VIDEO_H;
	const imageY = mode === 'panel' && position === 'top' ? CAPTION_BAND_H : 0;
	const captionBandY = mode === 'panel'
		? (position === 'top' ? 0 : IMAGE_AREA_H)
		: (position === 'top' ? 0 : VIDEO_H - CAPTION_BAND_H);
	const accentLineY = position === 'top' ? captionBandY + CAPTION_BAND_H - 2 : captionBandY;
	const titleY = captionBandY + CAPTION_PAD_TOP;
	const bodyY = titleY + TITLE_FONT_SIZE + 14;

	const bandFill = mode === 'panel' ? '#0a0a0a' : 'rgba(10,10,10,0.88)';

	const args = [
		'-size', `${VIDEO_W}x${VIDEO_H}`,
		`xc:${BG_COLOR}`,

		// Screenshot — fit-to-area maintaining aspect, letterbox to BG_COLOR.
		'(',
			src,
			'-resize', `${VIDEO_W}x${imageH}`,
			'-background', BG_COLOR,
			'-gravity', 'center',
			'-extent', `${VIDEO_W}x${imageH}`,
		')',
		'-gravity', 'northwest',
		'-geometry', `+0+${imageY}`,
		'-composite',

		'(',
			'-size', `${VIDEO_W}x${CAPTION_BAND_H}`,
			`xc:${bandFill}`,
		')',
		'-gravity', 'northwest',
		'-geometry', `+0+${captionBandY}`,
		'-composite',

		'(',
			'-size', `${VIDEO_W}x2`,
			`xc:${ACCENT_COLOR}`,
		')',
		'-gravity', 'northwest',
		'-geometry', `+0+${accentLineY}`,
		'-composite',

		'-font', FONT_REGULAR,
		'-pointsize', String(COUNTER_FONT_SIZE),
		'-fill', '#737373',
		'-gravity', 'northeast',
		'-annotate', `+${CAPTION_PAD_X}+${captionBandY + CAPTION_PAD_TOP + 6}`, progress,

		'-font', FONT_BOLD,
		'-pointsize', String(TITLE_FONT_SIZE),
		'-fill', '#f5f5f5',
		'-gravity', 'northwest',
		'-annotate', `+${CAPTION_PAD_X}+${titleY}`, titleText,

		'(',
			'-background', 'none',
			'-fill', '#d4d4d4',
			'-font', FONT_REGULAR,
			'-pointsize', String(CAPTION_FONT_SIZE),
			'-size', `${textWidth}x${CAPTION_BAND_H - (bodyY - captionBandY) - CAPTION_PAD_TOP}`,
			`caption:${captionText}`,
		')',
		'-gravity', 'northwest',
		'-geometry', `+${CAPTION_PAD_X}+${bodyY}`,
		'-composite',

		framePath,
	];
	execFileSync('magick', args, { stdio: ['ignore', 'inherit', 'inherit'] });
}

function buildClip(sceneIndex, framePath, audioPath, totalDuration, clipPath) {
	const hold = captions.scenes[sceneIndex].holdSeconds ?? DEFAULT_HOLD_S;
	const args = [
		'-y',
		'-loop', '1', '-i', framePath,
		'-i', audioPath,
		'-filter_complex', `[1:a]apad=pad_dur=${hold}[a]`,
		'-map', '0:v', '-map', '[a]',
		'-c:v', 'libx264',
		'-tune', 'stillimage',
		'-pix_fmt', 'yuv420p',
		'-r', '30',
		'-c:a', 'aac', '-b:a', '192k',
		'-t', totalDuration.toFixed(3),
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

	console.log('[1/4] Generating TTS audio');
	for (let i = 0; i < captions.scenes.length; i++) {
		const scene = captions.scenes[i];
		const idx = String(i + 1).padStart(2, '0');
		const audioPath = path.join(AUDIO_DIR, `${idx}.mp3`);
		if (skipTTS && fs.existsSync(audioPath)) {
			console.log(`  ${idx} cached`);
			continue;
		}
		const ttsText = applyPronunciations(scene.caption);
		console.log(`  ${idx} → ${scene.caption.length} chars${ttsText !== scene.caption ? ' (pronunciation override applied)' : ''}`);
		await generateTTS(ttsText, audioPath);
		await new Promise((r) => setTimeout(r, 800));
	}

	console.log('\n[2/4] Building captioned frames');
	for (let i = 0; i < captions.scenes.length; i++) {
		const idx = String(i + 1).padStart(2, '0');
		const framePath = path.join(FRAMES_DIR, `${idx}.png`);
		if (skipFrames && fs.existsSync(framePath)) {
			console.log(`  ${idx} cached`);
			continue;
		}
		console.log(`  ${idx} → ${captions.scenes[i].image}`);
		buildFrame(captions.scenes[i], i, framePath);
	}

	console.log('\n[3/4] Rendering per-scene clips');
	const clipPaths = [];
	for (let i = 0; i < captions.scenes.length; i++) {
		const idx = String(i + 1).padStart(2, '0');
		const audioPath = path.join(AUDIO_DIR, `${idx}.mp3`);
		const framePath = path.join(FRAMES_DIR, `${idx}.png`);
		const clipPath = path.join(CLIPS_DIR, `${idx}.mp4`);
		const audioSec = probeDuration(audioPath);
		const totalSec = audioSec + (captions.scenes[i].holdSeconds ?? DEFAULT_HOLD_S);
		console.log(`  ${idx} audio=${audioSec.toFixed(2)}s total=${totalSec.toFixed(2)}s`);
		buildClip(i, framePath, audioPath, totalSec, clipPath);
		clipPaths.push(clipPath);
	}

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
