export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { predictionFundingExecuteBodySchema } from "@/lib/validators";
import { executeJupiterPredictionFundingOrder } from "@/lib/jupiter/swap";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = predictionFundingExecuteBodySchema.parse(body);
        const result = await executeJupiterPredictionFundingOrder(data);

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error("[api/prediction/funding-execute] error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Prediction funding execution failed.",
            },
            { status: 500 }
        );
    }
}
