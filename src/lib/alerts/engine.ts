import "server-only";
import { prisma } from "@/lib/db";
import { getRhToken, getRhTrades } from "@/lib/rh/client";
import { parseRhFixed18, parseWeiToEth } from "@/lib/rh/mappers";
import { rhExplorerTokenUrl } from "@/lib/rh/chain";

/** Curve bands that each fire exactly once, in ascending order. */
const CURVE_BANDS = [25, 50, 75, 90] as const;
/** 7-day volume, in ETH, that counts as a spike for a Robinhood launch. */
const VOLUME_SPIKE_ETH = 0.5;

type AlertKind = "curve_progress" | "graduation" | "volume_spike" | "price_move" | "whale_trade";
type AlertSeverity = "info" | "hot" | "critical";

interface PendingAlert {
    kind: AlertKind;
    severity: AlertSeverity;
    title: string;
    body: string;
    valueLabel?: string;
    /** Rule flag on the watch that must be enabled for this alert to deliver. */
    rule: "curve" | "grad" | "volume" | "price" | "whale";
}

export interface AlertsRunSummary {
    tokensScanned: number;
    alertsCreated: number;
    watchersNotified: number;
    errors: number;
}

function pct(value: number): string {
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function ethLabel(value: number): string {
    if (value >= 1) return `${value.toFixed(2)} ETH`;
    if (value >= 0.0001) return `${value.toFixed(4)} ETH`;
    return `${value.toExponential(1)} ETH`;
}

/**
 * Compare a token's live state against the last stored snapshot and return the
 * alerts that the change justifies. Pure aside from its inputs, so the delivery
 * loop below stays easy to reason about.
 */
function diffToken(
    previous: {
        migrated: boolean;
        bondingProgressPct: number | null;
        priceEth: number | null;
        lastCurveBand: number | null;
    } | null,
    current: {
        symbol?: string;
        migrated: boolean;
        bondingProgressPct?: number;
        priceEth?: number;
        volumeEth7d: number;
        largestTradeEth: number;
    }
): { alerts: PendingAlert[]; nextCurveBand: number | null } {
    const alerts: PendingAlert[] = [];
    const label = current.symbol ? `$${current.symbol}` : "This token";
    let nextCurveBand = previous?.lastCurveBand ?? null;

    if (current.migrated && !previous?.migrated) {
        alerts.push({
            kind: "graduation",
            severity: "critical",
            title: `${label} graduated`,
            body: "The bonding curve completed and liquidity moved into the Uniswap V4 pool.",
            rule: "grad",
        });
    }

    const progress = current.bondingProgressPct ?? 0;
    if (!current.migrated) {
        for (const band of CURVE_BANDS) {
            if (progress >= band && (nextCurveBand ?? 0) < band) {
                nextCurveBand = band;
                alerts.push({
                    kind: "curve_progress",
                    severity: band >= 75 ? "critical" : "hot",
                    title: `${label} curve hit ${band}%`,
                    body: "The bonding curve is filling — graduation moves closer with every buy.",
                    valueLabel: `${Math.round(progress)}%`,
                    rule: "curve",
                });
            }
        }
    }

    if (current.volumeEth7d >= VOLUME_SPIKE_ETH) {
        alerts.push({
            kind: "volume_spike",
            severity: current.volumeEth7d >= 2 ? "critical" : "hot",
            title: `${label} volume spike`,
            body: "7-day trade volume is well above a typical Robinhood Chain launch.",
            valueLabel: ethLabel(current.volumeEth7d),
            rule: "volume",
        });
    }

    if (previous?.priceEth != null && current.priceEth != null && previous.priceEth > 0) {
        const change = ((current.priceEth - previous.priceEth) / previous.priceEth) * 100;
        if (Math.abs(change) >= 1) {
            alerts.push({
                kind: "price_move",
                severity: Math.abs(change) >= 50 ? "critical" : "hot",
                title: `${label} moved ${pct(change)}`,
                body: "Spot price changed since the last check.",
                valueLabel: pct(change),
                rule: "price",
            });
        }
    }

    if (current.largestTradeEth > 0) {
        alerts.push({
            kind: "whale_trade",
            severity: "hot",
            title: `${label} whale trade`,
            body: "A single trade moved a large amount of ETH.",
            valueLabel: ethLabel(current.largestTradeEth),
            rule: "whale",
        });
    }

    return { alerts, nextCurveBand };
}

async function deliverPush(wallet: string, title: string, body: string, tokenAddress: string) {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) return;

    const subs = await prisma.rhPushSubscription.findMany({ where: { wallet } });
    if (subs.length === 0) return;

    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:alerts@bagscan.app", publicKey, privateKey);

    await Promise.all(
        subs.map(async (sub) => {
            try {
                await webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: { p256dh: sub.p256dh, auth: sub.auth },
                    },
                    JSON.stringify({ title, body, url: `/token/${tokenAddress}` })
                );
            } catch {
                // Gone/expired endpoints are dropped rather than retried forever.
                await prisma.rhPushSubscription
                    .delete({ where: { endpoint: sub.endpoint } })
                    .catch(() => undefined);
            }
        })
    );
}

async function deliverTelegram(chatId: string, title: string, body: string, tokenAddress: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    const text = `*${title}*\n${body}\n\n[View token](${rhExplorerTokenUrl(tokenAddress)})`;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "Markdown",
            disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
}

/**
 * Evaluate every watched token once and fan the resulting alerts out to the
 * wallets watching them. Safe to call repeatedly — snapshots make each state
 * change fire once.
 */
export async function runAlertsEvaluation(): Promise<AlertsRunSummary> {
    const summary: AlertsRunSummary = {
        tokensScanned: 0,
        alertsCreated: 0,
        watchersNotified: 0,
        errors: 0,
    };

    const watches = await prisma.rhWatch.findMany({ include: { subscriber: true } });
    if (watches.length === 0) return summary;

    const byToken = new Map<string, typeof watches>();
    for (const watch of watches) {
        const list = byToken.get(watch.tokenAddress) ?? [];
        list.push(watch);
        byToken.set(watch.tokenAddress, list);
    }

    for (const [tokenAddress, tokenWatches] of byToken) {
        try {
            const detail = await getRhToken(tokenAddress);
            if (!detail) continue;
            summary.tokensScanned += 1;

            const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const trades = await getRhTrades(tokenAddress, 100)
                .then((r) => r.trades ?? [])
                .catch(() => []);
            const recent = trades.filter((t) => t.timestamp * 1000 >= since);

            let volumeEth7d = 0;
            let largestTradeEth = 0;
            let lastTradeAt: Date | undefined;
            for (const trade of recent) {
                const eth = parseWeiToEth(trade.ethWei) ?? 0;
                volumeEth7d += eth;
                if (eth > largestTradeEth) largestTradeEth = eth;
            }
            if (recent[0]) lastTradeAt = new Date(recent[0].timestamp * 1000);

            const previous = await prisma.rhTokenState.findUnique({ where: { tokenAddress } });
            const priceEth = parseRhFixed18(detail.state.priceEthPerToken);

            // Only alert on whale trades newer than the last evaluation.
            const lastSeenTrade = previous?.lastTradeAt?.getTime() ?? 0;
            const freshLargest = recent
                .filter((t) => t.timestamp * 1000 > lastSeenTrade)
                .reduce((max, t) => Math.max(max, parseWeiToEth(t.ethWei) ?? 0), 0);

            const { alerts, nextCurveBand } = diffToken(
                previous
                    ? {
                          migrated: previous.migrated,
                          bondingProgressPct: previous.bondingProgressPct,
                          priceEth: previous.priceEth,
                          lastCurveBand: previous.lastCurveBand,
                      }
                    : null,
                {
                    symbol: detail.token.symbol,
                    migrated: detail.state.migrated,
                    bondingProgressPct: detail.state.bondingProgressPct,
                    priceEth,
                    volumeEth7d,
                    largestTradeEth: freshLargest,
                }
            );

            await prisma.rhTokenState.upsert({
                where: { tokenAddress },
                create: {
                    tokenAddress,
                    symbol: detail.token.symbol,
                    name: detail.token.name,
                    image: detail.token.metadata?.image ?? null,
                    migrated: detail.state.migrated,
                    bondingProgressPct: detail.state.bondingProgressPct,
                    priceEth,
                    volumeEth7d,
                    lastTradeAt,
                    lastCurveBand: nextCurveBand,
                },
                update: {
                    symbol: detail.token.symbol,
                    name: detail.token.name,
                    image: detail.token.metadata?.image ?? null,
                    migrated: detail.state.migrated,
                    bondingProgressPct: detail.state.bondingProgressPct,
                    priceEth,
                    volumeEth7d,
                    lastTradeAt,
                    lastCurveBand: nextCurveBand,
                },
            });

            // A first sighting only establishes the baseline — no backfilled noise.
            if (!previous || alerts.length === 0) continue;

            for (const watch of tokenWatches) {
                const enabled = alerts.filter((alert) => {
                    switch (alert.rule) {
                        case "curve":
                            return watch.curveEnabled;
                        case "grad":
                            return watch.gradEnabled;
                        case "volume":
                            return watch.volumeEnabled;
                        case "price":
                            return (
                                watch.priceMovePct != null &&
                                Math.abs(Number(alert.valueLabel?.replace("%", "") ?? 0)) >= watch.priceMovePct
                            );
                        case "whale":
                            return watch.whaleTradeEth != null && freshLargest >= watch.whaleTradeEth;
                    }
                });

                if (enabled.length === 0) continue;
                summary.watchersNotified += 1;

                for (const alert of enabled) {
                    await prisma.rhAlertNotification.create({
                        data: {
                            wallet: watch.wallet,
                            tokenAddress,
                            kind: alert.kind,
                            severity: alert.severity,
                            title: alert.title,
                            body: alert.body,
                            valueLabel: alert.valueLabel,
                        },
                    });
                    summary.alertsCreated += 1;

                    if (watch.subscriber.pushEnabled) {
                        await deliverPush(watch.wallet, alert.title, alert.body, tokenAddress);
                    }
                    if (watch.subscriber.telegramEnabled && watch.subscriber.telegramChatId) {
                        await deliverTelegram(
                            watch.subscriber.telegramChatId,
                            alert.title,
                            alert.body,
                            tokenAddress
                        );
                    }
                }
            }
        } catch (error) {
            summary.errors += 1;
            console.error(`[alerts] token ${tokenAddress} failed:`, error);
        }
    }

    return summary;
}
