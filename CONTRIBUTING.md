# Contributing To BagScan

Thanks for your interest in contributing.

## Principles

- Keep the product Robinhood Chain–native; every surface targets chain 4663 only.
- Prefer premium, intentional UI over generic dashboard patterns.
- Preserve security defaults for wallet, alerts, Telegram, and database features.
- Keep changes grounded in verifiable on-chain behavior — check contracts and the indexer before assuming.

## Development Flow

1. Fork the repo and create a focused branch.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and configure local values.
4. Generate Prisma client with `npx prisma generate`.
5. Run the app with `npm run dev`.
6. Run checks before opening a PR:

```bash
npx eslint .
npx tsc --noEmit --pretty false
```

If your environment provisions Supabase tables inside `public`, also run:

```bash
npm run db:secure:public
```

## Pull Request Guidance

- Keep PRs scoped.
- Explain user-facing impact clearly.
- Mention any indexer API or contract-interface changes involved.
- Include screenshots or short videos for UI work.
- Note any environment variables, cron behavior, or database expectations.

## Areas That Need Extra Care

- Curve trading: quoting, slippage bounds, approvals and transaction building
- Alerts delivery, wallet sign-in and Telegram behavior
- Portfolio and wallet-related features
- Security and schema hardening

## Reporting Product Ideas

If the change is strategic or cross-cutting, open an issue or discussion first so the direction can be reviewed before implementation starts.
