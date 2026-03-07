export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { syncTokenDetail } from "@/lib/sync";

export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ mint: string }> }
) {
    try {
        const { mint } = await params;
        const token = await syncTokenDetail(mint);
        return NextResponse.json({ success: true, data: token });
    } catch (e) {
        console.error("[api/sync/token] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}
