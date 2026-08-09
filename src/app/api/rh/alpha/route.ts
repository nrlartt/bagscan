export const dynamic = "force-dynamic";
export const maxDuration = 25;

import { NextResponse } from "next/server";
import { getEthUsdPrice, getRhTokens, getRhTrades } from "@/lib/bags/rh-client";
import {
    buildRhAlphaToken,
    mapWithConcurrency,
    rankRhCandidates,
    type RhAlphaFeed,
} from "@/lib/bags/rh-alpha";
import type { RhTokenListItem } from "@/lib/bags/rh-types";

/** How many pre-ranked tokens get a trades lookup per refresh. */
const DEEP_SCAN_LIMIT = 20;
const TRADES_PER_TOKEN = 100;

export async function GET() {
    try {
        const [bonding, migrated, ethUsd] = await Promise.all([
            getRhTokens({
                limit: 100,
                migrated: false,
                orderBy: "createdAtTimestamp",
                orderDirection: "desc",
            }),
            getRhTokens({
                limit: 24,
                migrated: true,
                orderBy: "migratedAtTimestamp",
                orderDirection: "desc",
            }).catch(() => null),
            getEthUsdPrice().catch(() => undefined),
        ]);

        const pool: RhTokenListItem[] = [...(bonding.items ?? []), ...(migrated?.items ?? [])];
        const candidates = rankRhCandidates(pool, DEEP_SCAN_LIMIT);
        const now = Date.now();

        const tokens = await mapWithConcurrency(candidates, 5, async (item) => {
            // One dead token must not blank the whole board.
            const trades = await getRhTrades(item.address, TRADES_PER_TOKEN)
                .then((r) => r.trades ?? [])
                .catch(() => []);
            return buildRhAlphaToken(item, trades, ethUsd, now, TRADES_PER_TOKEN);
        });

        // Keep traded-but-quiet tokens as watch-tier depth; drop only dead ones.
        const ranked = tokens
            .filter((t) => t.signals.length > 0 || t.trades7d > 0)
            .sort((a, b) => {
                const scoreDiff = b.alphaScore - a.alphaScore;
                if (scoreDiff !== 0) return scoreDiff;
                return b.volumeEth7d - a.volumeEth7d;
            });

        const feed: RhAlphaFeed = {
            tokens: ranked,
            generatedAt: new Date(now).toISOString(),
            scanned: candidates.length,
            totalSignals: ranked.reduce((sum, t) => sum + t.signals.length, 0),
            ethUsd,
        };

        return NextResponse.json(
            { success: true, ...feed },
            {
                headers: {
                    "Cache-Control": "public, s-maxage=45, stale-while-revalidate=90",
                },
            }
        );
    } catch (error) {
        console.error("[api/rh/alpha] error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to build Robinhood alpha feed" },
            { status: 502 }
        );
    }
}
