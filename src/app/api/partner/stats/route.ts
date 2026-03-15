export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getPartnerStats } from "@/lib/bags/client";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
    try {
        const secret = new URL(req.url).searchParams.get("secret");
        if (secret !== process.env.BAGSCAN_ADMIN_SECRET) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        const partnerWallet = process.env.BAGSCAN_PARTNER_WALLET;
        const partnerConfig = process.env.BAGSCAN_PARTNER_CONFIG;

        if (!partnerWallet || !partnerConfig) {
            return NextResponse.json({
                success: true,
                data: {
                    configured: false,
                    message: "Partner wallet and config not set in environment.",
                },
            });
        }

        const stats = await getPartnerStats(partnerWallet);

        // Save snapshot
        if (stats) {
            try {
                await prisma.partnerSnapshot.create({
                    data: {
                        partnerWallet,
                        claimedFees: toNumber(stats.claimedFees ?? stats.claimedFeesUsd),
                        unclaimedFees: toNumber(stats.unclaimedFees ?? stats.unclaimedFeesUsd ?? stats.claimableFees ?? stats.claimableFeesUsd),
                        rawJson: JSON.stringify(stats),
                    },
                });
            } catch (e) {
                console.error("[api/partner/stats] snapshot error:", e);
            }
        }

        // Get local launch count
        const launchCount = await prisma.launchDraft.count();
        const partnerSnapshots = await prisma.partnerSnapshot.findMany({
            where: { partnerWallet },
            orderBy: { capturedAt: "desc" },
            take: 50,
        });

        return NextResponse.json({
            success: true,
            data: {
                configured: true,
                partnerWallet,
                partnerConfig,
                stats,
                launchCount,
                snapshots: partnerSnapshots.map((s: { capturedAt: Date; claimedFees: number | null; unclaimedFees: number | null }) => ({
                    capturedAt: s.capturedAt.toISOString(),
                    claimedFees: s.claimedFees,
                    unclaimedFees: s.unclaimedFees,
                })),
            },
        });
    } catch (e) {
        console.error("[api/partner/stats] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}

function toNumber(value: number | string | undefined): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}
