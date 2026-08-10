export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionWallet } from "@/lib/alerts/session";

interface SerializedSubscription {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
}

export async function POST(req: NextRequest) {
    const wallet = await getSessionWallet();
    if (!wallet) {
        return NextResponse.json({ success: false, error: "Sign in to manage alerts" }, { status: 401 });
    }

    try {
        const { subscription } = (await req.json()) as { subscription?: SerializedSubscription };
        const endpoint = subscription?.endpoint;
        const p256dh = subscription?.keys?.p256dh;
        const auth = subscription?.keys?.auth;

        if (!endpoint || !p256dh || !auth) {
            return NextResponse.json(
                { success: false, error: "Incomplete push subscription" },
                { status: 400 }
            );
        }

        await prisma.rhSubscriber.upsert({
            where: { wallet },
            create: { wallet, pushEnabled: true },
            update: { pushEnabled: true },
        });

        await prisma.rhPushSubscription.upsert({
            where: { endpoint },
            create: { endpoint, wallet, p256dh, auth },
            update: { wallet, p256dh, auth },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[api/alerts/push-subscription] error:", error);
        return NextResponse.json({ success: false, error: "Failed to save subscription" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const wallet = await getSessionWallet();
    if (!wallet) {
        return NextResponse.json({ success: false, error: "Sign in to manage alerts" }, { status: 401 });
    }

    const endpoint = req.nextUrl.searchParams.get("endpoint");
    if (!endpoint) {
        return NextResponse.json({ success: false, error: "Missing endpoint" }, { status: 400 });
    }

    await prisma.rhPushSubscription
        .deleteMany({ where: { endpoint, wallet } })
        .catch(() => undefined);

    return NextResponse.json({ success: true });
}
