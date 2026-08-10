export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runAlertsEvaluation } from "@/lib/alerts/engine";

function authorized(req: NextRequest): boolean {
    const expected = process.env.ALERTS_CRON_SECRET;
    if (!expected) return false;

    const header = req.headers.get("authorization") ?? "";
    const provided = header.startsWith("Bearer ")
        ? header.slice(7)
        : (req.nextUrl.searchParams.get("secret") ?? "");

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

/** External cron entry point: evaluates every watched token once. */
export async function GET(req: NextRequest) {
    if (!authorized(req)) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const summary = await runAlertsEvaluation();
        return NextResponse.json({ success: true, data: summary });
    } catch (error) {
        console.error("[api/alerts/cron] error:", error);
        return NextResponse.json({ success: false, error: "Evaluation failed" }, { status: 500 });
    }
}

export const POST = GET;
