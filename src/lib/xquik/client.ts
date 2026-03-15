/* ──────────────────────────────────────────────
   Xquik API Client – X/Twitter data
   https://docs.xquik.com/api-reference/overview
   ────────────────────────────────────────────── */

import type {
    XquikTweet,
    XquikSearchResponse,
    XquikUser,
    XquikRadarItem,
    XquikRadarResponse,
} from "./types";

const BASE_URL = "https://xquik.com/api/v1";
const RATE_LIMIT_COOLDOWN_MS = 5 * 60_000;

let rateLimitUntil = 0;
let lastRateLimitLogAt = 0;

function getApiKey(): string | null {
    const key = process.env.XQUIK_API_KEY;
    if (!key || key.trim().length === 0) return null;
    return key.trim();
}

function headers(): HeadersInit {
    const h: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
    };
    const key = getApiKey();
    if (key) h["x-api-key"] = key;
    return h;
}

export function isXquikConfigured(): boolean {
    return !!getApiKey();
}

async function xquikGet<T>(path: string, silent402 = false): Promise<T | null> {
    if (!getApiKey()) return null;
    if (rateLimitUntil > Date.now()) return null;

    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            headers: headers(),
            cache: "no-store",
        });
        if (!res.ok) {
            if (res.status === 429) {
                const retryAfterHeader = res.headers.get("retry-after");
                const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
                rateLimitUntil =
                    Date.now() + (Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : RATE_LIMIT_COOLDOWN_MS);

                if (Date.now() - lastRateLimitLogAt > 30_000) {
                    lastRateLimitLogAt = Date.now();
                    console.warn(`[xquik] Rate limited for ${path.split("?")[0]}; pausing requests temporarily`);
                }
                return null;
            }

            if (res.status === 402 && silent402) return null;
            const text = await res.text().catch(() => "");
            if (res.status === 402) {
                console.warn(`[xquik] Subscription required for ${path.split("?")[0]}`);
            } else {
                console.error(`[xquik] ${res.status}: ${text}`);
            }
            return null;
        }
        rateLimitUntil = 0;
        return res.json();
    } catch (e) {
        console.error("[xquik] fetch error:", e);
        return null;
    }
}

// ── Search Tweets ────────────────────────────

export async function searchTweets(
    query: string,
    limit: number = 50
): Promise<XquikTweet[]> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const data = await xquikGet<XquikSearchResponse>(
        `/x/tweets/search?${params}`,
        true
    );
    return data?.tweets ?? [];
}

// ── Get User Profile ─────────────────────────

export async function getXUser(username: string): Promise<XquikUser | null> {
    return xquikGet<XquikUser>(`/x/users/${encodeURIComponent(username)}`, true);
}

// ── Batch user lookups with caching ──────────

const userCache = new Map<string, { user: XquikUser; ts: number }>();
const USER_CACHE_TTL = 5 * 60_000;

export async function getXUserCached(
    username: string
): Promise<XquikUser | null> {
    const key = username.toLowerCase();
    const cached = userCache.get(key);
    if (cached && Date.now() - cached.ts < USER_CACHE_TTL) {
        return cached.user;
    }
    const user = await getXUser(username);
    if (user) {
        userCache.set(key, { user, ts: Date.now() });
    }
    return user;
}

// ── Radar (Free – Trending topics) ──────────

export async function getRadarItems(opts?: {
    source?: string;
    category?: string;
    hours?: number;
    limit?: number;
    region?: string;
}): Promise<XquikRadarItem[]> {
    const params = new URLSearchParams();
    if (opts?.source) params.set("source", opts.source);
    if (opts?.category) params.set("category", opts.category);
    if (opts?.hours) params.set("hours", String(opts.hours));
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.region) params.set("region", opts.region);

    const data = await xquikGet<XquikRadarResponse>(
        `/radar?${params}`
    );
    return data?.items ?? [];
}

// ── Search tweets about a specific token ─────

export async function searchTokenTweets(
    tokenSymbol: string,
    tokenName?: string,
    limit: number = 30
): Promise<XquikTweet[]> {
    const queries = [`$${tokenSymbol}`];
    if (tokenName && tokenName.length > 2) {
        queries.push(tokenName);
    }
    const q = queries.join(" OR ");
    return searchTweets(q, limit);
}

// ── Search creator tweets ────────────────────

export async function searchCreatorTweets(
    username: string,
    limit: number = 20
): Promise<XquikTweet[]> {
    return searchTweets(`from:${username}`, limit);
}
