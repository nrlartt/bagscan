export const dynamic = "force-dynamic";
export { preferredRegion } from "../segment-config";

import { NextResponse } from "next/server";
import {
    getJupiterPredictionEvents,
    getJupiterPredictionTradingStatus,
} from "@/lib/jupiter/prediction";

export async function GET() {
    try {
        const [tradingStatus, events] = await Promise.all([
            getJupiterPredictionTradingStatus(),
            getJupiterPredictionEvents(48),
        ]);

        return NextResponse.json(
            {
                success: true,
                data: {
                    tradingStatus,
                    events,
                },
            },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            }
        );
    } catch (error) {
        console.error("[api/prediction/marketboard] error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Prediction marketboard could not be loaded.",
            },
            { status: 500 }
        );
    }
}
