export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { quoteBodySchema } from "@/lib/validators";
import { getQuote } from "@/lib/bags/client";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = quoteBodySchema.parse(body);
        const quote = await getQuote(data);
        return NextResponse.json({ success: true, data: quote });
    } catch (e) {
        console.error("[api/quote] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}
