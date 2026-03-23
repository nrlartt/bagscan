export interface PortfolioHolding {
    mint: string;
    tokenAccount: string;
    amount: number;
    rawAmount: string;
    decimals: number;
    symbol?: string;
    name?: string;
    image?: string;
    priceUsd?: number;
    valueUsd?: number;
    costBasisUsd?: number;
    averageCostUsd?: number;
    unrealizedPnlUsd?: number;
    unrealizedPnlPercent?: number;
    costBasisStatus: "complete" | "partial" | "unknown";
    priceChange24h?: number;
    pnl24hUsd?: number;
    liquidityUsd?: number;
    volume24hUsd?: number;
}

export interface PortfolioClaimablePosition {
    baseMint: string;
    symbol?: string;
    name?: string;
    image?: string;
    claimableSol: number;
    claimableUsd: number;
    userBps?: number | null;
    isMigrated: boolean;
    isCustomFeeVault: boolean;
}

export interface PortfolioSummary {
    totalValueUsd: number;
    tokenValueUsd: number;
    solBalance: number;
    solValueUsd: number;
    totalCostBasisUsd: number;
    tokenCostBasisUsd: number;
    solCostBasisUsd: number;
    totalUnrealizedPnlUsd: number;
    totalUnrealizedPnlPercent: number;
    totalPnl24hUsd: number;
    totalPnl24hPercent: number;
    holdingsCount: number;
    pricedHoldingsCount: number;
    costBasisHoldingsCount: number;
    costBasisCompleteHoldingsCount: number;
    claimableFeesSol: number;
    claimableFeesUsd: number;
    claimablePositionsCount: number;
}

export interface PortfolioCostBasisMeta {
    method: "average-cost";
    historyComplete: boolean;
    transactionsScanned: number;
    pagesScanned: number;
    oldestTimestamp?: string;
    newestTimestamp?: string;
}

export interface PortfolioResponse {
    wallet: string;
    generatedAt: string;
    summary: PortfolioSummary;
    costBasis: PortfolioCostBasisMeta;
    holdings: PortfolioHolding[];
    claimablePositions: PortfolioClaimablePosition[];
}
