# Fixing 504 Gateway Timeout (bagscan.app)

A **504** from APISIX / OpenResty means the gateway did not get a timely response from the **Next.js upstream**, not that the React app failed in the browser.

## Quick checks

1. **Is the Node process running?** Check host logs (Railway, VPS, k8s, etc.) for crash loops, OOM, or failed `npm run build`.
2. **Environment variables** on the server (not only local `.env`):
   - `DATABASE_URL` (PostgreSQL / Supabase)
   - `RH_RPC_URL` (optional; defaults to public Robinhood Chain RPC)
   - `PORT` (must match what APISIX upstream expects, often `3000`)
3. **Health probe** after deploy:
   ```bash
   curl -sS https://bagscan.app/api/health
   ```
   Expected: `{"ok":true,"service":"bagscan",...}` in under 1–2 seconds.
4. **APISIX upstream timeout** — if cold start or `/api/tokens` sync is slow, increase upstream `timeout` (e.g. 60s) for HTML; keep a short timeout only for `/api/health`.

## App defaults (post-fix)

- `/api/health` — no DB, for load balancers.
- `npm start` listens on `0.0.0.0` (required in Docker/k8s).
- Internal alerts cron is **opt-in** (`ENABLE_INTERNAL_ALERTS_RUNTIME=true`); default off so boot does not flood DB/RPC.

## Alerts in production

Use an external cron (every 1–5 min):

```http
GET /api/alerts/cron
x-alerts-cron-secret: <ALERTS_CRON_SECRET>
```

Do not enable `ENABLE_INTERNAL_ALERTS_RUNTIME` on the main web instance unless you run a single long-lived Node server and accept background load.
