import { NextRequest, NextResponse } from "next/server";
import { AlertAccessError, ensureAlertAccess } from "@/lib/alerts/access";
import { requireAlertSessionWallet } from "@/lib/alerts/auth";
import { getTelegramConnectState } from "@/lib/alerts/telegram";

export async function GET(request: NextRequest) {
    const wallet = requireAlertSessionWallet(request);
    if (!wallet) {
        return NextResponse.json(
            { success: false, error: "Alert session required" },
            { status: 401 }
        );
    }

    try {
        await ensureAlertAccess(wallet);
        const data = await getTelegramConnectState(wallet);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        if (error instanceof AlertAccessError) {
            return NextResponse.json(
                { success: false, error: error.message, data: error.access },
                { status: error.status }
            );
        }
        console.error("[api/alerts/telegram/connect] error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
