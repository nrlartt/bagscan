export const dynamic = "force-dynamic";
export const maxDuration = 25;

import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getPortfolioForWallet } from "@/lib/portfolio/service";

export async function GET(req: NextRequest) {
    const wallet = req.nextUrl.searchParams.get("wallet")?.trim();
    if (!wallet) {
        return NextResponse.json(
            { success: false, error: "Missing wallet query parameter" },
            { status: 400 }
        );
    }

    try {
        new PublicKey(wallet);
    } catch {
        return NextResponse.json(
            { success: false, error: "Invalid Solana wallet address" },
            { status: 400 }
        );
    }

    try {
        const data = await getPortfolioForWallet(wallet);
        return NextResponse.json(
            { success: true, data },
            {
                headers: {
                    "Cache-Control": "private, no-store",
                },
            }
        );
    } catch (error) {
        console.error("[api/portfolio] error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
