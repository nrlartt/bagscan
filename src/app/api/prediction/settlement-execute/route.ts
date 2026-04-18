export const dynamic = "force-dynamic";
export { preferredRegion } from "../segment-config";

import { NextRequest, NextResponse } from "next/server";
import { predictionSettlementExecuteBodySchema } from "@/lib/validators";
import { executeJupiterPredictionSettlementOrder } from "@/lib/jupiter/swap";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = predictionSettlementExecuteBodySchema.parse(body);
        const result = await executeJupiterPredictionSettlementOrder(data);

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error("[api/prediction/settlement-execute] error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Prediction settlement execution failed.",
            },
            { status: 500 }
        );
    }
}
