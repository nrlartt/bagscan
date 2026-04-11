export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { predictionClaimBodySchema } from "@/lib/validators";
import { claimJupiterPredictionPosition } from "@/lib/jupiter/prediction";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = predictionClaimBodySchema.parse(body);
        const result = await claimJupiterPredictionPosition(data);

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error("[api/prediction/claim] error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Prediction claim transaction could not be created.",
            },
            { status: 500 }
        );
    }
}
