# External Integrations

**Analysis Date:** 2026-03-09

## APIs and External Services

**Bags API v2:**
- Service: `https://public-api-v2.bags.fm/api/v1` (overridable by `BAGS_API_BASE_URL`).
  - Client: custom fetch wrapper in `src/lib/bags/client.ts`.
  - Auth: `x-api-key` header from `BAGS_API_KEY`.
  - Usage: pool discovery, launch creation, fee-share config, claim stats, partner claim/stats.

**DexScreener API:**
- Service: `https://api.dexscreener.com`.
  - Integration: direct REST fetch in `src/lib/bags/client.ts`.
  - Auth: none (public endpoints).
  - Usage: pair metadata, search, new pairs, volume/liquidity/price changes.

**Solana RPC / Helius:**
- Services: `mainnet.helius-rpc.com` and fallback public Solana RPC.
  - Integration: direct JSON-RPC calls in:
    - `src/app/api/rpc/send-transaction/route.ts`
    - `src/app/api/tokenomics/[mint]/route.ts`
    - `src/lib/bags/client.ts` (DAS asset/holder methods)
  - Auth: `HELIUS_API_KEY` when configured.

**CoinGecko API:**
- Service: `https://api.coingecko.com`.
  - Integration: direct fetch in `src/lib/bags/client.ts` for SOL/USD price.
  - Auth: none.

**Xquik API (optional):**
- Service: `https://xquik.com/api/v1`.
  - Client: `src/lib/xquik/client.ts`.
  - Auth: `x-api-key` from `XQUIK_API_KEY`.
  - Usage: radar trends, tweet/user search for alpha feed.

## Data Storage

**Database:**
- Prisma models in `prisma/schema.prisma`:
  - `TokenSnapshot`
  - `TokenRegistry`
  - `LaunchDraft`
  - `PartnerSnapshot`
- Connection source: `DATABASE_URL` env var.
- Runtime access layer: `src/lib/db/index.ts`.

**File Storage:**
- Local filesystem under `public/uploads` via:
  - `src/app/api/upload/route.ts`
  - `src/app/api/launch/create-token-info/route.ts` fallback path
- Public URL shape: `/uploads/<filename>`.

**Caching:**
- In-memory process caches only:
  - token feed caches in `src/lib/sync/index.ts`
  - alpha feed cache in `src/lib/alpha/engine.ts`
  - user cache in `src/lib/xquik/client.ts`

## Authentication and Identity

**Wallet Identity:**
- Solana wallet signatures are used for launch/swap execution in client flow (`src/app/launch/page.tsx` and swap widgets).

**Admin Access:**
- Partner routes use shared secret checks:
  - `src/app/api/partner/stats/route.ts`
  - `src/app/api/partner/claim/route.ts`
- Secret env var: `BAGSCAN_ADMIN_SECRET`.

**OAuth/User Accounts:**
- No traditional user auth provider (no NextAuth/Auth0/Supabase auth in current codebase).

## Monitoring and Observability

**Error Reporting:**
- `console.error`/`console.warn` used across routes and library modules.
- No Sentry/Datadog/OpenTelemetry integration found.

**Analytics:**
- No dedicated product analytics SDK found.

## CI/CD and Deployment

**Hosting:**
- Not explicitly configured in repo.
- Project structure targets standard Next.js deployment flow.

**CI Pipeline:**
- No `.github/workflows/*` pipeline found in repository.
- Validation currently appears to be manual (`npm run lint`, `npx tsc --noEmit`, manual runtime checks).

## Environment Configuration

**Development:**
- Uses `.env` for API keys and partner configuration.
- Core required vars for app behavior:
  - `DATABASE_URL`
  - `BAGS_API_KEY`
  - `BAGS_API_BASE_URL`
  - `NEXT_PUBLIC_SOLANA_RPC_URL`
  - `HELIUS_API_KEY` (recommended)

**Production:**
- Secrets should be injected by host environment variable manager.
- Local upload fallback requires persistent shared storage or a replacement object store integration.

## Webhooks and Callbacks

**Incoming webhooks:**
- None detected in `src/app/api/**`.

**Outgoing callbacks/webhooks:**
- None detected (integrations are request/response pull style).

---

*Integration audit: 2026-03-09*
*Update when adding/removing external services*
