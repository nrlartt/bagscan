export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { incorporateCompany } from "@/lib/bags/client";
import { incorporateCompanySchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = incorporateCompanySchema.parse(body);
        const result = await incorporateCompany(data);
        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("[api/incorporation/incorporate] error:", error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
