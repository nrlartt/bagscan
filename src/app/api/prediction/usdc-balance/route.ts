export const dynamic = "force-dynamic";
/** EU regions — Jupiter Prediction API blocks US/KR server egress. See https://dev.jup.ag/docs/prediction */
export const preferredRegion = ["fra1", "cdg1", "arn1"];

import { NextRequest, NextResponse } from "next/server";
import { predictionTokenBalanceQuerySchema } from "@/lib/validators";
import { getTokenBalanceRaw } from "@/lib/solana/mint";
import { USDC_MINT } from "@/lib/jupiter/swap";

export async function GET(req: NextRequest) {
    try {
        const ownerPubkey = req.nextUrl.searchParams.get("ownerPubkey") ?? "";
        const data = predictionTokenBalanceQuerySchema.parse({ ownerPubkey });
        const balance = await getTokenBalanceRaw(data.ownerPubkey, USDC_MINT);

        return NextResponse.json({
            success: true,
            data: {
                mint: USDC_MINT,
                rawAmount: balance.rawAmount.toString(),
                uiAmount: balance.uiAmount,
                decimals: balance.decimals,
            },
        });
    } catch (error) {
        console.error("[api/prediction/usdc-balance] error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "USDC balance could not be loaded.",
            },
            { status: 500 }
        );
    }
}
