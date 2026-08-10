export interface RhTokenMetadata {
    image: string | null;
    description: string | null;
}

export interface RhToken {
    address: string;
    name: string;
    symbol: string;
    metadataURI: string;
    metadata: RhTokenMetadata | null;
    curve: string;
    feeShare: string;
    poolId: string;
    creator: string;
    partner: string | null;
    partnerFeeBps: number;
    createdAtBlock: number;
    createdAtTimestamp: number;
    txHash: string;
    migrated: boolean;
    migratedAtBlock: number | null;
    migratedAtTimestamp: number | null;
    /** Curve program version, e.g. "v2" (present on portfolio payloads). */
    version?: string;
}

export interface RhTokenListItem extends RhToken {
    priceEthPerToken: string | null;
    bondingProgressPct: number;
}

export interface RhTokensResponse {
    items: RhTokenListItem[];
    total: number;
    totalTruncated: boolean;
}

export interface RhTokenState {
    exists: boolean;
    migrated: boolean;
    curve: string;
    feeShare: string;
    poolId: string;
    thresholdQuoteWei: string;
    realQuoteReservesWei: string;
    realTokenReservesWei: string;
    virtualTokenReservesWei: string;
    virtualQuoteReservesWei: string;
    priceEthPerToken: string | null;
    bondingProgressPct: number;
    totalRaisedWei: string;
}

export interface RhTokenDetailResponse {
    token: RhToken;
    state: RhTokenState;
}

// ── Wallet surfaces ──────────────────────────

export interface RhPortfolioHolding {
    token: RhTokenListItem;
    /** Token balance in base units (18 decimals). */
    balanceWei: string;
}

export interface RhPortfolioEarning {
    token: RhTokenListItem;
    feeShare: string;
    /** Unclaimed creator fees, in wei. */
    claimableWei: string;
    /** All-time creator fees, in wei. */
    lifetimeWei: string;
}

export interface RhPortfolioResponse {
    holdings: RhPortfolioHolding[];
    earnings: RhPortfolioEarning[];
    truncated: boolean;
}

export interface RhBalancesResponse {
    ethWei: string;
    wethWei: string;
    tokenWei: string | null;
}

// ── Trades ───────────────────────────────────

export interface RhTrade {
    id: string;
    kind: "buy" | "sell";
    /** "curve" while bonding, "pool" once graduated to Uniswap V4. */
    venue: string;
    account: string;
    ethWei: string;
    tokenWei: string;
    /** Decimal ETH per token — already scaled, unlike the fixed-18 token fields. */
    priceEthPerToken: string;
    blockNumber: number;
    timestamp: number;
    txHash: string;
    logIndex: number;
}

export interface RhTradesResponse {
    trades: RhTrade[];
    nextBeforeTs: number | null;
    nextBeforeId: string | null;
}

// ── Quotes ───────────────────────────────────

export type RhTradeSide = "buy" | "sell";

export interface RhQuoteResponse {
    side: RhTradeSide;
    /** "curve" while bonding, "pool" once graduated to Uniswap V4. */
    venue: string;
    /** Input amount in wei: ETH for a buy, tokens for a sell. */
    amountInWei: string;
    /** Expected output in wei: tokens for a buy, ETH for a sell. */
    amountOutWei: string;
    /** Null when the venue does not report a fee (pool quotes). */
    feeWei: string | null;
    asOfBlock: number;
}

export interface RhTokensQuery {
    limit?: number;
    offset?: number;
    migrated?: boolean;
    creator?: string;
    orderBy?: "createdAtTimestamp" | "migratedAtTimestamp";
    orderDirection?: "asc" | "desc";
}
