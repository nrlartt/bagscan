import { NextRequest, NextResponse } from "next/server";
import { AlertAccessError, ensureAlertAccess } from "@/lib/alerts/access";
import { requireAlertSessionWallet } from "@/lib/alerts/auth";
import { sendTestAlert } from "@/lib/alerts/engine";
import type { AlertTestChannel } from "@/lib/alerts/types";

interface TestPayload {
    channel?: AlertTestChannel;
}

function isValidChannel(value: unknown): value is AlertTestChannel {
    return value === "inbox" || value === "push" || value === "telegram";
}

export async function POST(request: NextRequest) {
    const wallet = requireAlertSessionWallet(request);
    if (!wallet) {
        return NextResponse.json(
            { success: false, error: "Alert session required" },
            { status: 401 }
        );
    }

    const body = (await request.json().catch(() => ({}))) as TestPayload;
    if (!isValidChannel(body.channel)) {
        return NextResponse.json(
            { success: false, error: "Valid test channel is required" },
            { status: 400 }
        );
    }

    try {
        await ensureAlertAccess(wallet);
        const data = await sendTestAlert(wallet, body.channel);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        if (error instanceof AlertAccessError) {
            return NextResponse.json(
                { success: false, error: error.message, data: error.access },
                { status: error.status }
            );
        }
        console.error("[api/alerts/test] error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 400 }
        );
    }
}
