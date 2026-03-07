/* ──────────────────────────────────────────────
   BagsAlpha – Type definitions
   Alpha signal detection and scoring for Bags tokens
   ────────────────────────────────────────────── */

export type AlphaSignalType =
    | "volume_spike"
    | "price_pump"
    | "price_dump"
    | "whale_claim"
    | "creator_active"
    | "social_buzz"
    | "high_earnings"
    | "new_migration"
    | "new_launch"
    | "holder_surge";

export type AlphaSignalSeverity = "low" | "medium" | "high" | "critical";

export interface AlphaSignal {
    type: AlphaSignalType;
    severity: AlphaSignalSeverity;
    title: string;
    description: string;
    value?: string;
    timestamp: string;
}

export interface AlphaToken {
    tokenMint: string;
    name?: string;
    symbol?: string;
    image?: string;

    // Market data
    priceUsd?: number;
    priceChange24h?: number;
    volume24hUsd?: number;
    marketCap?: number;
    liquidityUsd?: number;

    // Creator info
    creatorDisplay?: string;
    creatorPfp?: string;
    twitterUsername?: string;
    provider?: string;

    // Fees & earnings
    earnedUsd?: number;
    earnedSol?: number;

    // Social data (from Xquik)
    tweetCount?: number;
    socialScore?: number;
    creatorFollowers?: number;
    creatorTweetCount?: number;
    latestCreatorTweet?: string;

    // Alpha scoring
    alphaScore: number;
    signals: AlphaSignal[];

    // Timing
    detectedAt: string;
}

export interface RadarTrend {
    id: string;
    title: string;
    description?: string;
    url?: string;
    source: string;
    category: string;
    score: number;
    publishedAt: string;
}

export interface AlphaFeedResponse {
    tokens: AlphaToken[];
    totalSignals: number;
    lastUpdated: string;
    xquikEnabled: boolean;
    radarTrends: RadarTrend[];
}
