export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createTokenInfoSchema } from "@/lib/validators";
import { createTokenInfo } from "@/lib/bags/client";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = createTokenInfoSchema.parse(body);
        const result = await createTokenInfo({
            name: data.name,
            symbol: data.symbol,
            description: data.description,
            imageUrl: data.imageUrl || undefined,
            website: data.website || undefined,
            twitter: data.twitter || undefined,
            telegram: data.telegram || undefined,
        });
        return NextResponse.json({ success: true, data: result });
    } catch (e) {
        console.error("[api/launch/create-token-info] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}
