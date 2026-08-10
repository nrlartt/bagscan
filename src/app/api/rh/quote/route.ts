export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getRhQuote } from "@/lib/rh/client";
import { isEvmAddress } from "@/lib/rh/chain";

const MAX_AMOUNT_WEI = 10n ** 36n;

export async function GET(req: NextRequest) {
    const params = new URL(req.url).searchParams;
    const tokenAddress = params.get("tokenAddress")?.trim() ?? "";
    const side = params.get("side");
    const amountWei = params.get("amountWei")?.trim() ?? "";

    if (!isEvmAddress(tokenAddress)) {
        return NextResponse.json({ success: false, error: "Invalid token address" }, { status: 400 });
    }
    if (side !== "buy" && side !== "sell") {
        return NextResponse.json({ success: false, error: "side must be buy or sell" }, { status: 400 });
    }

    let amount: bigint;
    try {
        amount = BigInt(amountWei);
    } catch {
        return NextResponse.json({ success: false, error: "amountWei must be an integer" }, { status: 400 });
    }
    if (amount <= 0n || amount > MAX_AMOUNT_WEI) {
        return NextResponse.json({ success: false, error: "amountWei out of range" }, { status: 400 });
    }

    try {
        const quote = await getRhQuote(tokenAddress, side, amount.toString());
        return NextResponse.json(
            { success: true, data: quote },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("[api/rh/quote] error:", error);
        return NextResponse.json(
            { success: false, error: "Quote unavailable for this token and amount." },
            { status: 502 }
        );
    }
}
