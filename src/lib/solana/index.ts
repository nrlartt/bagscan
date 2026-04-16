/** Solana wallet configuration helpers. */

export const SOL_MINT = "So11111111111111111111111111111111111111112";

function getHeliusRpcUrl() {
    const key = process.env.HELIUS_API_KEY?.trim();
    return key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : null;
}

export function getRpcUrl(): string {
    return (
        getHeliusRpcUrl() ||
        process.env.SOLANA_RPC_URL ||
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
        "https://api.mainnet-beta.solana.com"
    );
}

export function getRpcCandidates(): string[] {
    return [
        getHeliusRpcUrl(),
        process.env.SOLANA_RPC_URL || null,
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || null,
        "https://api.mainnet-beta.solana.com",
    ].filter(Boolean) as string[];
}

export function getExplorerUrl(sig: string): string {
    return `https://solscan.io/tx/${sig}`;
}

export function getExplorerTokenUrl(mint: string): string {
    return `https://solscan.io/token/${mint}`;
}
