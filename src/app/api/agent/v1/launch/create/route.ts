export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAgentAuth } from "@/lib/agent/auth";
import { createLaunchSchema } from "@/lib/validators";
import { createLaunchTransaction } from "@/lib/bags/client";

export async function POST(req: NextRequest) {
    const authError = requireAgentAuth(req);
    if (authError) return authError;

    try {
        const body = await req.json();
        const data = createLaunchSchema.parse(body);

        const result = await createLaunchTransaction({
            ipfs: data.ipfs,
            tokenMint: data.tokenMint,
            wallet: data.wallet,
            initialBuyLamports: data.initialBuyLamports,
            configKey: data.configKey,
        });

        return NextResponse.json({ success: true, data: result });
    } catch (e) {
        console.error("[api/agent/v1/launch/create] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}

