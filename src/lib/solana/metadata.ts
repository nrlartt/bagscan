import { Connection, PublicKey } from "@solana/web3.js";

const METADATA_PROGRAM_ID = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export interface TokenMetadata {
    name: string;
    symbol: string;
    uri: string;
}

function getMetadataPDA(mint: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            METADATA_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
        ],
        METADATA_PROGRAM_ID
    );
    return pda;
}

function parseMetadata(data: Buffer): TokenMetadata | null {
    try {
        let offset = 1 + 32 + 32; // key + updateAuthority + mint

        const nameLen = data.readUInt32LE(offset);
        offset += 4;
        const name = data
            .subarray(offset, offset + nameLen)
            .toString("utf8")
            .replace(/\0/g, "")
            .trim();
        offset += nameLen;

        const symbolLen = data.readUInt32LE(offset);
        offset += 4;
        const symbol = data
            .subarray(offset, offset + symbolLen)
            .toString("utf8")
            .replace(/\0/g, "")
            .trim();
        offset += symbolLen;

        const uriLen = data.readUInt32LE(offset);
        offset += 4;
        const uri = data
            .subarray(offset, offset + uriLen)
            .toString("utf8")
            .replace(/\0/g, "")
            .trim();

        if (!name && !symbol) return null;

        return { name, symbol, uri };
    } catch {
        return null;
    }
}

/**
 * Batch-fetch Metaplex token metadata from chain.
 * Uses getMultipleAccounts (max 100 per call).
 */
export async function getTokenMetadataBatch(
    mints: string[],
    rpcUrl?: string
): Promise<Map<string, TokenMetadata>> {
    const url =
        rpcUrl ||
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
        "https://api.mainnet-beta.solana.com";
    const connection = new Connection(url, "confirmed");
    const result = new Map<string, TokenMetadata>();

    const BATCH = 100;
    for (let i = 0; i < mints.length; i += BATCH) {
        const batch = mints.slice(i, i + BATCH);
        const pdas = batch.map((m) => {
            try {
                return getMetadataPDA(new PublicKey(m));
            } catch {
                return null;
            }
        });

        const validPdas = pdas.filter((p): p is PublicKey => p !== null);
        if (validPdas.length === 0) continue;

        try {
            const accounts = await connection.getMultipleAccountsInfo(validPdas);
            let validIdx = 0;
            for (let j = 0; j < batch.length; j++) {
                if (!pdas[j]) continue;
                const acct = accounts[validIdx++];
                if (!acct?.data) continue;

                const meta = parseMetadata(Buffer.from(acct.data));
                if (meta) {
                    result.set(batch[j], meta);
                }
            }
        } catch (e) {
            console.error("[metadata] batch read error:", e);
        }
    }

    return result;
}
