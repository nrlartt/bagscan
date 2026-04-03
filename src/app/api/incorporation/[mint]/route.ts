export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCompanyTokenDetails } from "@/lib/bags/client";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ mint: string }> }
) {
    try {
        const { mint } = await params;
        const incorporation = await getCompanyTokenDetails(mint);
        return NextResponse.json({ success: true, data: incorporation });
    } catch (error) {
        console.error("[api/incorporation/[mint]] error:", error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
