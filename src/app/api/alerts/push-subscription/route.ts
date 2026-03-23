import { NextRequest, NextResponse } from "next/server";
import {
    deletePushSubscription,
    savePushSubscription,
} from "@/lib/alerts/engine";
import { requireAlertSessionWallet } from "@/lib/alerts/auth";

interface PushSubscriptionPayload {
    endpoint?: string;
    expirationTime?: number | null;
    keys?: {
        p256dh?: string;
        auth?: string;
    };
}

interface SaveBody {
    subscription?: PushSubscriptionPayload;
}

interface DeleteBody {
    endpoint?: string;
}

export async function POST(request: NextRequest) {
    const wallet = requireAlertSessionWallet(request);
    if (!wallet) {
        return NextResponse.json(
            { success: false, error: "Alert session required" },
            { status: 401 }
        );
    }

    const body = (await request.json().catch(() => ({}))) as SaveBody;
    if (!body.subscription) {
        return NextResponse.json(
            { success: false, error: "Missing push subscription payload" },
            { status: 400 }
        );
    }

    try {
        await savePushSubscription(
            wallet,
            body.subscription,
            request.headers.get("user-agent")
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 400 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    const wallet = requireAlertSessionWallet(request);
    if (!wallet) {
        return NextResponse.json(
            { success: false, error: "Alert session required" },
            { status: 401 }
        );
    }

    const body = (await request.json().catch(() => ({}))) as DeleteBody;
    const endpoint = body.endpoint?.trim();
    if (!endpoint) {
        return NextResponse.json(
            { success: false, error: "Missing subscription endpoint" },
            { status: 400 }
        );
    }

    await deletePushSubscription(wallet, endpoint);
    return NextResponse.json({ success: true });
}
