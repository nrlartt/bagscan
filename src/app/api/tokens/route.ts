export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
    syncTrendingTokens,
    syncNewLaunches,
    syncLeaderboard,
    syncHackathonApps,
    searchAllTokens,
    getTotalPoolCount,
    getPlatformStats,
} from "@/lib/sync";
import { tokensQuerySchema } from "@/lib/validators";
import type { NormalizedToken } from "@/lib/bags/types";

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const params = Object.fromEntries(url.searchParams);
        const query = tokensQuerySchema.parse(params);

        if (query.search) {
            const results = await searchAllTokens(query.search, 50);
            return NextResponse.json({
                success: true,
                data: results,
                meta: {
                    total: results.length,
                    page: 1,
                    pageSize: results.length,
                    totalPages: 1,
                    tab: "search",
                },
            });
        }

        if (query.tab === "hackathon") {
            const apps = await syncHackathonApps();
            return NextResponse.json({
                success: true,
                data: apps,
                meta: {
                    total: apps.length,
                    page: 1,
                    pageSize: apps.length,
                    totalPages: 1,
                    tab: "hackathon",
                },
            });
        }

        if (query.tab === "leaderboard") {
            const [leaderboard, stats] = await Promise.all([
                syncLeaderboard(),
                getPlatformStats(),
            ]);
            return NextResponse.json({
                success: true,
                data: leaderboard,
                stats,
                meta: {
                    total: leaderboard.length,
                    page: 1,
                    pageSize: leaderboard.length,
                    totalPages: 1,
                    tab: "leaderboard",
                    totalPools: stats.totalProjects,
                },
            });
        }

        let tokens: NormalizedToken[];

        if (query.tab === "new") {
            tokens = await syncNewLaunches();
        } else {
            tokens = await syncTrendingTokens();
        }

        tokens = sortTokens(tokens, query.sort);

        const total = tokens.length;
        const start = (query.page - 1) * query.pageSize;
        const paged = tokens.slice(start, start + query.pageSize);

        const totalPools = await getTotalPoolCount();

        return NextResponse.json({
            success: true,
            data: paged,
            meta: {
                total,
                page: query.page,
                pageSize: query.pageSize,
                totalPages: Math.ceil(total / query.pageSize),
                tab: query.tab,
                totalPools,
            },
        });
    } catch (e) {
        console.error("[api/tokens] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}

function sortTokens(
    tokens: NormalizedToken[],
    sort: string
): NormalizedToken[] {
    const sorted = [...tokens];
    const numSort = (
        arr: NormalizedToken[],
        fn: (t: NormalizedToken) => number | undefined,
        asc = false
    ) =>
        arr.sort((a, b) => {
            const va = fn(a);
            const vb = fn(b);
            if (va === undefined) return 1;
            if (vb === undefined) return -1;
            return asc ? va - vb : vb - va;
        });

    switch (sort) {
        case "fdv-desc":
            return numSort(sorted, (t) => t.marketCap ?? t.fdvUsd);
        case "volume-desc":
            return numSort(sorted, (t) => t.volume24hUsd);
        case "liquidity-desc":
            return numSort(sorted, (t) => t.liquidityUsd);
        case "gainers":
            return numSort(sorted, (t) => t.priceChange24h);
        case "losers":
            return numSort(sorted, (t) => t.priceChange24h, true);
        case "fees-desc":
            return numSort(sorted, (t) => t.lifetimeFees);
        case "claims-desc":
            return numSort(sorted, (t) => t.claimCount);
        case "name-asc":
            return sorted.sort((a, b) =>
                (a.name ?? "zzz").localeCompare(b.name ?? "zzz")
            );
        case "newest":
        default:
            return sorted;
    }
}
