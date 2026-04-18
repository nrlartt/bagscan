export const dynamic = "force-dynamic";
/** EU regions — Jupiter Prediction API blocks US/KR server egress. See https://dev.jup.ag/docs/prediction */
export const preferredRegion = ["fra1", "cdg1", "arn1"];

import { NextRequest, NextResponse } from "next/server";
import { predictionPositionsQuerySchema } from "@/lib/validators";
import { getJupiterPredictionPositions } from "@/lib/jupiter/prediction";

export async function GET(req: NextRequest) {
    try {
        const ownerPubkey = req.nextUrl.searchParams.get("ownerPubkey") ?? "";
        const data = predictionPositionsQuerySchema.parse({ ownerPubkey });
        const positions = await getJupiterPredictionPositions(data.ownerPubkey);

        return NextResponse.json(
            {
                success: true,
                data: positions,
            },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            }
        );
    } catch (error) {
        console.error("[api/prediction/positions] error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Prediction positions could not be loaded.",
            },
            { status: 500 }
        );
    }
}
