import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getTalkAccess } from "@/lib/talk/access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
    const wallet = request.nextUrl.searchParams.get("wallet")?.trim();
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
        const access = await getTalkAccess(wallet);
        return NextResponse.json({ success: true, data: access });
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
