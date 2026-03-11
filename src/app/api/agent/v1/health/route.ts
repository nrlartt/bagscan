export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAgentAuth } from "@/lib/agent/auth";

export async function GET(req: NextRequest) {
    const authError = requireAgentAuth(req);
    if (authError) return authError;

    return NextResponse.json({
        success: true,
        data: {
            service: "bagscan-agent-api",
            version: "v1",
            status: "ok",
            capabilities: [
                "quote",
                "swap:create-transaction",
                "tx:broadcast",
                "launch:create-token-info",
                "launch:create-transaction",
                "alpha:feed",
            ],
            timestamp: new Date().toISOString(),
        },
    });
}

