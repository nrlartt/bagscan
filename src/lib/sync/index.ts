/* ──────────────────────────────────────────────
   Sync utilities – Smart homepage strategy
   • Trending: DexScreener (popular tokens with market data)
   • New Launches: Bags pools (newest) + on-chain Metaplex metadata
   • Search: All 167K+ pools, enriched cache lookup
   ────────────────────────────────────────────── */

import { prisma } from "@/lib/db";
import {
    getBagsPools,
    getBagsPoolInfo,
    getCreatorsV3,
    getLifetimeFees,
    getClaimStatsDetailed,
    getDexScreenerPairs,
    getDexScreenerSearch,
    getDexScreenerNewBagsPairs,
    getHeliusAsset,
    getHeliusHolderCount,
    getSolPriceUsd,
    getHackathonApps,
} from "@/lib/bags/client";
import { getXUserCached, isXquikConfigured } from "@/lib/xquik/client";
import {
    normalizePoolInfo,
    mergeCreatorsV3,
    mergeLifetimeFees,
    mergeClaimStatsV3,
    mergeDexScreenerData,
    mergeHeliusData,
} from "@/lib/bags/mappers";
import { getTokenMetadataBatch, type TokenMetadata } from "@/lib/solana/metadata";
import type { BagsPool, NormalizedToken } from "@/lib/bags/types";
import type { AlphaToken } from "@/lib/alpha/types";

// ── Caches ───────────────────────────────────

interface PoolEntry {
    tokenMint: string;
    dbcConfigKey?: string;
    dbcPoolKey?: string;
    dammV2PoolKey?: string;
    name?: string;
    symbol?: string;
    image?: string;
    twitter?: string;
    priceUsd?: number;
    marketCap?: number;
    fdvUsd?: number;
    liquidityUsd?: number;
    volume24hUsd?: number;
    creatorWallet?: string;
    creatorDisplay?: string;
}

type DexPair = Awaited<ReturnType<typeof getDexScreenerPairs>>[number];

let allPoolsCache: { pools: PoolEntry[]; ts: number } | null = null;
let trendingCache: { tokens: NormalizedToken[]; ts: number } | null = null;
let newLaunchCache: { tokens: NormalizedToken[]; ts: number } | null = null;
let spotlightCache: { tokens: NormalizedToken[]; ts: number } | null = null;
const metadataCache = new Map<string, NormalizedToken>();

// Locks to prevent concurrent revalidation
let trendingRevalidating = false;
let newLaunchRevalidating = false;
let spotlightRevalidationPromise: Promise<NormalizedToken[]> | null = null;

const POOLS_TTL = 3 * 60_000;
const TRENDING_TTL = 60_000;
const TRENDING_STALE_TTL = 5 * 60_000; // Serve stale for up to 5 min
const NEW_LAUNCH_TTL = 20_000;
const NEW_LAUNCH_STALE_TTL = 3 * 60_000;
const SPOTLIGHT_TTL = 2 * 60_000;
const SPOTLIGHT_STALE_TTL = 12 * 60_000;
const CURATED_SPOTLIGHT_ORDER = [
    "BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS",
    "2TsmuYUrsctE57VLckZBYEEzdokUF8j8e1GavekWBAGS",
    "AwGg6CLP5P5LreVbgD4RuSmwXgnu71SmVr6GYsDaBAGS",
    "DEffWzJyaFRNyA4ogUox631hfHuv3KLeCcpBh2ipBAGS",
    "Fnmq5udTPPkxGjw8nDtnRsjJWfHfdNmsfKGLhUerBAGS",
    "677CpPEoKVo9tyCyBHqtiXZivUPdPXEigd3FspWuBAGS",
    "8116V1BW9zaXUM6pVhWVaAduKrLcEBi3RGXedKTrBAGS",
    "Hv3rHWYcpkngFNYkjLaQXb9m9NXyzuwEoFz13yMTBAGS",
    "6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS",
    "ABadLP3asy88raGZciQf61Lb4ZWhVbdpptjnZ4JuBAGS",
    "Byb8WojwPWthyMm8iwtcd9CQhcZjnjQmhTRi5GN7BAGS",
    "Ga7oQU8gvAoRU65Krm2ipy8QVEm2ksc7ZY25EVqFBAGS",
    "Faw8wwB6MnyAm9xG3qeXgN1isk9agXBoaRZX9Ma8BAGS",
    "9kkz3QiYemzHQndyE6acHJ8wb19WwPHAdck6FMEGBAGS",
    "s64RinoknMmndiAMH2hcFC4yRJkT58VeMT93jJFBAGS",
] as const;
const CURATED_SPOTLIGHT_SET = new Set<string>(CURATED_SPOTLIGHT_ORDER);

// ═══════════════════════════════════════════════
// Pool index (for search)
// ═══════════════════════════════════════════════

async function getAllPools(): Promise<PoolEntry[]> {
    if (allPoolsCache && Date.now() - allPoolsCache.ts < POOLS_TTL) {
        return allPoolsCache.pools;
    }
    try {
        const raw = await getBagsPools();
        const pools: PoolEntry[] = raw
            .map((p: BagsPool): PoolEntry | null => {
                if (!p.tokenMint) {
                    return null;
                }

                const extended = p as BagsPool & {
                    dbcConfigKey?: unknown;
                    dbcPoolKey?: unknown;
                    dammV2PoolKey?: unknown;
                };

                return {
                    tokenMint: p.tokenMint,
                    dbcConfigKey:
                        typeof extended.dbcConfigKey === "string" ? extended.dbcConfigKey : undefined,
                    dbcPoolKey:
                        typeof extended.dbcPoolKey === "string" ? extended.dbcPoolKey : undefined,
                    dammV2PoolKey:
                        typeof extended.dammV2PoolKey === "string" ? extended.dammV2PoolKey : undefined,
                    name: p.name,
                    symbol: p.symbol,
                    image: p.image,
                    twitter: p.twitter,
                    priceUsd: Number(p.tokenPriceUsd) || Number(p.priceUsd) || undefined,
                    marketCap: undefined,
                    fdvUsd: Number(p.fdvUsd) || Number(p.fdv) || undefined,
                    liquidityUsd: Number(p.liquidityUsd) || Number(p.liquidity) || undefined,
                    volume24hUsd: Number(p.volume24hUsd) || Number(p.volume24h) || undefined,
                    creatorWallet: p.creatorWallet,
                    creatorDisplay: p.creatorDisplayName || p.creatorUsername,
                };
            })
            .filter((p): p is PoolEntry => p !== null);
        allPoolsCache = { pools, ts: Date.now() };
        return pools;
    } catch (e) {
        console.error("[sync] getAllPools error:", e);
        return allPoolsCache?.pools ?? [];
    }
}

function mergeBagsPoolMarketData(
    token: NormalizedToken,
    pool?: PoolEntry
): NormalizedToken {
    if (!pool) {
        return token;
    }

    return {
        ...token,
        name: pool.name ?? token.name,
        symbol: pool.symbol ?? token.symbol,
        image: pool.image ?? token.image,
        twitter: pool.twitter ?? token.twitter,
        priceUsd: pool.priceUsd ?? token.priceUsd,
        marketCap: pool.marketCap ?? token.marketCap,
        fdvUsd: pool.fdvUsd ?? token.fdvUsd,
        liquidityUsd: pool.liquidityUsd ?? token.liquidityUsd,
        volume24hUsd: pool.volume24hUsd ?? token.volume24hUsd,
        creatorWallet: pool.creatorWallet ?? token.creatorWallet,
        creatorDisplay: pool.creatorDisplay ?? token.creatorDisplay,
    };
}

// ═══════════════════════════════════════════════
// TRENDING – DexScreener pairs with real market data
// ═══════════════════════════════════════════════

async function fetchTrendingFromDex(): Promise<NormalizedToken[]> {
    const [pairs, pools] = await Promise.all([
        getDexScreenerSearch("bags"),
        getAllPools().catch(() => [] as PoolEntry[]),
    ]);
    const poolMap = new Map(pools.map((pool) => [pool.tokenMint, pool]));

    const tokens: NormalizedToken[] = pairs
        .filter(hasDexBaseAddress)
        .map((p): NormalizedToken =>
            mergeBagsPoolMarketData(
                {
                    tokenMint: p.baseToken.address,
                    poolAddress: typeof p.pairAddress === "string" ? p.pairAddress : undefined,
                    name: p.baseToken.name,
                    symbol: p.baseToken.symbol,
                    image: p.info?.imageUrl,
                    priceUsd: Number(p.priceUsd) || undefined,
                    fdvUsd: Number(p.fdv) || undefined,
                    marketCap: undefined,
                    liquidityUsd: Number(p.liquidity?.usd) || undefined,
                    volume24hUsd: Number(p.volume?.h24) || undefined,
                    pairAddress: typeof p.pairAddress === "string" ? p.pairAddress : undefined,
                    dexId: typeof p.dexId === "string" ? p.dexId : undefined,
                    priceChange24h: Number(p.priceChange?.h24) || undefined,
                    txCount24h:
                        ((Number(p.txns?.h24?.buys) || 0) +
                            (Number(p.txns?.h24?.sells) || 0)) ||
                        undefined,
                    buyCount24h: Number(p.txns?.h24?.buys) || undefined,
                    sellCount24h: Number(p.txns?.h24?.sells) || undefined,
                    website: getDexWebsite(p),
                },
                poolMap.get(p.baseToken.address)
            )
        );

    if (tokens.length === 0) throw new Error("DexScreener returned 0 trending pairs");

    for (const t of tokens) {
        metadataCache.set(t.tokenMint, t);
    }

    trendingCache = { tokens, ts: Date.now() };

    // Fire-and-forget DB upserts
    Promise.resolve().then(async () => {
        for (const t of tokens.slice(0, 30)) {
            if (!t.tokenMint || !t.name) continue;
            prisma.tokenRegistry
                .upsert({
                    where: { tokenMint: t.tokenMint },
                    create: {
                        tokenMint: t.tokenMint,
                        poolAddress: t.poolAddress,
                        name: t.name,
                        symbol: t.symbol,
                        image: t.image,
                        latestPriceUsd: t.priceUsd,
                        latestFdvUsd: t.fdvUsd,
                        latestLiquidityUsd: t.liquidityUsd,
                        launchSource: "bags",
                    },
                    update: {
                        name: t.name,
                        symbol: t.symbol,
                        image: t.image,
                        latestPriceUsd: t.priceUsd,
                        latestFdvUsd: t.fdvUsd,
                        latestLiquidityUsd: t.liquidityUsd,
                    },
                })
                .catch(() => {});
        }
    }).catch(() => {});

    return tokens;
}

export async function syncTrendingTokens(): Promise<NormalizedToken[]> {
    const age = trendingCache ? Date.now() - trendingCache.ts : Infinity;

    // Fresh cache — return immediately
    if (age < TRENDING_TTL) {
        return trendingCache!.tokens;
    }

    // Stale cache — return stale data and revalidate in background
    if (age < TRENDING_STALE_TTL && trendingCache && trendingCache.tokens.length > 0) {
        if (!trendingRevalidating) {
            trendingRevalidating = true;
            fetchTrendingFromDex()
                .catch((e) => console.error("[sync] trending bg-revalidate error:", e))
                .finally(() => { trendingRevalidating = false; });
        }
        return trendingCache.tokens;
    }

    // No cache or too old — fetch synchronously
    try {
        return await fetchTrendingFromDex();
    } catch (e) {
        console.error("[sync] trending error:", e);
        return trendingCache?.tokens ?? [];
    }
}

// ═══════════════════════════════════════════════
// LEADERBOARD – Tokens ranked by creator earnings
// ═══════════════════════════════════════════════

export interface LeaderboardEntry {
    tokenMint: string;
    name?: string;
    symbol?: string;
    image?: string;
    creatorDisplay?: string;
    creatorPfp?: string;
    provider?: string;
    providerUsername?: string;
    twitterUsername?: string;
    earnedLamports: string;
    earnedSol: number;
    earnedUsd: number;
    priceUsd?: number;
    volume24hUsd?: number;
    priceChange24h?: number;
    followers?: string;
}

let leaderboardCache: { entries: LeaderboardEntry[]; ts: number } | null = null;
const LEADERBOARD_TTL = 2 * 60_000;

const SEED_TOKENS = [
    "CMx7yon2cLzHcXqgHsKJhuU3MmME6noWLQk2rAycBAGS",
    "ESBCnCXtEZDmX8QnHU6qMZXd9mvjSAZVoYaLKKADBAGS",
    "GniCbud3kFjF9WFLGZ6e7PrbGASQcS3qshZ7LPWQBAGS",
    "CxWPdDBqxVo3fnTMRTvNuSrd4gkp78udSrFvkVDBAGS",
    "EkJuyYyD3to61CHVPJn6wHb7xANxvqApnVJ4o2SdBAGS",
    "Cw2doN2QR3e5FEsJurgX7wJG4RDeDjTxGsp3uZgKBAGS",
    "9mAnyxAq8JQieHT7Lc47PVQbTK7ZVaaog8LwAbFzBAGS",
    "Gj4TowizfdkRJNsTgBEkj2WpBZZmGE7o9nN8q6RhBAGS",
    "8116V1BW9zaXUM6pVhWVaAduKrLcEBi3RGXedKTrBAGS",
    "AWc8uws9nh7pYjFQ8FzxavmP8WTUPwmQZAvK2yAPBAGS",
];

export async function syncLeaderboard(): Promise<LeaderboardEntry[]> {
    if (leaderboardCache && Date.now() - leaderboardCache.ts < LEADERBOARD_TTL) {
        return leaderboardCache.entries;
    }

    try {
        const trending = await syncTrendingTokens();
        const solPrice = await getSolPriceUsd();

        const trendingMints = new Set(trending.map((t) => t.tokenMint));
        const seedsToAdd = SEED_TOKENS.filter((m) => !trendingMints.has(m));

        const seedDexData = new Map<string, DexPair>();
        if (seedsToAdd.length > 0) {
            const pairs = await getDexScreenerPairs(seedsToAdd);
            for (const p of pairs) {
                const addr = p.baseToken?.address;
                if (addr) seedDexData.set(addr, p);
            }
        }
        const seedMetadata = seedsToAdd.length > 0
            ? await getTokenMetadataBatch(seedsToAdd)
            : new Map();

        const seedTokens: NormalizedToken[] = seedsToAdd.map((mint) => {
            const dex = seedDexData.get(mint);
            const meta = seedMetadata.get(mint);
            return {
                tokenMint: mint,
                name: dex?.baseToken?.name ?? meta?.name,
                symbol: dex?.baseToken?.symbol ?? meta?.symbol,
                image: dex?.info?.imageUrl,
                priceUsd: Number(dex?.priceUsd) || undefined,
                volume24hUsd: Number(dex?.volume?.h24) || undefined,
                priceChange24h: Number(dex?.priceChange?.h24) || undefined,
            };
        });

        for (const st of seedTokens) {
            if (st.name) metadataCache.set(st.tokenMint, st);
        }

        const allTokens = [...trending, ...seedTokens];

        const entries: LeaderboardEntry[] = await Promise.all(
            allTokens.map(async (t): Promise<LeaderboardEntry | null> => {
                try {
                    const [feesLamports, creatorData] = await Promise.all([
                        getLifetimeFees(t.tokenMint),
                        getCreatorsV3(t.tokenMint),
                    ]);

                    const lamports = feesLamports ?? "0";
                    const sol = Number(lamports) / 1e9;
                    const usd = sol * solPrice;

                    const creator = Array.isArray(creatorData) ? creatorData[0] : creatorData;

                    return {
                        tokenMint: t.tokenMint,
                        name: t.name,
                        symbol: t.symbol,
                        image: t.image,
                        creatorDisplay: creator?.providerUsername ?? creator?.username ?? creator?.bagsUsername,
                        creatorPfp: creator?.pfp,
                        provider: creator?.provider ?? undefined,
                        providerUsername: creator?.providerUsername ?? undefined,
                        twitterUsername: creator?.twitterUsername,
                        earnedLamports: lamports,
                        earnedSol: sol,
                        earnedUsd: usd,
                        priceUsd: t.priceUsd,
                        volume24hUsd: t.volume24hUsd,
                        priceChange24h: t.priceChange24h,
                    };
                } catch {
                    return null;
                }
            })
        ).then((arr) => arr.filter((e): e is LeaderboardEntry => e !== null));

        entries.sort((a, b) => b.earnedUsd - a.earnedUsd);

        for (const e of entries) {
            const existing = metadataCache.get(e.tokenMint) ?? { tokenMint: e.tokenMint };
            metadataCache.set(e.tokenMint, {
                ...existing,
                name: e.name ?? existing.name,
                symbol: e.symbol ?? existing.symbol,
                image: e.image ?? existing.image,
                creatorDisplay: e.creatorDisplay ?? existing.creatorDisplay,
                creatorPfp: e.creatorPfp ?? existing.creatorPfp,
                provider: e.provider ?? existing.provider,
                providerUsername: e.providerUsername ?? existing.providerUsername,
                twitterUsername: e.twitterUsername ?? existing.twitterUsername,
                lifetimeFees: e.earnedUsd,
                priceUsd: e.priceUsd ?? existing.priceUsd,
            });
        }

        leaderboardCache = { entries, ts: Date.now() };
        return entries;
    } catch (e) {
        console.error("[sync] leaderboard error:", e);
        return leaderboardCache?.entries ?? [];
    }
}

// ═══════════════════════════════════════════════
// PLATFORM STATS
// ═══════════════════════════════════════════════

export interface PlatformStats {
    totalProjects: number;
    totalCreatorEarnings: number;
    totalVolume: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
    const [leaderboard, trending] = await Promise.all([
        syncLeaderboard(),
        syncTrendingTokens(),
    ]);

    // Pool count is slow (Bags API) — use cached value or skip
    let poolCount = allPoolsCache?.pools.length ?? trending.length;
    try {
        poolCount = await Promise.race([
            getTotalPoolCount(),
            new Promise<number>((_, rej) => setTimeout(() => rej("timeout"), 3_000)),
        ]);
    } catch {}

    const totalCreatorEarnings = leaderboard.reduce((s, e) => s + e.earnedUsd, 0);
    const totalVolume = trending.reduce((s, t) => s + (t.volume24hUsd ?? 0), 0);

    return {
        totalProjects: poolCount,
        totalCreatorEarnings,
        totalVolume,
    };
}

function hasDexBaseAddress(
    pair: DexPair
): pair is DexPair & { baseToken: DexPair["baseToken"] & { address: string } } {
    return typeof pair.baseToken?.address === "string" && pair.baseToken.address.length > 0;
}

function getDexWebsite(pair: DexPair) {
    const websites = (pair.info as { websites?: Array<{ url?: string }> } | undefined)?.websites;
    const first = websites?.[0]?.url;
    return typeof first === "string" ? first : undefined;
}

// ═══════════════════════════════════════════════
// NEW LAUNCHES – Newest pools + on-chain metadata
// ═══════════════════════════════════════════════

function pickDefined<T>(...values: Array<T | null | undefined>): T | undefined {
    for (const value of values) {
        if (value !== undefined && value !== null) {
            return value;
        }
    }
    return undefined;
}

function pickMaxNumber(...values: Array<number | undefined>) {
    const defined = values.filter((value): value is number => typeof value === "number");
    if (defined.length === 0) {
        return undefined;
    }
    return Math.max(...defined);
}

function pickEarlierIso(a?: string, b?: string) {
    if (!a) return b;
    if (!b) return a;
    return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

function mergeSpotlightTokens(existing: NormalizedToken, incoming: NormalizedToken): NormalizedToken {
    return {
        ...existing,
        ...incoming,
        name: pickDefined(incoming.name, existing.name),
        symbol: pickDefined(incoming.symbol, existing.symbol),
        image: pickDefined(incoming.image, existing.image),
        description: pickDefined(incoming.description, existing.description),
        website: pickDefined(incoming.website, existing.website),
        twitter: pickDefined(incoming.twitter, existing.twitter),
        telegram: pickDefined(incoming.telegram, existing.telegram),
        projectTwitterHandle: pickDefined(incoming.projectTwitterHandle, existing.projectTwitterHandle),
        creatorWallet: pickDefined(incoming.creatorWallet, existing.creatorWallet),
        creatorDisplay: pickDefined(incoming.creatorDisplay, existing.creatorDisplay),
        creatorUsername: pickDefined(incoming.creatorUsername, existing.creatorUsername),
        creatorPfp: pickDefined(incoming.creatorPfp, existing.creatorPfp),
        provider: pickDefined(incoming.provider, existing.provider),
        providerUsername: pickDefined(incoming.providerUsername, existing.providerUsername),
        twitterUsername: pickDefined(incoming.twitterUsername, existing.twitterUsername),
        priceUsd: pickDefined(incoming.priceUsd, existing.priceUsd),
        fdvUsd: pickDefined(incoming.fdvUsd, existing.fdvUsd),
        marketCap: pickDefined(incoming.marketCap, existing.marketCap),
        liquidityUsd: pickDefined(incoming.liquidityUsd, existing.liquidityUsd),
        volume24hUsd: pickDefined(incoming.volume24hUsd, existing.volume24hUsd),
        priceChange24h: pickDefined(incoming.priceChange24h, existing.priceChange24h),
        txCount24h: pickDefined(incoming.txCount24h, existing.txCount24h),
        buyCount24h: pickDefined(incoming.buyCount24h, existing.buyCount24h),
        sellCount24h: pickDefined(incoming.sellCount24h, existing.sellCount24h),
        lifetimeFees: pickDefined(incoming.lifetimeFees, existing.lifetimeFees),
        pairCreatedAt: pickEarlierIso(existing.pairCreatedAt, incoming.pairCreatedAt),
        holderCount: pickDefined(incoming.holderCount, existing.holderCount),
        alphaScore: pickMaxNumber(existing.alphaScore, incoming.alphaScore),
        socialScore: pickMaxNumber(existing.socialScore, incoming.socialScore),
        projectTwitterFollowers: pickMaxNumber(existing.projectTwitterFollowers, incoming.projectTwitterFollowers),
        creatorFollowers: pickMaxNumber(existing.creatorFollowers, incoming.creatorFollowers),
        trendingNowScore: pickMaxNumber(existing.trendingNowScore, incoming.trendingNowScore),
        rugRiskScore: pickMaxNumber(existing.rugRiskScore, incoming.rugRiskScore),
        isTrendingNow: existing.isTrendingNow || incoming.isTrendingNow,
        discoverySource: pickDefined(incoming.discoverySource, existing.discoverySource),
    };
}

function hoursSince(dateStr?: string): number | null {
    if (!dateStr) {
        return null;
    }

    const timestamp = new Date(dateStr).getTime();
    if (!Number.isFinite(timestamp)) {
        return null;
    }

    const diffHours = (Date.now() - timestamp) / (60 * 60 * 1000);
    return diffHours >= 0 ? diffHours : null;
}

function formatCompactUsdLabel(value: number) {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
}

function getSpotlightValuation(token: Pick<NormalizedToken, "marketCap" | "fdvUsd">) {
    return token.marketCap ?? token.fdvUsd ?? 0;
}

function getSpotlightValuationLabel(token: Pick<NormalizedToken, "marketCap" | "fdvUsd">) {
    if (token.marketCap) {
        return "MCAP";
    }
    if (token.fdvUsd) {
        return "FDV";
    }
    return "VALUE";
}

function formatSpotlightAgeLabel(ageHours: number | null) {
    if (ageHours === null) {
        return undefined;
    }
    if (ageHours < 24) {
        return `${Math.max(1, Math.round(ageHours))}H LIVE`;
    }

    const ageDays = ageHours / 24;
    if (ageDays < 14) {
        return `${Math.max(1, Math.round(ageDays))}D LIVE`;
    }
    if (ageDays < 60) {
        return `${Math.max(1, Math.round(ageDays / 7))}W LIVE`;
    }
    return `${Math.max(1, Math.round(ageDays / 30))}M LIVE`;
}

function buildSpotlightReasons(
    token: NormalizedToken,
    earnedUsd: number,
    sourceCount: number
) {
    const reasons: string[] = [];
    const marketCap = getSpotlightValuation(token);
    const valuationLabel = getSpotlightValuationLabel(token);
    const volume = token.volume24hUsd ?? 0;
    const liquidity = token.liquidityUsd ?? 0;
    const txCount = token.txCount24h ?? 0;
    const priceChange = token.priceChange24h ?? 0;
    const buys = token.buyCount24h ?? 0;
    const sells = token.sellCount24h ?? 0;
    const ageHours = hoursSince(token.pairCreatedAt);

    if (sourceCount > 1) reasons.push("Cross-feed coverage");
    if (token.isTrendingNow || (token.trendingNowScore ?? 0) >= 82) {
        reasons.push("Alpha support");
    } else if ((token.alphaScore ?? 0) >= 70) {
        reasons.push("Strong social signal");
    }
    if (marketCap >= 5_000) reasons.push(`${valuationLabel} ${formatCompactUsdLabel(marketCap)}`);
    if (volume >= 10_000) reasons.push(`Live volume ${formatCompactUsdLabel(volume)}`);
    if (liquidity >= 4_000) reasons.push(`Deep liquidity ${formatCompactUsdLabel(liquidity)}`);
    if (txCount >= 120) reasons.push(`Trade flow ${Math.round(txCount)} tx`);
    if (priceChange >= 12) reasons.push(`Price strength +${priceChange.toFixed(1)}%`);
    if (earnedUsd >= 250) reasons.push(`Creator traction ${formatCompactUsdLabel(earnedUsd)}`);

    if (ageHours !== null && ageHours >= 168 && marketCap >= 6_000 && liquidity >= 3_000) {
        reasons.push(`Established ${formatSpotlightAgeLabel(ageHours)?.replace(" LIVE", "")}`);
    } else if (ageHours !== null && ageHours <= 72 && (volume >= 5_000 || txCount >= 60)) {
        reasons.push(`Fresh ${formatSpotlightAgeLabel(ageHours)?.replace(" LIVE", "")}`);
    }

    if (buys > sells * 1.2 && txCount >= 50) {
        reasons.push(`Buy pressure ${(buys / Math.max(1, sells)).toFixed(1)}x`);
    }

    return [...new Set(reasons)].slice(0, 4);
}

function mapLeaderboardEntryToToken(entry: LeaderboardEntry): NormalizedToken {
    const cached = metadataCache.get(entry.tokenMint);
    return {
        ...cached,
        tokenMint: entry.tokenMint,
        name: pickDefined(entry.name, cached?.name),
        symbol: pickDefined(entry.symbol, cached?.symbol),
        image: pickDefined(entry.image, cached?.image),
        creatorDisplay: pickDefined(entry.creatorDisplay, cached?.creatorDisplay),
        creatorPfp: pickDefined(entry.creatorPfp, cached?.creatorPfp),
        provider: pickDefined(entry.provider, cached?.provider),
        providerUsername: pickDefined(entry.providerUsername, cached?.providerUsername),
        twitterUsername: pickDefined(entry.twitterUsername, cached?.twitterUsername),
        priceUsd: pickDefined(entry.priceUsd, cached?.priceUsd),
        volume24hUsd: pickDefined(entry.volume24hUsd, cached?.volume24hUsd),
        priceChange24h: pickDefined(entry.priceChange24h, cached?.priceChange24h),
        lifetimeFees: entry.earnedUsd,
    };
}

function mapPoolEntryToToken(entry: PoolEntry): NormalizedToken {
    return {
        tokenMint: entry.tokenMint,
        dbcConfigKey: entry.dbcConfigKey,
        dbcPoolKey: entry.dbcPoolKey,
        dammV2PoolKey: entry.dammV2PoolKey,
        isMigrated: Boolean(entry.dammV2PoolKey),
        name: entry.name,
        symbol: entry.symbol,
        image: entry.image,
        twitter: entry.twitter,
        priceUsd: entry.priceUsd,
        fdvUsd: entry.fdvUsd,
        marketCap: entry.marketCap,
        liquidityUsd: entry.liquidityUsd,
        volume24hUsd: entry.volume24hUsd,
        creatorWallet: entry.creatorWallet,
        creatorDisplay: entry.creatorDisplay,
    };
}

function mapAlphaTokenToSpotlightToken(token: AlphaToken): NormalizedToken {
    return {
        tokenMint: token.tokenMint,
        name: token.name,
        symbol: token.symbol,
        image: token.image,
        priceUsd: token.priceUsd,
        marketCap: token.marketCap,
        liquidityUsd: token.liquidityUsd,
        volume24hUsd: token.volume24hUsd,
        priceChange24h: token.priceChange24h,
        pairCreatedAt: token.pairCreatedAt,
        txCount24h: token.txCount24h,
        buyCount24h: token.buyCount24h,
        sellCount24h: token.sellCount24h,
        creatorDisplay: token.creatorDisplay,
        creatorPfp: token.creatorPfp,
        creatorWallet: token.creatorWallet,
        provider: token.provider,
        providerUsername: token.providerUsername,
        twitterUsername: token.twitterUsername,
        bagsUsername: token.bagsUsername,
        lifetimeFees: token.earnedUsd,
        lifetimeFeesSol: token.earnedSol,
        alphaScore: token.alphaScore,
        socialScore: token.socialScore,
        creatorFollowers: token.creatorFollowers,
        trendingNowScore: token.trendingNowScore,
        rugRiskScore: token.rugRiskScore,
        isTrendingNow: token.isTrendingNow,
        discoverySource: token.discoverySource,
    };
}

async function withTimeoutFallback<T>(
    promise: Promise<T>,
    timeoutMs: number,
    fallback: T,
    label: string
): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            promise.catch((error) => {
                console.error(`[sync] ${label} source error:`, error);
                return fallback;
            }),
            new Promise<T>((resolve) => {
                timeoutId = setTimeout(() => {
                    console.warn(`[sync] ${label} source timed out after ${timeoutMs}ms`);
                    resolve(fallback);
                }, timeoutMs);
            }),
        ]);
    } catch (error) {
        console.error(`[sync] ${label} source fallback error:`, error);
        return fallback;
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

function compareSpotlightTokens(a: NormalizedToken, b: NormalizedToken) {
    const valuationDiff = getSpotlightValuation(b) - getSpotlightValuation(a);
    if (valuationDiff !== 0) return valuationDiff;

    const volumeDiff = (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0);
    if (volumeDiff !== 0) return volumeDiff;

    const txDiff = (b.txCount24h ?? 0) - (a.txCount24h ?? 0);
    if (txDiff !== 0) return txDiff;

    return (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0);
}

function getSpotlightRotationHash(input: string) {
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
        hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
    }
    return hash;
}

function sortRotatingSpotlightTokens(tokens: NormalizedToken[]) {
    const now = Date.now();
    const fastBucket = Math.floor(now / (1000 * 60 * 3));
    const slowBucket = Math.floor(now / (1000 * 60 * 17));

    return [...tokens].sort((a, b) => {
        const aSeed = getSpotlightRotationHash(
            `${fastBucket}:${slowBucket}:${a.tokenMint}:${Math.round(getSpotlightValuation(a))}:${Math.round(a.volume24hUsd ?? 0)}:${a.symbol ?? ""}:${a.txCount24h ?? 0}`
        );
        const bSeed = getSpotlightRotationHash(
            `${fastBucket}:${slowBucket}:${b.tokenMint}:${Math.round(getSpotlightValuation(b))}:${Math.round(b.volume24hUsd ?? 0)}:${b.symbol ?? ""}:${b.txCount24h ?? 0}`
        );

        if (aSeed !== bSeed) {
            return bSeed - aSeed;
        }

        return compareSpotlightTokens(a, b);
    });
}

async function fetchSpotlightBoard(): Promise<NormalizedToken[]> {
    const curatedMints = [...CURATED_SPOTLIGHT_ORDER];
    const alphaFeedPromise = import("@/lib/alpha/engine")
        .then(({ generateAlphaFeed }) => generateAlphaFeed())
        .catch((error) => {
            console.error("[sync] spotlight alpha feed error:", error);
            return null;
        });

    try {
        const coldStart = !spotlightCache?.tokens.length &&
            !trendingCache?.tokens.length &&
            !allPoolsCache?.pools.length;
        const trendingTimeout = coldStart ? 12_000 : 4_000;
        const poolsTimeout = coldStart ? 10_000 : 3_500;
        const newLaunchTimeout = coldStart ? 4_000 : 2_500;
        const leaderboardTimeout = coldStart ? 5_000 : 3_500;
        const alphaTimeout = coldStart ? 6_000 : 4_500;
        const dexEnrichmentTimeout = coldStart ? 3_500 : 2_500;

        const [trending, pools] = await Promise.all([
            withTimeoutFallback(
                syncTrendingTokens(),
                trendingTimeout,
                trendingCache?.tokens ?? [],
                "spotlight trending"
            ),
            withTimeoutFallback(
                getAllPools(),
                poolsTimeout,
                allPoolsCache?.pools ?? [],
                "spotlight pools"
            ),
        ]);

        const [newLaunches, leaderboard, alphaFeed] = await Promise.all([
            withTimeoutFallback(
                syncNewLaunches(),
                newLaunchTimeout,
                newLaunchCache?.tokens ?? [],
                "spotlight new launches"
            ),
            withTimeoutFallback(
                syncLeaderboard(),
                leaderboardTimeout,
                leaderboardCache?.entries ?? [],
                "spotlight leaderboard"
            ),
            withTimeoutFallback(alphaFeedPromise, alphaTimeout, null, "spotlight alpha"),
        ]);

        const candidates = new Map<string, { token: NormalizedToken; sources: Set<string> }>();
        const leaderboardByMint = new Map(
            leaderboard.map((entry, index) => [
                entry.tokenMint,
                { entry, rank: index + 1 },
            ])
        );

        const addCandidate = (token: NormalizedToken, source: string) => {
            if (!token.tokenMint || !CURATED_SPOTLIGHT_SET.has(token.tokenMint)) return;

            const existing = candidates.get(token.tokenMint);
            if (!existing) {
                candidates.set(token.tokenMint, {
                    token: { ...token },
                    sources: new Set([source]),
                });
                return;
            }

            existing.token = mergeSpotlightTokens(existing.token, token);
            existing.sources.add(source);
        };

        const alphaTokens = alphaFeed?.tokens ?? [];

        trending.slice(0, 72).forEach((token) => addCandidate(token, "TRENDING"));
        leaderboard.slice(0, 36).forEach((entry) => addCandidate(mapLeaderboardEntryToToken(entry), "LEADERBOARD"));
        alphaTokens.slice(0, 48).forEach((token) => addCandidate(mapAlphaTokenToSpotlightToken(token), "ALPHA"));
        newLaunches.slice(0, 24).forEach((token) => addCandidate(token, "NEW LAUNCH"));

        const poolSeedEntries = pools
            .filter((entry) => CURATED_SPOTLIGHT_SET.has(entry.tokenMint))
            .sort(
                (a, b) =>
                    CURATED_SPOTLIGHT_ORDER.indexOf(a.tokenMint as (typeof CURATED_SPOTLIGHT_ORDER)[number]) -
                    CURATED_SPOTLIGHT_ORDER.indexOf(b.tokenMint as (typeof CURATED_SPOTLIGHT_ORDER)[number])
            );

        poolSeedEntries.forEach((entry) => addCandidate(mapPoolEntryToToken(entry), "POOL INDEX"));

        const metadataMap = await withTimeoutFallback(
            getTokenMetadataBatch(curatedMints),
            4_000,
            new Map<string, TokenMetadata>(),
            "spotlight metadata"
        );

        curatedMints.forEach((mint) => {
            const meta = metadataMap.get(mint);
            if (!meta) {
                return;
            }

            addCandidate(
                {
                    tokenMint: mint,
                    name: meta.name,
                    symbol: meta.symbol,
                },
                "CURATED"
            );
        });

        const heliusImageFallbackMints = curatedMints.filter((mint) => {
            const candidateImage = candidates.get(mint)?.token.image;
            return !candidateImage;
        });

        const heliusImageFallbacks = await withTimeoutFallback(
            Promise.all(
                heliusImageFallbackMints.map(async (mint) => ({
                    mint,
                    asset: await getHeliusAsset(mint),
                }))
            ),
            5_000,
            [] as Array<{ mint: string; asset: Awaited<ReturnType<typeof getHeliusAsset>> }>,
            "spotlight helius assets"
        );

        heliusImageFallbacks.forEach(({ mint, asset }) => {
            if (!asset) {
                return;
            }

            const heliusImage =
                asset.content?.links?.image ??
                asset.content?.files?.find((file) => typeof file?.cdn_uri === "string")?.cdn_uri ??
                asset.content?.files?.find((file) => typeof file?.uri === "string")?.uri;

            if (!heliusImage) {
                return;
            }

            addCandidate(
                {
                    tokenMint: mint,
                    name: asset.content?.metadata?.name,
                    symbol: asset.content?.metadata?.symbol,
                    image: heliusImage,
                },
                "CURATED"
            );
        });

        const curatedCreatorData = await withTimeoutFallback(
            Promise.all(
                curatedMints.map(async (mint) => ({
                    mint,
                    creators: await getCreatorsV3(mint),
                    feesLamports: await getLifetimeFees(mint),
                }))
            ),
            6_000,
            [] as Array<{ mint: string; creators: Awaited<ReturnType<typeof getCreatorsV3>>; feesLamports: string | null }>,
            "spotlight creator enrichment"
        );

        curatedCreatorData.forEach(({ mint, creators, feesLamports }) => {
            let enriched: NormalizedToken = { tokenMint: mint };
            if (creators.length > 0) {
                enriched = mergeCreatorsV3(enriched, creators);
            }
            if (feesLamports) {
                const feesSol = Number(feesLamports) / 1e9;
                if (Number.isFinite(feesSol)) {
                    enriched.lifetimeFeesLamports = feesLamports;
                    enriched.lifetimeFeesSol = feesSol;
                }
            }

            addCandidate(enriched, "CURATED");
        });

        const hackathonFollowerFallbacks = await withTimeoutFallback(
            syncHackathonApps(),
            5_000,
            [],
            "spotlight hackathon enrichment"
        );

        hackathonFollowerFallbacks
            .filter((app) => app.tokenAddress && CURATED_SPOTLIGHT_SET.has(app.tokenAddress))
            .forEach((app) => {
                addCandidate(
                    {
                        tokenMint: app.tokenAddress,
                        twitter: app.twitterUrl,
                        projectTwitterHandle: app.twitterHandle,
                    },
                    "CURATED"
                );
            });

        if (isXquikConfigured()) {
            const followerEnrichment = await withTimeoutFallback(
                Promise.all(
                    curatedMints.map(async (mint) => {
                        const candidate = candidates.get(mint)?.token;
                        const twitterHandle =
                            candidate?.twitterUsername ??
                            (candidate?.provider === "twitter" ? candidate.providerUsername : undefined);

                        if (!twitterHandle) {
                            return { mint, user: null };
                        }

                        return {
                            mint,
                            user: await getXUserCached(twitterHandle),
                        };
                    })
                ),
                5_000,
                [] as Array<{ mint: string; user: Awaited<ReturnType<typeof getXUserCached>> }>,
                "spotlight x profile enrichment"
            );

            followerEnrichment.forEach(({ mint, user }) => {
                if (!user) {
                    return;
                }

                addCandidate(
                    {
                        tokenMint: mint,
                        creatorFollowers: user.followers,
                        creatorPfp: user.profilePicture,
                    },
                    "CURATED"
                );
            });

            const projectFollowerEnrichment = await withTimeoutFallback(
                Promise.all(
                    curatedMints.map(async (mint) => {
                        const candidate = candidates.get(mint)?.token;
                        const projectTwitterHandle =
                            candidate?.projectTwitterHandle ??
                            candidate?.twitter
                                ?.replace(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//i, "")
                                .replace(/^@+/, "")
                                .split(/[/?#]/)[0]
                                .trim();

                        if (!projectTwitterHandle) {
                            return { mint, user: null };
                        }

                        return {
                            mint,
                            user: await getXUserCached(projectTwitterHandle),
                        };
                    })
                ),
                5_000,
                [] as Array<{ mint: string; user: Awaited<ReturnType<typeof getXUserCached>> }>,
                "spotlight project x enrichment"
            );

            projectFollowerEnrichment.forEach(({ mint, user }) => {
                if (!user) {
                    return;
                }

                addCandidate(
                    {
                        tokenMint: mint,
                        projectTwitterFollowers: user.followers,
                    },
                    "CURATED"
                );
            });
        }

        const poolSeedMintsToEnrich = curatedMints.filter((mint) => {
            const candidate = candidates.get(mint)?.token;
            return (
                !candidate ||
                candidate.txCount24h === undefined ||
                candidate.priceChange24h === undefined ||
                candidate.volume24hUsd === undefined ||
                candidate.name === undefined
            );
        });

        const enrichedPoolTokens = await withTimeoutFallback(
            fetchSpotlightDexPairs(poolSeedMintsToEnrich),
            dexEnrichmentTimeout,
            [],
            "spotlight dex enrichment"
        );
        enrichedPoolTokens.forEach((token) => addCandidate(token, "POOL INDEX"));

        const curatedCandidates = curatedMints
            .map((mint) => {
                const candidate = candidates.get(mint);
                if (!candidate) {
                    return null;
                }

                const { token, sources } = candidate;
                const leaderboardData = leaderboardByMint.get(token.tokenMint);
                const earnedUsd = leaderboardData?.entry.earnedUsd ?? token.lifetimeFees ?? 0;
                const reasons = buildSpotlightReasons(token, earnedUsd, sources.size);

                return {
                    ...token,
                    lifetimeFees: pickDefined(token.lifetimeFees, earnedUsd),
                    spotlightReasons: reasons.length > 0 ? reasons : ["Curated spotlight"],
                    spotlightSources: sources.size > 0 ? [...sources] : ["CURATED"],
                    spotlightAgeLabel: formatSpotlightAgeLabel(hoursSince(token.pairCreatedAt)),
                } satisfies NormalizedToken;
            })
            .filter((token) => token !== null) as NormalizedToken[];

        const rankedByMint = new Map(curatedCandidates.map((token) => [token.tokenMint, token]));
        const finalSpotlight = sortRotatingSpotlightTokens(
            curatedMints
                .map((mint) => rankedByMint.get(mint))
                .filter((token): token is NormalizedToken => Boolean(token))
        );

        for (const token of finalSpotlight) {
            metadataCache.set(token.tokenMint, token);
        }

        if (finalSpotlight.length > 0) {
            spotlightCache = { tokens: finalSpotlight, ts: Date.now() };
        }

        return finalSpotlight.length > 0 ? finalSpotlight : spotlightCache?.tokens ?? [];
    } catch (error) {
        console.error("[sync] spotlight error:", error);
        return spotlightCache?.tokens ?? [];
    }
}

export async function syncSpotlightTokens(): Promise<NormalizedToken[]> {
    const age = spotlightCache ? Date.now() - spotlightCache.ts : Infinity;

    if (age < SPOTLIGHT_TTL && spotlightCache && spotlightCache.tokens.length > 0) {
        return spotlightCache.tokens;
    }

    if (age < SPOTLIGHT_STALE_TTL && spotlightCache && spotlightCache.tokens.length > 0) {
        if (!spotlightRevalidationPromise) {
            spotlightRevalidationPromise = fetchSpotlightBoard()
                .catch((error) => {
                    console.error("[sync] spotlight bg-revalidate error:", error);
                    return spotlightCache?.tokens ?? [];
                })
                .finally(() => {
                    spotlightRevalidationPromise = null;
                });
        }
        return spotlightCache.tokens;
    }

    if (!spotlightRevalidationPromise) {
        spotlightRevalidationPromise = fetchSpotlightBoard()
            .catch((error) => {
                console.error("[sync] spotlight refresh error:", error);
                return spotlightCache?.tokens ?? [];
            })
            .finally(() => {
                spotlightRevalidationPromise = null;
            });
    }

    return await spotlightRevalidationPromise;
}

async function fetchSpotlightDexPairs(mints: string[]) {
    if (mints.length === 0) {
        return [];
    }

    const batches: Array<Promise<DexPair[]>> = [];
    for (let index = 0; index < mints.length; index += 30) {
        batches.push(getDexScreenerPairs(mints.slice(index, index + 30)));
    }

    const results = await Promise.allSettled(batches);
    return results
        .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
        .filter(hasDexBaseAddress)
        .map(dexPairToToken);
}

function dexPairToToken(
    p: DexPair & { baseToken: DexPair["baseToken"] & { address: string } }
): NormalizedToken {
    return {
        tokenMint: p.baseToken.address,
        poolAddress: typeof p.pairAddress === "string" ? p.pairAddress : undefined,
        pairAddress: typeof p.pairAddress === "string" ? p.pairAddress : undefined,
        name: p.baseToken.name,
        symbol: p.baseToken.symbol,
        image: p.info?.imageUrl,
        dexId: typeof p.dexId === "string" ? p.dexId : undefined,
        priceUsd: Number(p.priceUsd) || undefined,
        fdvUsd: Number(p.fdv) || undefined,
        marketCap: undefined,
        liquidityUsd: Number(p.liquidity?.usd) || undefined,
        volume24hUsd: Number(p.volume?.h24) || undefined,
        priceChange24h: Number(p.priceChange?.h24) || undefined,
        txCount24h:
            ((Number(p.txns?.h24?.buys) || 0) + (Number(p.txns?.h24?.sells) || 0)) || undefined,
        buyCount24h: Number(p.txns?.h24?.buys) || undefined,
        sellCount24h: Number(p.txns?.h24?.sells) || undefined,
        website: getDexWebsite(p),
        pairCreatedAt: p.pairCreatedAt ? new Date(p.pairCreatedAt).toISOString() : undefined,
    };
}

async function fetchNewLaunchesFromDex(): Promise<NormalizedToken[]> {
    const [dexPairs, pools] = await Promise.all([
        getDexScreenerNewBagsPairs(),
        getAllPools().catch(() => [] as PoolEntry[]),
    ]);
    if (dexPairs.length === 0) throw new Error("DexScreener returned 0 new launches");
    const poolMap = new Map(pools.map((pool) => [pool.tokenMint, pool]));

    const tokens: NormalizedToken[] = dexPairs
        .filter(hasDexBaseAddress)
        .map((pair) => mergeBagsPoolMarketData(dexPairToToken(pair), poolMap.get(pair.baseToken.address)));

    for (const t of tokens) {
        if (t.name) metadataCache.set(t.tokenMint, t);
    }

    newLaunchCache = { tokens, ts: Date.now() };
    return tokens;
}

export async function syncNewLaunches(): Promise<NormalizedToken[]> {
    const age = newLaunchCache ? Date.now() - newLaunchCache.ts : Infinity;

    if (age < NEW_LAUNCH_TTL) {
        return newLaunchCache!.tokens;
    }

    if (age < NEW_LAUNCH_STALE_TTL && newLaunchCache && newLaunchCache.tokens.length > 0) {
        if (!newLaunchRevalidating) {
            newLaunchRevalidating = true;
            fetchNewLaunchesFromDex()
                .catch((e) => console.error("[sync] new launches bg-revalidate error:", e))
                .finally(() => { newLaunchRevalidating = false; });
        }
        return newLaunchCache.tokens;
    }

    try {
        return await fetchNewLaunchesFromDex();
    } catch (e) {
        console.error("[sync] new launches error:", e);
        return newLaunchCache?.tokens ?? [];
    }
}

// ═══════════════════════════════════════════════
// SEARCH – Query all 167K+ tokens
// ═══════════════════════════════════════════════

export async function searchAllTokens(
    query: string,
    limit: number = 50
): Promise<NormalizedToken[]> {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const pools = await getAllPools();

    const mintMatches = pools.filter((p) =>
        p.tokenMint.toLowerCase().includes(q)
    );

    const cachedMatches: NormalizedToken[] = [];
    for (const [, token] of metadataCache) {
        if (
            token.name?.toLowerCase().includes(q) ||
            token.symbol?.toLowerCase().includes(q) ||
            token.tokenMint.toLowerCase().includes(q) ||
            token.creatorDisplay?.toLowerCase().includes(q) ||
            token.providerUsername?.toLowerCase().includes(q)
        ) {
            cachedMatches.push(token);
        }
    }

    const seen = new Set<string>(cachedMatches.map((t) => t.tokenMint));
    const poolOnlyMatches: NormalizedToken[] = mintMatches
        .filter((p) => !seen.has(p.tokenMint))
        .slice(0, limit)
        .map((p) => ({
            tokenMint: p.tokenMint,
            dbcConfigKey: p.dbcConfigKey,
            dbcPoolKey: p.dbcPoolKey,
            dammV2PoolKey: p.dammV2PoolKey,
            isMigrated: !!p.dammV2PoolKey,
        }));

    const combined = [...cachedMatches, ...poolOnlyMatches];

    const needsMeta = combined
        .filter((t) => !t.name)
        .map((t) => t.tokenMint)
        .slice(0, 50);

    if (needsMeta.length > 0) {
        const metaMap = await getTokenMetadataBatch(needsMeta);
        const imageUris = new Map<string, string>();
        for (const [mint, meta] of metaMap) {
            if (meta.uri?.startsWith("http")) imageUris.set(mint, meta.uri);
        }
        const images = await fetchMetadataImages(imageUris);

        for (const token of combined) {
            if (token.name) continue;
            const meta = metaMap.get(token.tokenMint);
            if (meta) {
                token.name = meta.name || undefined;
                token.symbol = meta.symbol || undefined;
                token.image = images.get(token.tokenMint) || undefined;
                if (token.name) metadataCache.set(token.tokenMint, token);
            }
        }
    }

    return combined.slice(0, limit);
}

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════

async function fetchMetadataImages(
    uris: Map<string, string>
): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const entries = [...uris.entries()].slice(0, 100);

    const CONCURRENCY = 20;
    for (let i = 0; i < entries.length; i += CONCURRENCY) {
        const batch = entries.slice(i, i + CONCURRENCY);
        await Promise.allSettled(
            batch.map(async ([mint, uri]) => {
                try {
                    const res = await fetch(uri, {
                        signal: AbortSignal.timeout(4000),
                        cache: "no-store",
                    });
                    if (!res.ok) return;
                    const json = await res.json();
                    const img = json.image || json.imageUrl;
                    if (img && typeof img === "string") result.set(mint, img);
                } catch {}
            })
        );
    }
    return result;
}

/** Total pools count for stats. */
export async function getTotalPoolCount(): Promise<number> {
    const pools = await getAllPools();
    return pools.length;
}

// ═══════════════════════════════════════════════
// HACKATHON APPS – Bags App Store projects
// ═══════════════════════════════════════════════

export interface EnrichedHackathonApp {
    uuid: string;
    name: string;
    description: string;
    category: string;
    categories?: string[];
    status?: string;
    icon: string;
    tokenAddress: string;
    duplicateCount?: number;
    twitterUrl?: string;
    upvotes?: number;
    downvotes?: number;
    voteScore?: number;
    twitterHandle?: string;
    twitterFollowers?: number;
    priceUsd?: number;
    marketCap?: number;
    fdvUsd?: number;
    volume24hUsd?: number;
    priceChange24h?: number;
    liquidityUsd?: number;
    symbol?: string;
}

export type HackathonLeaderboardMode = "votes" | "market";

export interface HackathonLeaderboardEntry extends EnrichedHackathonApp {
    leaderboardMode: HackathonLeaderboardMode;
}

let hackathonCache: {
    apps: EnrichedHackathonApp[];
    ts: number;
    totalItems: number;
    acceptedOverall: number;
} | null = null;
const HACKATHON_TTL = 5 * 60_000;

function normalizeHackathonStatus(status?: string | null) {
    return (status ?? "").trim().toLowerCase() === "accepted" ? "accepted" : "in review";
}

function getHackathonTwitterHandle(app: {
    twitterUrl?: string;
    twitterUser?: { username?: string | null } | null;
}) {
    const handleFromUrl = app.twitterUrl
        ?.replace(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//i, "")
        .replace(/^@/, "")
        .split(/[/?#]/)[0]
        .trim();

    if (handleFromUrl) {
        return handleFromUrl;
    }

    return app.twitterUser?.username ?? undefined;
}

function normalizeHackathonProjectName(name?: string | null) {
    return (name ?? "")
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .filter((part) => !["the", "its", "app", "on", "bags", "fm"].includes(part))
        .join("");
}

function getHackathonIdentityKey(app: {
    uuid: string;
    name?: string | null;
    tokenAddress?: string | null;
    twitterUrl?: string;
    twitterUser?: { username?: string | null } | null;
}) {
    const normalizedName = normalizeHackathonProjectName(app.name);
    const twitterHandle = getHackathonTwitterHandle(app)?.toLowerCase();
    const tokenAddress =
        typeof app.tokenAddress === "string" &&
        app.tokenAddress.length > 0 &&
        app.tokenAddress !== "11111111111111111111111111111111"
            ? app.tokenAddress
            : undefined;

    if (tokenAddress) {
        return `token:${tokenAddress}`;
    }
    if (twitterHandle && normalizedName) {
        return `handle:${twitterHandle}:name:${normalizedName}`;
    }
    if (twitterHandle) {
        return `handle:${twitterHandle}`;
    }
    if (normalizedName) {
        return `name:${normalizedName}`;
    }
    return `uuid:${app.uuid}`;
}

function scoreHackathonProjectRecord(app: {
    status?: string | null;
    upvotes?: number | null;
    downvotes?: number | null;
    tokenAddress?: string | null;
    description?: string | null;
    twitterUser?: { public_metrics?: { followers_count?: number | null } | null } | null;
}) {
    const acceptedScore = normalizeHackathonStatus(app.status) === "accepted" ? 1_000_000 : 0;
    const voteScore = ((app.upvotes ?? 0) - (app.downvotes ?? 0)) * 1_000;
    const upvoteScore = (app.upvotes ?? 0) * 10;
    const tokenScore = app.tokenAddress ? 500 : 0;
    const descriptionScore = Math.min((app.description?.length ?? 0), 400);
    const followerScore = Math.min(app.twitterUser?.public_metrics?.followers_count ?? 0, 50_000) / 10;

    return acceptedScore + voteScore + upvoteScore + tokenScore + descriptionScore + followerScore;
}

function dedupeHackathonApplications(apps: Array<{
    uuid: string;
    name: string;
    description: string;
    category: string;
    status?: string;
    icon: string;
    tokenAddress: string;
    twitterUrl?: string;
    upvotes?: number;
    downvotes?: number;
    twitterUser?: {
        username?: string;
        name?: string;
        verified?: boolean;
        verified_type?: string;
        public_metrics?: {
            followers_count?: number;
            tweet_count?: number;
        };
    } | null;
}>) {
    const grouped = new Map<string, typeof apps>();

    for (const app of apps) {
        const key = getHackathonIdentityKey(app);
        const existing = grouped.get(key);
        if (existing) {
            existing.push(app);
        } else {
            grouped.set(key, [app]);
        }
    }

    return [...grouped.values()].map((group) => {
        const primary = [...group].sort((a, b) => scoreHackathonProjectRecord(b) - scoreHackathonProjectRecord(a))[0];
        const categories = [...new Set(group.map((entry) => entry.category).filter(Boolean))];
        const twitterHandle = getHackathonTwitterHandle(primary)?.toLowerCase();

        return {
            ...primary,
            category: primary.category,
            categories,
            duplicateCount: group.length,
            status: group.some((entry) => normalizeHackathonStatus(entry.status) === "accepted")
                ? "accepted"
                : primary.status,
            upvotes: group.reduce((sum, entry) => sum + (entry.upvotes ?? 0), 0),
            downvotes: group.reduce((sum, entry) => sum + (entry.downvotes ?? 0), 0),
            twitterUrl: primary.twitterUrl,
            twitterHandle,
            twitterFollowers: Math.max(...group.map((entry) => entry.twitterUser?.public_metrics?.followers_count ?? 0)),
        };
    });
}

function getEnrichedHackathonIdentityKey(app: EnrichedHackathonApp) {
    const tokenAddress =
        typeof app.tokenAddress === "string" &&
        app.tokenAddress.length > 0 &&
        app.tokenAddress !== "11111111111111111111111111111111"
            ? app.tokenAddress
            : undefined;
    const normalizedName = normalizeHackathonProjectName(app.name);
    const twitterHandle = (app.twitterHandle ?? getHackathonTwitterHandle(app)?.toLowerCase()) || undefined;

    if (tokenAddress) {
        return `token:${tokenAddress}`;
    }
    if (twitterHandle && normalizedName) {
        return `handle:${twitterHandle}:name:${normalizedName}`;
    }
    if (twitterHandle) {
        return `handle:${twitterHandle}`;
    }
    if (normalizedName) {
        return `name:${normalizedName}`;
    }
    return `uuid:${app.uuid}`;
}

function scoreEnrichedHackathonProjectRecord(app: EnrichedHackathonApp) {
    const acceptedScore = normalizeHackathonStatus(app.status) === "accepted" ? 1_000_000 : 0;
    const liveTokenScore = app.tokenAddress ? 500_000 : 0;
    const volumeScore = Math.min(app.volume24hUsd ?? 0, 2_000_000) / 10;
    const marketCapScore = Math.min(app.marketCap ?? 0, 50_000_000) / 100;
    const voteScore = (app.voteScore ?? ((app.upvotes ?? 0) - (app.downvotes ?? 0))) * 100;
    const followerScore = Math.min(app.twitterFollowers ?? 0, 100_000) / 10;
    const completenessScore = Math.min(app.description?.length ?? 0, 500);

    return acceptedScore + liveTokenScore + volumeScore + marketCapScore + voteScore + followerScore + completenessScore;
}

function dedupeEnrichedHackathonApps(apps: EnrichedHackathonApp[]) {
    const grouped = new Map<string, EnrichedHackathonApp[]>();

    for (const app of apps) {
        const key = getEnrichedHackathonIdentityKey(app);
        const existing = grouped.get(key);
        if (existing) {
            existing.push(app);
        } else {
            grouped.set(key, [app]);
        }
    }

    return [...grouped.values()].map((group) => {
        const primary = [...group].sort((a, b) => scoreEnrichedHackathonProjectRecord(b) - scoreEnrichedHackathonProjectRecord(a))[0];
        const categories = [...new Set(
            group.flatMap((entry) => (entry.categories && entry.categories.length > 0 ? entry.categories : [entry.category])).filter(Boolean)
        )];
        const upvotes = group.reduce((sum, entry) => sum + (entry.upvotes ?? 0), 0);
        const downvotes = group.reduce((sum, entry) => sum + (entry.downvotes ?? 0), 0);

        return {
            ...primary,
            category: primary.category || categories[0] || "Other",
            categories,
            duplicateCount: group.reduce((sum, entry) => sum + Math.max(1, entry.duplicateCount ?? 1), 0),
            status: group.some((entry) => normalizeHackathonStatus(entry.status) === "accepted") ? "accepted" : primary.status,
            upvotes,
            downvotes,
            voteScore: upvotes - downvotes,
            twitterHandle: primary.twitterHandle ?? group.map((entry) => entry.twitterHandle).find(Boolean),
            twitterFollowers: Math.max(...group.map((entry) => entry.twitterFollowers ?? 0)),
            priceUsd: primary.priceUsd ?? group.map((entry) => entry.priceUsd).find((value) => value !== undefined),
            marketCap: primary.marketCap ?? group.map((entry) => entry.marketCap).find((value) => value !== undefined),
            fdvUsd: primary.fdvUsd ?? group.map((entry) => entry.fdvUsd).find((value) => value !== undefined),
            volume24hUsd: primary.volume24hUsd ?? group.map((entry) => entry.volume24hUsd).find((value) => value !== undefined),
            priceChange24h: primary.priceChange24h ?? group.map((entry) => entry.priceChange24h).find((value) => value !== undefined),
            liquidityUsd: primary.liquidityUsd ?? group.map((entry) => entry.liquidityUsd).find((value) => value !== undefined),
            symbol: primary.symbol ?? group.map((entry) => entry.symbol).find(Boolean),
            twitterUrl: primary.twitterUrl ?? group.map((entry) => entry.twitterUrl).find(Boolean),
        } satisfies EnrichedHackathonApp;
    });
}

export async function getHackathonFeedMeta() {
    if (!hackathonCache || !hackathonCache.totalItems || Date.now() - hackathonCache.ts >= HACKATHON_TTL) {
        await syncHackathonApps();
    }

    return {
        totalItems: hackathonCache?.totalItems ?? 0,
        acceptedOverall: hackathonCache?.acceptedOverall ?? 0,
    };
}

function compareHackathonVoteEntries(a: EnrichedHackathonApp, b: EnrichedHackathonApp) {
    const scoreDiff = (b.voteScore ?? 0) - (a.voteScore ?? 0);
    if (scoreDiff !== 0) return scoreDiff;

    const upvoteDiff = (b.upvotes ?? 0) - (a.upvotes ?? 0);
    if (upvoteDiff !== 0) return upvoteDiff;

    const acceptedDiff = Number(normalizeHackathonStatus(b.status) === "accepted") - Number(normalizeHackathonStatus(a.status) === "accepted");
    if (acceptedDiff !== 0) return acceptedDiff;

    const tokenDiff = Number(Boolean(b.tokenAddress)) - Number(Boolean(a.tokenAddress));
    if (tokenDiff !== 0) return tokenDiff;

    const followerDiff = (b.twitterFollowers ?? 0) - (a.twitterFollowers ?? 0);
    if (followerDiff !== 0) return followerDiff;

    return a.name.localeCompare(b.name);
}

function compareHackathonMarketEntries(a: EnrichedHackathonApp, b: EnrichedHackathonApp) {
    const acceptedDiff = Number(normalizeHackathonStatus(b.status) === "accepted") - Number(normalizeHackathonStatus(a.status) === "accepted");
    if (acceptedDiff !== 0) return acceptedDiff;

    const liveTokenDiff = Number(Boolean(b.tokenAddress)) - Number(Boolean(a.tokenAddress));
    if (liveTokenDiff !== 0) return liveTokenDiff;

    const volumeDiff = (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0);
    if (volumeDiff !== 0) return volumeDiff;

    const marketCapDiff = (b.marketCap ?? 0) - (a.marketCap ?? 0);
    if (marketCapDiff !== 0) return marketCapDiff;

    const scoreDiff = (b.voteScore ?? 0) - (a.voteScore ?? 0);
    if (scoreDiff !== 0) return scoreDiff;

    return a.name.localeCompare(b.name);
}

export async function syncHackathonApps(): Promise<EnrichedHackathonApp[]> {
    if (hackathonCache && Date.now() - hackathonCache.ts < HACKATHON_TTL) {
        const uniqueApps = dedupeEnrichedHackathonApps(hackathonCache.apps);
        hackathonCache.apps = uniqueApps;
        return uniqueApps;
    }

    try {
        type HackathonDexPair = Awaited<ReturnType<typeof getDexScreenerPairs>>[number];
        const firstPage = await getHackathonApps(1);
        const remainingPages = await Promise.all(
            Array.from(
                { length: Math.max(0, firstPage.totalPages - 1) },
                (_, index) => getHackathonApps(index + 2)
            )
        );

        const rawFeedApps = [firstPage, ...remainingPages].flatMap((page) => page.applications);
        const totalItems = firstPage.totalItems || rawFeedApps.length;
        const acceptedOverall = rawFeedApps.filter((app) => normalizeHackathonStatus(app.status) === "accepted").length;

        const rawApps = Array.from(
            new Map(
                rawFeedApps.map((app) => [app.uuid, app])
            ).values()
        );
        const dedupedApps = dedupeHackathonApplications(rawApps);
        const pools = await getAllPools().catch(() => [] as PoolEntry[]);
        const poolMap = new Map(pools.map((pool) => [pool.tokenMint, pool]));

        const mints = dedupedApps.map((a) => a.tokenAddress).filter(Boolean);
        const dexBatches: Array<Promise<HackathonDexPair[]>> = [];
        for (let i = 0; i < mints.length; i += 30) {
            dexBatches.push(getDexScreenerPairs(mints.slice(i, i + 30)));
        }
        const dexResults = await Promise.all(dexBatches);
        const dexMap = new Map<string, HackathonDexPair>();
        for (const pairs of dexResults) {
            for (const p of pairs) {
                const addr = p.baseToken?.address;
                if (addr) dexMap.set(addr, p);
            }
        }

        const enriched: EnrichedHackathonApp[] = dedupedApps.map((app) => {
            const dex = dexMap.get(app.tokenAddress);
            const pool = poolMap.get(app.tokenAddress);
            const upvotes = app.upvotes ?? 0;
            const downvotes = app.downvotes ?? 0;
            return {
                uuid: app.uuid,
                name: app.name,
                description: app.description,
                category: app.category,
                categories: app.categories,
                status: app.status,
                icon: app.icon,
                tokenAddress: app.tokenAddress,
                duplicateCount: app.duplicateCount,
                twitterUrl: app.twitterUrl,
                upvotes,
                downvotes,
                voteScore: upvotes - downvotes,
                twitterHandle: app.twitterHandle,
                twitterFollowers: app.twitterFollowers,
                symbol: pool?.symbol ?? dex?.baseToken?.symbol,
                priceUsd: (pool?.priceUsd ?? Number(dex?.priceUsd)) || undefined,
                marketCap: pool?.marketCap,
                fdvUsd: (pool?.fdvUsd ?? Number(dex?.fdv)) || undefined,
                volume24hUsd: (pool?.volume24hUsd ?? Number(dex?.volume?.h24)) || undefined,
                priceChange24h: Number(dex?.priceChange?.h24) || undefined,
                liquidityUsd: (pool?.liquidityUsd ?? Number(dex?.liquidity?.usd)) || undefined,
            };
        });

        const uniqueApps = dedupeEnrichedHackathonApps(enriched);
        hackathonCache = {
            apps: uniqueApps,
            ts: Date.now(),
            totalItems,
            acceptedOverall,
        };
        return uniqueApps;
    } catch (e) {
        console.error("[sync] hackathon error:", e);
        return hackathonCache?.apps ?? [];
    }
}

export async function syncHackathonLeaderboard(
    mode: HackathonLeaderboardMode = "votes"
): Promise<HackathonLeaderboardEntry[]> {
    const apps = await syncHackathonApps();
    const sorted = [...apps].sort(
        mode === "votes" ? compareHackathonVoteEntries : compareHackathonMarketEntries
    );

    return sorted.slice(0, 100).map((app) => ({
        ...app,
        leaderboardMode: mode,
    }));
}

// ═══════════════════════════════════════════════
// TOKEN DETAIL (unchanged)
// ═══════════════════════════════════════════════

export async function syncTokenDetail(
    tokenMint: string
): Promise<NormalizedToken | null> {
    const poolInfo = await getBagsPoolInfo(tokenMint);

    let token: NormalizedToken = poolInfo
        ? normalizePoolInfo(poolInfo)
        : { tokenMint };

    const solPrice = await getSolPriceUsd();

    const [
        creators,
        feesLamports,
        claimStats,
        dexPairs,
        heliusAsset,
        holderCount,
        metadataMap,
        poolEntry,
    ] = await Promise.all([
        getCreatorsV3(tokenMint),
        getLifetimeFees(tokenMint),
        getClaimStatsDetailed(tokenMint),
        getDexScreenerPairs([tokenMint]),
        getHeliusAsset(tokenMint),
        getHeliusHolderCount(tokenMint),
        getTokenMetadataBatch([tokenMint]),
        getAllPools().then((pools) => pools.find((pool) => pool.tokenMint === tokenMint)).catch(() => undefined),
    ]);

    const onChainMeta = metadataMap.get(tokenMint);
    if (onChainMeta) {
        token.name = token.name || onChainMeta.name || undefined;
        token.symbol = token.symbol || onChainMeta.symbol || undefined;
        if (onChainMeta.uri?.startsWith("http")) {
            try {
                const uriRes = await fetch(onChainMeta.uri, {
                    signal: AbortSignal.timeout(5000),
                    cache: "no-store",
                });
                if (uriRes.ok) {
                    const uriJson = await uriRes.json();
                    token.image =
                        token.image || uriJson.image || uriJson.imageUrl;
                    token.description =
                        token.description || uriJson.description;
                }
            } catch {}
        }
    }

    token = mergeHeliusData(token, heliusAsset);
    token = mergeBagsPoolMarketData(token, poolEntry);
    token = mergeDexScreenerData(token, dexPairs);
    token = mergeCreatorsV3(token, creators);
    token = mergeLifetimeFees(token, feesLamports, solPrice);
    token = mergeClaimStatsV3(token, claimStats, solPrice);

    if (holderCount !== null) token.holderCount = holderCount;
    if (!token.name && !token.symbol && !poolInfo) return null;

    metadataCache.set(tokenMint, token);

    try {
        await prisma.tokenSnapshot.create({
            data: {
                tokenMint: token.tokenMint,
                poolAddress: token.poolAddress ?? token.dbcPoolKey,
                name: token.name,
                symbol: token.symbol,
                image: token.image,
                creatorWallet: token.creatorWallet,
                creatorDisplay: token.creatorDisplay,
                provider: token.provider,
                providerUser: token.providerUsername,
                fdvUsd: token.fdvUsd,
                priceUsd: token.priceUsd,
                liquidityUsd: token.liquidityUsd,
                volume24hUsd: token.volume24hUsd,
                lifetimeFees: token.lifetimeFees,
                claimCount: token.claimCount,
                claimVolume: token.claimVolume,
                rawJson: JSON.stringify(token.raw),
            },
        });
    } catch (e) {
        console.error("[sync] snapshot error:", e);
    }

    try {
        await prisma.tokenRegistry.upsert({
            where: { tokenMint },
            create: {
                tokenMint,
                poolAddress: token.poolAddress ?? token.dbcPoolKey,
                name: token.name,
                symbol: token.symbol,
                image: token.image,
                description: token.description,
                website: token.website,
                twitter: token.twitter,
                telegram: token.telegram,
                creatorWallet: token.creatorWallet,
                creatorDisplay: token.creatorDisplay,
                provider: token.provider,
                providerUser: token.providerUsername,
                launchSource: "bags",
                latestPriceUsd: token.priceUsd,
                latestFdvUsd: token.fdvUsd,
                latestLiquidityUsd: token.liquidityUsd,
                latestLifetimeFees: token.lifetimeFees,
                latestClaimCount: token.claimCount,
                rawJson: JSON.stringify(token.raw),
            },
            update: {
                poolAddress: token.poolAddress ?? token.dbcPoolKey,
                name: token.name,
                symbol: token.symbol,
                image: token.image,
                description: token.description,
                website: token.website,
                twitter: token.twitter,
                telegram: token.telegram,
                creatorWallet: token.creatorWallet,
                creatorDisplay: token.creatorDisplay,
                provider: token.provider,
                providerUser: token.providerUsername,
                latestPriceUsd: token.priceUsd,
                latestFdvUsd: token.fdvUsd,
                latestLiquidityUsd: token.liquidityUsd,
                latestLifetimeFees: token.lifetimeFees,
                latestClaimCount: token.claimCount,
                rawJson: JSON.stringify(token.raw),
            },
        });
    } catch (e) {
        console.error("[sync] registry error:", e);
    }

    return token;
}

export async function getTokenSnapshots(tokenMint: string) {
    try {
        return await prisma.tokenSnapshot.findMany({
            where: { tokenMint },
            orderBy: { capturedAt: "asc" },
            take: 200,
        });
    } catch (e) {
        console.error("[sync] getTokenSnapshots error:", e);
        return [];
    }
}
