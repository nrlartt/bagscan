export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ALERTS_COOKIE } from "@/lib/alerts/session";

export async function POST() {
    const response = NextResponse.json({ success: true });
    response.cookies.set(ALERTS_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
}
