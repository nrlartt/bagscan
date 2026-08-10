export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionWallet } from "@/lib/alerts/session";

/** Inbox + watch list + preferences for the signed-in wallet. */
export async function GET() {
    const wallet = await getSessionWallet();
    if (!wallet) {
        return NextResponse.json({ success: true, data: { signedIn: false } });
    }

    try {
        const [subscriber, watches, notifications, unreadCount] = await Promise.all([
            prisma.rhSubscriber.findUnique({ where: { wallet } }),
            prisma.rhWatch.findMany({ where: { wallet }, orderBy: { createdAt: "desc" } }),
            prisma.rhAlertNotification.findMany({
                where: { wallet },
                orderBy: { createdAt: "desc" },
                take: 50,
            }),
            prisma.rhAlertNotification.count({ where: { wallet, readAt: null } }),
        ]);

        return NextResponse.json(
            {
                success: true,
                data: {
                    signedIn: true,
                    wallet,
                    preferences: {
                        inAppEnabled: subscriber?.inAppEnabled ?? true,
                        pushEnabled: subscriber?.pushEnabled ?? false,
                        telegramEnabled: subscriber?.telegramEnabled ?? false,
                        telegramChatId: subscriber?.telegramChatId ?? null,
                    },
                    watches,
                    notifications,
                    unreadCount,
                },
            },
            { headers: { "Cache-Control": "private, no-store" } }
        );
    } catch (error) {
        console.error("[api/alerts] error:", error);
        return NextResponse.json({ success: false, error: "Failed to load alerts" }, { status: 500 });
    }
}
