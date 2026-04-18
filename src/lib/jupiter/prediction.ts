import "server-only";

import { fetchWithRateLimitRetry } from "@/lib/http/fetch-rate-limit-retry";
import type {
    JupiterPredictionCreateOrderResponse,
    JupiterPredictionEvent,
    JupiterPredictionMarket,
    JupiterPredictionOrderStatusResponse,
    JupiterPredictionPosition,
    JupiterPredictionTradingStatus,
} from "./types";

const DEFAULT_JUP_PREDICTION_API_BASE_URL = "https://api.jup.ag/prediction/v1";
export const JUP_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const PREDICTION_STATUS_TTL_MS = 20_000;
const PREDICTION_EVENTS_TTL_MS = 30_000;
const PREDICTION_EVENT_TTL_MS = 25_000;

type JsonRecord = Record<string, unknown>;
type CacheEntry<T> = {
    expiresAt: number;
    value: T;
};

const tradingStatusCache: { entry: CacheEntry<JupiterPredictionTradingStatus> | null } = {
    entry: null,
};
const predictionEventsCache = new Map<number, CacheEntry<JupiterPredictionEvent[]>>();
const predictionEventCache = new Map<string, CacheEntry<JupiterPredictionEvent>>();

function getCachedValue<T>(entry: CacheEntry<T> | null | undefined) {
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) return null;
    return entry.value;
}

function setCacheEntry<T>(ttlMs: number, value: T): CacheEntry<T> {
    return {
        expiresAt: Date.now() + ttlMs,
        value,
    };
}

function getJupPredictionApiBaseUrl() {
    return (
        process.env.JUP_PREDICTION_API_BASE_URL?.trim() ||
        DEFAULT_JUP_PREDICTION_API_BASE_URL
    ).replace(/\/+$/, "");
}

function getJupPredictionHeaders() {
    const apiKey = process.env.JUP_API_KEY?.trim();
    return {
        Accept: "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
    };
}

function getJupPredictionJsonHeaders() {
    return {
        ...getJupPredictionHeaders(),
        "Content-Type": "application/json",
    };
}

function toNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

function toMicroUsd(value: unknown): number | null {
    const raw = toNumber(value);
    if (raw === null) return null;
    return raw / 1_000_000;
}

function normalizePredictionUsd(value: unknown): number | null {
    const raw = toNumber(value);
    if (raw === null) return null;
    return raw >= 1_000_000_000 ? raw / 1_000_000 : raw;
}

function normalizePredictionPriceUsd(value: unknown): number | null {
    const raw = toNumber(value);
    if (raw === null) return null;
    return raw > 1 ? raw / 1_000_000 : raw;
}

function normalizePredictionPriceProbability(value: number | null) {
    if (value === null) return null;
    return value >= 0 && value <= 1 ? value * 100 : value;
}

function decodeDisplayText(value: string | undefined) {
    if (!value) return value;

    let current = value;
    for (let index = 0; index < 2; index += 1) {
        if (!/[ÃÂâ€™œž]/.test(current)) {
            break;
        }

        try {
            current = Buffer.from(current, "latin1").toString("utf8");
        } catch {
            break;
        }
    }

    return current
        .replace(/â|â€™|â??/g, "'")
        .replace(/â|â€œ/g, "\"")
        .replace(/â|â€�/g, "\"")
        .replace(/â|â€“/g, "-")
        .replace(/â|â€”/g, "—");
}

function toString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : undefined;
}

function toBoolean(value: unknown): boolean | undefined {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        if (value === "true") return true;
        if (value === "false") return false;
    }
    return undefined;
}

function toRecord(value: unknown): JsonRecord | null {
    return value && typeof value === "object" ? (value as JsonRecord) : null;
}

function toArray(value: unknown): JsonRecord[] {
    return Array.isArray(value)
        ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object")
        : [];
}

function formatUnixSeconds(value: unknown): string | null {
    const num = toNumber(value);
    if (num === null || num <= 0) return null;
    return new Date(num * 1000).toISOString();
}

function normalizeQuotedCharacterStream(value: string) {
    if (value.length < 6) return value;

    let quotedPairs = 0;
    let pairChecks = 0;

    for (let index = 0; index < Math.min(value.length - 1, 24); index += 2) {
        pairChecks += 1;
        if (value[index] === "'" && value[index + 1] !== "'") {
            quotedPairs += 1;
        }
    }

    return pairChecks >= 3 && quotedPairs / pairChecks >= 0.7
        ? value.replace(/'/g, "")
        : value;
}

function pickFirstString(...values: unknown[]) {
    for (const value of values) {
        const result = toString(value);
        if (result) {
            return normalizeQuotedCharacterStream(decodeDisplayText(result) ?? result);
        }
    }
    return undefined;
}

function normalizeProbability(value: unknown): number | null {
    const raw = toNumber(value);
    if (raw === null) return null;
    if (raw >= 0 && raw <= 1) return raw * 100;
    return raw;
}

function resolvePricingNumber(record: JsonRecord | null, ...keys: string[]) {
    if (!record) return null;
    for (const key of keys) {
        const direct =
            normalizePredictionUsd(record[key]) ??
            toMicroUsd(record[key]);
        if (direct !== null) return direct;
    }
    return null;
}

function resolveEventTitle(raw: JsonRecord) {
    const metadata =
        toRecord(raw.eventMetadata) ??
        toRecord(raw.metadata);

    return (
        pickFirstString(
            raw.title,
            raw.question,
            raw.subtitle,
            raw.name,
            metadata?.title,
            metadata?.question,
            metadata?.headline,
            metadata?.subtitle,
            metadata?.name
        ) ||
        "Untitled Event"
    );
}

function resolveMarketTitle(raw: JsonRecord) {
    const metadata =
        toRecord(raw.marketMetadata) ??
        toRecord(raw.metadata);

    return (
        pickFirstString(
            raw.title,
            raw.question,
            raw.subtitle,
            raw.outcomeName,
            raw.name,
            metadata?.title,
            metadata?.question,
            metadata?.headline,
            metadata?.subtitle,
            metadata?.name,
            raw.slug
        ) ||
        "Market"
    );
}

function mapPredictionMarket(raw: JsonRecord): JupiterPredictionMarket | null {
    const metadata =
        toRecord(raw.marketMetadata) ??
        toRecord(raw.metadata);
    const pricing = toRecord(raw.pricing);
    const marketId =
        toString(raw.marketId) ||
        toString(raw.id) ||
        toString(metadata?.marketId) ||
        toString(raw.slug);

    if (!marketId) return null;

    const yesPrice =
        normalizePredictionPriceUsd(pricing?.buyYesPriceUsd) ??
        normalizePredictionPriceUsd(pricing?.yesPriceUsd) ??
        normalizePredictionPriceUsd(pricing?.buyYesPrice) ??
        normalizePredictionPriceUsd(pricing?.yesPrice) ??
        normalizePredictionPriceUsd(raw.yesPriceUsd) ??
        normalizePredictionPriceUsd(raw.yesPrice) ??
        normalizePredictionPriceUsd(raw.buyYesPrice);

    const noPrice =
        normalizePredictionPriceUsd(pricing?.buyNoPriceUsd) ??
        normalizePredictionPriceUsd(pricing?.noPriceUsd) ??
        normalizePredictionPriceUsd(pricing?.buyNoPrice) ??
        normalizePredictionPriceUsd(pricing?.noPrice) ??
        normalizePredictionPriceUsd(raw.noPriceUsd) ??
        normalizePredictionPriceUsd(raw.noPrice) ??
        normalizePredictionPriceUsd(raw.buyNoPrice);

    const yesProbability =
        normalizeProbability(raw.yesProbability) ??
        normalizeProbability(raw.yesChance) ??
        normalizeProbability(pricing?.yesProbability) ??
        normalizeProbability(pricing?.buyYesProbability) ??
        normalizePredictionPriceProbability(yesPrice);
    const noProbability =
        normalizeProbability(raw.noProbability) ??
        normalizeProbability(raw.noChance) ??
        normalizeProbability(pricing?.noProbability) ??
        normalizeProbability(pricing?.buyNoProbability) ??
        normalizePredictionPriceProbability(noPrice);

    return {
        marketId,
        title: resolveMarketTitle(raw),
        imageUrl: pickFirstString(
            raw.imageUrl,
            metadata?.imageUrl,
            metadata?.icon,
            raw.icon
        ),
        status:
            pickFirstString(
                raw.status,
                raw.result,
                raw.lifecycleStatus,
                metadata?.status
            ),
        volumeUsd:
            normalizePredictionUsd(raw.volumeUsd) ??
            normalizePredictionUsd(raw.volume) ??
            resolvePricingNumber(pricing, "volumeUsd", "volume") ??
            normalizePredictionUsd(raw.volume24h),
        yesPrice,
        noPrice,
        yesProbability,
        noProbability,
        closeTime:
            pickFirstString(
                raw.closeTime,
                metadata?.closeTime,
                formatUnixSeconds(raw.closeTime),
                formatUnixSeconds(raw.closeAt),
                formatUnixSeconds(metadata?.closeAt)
            ) || null,
        resolveTime:
            pickFirstString(
                raw.resolveTime,
                metadata?.resolveTime,
                formatUnixSeconds(raw.resolveTime),
                formatUnixSeconds(raw.settlementDate),
                formatUnixSeconds(metadata?.resolveAt)
            ) || null,
    };
}

function mapPredictionEvent(raw: JsonRecord): JupiterPredictionEvent | null {
    const eventId =
        toString(raw.eventId) ||
        toString(raw.id) ||
        toString(raw.slug);

    if (!eventId) return null;

    const eventMetadata =
        toRecord(raw.eventMetadata) ??
        toRecord(raw.metadata);
    const marketItems = [
        ...toArray(raw.markets),
        ...toArray(raw.eventMarkets),
    ]
        .map(mapPredictionMarket)
        .filter((market): market is JupiterPredictionMarket => Boolean(market));

    return {
        eventId,
        title: resolveEventTitle(raw),
        description:
            pickFirstString(
                raw.description,
                raw.rulesPrimary,
                eventMetadata?.subtitle,
                eventMetadata?.description,
                eventMetadata?.rulesPrimary
            ),
        imageUrl:
            pickFirstString(
                raw.imageUrl,
                eventMetadata?.imageUrl,
                marketItems[0]?.imageUrl
            ),
        category:
            pickFirstString(
                raw.category,
                raw.series,
                eventMetadata?.category,
                eventMetadata?.series
            ),
        volumeUsd:
            normalizePredictionUsd(raw.volumeUsd) ??
            normalizePredictionUsd(raw.volume) ??
            marketItems.reduce((sum, market) => sum + (market.volumeUsd ?? 0), 0),
        closeTime:
            pickFirstString(
                raw.closeTime,
                eventMetadata?.closeTime,
                formatUnixSeconds(raw.closeTime),
                formatUnixSeconds(eventMetadata?.closeAt)
            ) || null,
        status:
            pickFirstString(
                raw.status,
                raw.lifecycleStatus,
                eventMetadata?.status
            ) ||
            (toBoolean(eventMetadata?.isLive) ? "live" : undefined),
        markets: marketItems,
    };
}

function mapPredictionPosition(raw: JsonRecord): JupiterPredictionPosition | null {
    const pubkey = toString(raw.pubkey) || toString(raw.positionPubkey);
    if (!pubkey) return null;

    const eventMetadata = toRecord(raw.eventMetadata);
    const marketMetadata = toRecord(raw.marketMetadata);
    const claimable = toBoolean(raw.claimable) ?? false;
    const claimed = toBoolean(raw.claimed) ?? false;

    return {
        positionPubkey: pubkey,
        eventId:
            toString(raw.eventId) ||
            toString(eventMetadata?.eventId),
        marketId: toString(raw.marketId) || toString(marketMetadata?.marketId),
        eventTitle: pickFirstString(eventMetadata?.title),
        marketTitle: pickFirstString(marketMetadata?.title),
        side: (toBoolean(raw.isYes) ?? false) ? "YES" : "NO",
        quantity: toNumber(raw.contracts),
        averagePrice: toMicroUsd(raw.avgPriceUsd),
        currentPrice: toMicroUsd(raw.markPriceUsd),
        unrealizedPnlUsd:
            toMicroUsd(raw.pnlUsd) ??
            toMicroUsd(raw.realizedPnlUsd),
        claimablePayoutUsd:
            claimable && !claimed ? toMicroUsd(raw.payoutUsd) : null,
        status:
            claimable && !claimed
                ? "claimable"
                : claimed
                    ? "claimed"
                    : toString(marketMetadata?.status) || "open",
    };
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
    const payload = (await response.json().catch(() => null)) as
        | (T & { error?: string; message?: string })
        | null;

    if (!response.ok) {
        const detail =
            payload?.error ||
            payload?.message ||
            `${fallbackMessage} (${response.status})`;
        throw new Error(detail);
    }

    if (!payload) {
        throw new Error(fallbackMessage);
    }

    return payload;
}

export async function getJupiterPredictionTradingStatus() {
    const cached = getCachedValue(tradingStatusCache.entry);
    if (cached) return cached;

    const response = await fetchWithRateLimitRetry(
        `${getJupPredictionApiBaseUrl()}/trading-status`,
        () => ({
            headers: getJupPredictionHeaders(),
            next: { revalidate: 20 },
        }),
        { maxAttempts: 5, baseDelayMs: 450 }
    );

    const payload = await parseJsonResponse<JsonRecord>(
        response,
        "Prediction trading status could not be loaded."
    );

    const value = {
        open: toBoolean(payload.trading_active) ?? false,
        reason: toString(payload.reason) ?? null,
    } satisfies JupiterPredictionTradingStatus;

    tradingStatusCache.entry = setCacheEntry(PREDICTION_STATUS_TTL_MS, value);
    return value;
}

export async function getJupiterPredictionEvents(limit = 48) {
    const normalizedLimit = Math.max(1, Math.min(limit, 72));
    const cached = getCachedValue(predictionEventsCache.get(normalizedLimit));
    if (cached) return cached;

    const deduped = new Map<string, JsonRecord>();

    let start = 0;
    let page = 0;

    while (deduped.size < normalizedLimit && page < 4) {
        const remaining = normalizedLimit - deduped.size;
        const pageSize = Math.max(2, Math.min(Math.max(remaining, 12), 96));
        const end = Math.max(start + 1, start + pageSize);
        const params = new URLSearchParams({
            includeMarkets: "true",
            sortBy: "volume",
            sortDirection: "desc",
            start: String(start),
            end: String(end),
        });

        const response = await fetchWithRateLimitRetry(
            `${getJupPredictionApiBaseUrl()}/events?${params.toString()}`,
            () => ({
                headers: getJupPredictionHeaders(),
                next: { revalidate: 20 },
            }),
            { maxAttempts: 5, baseDelayMs: 450 }
        );

        const payload = await parseJsonResponse<JsonRecord>(
            response,
            "Prediction events could not be loaded."
        );

        const rawEvents = toArray(payload.data ?? payload.events);
        if (rawEvents.length === 0) {
            break;
        }

        for (const rawEvent of rawEvents) {
            const key =
                toString(rawEvent.eventId) ||
                toString(rawEvent.id) ||
                toString(rawEvent.slug);
            if (key && !deduped.has(key)) {
                deduped.set(key, rawEvent);
            }
        }

        const pagination = toRecord(payload.pagination);
        const hasNext =
            toBoolean(pagination?.hasNext) ??
            toBoolean(pagination?.has_next) ??
            (rawEvents.length >= pageSize);

        start += rawEvents.length;
        page += 1;

        if (!hasNext) {
            break;
        }
    }

    const events = [...deduped.values()]
        .map(mapPredictionEvent)
        .filter((event): event is JupiterPredictionEvent => Boolean(event))
        .filter((event) => event.markets.length > 0)
        .map((event) => ({
            ...event,
            markets: [...event.markets].sort((a, b) => {
                const aWeight = (a.volumeUsd ?? 0) + (a.yesProbability ?? 0) + (a.noProbability ?? 0);
                const bWeight = (b.volumeUsd ?? 0) + (b.yesProbability ?? 0) + (b.noProbability ?? 0);
                return bWeight - aWeight;
            }),
        }))
        .filter((event) =>
            event.markets.some((market) => (market.status ?? "").toLowerCase() !== "closed")
        )
        .sort((a, b) => (b.volumeUsd ?? 0) - (a.volumeUsd ?? 0))
        .slice(0, limit);

    predictionEventsCache.set(
        normalizedLimit,
        setCacheEntry(PREDICTION_EVENTS_TTL_MS, events)
    );

    return events;
}

export async function getJupiterPredictionEvent(eventId: string) {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
        throw new Error("Prediction event id is required.");
    }

    const cached = getCachedValue(predictionEventCache.get(normalizedEventId));
    if (cached) return cached;

    const response = await fetchWithRateLimitRetry(
        `${getJupPredictionApiBaseUrl()}/events/${encodeURIComponent(normalizedEventId)}`,
        () => ({
            headers: getJupPredictionHeaders(),
            next: { revalidate: 20 },
        }),
        { maxAttempts: 5, baseDelayMs: 450 }
    );

    const payload = await parseJsonResponse<JsonRecord>(
        response,
        "Prediction event could not be loaded."
    );

    const mappedEvent = mapPredictionEvent(payload);
    if (!mappedEvent || mappedEvent.markets.length === 0) {
        throw new Error("Prediction event could not be mapped from Jupiter.");
    }

    const normalizedEvent = {
        ...mappedEvent,
        markets: [...mappedEvent.markets].sort((a, b) => {
            const aWeight = (a.volumeUsd ?? 0) + (a.yesProbability ?? 0) + (a.noProbability ?? 0);
            const bWeight = (b.volumeUsd ?? 0) + (b.yesProbability ?? 0) + (b.noProbability ?? 0);
            return bWeight - aWeight;
        }),
    } satisfies JupiterPredictionEvent;

    predictionEventCache.set(
        normalizedEventId,
        setCacheEntry(PREDICTION_EVENT_TTL_MS, normalizedEvent)
    );

    return normalizedEvent;
}

export async function getJupiterPredictionPositions(ownerPubkey: string) {
    const params = new URLSearchParams({ ownerPubkey, start: "0", end: "25" });
    const response = await fetchWithRateLimitRetry(
        `${getJupPredictionApiBaseUrl()}/positions?${params.toString()}`,
        () => ({
            headers: getJupPredictionHeaders(),
            cache: "no-store",
        }),
        { maxAttempts: 5, baseDelayMs: 450 }
    );

    const payload = await parseJsonResponse<JsonRecord>(
        response,
        "Prediction positions could not be loaded."
    );

    return toArray(payload.data)
        .map(mapPredictionPosition)
        .filter((position): position is JupiterPredictionPosition => Boolean(position));
}

export async function createJupiterPredictionOrder(params: {
    ownerPubkey: string;
    marketId: string;
    isYes: boolean;
    depositAmount: string;
    depositMint?: string;
}) {
    const orderBody = JSON.stringify({
        isBuy: true,
        ownerPubkey: params.ownerPubkey,
        marketId: params.marketId,
        isYes: params.isYes,
        depositAmount: params.depositAmount,
        depositMint: params.depositMint ?? JUP_USDC_MINT,
    });
    const response = await fetchWithRateLimitRetry(
        `${getJupPredictionApiBaseUrl()}/orders`,
        () => ({
            method: "POST",
            headers: getJupPredictionJsonHeaders(),
            cache: "no-store",
            body: orderBody,
        }),
        { maxAttempts: 5, baseDelayMs: 450 }
    );

    const payload = await parseJsonResponse<JupiterPredictionCreateOrderResponse>(
        response,
        "Prediction order could not be created."
    );

    const nestedOrder = toRecord(payload.order);

    return {
        ...payload,
        transaction: toString(payload.transaction) ?? undefined,
        requestId:
            toString(payload.requestId) ??
            toString(payload.externalOrderId) ??
            toString(nestedOrder?.externalOrderId) ??
            undefined,
        orderPubkey:
            toString(payload.orderPubkey) ??
            toString(nestedOrder?.orderPubkey) ??
            toString(nestedOrder?.pubkey) ??
            undefined,
        positionPubkey:
            toString(payload.positionPubkey) ??
            toString(nestedOrder?.positionPubkey) ??
            undefined,
    };
}

export async function getJupiterPredictionOrderStatus(orderPubkey: string) {
    const response = await fetchWithRateLimitRetry(
        `${getJupPredictionApiBaseUrl()}/orders/status/${orderPubkey}`,
        () => ({
            headers: getJupPredictionHeaders(),
            cache: "no-store",
        }),
        { maxAttempts: 5, baseDelayMs: 450 }
    );

    return parseJsonResponse<JupiterPredictionOrderStatusResponse>(
        response,
        "Prediction order status could not be loaded."
    );
}

export async function claimJupiterPredictionPosition(params: {
    positionPubkey: string;
    ownerPubkey: string;
}) {
    const claimBody = JSON.stringify({
        ownerPubkey: params.ownerPubkey,
    });
    const response = await fetchWithRateLimitRetry(
        `${getJupPredictionApiBaseUrl()}/positions/${params.positionPubkey}/claim`,
        () => ({
            method: "POST",
            headers: getJupPredictionJsonHeaders(),
            cache: "no-store",
            body: claimBody,
        }),
        { maxAttempts: 5, baseDelayMs: 450 }
    );

    return parseJsonResponse<JsonRecord>(
        response,
        "Prediction claim transaction could not be created."
    );
}

export async function closeJupiterPredictionPosition(params: {
    positionPubkey: string;
    ownerPubkey: string;
}) {
    const closeBody = JSON.stringify({
        ownerPubkey: params.ownerPubkey,
    });
    const response = await fetchWithRateLimitRetry(
        `${getJupPredictionApiBaseUrl()}/positions/${params.positionPubkey}`,
        () => ({
            method: "DELETE",
            headers: getJupPredictionJsonHeaders(),
            cache: "no-store",
            body: closeBody,
        }),
        { maxAttempts: 5, baseDelayMs: 450 }
    );

    return parseJsonResponse<JsonRecord>(
        response,
        "Prediction close transaction could not be created."
    );
}
