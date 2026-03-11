export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAgentAuth } from "@/lib/agent/auth";
import { generateAlphaFeed } from "@/lib/alpha/engine";

export async function GET(req: NextRequest) {
    const authError = requireAgentAuth(req);
    if (authError) return authError;

    try {
        const feed = await generateAlphaFeed();
        return NextResponse.json({ success: true, data: feed });
    } catch (e) {
        console.error("[api/agent/v1/alpha/feed] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}

