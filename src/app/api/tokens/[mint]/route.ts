export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { syncTokenDetail, getTokenSnapshots } from "@/lib/sync";
import { getClaimEvents } from "@/lib/bags/client";
import { prisma } from "@/lib/db";
import type { TokenSnapshot } from "@prisma/client";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ mint: string }> }
) {
    try {
        const { mint } = await params;
        if (!mint) {
            return NextResponse.json(
                { success: false, error: "Missing mint" },
                { status: 400 }
            );
        }

        const token = await syncTokenDetail(mint);
        if (!token) {
            return NextResponse.json(
                { success: false, error: "Token not found" },
                { status: 404 }
            );
        }

        const [claimEventsData, snapshots] = await Promise.all([
            getClaimEvents(mint, { mode: "offset", limit: 50 }),
            getTokenSnapshots(mint),
        ]);

        const claimEvents = claimEventsData?.events ?? claimEventsData?.claims ?? [];

        return NextResponse.json({
            success: true,
            data: {
                token,
                claimEvents,
                snapshots: snapshots.map((s: TokenSnapshot) => ({
                    capturedAt: s.capturedAt.toISOString(),
                    fdvUsd: s.fdvUsd,
                    priceUsd: s.priceUsd,
                    liquidityUsd: s.liquidityUsd,
                    lifetimeFees: s.lifetimeFees,
                    volume24hUsd: s.volume24hUsd,
                })),
            },
        });
    } catch (e) {
        console.error("[api/tokens/[mint]] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}
