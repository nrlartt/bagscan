import type { NormalizedToken } from "./types";
import type { RhTokenDetailResponse, RhTokenListItem } from "./rh-types";

/** Every Robinhood Chain launch mints a fixed 1B supply, so FDV == price × 1B. */
const RH_TOTAL_SUPPLY = 1_000_000_000;

export function parseRhFixed18(value: string | null | undefined): number | undefined {
    if (!value) return undefined;
    try {
        const raw = BigInt(value);
        const divisor = BigInt("1000000000000000000");
        const whole = Number(raw / divisor);
        const frac = Number(raw % divisor) / 1e18;
        const n = whole + frac;
        return Number.isFinite(n) && n > 0 ? n : undefined;
    } catch {
        const n = Number(value);
        return Number.isFinite(n) && n > 0 ? n : undefined;
    }
}

export function parseWeiToEth(value: string | null | undefined): number | undefined {
    if (!value) return undefined;
    try {
        const n = Number(BigInt(value)) / 1e18;
        return Number.isFinite(n) ? n : undefined;
    } catch {
        return undefined;
    }
}

function rhPriceUsd(item: RhTokenListItem, ethUsd?: number): number | undefined {
    const priceEth = parseRhFixed18(item.priceEthPerToken);
    if (priceEth == null || ethUsd == null) return undefined;
    return priceEth * ethUsd;
}

export function rhTokenListItemToNormalized(
    item: RhTokenListItem,
    ethUsd?: number
): NormalizedToken {
    const priceUsd = rhPriceUsd(item, ethUsd);
    const fdvUsd = priceUsd != null ? priceUsd * RH_TOTAL_SUPPLY : undefined;

    return {
        tokenMint: item.address,
        name: item.name,
        symbol: item.symbol,
        image: item.metadata?.image ?? undefined,
        description: item.metadata?.description ?? undefined,
        creatorWallet: item.creator,
        isMigrated: item.migrated,
        priceUsd,
        // Derived from a fixed supply, not an exchange-reported cap — leave
        // `marketCap` unset so the UI labels this honestly as FDV.
        fdvUsd,
        pairCreatedAt: new Date(item.createdAtTimestamp * 1000).toISOString(),
        chain: "robinhood",
        bondingProgressPct: item.bondingProgressPct,
        priceEthPerToken: item.priceEthPerToken ?? undefined,
        quoteTokenSymbol: "ETH",
        discoverySource: "robinhood",
        raw: item,
    };
}

export function rhTokenDetailToNormalized(
    detail: RhTokenDetailResponse,
    ethUsd?: number
): NormalizedToken {
    const enriched: RhTokenListItem = {
        ...detail.token,
        priceEthPerToken: detail.state.priceEthPerToken,
        bondingProgressPct: detail.state.bondingProgressPct,
    };
    const base = rhTokenListItemToNormalized(enriched, ethUsd);
    return {
        ...base,
        poolAddress: detail.token.poolId,
        raw: detail,
    };
}
