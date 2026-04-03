export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { startTokenIncorporation } from "@/lib/bags/client";
import { startIncorporationSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = startIncorporationSchema.parse(body);
        const result = await startTokenIncorporation(data.tokenAddress);
        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("[api/incorporation/start] error:", error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
