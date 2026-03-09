# Technology Stack

**Analysis Date:** 2026-03-09

## Languages

**Primary:**
- TypeScript 5.x - All application and API code in `src/**`.
- CSS (Tailwind utilities + custom CSS) - Styling in `src/app/globals.css`.

**Secondary:**
- JavaScript (Node runtime scripts) - Build and inline script usage in `package.json` `build`.
- SQL (via Prisma models/migrations) - Schema and migration definitions in `prisma/`.

## Runtime

**Environment:**
- Node.js 20+ expected by modern Next.js 16 toolchain.
- Browser runtime for client components (`"use client"` in UI files like `src/app/page.tsx` and `src/app/launch/page.tsx`).

**Package Manager:**
- npm (lockfile present: `package-lock.json`).
- Scripts are npm-based (`dev`, `build`, `start`, `lint`, `db:push`).

## Frameworks

**Core:**
- Next.js 16.1.6 - App Router for pages and API routes in `src/app/**`.
- React 19.2.3 - UI layer and client components.

**State/Data:**
- @tanstack/react-query 5.x - Client data fetching/caching (`src/components/Providers.tsx`).
- react-hook-form + zod - Form state and validation (`src/app/launch/page.tsx`, `src/lib/validators/index.ts`).

**Blockchain and Wallet:**
- @solana/web3.js + wallet-adapter packages - Wallet connection, signing, transaction flow (`src/components/Providers.tsx`, `src/app/launch/page.tsx`).
- bs58 - Transaction serialization/encoding handling.

**Data Access and Persistence:**
- Prisma 7.4.2 + @prisma/client - Database models and query API.
- @prisma/adapter-better-sqlite3 + better-sqlite3 - Runtime adapter configured in `src/lib/db/index.ts`.

**UI and Styling:**
- Tailwind CSS v4 + PostCSS (`postcss.config.mjs`, `src/app/globals.css`).
- lucide-react - Icon set for UI components.
- recharts - Chart rendering in token pages.

## Key Dependencies

**Critical:**
- `next` - Application server, router, and rendering.
- `@solana/web3.js` - Solana transaction and RPC interactions.
- `@prisma/client` - Persistence access for snapshots and launch drafts.
- `zod` - API and form input validation.
- `@tanstack/react-query` - Frontend server-state management.

**Infrastructure:**
- `@solana/wallet-adapter-*` - Wallet providers and modal UX.
- `better-sqlite3` + prisma adapter - DB driver layer used at runtime.
- `dotenv` - Local environment variable loading support.

## Configuration

**Environment:**
- `.env` and `.env.example` define required values.
- Key vars include `DATABASE_URL`, `BAGS_API_KEY`, `BAGS_API_BASE_URL`, `NEXT_PUBLIC_SOLANA_RPC_URL`, `HELIUS_API_KEY`, and partner/admin settings.

**Build and Tooling:**
- `tsconfig.json` uses strict TypeScript with path alias `@/*`.
- `eslint.config.mjs` uses `eslint-config-next` presets.
- `next.config.ts` currently minimal (no custom runtime/image/domain overrides).
- `prisma/schema.prisma` defines DB models.

## Platform Requirements

**Development:**
- Works on local Node environment with writable filesystem (for `public/uploads`).
- Requires network access to Solana RPC and external APIs (Bags, DexScreener, CoinGecko, optional Xquik).

**Production:**
- Best fit is a Node-hosted Next.js runtime.
- If deployed serverless/ephemeral, local file upload behavior and in-memory caches need special handling.

---

*Stack analysis: 2026-03-09*
*Update after major dependency or runtime changes*
