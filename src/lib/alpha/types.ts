/* ──────────────────────────────────────────────
   BagsAlpha – Type definitions
   Alpha signal detection and scoring for Bags tokens
   ────────────────────────────────────────────── */

export type AlphaSignalType =
    | "volume_spike"
    | "price_pump"
    | "price_dump"
    | "crowd_activity"
    | "buy_pressure"
    | "whale_claim"
    | "creator_active"
    | "social_buzz"
    | "high_earnings"
    | "fee_momentum"
    | "new_migration"
    | "new_launch"
    | "holder_surge"
    | "rug_risk";

export type AlphaSignalSeverity = "low" | "medium" | "high" | "critical";
export type AlphaRiskLevel = "low" | "medium" | "high";

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
    pairCreatedAt?: string;
    txCount24h?: number;
    buyCount24h?: number;
    sellCount24h?: number;
    discoverySource?: string;

    // Creator info
    creatorDisplay?: string;
    creatorPfp?: string;
    twitterUsername?: string;
    provider?: string;
    creatorWallet?: string;
    providerUsername?: string;
    bagsUsername?: string;

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
    isTrendingNow?: boolean;
    trendingNowScore?: number;
    trendingReasons?: string[];
    rugRiskScore?: number;
    rugRiskLevel?: AlphaRiskLevel;
    rugRiskReasons?: string[];

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
