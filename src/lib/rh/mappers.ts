import type { RhTokenDetailResponse, RhTokenListItem } from "./api-types";
import { RH_TOTAL_SUPPLY, type RhTokenView } from "./token";

/** Parse a fixed-18 decimal string (the API's price encoding) into a number. */
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

/** Parse a wei string into whole ETH (or whole tokens — same 18 decimals). */
export function parseWeiToEth(value: string | null | undefined): number | undefined {
    if (!value) return undefined;
    try {
        const n = Number(BigInt(value)) / 1e18;
        return Number.isFinite(n) ? n : undefined;
    } catch {
        return undefined;
    }
}

function isoFromUnix(seconds: number | null | undefined): string | undefined {
    if (!seconds) return undefined;
    return new Date(seconds * 1000).toISOString();
}

export function rhTokenListItemToView(item: RhTokenListItem, ethUsd?: number): RhTokenView {
    const priceEth = parseRhFixed18(item.priceEthPerToken);
    const priceUsd = priceEth != null && ethUsd != null ? priceEth * ethUsd : undefined;

    return {
        address: item.address,
        name: item.name,
        symbol: item.symbol,
        image: item.metadata?.image ?? undefined,
        description: item.metadata?.description ?? undefined,
        creator: item.creator,
        feeShare: item.feeShare,
        curve: item.curve,
        poolId: item.poolId,
        isMigrated: item.migrated,
        bondingProgressPct: item.bondingProgressPct,
        priceEthPerToken: item.priceEthPerToken ?? undefined,
        priceEth,
        priceUsd,
        fdvUsd: priceUsd != null ? priceUsd * RH_TOTAL_SUPPLY : undefined,
        createdAt: isoFromUnix(item.createdAtTimestamp),
        migratedAt: isoFromUnix(item.migratedAtTimestamp),
    };
}

export function rhTokenDetailToView(detail: RhTokenDetailResponse, ethUsd?: number): RhTokenView {
    const enriched: RhTokenListItem = {
        ...detail.token,
        priceEthPerToken: detail.state.priceEthPerToken,
        bondingProgressPct: detail.state.bondingProgressPct,
    };

    return {
        ...rhTokenListItemToView(enriched, ethUsd),
        // Live state wins over the indexed row.
        curve: detail.state.curve || detail.token.curve,
        feeShare: detail.state.feeShare || detail.token.feeShare,
        poolId: detail.state.poolId || detail.token.poolId,
        isMigrated: detail.state.migrated,
    };
}
