export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAgentAuth } from "@/lib/agent/auth";
import { agentCreateTokenInfoSchema } from "@/lib/validators";
import { createTokenInfo } from "@/lib/bags/client";

export async function POST(req: NextRequest) {
    const authError = requireAgentAuth(req);
    if (authError) return authError;

    try {
        const body = await req.json();
        const data = agentCreateTokenInfoSchema.parse(body);

        const result = await createTokenInfo({
            name: data.name,
            symbol: data.symbol,
            description: data.description,
            imageUrl: data.imageUrl || undefined,
            metadataUrl: data.metadataUrl || undefined,
            website: data.website || undefined,
            twitter: data.twitter || undefined,
            telegram: data.telegram || undefined,
        });

        return NextResponse.json({ success: true, data: result });
    } catch (e) {
        console.error("[api/agent/v1/launch/create-token-info] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}

