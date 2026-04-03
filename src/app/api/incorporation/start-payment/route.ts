export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { startIncorporationPayment } from "@/lib/bags/client";
import { startIncorporationPaymentSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = startIncorporationPaymentSchema.parse(body);
        const payment = await startIncorporationPayment(data);
        return NextResponse.json({ success: true, data: payment });
    } catch (error) {
        console.error("[api/incorporation/start-payment] error:", error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
