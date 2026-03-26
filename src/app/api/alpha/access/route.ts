import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getTokenHolderAccess } from "@/lib/scan/access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SCAN_MINT = "BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS";
const MIN_SCAN_REQUIRED = 2_000_000;

export async function GET(req: NextRequest) {
    const wallet = req.nextUrl.searchParams.get("wallet");
    if (!wallet) {
        return NextResponse.json(
            { success: false, error: "Missing wallet query parameter" },
            { status: 400 }
        );
    }

    try {
        new PublicKey(wallet);
        new PublicKey(SCAN_MINT);
    } catch {
        return NextResponse.json(
            { success: false, error: "Invalid wallet address" },
            { status: 400 }
        );
    }

    try {
        const access = await getTokenHolderAccess({
            wallet,
            mint: SCAN_MINT,
            minimumUi: MIN_SCAN_REQUIRED,
        });

        return NextResponse.json({
            success: true,
            data: {
                eligible: access.eligible,
                balanceUi: access.balanceUi,
                requiredUi: access.requiredUi,
                mint: access.mint,
            },
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 502 }
        );
    }
}
