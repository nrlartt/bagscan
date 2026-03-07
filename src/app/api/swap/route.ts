export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { swapBodySchema } from "@/lib/validators";
import { createSwapTransaction } from "@/lib/bags/client";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = swapBodySchema.parse(body);
        const swap = await createSwapTransaction(data);
        return NextResponse.json({ success: true, data: swap });
    } catch (e) {
        console.error("[api/swap] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}
