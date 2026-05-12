# Aisles — Live Demo Script (Sleep Country)

A presenter outline. Loose script: bullet points to hit, not sentences to read. ~12–15 minutes if you do every beat; 6–8 minutes on the cut path. The reel at `out/demo-reel.mp4` is the silent backup if anything breaks.

---

## Pre-flight (do this 5 minutes before)

**Browser tabs (in this order, all pre-loaded):**

1. `https://aisles-demo-4.bigcommerce-testing-7727.workers.dev/category/mattresses?intent=hunter&dev=true&fresh=1` — Sleep Country PLP, hunter persona, dev panel visible, cache bypassed
2. `https://aisles-demo-4.bigcommerce-testing-7727.workers.dev/category/mattresses?intent=researcher&dev=true&fresh=1` — same URL, researcher
3. `https://aisles-demo-4.bigcommerce-testing-7727.workers.dev/observe` — Observe dashboard
4. `http://localhost:3456/stores/cdfqf9k6zf` — aisles-admin (start local dev server first; if not available, fall back to scene-09/10/11 PNGs in `screenshots/`)
5. (Optional) BigQuery console showing the `sleep_country.events` table — only open if asked

**Pre-flight checks:**
- Tabs 1 and 2 actually rendered different layouts (cache may have served same — hit `?fresh=1` once on each)
- Dev panel is expanded, not collapsed
- /observe has at least one recent generation (drive a fresh page if not)
- aisles-admin shows real Postgres data (not "No analytics data") — see `capture-admin.mjs` for the cookie-mint dance if it doesn't

**If anything is broken:** play the reel. It's 4:27 and tells the same story.

---

## Opening (30 seconds, before any tab)

> "Aisles is a possibility prototype, not a product we sell. Three internal teams react to it for three different reasons — Product looks for capabilities to adopt, Engineering looks for patterns to copy, Customer Success looks for new merchant conversations. Today I'm using Sleep Country as the example merchant. Same engine running across four merchants — Bealls (pronounced *bells*), Bealls Florida, Home Centric, and Sleep Country."

That's the framing. Don't dwell.

---

## Act 1 — Surface (the engine works on a real merchant)

### Beat 1 · "Same code, four merchants" — 30s

**SHOW:** Tab 1 (hunter PLP, dev panel visible). If you have a montage slide, lead with that.

**SAY (loose):**
- Same Aisles repo, four merchants, four different commerce realities
- Sleep Country isn't off-price apparel — it's high-stakes mattress retail. 11 weeks of buying decision, not impulse.
- And yet: same engine, same code path

**POINT AT:** the brand badge in the dev panel ("sleepcountry"), and the URL bar (it's a real Cloudflare Worker)

**Skip if tight:** combine with Beat 2, just say "this is Sleep Country running on the same engine."

---

### Beat 2 · "Watch it compose, live" — 45s · *centerpiece beat*

**STAGE:** Hard reload tab 1 with Cmd+Shift+R (forces cold load). The "AI personalization in progress" state should flash for 5–10 seconds before the layout settles.

**SAY (loose):**
- This is a cold load — page hits the engine fresh
- An AI agent is composing the page right now: choosing blocks, ordering sections, writing copy
- 5 to 10 seconds. Not pre-baked. Composed *for this shopper*.

**POINT AT:** the loading state ("AI personalization in progress"), then the dev panel showing inference happening

**If timing is off:** the cold load may finish before you're done talking. That's fine — pivot to "and there it is" and move to Beat 3.

---

### Beat 3 · "Hunter layout, with provenance" — 60s

**STAGE:** Tab 1 should now be settled. Hover over the AI block badges (the `[AI]` tags above each section).

**SAY (loose):**
- Layout settled. Every block tagged with the engine that produced it.
- Category-header from the engine. Product-grid from the engine. Each labeled with the persona it was composed for — *hunter* in this case.
- Read the dev panel: hunter at 65 percent, 47-point confidence gap, one rule fired
- This isn't a template. It's a live composition.

**POINT AT:** 
1. The AI block badges (top-left of each block, small black tag)
2. The dev panel "Primary: hunter (65% prob, 47% gap)" line
3. "Signal breakdown (1 rules fired)" — click it open if there's time

**Q&A landmines here:**
- "How do you know it's not just A/B test variants?" → because it's persona-conditioned in the same code path; show by switching personas (Beat 4)
- "What's the latency?" → 5–10s on cold load (visible in the dev panel: `Layout in 7795ms`); cached after that

---

### Beat 4 · "Same URL, different shopper" — 60s

**STAGE:** Switch to tab 2 (researcher persona, same /category/mattresses). 

**SAY (loose):**
- Same URL. Same products. Same code path.
- But this shopper is a researcher — 71 percent confidence, 55-point gap
- Different blocks: editorial-header on top, expanded copy, comparison-friendly grid
- Same engine. No developer in the loop. No template fork.

**POINT AT:**
1. The URL bar (identical to tab 1 except `intent=researcher`)
2. The new editorial section that appeared
3. The dev panel showing researcher dominance

**This is the moment.** If you only have one beat to land, it's this one. Two tabs, same URL, different layouts, same engine. Pause for 2 seconds after pointing.

---

## Act 2 — Capability (it's observable and grounded)

### Beat 5 · "Engineers can see everything" — 45s

**STAGE:** Switch to tab 3 (/observe).

**SAY (loose):**
- This is what engineers see. Production telemetry, not a debug page bolted on.
- Every signal a shopper emits, the inference state at each tick, the persona probabilities
- Same pipeline as the engine — if this dashboard is wrong, the engine is wrong

**POINT AT:** the persona bar at the top, the signal timeline below, the rule cards on the right

**If tight:** combine with Beat 6.

---

### Beat 6 · "When intent shifts, the engine sees it" — 45s

**STAGE:** Stay on /observe. Find a session with a SHIFT DETECTED card (the captured screenshot has hunter→researcher).

**SAY (loose):**
- Look — this shopper changed their mind mid-session
- Hunter to researcher. The engine flagged the shift, tells you which rules contributed and what their weights were
- No black box. If the persona moves, you see exactly why.

**POINT AT:** the SHIFT DETECTED card, then the three rule cards with weights (`intent-param`, `returning-different-category`, `repeat-visitor-familiarity`)

---

### Beat 7 · "Grounded in real data, not vendor intuition" — 60s

**STAGE:** Stay on /observe OR briefly flash a BigQuery slide if you have one prepared.

**SAY (loose):**
- Where do the persona priors come from? Real shopper data.
- For Sleep Country: 11,000 anonymized sessions, 7 weeks of BigQuery data, hashed IDs, hour-bucketed timestamps, no PII
- We took our existing inference rules — built for off-price apparel — and tested them against sleep retail
- Six of ten rules transferred unchanged. Three pointed the wrong direction.
- Example: a Facebook click in apparel means *browsing*. In sleep retail, it means *paid-social purchase intent*. Same rule, opposite signal.
- We corrected three rules. Surgical. Per-brand. One ADR.

**POINT AT:** if you have the BigQuery tab, point at the row count and the date range. Otherwise just talk.

**This is your "moat" beat.** The engine isn't magic — it's calibrated. Anyone can call an LLM. Calibrating it to a specific brand and a specific shopper data shape is the work.

**Skip path:** if you're tight, drop this entirely and go straight to admin. The replay beat (Beat 8) hits the calibration story implicitly.

---

### Beat 8 · "Real shoppers, replayed" — 30s · *optional*

**STAGE:** If you have the replay UI wired and rehearsed, demo it. Otherwise skip.

**SAY (loose):**
- 12 replay fixtures, each a real anonymized journey
- Pick one, hit replay, the events fire through the same signal pipeline production uses
- Persona vector updates live, layout regenerates
- Every demo reproducible. Every claim traceable.

**Risk:** replay can break in front of an audience if the network or session-replay infra has issues. Default to skipping unless you've rehearsed it that morning.

---

## Act 3 — Merchant Control (it's not just a developer tool)

### Beat 9 · "What merchants see — Rules tab" — 45s

**STAGE:** Tab 4 (admin). Default to Rules tab.

**SAY (loose):**
- This is what merchants see. Not a developer tool — a control plane.
- Embedded inside their BigCommerce dashboard. Same auth, same UI shell, same place they manage everything else.
- Pin a product. Exclude another. Boost a category. Schedule a seasonal override. Per persona, per category, time-windowed.
- They don't write code. They curate.

**POINT AT:** the Tabs nav at top (Rules / Analytics / Preview), then the rule list

---

### Beat 10 · "Engine health, not just shopper UX" — 30s

**STAGE:** Click Analytics tab.

**SAY (loose):**
- Same panel. Cost. Cache hit rate. Persona breakdown. Daily generation cost.
- If something starts costing more or hitting cache less, the merchant sees it without filing a ticket
- Merchants own engine economics, not just shopper experience.

**POINT AT:** the cache hit % card and the daily cost chart

---

### Beat 11 · "Closed loop — Preview" — 30s

**STAGE:** Click Preview tab.

**SAY (loose):**
- Preview tab. Render any persona, any category, any time.
- Merchants see what shoppers will see — *before* they ship a rule change
- Same composition pipeline as production, with their pending edits applied
- No surprise launches.

**POINT AT:** the persona dropdown, the category selector, the rendered preview pane

---

## Close (30 seconds)

> "Aisles isn't a product. It's a calibrated engine. Observable for engineers. Controllable for merchants. Grounded in shopper data, not vendor intuition. Same engine, four merchants today. Bring your data, we calibrate the engine."

That's the line. Stop. Don't trail off into Q&A — let it land.

---

## Q&A primer

| Question | Crisp answer |
|---|---|
| Is this real or scripted? | Real. Live Cloudflare Worker. You can curl it from your phone. |
| What's the cost per page render? | Visible in the admin Analytics tab. Cached after first render — cache hit rate around 48%. |
| What model is generating the layouts? | Anthropic Claude Sonnet, routed through Cloudflare AI Gateway (or Vercel AI Gateway on the production deploys). Single-vendor isolation today; gateway makes multi-vendor a config change. |
| What if the shopper hates the AI layout? | Merchant can pin a fallback layout per persona/category. Engine respects pinned overrides. |
| Does it work without shopper data? | It works with default priors but it's worse. The 6/10 rule transfer is the calibration; without it you're guessing. |
| Why three audiences? | Aisles isn't sold. It's an artifact our internal teams react to — Product extracts capabilities, Engineering extracts patterns, CS extracts merchant conversations. |
| What about PII? | None of it leaves the warehouse. Hashed IDs, hour-bucketed timestamps, no raw addresses or names. |
| Why three brands instead of four? | Fourth slot (Sleep Country) was the calibration test — does the engine transfer to a non-apparel vertical? Six of ten rules said yes. |

---

## Cut paths (if running short)

- **6 minutes:** Beats 1, 2, 4, 9, Close. Skip everything else.
- **10 minutes:** Add Beats 3, 5, 7. Drop 6, 8, 10, 11.
- **Full 15 minutes:** All beats.

---

## Things to NOT say

- "leverage" / "empower" / "seamless" / "unlock"
- "this feature allows you to..." (the audience has eyes)
- "the so what is..." (let the insight land — if you have to announce it, it didn't land)
- "as you can see" (just show)
- "let me walk you through the architecture" (show, don't preview)
- Bealls pronounced "Bee-ells" — it's "bells"
