export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAgentAuth } from "@/lib/agent/auth";

const sendTxBodySchema = z.object({
    signedTransaction: z.string().min(1),
});

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

export async function POST(req: NextRequest) {
    const authError = requireAgentAuth(req);
    if (authError) return authError;

    try {
        const body = await req.json();
        const { signedTransaction } = sendTxBodySchema.parse(body);

        let lastError = "";

        for (let wave = 0; wave < SUBMIT_WAVES; wave += 1) {
            for (const rpc of RPC_ENDPOINTS) {
                try {
                    const res = await fetch(rpc, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            jsonrpc: "2.0",
                            id: 1,
                            method: "sendTransaction",
                            params: [
                                signedTransaction,
                                { skipPreflight: true, encoding: "base64" },
                            ],
                        }),
                    });

                    const data = await res.json();

                    if (data.result) {
                        return NextResponse.json({
                            success: true,
                            data: {
                                signature: data.result,
                                rpcEndpoint: rpc,
                            },
                        });
                    }

                    if (data.error) {
                        lastError = JSON.stringify(data.error);
                        if (data.error.code === 403) continue;
                        if (isRateLimitedError(data.error)) continue;
                        return NextResponse.json(
                            { success: false, error: lastError },
                            { status: 400 }
                        );
                    }
                } catch (e) {
                    lastError = String(e);
                    if (isRateLimitedError(lastError)) continue;
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
        console.error("[api/agent/v1/rpc/send-transaction] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}

