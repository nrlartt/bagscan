export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listIncorporatedCompanies } from "@/lib/bags/client";

export async function GET() {
    try {
        const companies = await listIncorporatedCompanies();
        return NextResponse.json({ success: true, data: companies });
    } catch (error) {
        console.error("[api/incorporation/list] error:", error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
