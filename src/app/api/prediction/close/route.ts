export const dynamic = "force-dynamic";
/** EU regions — Jupiter Prediction API blocks US/KR server egress. See https://dev.jup.ag/docs/prediction */
export const preferredRegion = ["fra1", "cdg1", "arn1"];

import { NextRequest, NextResponse } from "next/server";
import { predictionCloseBodySchema } from "@/lib/validators";
import { closeJupiterPredictionPosition } from "@/lib/jupiter/prediction";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = predictionCloseBodySchema.parse(body);
        const result = await closeJupiterPredictionPosition(data);

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error("[api/prediction/close] error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Prediction close transaction could not be created.",
            },
            { status: 500 }
        );
    }
}
