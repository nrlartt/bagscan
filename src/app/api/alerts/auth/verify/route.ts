export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { prisma } from "@/lib/db";
import { ALERTS_COOKIE, buildSignInMessage, createSessionToken } from "@/lib/alerts/session";
import { isEvmAddress } from "@/lib/rh/chain";

export async function POST(req: NextRequest) {
    try {
        const { wallet, nonce, signature } = (await req.json()) as {
            wallet?: string;
            nonce?: string;
            signature?: string;
        };

        if (!wallet || !isEvmAddress(wallet) || !nonce || !signature?.startsWith("0x")) {
            return NextResponse.json({ success: false, error: "Invalid sign-in payload" }, { status: 400 });
        }

        const normalized = wallet.toLowerCase();
        const challenge = await prisma.rhAuthChallenge.findUnique({ where: { nonce } });

        if (!challenge || challenge.wallet !== normalized || challenge.expiresAt < new Date()) {
            return NextResponse.json({ success: false, error: "Challenge expired" }, { status: 400 });
        }

        const valid = await verifyMessage({
            address: wallet as `0x${string}`,
            message: buildSignInMessage(normalized, nonce),
            signature: signature as `0x${string}`,
        });

        if (!valid) {
            return NextResponse.json({ success: false, error: "Signature does not match" }, { status: 401 });
        }

        // Single-use: burn the nonce so a captured signature cannot be replayed.
        await prisma.rhAuthChallenge.delete({ where: { nonce } }).catch(() => undefined);

        await prisma.rhSubscriber.upsert({
            where: { wallet: normalized },
            create: { wallet: normalized },
            update: {},
        });

        const response = NextResponse.json({ success: true, data: { wallet: normalized } });
        response.cookies.set(ALERTS_COOKIE, createSessionToken(normalized), {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 30 * 24 * 60 * 60,
        });
        return response;
    } catch (error) {
        console.error("[api/alerts/auth/verify] error:", error);
        return NextResponse.json({ success: false, error: "Sign-in failed" }, { status: 500 });
    }
}
