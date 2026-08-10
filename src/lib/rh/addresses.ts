/** Robinhood Chain launchpad protocol singletons (chain 4663). */
export const ROBINHOOD_LAUNCHPAD = {
    factory: "0xe8Cc4431adF8b5A847C113EF0c6af9043219Cb37",
    lens: "0xC82Db941dAf90B754aecb5F7D14c683dc608d595",
    hook: "0x2380aBf72C17aABAb76480244759AC7E2932EEcC",
    /** Robinhood-modified UniversalRouter fork (custom v4 swap struct). */
    universalRouter: "0x8876789976dEcBfCbBbe364623C63652db8C0904",
    v4Quoter: "0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94",
    stateView: "0xF3334192D15450CdD385c8B70e03f9A6bD9E673b",
    poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
} as const;

/** First protocol deploy block — lower bound for log scans. */
export const ROBINHOOD_DEPLOY_BLOCK = 7887312n;

/** Uniswap v4 PoolKey tuning — must match the factory byte-for-byte. */
export const ROBINHOOD_POOL = {
    dynamicFeeFlag: 0x800000,
    tickSpacing: 60,
} as const;

/** Max registry tokens scanned per list request (RPC budget guard). */
export const RH_REGISTRY_SCAN_CAP = 600;

/** Recent tokens checked for wallet holdings in portfolio reads. */
export const RH_PORTFOLIO_SCAN_TOKENS = 400;
