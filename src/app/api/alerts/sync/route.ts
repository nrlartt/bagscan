import { NextRequest, NextResponse } from "next/server";
import {
    evaluateAlertsForWallet,
    getAlertState,
} from "@/lib/alerts/engine";
import { AlertAccessError, ensureAlertAccess } from "@/lib/alerts/access";
import { requireAlertSessionWallet } from "@/lib/alerts/auth";

export async function POST(request: NextRequest) {
    const wallet = requireAlertSessionWallet(request);
    if (!wallet) {
        return NextResponse.json(
            { success: false, error: "Alert session required" },
            { status: 401 }
        );
    }

    try {
        await ensureAlertAccess(wallet);
        const result = await evaluateAlertsForWallet(wallet, true);
        const state = await getAlertState(wallet, false);
        return NextResponse.json({
            success: true,
            data: {
                state,
                createdCount: result.created.length,
            },
        });
    } catch (error) {
        if (error instanceof AlertAccessError) {
            return NextResponse.json(
                { success: false, error: error.message, data: error.access },
                { status: error.status }
            );
        }
        console.error("[api/alerts/sync] error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
