# Coding Conventions

**Analysis Date:** 2026-03-09

## Naming Patterns

**Files:**
- `PascalCase.tsx` for component files in `src/components/bagscan/` and `src/components/launch/`.
- App Router conventions: `page.tsx` for pages and `route.ts` for API handlers.
- `index.ts` for module entry points in library folders (for example `src/lib/sync/index.ts`).

**Functions:**
- `camelCase` naming for local and exported functions.
- Event handlers in UI generally use `handle*` naming (for example `handleImageSelect` in `src/app/launch/page.tsx`).
- Async functions do not use a special suffix.

**Variables and Constants:**
- `camelCase` for variables and state.
- `UPPER_SNAKE_CASE` for module-level constants (for example `ALLOWED_IMAGE_TYPES`, TTL constants).
- No underscore prefix convention for private values.

**Types:**
- Interfaces and type aliases use `PascalCase` (`NormalizedToken`, `PlatformStats`).
- Union literals use string unions rather than enums in many places.

## Code Style

**Formatting:**
- TypeScript strict mode enabled in `tsconfig.json`.
- Codebase uses semicolons.
- String literals are predominantly double quotes.
- Indentation style is consistently space-based.

**Linting:**
- ESLint config in `eslint.config.mjs` extends Next core-web-vitals and TypeScript presets.
- Typical command: `npm run lint`.

## Import Organization

**Observed Order:**
1. External packages (`next/*`, `react`, third-party libs).
2. Internal absolute imports via `@/`.
3. Relative imports (used less frequently in this repo).
4. `import type` used when only types are needed.

**Grouping:**
- Imports are grouped with blank lines between logical groups in most files.
- No enforced alphabetical sorting plugin observed.

**Path Aliases:**
- `@/*` alias resolves to `src/*` and is widely used.

## Error Handling

**Patterns:**
- API handlers use `try/catch` and return structured JSON on failure.
- Service/client modules often catch provider errors and return null/empty fallback when non-critical.
- Critical failures throw `Error` with context strings (for example `Bags API <status>...`).

**Error Types:**
- No custom error class hierarchy currently.
- Zod schema parsing errors are allowed to bubble into route catches.

## Logging

**Framework:**
- Console logging only (`console.error`, `console.warn`).

**Patterns:**
- Logs are most common at API boundary and external integration boundary.
- Structured logger abstraction is not implemented.

## Comments

**When Comments Are Used:**
- Short section headers to separate workflow steps.
- Brief explanation for fallback behavior and integration quirks.
- Many files are intentionally self-documenting and use limited inline comments.

**JSDoc/TSDoc:**
- Not consistently applied across all modules.
- Some helper functions include concise doc comments.

**TODO Style:**
- No strict TODO comment format enforced by tooling.

## Function Design

**General Patterns:**
- Route handlers keep validation and orchestration local.
- Large orchestration functions exist in sync and launch flows.
- Guard clauses are frequently used for validation and early exits.

**Parameters and Returns:**
- Plain objects are used when request payloads are multi-field.
- API responses are typically wrapped as `{ success, data, error }`.

## Module Design

**Exports:**
- Named exports are predominant in libraries and utilities.
- Default exports are used mainly for page components.

**Barrel and Index Usage:**
- `index.ts` files are used in several library folders.
- Modules generally import concrete files directly when needed to avoid deep barrel chains.

---

*Convention analysis: 2026-03-09*
*Update when patterns change*
