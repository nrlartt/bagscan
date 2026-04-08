-- BagScan public-schema hardening for Supabase.
--
-- These tables are internal application tables used through Prisma/server-side
-- Postgres connections. Enabling RLS without adding anon/authenticated policies
-- blocks public Data API access while preserving server-side access patterns.

DO $$
DECLARE
    table_name TEXT;
    internal_tables CONSTANT TEXT[] := ARRAY[
        'TokenSnapshot',
        'TokenRegistry',
        'LaunchDraft',
        'PartnerSnapshot',
        'AlertPreference',
        'TelegramBroadcastTarget',
        'TelegramBotState',
        'PushSubscription',
        'AlertNotification'
    ];
BEGIN
    FOREACH table_name IN ARRAY internal_tables LOOP
        IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
            EXECUTE format(
                'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
                table_name
            );
        END IF;
    END LOOP;
END $$;
