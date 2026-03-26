import { NextRequest, NextResponse } from "next/server";
import {
    getAlertState,
    updateAlertPreference,
} from "@/lib/alerts/engine";
import { AlertAccessError, ensureAlertAccess } from "@/lib/alerts/access";
import { requireAlertSessionWallet } from "@/lib/alerts/auth";
import type { AlertPreferenceUpdateInput } from "@/lib/alerts/types";

function parsePreferenceUpdate(body: Record<string, unknown>): AlertPreferenceUpdateInput {
    const toBoolean = (value: unknown) =>
        typeof value === "boolean" ? value : undefined;
    const toNumber = (value: unknown) => {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string") {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : undefined;
        }
        return undefined;
    };

    return {
        inAppEnabled: toBoolean(body.inAppEnabled),
        browserPushEnabled: toBoolean(body.browserPushEnabled),
        telegramEnabled: toBoolean(body.telegramEnabled),
        alphaHotEnabled: toBoolean(body.alphaHotEnabled),
        alphaCriticalEnabled: toBoolean(body.alphaCriticalEnabled),
        portfolioProfitEnabled: toBoolean(body.portfolioProfitEnabled),
        portfolioDrawdownEnabled: toBoolean(body.portfolioDrawdownEnabled),
        feesEnabled: toBoolean(body.feesEnabled),
        profitThresholdPercent: toNumber(body.profitThresholdPercent),
        drawdownThresholdPercent: toNumber(body.drawdownThresholdPercent),
        claimableFeesThresholdSol: toNumber(body.claimableFeesThresholdSol),
        telegramChatId:
            body.telegramChatId === null || typeof body.telegramChatId === "string"
                ? body.telegramChatId
                : undefined,
    };
}

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
        const state = await getAlertState(wallet, true);
        return NextResponse.json({ success: true, data: state });
    } catch (error) {
        if (error instanceof AlertAccessError) {
            return NextResponse.json(
                { success: false, error: error.message, data: error.access },
                { status: error.status }
            );
        }
        console.error("[api/alerts] get error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    const wallet = requireAlertSessionWallet(request);
    if (!wallet) {
        return NextResponse.json(
            { success: false, error: "Alert session required" },
            { status: 401 }
        );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    try {
        await ensureAlertAccess(wallet);
        await updateAlertPreference(wallet, parsePreferenceUpdate(body));
        const state = await getAlertState(wallet, false);
        return NextResponse.json({ success: true, data: state });
    } catch (error) {
        if (error instanceof AlertAccessError) {
            return NextResponse.json(
                { success: false, error: error.message, data: error.access },
                { status: error.status }
            );
        }
        console.error("[api/alerts] patch error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
