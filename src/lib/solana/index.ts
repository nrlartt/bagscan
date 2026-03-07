/** Solana wallet configuration helpers. */

export const SOL_MINT = "So11111111111111111111111111111111111111112";

export function getRpcUrl(): string {
    return (
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
        "https://api.mainnet-beta.solana.com"
    );
}

export function getExplorerUrl(sig: string): string {
    return `https://solscan.io/tx/${sig}`;
}

export function getExplorerTokenUrl(mint: string): string {
    return `https://solscan.io/token/${mint}`;
}
