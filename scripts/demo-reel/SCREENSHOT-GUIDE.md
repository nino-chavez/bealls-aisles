# Screenshot Capture Guide — Sleep Country BQ Calibration Reel

All screenshots **1440×900**. Browser: any Chromium-based with a window forced to that viewport. Set zoom to 100%. Hide bookmarks bar. Use light or dark theme consistently across the reel — pick one.

Production URL: `https://aisles-demo-4.bigcommerce-testing-7727.workers.dev`

## Scene 1 — `scene-01-facebook-prior.png`

**What to show:** Dev panel showing the cold-start prior firing, primary=hunter, "primed by: facebook".

**How to capture:**
1. In Chrome DevTools → Network → enable "Override headers" or use the URL trick: append `?dev=1&_replay_ref=facebook.com` to force the referrer.
2. Or simpler: open `https://aisles-demo-4.bigcommerce-testing-7727.workers.dev/?dev=1&_replay_ref=facebook.com` directly.
3. Wait for the page to render. Click the dev toolbar to expand the Inference Engine panel.
4. Verify the panel shows:
   - Primary: **hunter** with ~99% probability bar
   - The `· primed by: facebook` chip in the status line
   - Probability bars: hunter dominant, others tiny
5. Capture the panel area + a sliver of the page so the context reads as "real site, real persona detection".

**Crop target:** The dev panel + nearby UI element (e.g., a product card edge). Not the whole page.

---

## Scene 2 — `scene-02-google-prior.png`

**What to show:** Same panel state, but with `_replay_ref=google.com`. Primary=researcher.

**How to capture:**
1. Open `https://aisles-demo-4.bigcommerce-testing-7727.workers.dev/?dev=1&_replay_ref=google.com`.
2. Expand the dev panel.
3. Verify: Primary=researcher, ~87% bar, `· primed by: google` chip.
4. Capture same crop as Scene 1 for visual continuity.

---

## Scene 3 — `scene-03-replay-mid.png`

**What to show:** A replay session in progress. Picker shows the chosen session, status line shows progress + last-fired event, persona panel updated.

**How to capture:**
1. Open `https://aisles-demo-4.bigcommerce-testing-7727.workers.dev/?dev=1`.
2. Expand the dev panel → expand "Session replay" section.
3. From the dropdown, pick **"Hunter: Facebook ad → bedding cart"**.
4. Click **Replay**. Browser navigates to /category/bedding.
5. Wait until you're 4-5 events into the replay (~15 seconds in). The status line will show something like "5/6 · last: VIEW_PRODUCT Beco Home..."
6. Capture: the replay status block + the inference panel showing the updated persona probabilities + a sliver of the AI layout that's regenerated around hunter.

**This is the headline shot.** It's worth a few takes to get the timing right.

---

## Scene 4 — `scene-04-dataset.png`

**What to show:** A simple stats card. Doesn't need to be a screen capture — it's a visual.

**Two options:**

**Option A (preferred):** Build a dark-themed stats card in Figma/Keynote/Excalidraw with text:
```
SLEEP COUNTRY · BIGQUERY EXTRACT
11,629 sessions
29,870 events
7-week window (Feb 7 – Mar 27)
Privacy-filtered: hashed IDs · hour-bucketed · no PII
```
Export to PNG at 1440×900.

**Option B:** Open `docs/spikes/2026-05-05-cloudflare-portkey/sleepcountry-data-quirks.md` in a code editor with a dark theme, capture the heading + first stats. Less polished but works.

---

## Scene 5 — `scene-05-fingerprinter.png`

**What to show:** The persona-distribution table from the fingerprinter, with the fingerprint.mjs entry-point visible alongside (split view).

**How to capture:**
1. Open `docs/spikes/2026-05-05-cloudflare-portkey/sleepcountry-fingerprint-distribution.md` in a markdown preview pane.
2. Scroll to the "Persona distribution (11,629 sessions)" table — the one with researcher 9.2%, hunter 4.5%, etc.
3. Optional: split-pane with `scripts/analytics/fingerprint.mjs` showing the rule definitions (the researcher / hunter / gatherer / gifter rule blocks around lines 100-180).
4. Capture both panes if split, or just the distribution table cropped tight.

---

## Scene 6 — `scene-06-calibration.png`

**What to show:** The rule-scoring table from ADR-011 — specifically the section calling out the three inverted rules + the strong-signal confirmations.

**How to capture:**
1. Open `docs/architecture/decisions/011-sleepcountry-rule-calibration.md` in markdown preview.
2. Scroll to the **Decision** section — sections "1. Override `referrer-social`", "2. Override `in-session-search`", "3. Override `single-category-focus`" are visible.
3. Capture so the precision numbers are readable: `0.2%`, `1.4%`, `0.0%` for the inverted rules, and `91.7%`, `74.3%`, `95.0%` for the strong ones if you can fit them in.

Alternative: capture the rule-scoring report `docs/spikes/2026-05-05-cloudflare-portkey/sleepcountry-rule-scoring.md` if its layout reads better at 1440×900.

---

## Scene 7 — `scene-07-rule-code.png`

**What to show:** `src/lib/signals/inference.ts` opened to the `referrer-social` rule, with the `if (ctx.brandId === 'sleepcountry')` branch visible.

**How to capture:**
1. Open `src/lib/signals/inference.ts` in your editor.
2. Navigate to the `referrer-social` rule (around line 122-145).
3. Make sure the visible code includes:
   - The ADR-011 §1 comment
   - The `if (ctx.brandId === 'sleepcountry')` block
   - The `else` path that keeps the original gatherer lift
4. Optional: also fit the `single-category-focus` rule below if the editor size allows.
5. Capture the editor pane only — clean, no distracting UI chrome if possible.

---

## Scene 8 — `scene-08-replay-picker.png`

**What to show:** The Session Replay picker open, dropdown expanded, showing all 12 fixtures with their ground-truth labels.

**How to capture:**
1. Open `https://aisles-demo-4.bigcommerce-testing-7727.workers.dev/?dev=1`.
2. Expand the dev panel → expand "Session replay" section.
3. Click the dropdown to expand it. The list shows entries like:
   - `Researcher: comparing 4 Kingsdown mattresses (8 ev, GT:researcher)`
   - `Hunter: Facebook ad → bedding cart (6 ev, GT:hunter)`
   - …all 12
4. Capture the open dropdown + the section above it with the title.

If the dropdown closes when you take the screenshot, use Chrome DevTools → "Emulate focused page" to keep it open.

---

## Scene 9 — `scene-09-pattern.png`

**What to show:** The three-layer architecture diagram or text card.

**Two options:**

**Option A (preferred):** Build a clean text/diagram card showing:
```
AISLES — THREE LAYERS

[ ENGINE ]        AI composition · block catalog · prompts · CALIBRATION
[ FOUNDATION ]    Catalog · cart · checkout · search · locator
[ ADMIN ]         Override · config · observability  (separate repo)

Calibration is brand-scoped within the engine layer.
```

**Option B:** Capture `docs/strategic/NORTH-STAR.md` opened to the section that names the three layers.

---

## Scene 10 — `scene-10-close.png`

**What to show:** A clean text-only end card.

**Build a card** (Figma/Keynote/etc.) with:
```
AISLES

Calibrated, not heuristic.
```

Centered, restrained typography, dark or light to match the rest of the reel. 1440×900.

---

## Capture order

Scenes 1, 2, 3, 8 are interactive (need a running browser session) — capture them in one sitting to keep the dev panel state consistent.

Scenes 4, 9, 10 are text/diagram cards — build separately in your tool of choice.

Scenes 5, 6, 7 are editor/markdown captures — do them with the same theme/zoom/font for visual consistency.

## After capture

Place all 10 PNGs in `scripts/demo-reel/screenshots/` with the exact filenames above.

Then before running TTS:
1. **Read every caption aloud.** If you stumble, the TTS will too.
2. Spot-check the file list: `ls scripts/demo-reel/screenshots/` should match the `image` fields in `captions.json`.
3. Run the silent variant first (no API key, just to verify the visual pass): `node scripts/demo-reel/generate.mjs`. Inspect `out/demo-reel.mp4`. Re-shoot any screen that crops badly.
4. Once you're happy with the silent reel, set `ELEVENLABS_API_KEY` in `~/.demo-reel.env` and re-run for the narrated final.
