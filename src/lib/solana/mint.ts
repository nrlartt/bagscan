import { Connection, ParsedAccountData, PublicKey } from "@solana/web3.js";
import { getRpcCandidates } from "./index";

const TOKEN_PROGRAM_ID = new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

function isParsedTokenAccountData(data: unknown): data is ParsedAccountData {
    return typeof data === "object" && data !== null && "parsed" in data;
}

function isRpcRateLimitError(error: unknown) {
    const detail =
        error instanceof Error
            ? error.message
            : typeof error === "string"
                ? error
                : JSON.stringify(error);

    return /429|too many requests|rate limit/i.test(detail);
}

export async function getMintDecimals(mint: string): Promise<number> {
    let lastError: unknown = null;

    for (const rpc of getRpcCandidates()) {
        try {
            const connection = new Connection(rpc, "confirmed");
            const response = await connection.getParsedAccountInfo(new PublicKey(mint), "confirmed");
            const parsed = response.value?.data as
                | {
                      parsed?: {
                          info?: {
                              decimals?: unknown;
                          };
                      };
                  }
                | undefined;

            const decimals = parsed?.parsed?.info?.decimals;
            return typeof decimals === "number" ? decimals : 6;
        } catch (error) {
            lastError = error;
            if (!isRpcRateLimitError(error)) {
                break;
            }
        }
    }

    if (lastError) {
        throw lastError;
    }

    return 6;
}

export function parseUiAmountToRaw(value: number, decimals: number) {
    const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
    const [wholePart, fractionPart = ""] = safeValue.toString().split(".");
    const normalizedFraction = fractionPart
        .replace(/[^0-9]/g, "")
        .slice(0, decimals)
        .padEnd(decimals, "0");

    const scale = BigInt(10) ** BigInt(decimals);
    const wholeRaw = BigInt(wholePart || "0") * scale;
    const fractionRaw = normalizedFraction ? BigInt(normalizedFraction) : BigInt(0);

    return wholeRaw + fractionRaw;
}

export function formatRawAmountToUi(raw: bigint, decimals: number) {
    if (decimals <= 0) return raw.toString();

    const scale = BigInt(10) ** BigInt(decimals);
    const whole = raw / scale;
    const fraction = raw % scale;

    if (fraction === BigInt(0)) {
        return whole.toString();
    }

    return `${whole.toString()}.${fraction
        .toString()
        .padStart(decimals, "0")
        .replace(/0+$/, "")}`;
}

export async function getTokenBalanceRaw(ownerPubkey: string, mint: string) {
    const owner = new PublicKey(ownerPubkey);
    let lastError: unknown = null;

    for (const rpc of getRpcCandidates()) {
        try {
            const connection = new Connection(rpc, "confirmed");
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                owner,
                { programId: TOKEN_PROGRAM_ID },
                "confirmed"
            );

            let rawAmount = BigInt(0);
            let decimals = 6;

            for (const entry of tokenAccounts.value) {
                if (!isParsedTokenAccountData(entry.account.data)) continue;

                const info = entry.account.data.parsed.info as {
                    mint?: string;
                    tokenAmount?: {
                        amount?: string;
                        decimals?: number;
                    };
                };

                if (info.mint !== mint || !info.tokenAmount) continue;

                decimals = info.tokenAmount.decimals ?? decimals;
                rawAmount += BigInt(info.tokenAmount.amount ?? "0");
            }

            return {
                rawAmount,
                decimals,
                uiAmount: formatRawAmountToUi(rawAmount, decimals),
            };
        } catch (error) {
            lastError = error;
            if (!isRpcRateLimitError(error)) {
                break;
            }
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error("Token balance could not be loaded from the configured Solana RPC.");
}
