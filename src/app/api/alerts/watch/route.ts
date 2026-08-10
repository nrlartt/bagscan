export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionWallet } from "@/lib/alerts/session";
import { isEvmAddress } from "@/lib/rh/chain";

const MAX_WATCHES = 50;

function unauthorized() {
    return NextResponse.json({ success: false, error: "Sign in to manage alerts" }, { status: 401 });
}

export async function POST(req: NextRequest) {
    const wallet = await getSessionWallet();
    if (!wallet) return unauthorized();

    try {
        const body = (await req.json()) as {
            tokenAddress?: string;
            symbol?: string;
            curveEnabled?: boolean;
            gradEnabled?: boolean;
            volumeEnabled?: boolean;
            priceMovePct?: number | null;
            whaleTradeEth?: number | null;
        };

        if (!body.tokenAddress || !isEvmAddress(body.tokenAddress)) {
            return NextResponse.json({ success: false, error: "Invalid token address" }, { status: 400 });
        }

        const tokenAddress = body.tokenAddress.toLowerCase();
        const existing = await prisma.rhWatch.count({ where: { wallet } });
        const alreadyWatching = await prisma.rhWatch.findUnique({
            where: { wallet_tokenAddress: { wallet, tokenAddress } },
        });

        if (!alreadyWatching && existing >= MAX_WATCHES) {
            return NextResponse.json(
                { success: false, error: `Watch limit reached (${MAX_WATCHES})` },
                { status: 409 }
            );
        }

        const rules = {
            symbol: body.symbol?.slice(0, 32),
            curveEnabled: body.curveEnabled ?? true,
            gradEnabled: body.gradEnabled ?? true,
            volumeEnabled: body.volumeEnabled ?? true,
            priceMovePct:
                body.priceMovePct == null ? null : Math.min(1000, Math.max(1, body.priceMovePct)),
            whaleTradeEth:
                body.whaleTradeEth == null ? null : Math.min(1000, Math.max(0.0001, body.whaleTradeEth)),
        };

        const watch = await prisma.rhWatch.upsert({
            where: { wallet_tokenAddress: { wallet, tokenAddress } },
            create: { wallet, tokenAddress, ...rules },
            update: rules,
        });

        return NextResponse.json({ success: true, data: watch });
    } catch (error) {
        console.error("[api/alerts/watch] POST error:", error);
        return NextResponse.json({ success: false, error: "Failed to save watch" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const wallet = await getSessionWallet();
    if (!wallet) return unauthorized();

    const tokenAddress = req.nextUrl.searchParams.get("tokenAddress")?.trim().toLowerCase() ?? "";
    if (!isEvmAddress(tokenAddress)) {
        return NextResponse.json({ success: false, error: "Invalid token address" }, { status: 400 });
    }

    try {
        await prisma.rhWatch
            .delete({ where: { wallet_tokenAddress: { wallet, tokenAddress } } })
            .catch(() => undefined);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[api/alerts/watch] DELETE error:", error);
        return NextResponse.json({ success: false, error: "Failed to remove watch" }, { status: 500 });
    }
}
