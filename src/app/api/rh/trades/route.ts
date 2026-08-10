export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getRhTrades } from "@/lib/rh/client";
import { isEvmAddress } from "@/lib/rh/chain";

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const address = url.searchParams.get("address")?.trim() ?? "";
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 40) || 40));

        if (!address || !isEvmAddress(address)) {
            return NextResponse.json(
                { success: false, error: "Invalid token address" },
                { status: 400 }
            );
        }

        const trades = await getRhTrades(address, limit);

        return NextResponse.json(
            { success: true, data: trades },
            { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch trades";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
