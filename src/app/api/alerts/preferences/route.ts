export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionWallet } from "@/lib/alerts/session";

export async function POST(req: NextRequest) {
    const wallet = await getSessionWallet();
    if (!wallet) {
        return NextResponse.json({ success: false, error: "Sign in to manage alerts" }, { status: 401 });
    }

    try {
        const body = (await req.json()) as {
            inAppEnabled?: boolean;
            pushEnabled?: boolean;
            telegramEnabled?: boolean;
            telegramChatId?: string | null;
        };

        const chatId = body.telegramChatId?.trim();
        if (chatId && !/^-?\d{1,20}$/.test(chatId)) {
            return NextResponse.json(
                { success: false, error: "Telegram chat id must be numeric" },
                { status: 400 }
            );
        }

        const subscriber = await prisma.rhSubscriber.upsert({
            where: { wallet },
            create: {
                wallet,
                inAppEnabled: body.inAppEnabled ?? true,
                pushEnabled: body.pushEnabled ?? false,
                telegramEnabled: body.telegramEnabled ?? false,
                telegramChatId: chatId || null,
            },
            update: {
                ...(body.inAppEnabled === undefined ? {} : { inAppEnabled: body.inAppEnabled }),
                ...(body.pushEnabled === undefined ? {} : { pushEnabled: body.pushEnabled }),
                ...(body.telegramEnabled === undefined ? {} : { telegramEnabled: body.telegramEnabled }),
                ...(body.telegramChatId === undefined ? {} : { telegramChatId: chatId || null }),
            },
        });

        return NextResponse.json({
            success: true,
            data: {
                inAppEnabled: subscriber.inAppEnabled,
                pushEnabled: subscriber.pushEnabled,
                telegramEnabled: subscriber.telegramEnabled,
                telegramChatId: subscriber.telegramChatId,
            },
        });
    } catch (error) {
        console.error("[api/alerts/preferences] error:", error);
        return NextResponse.json({ success: false, error: "Failed to save preferences" }, { status: 500 });
    }
}
