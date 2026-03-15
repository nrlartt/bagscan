export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { feeShareConfigSchema } from "@/lib/validators";
import { createFeeShareConfig } from "@/lib/bags/client";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = feeShareConfigSchema.parse(body);

        const partnerWallet = process.env.BAGSCAN_PARTNER_WALLET;
        const partnerConfig = process.env.BAGSCAN_PARTNER_CONFIG;
        const includePartner = data.includePartner !== false;

        const result = await createFeeShareConfig({
            payer: data.payer,
            baseMint: data.baseMint,
            claimersArray: data.claimersArray,
            basisPointsArray: data.basisPointsArray,
            partner: includePartner ? (data.partner || partnerWallet || undefined) : undefined,
            partnerConfig: includePartner ? (data.partnerConfig || partnerConfig || undefined) : undefined,
            tipWallet: data.tipWallet || undefined,
            tipLamports: data.tipLamports,
        });

        return NextResponse.json({ success: true, data: result });
    } catch (e) {
        console.error("[api/launch/fee-share-config] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}
