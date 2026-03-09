# Architecture

**Analysis Date:** 2026-03-09

## Pattern Overview

**Overall:** Full-stack Next.js monolith with App Router pages plus route handlers.

**Key Characteristics:**
- Server-rendered and client-rendered hybrid UI.
- API routes act as backend-for-frontend layer under `src/app/api/**`.
- External-data aggregation pattern in `src/lib/sync/index.ts` and `src/lib/alpha/engine.ts`.
- Wallet-signed blockchain operations initiated in client, broadcast via server routes.

## Layers

**Presentation Layer:**
- Purpose: Render discovery, token detail, launch, and analytics screens.
- Contains: `src/app/*.tsx`, `src/components/**`, CSS in `src/app/globals.css`.
- Depends on: API routes, React Query, wallet context providers.
- Used by: End users in browser.

**API Boundary Layer:**
- Purpose: Validate and handle HTTP requests from UI.
- Contains: `src/app/api/**/route.ts`.
- Depends on: validators, sync/services, external clients, DB layer.
- Used by: frontend `fetch` calls and client-side workflows.

**Domain/Service Layer:**
- Purpose: Aggregate and normalize token, alpha, and launch flows.
- Contains:
  - `src/lib/sync/index.ts`
  - `src/lib/alpha/engine.ts`
  - `src/lib/bags/mappers.ts`
- Depends on: external client wrappers, Prisma, utility functions.
- Used by: API routes and token detail retrieval.

**Integration Layer:**
- Purpose: Encapsulate external provider calls.
- Contains:
  - `src/lib/bags/client.ts`
  - `src/lib/xquik/client.ts`
  - `src/lib/solana/*`
- Depends on: fetch + env config.
- Used by: sync/domain layer and selected API routes.

**Persistence Layer:**
- Purpose: Store snapshots, registry metadata, launch drafts, partner snapshots.
- Contains:
  - `src/lib/db/index.ts`
  - `prisma/schema.prisma`
- Depends on: Prisma client and configured adapter.
- Used by: sync routes, launch routes, partner routes.

## Data Flow

**Token Discovery Flow (`GET /api/tokens`):**
1. UI computes tab/search params in `src/app/page.tsx`.
2. API route validates query with `tokensQuerySchema`.
3. Route dispatches to `syncTrendingTokens`, `syncNewLaunches`, `syncLeaderboard`, or `searchAllTokens`.
4. Sync layer fetches/merges Bags + DexScreener (+ optional Helius enrichment in detailed paths).
5. Response returns normalized token arrays with metadata and pagination.

**Launch Flow (`/launch`):**
1. User fills metadata, fee split, and optional image in `src/app/launch/page.tsx`.
2. UI requests `/api/launch/create-token-info`.
3. API proxies payload to Bags launch endpoint via `createTokenInfo`.
4. UI creates fee-share config (`/api/launch/fee-share-config`) and signs needed tx(s).
5. UI requests `/api/launch/create` to get launch tx, signs, then sends through `/api/rpc/send-transaction`.
6. Launch draft is persisted for analytics/recent deploy feed.

**State Management:**
- Client: React Query for async UI state + local component state.
- Server: in-memory caches for hot feeds and lookups.
- Persistent: Prisma-backed tables for snapshots and launch drafts.

## Key Abstractions

**NormalizedToken:**
- Purpose: Canonical token shape used across UI/API.
- Defined in: `src/lib/bags/types.ts`.
- Used by: sync functions, token cards/tables, detail routes.

**Sync Engine:**
- Purpose: Build fast feed responses from multiple external sources.
- Location: `src/lib/sync/index.ts`.
- Pattern: cache-first with stale-while-revalidate style background refresh.

**Client Wrappers:**
- Purpose: isolate remote API specifics and retries.
- Examples:
  - `bagsGet` / `bagsPost` in `src/lib/bags/client.ts`
  - `xquikGet` in `src/lib/xquik/client.ts`

## Entry Points

**UI Entry:**
- `src/app/layout.tsx` - global provider and shell composition.
- `src/app/page.tsx` - main discovery terminal.
- `src/app/launch/page.tsx` - token launch wizard.

**API Entries:**
- `src/app/api/tokens/route.ts` - list/search tabs.
- `src/app/api/tokens/[mint]/route.ts` - token detail, claim events, snapshots.
- `src/app/api/launch/*` - launch lifecycle endpoints.
- `src/app/api/alpha/route.ts` - signal feed endpoint.

## Error Handling

**Strategy:** Fail at boundary, return structured JSON errors, and log server-side context.

**Patterns:**
- Most route handlers use `try/catch` and return `{ success: false, error: ... }`.
- External client wrappers throw enriched errors and often retry transient failures.
- Some endpoints intentionally degrade gracefully (return empty/fallback payloads on provider failures).

## Cross-Cutting Concerns

**Validation:**
- Zod schemas in `src/lib/validators/index.ts` are used for request parsing.

**Logging:**
- Console-based logging (`console.error`, `console.warn`) across routes and libs.

**Security Boundaries:**
- Secret-protected partner routes use `BAGSCAN_ADMIN_SECRET`.
- Wallet signature requirements protect actual on-chain transaction authorization.

**Caching:**
- In-memory caches reduce repeated provider calls but are process-local.

---

*Architecture analysis: 2026-03-09*
*Update when major patterns change*
