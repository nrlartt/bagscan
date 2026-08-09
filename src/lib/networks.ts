export type BagScanNetwork = "solana" | "robinhood";

export const BAGSCAN_NETWORKS: Record<
    BagScanNetwork,
    {
        id: BagScanNetwork;
        label: string;
        shortLabel: string;
        chainId?: number;
        explorerTokenUrl: (address: string) => string;
        launchUrl: string;
    }
> = {
    solana: {
        id: "solana",
        label: "Solana",
        shortLabel: "Solana",
        explorerTokenUrl: (mint) => `https://solscan.io/token/${mint}`,
        launchUrl: "/launch",
    },
    robinhood: {
        id: "robinhood",
        label: "Robinhood",
        shortLabel: "Robinhood",
        chainId: 4663,
        explorerTokenUrl: (address) => `https://explorer.robinhood.com/address/${address}`,
        launchUrl: "https://bags.fm/?network=robinhood",
    },
};

export const DEFAULT_NETWORK: BagScanNetwork = "solana";

export const NETWORK_STORAGE_KEY = "bagscan-network";

export function isEvmAddress(value: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function parseStoredNetwork(value: string | null): BagScanNetwork {
    if (value === "robinhood" || value === "solana") return value;
    return DEFAULT_NETWORK;
}
