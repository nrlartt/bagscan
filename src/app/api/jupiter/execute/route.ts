export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jupiterExecuteBodySchema } from "@/lib/validators";
import { executeJupiterOrder } from "@/lib/jupiter/swap";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = jupiterExecuteBodySchema.parse(body);
        const result = await executeJupiterOrder(data);
        return NextResponse.json({ success: true, data: result });
    } catch (e) {
        console.error("[api/jupiter/execute] error:", e);
        return NextResponse.json(
            { success: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 }
        );
    }
}
