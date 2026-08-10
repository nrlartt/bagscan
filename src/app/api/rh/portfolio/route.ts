export const dynamic = "force-dynamic";
export const maxDuration = 25;

import { NextRequest, NextResponse } from "next/server";
import { getEthUsdPrice, getRhBalances, getRhPortfolio } from "@/lib/rh/client";
import { buildRhPortfolioView } from "@/lib/rh/portfolio";
import { isEvmAddress } from "@/lib/rh/chain";

export async function GET(req: NextRequest) {
    const owner = req.nextUrl.searchParams.get("owner")?.trim() ?? "";

    if (!owner || !isEvmAddress(owner)) {
        return NextResponse.json(
            { success: false, error: "Invalid Robinhood Chain wallet address" },
            { status: 400 }
        );
    }

    try {
        // Balances and the ETH rate are enrichments — a failure there should not
        // cost the user their holdings list.
        const [portfolio, balances, ethUsd] = await Promise.all([
            getRhPortfolio(owner),
            getRhBalances(owner).catch(() => null),
            getEthUsdPrice().catch(() => undefined),
        ]);

        return NextResponse.json(
            { success: true, data: buildRhPortfolioView(owner, portfolio, balances, ethUsd) },
            { headers: { "Cache-Control": "private, no-store" } }
        );
    } catch (error) {
        console.error("[api/rh/portfolio] error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to load Robinhood portfolio" },
            { status: 502 }
        );
    }
}
