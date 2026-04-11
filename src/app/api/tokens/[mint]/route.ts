export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { syncTokenDetail, getTokenSnapshots } from "@/lib/sync";
import { getClaimEvents, getCompanyTokenDetails, getDexScreenerPairs } from "@/lib/bags/client";
import { getJupiterTokenDetail } from "@/lib/jupiter/client";

type DexPair = Awaited<ReturnType<typeof getDexScreenerPairs>>[number];

function toNumber(value: string | number | null | undefined) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

function buildSyntheticSnapshots(pair: DexPair): Array<{ capturedAt: string; fdvUsd: number | null; priceUsd: number | null; liquidityUsd: number | null; lifetimeFees: number | null; volume24hUsd: number | null }> {
    const now = Date.now();
    const currentPrice = toNumber(pair.priceUsd) ?? 0;
    const currentFdv = toNumber(pair.fdv) ?? 0;
    if (!currentPrice || !currentFdv) return [];

    const changes = (pair.priceChange ?? {}) as Record<string, string | number | null | undefined>;
    const intervals: Array<{ key: "h24" | "h6" | "h1" | "m5"; ms: number }> = [
        { key: "h24", ms: 24 * 60 * 60 * 1000 },
        { key: "h6", ms: 6 * 60 * 60 * 1000 },
        { key: "h1", ms: 60 * 60 * 1000 },
        { key: "m5", ms: 5 * 60 * 1000 },
    ];

    const points: Array<{ capturedAt: string; fdvUsd: number | null; priceUsd: number | null; liquidityUsd: number | null; lifetimeFees: number | null; volume24hUsd: number | null }> = [];

    for (const { key, ms } of intervals) {
        const pctChange = toNumber(changes[key]);
        if (pctChange === undefined) continue;
        const pastPrice = currentPrice / (1 + pctChange / 100);
        const pastFdv = currentFdv / (1 + pctChange / 100);
        points.push({
            capturedAt: new Date(now - ms).toISOString(),
            fdvUsd: pastFdv,
            priceUsd: pastPrice,
            liquidityUsd: null,
            lifetimeFees: null,
            volume24hUsd: null,
        });
    }

    points.push({
        capturedAt: new Date(now).toISOString(),
        fdvUsd: currentFdv,
        priceUsd: currentPrice,
        liquidityUsd: toNumber(pair.liquidity?.usd) ?? null,
        lifetimeFees: null,
        volume24hUsd: toNumber(pair.volume?.h24) ?? null,
    });

    points.sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
    return points;
}

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

        const [claimEventsData, dbSnapshots, dexPairs, incorporation] = await Promise.all([
            getClaimEvents(mint, { mode: "offset", limit: 50 }),
            getTokenSnapshots(mint),
            getDexScreenerPairs([mint]),
            getCompanyTokenDetails(mint),
        ]);
        const jupiter = await getJupiterTokenDetail(mint).catch((error) => {
            console.error("[api/tokens/[mint]] jupiter lookup error:", error);
            return null;
        });

        const claimEvents = claimEventsData?.events ?? claimEventsData?.claims ?? [];

        let snapshots = dbSnapshots.map((s: { capturedAt: Date; fdvUsd: number | null; priceUsd: number | null; liquidityUsd: number | null; lifetimeFees: number | null; volume24hUsd: number | null }) => ({
            capturedAt: s.capturedAt.toISOString(),
            fdvUsd: s.fdvUsd,
            priceUsd: s.priceUsd,
            liquidityUsd: s.liquidityUsd,
            lifetimeFees: s.lifetimeFees,
            volume24hUsd: s.volume24hUsd,
        }));

        if (snapshots.length < 2 && dexPairs.length > 0) {
            const pair = dexPairs.find((p) => p.baseToken?.address === mint) || dexPairs[0];
            if (pair) {
                snapshots = buildSyntheticSnapshots(pair);
            }
        }

        return NextResponse.json({
            success: true,
            data: { token, claimEvents, snapshots, incorporation, jupiter },
        });
    } catch (e) {
        console.error("[api/tokens/[mint]] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}
