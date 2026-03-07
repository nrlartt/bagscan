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
        liquidityUsd: safeNum(raw.liquidityUsd ?? raw.liquidity),
        volume24hUsd: safeNum(raw.volume24hUsd ?? raw.volume24h),
        totalSupply,
        pairCreatedAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,

        raw,
    };
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
        provider: primary.provider ?? token.provider,
        providerUsername: primary.providerUsername ?? token.providerUsername,
        twitterUsername: primary.twitterUsername ?? token.twitterUsername,
        bagsUsername: primary.bagsUsername ?? token.bagsUsername,
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
        provider: creator.provider ?? token.provider,
        providerUsername: creator.providerUsername ?? token.providerUsername,
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

/**
 * Merge DexScreener pair data – now also captures 24h stats.
 */
export function mergeDexScreenerData(
    token: NormalizedToken,
    pairs: any[]
): NormalizedToken {
    if (!pairs || pairs.length === 0) return token;

    const pair = pairs.find((p: any) => p.baseToken?.address === token.tokenMint) || pairs[0];
    if (!pair) return token;

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
        pairAddress: pair.pairAddress ?? token.pairAddress,
        dexId: pair.dexId ?? token.dexId,
        priceChange24h: safeNum(pair.priceChange?.h24) ?? token.priceChange24h,
        txCount24h: safeNum(pair.txns?.h24?.buys) + safeNum(pair.txns?.h24?.sells) || token.txCount24h,
        buyCount24h: safeNum(pair.txns?.h24?.buys) ?? token.buyCount24h,
        sellCount24h: safeNum(pair.txns?.h24?.sells) ?? token.sellCount24h,
        pairCreatedAt: pair.pairCreatedAt ?? token.pairCreatedAt,
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
