export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { predictionOrderBodySchema } from "@/lib/validators";
import { createJupiterPredictionOrder } from "@/lib/jupiter/prediction";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = predictionOrderBodySchema.parse(body);
        const result = await createJupiterPredictionOrder(data);

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error("[api/prediction/order] error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Prediction order could not be created.",
            },
            { status: 500 }
        );
    }
}
