# DNS Cutover Plan

Per recent architectural decisions, instead of dropping TTLs and flipping existing DNS records from Vercel to Cloudflare, we are provisioning **new internal domains** for the Cloudflare-hosted versions. This keeps the Vercel versions completely independent and eliminates the need for an invasive TTL drop and DNS flip on the live endpoints.

## Provisioned Internal Domains (Cloudflare Target)
- **Bealls:** `bealls-cf.internal.signal-x.dev`
- **Bealls FL:** `bealls-fl-cf.internal.signal-x.dev`
- **Home Centric:** `hc-cf.internal.signal-x.dev`

*Note: No TTL changes are required on the legacy Vercel domains.*
