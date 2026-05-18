/* ──────────────────────────────────────────────
   Bags API v2 – Mappers
   Raw → NormalizedToken
   ────────────────────────────────────────────── */

import type {
    BagsPool,
    BagsPoolInfo,
    BagsCreatorV3,
    BagsClaimStatEntry,
    NormalizedToken,
    HeliusAsset,
} from "./types";

const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Map a raw BagsPool into NormalizedToken.
 */
export function normalizePool(raw: BagsPool): NormalizedToken {
    const priceUsd = safeNum(raw.tokenPriceUsd ?? raw.tokenPrice);
    const totalSupply = safeNum(raw.totalSupply);
    const marketCap = safeNum(raw.marketCap);

    let fdvUsd = safeNum(raw.fdvUsd ?? raw.fdv);
    if (fdvUsd === undefined && priceUsd !== undefined && totalSupply !== undefined) {
        fdvUsd = priceUsd * totalSupply;
    }

    return {
        tokenMint: raw.tokenMint ?? "",
        poolAddress: raw.poolAddress ?? undefined,
        name: raw.name ?? undefined,
        symbol: raw.symbol ?? undefined,
        image: raw.image ?? undefined,
        description: raw.description ?? undefined,
        website: raw.website ?? undefined,
        twitter: raw.twitter ?? undefined,
        telegram: raw.telegram ?? undefined,

        creatorWallet: raw.creatorWallet ?? undefined,
        creatorDisplay: raw.creatorDisplayName ?? raw.creatorUsername ?? undefined,
        creatorUsername: raw.creatorUsername ?? undefined,
        creatorPfp: raw.creatorPfp ?? undefined,
        provider: raw.provider ?? undefined,
        providerUsername: raw.providerUsername ?? undefined,
        royaltyBps: safeNum(raw.royaltyBps),
        isCreator: raw.isCreator ?? undefined,
        isAdmin: raw.isAdmin ?? undefined,

        priceUsd,
        fdvUsd,
        marketCap,
        liquidityUsd: safeNum(raw.liquidityUsd ?? raw.liquidity),
        volume24hUsd: safeNum(raw.volume24hUsd ?? raw.volume24h),
        totalSupply,
        pairCreatedAt: normalizeBagsCreatedAt(raw.createdAt),

        raw,
    };
}

function normalizeBagsCreatedAt(v: unknown): string | undefined {
    if (typeof v === "string" && v.trim()) {
        return v;
    }
    if (typeof v === "number" && Number.isFinite(v)) {
        const ms = v < 1e12 ? v * 1000 : v;
        return new Date(ms).toISOString();
    }
    return undefined;
}

/**
 * Create a NormalizedToken from BagsPoolInfo (v2 pool keys only).
 */
export function normalizePoolInfo(info: BagsPoolInfo): NormalizedToken {
    return {
        tokenMint: info.tokenMint,
        dbcConfigKey: info.dbcConfigKey,
        dbcPoolKey: info.dbcPoolKey,
        dammV2PoolKey: info.dammV2PoolKey,
        isMigrated: !!info.dammV2PoolKey,
    };
}

/**
 * Merge v3 creator array into a token. Sets the primary creator from
 * the first entry marked isCreator, or falls back to the first entry.
 */
export function mergeCreatorsV3(
    token: NormalizedToken,
    creators: BagsCreatorV3[]
): NormalizedToken {
    if (!creators || creators.length === 0) return token;

    const primary = creators.find((c) => c.isCreator) ?? creators[0];

    return {
        ...token,
        creators,
        creatorWallet: primary.wallet ?? token.creatorWallet,
        creatorDisplay:
            primary.providerUsername ??
            primary.twitterUsername ??
            primary.bagsUsername ??
            primary.username ??
            token.creatorDisplay,
        creatorUsername: primary.username ?? token.creatorUsername,
        creatorPfp: primary.pfp ?? token.creatorPfp,
        provider: primary.provider ?? token.provider ?? undefined,
        providerUsername: primary.providerUsername ?? token.providerUsername ?? undefined,
        twitterUsername: primary.twitterUsername ?? token.twitterUsername ?? undefined,
        bagsUsername: primary.bagsUsername ?? token.bagsUsername ?? undefined,
        royaltyBps: safeNum(primary.royaltyBps) ?? token.royaltyBps,
        isCreator: primary.isCreator ?? token.isCreator,
        isAdmin: primary.isAdmin ?? token.isAdmin,
    };
}

/**
 * Merge claim stats array – includes per-claimer stats + totals.
 */
export function mergeClaimStatsV3(
    token: NormalizedToken,
    stats: BagsClaimStatEntry[],
    solPriceUsd: number
): NormalizedToken {
    if (!stats || stats.length === 0) return token;

    let totalClaimedLamports = BigInt(0);
    for (const s of stats) {
        try { totalClaimedLamports += BigInt(s.totalClaimed); } catch { /* skip */ }
    }

    const totalClaimedSol = Number(totalClaimedLamports) / LAMPORTS_PER_SOL;
    const totalClaimedUsd = totalClaimedSol * solPriceUsd;

    return {
        ...token,
        claimStats: stats,
        claimCount: stats.length,
        claimVolume: totalClaimedUsd > 0 ? totalClaimedUsd : token.claimVolume,
    };
}

/**
 * Merge lifetime fees (lamports string from Bags v2 API).
 */
export function mergeLifetimeFees(
    token: NormalizedToken,
    feesLamports: string | null,
    solPriceUsd: number
): NormalizedToken {
    if (!feesLamports) return token;

    let lamports: bigint;
    try {
        lamports = BigInt(feesLamports);
    } catch {
        const num = safeNum(feesLamports);
        if (num !== undefined) {
            return { ...token, lifetimeFees: num };
        }
        return token;
    }

    const sol = Number(lamports) / LAMPORTS_PER_SOL;
    const usd = sol * solPriceUsd;

    return {
        ...token,
        lifetimeFeesLamports: feesLamports,
        lifetimeFeesSol: sol,
        lifetimeFees: usd > 0 ? usd : token.lifetimeFees,
    };
}

/** Merge creator info (legacy single-object response). */
export function mergeCreatorInfo(
    token: NormalizedToken,
    creator: { creatorWallet?: string; creatorDisplayName?: string; creatorUsername?: string; creatorPfp?: string; provider?: string; providerUsername?: string; royaltyBps?: number; isCreator?: boolean; isAdmin?: boolean; [k: string]: unknown } | null
): NormalizedToken {
    if (!creator) return token;
    return {
        ...token,
        creatorWallet: creator.creatorWallet ?? token.creatorWallet,
        creatorDisplay:
            creator.creatorDisplayName ??
            creator.creatorUsername ??
            token.creatorDisplay,
        creatorUsername: creator.creatorUsername ?? token.creatorUsername,
        creatorPfp: creator.creatorPfp ?? token.creatorPfp,
        provider: creator.provider ?? token.provider ?? undefined,
        providerUsername: creator.providerUsername ?? token.providerUsername ?? undefined,
        royaltyBps: safeNum(creator.royaltyBps) ?? token.royaltyBps,
        isCreator: creator.isCreator ?? token.isCreator,
        isAdmin: creator.isAdmin ?? token.isAdmin,
    };
}

/** Merge fee data (legacy). */
export function mergeFeeData(
    token: NormalizedToken,
    fees: { lifetimeFeesUsd?: number; lifetimeFees?: number; [k: string]: unknown } | null
): NormalizedToken {
    if (!fees) return token;
    return {
        ...token,
        lifetimeFees: safeNum(fees.lifetimeFeesUsd ?? fees.lifetimeFees) ?? token.lifetimeFees,
    };
}

/** Merge claim stats (legacy single-object response). */
export function mergeClaimStats(
    token: NormalizedToken,
    stats: { claimCount?: number; claimVolume?: number; claimVolumeUsd?: number; [k: string]: unknown } | null
): NormalizedToken {
    if (!stats) return token;
    return {
        ...token,
        claimCount: safeNum(stats.claimCount) ?? token.claimCount,
        claimVolume:
            safeNum(stats.claimVolumeUsd ?? stats.claimVolume) ?? token.claimVolume,
    };
}

/** Prefer the live pool (e.g. Meteora after migration) by 24h volume, then liquidity. */
export function pickBestDexPairByActivity<T extends { volume?: { h24?: unknown }; liquidity?: { usd?: unknown } }>(
    pairs: T[]
): T | undefined {
    if (!pairs?.length) return undefined;
    const score = (p: T) => ({
        v: Number(p.volume?.h24) || 0,
        l: Number(p.liquidity?.usd) || 0,
    });
    return pairs.reduce((best, p) => {
        const b = score(best);
        const c = score(p);
        if (c.v !== b.v) return c.v > b.v ? p : best;
        return c.l > b.l ? p : best;
    });
}

export function sumDexTxBuysSells(txns: unknown, window: "m5" | "h1" | "h24"): number | undefined {
    if (!txns || typeof txns !== "object") return undefined;
    const w = (txns as Record<string, { buys?: unknown; sells?: unknown } | undefined>)[window];
    if (!w || typeof w !== "object") return undefined;
    const buys = Number((w as { buys?: unknown }).buys) || 0;
    const sells = Number((w as { sells?: unknown }).sells) || 0;
    const sum = buys + sells;
    return sum;
}

/**
 * Merge DexScreener pair data – now also captures 24h stats.
 */
export function mergeDexScreenerData(
    token: NormalizedToken,
    pairs: any[]
): NormalizedToken {
    if (!pairs || pairs.length === 0) return token;

    const forMint = pairs.filter((p: any) => p.baseToken?.address === token.tokenMint);
    const candidates = forMint.length > 0 ? forMint : pairs;
    const pair = pickBestDexPairByActivity(candidates) ?? candidates[0];
    if (!pair) return token;

    const mergedPairCreated = pair.pairCreatedAt ?? token.pairCreatedAt;

    const h24b = safeNum(pair.txns?.h24?.buys) ?? 0;
    const h24s = safeNum(pair.txns?.h24?.sells) ?? 0;
    const h24Total = h24b + h24s;
    const txCount24hMerged = h24Total > 0 ? h24Total : token.txCount24h;

    const tx5 = sumDexTxBuysSells(pair.txns, "m5");
    const tx1 = sumDexTxBuysSells(pair.txns, "h1");

    return {
        ...token,
        name: pair.baseToken?.name ?? token.name,
        symbol: pair.baseToken?.symbol ?? token.symbol,
        image: pair.info?.imageUrl ?? token.image,
        description: token.description,
        website: pair.info?.websites?.[0]?.url ?? token.website,
        priceUsd: safeNum(pair.priceUsd) ?? token.priceUsd,
        fdvUsd: safeNum(pair.fdv) ?? token.fdvUsd,
        marketCap: safeNum(pair.marketCap) ?? token.marketCap,
        liquidityUsd: safeNum(pair.liquidity?.usd) ?? token.liquidityUsd,
        volume24hUsd: safeNum(pair.volume?.h24) ?? token.volume24hUsd,
        volume5mUsd: safeNum((pair.volume as { m5?: unknown } | undefined)?.m5) ?? token.volume5mUsd,
        volume1hUsd: safeNum((pair.volume as { h1?: unknown } | undefined)?.h1) ?? token.volume1hUsd,
        pairAddress: pair.pairAddress ?? token.pairAddress,
        quoteTokenSymbol: pair.quoteToken?.symbol ?? token.quoteTokenSymbol,
        dexId: pair.dexId ?? token.dexId,
        priceChange24h: safeNum(pair.priceChange?.h24) ?? token.priceChange24h,
        txCount24h: txCount24hMerged,
        txCount5m: tx5 ?? token.txCount5m,
        txCount1h: tx1 ?? token.txCount1h,
        buyCount24h: safeNum(pair.txns?.h24?.buys) ?? token.buyCount24h,
        sellCount24h: safeNum(pair.txns?.h24?.sells) ?? token.sellCount24h,
        pairCreatedAt: normalizeBagsCreatedAt(mergedPairCreated),
    };
}

/**
 * Merge Helius DAS asset data.
 */
export function mergeHeliusData(
    token: NormalizedToken,
    asset: HeliusAsset | null
): NormalizedToken {
    if (!asset) return token;
    return {
        ...token,
        name: token.name ?? asset.content?.metadata?.name,
        symbol: token.symbol ?? asset.content?.metadata?.symbol,
        description: token.description ?? asset.content?.metadata?.description,
        image: token.image ?? asset.content?.links?.image ?? asset.content?.files?.[0]?.cdn_uri,
        totalSupply: asset.token_info?.supply ?? token.totalSupply,
        decimals: asset.token_info?.decimals ?? token.decimals,
    };
}

// ── helper ───────────────────────────────────
function safeNum(v: unknown): number | undefined {
    if (v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}
