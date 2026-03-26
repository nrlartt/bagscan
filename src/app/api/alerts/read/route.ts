import { NextRequest, NextResponse } from "next/server";
import { markAlertsRead } from "@/lib/alerts/engine";
import { AlertAccessError, ensureAlertAccess } from "@/lib/alerts/access";
import { requireAlertSessionWallet } from "@/lib/alerts/auth";

interface ReadPayload {
    ids?: string[];
    all?: boolean;
}

export async function POST(request: NextRequest) {
    const wallet = requireAlertSessionWallet(request);
    if (!wallet) {
        return NextResponse.json(
            { success: false, error: "Alert session required" },
            { status: 401 }
        );
    }

    const body = (await request.json().catch(() => ({}))) as ReadPayload;

    try {
        await ensureAlertAccess(wallet);
        await markAlertsRead(wallet, {
            ids: Array.isArray(body.ids) ? body.ids : undefined,
            all: Boolean(body.all),
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AlertAccessError) {
            return NextResponse.json(
                { success: false, error: error.message, data: error.access },
                { status: error.status }
            );
        }
        console.error("[api/alerts/read] error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
