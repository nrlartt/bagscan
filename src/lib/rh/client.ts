import "server-only";
import type {
    RhBalancesResponse,
    RhPortfolioResponse,
    RhQuoteResponse,
    RhTokenDetailResponse,
    RhTokensQuery,
    RhTokensResponse,
    RhTradeSide,
    RhTradesResponse,
} from "./api-types";

/**
 * Upstream Robinhood Chain indexer, supplied entirely by configuration.
 */
const BASE = () => {
    const url = process.env.RH_INDEXER_BASE_URL;
    if (!url) {
        throw new Error("RH_INDEXER_BASE_URL is not configured");
    }
    return url.endsWith("/") ? url.slice(0, -1) : url;
};

function headers(): HeadersInit {
    const h: Record<string, string> = {
        Accept: "application/json",
    };
    const key = process.env.RH_INDEXER_API_KEY;
    if (key) h["x-api-key"] = key;
    return h;
}

async function unwrapRh<T>(res: Response): Promise<T> {
    const text = await res.text().catch(() => "");
    let json: { success?: boolean; response?: T; error?: string } | null = null;

    if (text) {
        try {
            json = JSON.parse(text) as { success?: boolean; response?: T; error?: string };
        } catch {
            json = null;
        }
    }

    if (!res.ok) {
        const detail =
            typeof json?.error === "string"
                ? json.error
                : typeof json?.response === "string"
                    ? (json.response as unknown as string)
                    : text;
        throw new Error(`RH indexer ${res.status}: ${detail || "unknown error"}`);
    }

    if (!json?.success) {
        throw new Error(`RH indexer error: ${json?.error ?? "unknown"}`);
    }

    return json.response as T;
}

export async function getRhTokens(query: RhTokensQuery = {}): Promise<RhTokensResponse> {
    const params = new URLSearchParams();
    params.set("limit", String(query.limit ?? 48));
    params.set("offset", String(query.offset ?? 0));
    if (query.migrated !== undefined) params.set("migrated", String(query.migrated));
    if (query.creator) params.set("creator", query.creator);
    if (query.orderBy) params.set("orderBy", query.orderBy);
    if (query.orderDirection) params.set("orderDirection", query.orderDirection);

    const res = await fetch(`${BASE()}/evm/rh/tokens?${params}`, {
        headers: headers(),
        next: { revalidate: 15 },
        signal: AbortSignal.timeout(20_000),
    });

    return unwrapRh<RhTokensResponse>(res);
}

export async function getRhToken(tokenAddress: string): Promise<RhTokenDetailResponse | null> {
    const params = new URLSearchParams({ tokenAddress: tokenAddress.trim() });
    const res = await fetch(`${BASE()}/evm/rh/token?${params}`, {
        headers: headers(),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
    });

    if (res.status === 404) return null;
    return unwrapRh<RhTokenDetailResponse>(res);
}

/** Token holdings plus creator fee positions for one Robinhood Chain wallet. */
export async function getRhPortfolio(owner: string): Promise<RhPortfolioResponse> {
    const params = new URLSearchParams({ owner: owner.trim() });
    const res = await fetch(`${BASE()}/evm/rh/portfolio?${params}`, {
        headers: headers(),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
    });

    return unwrapRh<RhPortfolioResponse>(res);
}

/** Native ETH / WETH balances for one Robinhood Chain wallet. */
export async function getRhBalances(owner: string): Promise<RhBalancesResponse> {
    const params = new URLSearchParams({ owner: owner.trim() });
    const res = await fetch(`${BASE()}/evm/rh/balances?${params}`, {
        headers: headers(),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
    });

    return unwrapRh<RhBalancesResponse>(res);
}

/** Recent trades for one token, newest first. */
export async function getRhTrades(
    tokenAddress: string,
    limit = 50
): Promise<RhTradesResponse> {
    const params = new URLSearchParams({
        tokenAddress: tokenAddress.trim(),
        limit: String(Math.min(200, Math.max(1, limit))),
    });
    const res = await fetch(`${BASE()}/evm/rh/trades?${params}`, {
        headers: headers(),
        next: { revalidate: 30 },
        signal: AbortSignal.timeout(20_000),
    });

    return unwrapRh<RhTradesResponse>(res);
}

/**
 * Price a curve trade. `amountWei` is ETH in for a buy, tokens in for a sell.
 * Only bonding tokens are quotable — the endpoint 500s for graduated tokens,
 * whose liquidity lives in a Uniswap V4 pool.
 */
export async function getRhQuote(
    tokenAddress: string,
    side: RhTradeSide,
    amountWei: string
): Promise<RhQuoteResponse> {
    const params = new URLSearchParams({
        tokenAddress: tokenAddress.trim(),
        side,
        amountWei,
    });
    const res = await fetch(`${BASE()}/evm/rh/quote?${params}`, {
        headers: headers(),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
    });

    return unwrapRh<RhQuoteResponse>(res);
}

let ethUsdCache: { ts: number; price: number } | null = null;

/** Best-effort ETH/USD for Robinhood Chain price display. */
export async function getEthUsdPrice(): Promise<number | undefined> {
    const now = Date.now();
    if (ethUsdCache && now - ethUsdCache.ts < 60_000) {
        return ethUsdCache.price;
    }

    try {
        const res = await fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
            { next: { revalidate: 60 }, signal: AbortSignal.timeout(8_000) }
        );
        if (!res.ok) return ethUsdCache?.price;
        const json = (await res.json()) as { ethereum?: { usd?: number } };
        const price = json.ethereum?.usd;
        if (typeof price === "number" && Number.isFinite(price) && price > 0) {
            ethUsdCache = { ts: now, price };
            return price;
        }
    } catch {
        /* ignore */
    }

    return ethUsdCache?.price;
}
