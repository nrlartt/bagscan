# Codebase Concerns

**Analysis Date:** 2026-03-09

## Tech Debt

**Prisma adapter and datasource mismatch:**
- Issue: `prisma/schema.prisma` declares `provider = "postgresql"` while runtime DB client uses `PrismaBetterSqlite3` in `src/lib/db/index.ts`.
- Why: likely evolved from local sqlite-first setup while schema moved to PostgreSQL target.
- Impact: high risk of environment-specific failures and confusing migration/runtime behavior.
- Fix approach: align runtime adapter with datasource strategy (either true Prisma Postgres client or full sqlite schema/migration alignment).

**Monolithic sync engine complexity:**
- Issue: `src/lib/sync/index.ts` holds many responsibilities (caching, feed assembly, leaderboard, search, detail persistence).
- Why: fast iteration and centralized data orchestration.
- Impact: harder to test and reason about; increased regression surface.
- Fix approach: split into focused modules (`feeds`, `leaderboard`, `search`, `detail`, `cache`).

## Known Bugs

**Launch metadata image instability across hosting setups:**
- Symptoms: launch flow can fail or produce broken token image depending on image type/host behavior.
- Trigger: provider-specific handling of multipart uploads or non-persistent local filesystem fallback.
- Workaround: use PNG/JPG and verify image post-launch.
- Root cause: mixed upload path strategy plus host dependency on local `public/uploads`.

**Recent deploy feed scope confusion for users:**
- Symptoms: users may expect "all Bags new launches" but feed intentionally shows launches tracked through this app.
- Trigger: viewing `RECENT BAGSCAN DEPLOYS` section without understanding data source.
- Workaround: clarify copy in UI and docs.
- Root cause: feed semantics differ from generic "new launches" tab.

## Security Considerations

**Admin secret in query/body checks:**
- Risk: static shared secret (`BAGSCAN_ADMIN_SECRET`) is used for admin endpoints in `src/app/api/partner/*`.
- Current mitigation: server-side equality check before action.
- Recommendations: migrate to stronger auth (signed admin wallet challenge or proper auth session), add rotation policy and audit logs.

**No route-level rate limiting:**
- Risk: public API routes can be abused (provider quota exhaustion, denial-of-service behavior).
- Current mitigation: none in route handlers.
- Recommendations: add rate limiting/throttling middleware or edge protection for high-cost endpoints.

## Performance Bottlenecks

**Token detail endpoint fan-out:**
- Problem: `src/app/api/tokens/[mint]/route.ts` and sync detail path perform multiple upstream calls per request.
- Measurement: not instrumented in-code.
- Cause: sequential/parallel external calls (Bags, DexScreener, Helius, DB).
- Improvement path: add response-time metrics, cache normalized detail snapshots more aggressively, isolate slow providers.

**Search scaling cost:**
- Problem: `searchAllTokens` can require broad pool scans and metadata hydration.
- Measurement: not instrumented in-code.
- Cause: in-memory matching over large pool sets plus external metadata fetch for misses.
- Improvement path: index searchable token fields in persistent store and query indexed tables first.

## Fragile Areas

**Launch orchestration transaction chain:**
- Why fragile: multi-step client flow in `src/app/launch/page.tsx` depends on several remote APIs and user wallet signing sequence.
- Common failures: partial completion when one step fails after previous success.
- Safe modification: keep strict step boundaries, preserve explicit status machine, add idempotency hints where possible.
- Test coverage: no automated tests for this sequence.

**RPC send path with skipPreflight:**
- Why fragile: `src/app/api/rpc/send-transaction/route.ts` uses `skipPreflight: true`, which can allow avoidable failed submissions.
- Common failures: transactions accepted by endpoint but fail on chain due to unchecked preflight conditions.
- Safe modification: make preflight behavior configurable per operation.
- Test coverage: no integration tests for transaction broadcast behavior.

## Scaling Limits

**In-memory caches are process-local:**
- Current capacity: works for single-node/dev process assumptions.
- Limit: multi-instance/serverless deployments cannot share cache state.
- Symptoms at limit: inconsistent feed freshness and duplicated upstream load.
- Scaling path: move hot caches to shared store (Redis or managed cache).

**Local upload storage:**
- Current capacity: limited by local disk and instance lifetime.
- Limit: ephemeral or multi-instance environments lose or desynchronize files.
- Symptoms at limit: missing images, inconsistent metadata URL behavior.
- Scaling path: migrate upload storage to object storage (S3/R2/Supabase Storage).

## Dependencies at Risk

**External API contract drift:**
- Risk: Bags or DexScreener response shape changes can break parsing (`src/lib/bags/client.ts`, `src/lib/sync/index.ts`).
- Impact: token feeds and launch flow degradation.
- Migration plan: add stricter runtime response guards and schema version handling.

**better-sqlite3 runtime coupling:**
- Risk: native dependency and adapter-specific behavior can complicate deployment portability.
- Impact: runtime failures on unsupported environments or mismatched DB config.
- Migration plan: standardize on one DB adapter strategy with explicit deployment target.

## Missing Critical Features

**Automated test suite:**
- Problem: no unit/integration/e2e tests for critical flows.
- Current workaround: manual testing + lint/types.
- Blocks: safe refactoring and fast regression detection.
- Implementation complexity: medium.

**Observability baseline:**
- Problem: no structured metrics/tracing/error monitoring integration.
- Current workaround: manual console log inspection.
- Blocks: production-grade debugging and SLO tracking.
- Implementation complexity: medium.

## Test Coverage Gaps

**Launch APIs (`src/app/api/launch/*`):**
- What's not tested: multipart handling, fallback behavior, and fee-share orchestration.
- Risk: regressions in monetization-critical path.
- Priority: high.
- Difficulty to test: medium (requires API mocking and integration harness).

**Sync and alpha engines (`src/lib/sync/index.ts`, `src/lib/alpha/engine.ts`):**
- What's not tested: cache invalidation behavior, merge correctness, provider fallback paths.
- Risk: silent data quality issues.
- Priority: high.
- Difficulty to test: medium-high due to many external dependencies.

---

*Concerns audit: 2026-03-09*
*Update as issues are fixed or new ones discovered*
