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
        const { id } = (await req.json().catch(() => ({}))) as { id?: string };

        await prisma.rhAlertNotification.updateMany({
            // No id marks the whole inbox read.
            where: id ? { wallet, id, readAt: null } : { wallet, readAt: null },
            data: { readAt: new Date() },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[api/alerts/read] error:", error);
        return NextResponse.json({ success: false, error: "Failed to mark read" }, { status: 500 });
    }
}
