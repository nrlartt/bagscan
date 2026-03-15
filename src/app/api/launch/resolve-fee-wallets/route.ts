export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getFeeShareWalletsBulk } from "@/lib/bags/client";
import { resolveFeeShareWalletsSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = resolveFeeShareWalletsSchema.parse(body);

        const lookups = data.items.map((item) => ({
            provider: item.provider,
            username: item.username.trim().replace(/^@/, ""),
        }));

        const uniqueKeys = new Set<string>();
        const uniqueLookups = lookups.filter((item) => {
            const key = `${item.provider}:${item.username.toLowerCase()}`;
            if (uniqueKeys.has(key)) return false;
            uniqueKeys.add(key);
            return true;
        });

        const resolved = await getFeeShareWalletsBulk(uniqueLookups);
        const byLookup = new Map<string, string | null>();

        for (const entry of resolved) {
            const provider = String(entry.provider ?? "").toLowerCase();
            const username = String(entry.username ?? "").toLowerCase();
            if (!provider || !username) continue;
            byLookup.set(`${provider}:${username}`, entry.wallet ?? entry.address ?? null);
        }

        return NextResponse.json({
            success: true,
            data: lookups.map((item) => ({
                provider: item.provider,
                username: item.username,
                wallet: byLookup.get(`${item.provider}:${item.username.toLowerCase()}`) ?? null,
            })),
        });
    } catch (e) {
        console.error("[api/launch/resolve-fee-wallets] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}
