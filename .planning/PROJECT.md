# BagScan v1.1 Reliability and Launch Integrity

## What This Is

BagScan is a Bags-native token discovery and launch terminal built on Next.js and Solana. It helps users discover tokens, inspect analytics, and deploy new tokens through Bags with optional partner fee sharing. This initialization defines the next brownfield milestone: make launch outputs reliable and make recent deploy data strictly correct for BagScan-origin launches.

## Core Value

Launching a token through BagScan should be reliable and should produce correct, verifiable launch data.

## Requirements

### Validated

- ✓ Users can browse and search token feeds (trending/new/leaderboard/search) from the main terminal.
- ✓ Users can open token detail pages with price, chart, and claim/fee context.
- ✓ Users can connect a Solana wallet and create swap/transaction payloads.
- ✓ Users can start token launch flow from `/launch` and submit metadata to Bags APIs.
- ✓ Partner fee-share integration is available through BagScan partner wallet/config injection.
- ✓ Partner admin can access partner data and claim flow through protected endpoints.

### Active

- [ ] `RECENT BAGSCAN DEPLOYS` must show only launches created via BagScan deploy flow.
- [ ] Token image upload in launch flow must persist and resolve as the final token image.
- [ ] Launch flow must recover from transient upstream Bags API failures and show actionable errors.
- [ ] Launch APIs and feed filters need automated regression coverage.
- [ ] Launch and feed endpoints need stronger operational guardrails (logging and traffic controls).

### Out of Scope

- Multi-chain launch support beyond Solana/Bags - current product value is Solana-first.
- Full redesign of discovery UX - current milestone is reliability and correctness.
- Replacing Bags as launch backend - integration remains the core business dependency.
- Mobile-native app clients - web app remains the only target for this cycle.

## Context

Codebase mapping exists under `.planning/codebase/` and confirms a Next.js monolith with App Router pages and API routes under `src/app/api/**`. Launch orchestration is a multi-step client+API sequence and is currently the most fragile area. Current known issues include deploy feed scope confusion and launch image/upload instability across hosting setups. External dependencies (Bags, Solana RPC, DexScreener, Helius) are essential and can fail transiently, so launch reliability work must emphasize retries, validation, and observability.

## Constraints

- **Tech Stack**: Next.js 16 + TypeScript + Prisma runtime patterns must remain intact - avoids high-risk rewrites in a live product.
- **Dependency**: Bags APIs are required for launch and metadata creation - no first-party replacement in scope.
- **Compatibility**: Existing launch flow and partner fee-share behavior must remain backward compatible - protects monetization path.
- **Operational**: External API quotas and occasional 5xx responses are expected - launch must degrade gracefully.
- **Security**: Existing admin secret-based partner access stays for now - auth redesign is deferred.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Prioritize launch reliability over new feature expansion | Launch failures directly impact trust and revenue | — Pending |
| Source `RECENT BAGSCAN DEPLOYS` from BagScan-origin launch records only | Prevents mixing generic Bags launches with BagScan launches | — Pending |
| Treat image persistence as mandatory before launch submission | Broken image metadata degrades token quality and user confidence | — Pending |
| Keep milestone brownfield and additive | Reduces risk and preserves existing production behavior | — Pending |
| Keep planning mode interactive with standard granularity | Allows explicit checkpoints while keeping execution speed | — Pending |

---
*Last updated: 2026-03-09 after initialization*
