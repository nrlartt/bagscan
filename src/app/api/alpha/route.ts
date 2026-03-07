import { NextResponse } from "next/server";
import { generateAlphaFeed } from "@/lib/alpha/engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
    try {
        const feed = await generateAlphaFeed();
        return NextResponse.json(feed);
    } catch (e) {
        console.error("[api/alpha] error:", e);
        return NextResponse.json(
            { tokens: [], totalSignals: 0, lastUpdated: new Date().toISOString(), xquikEnabled: false, radarTrends: [] },
            { status: 500 }
        );
    }
}
