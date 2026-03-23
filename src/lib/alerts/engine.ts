import webpush from "web-push";
import type {
    AlertNotification as AlertNotificationRecord,
    AlertPreference as AlertPreferenceRecord,
    PushSubscription as PushSubscriptionRecord,
} from "@prisma/client";
import {
    AlertKind as PrismaAlertKind,
    AlertSeverity as PrismaAlertSeverity,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateAlphaFeed } from "@/lib/alpha/engine";
import { getPortfolioForWallet } from "@/lib/portfolio/service";
import { getTelegramConfig } from "./telegram";
import type { AlphaToken } from "@/lib/alpha/types";
import type { PortfolioHolding } from "@/lib/portfolio/types";
import type {
    AlertNotificationItem,
    AlertPreferenceState,
    AlertPreferenceUpdateInput,
    AlertStateResponse,
} from "./types";

const ALERT_EVALUATION_INTERVAL_MS = 90_000;
const DEFAULT_NOTIFICATION_LIMIT = 30;
const PUSH_ACTION_FALLBACK = "/alpha";

interface AlertCandidate {
    kind: PrismaAlertKind;
    severity: PrismaAlertSeverity;
    title: string;
    message: string;
    eventKey: string;
    tokenMint?: string;
    actionUrl?: string;
    imageUrl?: string;
}

interface SerializedPushSubscription {
    endpoint?: string;
    expirationTime?: number | null;
    keys?: {
        p256dh?: string;
        auth?: string;
    };
}

function mapPreference(record: AlertPreferenceRecord): AlertPreferenceState {
    return {
        walletAddress: record.walletAddress,
        inAppEnabled: record.inAppEnabled,
        browserPushEnabled: record.browserPushEnabled,
        telegramEnabled: record.telegramEnabled,
        alphaHotEnabled: record.alphaHotEnabled,
        alphaCriticalEnabled: record.alphaCriticalEnabled,
        portfolioProfitEnabled: record.portfolioProfitEnabled,
        portfolioDrawdownEnabled: record.portfolioDrawdownEnabled,
        feesEnabled: record.feesEnabled,
        profitThresholdPercent: record.profitThresholdPercent,
        drawdownThresholdPercent: record.drawdownThresholdPercent,
        claimableFeesThresholdSol: record.claimableFeesThresholdSol,
        telegramChatId: record.telegramChatId,
        lastEvaluatedAt: record.lastEvaluatedAt?.toISOString() ?? null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
    };
}

function mapNotification(record: AlertNotificationRecord): AlertNotificationItem {
    return {
        id: record.id,
        kind: record.kind,
        severity: record.severity,
        title: record.title,
        message: record.message,
        tokenMint: record.tokenMint,
        actionUrl: record.actionUrl,
        imageUrl: record.imageUrl,
        createdAt: record.createdAt.toISOString(),
        readAt: record.readAt?.toISOString() ?? null,
    };
}

function getPushConfig() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    const configured = Boolean(publicKey && privateKey && subject);

    return {
        configured,
        publicKey,
        privateKey,
        subject,
    };
}

function hasAnyDeliveryEnabled(preference: AlertPreferenceRecord) {
    return (
        preference.inAppEnabled ||
        preference.browserPushEnabled ||
        preference.telegramEnabled
    );
}

function getEventBucket(hours: number) {
    return Math.floor(Date.now() / (hours * 60 * 60 * 1000));
}

function toSeverity(kind: "info" | "hot" | "critical") {
    if (kind === "critical") return PrismaAlertSeverity.critical;
    if (kind === "hot") return PrismaAlertSeverity.hot;
    return PrismaAlertSeverity.info;
}

function formatTokenLabel(symbol?: string, mint?: string) {
    if (symbol) return `$${symbol}`;
    if (mint) return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
    return "Token";
}

function formatPercent(value: number) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
}

function formatSol(value: number) {
    return `${value.toFixed(value >= 10 ? 2 : 4)} SOL`;
}

function createActionUrl(tokenMint?: string, fallback = PUSH_ACTION_FALLBACK) {
    return tokenMint ? `/token/${tokenMint}` : fallback;
}

function buildAlphaCriticalCandidates(tokens: AlphaToken[]): AlertCandidate[] {
    return tokens
        .filter((token) =>
            token.alphaScore >= 90 ||
            token.signals.some((signal) => signal.severity === "critical")
        )
        .slice(0, 3)
        .map((token) => ({
            kind: PrismaAlertKind.alpha_critical,
            severity: toSeverity("critical"),
            title: `${formatTokenLabel(token.symbol, token.tokenMint)} reached critical alpha`,
            message: [
                token.priceChange24h !== undefined ? `Move ${formatPercent(token.priceChange24h)}` : null,
                token.txCount24h ? `${token.txCount24h} tx/24h` : null,
                token.trendingNowScore ? `trend ${token.trendingNowScore}` : null,
            ].filter(Boolean).join(" | "),
            eventKey: `alpha-critical:${token.tokenMint}:${getEventBucket(4)}`,
            tokenMint: token.tokenMint,
            actionUrl: createActionUrl(token.tokenMint),
            imageUrl: token.image,
        }));
}

function buildAlphaHotCandidates(tokens: AlphaToken[]): AlertCandidate[] {
    return tokens
        .filter((token) => token.isTrendingNow && (token.trendingNowScore ?? 0) >= 80)
        .slice(0, 4)
        .map((token) => ({
            kind: PrismaAlertKind.alpha_hot,
            severity: toSeverity((token.trendingNowScore ?? 0) >= 110 ? "critical" : "hot"),
            title: `${formatTokenLabel(token.symbol, token.tokenMint)} is trending now`,
            message:
                token.trendingReasons?.join(" | ") ||
                `${token.txCount24h ?? 0} tx in 24h | ${formatPercent(token.priceChange24h ?? 0)}`,
            eventKey: `alpha-hot:${token.tokenMint}:${getEventBucket(2)}`,
            tokenMint: token.tokenMint,
            actionUrl: createActionUrl(token.tokenMint),
            imageUrl: token.image,
        }));
}

function buildProfitCandidates(
    holdings: PortfolioHolding[],
    thresholdPercent: number
) {
    return holdings
        .filter((holding) =>
            (holding.unrealizedPnlPercent ?? Number.NEGATIVE_INFINITY) >= thresholdPercent &&
            (holding.valueUsd ?? 0) >= 25
        )
        .sort((a, b) => (b.unrealizedPnlPercent ?? 0) - (a.unrealizedPnlPercent ?? 0))
        .slice(0, 3)
        .map((holding) => ({
            kind: PrismaAlertKind.portfolio_profit,
            severity: toSeverity((holding.unrealizedPnlPercent ?? 0) >= thresholdPercent * 1.8 ? "critical" : "hot"),
            title: `${formatTokenLabel(holding.symbol, holding.mint)} is above your profit target`,
            message: `${formatPercent(holding.unrealizedPnlPercent ?? 0)} unrealized | value ${holding.valueUsd?.toFixed(2) ? `$${holding.valueUsd.toFixed(2)}` : "$0.00"}`,
            eventKey: `portfolio-profit:${holding.mint}:${thresholdPercent}:${getEventBucket(6)}`,
            tokenMint: holding.mint,
            actionUrl: createActionUrl(holding.mint, "/portfolio"),
            imageUrl: holding.image,
        }));
}

function buildDrawdownCandidates(
    holdings: PortfolioHolding[],
    thresholdPercent: number
) {
    return holdings
        .filter((holding) =>
            (holding.unrealizedPnlPercent ?? Number.POSITIVE_INFINITY) <= thresholdPercent &&
            (holding.valueUsd ?? 0) >= 25
        )
        .sort((a, b) => (a.unrealizedPnlPercent ?? 0) - (b.unrealizedPnlPercent ?? 0))
        .slice(0, 3)
        .map((holding) => ({
            kind: PrismaAlertKind.portfolio_drawdown,
            severity: toSeverity((holding.unrealizedPnlPercent ?? 0) <= thresholdPercent * 1.75 ? "critical" : "hot"),
            title: `${formatTokenLabel(holding.symbol, holding.mint)} fell below your drawdown limit`,
            message: `${formatPercent(holding.unrealizedPnlPercent ?? 0)} unrealized | value ${holding.valueUsd?.toFixed(2) ? `$${holding.valueUsd.toFixed(2)}` : "$0.00"}`,
            eventKey: `portfolio-drawdown:${holding.mint}:${thresholdPercent}:${getEventBucket(4)}`,
            tokenMint: holding.mint,
            actionUrl: createActionUrl(holding.mint, "/portfolio"),
            imageUrl: holding.image,
        }));
}

function buildFeeClaimCandidate(
    wallet: string,
    claimableFeesSol: number
) {
    return {
        kind: PrismaAlertKind.fee_claim,
        severity: toSeverity(claimableFeesSol >= 1 ? "critical" : "hot"),
        title: "Claimable Bags fees are ready",
        message: `${wallet.slice(0, 4)}...${wallet.slice(-4)} can claim ${formatSol(claimableFeesSol)}`,
        eventKey: `fee-claim:${wallet}:${getEventBucket(6)}`,
        actionUrl: "/portfolio",
    } satisfies AlertCandidate;
}

async function getOrCreatePreference(walletAddress: string) {
    return prisma.alertPreference.upsert({
        where: { walletAddress },
        create: { walletAddress },
        update: {},
    });
}

async function createNotificationIfMissing(walletAddress: string, candidate: AlertCandidate) {
    const existing = await prisma.alertNotification.findUnique({
        where: {
            walletAddress_eventKey: {
                walletAddress,
                eventKey: candidate.eventKey,
            },
        },
    });

    if (existing) {
        return null;
    }

    return prisma.alertNotification.create({
        data: {
            walletAddress,
            kind: candidate.kind,
            severity: candidate.severity,
            title: candidate.title,
            message: candidate.message,
            eventKey: candidate.eventKey,
            tokenMint: candidate.tokenMint,
            actionUrl: candidate.actionUrl,
            imageUrl: candidate.imageUrl,
        },
    });
}

async function sendBrowserPush(
    preference: AlertPreferenceRecord,
    notifications: AlertNotificationRecord[],
    subscriptions: PushSubscriptionRecord[]
) {
    const pushConfig = getPushConfig();
    if (!pushConfig.configured || !preference.browserPushEnabled || subscriptions.length === 0) {
        return;
    }

    webpush.setVapidDetails(pushConfig.subject!, pushConfig.publicKey!, pushConfig.privateKey!);

    const top = notifications[0];
    const payload = JSON.stringify({
        title:
            notifications.length > 1
                ? `${notifications.length} new BagScan alerts`
                : top.title,
        body:
            notifications.length > 1
                ? notifications
                    .slice(0, 3)
                    .map((item) => item.title)
                    .join(" | ")
                : top.message,
        url: top.actionUrl || PUSH_ACTION_FALLBACK,
        tag: `bagscan-alerts-${preference.walletAddress}`,
    });

    await Promise.allSettled(
        subscriptions.map(async (subscription) => {
            try {
                await webpush.sendNotification(
                    {
                        endpoint: subscription.endpoint,
                        expirationTime: subscription.expirationTime ? Number(subscription.expirationTime) : null,
                        keys: {
                            p256dh: subscription.p256dh,
                            auth: subscription.auth,
                        },
                    },
                    payload
                );
            } catch (error) {
                const statusCode =
                    typeof error === "object" && error !== null && "statusCode" in error
                        ? Number((error as { statusCode?: number }).statusCode)
                        : undefined;

                if (statusCode === 404 || statusCode === 410) {
                    await prisma.pushSubscription.delete({
                        where: { endpoint: subscription.endpoint },
                    }).catch(() => undefined);
                } else {
                    console.error("[alerts] browser push error:", error);
                }
            }
        })
    );

    await prisma.alertNotification.updateMany({
        where: {
            id: { in: notifications.map((item) => item.id) },
        },
        data: {
            deliveredPushAt: new Date(),
        },
    });
}

async function sendTelegram(
    preference: AlertPreferenceRecord,
    notifications: AlertNotificationRecord[]
) {
    const telegramConfig = getTelegramConfig();
    if (
        !telegramConfig.configured ||
        !preference.telegramEnabled ||
        !preference.telegramChatId ||
        notifications.length === 0
    ) {
        return;
    }

    const top = notifications[0];
    const body =
        notifications.length > 1
            ? notifications
                .slice(0, 4)
                .map((item, index) => `${index + 1}. ${item.title}\n${item.message}`)
                .join("\n\n")
            : `${top.title}\n${top.message}`;

    const response = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            chat_id: preference.telegramChatId,
            text: `BagScan Alerts\n\n${body}`,
            disable_web_page_preview: true,
        }),
    });

    if (!response.ok) {
        const raw = await response.text().catch(() => "");
        console.error("[alerts] telegram error:", response.status, raw);
        return;
    }

    await prisma.alertNotification.updateMany({
        where: {
            id: { in: notifications.map((item) => item.id) },
        },
        data: {
            deliveredTelegramAt: new Date(),
        },
    });
}

async function deliverNotifications(
    preference: AlertPreferenceRecord,
    notifications: AlertNotificationRecord[]
) {
    if (notifications.length === 0) return;
    const subscriptions =
        preference.browserPushEnabled
            ? await prisma.pushSubscription.findMany({
                where: { walletAddress: preference.walletAddress },
            })
            : [];

    await Promise.allSettled([
        sendBrowserPush(preference, notifications, subscriptions),
        sendTelegram(preference, notifications),
    ]);
}

export async function evaluateAlertsForWallet(walletAddress: string, force = false) {
    const preference = await getOrCreatePreference(walletAddress);

    if (!hasAnyDeliveryEnabled(preference)) {
        return { preference, created: [] as AlertNotificationRecord[] };
    }

    if (
        !force &&
        preference.lastEvaluatedAt &&
        Date.now() - preference.lastEvaluatedAt.getTime() < ALERT_EVALUATION_INTERVAL_MS
    ) {
        return { preference, created: [] as AlertNotificationRecord[] };
    }

    const [alphaFeed, portfolio] = await Promise.all([
        generateAlphaFeed(),
        getPortfolioForWallet(walletAddress),
    ]);

    const candidates: AlertCandidate[] = [];

    if (preference.alphaCriticalEnabled) {
        candidates.push(...buildAlphaCriticalCandidates(alphaFeed.tokens));
    }

    if (preference.alphaHotEnabled) {
        candidates.push(...buildAlphaHotCandidates(alphaFeed.tokens));
    }

    if (preference.portfolioProfitEnabled) {
        candidates.push(...buildProfitCandidates(portfolio.holdings, preference.profitThresholdPercent));
    }

    if (preference.portfolioDrawdownEnabled) {
        candidates.push(...buildDrawdownCandidates(portfolio.holdings, preference.drawdownThresholdPercent));
    }

    if (
        preference.feesEnabled &&
        portfolio.summary.claimableFeesSol >= preference.claimableFeesThresholdSol
    ) {
        candidates.push(
            buildFeeClaimCandidate(walletAddress, portfolio.summary.claimableFeesSol)
        );
    }

    const created = (
        await Promise.all(candidates.map((candidate) => createNotificationIfMissing(walletAddress, candidate)))
    ).filter((item): item is AlertNotificationRecord => item !== null);

    await prisma.alertPreference.update({
        where: { walletAddress },
        data: { lastEvaluatedAt: new Date() },
    });

    if (created.length > 0) {
        await deliverNotifications(preference, created);
    }

    return { preference, created };
}

export async function getAlertState(walletAddress: string, evaluate = true): Promise<AlertStateResponse> {
    if (evaluate) {
        await evaluateAlertsForWallet(walletAddress);
    } else {
        await getOrCreatePreference(walletAddress);
    }

    const [preference, notifications, unreadCount] = await Promise.all([
        prisma.alertPreference.findUniqueOrThrow({
            where: { walletAddress },
        }),
        prisma.alertNotification.findMany({
            where: { walletAddress },
            orderBy: { createdAt: "desc" },
            take: DEFAULT_NOTIFICATION_LIMIT,
        }),
        prisma.alertNotification.count({
            where: {
                walletAddress,
                readAt: null,
            },
        }),
    ]);

    const pushConfig = getPushConfig();
    const telegramConfig = getTelegramConfig();

    return {
        wallet: walletAddress,
        unreadCount,
        preference: mapPreference(preference),
        notifications: notifications.map(mapNotification),
        config: {
            browserPushConfigured: pushConfig.configured,
            telegramConfigured: telegramConfig.configured,
            vapidPublicKey: pushConfig.publicKey,
            requiresSecureOrigin: true,
        },
    };
}

export async function updateAlertPreference(
    walletAddress: string,
    input: AlertPreferenceUpdateInput
) {
    const current = await getOrCreatePreference(walletAddress);
    const nextTelegramEnabled = input.telegramEnabled ?? current.telegramEnabled;
    const nextTelegramChatId =
        input.telegramChatId === undefined
            ? current.telegramChatId
            : input.telegramChatId?.trim() || null;

    if (nextTelegramEnabled && !nextTelegramChatId) {
        throw new Error("Telegram alerts require a Telegram chat ID");
    }

    if (input.profitThresholdPercent !== undefined && input.profitThresholdPercent <= 0) {
        throw new Error("Profit threshold must be greater than 0");
    }

    if (input.drawdownThresholdPercent !== undefined && input.drawdownThresholdPercent >= 0) {
        throw new Error("Drawdown threshold must be below 0");
    }

    if (input.claimableFeesThresholdSol !== undefined && input.claimableFeesThresholdSol < 0) {
        throw new Error("Claimable SOL threshold cannot be negative");
    }

    return prisma.alertPreference.update({
        where: { walletAddress },
        data: {
            inAppEnabled: input.inAppEnabled,
            browserPushEnabled: input.browserPushEnabled,
            telegramEnabled: input.telegramEnabled,
            alphaHotEnabled: input.alphaHotEnabled,
            alphaCriticalEnabled: input.alphaCriticalEnabled,
            portfolioProfitEnabled: input.portfolioProfitEnabled,
            portfolioDrawdownEnabled: input.portfolioDrawdownEnabled,
            feesEnabled: input.feesEnabled,
            profitThresholdPercent: input.profitThresholdPercent,
            drawdownThresholdPercent: input.drawdownThresholdPercent,
            claimableFeesThresholdSol: input.claimableFeesThresholdSol,
            telegramChatId:
                input.telegramChatId === undefined
                    ? undefined
                    : nextTelegramChatId,
        },
    });
}

export async function markAlertsRead(
    walletAddress: string,
    input: { ids?: string[]; all?: boolean }
) {
    const where = input.all
        ? { walletAddress, readAt: null }
        : { walletAddress, id: { in: input.ids ?? [] } };

    await prisma.alertNotification.updateMany({
        where,
        data: {
            readAt: new Date(),
        },
    });
}

export async function savePushSubscription(
    walletAddress: string,
    subscription: SerializedPushSubscription,
    userAgent?: string | null
) {
    const p256dh = subscription.keys?.p256dh;
    const auth = subscription.keys?.auth;

    if (!subscription.endpoint || !p256dh || !auth) {
        throw new Error("Incomplete push subscription payload");
    }

    await prisma.pushSubscription.upsert({
        where: {
            endpoint: subscription.endpoint,
        },
        create: {
            walletAddress,
            endpoint: subscription.endpoint,
            p256dh,
            auth,
            expirationTime:
                subscription.expirationTime === null || subscription.expirationTime === undefined
                    ? null
                    : String(subscription.expirationTime),
            userAgent: userAgent ?? null,
        },
        update: {
            walletAddress,
            p256dh,
            auth,
            expirationTime:
                subscription.expirationTime === null || subscription.expirationTime === undefined
                    ? null
                    : String(subscription.expirationTime),
            userAgent: userAgent ?? null,
        },
    });
}

export async function deletePushSubscription(walletAddress: string, endpoint: string) {
    await prisma.pushSubscription.deleteMany({
        where: {
            walletAddress,
            endpoint,
        },
    });
}

export async function logoutAlertSessionData(walletAddress: string) {
    await prisma.pushSubscription.deleteMany({
        where: { walletAddress },
    });
}

export async function runAlertsCron(limit = 100) {
    const preferences = await prisma.alertPreference.findMany({
        orderBy: [
            { lastEvaluatedAt: "asc" },
            { createdAt: "asc" },
        ],
        take: limit,
    });

    let createdCount = 0;

    for (const preference of preferences) {
        try {
            const result = await evaluateAlertsForWallet(preference.walletAddress, true);
            createdCount += result.created.length;
        } catch (error) {
            console.error(`[alerts] cron evaluation failed for ${preference.walletAddress}:`, error);
        }
    }

    return {
        walletsProcessed: preferences.length,
        createdCount,
    };
}

export async function sendTestAlert(
    walletAddress: string,
    channel: "inbox" | "push" | "telegram"
) {
    const preference = await getOrCreatePreference(walletAddress);
    const notification = await prisma.alertNotification.create({
        data: {
            walletAddress,
            kind: PrismaAlertKind.system,
            severity:
                channel === "inbox"
                    ? PrismaAlertSeverity.info
                    : PrismaAlertSeverity.hot,
            title: `BagScan ${channel.toUpperCase()} test`,
            message:
                channel === "inbox"
                    ? "Your in-app notification center is working."
                    : channel === "push"
                        ? "Your browser push channel is armed and receiving alerts."
                        : "Your Telegram channel is connected and receiving alerts.",
            eventKey: `system-test:${channel}:${Date.now()}`,
            actionUrl: "/alpha",
        },
    });

    if (channel === "push") {
        if (!getPushConfig().configured) {
            throw new Error("Browser push is not configured on the server");
        }
        if (!preference.browserPushEnabled) {
            throw new Error("Enable browser push first");
        }

        const subscriptions = await prisma.pushSubscription.findMany({
            where: { walletAddress },
        });
        if (subscriptions.length === 0) {
            throw new Error("No browser push subscription found for this wallet");
        }

        await sendBrowserPush(preference, [notification], subscriptions);
    }

    if (channel === "telegram") {
        if (!getTelegramConfig().configured) {
            throw new Error("Telegram is not configured on the server");
        }
        if (!preference.telegramEnabled) {
            throw new Error("Enable Telegram alerts first");
        }
        if (!preference.telegramChatId) {
            throw new Error("Add a Telegram chat ID first");
        }

        await sendTelegram(preference, [notification]);
    }

    return {
        message:
            channel === "inbox"
                ? "Test alert created in your inbox."
                : channel === "push"
                    ? "Test push sent to this browser."
                    : "Test alert sent to Telegram.",
    };
}
