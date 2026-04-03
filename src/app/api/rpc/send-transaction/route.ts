export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

const CONFIRMATION_ATTEMPTS = 18;
const CONFIRMATION_DELAY_MS = 1200;

const RPC_ENDPOINTS = [
    process.env.HELIUS_API_KEY
        ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
        : null,
    process.env.SOLANA_RPC_URL || null,
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || null,
    "https://api.mainnet-beta.solana.com",
    "https://solana-mainnet.g.alchemy.com/v2/demo",
].filter(Boolean) as string[];

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rpcRequest<T>(rpc: string, method: string, params: unknown[]) {
    const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method,
            params,
        }),
    });

    return (await res.json()) as {
        result?: T;
        error?: { code?: number; message?: string; data?: unknown };
    };
}

async function waitForConfirmation(rpc: string, signature: string) {
    for (let attempt = 0; attempt < CONFIRMATION_ATTEMPTS; attempt += 1) {
        const statusResponse = await rpcRequest<Array<{
            err: unknown;
            confirmationStatus?: "processed" | "confirmed" | "finalized";
        } | null>>(rpc, "getSignatureStatuses", [[signature], { searchTransactionHistory: true }]);

        const status = statusResponse.result?.[0];

        if (status?.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
        }

        if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
            return;
        }

        await wait(CONFIRMATION_DELAY_MS);
    }

    throw new Error("Timed out while waiting for transaction confirmation");
}

export async function POST(req: NextRequest) {
    try {
        const { signedTransaction } = await req.json();
        if (!signedTransaction) {
            return NextResponse.json(
                { success: false, error: "Missing signedTransaction" },
                { status: 400 }
            );
        }

        let lastError = "";

        for (const rpc of RPC_ENDPOINTS) {
            try {
                const data = await rpcRequest<string>(rpc, "sendTransaction", [
                    signedTransaction,
                    { skipPreflight: false, encoding: "base64", preflightCommitment: "confirmed" },
                ]);

                if (data.result) {
                    await waitForConfirmation(rpc, data.result);
                    return NextResponse.json({
                        success: true,
                        data: { signature: data.result },
                    });
                }

                if (data.error) {
                    lastError = JSON.stringify(data.error);
                    if (data.error.code === 403) continue;
                    return NextResponse.json(
                        { success: false, error: lastError },
                        { status: 400 }
                    );
                }
            } catch (e) {
                lastError = String(e);
                continue;
            }
        }

        return NextResponse.json(
            { success: false, error: `All RPC endpoints failed: ${lastError}` },
            { status: 502 }
        );
    } catch (e) {
        console.error("[api/rpc/send-transaction] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}
