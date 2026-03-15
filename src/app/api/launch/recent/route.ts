export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBagsPoolInfo, getDexScreenerPairs } from "@/lib/bags/client";
import type { NormalizedToken } from "@/lib/bags/types";

interface RecentLaunchesResponse {
    success: boolean;
    data: NormalizedToken[];
    meta: {
        total: number;
        limit: number;
    };
}

interface DexPair {
    baseToken?: { address?: string; name?: string; symbol?: string };
    info?: { imageUrl?: string };
    pairAddress?: string;
    dexId?: string;
    pairCreatedAt?: number | null;
    priceUsd?: string | number | null;
    fdv?: string | number | null;
    marketCap?: string | number | null;
    liquidity?: { usd?: string | number | null };
    volume?: { h24?: string | number | null };
    priceChange?: { h24?: string | number | null };
    txns?: { h24?: { buys?: string | number | null; sells?: string | number | null } };
}

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const rawLimit = Number(url.searchParams.get("limit") || 8);
        const limit = Number.isFinite(rawLimit)
            ? Math.min(Math.max(Math.floor(rawLimit), 1), 24)
            : 8;

        let drafts = await prisma.launchDraft.findMany({
            where: {
                tokenMint: { not: null },
                partnerIncluded: true,
            },
            orderBy: { createdAt: "desc" },
            take: limit * 8,
        });

        if (drafts.length === 0) {
            drafts = await prisma.launchDraft.findMany({
                where: { tokenMint: { not: null } },
                orderBy: { createdAt: "desc" },
                take: limit * 8,
            });
        }

        const uniqueDrafts = drafts.filter((draft, index, arr) => {
            if (!draft.tokenMint) return false;
            return arr.findIndex((d) => d.tokenMint === draft.tokenMint) === index;
        });

        if (uniqueDrafts.length === 0) {
            const empty: RecentLaunchesResponse = {
                success: true,
                data: [],
                meta: { total: 0, limit },
            };
            return NextResponse.json(empty, { headers: { "Cache-Control": "no-store" } });
        }

        const verifiedDrafts = (
            await Promise.all(
                uniqueDrafts.map(async (draft) => {
                    if (!draft.tokenMint) return null;
                    const pool = await getBagsPoolInfo(draft.tokenMint);
                    return pool ? draft : null;
                })
            )
        ).filter((d): d is (typeof uniqueDrafts)[number] => d !== null);

        const selected = verifiedDrafts.slice(0, limit);
        const mints = selected
            .map((draft) => draft.tokenMint)
            .filter((mint): mint is string => !!mint);

        const dexPairs = await getDexScreenerPairs(mints);
        const dexByMint = new Map<string, DexPair>();
        for (const pair of dexPairs) {
            const mint = pair?.baseToken?.address;
            if (!mint || dexByMint.has(mint)) continue;
            dexByMint.set(mint, pair);
        }

        const selectedWithMint = selected.filter(
            (draft): draft is (typeof selected)[number] & { tokenMint: string } =>
                typeof draft.tokenMint === "string"
        );

        const tokens: NormalizedToken[] = selectedWithMint
            .map((draft) => {
                const dex = dexByMint.get(draft.tokenMint);
                return {
                    tokenMint: draft.tokenMint,
                    name: dex?.baseToken?.name ?? draft.name,
                    symbol: dex?.baseToken?.symbol ?? draft.symbol,
                    image: dex?.info?.imageUrl ?? draft.imageUrl ?? undefined,
                    description: draft.description || undefined,
                    website: draft.website || undefined,
                    twitter: draft.twitter || undefined,
                    telegram: draft.telegram || undefined,
                    priceUsd: Number(dex?.priceUsd) || undefined,
                    fdvUsd: Number(dex?.fdv) || undefined,
                    marketCap: Number(dex?.marketCap) || undefined,
                    liquidityUsd: Number(dex?.liquidity?.usd) || undefined,
                    volume24hUsd: Number(dex?.volume?.h24) || undefined,
                    priceChange24h: Number(dex?.priceChange?.h24) || undefined,
                    txCount24h:
                        ((Number(dex?.txns?.h24?.buys) || 0) + (Number(dex?.txns?.h24?.sells) || 0)) ||
                        undefined,
                    buyCount24h: Number(dex?.txns?.h24?.buys) || undefined,
                    sellCount24h: Number(dex?.txns?.h24?.sells) || undefined,
                    pairAddress: dex?.pairAddress,
                    dexId: dex?.dexId,
                    pairCreatedAt: dex?.pairCreatedAt
                        ? new Date(dex.pairCreatedAt).toISOString()
                        : draft.createdAt.toISOString(),
                };
            });

        const payload: RecentLaunchesResponse = {
            success: true,
            data: tokens,
            meta: {
                total: tokens.length,
                limit,
            },
        };

        return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
        console.error("[api/launch/recent] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}
