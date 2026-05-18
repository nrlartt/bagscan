export const dynamic = "force-dynamic";
/** Explore trending + merged feeds can exceed 25s when cold (Dex + pool index + augment). */
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import {
    syncSpotlightTokens,
    syncTrendingTokens,
    syncNewLaunches,
    syncExploreFeed,
    syncLeaderboard,
    syncHackathonApps,
    syncHackathonLeaderboard,
    getHackathonFeedMeta,
    searchAllTokens,
    getPlatformStats,
    getTotalPoolCount,
} from "@/lib/sync";
import { tokensQuerySchema, type TokensQuery } from "@/lib/validators";
import type { NormalizedToken } from "@/lib/bags/types";

function tokenMcapUsd(t: NormalizedToken): number {
    return t.marketCap ?? t.fdvUsd ?? 0;
}

function applyExploreMarketFilters(
    tokens: NormalizedToken[],
    q: Pick<TokensQuery, "mcapMin" | "mcapMax" | "volMin" | "volMax">
): NormalizedToken[] {
    if (
        q.mcapMin === undefined &&
        q.mcapMax === undefined &&
        q.volMin === undefined &&
        q.volMax === undefined
    ) {
        return tokens;
    }
    return tokens.filter((t) => {
        const m = tokenMcapUsd(t);
        const v = t.volume24hUsd ?? 0;
        if (q.mcapMin !== undefined && m < q.mcapMin) return false;
        if (q.mcapMax !== undefined && m > q.mcapMax) return false;
        if (q.volMin !== undefined && v < q.volMin) return false;
        if (q.volMax !== undefined && v > q.volMax) return false;
        return true;
    });
}

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
            const [results, totalPoolsIndexed] = await Promise.all([
                searchAllTokens(query.search, 50),
                getTotalPoolCount(),
            ]);
            return jsonOk({
                success: true,
                data: results,
                meta: {
                    total: results.length,
                    page: 1,
                    pageSize: results.length,
                    totalPages: 1,
                    tab: "search",
                    totalPools: totalPoolsIndexed,
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

        const [sortedTokens, totalPoolsIndexed] = await Promise.all([
            (async () => {
                let t: NormalizedToken[];
                if (query.tab === "spotlight") {
                    t = await syncSpotlightTokens();
                } else if (query.tab === "explore") {
                    const mints = query.watchlist
                        ? query.watchlist.split(",").map((m) => m.trim()).filter(Boolean)
                        : [];
                    t = await syncExploreFeed(query.lane, { watchlistMints: mints });
                    return t;
                } else if (query.tab === "new") {
                    t = await syncNewLaunches();
                    return t;
                } else {
                    t = await syncTrendingTokens();
                }
                return sortTokens(t, query.sort);
            })(),
            getTotalPoolCount(),
        ]);

        const afterMarketFilters =
            query.tab === "explore"
                ? applyExploreMarketFilters(sortedTokens, query)
                : sortedTokens;
        const totalFeed = afterMarketFilters.length;
        const start = (query.page - 1) * query.pageSize;
        const paged = afterMarketFilters.slice(start, start + query.pageSize);

        const cacheControl =
            query.tab === "spotlight"
                ? "public, s-maxage=30, stale-while-revalidate=240"
                : query.tab === "new" || (query.tab === "explore" && query.lane === "new")
                    ? "public, s-maxage=8, stale-while-revalidate=45"
                    : query.tab === "explore" && query.lane === "last_trade"
                        ? "public, s-maxage=5, stale-while-revalidate=20"
                    : query.tab === "explore" && query.lane === "trending"
                        ? "public, s-maxage=30, stale-while-revalidate=120"
                    : query.tab === "explore"
                        ? "public, s-maxage=12, stale-while-revalidate=40"
                        : "public, s-maxage=10, stale-while-revalidate=30";

        return jsonOk({
            success: true,
            data: paged,
            meta: {
                total: totalFeed,
                page: query.page,
                pageSize: query.pageSize,
                totalPages: Math.max(1, Math.ceil(totalFeed / query.pageSize)),
                tab: query.tab,
                lane: query.tab === "explore" ? query.lane : undefined,
                totalPools: totalPoolsIndexed,
            },
        }, cacheControl);
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
