import { Connection, PublicKey } from "@solana/web3.js";
import { getRpcUrl } from "@/lib/solana";

export interface TokenHolderAccessResult {
    wallet: string;
    mint: string;
    eligible: boolean;
    balanceUi: string;
    requiredUi: string;
    shortfallUi: string;
    amountRaw: string;
    thresholdRaw: string;
    decimals: number;
    checkedAt: string;
}

interface TokenHolderAccessInput {
    wallet: string;
    mint: string;
    minimumUi: number;
    cacheTtlMs?: number;
}

interface CachedAccessState {
    expiresAt: number;
    value: TokenHolderAccessResult;
}

const accessCache = new Map<string, CachedAccessState>();
const DEFAULT_CACHE_TTL_MS = 45_000;

function getRpcFallbackUrls(): string[] {
    const candidates = [
        getRpcUrl(),
        "https://api.mainnet-beta.solana.com",
        "https://solana-rpc.publicnode.com",
    ];

    return Array.from(
        new Set(
            candidates
                .map((url) => url.trim())
                .filter((url) => url.length > 0)
        )
    );
}

function parseRawAmount(value: unknown): bigint | null {
    if (typeof value === "string") {
        try {
            return BigInt(value);
        } catch {
            return null;
        }
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        return BigInt(Math.max(0, Math.floor(value)));
    }

    return null;
}

function formatTokenAmount(raw: bigint, decimals: number): string {
    const safeDecimals = Math.max(0, decimals);
    if (safeDecimals === 0) return raw.toString();

    const scale = BigInt(10) ** BigInt(safeDecimals);
    const whole = raw / scale;
    const fraction = raw % scale;

    if (fraction === BigInt(0)) {
        return whole.toString();
    }

    const fractionText = fraction
        .toString()
        .padStart(safeDecimals, "0")
        .replace(/0+$/, "");

    return `${whole.toString()}.${fractionText}`;
}

function parseUiAmountToRaw(value: number, decimals: number) {
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

function formatRpcAccessError(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error ?? "Unknown RPC error");
    if (/403|forbidden/i.test(raw)) {
        return "RPC access forbidden (403). Endpoint fallback also failed.";
    }
    return raw;
}

export async function getTokenHolderAccess({
    wallet,
    mint,
    minimumUi,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
}: TokenHolderAccessInput): Promise<TokenHolderAccessResult> {
    const cacheKey = `${wallet}:${mint}:${minimumUi}`;
    const cached = accessCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }

    const owner = new PublicKey(wallet);
    const mintKey = new PublicKey(mint);
    const rpcUrls = getRpcFallbackUrls();

    let tokenAccounts: Awaited<
        ReturnType<Connection["getParsedTokenAccountsByOwner"]>
    > | null = null;
    let lastError: unknown = null;

    for (const rpcUrl of rpcUrls) {
        try {
            const connection = new Connection(rpcUrl, "confirmed");
            tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                owner,
                { mint: mintKey }
            );
            break;
        } catch (error) {
            lastError = error;
        }
    }

    if (!tokenAccounts) {
        throw new Error(formatRpcAccessError(lastError));
    }

    let totalRaw = BigInt(0);
    let decimals = 0;

    for (const account of tokenAccounts.value) {
        const parsedData = account.account.data as {
            parsed?: {
                info?: {
                    tokenAmount?: {
                        amount?: string | number;
                        decimals?: number;
                    };
                };
            };
        };

        const tokenAmount = parsedData.parsed?.info?.tokenAmount;
        const rawAmount = parseRawAmount(tokenAmount?.amount);
        if (rawAmount === null) {
            continue;
        }

        totalRaw += rawAmount;
        if (typeof tokenAmount?.decimals === "number") {
            decimals = tokenAmount.decimals;
        }
    }

    const thresholdRaw = parseUiAmountToRaw(minimumUi, decimals);
    const shortfallRaw = totalRaw >= thresholdRaw ? BigInt(0) : thresholdRaw - totalRaw;
    const result: TokenHolderAccessResult = {
        wallet,
        mint,
        eligible: totalRaw >= thresholdRaw,
        balanceUi: formatTokenAmount(totalRaw, decimals),
        requiredUi: minimumUi.toLocaleString("en-US"),
        shortfallUi: formatTokenAmount(shortfallRaw, decimals),
        amountRaw: totalRaw.toString(),
        thresholdRaw: thresholdRaw.toString(),
        decimals,
        checkedAt: new Date().toISOString(),
    };

    accessCache.set(cacheKey, {
        expiresAt: Date.now() + cacheTtlMs,
        value: result,
    });

    return result;
}
