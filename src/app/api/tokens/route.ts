export const dynamic = "force-dynamic";
export const maxDuration = 25;

import { NextRequest, NextResponse } from "next/server";
import {
    syncSpotlightTokens,
    syncTrendingTokens,
    syncNewLaunches,
    syncLeaderboard,
    syncHackathonApps,
    syncHackathonLeaderboard,
    getHackathonFeedMeta,
    searchAllTokens,
    getPlatformStats,
} from "@/lib/sync";
import { tokensQuerySchema } from "@/lib/validators";
import type { NormalizedToken } from "@/lib/bags/types";

function jsonOk(data: unknown, cacheControl = "public, s-maxage=10, stale-while-revalidate=30") {
    return NextResponse.json(data, {
        headers: { "Cache-Control": cacheControl },
    });
}

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const params = Object.fromEntries(url.searchParams);
        const query = tokensQuerySchema.parse(params);

        if (query.search) {
            const results = await searchAllTokens(query.search, 50);
            return jsonOk({
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
            const hackathonMeta = await getHackathonFeedMeta();
            return jsonOk({
                success: true,
                data: apps,
                meta: {
                    total: apps.length,
                    page: 1,
                    pageSize: apps.length,
                    totalPages: 1,
                    tab: "hackathon",
                    totalHackathonApps: hackathonMeta.totalItems,
                    acceptedOverall: hackathonMeta.acceptedOverall,
                },
            });
        }

        if (query.tab === "leaderboard") {
            if (query.scope === "hackathon") {
                const apps = await syncHackathonApps();
                const hackathonMeta = await getHackathonFeedMeta();
                const entries = await syncHackathonLeaderboard(query.mode);
                const trackedMarketCap = apps.reduce((sum, app) => sum + (app.marketCap ?? app.fdvUsd ?? 0), 0);
                return jsonOk({
                    success: true,
                    data: entries,
                    meta: {
                        total: entries.length,
                        page: 1,
                        pageSize: entries.length,
                        totalPages: 1,
                        tab: "leaderboard",
                        scope: "hackathon",
                        mode: query.mode,
                        totalHackathonApps: hackathonMeta.totalItems,
                        acceptedOverall: hackathonMeta.acceptedOverall,
                        trackedMarketCap,
                    },
                });
            }

            let leaderboard: Awaited<ReturnType<typeof syncLeaderboard>> = [];
            let stats: Awaited<ReturnType<typeof getPlatformStats>> | null = null;
            try {
                [leaderboard, stats] = await Promise.all([
                    syncLeaderboard(),
                    getPlatformStats(),
                ]);
            } catch (e) {
                console.error("[api/tokens] leaderboard error:", e);
            }
            return jsonOk({
                success: true,
                data: leaderboard,
                stats,
                meta: {
                    total: leaderboard.length,
                    page: 1,
                    pageSize: leaderboard.length,
                    totalPages: 1,
                    tab: "leaderboard",
                    scope: "platform",
                    totalPools: stats?.totalProjects,
                },
            });
        }

        let tokens: NormalizedToken[];

        if (query.tab === "spotlight") {
            tokens = await syncSpotlightTokens();
        } else if (query.tab === "new") {
            tokens = await syncNewLaunches();
        } else {
            tokens = await syncTrendingTokens();
        }

        tokens = sortTokens(tokens, query.sort);

        const total = tokens.length;
        const start = (query.page - 1) * query.pageSize;
        const paged = tokens.slice(start, start + query.pageSize);

        return jsonOk({
            success: true,
            data: paged,
            meta: {
                total,
                page: query.page,
                pageSize: query.pageSize,
                totalPages: Math.ceil(total / query.pageSize),
                tab: query.tab,
                totalPools: total,
            },
        }, query.tab === "spotlight"
            ? "public, s-maxage=30, stale-while-revalidate=240"
            : "public, s-maxage=10, stale-while-revalidate=30");
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
