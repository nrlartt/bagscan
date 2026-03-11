export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAgentAuth } from "@/lib/agent/auth";
import { swapBodySchema } from "@/lib/validators";
import { createSwapTransaction } from "@/lib/bags/client";

export async function POST(req: NextRequest) {
    const authError = requireAgentAuth(req);
    if (authError) return authError;

    try {
        const body = await req.json();
        const data = swapBodySchema.parse(body);
        const swap = await createSwapTransaction(data);
        return NextResponse.json({ success: true, data: swap });
    } catch (e) {
        console.error("[api/agent/v1/bags/swap] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}

