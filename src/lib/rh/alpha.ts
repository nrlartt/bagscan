import type { RhTokenListItem, RhTrade } from "./api-types";
import { parseRhFixed18, parseWeiToEth } from "./mappers";

const RH_TOTAL_SUPPLY = 1_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Robinhood Chain flow is far thinner than Solana's: of the newest 100 bonding
 * tokens only a handful have any curve progress, and graduations land days
 * apart. Signals are therefore built on a 7-day window, with the 24h slice kept
 * separately as the "is this live right now" indicator.
 */
const WINDOW_MS = 7 * DAY_MS;

export type RhAlphaSignalType =
    | "graduated"
    | "curve_momentum"
    | "volume_spike"
    | "live_flow"
    | "buy_pressure"
    | "sell_pressure"
    | "price_surge"
    | "price_dump"
    | "whale_trade"
    | "crowd_activity"
    | "new_launch";

export type RhAlphaSeverity = "low" | "medium" | "high" | "critical";

export interface RhAlphaSignal {
    type: RhAlphaSignalType;
    severity: RhAlphaSeverity;
    title: string;
    description: string;
    value?: string;
    /** Risk signals are surfaced apart from opportunity signals. */
    risk?: boolean;
}

export interface RhAlphaToken {
    address: string;
    name?: string;
    symbol?: string;
    image?: string;
    creator: string;
    isMigrated: boolean;
    bondingProgressPct?: number;
    createdAt?: string;
    migratedAt?: string;

    priceEth?: number;
    priceUsd?: number;
    fdvUsd?: number;

    /** 7-day window (primary). */
    trades7d: number;
    buys7d: number;
    sells7d: number;
    uniqueTraders7d: number;
    volumeEth7d: number;
    volumeUsd7d?: number;
    netFlowEth7d: number;
    buyPressurePct?: number;
    priceChangePct7d?: number;
    largestTradeEth?: number;

    /** 24-hour slice (freshness). */
    trades24h: number;
    volumeEth24h: number;

    lastTradeAt?: string;
    /** True when the trade page was full, so window totals are a lower bound. */
    tradesTruncated: boolean;

    alphaScore: number;
    signals: RhAlphaSignal[];
}

export interface RhAlphaFeed {
    tokens: RhAlphaToken[];
    generatedAt: string;
    scanned: number;
    totalSignals: number;
    ethUsd?: number;
}

/** Share of the deep-scan budget reserved for tokens still on the curve. */
const BONDING_LANE_SHARE = 0.6;

/**
 * Cheap pre-ranking so only the most promising tokens cost a trades request.
 * The list endpoint carries no volume, so curve progress — which only moves when
 * someone actually buys — is the strongest available proxy for activity.
 *
 * Bonding and graduated tokens are ranked in separate lanes: every migrated
 * token reports `bondingProgressPct: 100`, so a single blended score would let
 * graduations crowd the curve out of the board entirely. Each lane backfills the
 * other when it runs short.
 */
export function rankRhCandidates(items: RhTokenListItem[], limit: number): RhTokenListItem[] {
    const now = Date.now();
    const seen = new Set<string>();
    const unique = items.filter((item) => {
        const key = item.address.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const bondingScore = (item: RhTokenListItem) => {
        const progress = item.bondingProgressPct ?? 0;
        const ageHours = (now - item.createdAtTimestamp * 1000) / 3_600_000;
        const recency = Math.max(0, 24 - ageHours) * 0.6; // ≤ 14, fades over a day
        return progress * 2 + recency;
    };

    const migratedScore = (item: RhTokenListItem) =>
        item.migratedAtTimestamp ? item.migratedAtTimestamp : item.createdAtTimestamp;

    const bonding = unique.filter((i) => !i.migrated).sort((a, b) => bondingScore(b) - bondingScore(a));
    const migrated = unique.filter((i) => i.migrated).sort((a, b) => migratedScore(b) - migratedScore(a));

    const bondingSlots = Math.max(1, Math.round(limit * BONDING_LANE_SHARE));
    const migratedSlots = Math.max(0, limit - bondingSlots);

    const picked = [
        ...bonding.slice(0, bondingSlots),
        ...migrated.slice(0, migratedSlots),
    ];

    // Backfill whichever lane came up short so the budget is always spent.
    if (picked.length < limit) {
        const used = new Set(picked.map((i) => i.address.toLowerCase()));
        for (const item of [...bonding, ...migrated]) {
            if (picked.length >= limit) break;
            if (used.has(item.address.toLowerCase())) continue;
            used.add(item.address.toLowerCase());
            picked.push(item);
        }
    }

    return picked;
}

interface WindowStats {
    trades: number;
    buys: number;
    sells: number;
    uniqueTraders: number;
    volumeEth: number;
    buyEth: number;
    sellEth: number;
    largestTradeEth: number;
    firstPrice?: number;
    lastPrice?: number;
}

function tradePrice(trade?: RhTrade): number | undefined {
    if (!trade) return undefined;
    const n = Number(trade.priceEthPerToken);
    return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** `trades` must be newest-first, as the API returns them. */
function summarize(trades: RhTrade[], sinceMs: number): WindowStats {
    const inWindow = trades.filter((t) => t.timestamp * 1000 >= sinceMs);
    const traders = new Set<string>();

    let buys = 0;
    let sells = 0;
    let buyEth = 0;
    let sellEth = 0;
    let largest = 0;

    for (const trade of inWindow) {
        const eth = parseWeiToEth(trade.ethWei) ?? 0;
        traders.add(trade.account.toLowerCase());
        if (trade.kind === "buy") {
            buys += 1;
            buyEth += eth;
        } else {
            sells += 1;
            sellEth += eth;
        }
        if (eth > largest) largest = eth;
    }

    return {
        trades: inWindow.length,
        buys,
        sells,
        uniqueTraders: traders.size,
        volumeEth: buyEth + sellEth,
        buyEth,
        sellEth,
        largestTradeEth: largest,
        firstPrice: tradePrice(inWindow[inWindow.length - 1]),
        lastPrice: tradePrice(inWindow[0]),
    };
}

function pctLabel(value: number): string {
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function rhEthLabel(value: number | undefined): string {
    if (value == null || !Number.isFinite(value)) return "—";
    if (value >= 1) return `${value.toFixed(2)} ETH`;
    if (value >= 0.0001) return `${value.toFixed(4)} ETH`;
    if (value === 0) return "0 ETH";
    return `${value.toExponential(1)} ETH`;
}

const SEVERITY_WEIGHT: Record<RhAlphaSeverity, number> = {
    low: 6,
    medium: 12,
    high: 20,
    critical: 30,
};

/** Build the signal set and 0–100 score for one token from its recent flow. */
export function buildRhAlphaToken(
    item: RhTokenListItem,
    trades: RhTrade[],
    ethUsd: number | undefined,
    now = Date.now(),
    tradesLimit = 100
): RhAlphaToken {
    const week = summarize(trades, now - WINDOW_MS);
    const day = summarize(trades, now - DAY_MS);

    const priceEth = parseRhFixed18(item.priceEthPerToken);
    const priceUsd = priceEth != null && ethUsd != null ? priceEth * ethUsd : undefined;
    const ageHours = (now - item.createdAtTimestamp * 1000) / 3_600_000;
    const migratedHoursAgo = item.migratedAtTimestamp
        ? (now - item.migratedAtTimestamp * 1000) / 3_600_000
        : undefined;

    const buyPressurePct = week.trades > 0 ? (week.buys / week.trades) * 100 : undefined;
    const priceChangePct =
        week.firstPrice != null && week.lastPrice != null && week.firstPrice > 0
            ? ((week.lastPrice - week.firstPrice) / week.firstPrice) * 100
            : undefined;

    const signals: RhAlphaSignal[] = [];

    if (item.migrated && migratedHoursAgo != null && migratedHoursAgo <= 168) {
        signals.push({
            type: "graduated",
            severity: migratedHoursAgo <= 48 ? "critical" : "high",
            title: "Recently graduated",
            description: "Curve completed — trading now routes through the Uniswap V4 pool.",
            value: migratedHoursAgo < 24
                ? `${Math.max(1, Math.round(migratedHoursAgo))}h ago`
                : `${Math.round(migratedHoursAgo / 24)}d ago`,
        });
    }

    if (!item.migrated && (item.bondingProgressPct ?? 0) >= 10) {
        const progress = item.bondingProgressPct ?? 0;
        signals.push({
            type: "curve_momentum",
            severity: progress >= 50 ? "critical" : progress >= 25 ? "high" : "medium",
            title: "Curve filling",
            description: "Bonding curve is meaningfully ahead of the pack on this chain.",
            value: `${Math.round(progress)}%`,
        });
    }

    if (week.volumeEth >= 0.25) {
        signals.push({
            type: "volume_spike",
            severity: week.volumeEth >= 2 ? "critical" : week.volumeEth >= 0.75 ? "high" : "medium",
            title: "Heavy 7d volume",
            description: "Well above the typical Robinhood Chain launch.",
            value: rhEthLabel(week.volumeEth),
        });
    }

    if (day.trades >= 3) {
        signals.push({
            type: "live_flow",
            severity: day.trades >= 15 ? "high" : "medium",
            title: "Live right now",
            description: "Still trading inside the last 24 hours.",
            value: `${day.trades} trades / 24h`,
        });
    }

    if (buyPressurePct != null && week.trades >= 8 && buyPressurePct >= 65) {
        signals.push({
            type: "buy_pressure",
            severity: buyPressurePct >= 80 ? "high" : "medium",
            title: "Buy-side pressure",
            description: "Buys dominate the recent tape.",
            value: `${Math.round(buyPressurePct)}% buys`,
        });
    }

    if (buyPressurePct != null && week.trades >= 8 && buyPressurePct <= 35) {
        signals.push({
            type: "sell_pressure",
            severity: buyPressurePct <= 20 ? "high" : "medium",
            title: "Sell-side pressure",
            description: "Sells dominate the recent tape — exit risk.",
            value: `${Math.round(100 - buyPressurePct)}% sells`,
            risk: true,
        });
    }

    if (priceChangePct != null && priceChangePct >= 25) {
        signals.push({
            type: "price_surge",
            severity: priceChangePct >= 100 ? "critical" : "high",
            title: "Price surging",
            description: "Spot price is well above where the window opened.",
            value: pctLabel(priceChangePct),
        });
    }

    if (priceChangePct != null && priceChangePct <= -25) {
        signals.push({
            type: "price_dump",
            severity: priceChangePct <= -60 ? "high" : "medium",
            title: "Price dumping",
            description: "Spot price has fallen sharply inside the window.",
            value: pctLabel(priceChangePct),
            risk: true,
        });
    }

    if (week.largestTradeEth >= 0.15) {
        signals.push({
            type: "whale_trade",
            severity: week.largestTradeEth >= 1 ? "high" : "medium",
            title: "Whale-sized trade",
            description: "A single trade moved a large amount of ETH.",
            value: rhEthLabel(week.largestTradeEth),
        });
    }

    if (week.uniqueTraders >= 8) {
        signals.push({
            type: "crowd_activity",
            severity: week.uniqueTraders >= 25 ? "high" : "medium",
            title: "Crowd forming",
            description: "Many distinct wallets traded this token in the window.",
            value: `${week.uniqueTraders} wallets`,
        });
    }

    if (ageHours <= 6) {
        signals.push({
            type: "new_launch",
            severity: ageHours <= 1 ? "medium" : "low",
            title: "Fresh launch",
            description: "Launched within the last few hours.",
            value: ageHours < 1 ? `${Math.max(1, Math.round(ageHours * 60))}m` : `${Math.round(ageHours)}h`,
        });
    }

    const alphaScore = Math.min(
        100,
        signals.reduce((sum, s) => sum + SEVERITY_WEIGHT[s.severity], 0)
    );

    return {
        address: item.address,
        name: item.name,
        symbol: item.symbol,
        image: item.metadata?.image ?? undefined,
        creator: item.creator,
        isMigrated: item.migrated,
        bondingProgressPct: item.bondingProgressPct,
        createdAt: new Date(item.createdAtTimestamp * 1000).toISOString(),
        migratedAt: item.migratedAtTimestamp
            ? new Date(item.migratedAtTimestamp * 1000).toISOString()
            : undefined,
        priceEth,
        priceUsd,
        fdvUsd: priceUsd != null ? priceUsd * RH_TOTAL_SUPPLY : undefined,

        trades7d: week.trades,
        buys7d: week.buys,
        sells7d: week.sells,
        uniqueTraders7d: week.uniqueTraders,
        volumeEth7d: week.volumeEth,
        volumeUsd7d: ethUsd != null ? week.volumeEth * ethUsd : undefined,
        netFlowEth7d: week.buyEth - week.sellEth,
        buyPressurePct,
        priceChangePct7d: priceChangePct,
        largestTradeEth: week.largestTradeEth || undefined,

        trades24h: day.trades,
        volumeEth24h: day.volumeEth,

        lastTradeAt: trades[0] ? new Date(trades[0].timestamp * 1000).toISOString() : undefined,
        tradesTruncated: trades.length >= tradesLimit && week.trades >= tradesLimit,

        alphaScore,
        signals,
    };
}

/** Run `worker` over `items` with bounded concurrency so the upstream API is not flooded. */
export async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<R>
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let cursor = 0;

    async function run() {
        while (cursor < items.length) {
            const index = cursor++;
            results[index] = await worker(items[index]);
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return results;
}
