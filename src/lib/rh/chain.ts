/**
 * Robinhood Chain — the only network BagScan targets.
 *
 * `explorer.robinhood.com` does not resolve; the working explorers are the
 * Blockscout instance and hoodscan.ai, verified against chainid.network's
 * registry entry for chain 4663.
 */
export const RH_CHAIN_ID = 4663;

export const RH_CHAIN_NAME = "Robinhood Chain";

export const RH_NATIVE_CURRENCY = { name: "Ether", symbol: "ETH", decimals: 18 } as const;

/** Public RPCs, in preference order. All verified to answer `eth_chainId` = 4663. */
export const RH_RPC_URLS = [
    "https://rpc.mainnet.chain.robinhood.com",
    "https://robinhood-rpc.publicnode.com",
    "https://rpc.arrowrpc.com",
] as const;

/** Server-side RPC override, else the first public endpoint. */
export function rhRpcUrl(): string {
    return process.env.RH_RPC_URL?.trim() || RH_RPC_URLS[0];
}

export const RH_EXPLORER_URL = "https://robinhoodchain.blockscout.com";

export function rhExplorerAddressUrl(address: string): string {
    return `${RH_EXPLORER_URL}/address/${address}`;
}

export function rhExplorerTokenUrl(address: string): string {
    return `${RH_EXPLORER_URL}/token/${address}`;
}

export function rhExplorerTxUrl(hash: string): string {
    return `${RH_EXPLORER_URL}/tx/${hash}`;
}

/** Uniswap V4 pools are keyed by id, not address — link to the pool's token page. */
export function rhExplorerPoolUrl(tokenAddress: string): string {
    return `${RH_EXPLORER_URL}/token/${tokenAddress}`;
}

export function isEvmAddress(value: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

/** Brand accent for Robinhood surfaces. */
export const RH_THEME = {
    green: "#00C805",
    greenDim: "rgba(0,200,5,0.12)",
    greenBorder: "rgba(0,200,5,0.28)",
    greenGlow: "rgba(0,200,5,0.14)",
} as const;
