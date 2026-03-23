import { NextRequest, NextResponse } from "next/server";
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
        const data = await getTelegramConnectState(wallet);
        return NextResponse.json({ success: true, data });
    } catch (error) {
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
