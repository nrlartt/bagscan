export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import bs58 from "bs58";
import { VersionedTransaction } from "@solana/web3.js";

const CONFIRMATION_ATTEMPTS = 18;
const CONFIRMATION_DELAY_MS = 1200;

const RPC_ENDPOINTS = [
    ...new Set(
        [
            process.env.HELIUS_API_KEY
                ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
                : null,
            process.env.SOLANA_RPC_URL || null,
            process.env.NEXT_PUBLIC_SOLANA_RPC_URL || null,
            "https://api.mainnet-beta.solana.com",
            "https://solana-mainnet.g.alchemy.com/v2/demo",
        ].filter(Boolean) as string[]
    ),
];

const SUBMIT_WAVES = 3;

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function deriveTransactionSignature(signedTransaction: string) {
    try {
        const bytes = Buffer.from(signedTransaction, "base64");
        const tx = VersionedTransaction.deserialize(bytes);
        const signature = tx.signatures[0];
        return signature ? bs58.encode(signature) : null;
    } catch {
        return null;
    }
}

function isAlreadyProcessedError(error: { code?: number; message?: string; data?: unknown } | string) {
    const serialized =
        typeof error === "string"
            ? error
            : JSON.stringify({
                  code: error.code,
                  message: error.message,
                  data: error.data,
              });

    return /alreadyprocessed|already been processed/i.test(serialized);
}

function isRateLimitedError(error: { code?: number; message?: string; data?: unknown } | string) {
    const serialized =
        typeof error === "string"
            ? error
            : JSON.stringify({
                  code: error.code,
                  message: error.message,
                  data: error.data,
              });

    return /429|too many requests|rate limit/i.test(serialized);
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

async function getSignatureStatus(rpc: string, signature: string) {
    const statusResponse = await rpcRequest<
        Array<{
            err: unknown;
            confirmationStatus?: "processed" | "confirmed" | "finalized";
        } | null>
    >(rpc, "getSignatureStatuses", [[signature], { searchTransactionHistory: true }]);

    return statusResponse.result?.[0] ?? null;
}

async function confirmKnownSignature(signature: string) {
    for (const rpc of RPC_ENDPOINTS) {
        try {
            await waitForConfirmation(rpc, signature);
            return { confirmed: true, rpc };
        } catch {
            try {
                const status = await getSignatureStatus(rpc, signature);
                if (status && !status.err) {
                    return { confirmed: false, rpc };
                }
            } catch {
                // Ignore and keep checking other RPCs.
            }
        }
    }

    return null;
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
        const derivedSignature = deriveTransactionSignature(signedTransaction);

        for (let wave = 0; wave < SUBMIT_WAVES; wave += 1) {
            for (const rpc of RPC_ENDPOINTS) {
                try {
                    const data = await rpcRequest<string>(rpc, "sendTransaction", [
                        signedTransaction,
                        { skipPreflight: false, encoding: "base64", preflightCommitment: "confirmed" },
                    ]);

                    if (data.result) {
                        const confirmation = await confirmKnownSignature(data.result);
                        return NextResponse.json({
                            success: true,
                            data: {
                                signature: data.result,
                                confirmed: confirmation?.confirmed ?? false,
                            },
                        });
                    }

                    if (data.error) {
                        lastError = JSON.stringify(data.error);
                        if (data.error.code === 403) continue;
                        if (isRateLimitedError(data.error)) continue;
                        if (derivedSignature && isAlreadyProcessedError(data.error)) {
                            const confirmation = await confirmKnownSignature(derivedSignature);
                            return NextResponse.json({
                                success: true,
                                data: {
                                    signature: derivedSignature,
                                    confirmed: confirmation?.confirmed ?? false,
                                    alreadyProcessed: true,
                                },
                            });
                        }
                        return NextResponse.json(
                            { success: false, error: lastError },
                            { status: 400 }
                        );
                    }
                } catch (e) {
                    lastError = String(e);
                    if (isRateLimitedError(lastError)) {
                        continue;
                    }
                    if (derivedSignature && isAlreadyProcessedError(lastError)) {
                        const confirmation = await confirmKnownSignature(derivedSignature);
                        return NextResponse.json({
                            success: true,
                            data: {
                                signature: derivedSignature,
                                confirmed: confirmation?.confirmed ?? false,
                                alreadyProcessed: true,
                            },
                        });
                    }
                    continue;
                }
            }

            if (wave < SUBMIT_WAVES - 1 && isRateLimitedError(lastError)) {
                await wait(900 * (wave + 1));
            } else {
                break;
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
