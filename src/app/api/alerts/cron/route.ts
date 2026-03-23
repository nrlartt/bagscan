import { NextRequest, NextResponse } from "next/server";
import { runAlertsCron } from "@/lib/alerts/engine";

function isAuthorized(request: NextRequest) {
    const secret = process.env.ALERTS_CRON_SECRET;
    if (!secret) {
        return process.env.NODE_ENV !== "production";
    }

    const provided =
        request.headers.get("x-alerts-cron-secret") ||
        request.nextUrl.searchParams.get("key");

    return provided === secret;
}

export async function GET(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 100);

    try {
        const result = await runAlertsCron(
            Number.isFinite(limit) && limit > 0 ? Math.min(limit, 250) : 100
        );
        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("[api/alerts/cron] error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
