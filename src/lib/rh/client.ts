import "server-only";

export {
    getRhBalances,
    getRhPortfolio,
    getRhQuote,
    getRhToken,
    getRhTokens,
    getRhTrades,
} from "./onchain";

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
