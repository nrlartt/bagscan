export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createPartnerClaimTx } from "@/lib/bags/client";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        if (body.secret !== process.env.BAGSCAN_ADMIN_SECRET) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        const partnerWallet = process.env.BAGSCAN_PARTNER_WALLET;
        const partnerConfig = process.env.BAGSCAN_PARTNER_CONFIG;

        if (!partnerWallet || !partnerConfig) {
            return NextResponse.json(
                { success: false, error: "Partner not configured" },
                { status: 400 }
            );
        }

        const result = await createPartnerClaimTx(partnerWallet);
        return NextResponse.json({ success: true, data: result });
    } catch (e) {
        console.error("[api/partner/claim] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}
