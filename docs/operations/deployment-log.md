# Cloudflare Deployment Log

Tracks Cloudflare Workers deploys for the three brands. The Vercel deploys run in parallel on separate domains and are not affected by anything in this log. Smoke status here reflects what was actually verified — entries do not assert "green" without an executed check.

## Gateways

- Bealls: `aisles-bealls`
- Bealls Florida: `aisles-bealls-fl`
- Home Centric: `aisles-hc`

## Workers

- Bealls: `aisles-demo-1` → `bealls-cf.internal.signal-x.dev`
- Bealls Florida: `aisles-demo-2` → `bealls-fl-cf.internal.signal-x.dev`
- Home Centric: `aisles-demo-3` → `hc-cf.internal.signal-x.dev`

## Smoke procedure (per brand, run after each `wrangler deploy`)

```bash
DOMAIN=https://<internal-domain>

# 1. Static asset
curl -sI "$DOMAIN/" | head -5

# 2. AI route — JSON response, structured Output parse implied
curl -s "$DOMAIN/api/layout?persona=family-shopper&category=women" | head -c 400

# 3. Streaming — TTFB < 2s, chunks visible over time
curl -N -v -w "\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" \
  "$DOMAIN/api/layout/stream?persona=family-shopper&category=women&fresh=1" 2>&1 | tail -20

# 4. (HC only) Content-mode store-locator
curl -sI "$DOMAIN/store-locator?zip=33486" | head -5

# 5. Playwright streaming assertion
SMOKE_TARGET_URL=$DOMAIN npx playwright test tests/e2e/streaming.spec.ts
```

## Log

| Date | Brand | Action | Smoke status | Notes |
|------|-------|--------|--------------|-------|
| 2026-05-05 | Bealls | Worker deployed at `https://aisles-demo-1.biq.workers.dev`. 11 secrets set via `wrangler secret bulk`. CF AI Gateway `aisles-bealls` created via API. Build: `VITE_BRAND_ID=bealls npm run build`. | **Green** | Homepage 200, title `bealls — Clothing, shoes, home & gifts for everyone`. `POST /api/layout` returns 200 in 10.1s cold-cache with valid persona-aware layout (15 products, gatherer-styled reasoning). `POST /api/layout/stream` TTFB 222ms, 9.6s of incremental SSE chunks (no buffering). Streaming mitigation drafted in spike was unneeded. |
| 2026-05-05 | Bealls Florida | Worker deployed at `https://aisles-demo-2.biq.workers.dev`. 11 secrets set. CF AI Gateway `aisles-bealls-fl` created. Build: `VITE_BRAND_ID=beallsflorida npm run build`. | **Green** | Homepage 200, title `Bealls Florida — Florida is a feeling`. `POST /api/layout` 200 in 10.7s cold-cache, valid layout. |
| 2026-05-05 | Home Centric | Worker deployed at `https://aisles-demo-3.biq.workers.dev`. 11 secrets set. CF AI Gateway `aisles-hc` created. Build: `VITE_BRAND_ID=homecentric npm run build`. | **Partial** | Homepage 200, title `Home Centric — Inspired Living for Less`. `/store-locator?zip=33486` 200 (HC's marquee content-mode path). `POST /api/layout` for HC fails 500 with `BigCommerce GraphQL error: 530` — HC is content-mode (channelId 0) so the BC fallback path doesn't apply cleanly. Not blocking for an internal possibility prototype but worth a follow-up: either skip layout-via-BC for content-mode brands or replace the BC fallback with a content-mode-aware path. |

## Issues found and fixed during deployment

These bugs surfaced because the CF AI Gateway path doesn't transparently rewrite/normalize requests the way Vercel AI Gateway does. None were called out in Gemini's spike REPORT.md, which is now corrected.

1. **`oneOf` schema rejection** — Anthropic's beta `output_config.format` rejects schemas with `oneOf` (which our discriminated-union layout schemas compile to). Vercel AI Gateway transparently rewrites; CF AI Gateway as a thin proxy doesn't. **Fix:** `gatewayProviderOptions` in `src/lib/server/ai-model.ts` now sets `providerOptions.anthropic.structuredOutputMode = 'jsonTool'` on the CF AIG path, forcing the AI SDK to use Anthropic's tool-use API instead of the new `output_config.format` API.
2. **BRAND_ID not readable from `process.env` on Workers** — Cloudflare Workers don't auto-populate `process.env` from `[vars]` bindings even with `nodejs_compat`. The original `getBrand()` relied on `process.env.BRAND_ID`, so all three Workers fell through to the default Bealls config. **Fix:** Per-brand builds via `VITE_BRAND_ID` (Vite inlines at build time). Required updating `wrangler.toml` BRAND_ID values to match `BRANDS` dict keys (`beallsflorida`, `homecentric`, not the hyphenated forms in the original config).
3. **Wrangler env name vs BRAND_ID mismatch** — `[env.bealls-fl]` is the Wrangler env name but the matching brand-config key is `beallsflorida`. Wrangler env stays hyphenated (CLI ergonomics); BRAND_ID set to the hyphenless form to match the source-of-truth dict.
