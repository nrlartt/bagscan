import "server-only";

import type { JupiterTokenDetail } from "./types";

const DEFAULT_JUP_API_BASE_URL = "https://api.jup.ag/tokens/v2";

type JupiterRawToken = Record<string, unknown>;

function getJupApiBaseUrl() {
    return process.env.JUP_API_BASE_URL?.trim() || DEFAULT_JUP_API_BASE_URL;
}

function getJupHeaders() {
    const apiKey = process.env.JUP_API_KEY?.trim();
    return {
        Accept: "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
    };
}

function toNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
}

function toStringArray(value: unknown) {
    if (!Array.isArray(value)) {
        return undefined;
    }

    return value.filter((item): item is string => typeof item === "string");
}

function toAudit(value: unknown) {
    if (!value || typeof value !== "object") {
        return null;
    }

    const audit = value as Record<string, unknown>;
    return {
        mintAuthorityDisabled:
            typeof audit.mintAuthorityDisabled === "boolean"
                ? audit.mintAuthorityDisabled
                : undefined,
        freezeAuthorityDisabled:
            typeof audit.freezeAuthorityDisabled === "boolean"
                ? audit.freezeAuthorityDisabled
                : undefined,
        topHoldersPercentage: toNumber(
            audit.topHoldersPercentage ?? audit.topHoldersShare
        ) ?? null,
    };
}

function mapJupiterToken(raw: JupiterRawToken, mint: string): JupiterTokenDetail {
    const stats24h =
        raw.stats24h && typeof raw.stats24h === "object"
            ? (raw.stats24h as Record<string, unknown>)
            : null;

    const extensions =
        raw.extensions && typeof raw.extensions === "object"
            ? (raw.extensions as Record<string, unknown>)
            : null;

    return {
        mint,
        name: typeof raw.name === "string" ? raw.name : undefined,
        symbol: typeof raw.symbol === "string" ? raw.symbol : undefined,
        icon:
            typeof raw.icon === "string"
                ? raw.icon
                : typeof raw.logoURI === "string"
                    ? raw.logoURI
                    : undefined,
        verified:
            typeof raw.verified === "boolean"
                ? raw.verified
                : typeof raw.isVerified === "boolean"
                    ? raw.isVerified
                    : undefined,
        strict:
            typeof raw.strict === "boolean"
                ? raw.strict
                : typeof raw.isStrict === "boolean"
                    ? raw.isStrict
                    : undefined,
        organicScore: toNumber(raw.organicScore) ?? null,
        holderCount: toNumber(raw.holderCount) ?? null,
        marketCap:
            toNumber(raw.marketCap ?? raw.mcap ?? stats24h?.marketCap) ?? null,
        liquidity: toNumber(raw.liquidity ?? stats24h?.liquidity) ?? null,
        volume24h:
            toNumber(raw.volume24h ?? raw.dailyVolume ?? stats24h?.volume) ?? null,
        buyVolume24h: toNumber(stats24h?.buyVolume) ?? null,
        sellVolume24h: toNumber(stats24h?.sellVolume) ?? null,
        priceChange24h:
            toNumber(raw.priceChange24h ?? stats24h?.priceChange) ?? null,
        circulatingSupply:
            toNumber(raw.circulatingSupply ?? raw.circSupply) ?? null,
        totalSupply: toNumber(raw.totalSupply) ?? null,
        website:
            typeof extensions?.website === "string"
                ? extensions.website
                : typeof raw.website === "string"
                    ? raw.website
                    : undefined,
        twitter:
            typeof extensions?.twitter === "string"
                ? extensions.twitter
                : typeof raw.twitter === "string"
                    ? raw.twitter
                    : undefined,
        telegram:
            typeof extensions?.telegram === "string"
                ? extensions.telegram
                : typeof raw.telegram === "string"
                    ? raw.telegram
                    : undefined,
        tags: toStringArray(raw.tags),
        createdAt:
            typeof raw.createdAt === "string"
                ? raw.createdAt
                : typeof raw.mintedAt === "string"
                    ? raw.mintedAt
                    : undefined,
        audit: toAudit(raw.audit),
        jupiterTokenPageUrl: `https://jup.ag/tokens/${mint}`,
    };
}

function extractItems(payload: unknown): JupiterRawToken[] {
    if (Array.isArray(payload)) {
        return payload.filter(
            (item): item is JupiterRawToken =>
                Boolean(item) && typeof item === "object"
        );
    }

    if (payload && typeof payload === "object") {
        const maybeData = (payload as Record<string, unknown>).data;
        if (Array.isArray(maybeData)) {
            return maybeData.filter(
                (item): item is JupiterRawToken =>
                    Boolean(item) && typeof item === "object"
            );
        }
    }

    return [];
}

function getTokenMint(raw: JupiterRawToken) {
    const candidates = [raw.id, raw.address, raw.mint];
    const match = candidates.find((value) => typeof value === "string");
    return typeof match === "string" ? match : undefined;
}

export async function getJupiterTokenDetail(
    mint: string
): Promise<JupiterTokenDetail | null> {
    const baseUrl = getJupApiBaseUrl().replace(/\/+$/, "");
    const searchUrl = `${baseUrl}/search?query=${encodeURIComponent(mint)}`;

    const response = await fetch(searchUrl, {
        headers: getJupHeaders(),
        next: { revalidate: 300 },
    });

    if (!response.ok) {
        throw new Error(`Jupiter token lookup failed with status ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const items = extractItems(payload);
    const exact =
        items.find((item) => getTokenMint(item)?.toLowerCase() === mint.toLowerCase()) ??
        items[0];

    if (!exact) {
        return null;
    }

    return mapJupiterToken(exact, mint);
}
