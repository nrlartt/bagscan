# Testing Patterns

**Analysis Date:** 2026-03-09

## Test Framework

**Runner:**
- No dedicated automated test runner (Jest/Vitest/Playwright) is configured in `package.json`.
- Current quality gates are linting and TypeScript checks.

**Assertion Library:**
- None configured because there are currently no test files in `src/**` or `prisma/**`.

**Run Commands:**
```bash
npm run lint            # ESLint checks
npx tsc --noEmit        # Type safety checks
npm run build           # Build + prisma generate + db push + Next build
```

## Test File Organization

**Current State:**
- No `tests/` directory detected.
- No `*.test.*` or `*.spec.*` files detected in repository.

**Implication:**
- Validation currently relies on static checks and manual runtime verification.

## Test Structure

**Existing Pattern:**
- Not applicable (no test suites present).

**Observed Verification Pattern in Practice:**
- API route behavior is validated by manual calls from UI flows.
- Complex workflow features (launch, swap, claim) are manually exercised against live APIs.

## Mocking

**Framework:**
- Not applicable (no test framework configured).

**Current Operational Equivalent:**
- Fallback logic in production code handles provider failures (for example in `src/lib/sync/index.ts` and `src/app/api/launch/create-token-info/route.ts`), but this is runtime resilience, not mocked testing.

## Fixtures and Factories

**Current State:**
- No dedicated fixture or factory modules for tests.
- Seed-like constants exist in app logic (for example leaderboard seed mint list in `src/lib/sync/index.ts`) but are not test fixtures.

## Coverage

**Requirements:**
- No coverage target configured.
- No CI enforcement for coverage thresholds.

**Status:**
- Effective automated test coverage is currently 0 percent because no test suites are present.

## Test Types

**Unit Tests:**
- Not implemented.

**Integration Tests:**
- Not implemented as automated suites.
- Integration confidence comes from live route calls in development.

**E2E Tests:**
- Not implemented.

## Common Patterns

**Current Quality Patterns:**
- Use Zod at API boundaries for runtime validation.
- Use TypeScript strict mode to prevent type regressions.
- Use route-level try/catch and predictable error payloads for easier manual debugging.

**Recommended Near-Term Additions (to align with current architecture):**
- Unit tests for data mappers and validators (`src/lib/bags/mappers.ts`, `src/lib/validators/index.ts`).
- Integration tests for critical API routes (`/api/launch/*`, `/api/tokens`, `/api/tokens/[mint]`).
- Smoke E2E flow for launch wizard and token detail read path.

---

*Testing analysis: 2026-03-09*
*Update when test patterns change*
