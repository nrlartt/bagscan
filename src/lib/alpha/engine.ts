import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
    getBagsPools,
    getCreatorsV3,
    getDexScreenerPairs,
    getDexScreenerSearch,
    getLifetimeFees,
    getSolPriceUsd,
} from "@/lib/bags/client";
import type { NormalizedToken } from "@/lib/bags/types";
import { syncTrendingTokens } from "@/lib/sync";
import {
    getRadarItems,
    getXUserCached,
    isXquikConfigured,
    searchCreatorTweets,
    searchTokenTweets,
} from "@/lib/xquik/client";
import type {
    AlphaFeedResponse,
    AlphaRiskLevel,
    AlphaSignal,
    AlphaSignalSeverity,
    AlphaToken,
    RadarTrend,
} from "./types";

interface DexPair {
    chainId?: string;
    pairAddress?: string;
    dexId?: string;
    pairCreatedAt?: number | null;
    priceUsd?: string | number | null;
    marketCap?: string | number | null;
    fdv?: string | number | null;
    volume?: { h24?: string | number | null };
    liquidity?: { usd?: string | number | null };
    priceChange?: { h24?: string | number | null };
    txns?: { h24?: { buys?: string | number | null; sells?: string | number | null } };
    info?: {
        imageUrl?: string;
    };
    baseToken?: {
        address?: string;
        name?: string;
        symbol?: string;
    };
}

let alphaCache: { data: AlphaFeedResponse; ts: number } | null = null;
let discoveryCache: { tokens: AlphaToken[]; ts: number } | null = null;

const ALPHA_TTL = 90_000;
const DISCOVERY_TTL = 10 * 60_000;
const DISCOVERY_SCAN_LIMIT = 6000;
const DISCOVERY_BATCH_SIZE = 25;
const DISCOVERY_CONCURRENCY = 8;
const MAX_DISCOVERY_CANDIDATES = 120;
const MAX_HYDRATED_CANDIDATES = 40;
const MAX_SOCIAL_CANDIDATES = 18;
const SOCIAL_ENRICH_CONCURRENCY = 4;
const MIN_PRIMARY_CANDIDATES = 12;
const ALPHA_SNAPSHOT_PATH = join(process.cwd(), ".cache", "alpha-feed.json");

const SIGNAL_WEIGHTS: Record<string, number> = {
    volume_spike: 25,
    price_pump: 20,
    price_dump: 10,
    crowd_activity: 18,
    buy_pressure: 16,
    whale_claim: 15,
    creator_active: 15,
    social_buzz: 20,
    high_earnings: 12,
    fee_momentum: 14,
    new_migration: 8,
    new_launch: 10,
    holder_surge: 10,
    rug_risk: 18,
};

export async function generateAlphaFeed(): Promise<AlphaFeedResponse> {
    if (alphaCache && Date.now() - alphaCache.ts < ALPHA_TTL) {
        return alphaCache.data;
    }

    try {
        const [searchPairs, bagsPoolCandidates, solPrice, radarItems] = await Promise.all([
            getDexScreenerSearch("bags"),
            discoverRecentBagsDexCandidates(),
            getSolPriceUsd(),
            isXquikConfigured()
                ? getRadarItems({ hours: 24, limit: 30 })
                : Promise.resolve([]),
        ]);

        const candidateMap = new Map<string, AlphaToken>();

        for (const pair of searchPairs as DexPair[]) {
            const token = buildAlphaTokenFromPair(pair, "dex-search");
            if (!token) continue;
            upsertCandidate(candidateMap, token);
        }

        for (const token of bagsPoolCandidates) {
            upsertCandidate(candidateMap, token);
        }

        if (candidateMap.size < MIN_PRIMARY_CANDIDATES) {
            const fallbackTokens = await loadFallbackTrendingCandidates();
            for (const token of fallbackTokens) {
                upsertCandidate(candidateMap, token);
            }
        }

        const candidates = [...candidateMap.values()]
            .sort((a, b) => getBaseAttentionScore(b) - getBaseAttentionScore(a))
            .slice(0, MAX_DISCOVERY_CANDIDATES);

        await Promise.allSettled(
            candidates
                .slice(0, MAX_HYDRATED_CANDIDATES)
                .map((token) => enrichWithBagsData(token, solPrice))
        );

        for (const token of candidates) {
            detectOnChainSignals(token);
        }

        if (isXquikConfigured()) {
            await enrichWithSocialBatch(
                [...candidates]
                    .sort((a, b) => getBaseAttentionScore(b) - getBaseAttentionScore(a))
                    .slice(0, MAX_SOCIAL_CANDIDATES)
            );
        }

        for (const token of candidates) {
            applyRugRiskAssessment(token);
            token.alphaScore = calculateAlphaScore(token.signals);
            applyTrendingNow(token);
        }

        const alphaTokens = candidates
            .filter((token) => token.alphaScore > 0 || token.signals.length > 0)
            .sort(compareAlphaTokens)
            .slice(0, 50);

        const totalSignals = alphaTokens.reduce((sum, token) => sum + token.signals.length, 0);
        const radarTrends: RadarTrend[] = radarItems.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            url: item.url,
            source: item.source,
            category: item.category,
            score: item.score,
            publishedAt: item.publishedAt,
        }));

        const result: AlphaFeedResponse = {
            tokens: alphaTokens,
            totalSignals,
            lastUpdated: new Date().toISOString(),
            xquikEnabled: isXquikConfigured(),
            radarTrends,
        };

        if (result.tokens.length === 0) {
            const snapshot = await readAlphaSnapshot();
            if (snapshot) {
                alphaCache = { data: snapshot, ts: Date.now() };
                return snapshot;
            }
        }

        alphaCache = { data: result, ts: Date.now() };
        if (result.tokens.length > 0) {
            void persistAlphaSnapshot(result);
        }
        return result;
    } catch (error) {
        console.error("[alpha] feed generation error:", error);
        const snapshot = await readAlphaSnapshot();
        return (
            alphaCache?.data ??
            snapshot ?? {
                tokens: [],
                totalSignals: 0,
                lastUpdated: new Date().toISOString(),
                xquikEnabled: isXquikConfigured(),
                radarTrends: [],
            }
        );
    }
}

async function discoverRecentBagsDexCandidates(): Promise<AlphaToken[]> {
    if (discoveryCache && Date.now() - discoveryCache.ts < DISCOVERY_TTL) {
        return discoveryCache.tokens;
    }

    try {
        const pools = await getBagsPools();
        const recentMints = pools
            .map((pool) => pool.tokenMint)
            .filter((mint): mint is string => typeof mint === "string" && mint.length > 0)
            .slice(0, DISCOVERY_SCAN_LIMIT);

        const batches = chunk(recentMints, DISCOVERY_BATCH_SIZE);
        const candidateMap = new Map<string, AlphaToken>();

        for (let i = 0; i < batches.length; i += DISCOVERY_CONCURRENCY) {
            const current = batches.slice(i, i + DISCOVERY_CONCURRENCY);
            const results = await Promise.allSettled(
                current.map((batch) => getDexScreenerPairs(batch))
            );

            for (const result of results) {
                if (result.status !== "fulfilled") continue;
                for (const pair of result.value as DexPair[]) {
                    const token = buildAlphaTokenFromPair(pair, "bags-pool-scan");
                    if (!token || !hasCandidateFootprint(token)) continue;
                    upsertCandidate(candidateMap, token);
                }
            }
        }

        const tokens = [...candidateMap.values()]
            .sort((a, b) => getBaseAttentionScore(b) - getBaseAttentionScore(a))
            .slice(0, MAX_DISCOVERY_CANDIDATES);

        discoveryCache = { tokens, ts: Date.now() };
        return tokens;
    } catch (error) {
        console.error("[alpha] bags discovery error:", error);
        return discoveryCache?.tokens ?? [];
    }
}

async function enrichWithBagsData(token: AlphaToken, solPrice: number) {
    try {
        const [creators, feesLamports] = await Promise.all([
            getCreatorsV3(token.tokenMint),
            getLifetimeFees(token.tokenMint),
        ]);

        const primary = creators.find((creator) => creator.isCreator) ?? creators[0];
        if (primary) {
            token.creatorWallet = primary.wallet ?? token.creatorWallet;
            token.creatorDisplay =
                primary.providerUsername ??
                primary.twitterUsername ??
                primary.bagsUsername ??
                primary.username ??
                token.creatorDisplay;
            token.creatorPfp = primary.pfp ?? token.creatorPfp;
            token.provider = primary.provider ?? token.provider;
            token.providerUsername = primary.providerUsername ?? token.providerUsername;
            token.twitterUsername = primary.twitterUsername ?? token.twitterUsername;
            token.bagsUsername = primary.bagsUsername ?? token.bagsUsername;
        }

        if (feesLamports) {
            const lamports = Number(feesLamports);
            if (Number.isFinite(lamports) && lamports > 0) {
                token.earnedSol = lamports / 1_000_000_000;
                token.earnedUsd = token.earnedSol * solPrice;
            }
        }
    } catch (error) {
        console.error(`[alpha] bags enrichment error for ${token.tokenMint}:`, error);
    }
}

async function loadFallbackTrendingCandidates(): Promise<AlphaToken[]> {
    try {
        const fallbackTokens = await syncTrendingTokens();
        return fallbackTokens
            .slice(0, 24)
            .map((token) => buildAlphaTokenFromNormalizedToken(token, "sync-trending-cache"))
            .filter((token): token is AlphaToken => token !== null);
    } catch (error) {
        console.error("[alpha] fallback trending load error:", error);
        return [];
    }
}

function detectOnChainSignals(token: AlphaToken) {
    const launchAgeHours = getLaunchAgeHours(token.pairCreatedAt);
    if (launchAgeHours !== null) {
        if (launchAgeHours <= 1) {
            pushSignal(token, {
                type: "new_launch",
                severity: "critical",
                title: "Fresh Launch",
                description: "Launched in the last hour",
                value: "1h",
            });
        } else if (launchAgeHours <= 6) {
            pushSignal(token, {
                type: "new_launch",
                severity: "high",
                title: "New Launch",
                description: "Launched in the last 6 hours",
                value: "6h",
            });
        } else if (launchAgeHours <= 24) {
            pushSignal(token, {
                type: "new_launch",
                severity: "medium",
                title: "Recent Launch",
                description: "Launched in the last 24 hours",
                value: "24h",
            });
        }
    }

    if (token.volume24hUsd) {
        if (token.volume24hUsd > 100_000) {
            pushSignal(token, {
                type: "volume_spike",
                severity: "critical",
                title: "Massive Volume",
                description: `$${formatCompact(token.volume24hUsd)} in 24h volume`,
                value: `$${formatCompact(token.volume24hUsd)}`,
            });
        } else if (token.volume24hUsd > 50_000) {
            pushSignal(token, {
                type: "volume_spike",
                severity: "high",
                title: "High Volume",
                description: `$${formatCompact(token.volume24hUsd)} in 24h volume`,
                value: `$${formatCompact(token.volume24hUsd)}`,
            });
        } else if (token.volume24hUsd > 10_000) {
            pushSignal(token, {
                type: "volume_spike",
                severity: "medium",
                title: "Rising Volume",
                description: `$${formatCompact(token.volume24hUsd)} in 24h volume`,
                value: `$${formatCompact(token.volume24hUsd)}`,
            });
        }
    }

    if (token.txCount24h) {
        if (token.txCount24h >= 700) {
            pushSignal(token, {
                type: "crowd_activity",
                severity: "critical",
                title: "Crowded Pair",
                description: `${formatCompact(token.txCount24h)} trades in 24h`,
                value: `${formatCompact(token.txCount24h)} tx`,
            });
        } else if (token.txCount24h >= 300) {
            pushSignal(token, {
                type: "crowd_activity",
                severity: "high",
                title: "High Activity",
                description: `${formatCompact(token.txCount24h)} trades in 24h`,
                value: `${formatCompact(token.txCount24h)} tx`,
            });
        } else if (token.txCount24h >= 120) {
            pushSignal(token, {
                type: "crowd_activity",
                severity: "medium",
                title: "Active Pair",
                description: `${formatCompact(token.txCount24h)} trades in 24h`,
                value: `${formatCompact(token.txCount24h)} tx`,
            });
        }
    }

    const buys = token.buyCount24h ?? 0;
    const sells = token.sellCount24h ?? 0;
    const buyRatio = sells > 0 ? buys / sells : buys > 0 ? buys : 0;
    if (buys + sells >= 120 && buyRatio >= 1.5) {
        pushSignal(token, {
            type: "buy_pressure",
            severity: buyRatio >= 2 ? "high" : "medium",
            title: "Buy Pressure",
            description: `${buys} buys vs ${sells} sells in 24h`,
            value: `${buyRatio.toFixed(2)}x`,
        });
    }

    if (token.priceChange24h !== undefined) {
        if (token.priceChange24h > 50) {
            pushSignal(token, {
                type: "price_pump",
                severity: "critical",
                title: "Massive Pump",
                description: `+${token.priceChange24h.toFixed(1)}% in 24h`,
                value: `+${token.priceChange24h.toFixed(1)}%`,
            });
        } else if (token.priceChange24h > 20) {
            pushSignal(token, {
                type: "price_pump",
                severity: "high",
                title: "Strong Pump",
                description: `+${token.priceChange24h.toFixed(1)}% in 24h`,
                value: `+${token.priceChange24h.toFixed(1)}%`,
            });
        } else if (token.priceChange24h > 10) {
            pushSignal(token, {
                type: "price_pump",
                severity: "medium",
                title: "Price Rising",
                description: `+${token.priceChange24h.toFixed(1)}% in 24h`,
                value: `+${token.priceChange24h.toFixed(1)}%`,
            });
        } else if (token.priceChange24h < -30) {
            pushSignal(token, {
                type: "price_dump",
                severity: "high",
                title: "Heavy Dump",
                description: `${token.priceChange24h.toFixed(1)}% in 24h`,
                value: `${token.priceChange24h.toFixed(1)}%`,
            });
        } else if (token.priceChange24h < -15) {
            pushSignal(token, {
                type: "price_dump",
                severity: "medium",
                title: "Price Dropping",
                description: `${token.priceChange24h.toFixed(1)}% in 24h`,
                value: `${token.priceChange24h.toFixed(1)}%`,
            });
        }
    }

    if (token.earnedUsd && token.earnedUsd > 1000) {
        const severity: AlphaSignalSeverity =
            token.earnedUsd > 10_000
                ? "critical"
                : token.earnedUsd > 5_000
                    ? "high"
                    : "medium";
        pushSignal(token, {
            type: "high_earnings",
            severity,
            title: "High Creator Earnings",
            description: `$${formatCompact(token.earnedUsd)} in total creator earnings`,
            value: `$${formatCompact(token.earnedUsd)}`,
        });
    }

    if (token.earnedUsd && token.earnedUsd > 250 && launchAgeHours !== null && launchAgeHours <= 72) {
        pushSignal(token, {
            type: "fee_momentum",
            severity: token.earnedUsd > 1500 ? "high" : "medium",
            title: "Fee Momentum",
            description: `Creator fees already at $${formatCompact(token.earnedUsd)}`,
            value: `$${formatCompact(token.earnedUsd)}`,
        });
    }
}

async function enrichWithSocialData(token: AlphaToken) {
    try {
        const tasks: Promise<void>[] = [];

        if (token.twitterUsername) {
            tasks.push(
                (async () => {
                    const user = await getXUserCached(token.twitterUsername!);
                    if (!user) return;

                    token.creatorFollowers = user.followers;
                    token.creatorTweetCount = user.statusesCount;

                    if (user.followers && user.followers > 10_000) {
                        pushSignal(token, {
                            type: "creator_active",
                            severity:
                                user.followers > 100_000
                                    ? "critical"
                                    : user.followers > 50_000
                                        ? "high"
                                        : "medium",
                            title: "Influential Creator",
                            description: `@${user.username} has ${formatCompact(user.followers)} followers`,
                            value: formatCompact(user.followers),
                        });
                    }
                })()
            );

            tasks.push(
                (async () => {
                    const tweets = await searchCreatorTweets(token.twitterUsername!, 5);
                    if (tweets.length === 0) return;

                    token.latestCreatorTweet = tweets[0].text;

                    const createdAt = tweets[0].createdAt;
                    if (!createdAt) return;

                    const ageHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
                    if (ageHours < 6) {
                        pushSignal(token, {
                            type: "creator_active",
                            severity: ageHours < 1 ? "high" : "medium",
                            title: "Creator Active",
                            description: `@${token.twitterUsername} tweeted ${ageHours < 1 ? "just now" : `${Math.floor(ageHours)}h ago`}`,
                            value: `${Math.max(0, Math.floor(ageHours))}h`,
                        });
                    }
                })()
            );
        }

        if (token.symbol) {
            tasks.push(
                (async () => {
                    const tweets = await searchTokenTweets(token.symbol!, token.name, 20);
                    token.tweetCount = tweets.length;
                    if (tweets.length === 0) return;

                    const totalEngagement = tweets.reduce(
                        (sum, tweet) =>
                            sum +
                            (tweet.likeCount ?? 0) +
                            (tweet.retweetCount ?? 0) * 2 +
                            (tweet.replyCount ?? 0),
                        0
                    );

                    token.socialScore = Math.min(
                        100,
                        Math.round((tweets.length / 20) * 40 + Math.min(totalEngagement / 100, 60))
                    );

                    if (tweets.length >= 10) {
                        pushSignal(token, {
                            type: "social_buzz",
                            severity: tweets.length >= 20 ? "high" : "medium",
                            title: "Social Buzz",
                            description: `${tweets.length} recent tweets mentioning $${token.symbol}`,
                            value: `${tweets.length} tweets`,
                        });
                    }
                })()
            );
        }

        await Promise.allSettled(tasks);
    } catch (error) {
        console.error(`[alpha] social enrichment error for ${token.tokenMint}:`, error);
    }
}

async function enrichWithSocialBatch(tokens: AlphaToken[]) {
    for (let i = 0; i < tokens.length; i += SOCIAL_ENRICH_CONCURRENCY) {
        const batch = tokens.slice(i, i + SOCIAL_ENRICH_CONCURRENCY);
        await Promise.allSettled(batch.map((token) => enrichWithSocialData(token)));
    }
}

function applyRugRiskAssessment(token: AlphaToken) {
    let score = 0;
    const reasons: string[] = [];

    const liquidity = token.liquidityUsd ?? 0;
    const volume24h = token.volume24hUsd ?? 0;
    const marketCap = token.marketCap ?? 0;
    const change24h = token.priceChange24h ?? 0;
    const launchAgeHours = getLaunchAgeHours(token.pairCreatedAt);

    if (!token.liquidityUsd || liquidity < 12_000) {
        score += 28;
        reasons.push("Low liquidity depth");
    } else if (liquidity < 25_000) {
        score += 18;
        reasons.push("Thin liquidity");
    }

    if (change24h <= -45) {
        score += 30;
        reasons.push("Severe 24h drawdown");
    } else if (change24h <= -25) {
        score += 18;
        reasons.push("Heavy 24h sell pressure");
    }

    if (marketCap > 500_000 && volume24h < 7_000) {
        score += 14;
        reasons.push("Weak volume vs market cap");
    }

    if (liquidity > 0 && volume24h / liquidity > 12) {
        score += 10;
        reasons.push("Unstable turnover profile");
    }

    if (launchAgeHours !== null && launchAgeHours <= 12 && liquidity < 15_000) {
        score += 16;
        reasons.push("Very new pair with low liquidity");
    }

    if (!token.marketCap) {
        score += 8;
        reasons.push("Unverified market cap profile");
    }

    const finalScore = Math.min(100, score);
    token.rugRiskScore = finalScore;
    token.rugRiskLevel = scoreToRiskLevel(finalScore);
    token.rugRiskReasons = reasons;

    if (finalScore >= 35) {
        pushSignal(token, {
            type: "rug_risk",
            severity:
                finalScore >= 65
                    ? "critical"
                    : finalScore >= 50
                        ? "high"
                        : "medium",
            title: finalScore >= 65 ? "Rug Risk Alert" : "Rug Risk Watch",
            description: reasons.slice(0, 2).join(" - ") || "Risk profile elevated",
            value: `RISK ${finalScore}`,
        });
    }
}

function buildAlphaTokenFromPair(pair: DexPair, discoverySource: string): AlphaToken | null {
    if (pair.chainId && pair.chainId !== "solana") {
        return null;
    }

    const tokenMint = pair.baseToken?.address;
    if (!tokenMint) {
        return null;
    }

    const buyCount24h = safeNum(pair.txns?.h24?.buys);
    const sellCount24h = safeNum(pair.txns?.h24?.sells);

    return {
        tokenMint,
        name: pair.baseToken?.name,
        symbol: pair.baseToken?.symbol,
        image: pair.info?.imageUrl,
        priceUsd: safeNum(pair.priceUsd),
        priceChange24h: safeNum(pair.priceChange?.h24),
        volume24hUsd: safeNum(pair.volume?.h24),
        marketCap: undefined,
        liquidityUsd: safeNum(pair.liquidity?.usd),
        pairCreatedAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : undefined,
        txCount24h: (buyCount24h ?? 0) + (sellCount24h ?? 0) || undefined,
        buyCount24h,
        sellCount24h,
        discoverySource,
        alphaScore: 0,
        signals: [],
        detectedAt: new Date().toISOString(),
    };
}

function buildAlphaTokenFromNormalizedToken(
    token: NormalizedToken,
    discoverySource: string
): AlphaToken | null {
    if (!token.tokenMint) {
        return null;
    }

    return {
        tokenMint: token.tokenMint,
        name: token.name,
        symbol: token.symbol,
        image: token.image,
        priceUsd: token.priceUsd,
        priceChange24h: token.priceChange24h,
        volume24hUsd: token.volume24hUsd,
        marketCap: token.marketCap,
        liquidityUsd: token.liquidityUsd,
        pairCreatedAt: token.pairCreatedAt,
        txCount24h: token.txCount24h,
        buyCount24h: token.buyCount24h,
        sellCount24h: token.sellCount24h,
        discoverySource,
        creatorDisplay: token.creatorDisplay,
        creatorPfp: token.creatorPfp,
        twitterUsername: token.twitterUsername,
        provider: token.provider,
        creatorWallet: token.creatorWallet,
        providerUsername: token.providerUsername,
        bagsUsername: token.bagsUsername,
        earnedUsd: token.lifetimeFees,
        earnedSol: token.lifetimeFeesSol,
        alphaScore: 0,
        signals: [],
        detectedAt: new Date().toISOString(),
    };
}

function hasCandidateFootprint(token: AlphaToken): boolean {
    const volume = token.volume24hUsd ?? 0;
    const liquidity = token.liquidityUsd ?? 0;
    const txCount = token.txCount24h ?? 0;
    const priceChange = Math.abs(token.priceChange24h ?? 0);
    const ageHours = getLaunchAgeHours(token.pairCreatedAt);

    return (
        volume >= 2_500 ||
        liquidity >= 10_000 ||
        txCount >= 80 ||
        priceChange >= 8 ||
        (ageHours !== null && ageHours <= 72)
    );
}

function getBaseAttentionScore(token: AlphaToken): number {
    let score = 0;

    score += Math.min(45, (token.volume24hUsd ?? 0) / 2000);
    score += Math.min(22, (token.liquidityUsd ?? 0) / 2500);
    score += Math.min(28, (token.txCount24h ?? 0) / 20);
    score += Math.min(18, Math.max(0, token.priceChange24h ?? 0));
    score += Math.min(20, (token.earnedUsd ?? 0) / 500);
    score += Math.min(15, (token.socialScore ?? 0) / 5);

    const launchAgeHours = getLaunchAgeHours(token.pairCreatedAt);
    if (launchAgeHours !== null) {
        if (launchAgeHours <= 6) score += 18;
        else if (launchAgeHours <= 24) score += 12;
        else if (launchAgeHours <= 72) score += 6;
    }

    return score;
}

function compareAlphaTokens(a: AlphaToken, b: AlphaToken): number {
    const trendingDiff = Number(Boolean(b.isTrendingNow)) - Number(Boolean(a.isTrendingNow));
    if (trendingDiff !== 0) {
        return trendingDiff;
    }

    const trendingScoreDiff = (b.trendingNowScore ?? 0) - (a.trendingNowScore ?? 0);
    if (trendingScoreDiff !== 0) {
        return trendingScoreDiff;
    }

    const scoreDiff = b.alphaScore - a.alphaScore;
    if (scoreDiff !== 0) {
        return scoreDiff;
    }

    return getBaseAttentionScore(b) - getBaseAttentionScore(a);
}

function applyTrendingNow(token: AlphaToken) {
    const txCount = token.txCount24h ?? 0;
    const volume24h = token.volume24hUsd ?? 0;
    const liquidity = token.liquidityUsd ?? 0;
    const positiveChange = Math.max(0, token.priceChange24h ?? 0);
    const socialScore = token.socialScore ?? 0;
    const tweetCount = token.tweetCount ?? 0;
    const earnedUsd = token.earnedUsd ?? 0;
    const alphaScore = token.alphaScore ?? 0;
    const rugRiskScore = token.rugRiskScore ?? 0;
    const launchAgeHours = getLaunchAgeHours(token.pairCreatedAt);
    const positiveSignalCount = getPositiveTrendingSignalCount(token);

    let score = 0;

    score += Math.min(42, txCount / 10);
    score += Math.min(32, volume24h / 1500);
    score += Math.min(18, liquidity / 3000);
    score += Math.min(20, positiveChange * 0.8);
    score += Math.min(18, socialScore / 2.5);
    score += Math.min(10, tweetCount * 1.2);
    score += Math.min(20, earnedUsd / 2500);
    score += Math.min(18, alphaScore / 6);
    score += Math.min(16, positiveSignalCount * 4);

    if (launchAgeHours !== null) {
        if (launchAgeHours <= 6) score += 18;
        else if (launchAgeHours <= 24) score += 12;
        else if (launchAgeHours <= 72) score += 8;
        else if (launchAgeHours <= 168) score += 4;
    }

    if (rugRiskScore >= 65) score -= 25;
    else if (rugRiskScore >= 50) score -= 12;
    else if (rugRiskScore >= 35) score -= 6;

    if ((token.priceChange24h ?? 0) < -10) {
        score -= Math.min(20, Math.abs(token.priceChange24h ?? 0) * 0.6);
    }
    if (liquidity < 10_000) score -= 8;
    if (txCount < 100) score -= 12;
    if (volume24h < 10_000) score -= 10;

    const qualifiesAsTrending =
        (
            (txCount >= 200 && volume24h >= 15_000) ||
            (txCount >= 300 && positiveChange >= 10) ||
            (volume24h >= 30_000 && positiveChange >= 8) ||
            (earnedUsd >= 10_000 && txCount >= 120) ||
            (socialScore >= 30 && tweetCount >= 8 && (txCount >= 120 || volume24h >= 12_000)) ||
            (positiveSignalCount >= 3 && txCount >= 150 && volume24h >= 12_000)
        ) &&
        rugRiskScore < 75;

    token.trendingNowScore = Math.max(0, Math.round(score));
    token.isTrendingNow = qualifiesAsTrending && (token.trendingNowScore ?? 0) >= 70;
    token.trendingReasons = getTrendingReasons(token);
}

function getPositiveTrendingSignalCount(token: AlphaToken): number {
    return token.signals.filter((signal) =>
        signal.type === "volume_spike" ||
        signal.type === "crowd_activity" ||
        signal.type === "buy_pressure" ||
        signal.type === "price_pump" ||
        signal.type === "social_buzz" ||
        signal.type === "high_earnings" ||
        signal.type === "fee_momentum" ||
        signal.type === "new_launch" ||
        signal.type === "creator_active"
    ).length;
}

function getTrendingReasons(token: AlphaToken): string[] {
    const reasons: string[] = [];
    const txCount = token.txCount24h ?? 0;
    const volume24h = token.volume24hUsd ?? 0;
    const priceChange24h = token.priceChange24h ?? 0;
    const earnedUsd = token.earnedUsd ?? 0;
    const socialScore = token.socialScore ?? 0;
    const tweetCount = token.tweetCount ?? 0;
    const launchAgeHours = getLaunchAgeHours(token.pairCreatedAt);

    if (txCount >= 180) {
        reasons.push(`${formatCompact(txCount)} tx`);
    }
    if (volume24h >= 15_000) {
        reasons.push(`$${formatCompact(volume24h)} vol`);
    }
    if (priceChange24h >= 10) {
        reasons.push(`+${priceChange24h.toFixed(1)}%`);
    }
    if (earnedUsd >= 5_000) {
        reasons.push(`$${formatCompact(earnedUsd)} fees`);
    }
    if (socialScore >= 25 || tweetCount >= 10) {
        reasons.push(`${Math.max(tweetCount, Math.round(socialScore))} social`);
    }
    if (launchAgeHours !== null && launchAgeHours <= 24) {
        reasons.push("fresh");
    }

    return reasons.slice(0, 4);
}

function getPairSnapshotScore(token: AlphaToken): number {
    let score = 0;

    score += Math.min(60, (token.volume24hUsd ?? 0) / 1000);
    score += Math.min(30, (token.liquidityUsd ?? 0) / 2000);
    score += Math.min(35, (token.txCount24h ?? 0) / 10);
    score += Math.min(18, Math.abs(token.priceChange24h ?? 0));

    const launchAgeHours = getLaunchAgeHours(token.pairCreatedAt);
    if (launchAgeHours !== null) {
        if (launchAgeHours <= 24) score += 10;
        else if (launchAgeHours <= 72) score += 4;
    }

    return score;
}

function upsertCandidate(map: Map<string, AlphaToken>, incoming: AlphaToken) {
    const existing = map.get(incoming.tokenMint);
    if (!existing) {
        map.set(incoming.tokenMint, incoming);
        return;
    }

    const incomingScore = getPairSnapshotScore(incoming);
    const existingScore = getPairSnapshotScore(existing);
    const preferred = incomingScore >= existingScore ? incoming : existing;
    const fallback = preferred === incoming ? existing : incoming;

    map.set(incoming.tokenMint, {
        ...fallback,
        ...preferred,
        name: preferred.name ?? fallback.name,
        symbol: preferred.symbol ?? fallback.symbol,
        image: preferred.image ?? fallback.image,
        priceUsd: preferred.priceUsd ?? fallback.priceUsd,
        priceChange24h: preferred.priceChange24h ?? fallback.priceChange24h,
        volume24hUsd: preferred.volume24hUsd ?? fallback.volume24hUsd,
        marketCap: preferred.marketCap ?? fallback.marketCap,
        liquidityUsd: preferred.liquidityUsd ?? fallback.liquidityUsd,
        pairCreatedAt: preferred.pairCreatedAt ?? fallback.pairCreatedAt,
        txCount24h: preferred.txCount24h ?? fallback.txCount24h,
        buyCount24h: preferred.buyCount24h ?? fallback.buyCount24h,
        sellCount24h: preferred.sellCount24h ?? fallback.sellCount24h,
        discoverySource: preferred.discoverySource ?? fallback.discoverySource,
        creatorDisplay: existing.creatorDisplay ?? incoming.creatorDisplay,
        creatorPfp: existing.creatorPfp ?? incoming.creatorPfp,
        twitterUsername: existing.twitterUsername ?? incoming.twitterUsername,
        provider: existing.provider ?? incoming.provider,
        creatorWallet: existing.creatorWallet ?? incoming.creatorWallet,
        providerUsername: existing.providerUsername ?? incoming.providerUsername,
        bagsUsername: existing.bagsUsername ?? incoming.bagsUsername,
        earnedUsd: existing.earnedUsd ?? incoming.earnedUsd,
        earnedSol: existing.earnedSol ?? incoming.earnedSol,
        tweetCount: existing.tweetCount ?? incoming.tweetCount,
        socialScore: existing.socialScore ?? incoming.socialScore,
        creatorFollowers: existing.creatorFollowers ?? incoming.creatorFollowers,
        creatorTweetCount: existing.creatorTweetCount ?? incoming.creatorTweetCount,
        latestCreatorTweet: existing.latestCreatorTweet ?? incoming.latestCreatorTweet,
        alphaScore: Math.max(existing.alphaScore, incoming.alphaScore),
        signals: existing.signals.length >= incoming.signals.length ? existing.signals : incoming.signals,
        rugRiskScore: existing.rugRiskScore ?? incoming.rugRiskScore,
        rugRiskLevel: existing.rugRiskLevel ?? incoming.rugRiskLevel,
        rugRiskReasons: existing.rugRiskReasons ?? incoming.rugRiskReasons,
        detectedAt:
            new Date(existing.detectedAt).getTime() <= new Date(incoming.detectedAt).getTime()
                ? existing.detectedAt
                : incoming.detectedAt,
    });
}

function pushSignal(token: AlphaToken, signal: Omit<AlphaSignal, "timestamp">) {
    const exists = token.signals.some(
        (item) => item.type === signal.type && item.title === signal.title && item.value === signal.value
    );
    if (exists) {
        return;
    }

    token.signals.push({
        ...signal,
        timestamp: new Date().toISOString(),
    });
}

function calculateAlphaScore(signals: AlphaSignal[]): number {
    if (signals.length === 0) return 0;

    const severityMultiplier: Record<AlphaSignalSeverity, number> = {
        low: 0.5,
        medium: 1,
        high: 1.5,
        critical: 2,
    };

    let score = 0;
    for (const signal of signals) {
        score += (SIGNAL_WEIGHTS[signal.type] ?? 5) * severityMultiplier[signal.severity];
    }

    return Math.min(100, Math.round(score));
}

function chunk<T>(items: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size));
    }
    return result;
}

function safeNum(value: unknown): number | undefined {
    if (value === null || value === undefined) return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
}

async function readAlphaSnapshot(): Promise<AlphaFeedResponse | null> {
    try {
        const raw = await readFile(ALPHA_SNAPSHOT_PATH, "utf8");
        const parsed = JSON.parse(raw) as AlphaFeedResponse;
        if (!Array.isArray(parsed.tokens)) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

async function persistAlphaSnapshot(data: AlphaFeedResponse) {
    try {
        await mkdir(dirname(ALPHA_SNAPSHOT_PATH), { recursive: true });
        await writeFile(ALPHA_SNAPSHOT_PATH, JSON.stringify(data), "utf8");
    } catch (error) {
        console.warn("[alpha] snapshot persist error:", error);
    }
}

function formatCompact(value: number): string {
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toFixed(0);
}

function getLaunchAgeHours(iso?: string): number | null {
    if (!iso) return null;
    const timestamp = new Date(iso).getTime();
    if (!Number.isFinite(timestamp)) return null;
    const ageMs = Date.now() - timestamp;
    if (ageMs <= 0) return 0;
    return ageMs / (1000 * 60 * 60);
}

function scoreToRiskLevel(score: number): AlphaRiskLevel {
    if (score >= 65) return "high";
    if (score >= 35) return "medium";
    return "low";
}
