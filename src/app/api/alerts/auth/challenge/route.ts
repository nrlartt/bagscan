export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildSignInMessage, newNonce } from "@/lib/alerts/session";
import { isEvmAddress } from "@/lib/rh/chain";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export async function POST(req: NextRequest) {
    try {
        const { wallet } = (await req.json()) as { wallet?: string };
        if (!wallet || !isEvmAddress(wallet)) {
            return NextResponse.json({ success: false, error: "Invalid wallet address" }, { status: 400 });
        }

        const normalized = wallet.toLowerCase();
        const nonce = newNonce();

        await prisma.rhAuthChallenge.create({
            data: { nonce, wallet: normalized, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) },
        });

        // Opportunistic cleanup keeps the table from growing unbounded.
        await prisma.rhAuthChallenge
            .deleteMany({ where: { expiresAt: { lt: new Date() } } })
            .catch(() => undefined);

        return NextResponse.json({
            success: true,
            data: { nonce, message: buildSignInMessage(normalized, nonce) },
        });
    } catch (error) {
        console.error("[api/alerts/auth/challenge] error:", error);
        return NextResponse.json({ success: false, error: "Failed to create challenge" }, { status: 500 });
    }
}
