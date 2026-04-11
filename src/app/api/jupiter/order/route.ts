export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jupiterOrderBodySchema } from "@/lib/validators";
import { getJupiterOrder } from "@/lib/jupiter/swap";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = jupiterOrderBodySchema.parse(body);
        const order = await getJupiterOrder(data);
        return NextResponse.json({ success: true, data: order });
    } catch (e) {
        console.error("[api/jupiter/order] error:", e);
        return NextResponse.json(
            { success: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 }
        );
    }
}
