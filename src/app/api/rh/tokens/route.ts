export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getEthUsdPrice, getRhToken, getRhTokens } from "@/lib/bags/rh-client";
import { rhTokenListItemToNormalized } from "@/lib/bags/rh-mappers";
import { isEvmAddress } from "@/lib/networks";

function jsonOk(data: unknown) {
    return NextResponse.json(data, {
        headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" },
    });
}

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const search = url.searchParams.get("search")?.trim() ?? "";
        const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 48) || 48));
        const migratedParam = url.searchParams.get("migrated");
        const migrated =
            migratedParam === "true" ? true : migratedParam === "false" ? false : undefined;

        const ethUsd = await getEthUsdPrice();

        if (search && isEvmAddress(search)) {
            const detail = await getRhToken(search);
            if (!detail) {
                return jsonOk({
                    success: true,
                    data: [],
                    meta: { total: 0, page: 1, pageSize, totalPages: 0, tab: "search", chain: "robinhood" },
                });
            }
            const { rhTokenDetailToNormalized } = await import("@/lib/bags/rh-mappers");
            const token = rhTokenDetailToNormalized(detail, ethUsd);
            return jsonOk({
                success: true,
                data: [token],
                meta: { total: 1, page: 1, pageSize: 1, totalPages: 1, tab: "search", chain: "robinhood" },
            });
        }

        const offset = (page - 1) * pageSize;
        const response = await getRhTokens({
            limit: pageSize,
            offset,
            migrated,
            orderBy: migrated ? "migratedAtTimestamp" : "createdAtTimestamp",
            orderDirection: "desc",
        });

        let items = response.items.map((item) => rhTokenListItemToNormalized(item, ethUsd));

        if (search.length >= 2) {
            const q = search.toLowerCase();
            items = items.filter(
                (t) =>
                    t.name?.toLowerCase().includes(q) ||
                    t.symbol?.toLowerCase().includes(q) ||
                    t.tokenMint.toLowerCase().includes(q)
            );
        }

        const total = search.length >= 2 ? items.length : response.total;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        return jsonOk({
            success: true,
            data: items,
            meta: {
                total,
                page,
                pageSize,
                totalPages,
                tab: migrated === true ? "graduated" : migrated === false ? "bonding" : "all",
                chain: "robinhood",
                totalTruncated: response.totalTruncated,
            },
        });
    } catch (error) {
        // Upstream messages can carry request internals — log them, don't ship them.
        console.error("[api/rh/tokens] error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch Robinhood tokens" },
            { status: 502 }
        );
    }
}
