/* ──────────────────────────────────────────────
   Bags API v2 – Type definitions
   Aligned with https://docs.bags.fm/
   ────────────────────────────────────────────── */

export interface BagsApiResponse<T = unknown> {
    success: boolean;
    response?: T;
    error?: string | Record<string, unknown>;
}

// ── Pool (State endpoint) ────────────────────
export interface BagsPoolInfo {
    tokenMint: string;
    dbcConfigKey: string;
    dbcPoolKey: string;
    dammV2PoolKey?: string | null;
}

export interface BagsPool {
    tokenMint?: string;
    poolAddress?: string;
    name?: string;
    symbol?: string;
    image?: string;
    description?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
    creatorWallet?: string;
    creatorDisplayName?: string;
    creatorUsername?: string;
    creatorPfp?: string;
    provider?: string;
    providerUsername?: string;
    tokenPrice?: number;
    tokenPriceUsd?: number;
    fdv?: number;
    fdvUsd?: number;
    liquidity?: number;
    liquidityUsd?: number;
    volume24h?: number;
    volume24hUsd?: number;
    totalSupply?: number;
    royaltyBps?: number;
    isCreator?: boolean;
    isAdmin?: boolean;
    [key: string]: unknown;
}

export interface BagsPoolsResponse {
    pools?: BagsPool[];
    tokens?: BagsPool[];
    data?: BagsPool[];
    [key: string]: unknown;
}

// ── Creator v3 (Analytics) ───────────────────
export type SocialProvider =
    | "apple" | "google" | "email" | "solana"
    | "twitter" | "tiktok" | "kick" | "instagram"
    | "onlyfans" | "github" | "moltbook" | "unknown";

export interface BagsCreatorV3 {
    username: string;
    pfp: string;
    royaltyBps: number;
    isCreator: boolean;
    wallet: string;
    provider?: SocialProvider | null;
    providerUsername?: string | null;
    twitterUsername?: string;
    bagsUsername?: string;
    isAdmin?: boolean;
}

export interface BagsCreatorResponse {
    creatorWallet?: string;
    creatorDisplayName?: string;
    creatorUsername?: string;
    creatorPfp?: string;
    provider?: string;
    providerUsername?: string;
    royaltyBps?: number;
    isCreator?: boolean;
    isAdmin?: boolean;
    [key: string]: unknown;
}

// ── Claim Stats (Analytics) ──────────────────
export interface BagsClaimStatEntry {
    username: string;
    pfp: string;
    royaltyBps: number;
    isCreator: boolean;
    wallet: string;
    provider?: SocialProvider | null;
    providerUsername?: string | null;
    twitterUsername?: string;
    bagsUsername?: string;
    isAdmin?: boolean;
    totalClaimed: string;
}

export interface BagsClaimStatsResponse {
    claimCount?: number;
    claimVolume?: number;
    claimVolumeUsd?: number;
    [key: string]: unknown;
}

// ── Lifetime Fees (Analytics) ────────────────
export interface BagsLifetimeFeesResponse {
    lifetimeFees?: number;
    lifetimeFeesUsd?: number;
    [key: string]: unknown;
}

// ── Claim Events (Analytics) ─────────────────
export interface BagsClaimEvent {
    wallet: string;
    isCreator: boolean;
    amount: string;
    signature: string;
    timestamp: string;
}

export interface BagsClaimEventsResponse {
    events?: BagsClaimEvent[];
    claims?: BagsClaimEvent[];
    [key: string]: unknown;
}

// ── Claimable Positions (Fee Claiming) ───────
export interface BagsClaimablePosition {
    programId?: string;
    isCustomFeeVault: boolean;
    baseMint: string;
    quoteMint?: string | null;
    virtualPool?: string;
    isMigrated: boolean;
    totalClaimableLamportsUserShare: number;
    claimableDisplayAmount?: number | null;
    user?: string | null;
    claimerIndex?: number | null;
    userBps?: number | null;
}

// ── Trade ────────────────────────────────────
export interface BagsQuoteRequest {
    tokenMint: string;
    inputMint?: string;
    amount: number;
    slippageBps?: number;
}

export interface BagsQuoteResponse {
    inputAmount?: number;
    outputAmount?: number;
    priceImpact?: number;
    fee?: number;
    route?: unknown;
    [key: string]: unknown;
}

export interface BagsSwapRequest {
    tokenMint: string;
    userPublicKey: string;
    amount: number;
    slippageBps?: number;
    inputMint?: string;
}

export interface BagsSwapResponse {
    transaction?: string;
    serializedTransaction?: string;
    [key: string]: unknown;
}

// ── Launch ───────────────────────────────────

// POST /token-launch/create-token-info (multipart/form-data)
export interface BagsCreateTokenInfoRequest {
    name: string;
    symbol: string;
    description: string;
    imageUrl?: string;
    image?: File | Blob;
    metadataUrl?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
}

export interface BagsCreateTokenInfoResponse {
    tokenMint: string;
    tokenMetadata: string;
    tokenLaunch?: {
        name: string;
        symbol: string;
        description: string;
        image: string;
        tokenMint: string;
        status: string;
        createdAt: string;
        updatedAt: string;
    };
    [key: string]: unknown;
}

// POST /fee-share/config
export interface BagsFeeShareConfigRequest {
    payer: string;
    baseMint: string;
    claimersArray: string[];
    basisPointsArray: number[];
    partner?: string;
    partnerConfig?: string;
    additionalLookupTables?: string[];
    tipWallet?: string;
    tipLamports?: number;
}

export interface BagsFeeShareConfigTransaction {
    blockhash: { blockhash: string; lastValidBlockHeight: number };
    transaction: string;
}

export interface BagsFeeShareConfigResponse {
    needsCreation: boolean;
    feeShareAuthority: string;
    meteoraConfigKey: string;
    transactions?: BagsFeeShareConfigTransaction[];
    bundles?: BagsFeeShareConfigTransaction[][];
    [key: string]: unknown;
}

// POST /token-launch/create-launch-transaction
export interface BagsLaunchRequest {
    ipfs: string;
    tokenMint: string;
    wallet: string;
    initialBuyLamports: number;
    configKey: string;
    tipWallet?: string;
    tipLamports?: number;
}

// Response is a base58 encoded serialized transaction string
export type BagsLaunchResponse = string;

// ── Partner ──────────────────────────────────
export interface BagsPartnerStatsResponse {
    partnerWallet?: string;
    partnerConfig?: string;
    claimedFees?: number;
    claimedFeesUsd?: number;
    unclaimedFees?: number;
    unclaimedFeesUsd?: number;
    totalLaunches?: number;
    [key: string]: unknown;
}

export interface BagsPartnerClaimResponse {
    transaction?: string;
    serializedTransaction?: string;
    [key: string]: unknown;
}

// ── Helius DAS (token metadata) ──────────────
export interface HeliusTokenInfo {
    supply?: number;
    decimals?: number;
    tokenProgram?: string;
}

export interface HeliusAsset {
    id: string;
    content?: {
        metadata?: {
            name?: string;
            symbol?: string;
            description?: string;
        };
        links?: {
            image?: string;
            external_url?: string;
        };
        files?: Array<{ uri?: string; cdn_uri?: string; mime?: string }>;
    };
    token_info?: HeliusTokenInfo;
    ownership?: {
        owner?: string;
    };
}

// ── Normalized internal type ─────────────────
export interface NormalizedToken {
    tokenMint: string;
    poolAddress?: string;
    name?: string;
    symbol?: string;
    image?: string;
    description?: string;
    website?: string;
    twitter?: string;
    telegram?: string;

    // Pool state
    dbcConfigKey?: string;
    dbcPoolKey?: string;
    dammV2PoolKey?: string | null;
    isMigrated?: boolean;

    // Creator info (primary creator)
    creatorWallet?: string;
    creatorDisplay?: string;
    creatorUsername?: string;
    creatorPfp?: string;
    provider?: string;
    providerUsername?: string;
    twitterUsername?: string;
    bagsUsername?: string;
    royaltyBps?: number;
    isCreator?: boolean;
    isAdmin?: boolean;

    // All creators/claimers
    creators?: BagsCreatorV3[];

    // Claim stats per claimer
    claimStats?: BagsClaimStatEntry[];

    // Market data
    priceUsd?: number;
    fdvUsd?: number;
    liquidityUsd?: number;
    volume24hUsd?: number;
    marketCap?: number;

    // Fees & claims
    lifetimeFeesLamports?: string;
    lifetimeFeesSol?: number;
    lifetimeFees?: number;
    claimCount?: number;
    claimVolume?: number;
    latestClaimAt?: string;

    // Helius metadata
    totalSupply?: number;
    decimals?: number;
    holderCount?: number;

    // DexScreener extra
    pairAddress?: string;
    dexId?: string;
    priceChange24h?: number;
    txCount24h?: number;
    buyCount24h?: number;
    sellCount24h?: number;
    pairCreatedAt?: string;

    raw?: unknown;
}
