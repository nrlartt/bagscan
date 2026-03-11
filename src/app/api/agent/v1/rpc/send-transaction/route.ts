export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAgentAuth } from "@/lib/agent/auth";

const sendTxBodySchema = z.object({
    signedTransaction: z.string().min(1),
});

const RPC_ENDPOINTS = [
    process.env.HELIUS_API_KEY
        ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
        : null,
    process.env.SOLANA_RPC_URL || null,
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || null,
    "https://api.mainnet-beta.solana.com",
    "https://solana-mainnet.g.alchemy.com/v2/demo",
].filter(Boolean) as string[];

export async function POST(req: NextRequest) {
    const authError = requireAgentAuth(req);
    if (authError) return authError;

    try {
        const body = await req.json();
        const { signedTransaction } = sendTxBodySchema.parse(body);

        let lastError = "";

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
        console.error("[api/agent/v1/rpc/send-transaction] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}

