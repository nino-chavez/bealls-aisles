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
| 2026-05-05 | Bealls | Worker deployed, custom domain mapped | **Pending operator validation** | Domain mapping recorded; smoke checks above not yet executed against live URL. Re-run before publishing the URL to anyone. |
| _pending_ | Bealls Florida | — | — | `wrangler deploy --env bealls-fl` + smoke procedure |
| _pending_ | Home Centric | — | — | `wrangler deploy --env home-centric` + smoke procedure (include /store-locator check) |
