/**
 * Robinhood Chain protocol singletons — stable addresses from the Bags address book.
 * @see https://docs.bags.fm/robinhood/setup
 */
export const ROBINHOOD_LAUNCHPAD = {
    /** Robinhood-modified UniversalRouter fork (custom v4 swap struct). */
    universalRouter: "0x8876789976dEcBfCbBbe364623C63652db8C0904",
    /** v4-periphery quoter (off-chain quoting only). */
    v4Quoter: "0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94",
    /** Singleton v4 hook shared by all Bags pools. */
    hook: "0x2380aBf72C17aABAb76480244759AC7E2932EEcC",
    /** Canonical Permit2 — spender route for UniversalRouter ERC-20 inputs. */
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    /** aeWETH upgradeable proxy — WETH9-compatible interface. */
    weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
} as const;

/** Uniswap v4 PoolKey tuning for Bags pools. Must match the factory byte-for-byte. */
export const ROBINHOOD_POOL = {
    dynamicFeeFlag: 0x800000,
    tickSpacing: 60,
} as const;
