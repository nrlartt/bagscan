export interface JupiterTokenAuditSummary {
    mintAuthorityDisabled?: boolean;
    freezeAuthorityDisabled?: boolean;
    topHoldersPercentage?: number | null;
}

export interface JupiterTokenDetail {
    mint: string;
    name?: string;
    symbol?: string;
    icon?: string;
    verified?: boolean;
    strict?: boolean;
    organicScore?: number | null;
    holderCount?: number | null;
    marketCap?: number | null;
    liquidity?: number | null;
    volume24h?: number | null;
    buyVolume24h?: number | null;
    sellVolume24h?: number | null;
    priceChange24h?: number | null;
    circulatingSupply?: number | null;
    totalSupply?: number | null;
    website?: string;
    twitter?: string;
    telegram?: string;
    tags?: string[];
    createdAt?: string;
    audit?: JupiterTokenAuditSummary | null;
    jupiterTokenPageUrl: string;
}

export interface JupiterOrderResponse {
    requestId?: string;
    transaction?: string;
    inputMint?: string;
    outputMint?: string;
    inAmount?: string | number;
    outAmount?: string | number;
    outputAmount?: string | number;
    priceImpactPct?: string | number;
    priceImpact?: string | number;
    totalTime?: number;
    [key: string]: unknown;
}

export interface JupiterExecuteResponse {
    status?: string;
    signature?: string;
    txid?: string;
    error?: string;
    [key: string]: unknown;
}

export interface JupiterPredictionTradingStatus {
    open?: boolean;
    reason?: string | null;
}

export interface JupiterPredictionMarket {
    marketId: string;
    title: string;
    imageUrl?: string;
    status?: string;
    volumeUsd?: number | null;
    yesPrice?: number | null;
    noPrice?: number | null;
    yesProbability?: number | null;
    noProbability?: number | null;
    closeTime?: string | null;
    resolveTime?: string | null;
}

export interface JupiterPredictionEvent {
    eventId: string;
    title: string;
    description?: string;
    imageUrl?: string;
    category?: string;
    volumeUsd?: number | null;
    closeTime?: string | null;
    status?: string;
    markets: JupiterPredictionMarket[];
}

export interface JupiterPredictionPosition {
    positionPubkey: string;
    eventId?: string;
    marketId?: string;
    eventTitle?: string;
    marketTitle?: string;
    side?: "YES" | "NO";
    quantity?: number | null;
    averagePrice?: number | null;
    currentPrice?: number | null;
    unrealizedPnlUsd?: number | null;
    claimablePayoutUsd?: number | null;
    status?: string;
}

export interface JupiterPredictionCreateOrderResponse {
    transaction?: string;
    orderPubkey?: string;
    requestId?: string;
    error?: string;
    [key: string]: unknown;
}

export interface JupiterPredictionOrderStatusResponse {
    orderPubkey?: string;
    status?: string;
    fillStatus?: string;
    error?: string;
    [key: string]: unknown;
}
