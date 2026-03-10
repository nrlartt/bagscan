/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   BagsAlpha â€“ Signal Detection Engine
   Combines Bags API + DexScreener + Xquik data
   to generate alpha signals for each token
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

import {
    getDexScreenerSearch,
    getSolPriceUsd,
} from "@/lib/bags/client";
import {
    searchTokenTweets,
    searchCreatorTweets,
    getXUserCached,
    isXquikConfigured,
    getRadarItems,
} from "@/lib/xquik/client";
import type { XquikRadarItem } from "@/lib/xquik/types";
import type {
    AlphaToken,
    AlphaSignal,
    AlphaSignalSeverity,
    AlphaFeedResponse,
    RadarTrend,
    AlphaRiskLevel,
} from "./types";

// â”€â”€ Cache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let alphaCache: { data: AlphaFeedResponse; ts: number } | null = null;
const ALPHA_TTL = 90_000;

const SIGNAL_WEIGHTS: Record<string, number> = {
    volume_spike: 25,
    price_pump: 20,
    price_dump: 10,
    whale_claim: 15,
    creator_active: 15,
    social_buzz: 20,
    high_earnings: 12,
    new_migration: 8,
    new_launch: 10,
    holder_surge: 10,
    rug_risk: 18,
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Main Alpha Feed â€“ single DexScreener call for speed
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export async function generateAlphaFeed(): Promise<AlphaFeedResponse> {
    if (alphaCache && Date.now() - alphaCache.ts < ALPHA_TTL) {
        return alphaCache.data;
    }

    try {
        const [dexPairs, solPrice, radarItems] = await Promise.all([
            getDexScreenerSearch("bags"),
            getSolPriceUsd(),
            isXquikConfigured()
                ? getRadarItems({ hours: 24, limit: 30 })
                : Promise.resolve([]),
        ]);

        const candidateMap = new Map<string, AlphaToken>();

        for (const p of dexPairs) {
            const addr = p.baseToken?.address;
            if (!addr) continue;
            candidateMap.set(addr, {
                tokenMint: addr,
                name: p.baseToken.name,
                symbol: p.baseToken.symbol,
                image: p.info?.imageUrl,
                priceUsd: Number(p.priceUsd) || undefined,
                priceChange24h: Number(p.priceChange?.h24) || undefined,
                volume24hUsd: Number(p.volume?.h24) || undefined,
                marketCap: Number(p.marketCap) || undefined,
                liquidityUsd: Number(p.liquidity?.usd) || undefined,
                pairCreatedAt: p.pairCreatedAt
                    ? new Date(p.pairCreatedAt).toISOString()
                    : undefined,
                alphaScore: 0,
                signals: [],
                detectedAt: new Date().toISOString(),
            });
        }

        const candidates = [...candidateMap.values()];

        // Phase 1: Market signal detection
        for (const token of candidates) {
            detectOnChainSignals(token, solPrice);
        }

        // Phase 2: Social signal detection (Xquik) â€“ only if API key is configured
        if (isXquikConfigured()) {
            const withSymbol = candidates.filter((t) => t.symbol);
            const socialBatch = withSymbol.slice(0, 10);

            await Promise.allSettled(
                socialBatch.map((token) => enrichWithSocialData(token))
            );
        }

        for (const token of candidates) {
            applyRugRiskAssessment(token);
        }

        for (const token of candidates) {
            token.alphaScore = calculateAlphaScore(token.signals);
        }

        candidates.sort((a, b) => b.alphaScore - a.alphaScore);

        const alphaTokens = candidates
            .filter((t) => t.alphaScore > 0 || t.signals.length > 0)
            .slice(0, 50);

        const totalSignals = alphaTokens.reduce(
            (sum, t) => sum + t.signals.length,
            0
        );

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

        alphaCache = { data: result, ts: Date.now() };
        return result;
    } catch (e) {
        console.error("[alpha] feed generation error:", e);
        return (
            alphaCache?.data ?? {
                tokens: [],
                totalSignals: 0,
                lastUpdated: new Date().toISOString(),
                xquikEnabled: isXquikConfigured(),
                radarTrends: [],
            }
        );
    }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Helpers
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function detectOnChainSignals(token: AlphaToken, solPrice: number) {
    // New launch timing
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

    // Volume Spike: volume24h > $10K signals activity
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

    // Price movement
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

    // High earnings
    if (token.earnedUsd && token.earnedUsd > 1000) {
        const sev: AlphaSignalSeverity =
            token.earnedUsd > 10_000
                ? "critical"
                : token.earnedUsd > 5_000
                    ? "high"
                    : "medium";
        pushSignal(token, {
            type: "high_earnings",
            severity: sev,
            title: "High Creator Earnings",
            description: `$${formatCompact(token.earnedUsd)} in total creator earnings`,
            value: `$${formatCompact(token.earnedUsd)}`,
        });
    }
}

async function enrichWithSocialData(token: AlphaToken) {
    try {
        const promises: Promise<void>[] = [];

        // Creator profile lookup
        if (token.twitterUsername) {
            promises.push(
                (async () => {
                    const user = await getXUserCached(token.twitterUsername!);
                    if (user) {
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
                    }
                })()
            );

            // Creator's recent tweets
            promises.push(
                (async () => {
                    const tweets = await searchCreatorTweets(
                        token.twitterUsername!,
                        5
                    );
                    if (tweets.length > 0) {
                        token.latestCreatorTweet = tweets[0].text;
                        token.creatorTweetCount = tweets.length;

                        const recentTweet = tweets[0];
                        if (recentTweet.createdAt) {
                            const tweetAge =
                                Date.now() -
                                new Date(recentTweet.createdAt).getTime();
                            const hoursAgo = tweetAge / (1000 * 60 * 60);

                            if (hoursAgo < 6) {
                                pushSignal(token, {
                                    type: "creator_active",
                                    severity:
                                        hoursAgo < 1 ? "high" : "medium",
                                    title: "Creator Active",
                                    description: `@${token.twitterUsername} tweeted ${hoursAgo < 1 ? "just now" : `${Math.floor(hoursAgo)}h ago`}`,
                                    value: `${Math.floor(hoursAgo)}h`,
                                });
                            }
                        }
                    }
                })()
            );
        }

        // Social buzz â€“ token mention search
        if (token.symbol) {
            promises.push(
                (async () => {
                    const tweets = await searchTokenTweets(
                        token.symbol!,
                        token.name,
                        20
                    );
                    token.tweetCount = tweets.length;

                    if (tweets.length > 0) {
                        const totalEngagement = tweets.reduce(
                            (sum, t) =>
                                sum +
                                (t.likeCount ?? 0) +
                                (t.retweetCount ?? 0) * 2 +
                                (t.replyCount ?? 0),
                            0
                        );

                        token.socialScore = Math.min(
                            100,
                            Math.round(
                                (tweets.length / 20) * 40 +
                                    Math.min(totalEngagement / 100, 60)
                            )
                        );

                        if (tweets.length >= 10) {
                            pushSignal(token, {
                                type: "social_buzz",
                                severity:
                                    tweets.length >= 20 ? "high" : "medium",
                                title: "Social Buzz",
                                description: `${tweets.length} recent tweets mentioning $${token.symbol}`,
                                value: `${tweets.length} tweets`,
                            });
                        }
                    }
                })()
            );
        }

        await Promise.allSettled(promises);
    } catch (e) {
        console.error(
            `[alpha] social enrichment error for ${token.symbol}:`,
            e
        );
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
    const riskLevel = scoreToRiskLevel(finalScore);

    token.rugRiskScore = finalScore;
    token.rugRiskLevel = riskLevel;
    token.rugRiskReasons = reasons;

    if (finalScore >= 35) {
        const severity: AlphaSignalSeverity =
            finalScore >= 65
                ? "critical"
                : finalScore >= 50
                    ? "high"
                    : "medium";

        pushSignal(token, {
            type: "rug_risk",
            severity,
            title: finalScore >= 65 ? "Rug Risk Alert" : "Rug Risk Watch",
            description:
                reasons.slice(0, 2).join(" - ") || "Risk profile elevated",
            value: `RISK ${finalScore}`,
        });
    }
}

function pushSignal(
    token: AlphaToken,
    signal: Omit<AlphaSignal, "timestamp">
) {
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
    for (const s of signals) {
        const baseWeight = SIGNAL_WEIGHTS[s.type] ?? 5;
        const mult = severityMultiplier[s.severity];
        score += baseWeight * mult;
    }

    return Math.min(100, Math.round(score));
}

function formatCompact(n: number): string {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toFixed(0);
}

function getLaunchAgeHours(iso?: string): number | null {
    if (!iso) return null;
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return null;
    const ageMs = Date.now() - ts;
    if (ageMs <= 0) return 0;
    return ageMs / (1000 * 60 * 60);
}

function scoreToRiskLevel(score: number): AlphaRiskLevel {
    if (score >= 65) return "high";
    if (score >= 35) return "medium";
    return "low";
}

