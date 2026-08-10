/**
 * The normalized token shape every BagScan surface renders.
 *
 * Robinhood Chain launches are uniform: a fixed 1B supply on a per-token bonding
 * curve contract, quoted in ETH, graduating into a Uniswap V4 pool. That lets
 * this type stay small and honest — no market-cap field, because nothing on this
 * chain reports one; valuation is always fully diluted from the spot price.
 */
export interface RhTokenView {
    /** ERC-20 contract address (checksummed, as returned upstream). */
    address: string;
    name?: string;
    symbol?: string;
    image?: string;
    description?: string;

    /** Launch wallet. */
    creator?: string;
    /** Fee-share contract that accrues creator fees. */
    feeShare?: string;
    /** Per-token bonding curve contract — the buy/sell target while bonding. */
    curve?: string;
    /** Uniswap V4 pool id, set once the curve graduates. */
    poolId?: string;

    isMigrated: boolean;
    /** 0–100 curve completion; always 100 once migrated. */
    bondingProgressPct?: number;

    /** Raw fixed-18 ETH per token, exactly as the API returns it. */
    priceEthPerToken?: string;
    /** Parsed ETH per token. */
    priceEth?: number;
    priceUsd?: number;
    /** Price × the fixed 1B supply. Fully diluted by construction. */
    fdvUsd?: number;

    createdAt?: string;
    migratedAt?: string;
}

/** Every Robinhood Chain launch mints this fixed supply. */
export const RH_TOTAL_SUPPLY = 1_000_000_000;

/** Both the ERC-20 tokens and native ETH use 18 decimals on this chain. */
export const RH_DECIMALS = 18;
