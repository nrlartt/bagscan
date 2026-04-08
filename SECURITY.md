# Security Policy

## Supported Security Posture

BagScan includes wallet-facing flows, launch execution, alerts delivery, and server-side database access. Security issues should be reported responsibly and not disclosed publicly before triage.

## How To Report

If you discover a vulnerability, please report it privately to the maintainers with:

- a clear description of the issue
- affected routes, pages, or flows
- reproduction steps
- screenshots or logs if relevant
- impact assessment

Do not open a public GitHub issue for active security vulnerabilities.

## Sensitive Areas

Please pay particular attention to:

- wallet signing and transaction broadcasting
- launch transaction preparation and submission
- alerts auth and Telegram routing
- push subscription storage
- partner and admin flows
- database exposure and Supabase schema configuration

## Supabase Note

If Prisma-managed internal tables are created in the `public` schema, run:

```bash
npm run db:secure:public
```

See [docs/SUPABASE_SECURITY_HARDENING.md](./docs/SUPABASE_SECURITY_HARDENING.md) for the current hardening approach.
