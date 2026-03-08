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
import type { HackathonApp } from "@/lib/bags/client";
import {
    normalizePoolInfo,
    mergeCreatorsV3,
    mergeLifetimeFees,
    mergeClaimStatsV3,
    mergeDexScreenerData,
    mergeHeliusData,
} from "@/lib/bags/mappers";
import { getTokenMetadataBatch } from "@/lib/solana/metadata";
import type { NormalizedToken } from "@/lib/bags/types";

// ── Caches ───────────────────────────────────

interface PoolEntry {
    tokenMint: string;
    dbcConfigKey?: string;
    dbcPoolKey?: string;
    dammV2PoolKey?: string;
    name?: string;
    symbol?: string;
    image?: string;
    priceUsd?: number;
    fdvUsd?: number;
    liquidityUsd?: number;
    volume24hUsd?: number;
    creatorWallet?: string;
    creatorDisplay?: string;
}

let allPoolsCache: { pools: PoolEntry[]; ts: number } | null = null;
let trendingCache: { tokens: NormalizedToken[]; ts: number } | null = null;
let newLaunchCache: { tokens: NormalizedToken[]; ts: number } | null = null;
let metadataCache = new Map<string, NormalizedToken>();

const POOLS_TTL = 3 * 60_000;
const TRENDING_TTL = 60_000;
const NEW_LAUNCH_TTL = 20_000;

// ═══════════════════════════════════════════════
// Pool index (for search)
// ═══════════════════════════════════════════════

async function getAllPools(): Promise<PoolEntry[]> {
    if (allPoolsCache && Date.now() - allPoolsCache.ts < POOLS_TTL) {
        return allPoolsCache.pools;
    }
    try {
        const raw = await getBagsPools();
        const pools: PoolEntry[] = raw.map((p: any) => ({
            tokenMint: p.tokenMint,
            dbcConfigKey: p.dbcConfigKey,
            dbcPoolKey: p.dbcPoolKey,
            dammV2PoolKey: p.dammV2PoolKey,
            name: p.name,
            symbol: p.symbol,
            image: p.image,
            priceUsd: Number(p.tokenPriceUsd) || Number(p.priceUsd) || undefined,
            fdvUsd: Number(p.fdvUsd) || Number(p.fdv) || undefined,
            liquidityUsd: Number(p.liquidityUsd) || Number(p.liquidity) || undefined,
            volume24hUsd: Number(p.volume24hUsd) || Number(p.volume24h) || undefined,
            creatorWallet: p.creatorWallet,
            creatorDisplay: p.creatorDisplayName || p.creatorUsername,
        }));
        allPoolsCache = { pools, ts: Date.now() };
        return pools;
    } catch (e) {
        console.error("[sync] getAllPools error:", e);
        return allPoolsCache?.pools ?? [];
    }
}

// ═══════════════════════════════════════════════
// TRENDING – DexScreener pairs with real market data
// ═══════════════════════════════════════════════

export async function syncTrendingTokens(): Promise<NormalizedToken[]> {
    if (trendingCache && Date.now() - trendingCache.ts < TRENDING_TTL) {
        return trendingCache.tokens;
    }

    try {
        const pairs = await getDexScreenerSearch("bags");

        const tokens: NormalizedToken[] = pairs
            .filter((p: any) => p.baseToken?.address)
            .map((p: any): NormalizedToken => ({
                tokenMint: p.baseToken.address,
                poolAddress: p.pairAddress,
                name: p.baseToken.name,
                symbol: p.baseToken.symbol,
                image: p.info?.imageUrl,
                priceUsd: Number(p.priceUsd) || undefined,
                fdvUsd: Number(p.fdv) || undefined,
                marketCap: Number(p.marketCap) || undefined,
                liquidityUsd: Number(p.liquidity?.usd) || undefined,
                volume24hUsd: Number(p.volume?.h24) || undefined,
                pairAddress: p.pairAddress,
                dexId: p.dexId,
                priceChange24h: Number(p.priceChange?.h24) || undefined,
                txCount24h:
                    ((Number(p.txns?.h24?.buys) || 0) +
                        (Number(p.txns?.h24?.sells) || 0)) ||
                    undefined,
                buyCount24h: Number(p.txns?.h24?.buys) || undefined,
                sellCount24h: Number(p.txns?.h24?.sells) || undefined,
                website: p.info?.websites?.[0]?.url,
            }));

        for (const t of tokens) {
            metadataCache.set(t.tokenMint, t);
        }

        trendingCache = { tokens, ts: Date.now() };

        // Fire-and-forget DB upserts — never block the response
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

        let seedDexData = new Map<string, any>();
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
    const [poolCount, leaderboard, trending] = await Promise.all([
        getTotalPoolCount(),
        syncLeaderboard(),
        syncTrendingTokens(),
    ]);

    const totalCreatorEarnings = leaderboard.reduce((s, e) => s + e.earnedUsd, 0);
    const totalVolume = trending.reduce((s, t) => s + (t.volume24hUsd ?? 0), 0);

    return {
        totalProjects: poolCount,
        totalCreatorEarnings,
        totalVolume,
    };
}

// ═══════════════════════════════════════════════
// NEW LAUNCHES – Newest pools + on-chain metadata
// ═══════════════════════════════════════════════

function dexPairToToken(p: any): NormalizedToken {
    return {
        tokenMint: p.baseToken.address,
        poolAddress: p.pairAddress,
        pairAddress: p.pairAddress,
        name: p.baseToken.name,
        symbol: p.baseToken.symbol,
        image: p.info?.imageUrl,
        dexId: p.dexId,
        priceUsd: Number(p.priceUsd) || undefined,
        fdvUsd: Number(p.fdv) || undefined,
        marketCap: Number(p.marketCap) || undefined,
        liquidityUsd: Number(p.liquidity?.usd) || undefined,
        volume24hUsd: Number(p.volume?.h24) || undefined,
        priceChange24h: Number(p.priceChange?.h24) || undefined,
        txCount24h:
            ((Number(p.txns?.h24?.buys) || 0) + (Number(p.txns?.h24?.sells) || 0)) || undefined,
        buyCount24h: Number(p.txns?.h24?.buys) || undefined,
        sellCount24h: Number(p.txns?.h24?.sells) || undefined,
        website: p.info?.websites?.[0]?.url,
        pairCreatedAt: p.pairCreatedAt ? new Date(p.pairCreatedAt).toISOString() : undefined,
    };
}

export async function syncNewLaunches(): Promise<NormalizedToken[]> {
    if (newLaunchCache && Date.now() - newLaunchCache.ts < NEW_LAUNCH_TTL) {
        return newLaunchCache.tokens;
    }

    try {
        // DexScreener is the primary source — fast, reliable, has pairCreatedAt
        const dexPairs = await getDexScreenerNewBagsPairs();

        const tokens: NormalizedToken[] = dexPairs.map(dexPairToToken);

        for (const t of tokens) {
            if (t.name) metadataCache.set(t.tokenMint, t);
        }

        // Fire-and-forget: refresh pool index cache in background
        Promise.resolve().then(() => getAllPools().catch(() => {})).catch(() => {});

        newLaunchCache = { tokens, ts: Date.now() };
        return tokens;
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
    icon: string;
    tokenAddress: string;
    twitterUrl?: string;
    priceUsd?: number;
    fdvUsd?: number;
    volume24hUsd?: number;
    priceChange24h?: number;
    liquidityUsd?: number;
    symbol?: string;
}

let hackathonCache: { apps: EnrichedHackathonApp[]; ts: number } | null = null;
const HACKATHON_TTL = 5 * 60_000;

export async function syncHackathonApps(): Promise<EnrichedHackathonApp[]> {
    if (hackathonCache && Date.now() - hackathonCache.ts < HACKATHON_TTL) {
        return hackathonCache.apps;
    }

    try {
        const [page1, page2] = await Promise.all([
            getHackathonApps(1),
            getHackathonApps(2),
        ]);

        const allApps = [...page1.applications, ...page2.applications];

        const mints = allApps.map((a) => a.tokenAddress).filter(Boolean);
        const dexBatches: any[] = [];
        for (let i = 0; i < mints.length; i += 30) {
            dexBatches.push(getDexScreenerPairs(mints.slice(i, i + 30)));
        }
        const dexResults = await Promise.all(dexBatches);
        const dexMap = new Map<string, any>();
        for (const pairs of dexResults) {
            for (const p of pairs) {
                const addr = p.baseToken?.address;
                if (addr) dexMap.set(addr, p);
            }
        }

        const enriched: EnrichedHackathonApp[] = allApps.map((app) => {
            const dex = dexMap.get(app.tokenAddress);
            return {
                uuid: app.uuid,
                name: app.name,
                description: app.description,
                category: app.category,
                icon: app.icon,
                tokenAddress: app.tokenAddress,
                twitterUrl: app.twitterUrl,
                symbol: dex?.baseToken?.symbol,
                priceUsd: Number(dex?.priceUsd) || undefined,
                fdvUsd: Number(dex?.fdv) || undefined,
                volume24hUsd: Number(dex?.volume?.h24) || undefined,
                priceChange24h: Number(dex?.priceChange?.h24) || undefined,
                liquidityUsd: Number(dex?.liquidity?.usd) || undefined,
            };
        });

        hackathonCache = { apps: enriched, ts: Date.now() };
        return enriched;
    } catch (e) {
        console.error("[sync] hackathon error:", e);
        return hackathonCache?.apps ?? [];
    }
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
    ] = await Promise.all([
        getCreatorsV3(tokenMint),
        getLifetimeFees(tokenMint),
        getClaimStatsDetailed(tokenMint),
        getDexScreenerPairs([tokenMint]),
        getHeliusAsset(tokenMint),
        getHeliusHolderCount(tokenMint),
        getTokenMetadataBatch([tokenMint]),
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
