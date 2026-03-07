export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getPartnerStats } from "@/lib/bags/client";
import { prisma } from "@/lib/db";
import type { PartnerSnapshot } from "@prisma/client";

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

        const stats = await getPartnerStats(partnerWallet, partnerConfig);

        // Save snapshot
        if (stats) {
            try {
                await prisma.partnerSnapshot.create({
                    data: {
                        partnerWallet,
                        claimedFees: stats.claimedFees ?? stats.claimedFeesUsd,
                        unclaimedFees: stats.unclaimedFees ?? stats.unclaimedFeesUsd,
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
                snapshots: partnerSnapshots.map((s: PartnerSnapshot) => ({
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
