# Supabase Security Hardening

This project stores internal application data in Prisma-managed PostgreSQL
tables. Supabase warns when those tables live in the `public` schema without
Row Level Security enabled, because the Data API can expose them to the
`anon`/`authenticated` roles.

## What Was Fixed In The Repo

- Added [scripts/supabase-public-hardening.sql](/c:/Users/user/Desktop/bagscanai/scripts/supabase-public-hardening.sql) to enable RLS on the current internal public tables.
- Updated [scripts/alerts-postgres.sql](/c:/Users/user/Desktop/bagscanai/scripts/alerts-postgres.sql) so fresh alert-table installs do not leave those tables publicly accessible.
- Kept the existing `db:secure:public` package script aligned with the new hardening SQL:

```bash
npm run db:secure:public
```

## Immediate Safe Fix

Run the hardening SQL after any Prisma `db push` or any new database bootstrap
that creates these tables inside `public`:

```bash
npm run db:secure:public
```

That script enables RLS on:

- `TokenSnapshot`
- `TokenRegistry`
- `LaunchDraft`
- `PartnerSnapshot`
- `AlertPreference`
- `TelegramBroadcastTarget`
- `TelegramBotState`
- `PushSubscription`
- `AlertNotification`

For this app, that is the safest fast fix because BagScan uses server-side
Postgres/Prisma access for these tables rather than public Supabase client
queries.

## What Still Needs Human Approval

The permanent fix is to move internal Prisma tables out of the `public` schema
into a non-exposed schema such as `private`. That is not applied automatically
here because it is a live schema migration and can break production if done
without coordination.

## Post-Fix Checklist

1. Open Supabase `Advisors` and confirm the `rls_disabled_in_public` warning is cleared.
2. Check `API > Exposed schemas` and make sure only intentionally public schemas remain exposed.
3. After any future `prisma db push` against a fresh environment, run `npm run db:secure:public`.
4. Schedule the longer-term migration of internal tables from `public` to a private schema.
