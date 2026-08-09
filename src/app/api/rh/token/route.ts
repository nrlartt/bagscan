export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getEthUsdPrice, getRhToken } from "@/lib/bags/rh-client";
import { rhTokenDetailToNormalized } from "@/lib/bags/rh-mappers";
import { isEvmAddress } from "@/lib/networks";

export async function GET(req: NextRequest) {
    try {
        const address = new URL(req.url).searchParams.get("address")?.trim() ?? "";
        if (!address || !isEvmAddress(address)) {
            return NextResponse.json(
                { success: false, error: "Invalid Robinhood token address" },
                { status: 400 }
            );
        }

        const detail = await getRhToken(address);
        if (!detail) {
            return NextResponse.json(
                { success: false, error: "Token not found" },
                { status: 404 }
            );
        }

        const ethUsd = await getEthUsdPrice();
        const token = rhTokenDetailToNormalized(detail, ethUsd);

        return NextResponse.json({
            success: true,
            data: {
                token,
                state: detail.state,
            },
        });
    } catch (error) {
        // Upstream messages can carry request internals — log them, don't ship them.
        console.error("[api/rh/token] error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch Robinhood token" },
            { status: 502 }
        );
    }
}
