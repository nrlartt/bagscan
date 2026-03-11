import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getRpcUrl } from "@/lib/solana";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SCAN_MINT = "BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS";
const MIN_SCAN_REQUIRED = BigInt(10_000_000);

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

    if (fraction === BigInt(0)) return whole.toString();

    const fractionText = fraction
        .toString()
        .padStart(safeDecimals, "0")
        .replace(/0+$/, "");

    return `${whole.toString()}.${fractionText}`;
}

function formatRpcAccessError(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error ?? "Unknown RPC error");
    if (/403|forbidden/i.test(raw)) {
        return "RPC access forbidden (403). Endpoint fallback also failed.";
    }
    return raw;
}

export async function GET(req: NextRequest) {
    const wallet = req.nextUrl.searchParams.get("wallet");
    if (!wallet) {
        return NextResponse.json(
            { success: false, error: "Missing wallet query parameter" },
            { status: 400 }
        );
    }

    let owner: PublicKey;
    let mint: PublicKey;
    try {
        owner = new PublicKey(wallet);
        mint = new PublicKey(SCAN_MINT);
    } catch {
        return NextResponse.json(
            { success: false, error: "Invalid wallet address" },
            { status: 400 }
        );
    }

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
                { mint }
            );
            break;
        } catch (error) {
            lastError = error;
        }
    }

    if (!tokenAccounts) {
        return NextResponse.json(
            { success: false, error: formatRpcAccessError(lastError) },
            { status: 502 }
        );
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
        if (rawAmount === null) continue;

        totalRaw += rawAmount;
        if (typeof tokenAmount?.decimals === "number") {
            decimals = tokenAmount.decimals;
        }
    }

    const thresholdRaw = MIN_SCAN_REQUIRED * (BigInt(10) ** BigInt(decimals));
    return NextResponse.json({
        success: true,
        data: {
            eligible: totalRaw >= thresholdRaw,
            balanceUi: formatTokenAmount(totalRaw, decimals),
            requiredUi: Number(MIN_SCAN_REQUIRED).toLocaleString("en-US"),
            mint: SCAN_MINT,
        },
    });
}
