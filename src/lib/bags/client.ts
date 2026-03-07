/* ──────────────────────────────────────────────
   Bags API v2 – Client wrapper
   All network calls go through this module.
   Aligned with https://docs.bags.fm/
   ────────────────────────────────────────────── */

import type {
    BagsApiResponse,
    BagsPoolsResponse,
    BagsPool,
    BagsPoolInfo,
    BagsCreatorV3,
    BagsCreatorResponse,
    BagsLifetimeFeesResponse,
    BagsClaimStatsResponse,
    BagsClaimStatEntry,
    BagsClaimEventsResponse,
    BagsClaimablePosition,
    BagsQuoteRequest,
    BagsQuoteResponse,
    BagsSwapRequest,
    BagsSwapResponse,
    BagsCreateTokenInfoRequest,
    BagsCreateTokenInfoResponse,
    BagsFeeShareConfigRequest,
    BagsFeeShareConfigResponse,
    BagsLaunchRequest,
    BagsLaunchResponse,
    BagsPartnerStatsResponse,
    BagsPartnerClaimResponse,
    HeliusAsset,
} from "./types";

// ── helpers ──────────────────────────────────

const BASE = () => {
    const url = process.env.BAGS_API_BASE_URL || "https://public-api-v2.bags.fm/api/v1";
    return url.endsWith("/") ? url.slice(0, -1) : url;
};

function headers(): HeadersInit {
    const h: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
    };
    const key = process.env.BAGS_API_KEY;
    if (key) h["x-api-key"] = key;
    return h;
}

async function unwrap<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Bags API ${res.status}: ${text}`);
    }
    const json: BagsApiResponse<T> = await res.json();
    if (!json.success) {
        throw new Error(
            `Bags API error: ${typeof json.error === "string" ? json.error : JSON.stringify(json.error) ?? "unknown"}`
        );
    }
    return json.response as T;
}

async function bagsGet<T>(
    path: string,
    opts?: { revalidate?: number; tags?: string[]; cache?: RequestCache }
): Promise<T> {
    const url = `${BASE()}${path}`;
    const init: RequestInit = {
        method: "GET",
        headers: headers(),
    };

    if (opts?.cache) {
        init.cache = opts.cache;
    } else {
        init.next = {
            revalidate: opts?.revalidate ?? 60,
            tags: opts?.tags,
        };
    }

    const res = await fetch(url, init);
    return unwrap<T>(res);
}

async function bagsPost<T>(path: string, body: unknown): Promise<T> {
    const url = `${BASE()}${path}`;
    const res = await fetch(url, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
        cache: "no-store",
    });
    return unwrap<T>(res);
}

// ================================================================
// A) State – Pool discovery
// ================================================================

export async function getBagsPools(): Promise<BagsPool[]> {
    const data = await bagsGet<BagsPool[] | BagsPoolsResponse>("/solana/bags/pools", {
        cache: "no-store"
    });
    if (Array.isArray(data)) return data;
    return data.pools ?? data.tokens ?? data.data ?? [];
}

export async function getBagsPoolInfo(tokenMint: string): Promise<BagsPoolInfo | null> {
    try {
        return await bagsGet<BagsPoolInfo>(
            `/solana/bags/pools/token-mint?tokenMint=${tokenMint}`,
            { revalidate: 60 }
        );
    } catch {
        return null;
    }
}

/** @deprecated Use getBagsPoolInfo for v2 pool structure */
export async function getBagsPool(tokenMint: string): Promise<BagsPool | null> {
    try {
        const data = await bagsGet<BagsPool>(
            `/solana/bags/pools/token-mint?tokenMint=${tokenMint}`,
            { revalidate: 15 }
        );
        return data ?? null;
    } catch {
        return null;
    }
}

// ================================================================
// B) Analytics
// ================================================================

export async function getCreatorsV3(tokenMint: string): Promise<BagsCreatorV3[]> {
    try {
        const data = await bagsGet<BagsCreatorV3[]>(
            `/token-launch/creator/v3?tokenMint=${tokenMint}`,
            { revalidate: 60 }
        );
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

/** @deprecated Use getCreatorsV3 for array response */
export async function getCreatorInfo(
    tokenMint: string
): Promise<BagsCreatorResponse | null> {
    try {
        return await bagsGet<BagsCreatorResponse>(
            `/token-launch/creator/v3?tokenMint=${tokenMint}`,
            { revalidate: 60 }
        );
    } catch {
        return null;
    }
}

export async function getLifetimeFees(
    tokenMint: string
): Promise<string | null> {
    try {
        const data = await bagsGet<string>(
            `/token-launch/lifetime-fees?tokenMint=${tokenMint}`,
            { revalidate: 60 }
        );
        return data;
    } catch {
        return null;
    }
}

export async function getClaimStatsDetailed(
    tokenMint: string
): Promise<BagsClaimStatEntry[]> {
    try {
        const data = await bagsGet<BagsClaimStatEntry[]>(
            `/token-launch/claim-stats?tokenMint=${tokenMint}`,
            { revalidate: 60 }
        );
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

export async function getClaimStats(
    tokenMint: string
): Promise<BagsClaimStatsResponse | null> {
    try {
        return await bagsGet<BagsClaimStatsResponse>(
            `/token-launch/claim-stats?tokenMint=${tokenMint}`,
            { revalidate: 60 }
        );
    } catch {
        return null;
    }
}

export async function getClaimEvents(
    tokenMint: string,
    opts?: { mode?: "offset" | "time"; limit?: number; offset?: number; from?: number; to?: number }
): Promise<BagsClaimEventsResponse | null> {
    try {
        const params = new URLSearchParams({ tokenMint });
        if (opts?.mode) params.set("mode", opts.mode);
        if (opts?.limit) params.set("limit", String(opts.limit));
        if (opts?.offset !== undefined) params.set("offset", String(opts.offset));
        if (opts?.from !== undefined) params.set("from", String(opts.from));
        if (opts?.to !== undefined) params.set("to", String(opts.to));
        return await bagsGet<BagsClaimEventsResponse>(
            `/fee-share/token/claim-events?${params}`,
            { revalidate: 30 }
        );
    } catch {
        return null;
    }
}

export async function getClaimablePositions(
    wallet: string
): Promise<BagsClaimablePosition[]> {
    try {
        const data = await bagsGet<BagsClaimablePosition[]>(
            `/token-launch/claimable-positions?wallet=${wallet}`,
            { revalidate: 30 }
        );
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

// ================================================================
// C) Trade
// ================================================================

export async function getQuote(
    req: BagsQuoteRequest
): Promise<BagsQuoteResponse> {
    const params = new URLSearchParams({
        tokenMint: req.tokenMint,
        amount: String(req.amount),
    });
    if (req.inputMint) params.set("inputMint", req.inputMint);
    if (req.slippageBps !== undefined)
        params.set("slippageBps", String(req.slippageBps));
    return bagsGet<BagsQuoteResponse>(`/trade/quote?${params}`, {
        revalidate: 0,
    });
}

export async function createSwapTransaction(
    req: BagsSwapRequest
): Promise<BagsSwapResponse> {
    return bagsPost<BagsSwapResponse>("/trade/swap", req);
}

// ================================================================
// D) Launch
// ================================================================

export async function createTokenInfo(
    req: BagsCreateTokenInfoRequest
): Promise<BagsCreateTokenInfoResponse> {
    const url = `${BASE()}/token-launch/create-token-info`;
    const form = new FormData();
    form.append("name", req.name);
    form.append("symbol", req.symbol);
    form.append("description", req.description);
    if (req.image) form.append("image", req.image);
    if (req.imageUrl) form.append("imageUrl", req.imageUrl);
    if (req.metadataUrl) form.append("metadataUrl", req.metadataUrl);
    if (req.website) form.append("website", req.website);
    if (req.twitter) form.append("twitter", req.twitter);
    if (req.telegram) form.append("telegram", req.telegram);

    const h: Record<string, string> = { Accept: "application/json" };
    const key = process.env.BAGS_API_KEY;
    if (key) h["x-api-key"] = key;

    const res = await fetch(url, { method: "POST", headers: h, body: form, cache: "no-store" });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Bags API ${res.status}: ${text}`);
    }
    const json = await res.json();
    if (!json.success) {
        throw new Error(`Bags API error: ${json.error ?? "unknown"}`);
    }
    return json.response as BagsCreateTokenInfoResponse;
}

export async function createFeeShareConfig(
    req: BagsFeeShareConfigRequest
): Promise<BagsFeeShareConfigResponse> {
    return bagsPost<BagsFeeShareConfigResponse>(
        "/fee-share/config",
        req
    );
}

export async function createLaunchTransaction(
    req: BagsLaunchRequest
): Promise<BagsLaunchResponse> {
    return bagsPost<BagsLaunchResponse>(
        "/token-launch/create-launch-transaction",
        req
    );
}

// ================================================================
// E) Partner monetization
// ================================================================

export async function getPartnerStats(
    partnerWallet: string,
    partnerConfig: string
): Promise<BagsPartnerStatsResponse | null> {
    try {
        const params = new URLSearchParams({ partnerWallet, partnerConfig });
        return await bagsGet<BagsPartnerStatsResponse>(
            `/partner/stats?${params}`,
            { revalidate: 30 }
        );
    } catch {
        return null;
    }
}

export async function createPartnerClaimTx(
    partnerWallet: string,
    partnerConfig: string
): Promise<BagsPartnerClaimResponse> {
    return bagsPost<BagsPartnerClaimResponse>("/partner/claim", {
        partnerWallet,
        partnerConfig,
    });
}

// ================================================================
// F) Hackathon / App Store
// ================================================================

export interface HackathonApp {
    _id: string;
    uuid: string;
    name: string;
    description: string;
    category: string;
    icon: string;
    tokenAddress: string;
    twitterUrl?: string;
}

export interface HackathonListResponse {
    applications: HackathonApp[];
    currentPage: number;
    totalItems: number;
    totalPages: number;
}

const HACKATHON_BASE = "https://api.bags.fm/api/v1";

export async function getHackathonApps(page: number = 1): Promise<HackathonListResponse> {
    try {
        const res = await fetch(`${HACKATHON_BASE}/hackathon/list?page=${page}`, {
            cache: "no-store",
            headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`Hackathon API ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error("Hackathon API error");
        return json.response as HackathonListResponse;
    } catch (e) {
        console.error("[hackathon] list error:", e);
        return { applications: [], currentPage: page, totalItems: 0, totalPages: 0 };
    }
}

// ================================================================
// G) DexScreener enrichment
// ================================================================

export async function getDexScreenerPairs(mints: string[]): Promise<any[]> {
    if (mints.length === 0) return [];
    try {
        const url = `https://api.dexscreener.com/latest/dex/tokens/${mints.join(",")}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return [];
        const json = await res.json();
        return json.pairs || [];
    } catch (e) {
        console.error("[dexscreener] error:", e);
        return [];
    }
}

/** @deprecated Use getDexScreenerPairs */
export const getDexScreenerMetadata = getDexScreenerPairs;

export async function getDexScreenerSearch(query: string): Promise<any[]> {
    try {
        const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return [];
        const json = await res.json();
        return (json.pairs || []).filter((p: any) => p.chainId === "solana");
    } catch (e) {
        console.error("[dexscreener] search error:", e);
        return [];
    }
}

// ================================================================
// G) Helius DAS API – token metadata & holders
// ================================================================

function heliusRpcUrl(): string {
    const key = process.env.HELIUS_API_KEY;
    if (key) return `https://mainnet.helius-rpc.com/?api-key=${key}`;
    return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
}

export async function getHeliusAsset(mint: string): Promise<HeliusAsset | null> {
    try {
        const res = await fetch(heliusRpcUrl(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: "bagscan",
                method: "getAsset",
                params: { id: mint },
            }),
            cache: "no-store",
        });
        const json = await res.json();
        return json.result ?? null;
    } catch {
        return null;
    }
}

export async function getHeliusAssetBatch(
    mints: string[]
): Promise<Map<string, HeliusAsset>> {
    const result = new Map<string, HeliusAsset>();
    if (mints.length === 0) return result;

    const BATCH_SIZE = 1000;
    for (let i = 0; i < mints.length; i += BATCH_SIZE) {
        const batch = mints.slice(i, i + BATCH_SIZE);
        try {
            const res = await fetch(heliusRpcUrl(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: "bagscan-batch",
                    method: "getAssetBatch",
                    params: { ids: batch },
                }),
                cache: "no-store",
            });
            const json = await res.json();
            const assets: HeliusAsset[] = json.result ?? [];
            for (const asset of assets) {
                if (asset.id) {
                    result.set(asset.id, asset);
                }
            }
        } catch (e) {
            console.error("[helius] getAssetBatch error:", e);
        }
    }

    return result;
}

export async function getHeliusHolderCount(mint: string): Promise<number | null> {
    try {
        const res = await fetch(heliusRpcUrl(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: "bagscan-holders",
                method: "getTokenAccounts",
                params: { mint, limit: 1, page: 1 },
            }),
            cache: "no-store",
        });
        const json = await res.json();
        return json.result?.total ?? null;
    } catch {
        return null;
    }
}

// ================================================================
// H) SOL price helper
// ================================================================

let cachedSolPrice: { price: number; ts: number } | null = null;

export async function getSolPriceUsd(): Promise<number> {
    if (cachedSolPrice && Date.now() - cachedSolPrice.ts < 60_000) {
        return cachedSolPrice.price;
    }
    try {
        const res = await fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
            { cache: "no-store" }
        );
        const json = await res.json();
        const price = json.solana?.usd ?? 150;
        cachedSolPrice = { price, ts: Date.now() };
        return price;
    } catch {
        return cachedSolPrice?.price ?? 150;
    }
}
