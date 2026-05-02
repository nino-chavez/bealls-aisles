# Demo reel — bealls/admin/observe narrative (2026-05-01)

This folder produces the Aisles demo reel: ElevenLabs TTS narration + captioned
screenshots → per-scene MP4s → concatenated master.

The current narrative covers Bealls (storefront), the BC marketplace admin
app (Decisions Inspector, Brand Voice, Persona Fit, workspace switcher),
the Observe dashboard, and the multi-brand pattern (Bealls Florida + Home
Centric). 16 scenes, ~5–7 min runtime.

The previous Haven/Volt/Ember narrative is archived in:
- `captions.haven-volt-ember.json`
- `screenshots/_archive-haven-volt-ember/`

## Files

- `captions.json` — narrative + scene metadata (voice ID, per-scene title, caption, screenshot filename, optional `captionPosition` and `holdSeconds`)
- `generate.mjs` — the reel generator (reads captions, generates TTS, composites frames, stitches clips)
- `capture.mjs` — Playwright script that auto-captures every public storefront scene
- `screenshots/` — source images referenced by scenes
- `out/demo-reel.mp4` — final output

## Regenerating the reel

**Needed in environment:**
- `ELEVENLABS_API_KEY` — required for TTS (auto-sourced from `~/Workspace/dev/apps/rally-hq/.env.local` if set there)
- `ffmpeg`, `ffprobe`, `imagemagick` (`magick` command) — used by `generate.mjs`

**Step 1: pre-warm the storefronts**

So screenshots show cached, sub-100ms layouts (the demo narrative says
"this is cached" on scene 1 — pre-warm makes that true):

```bash
npm run prewarm
```

Takes ~80s. Hits home + PLP cells × 4 personas × 3 brands.

**Step 2: auto-capture storefront scenes**

```bash
npx playwright install chromium     # one-time, ~300MB
node scripts/demo-reel/capture.mjs
```

Produces 9 of 16 screenshots from the live deployments:

- `01-bealls-home-warm.png`
- `02-dev-overlay-active.png`
- `03-persona-hunter.png`
- `04-plp-women-warm.png`
- `05-refinement-chat.png`
- `06-pdp-with-bopis.png`
- `07-cart-drawer-loading.png`
- `08-observe-dashboard.png`
- `14-bealls-florida-home.png`
- `15-homecentric-content-mode.png`

The script uses best-effort selectors for the PDP, refinement chat, and
cart-drawer flows. If any image looks wrong (e.g. the chat panel didn't
open, the cart didn't add the product), recapture that scene manually.

Set `FRESH=1` to capture cold-start states with AI loaders visible:

```bash
FRESH=1 node scripts/demo-reel/capture.mjs
```

**Step 3: capture admin scenes manually**

Six scenes need manual capture from the BC iframe (BC marketplace auth
is JWT-signed; can't be Playwright-driven without the BC dev portal flow).

Open the BC admin → Apps → Aisles Admin. Then capture at 1440×900:

### `09-admin-inspector-list.png`
- On the Decisions Inspector tab (default)
- Make sure 6+ rows are visible with brand attribution + persona % filled
- Filter to "Cache: Hits + misses" to show variety

### `10-admin-inspector-detail.png`
- On the Inspector tab, click any "Inspect" link
- Detail panel expands below
- Make sure: Context section, Persona inference (with distribution bars),
  Generation section, "Why these products" narrative are all visible

### `11-admin-brand-voice.png`
- Click Brand Voice tab
- Select "Bealls" from the brand dropdown
- Type or paste real voice guidance into the textarea
  (e.g. "Lead with the value — every Bealls customer is here for a deal that
  doesn't compromise on quality. Florida coastal cool, family-first.")
- Add tone keywords: `coastal, value-driven, family-first`
- Add forbidden terms: `luxury, premium, exclusive`
- Capture the form populated, BEFORE clicking Publish (so the green
  success state is the punchline of the next scene if you want one)

### `12-admin-persona-fit.png`
- Click Persona Fit tab
- Click "Add override" if no entries exist
- Pick brand=bealls, type a real product slug from the women's category
- Set hunter=0.95, reason="Promotional pin — Q2 hunter campaign"
- Save, then capture the table showing 1+ override row

### `13-admin-workspace-switcher.png`
- Click the workspace dropdown in the top-right header
- Capture with all three brand options visible (Open Bealls →,
  Open Bealls Florida →, Open Home Centric →)

### `16-architecture-three-layers.png`
- Open `docs/architecture/ARCHITECTURE.md` in a clean editor view
- Scroll to the three-layer diagram section
- OR: capture the repo tree showing `src/lib/server/` (engine),
  `src/lib/foundation/` (foundation), and a screenshot of the BC admin
  (the third layer) side-by-side

**Step 4: generate**

```bash
node scripts/demo-reel/generate.mjs
```

Pipeline: TTS (ElevenLabs voice `iNwc1Lv2YQLywnCvjfn1`) → frames → per-scene clips → concatenate. Output at `out/demo-reel.mp4`.

Common flags:

- `SKIP_TTS=1 node scripts/demo-reel/generate.mjs` — reuse existing audio (iterate on frames without re-billing ElevenLabs)
- `SKIP_FRAMES=1 node scripts/demo-reel/generate.mjs` — reuse existing frames (iterate on clip stitching)
- `TTS_VOICE=<id> node ...` — override voice ID

## Editing the narrative

Edit `captions.json`. Each scene has:

- `image` — filename in `screenshots/`
- `title` — bold caption title
- `caption` — body text; ElevenLabs reads this verbatim
- `captionPosition` — `"top"` or `"bottom"` (default). Flip to `top` when the bottom of the UI has important content (chat composer, cart drawer footer)
- `holdSeconds` — extra silence after narration ends (default 0.5)

After editing text only, rerun Step 4 with `SKIP_FRAMES=0` (frames are
recomposited because the caption changed) but `SKIP_TTS=0` re-runs TTS for
all scenes. To iterate on one scene's narration without re-billing every
scene, delete that scene's `audio/NN.mp3` and run with `SKIP_TTS=1` —
the script regenerates only the missing audio.
