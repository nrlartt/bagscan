export const dynamic = "force-dynamic";
/** EU regions — Jupiter Prediction API blocks US/KR server egress. See https://dev.jup.ag/docs/prediction */
export const preferredRegion = ["fra1", "cdg1", "arn1"];

import { NextRequest, NextResponse } from "next/server";
import {
    getJupiterPredictionEvent,
    getJupiterPredictionEvents,
    getJupiterPredictionTradingStatus,
} from "@/lib/jupiter/prediction";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;
        const [tradingStatus, event] = await Promise.all([
            getJupiterPredictionTradingStatus(),
            getJupiterPredictionEvent(eventId),
        ]);

        let relatedEvents: Awaited<ReturnType<typeof getJupiterPredictionEvents>> = [];
        try {
            const events = await getJupiterPredictionEvents(18);
            relatedEvents = events
                .filter((item) => item.eventId !== eventId)
                .filter(
                    (item) =>
                        (item.category ?? "").toLowerCase() ===
                        (event.category ?? "").toLowerCase()
                )
                .slice(0, 5);
        } catch (relatedError) {
            console.warn(
                "[api/prediction/event/[eventId]] related-events fallback:",
                relatedError
            );
        }

        return NextResponse.json(
            {
                success: true,
                data: {
                    tradingStatus,
                    event,
                    relatedEvents,
                },
            },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            }
        );
    } catch (error) {
        console.error("[api/prediction/event/[eventId]] error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Prediction event could not be loaded.",
            },
            { status: 500 }
        );
    }
}
