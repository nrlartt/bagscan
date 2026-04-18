export const dynamic = "force-dynamic";
export { preferredRegion } from "../segment-config";

import { NextRequest, NextResponse } from "next/server";
import { predictionSettlementBodySchema } from "@/lib/validators";
import { getTokenBalanceRaw } from "@/lib/solana/mint";
import {
    getJupiterPredictionSettlementOrder,
    USDC_MINT,
} from "@/lib/jupiter/swap";
import { SCAN_MINT } from "@/lib/scan/constants";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = predictionSettlementBodySchema.parse(body);

        const baselineRaw = BigInt(data.baselineRaw);
        const currentBalance = await getTokenBalanceRaw(data.ownerPubkey, USDC_MINT);
        const deltaRaw = currentBalance.rawAmount - baselineRaw;

        if (deltaRaw <= BigInt(0)) {
            return NextResponse.json({
                success: true,
                data: {
                    skipped: true,
                    reason: "No new USDC settlement balance was detected after closing the position.",
                    currentRaw: currentBalance.rawAmount.toString(),
                    baselineRaw: baselineRaw.toString(),
                    deltaRaw: "0",
                },
            });
        }

        const settlementOrder = await getJupiterPredictionSettlementOrder({
            taker: data.ownerPubkey,
            amount: Number(deltaRaw),
            slippageBps: data.slippageBps ?? 250,
        });

        return NextResponse.json({
            success: true,
            data: {
                settlementOrder,
                inputMint: USDC_MINT,
                outputMint: SCAN_MINT,
                deltaRaw: deltaRaw.toString(),
                currentRaw: currentBalance.rawAmount.toString(),
                baselineRaw: baselineRaw.toString(),
            },
        });
    } catch (error) {
        console.error("[api/prediction/settlement] error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Prediction settlement swap could not be prepared.",
            },
            { status: 500 }
        );
    }
}
