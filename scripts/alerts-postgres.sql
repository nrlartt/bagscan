DO $$
BEGIN
    CREATE TYPE "AlertKind" AS ENUM (
        'alpha_hot',
        'alpha_critical',
        'portfolio_profit',
        'portfolio_drawdown',
        'fee_claim',
        'system'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "AlertSeverity" AS ENUM (
        'info',
        'hot',
        'critical'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AlertPreference" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "browserPushEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
    "alphaHotEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "alphaCriticalEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "portfolioProfitEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "portfolioDrawdownEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "feesEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "profitThresholdPercent" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "drawdownThresholdPercent" DOUBLE PRECISION NOT NULL DEFAULT -15,
    "claimableFeesThresholdSol" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "telegramChatId" TEXT,
    "lastEvaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AlertPreference_walletAddress_key"
    ON "AlertPreference" ("walletAddress");

CREATE INDEX IF NOT EXISTS "AlertPreference_lastEvaluatedAt_idx"
    ON "AlertPreference" ("lastEvaluatedAt");

CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "expirationTime" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PushSubscription_walletAddress_fkey"
        FOREIGN KEY ("walletAddress")
        REFERENCES "AlertPreference" ("walletAddress")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key"
    ON "PushSubscription" ("endpoint");

CREATE INDEX IF NOT EXISTS "PushSubscription_walletAddress_idx"
    ON "PushSubscription" ("walletAddress");

CREATE TABLE IF NOT EXISTS "AlertNotification" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "kind" "AlertKind" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "tokenMint" TEXT,
    "actionUrl" TEXT,
    "imageUrl" TEXT,
    "readAt" TIMESTAMP(3),
    "deliveredPushAt" TIMESTAMP(3),
    "deliveredTelegramAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertNotification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AlertNotification_walletAddress_fkey"
        FOREIGN KEY ("walletAddress")
        REFERENCES "AlertPreference" ("walletAddress")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AlertNotification_walletAddress_eventKey_key"
    ON "AlertNotification" ("walletAddress", "eventKey");

CREATE INDEX IF NOT EXISTS "AlertNotification_walletAddress_createdAt_idx"
    ON "AlertNotification" ("walletAddress", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "AlertNotification_walletAddress_readAt_idx"
    ON "AlertNotification" ("walletAddress", "readAt");

CREATE TABLE IF NOT EXISTS "TelegramBroadcastTarget" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "chatType" TEXT NOT NULL,
    "title" TEXT,
    "username" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "trendingEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "launchesEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "digestEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "lastTrendingSentAt" TIMESTAMP(3),
    "lastLaunchesSentAt" TIMESTAMP(3),
    "lastDigestSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramBroadcastTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TelegramBroadcastTarget_chatId_key"
    ON "TelegramBroadcastTarget" ("chatId");

CREATE INDEX IF NOT EXISTS "TelegramBroadcastTarget_isActive_idx"
    ON "TelegramBroadcastTarget" ("isActive");

CREATE TABLE IF NOT EXISTS "TelegramBotState" (
    "key" TEXT NOT NULL,
    "lastUpdateId" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramBotState_pkey" PRIMARY KEY ("key")
);

DO $$
DECLARE
    table_name TEXT;
    alert_tables CONSTANT TEXT[] := ARRAY[
        'AlertPreference',
        'PushSubscription',
        'AlertNotification',
        'TelegramBroadcastTarget',
        'TelegramBotState'
    ];
BEGIN
    FOREACH table_name IN ARRAY alert_tables LOOP
        IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
            EXECUTE format(
                'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
                table_name
            );
        END IF;
    END LOOP;
END $$;
