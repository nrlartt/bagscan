import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/db";
import {
    buildAlertSignInMessage,
    clearAlertChallengeCookie,
    readAlertChallenge,
    setAlertSessionCookie,
    verifyAlertSignature,
} from "@/lib/alerts/auth";

interface LoginPayload {
    wallet?: string;
    message?: string;
    signature?: string;
}

export async function POST(request: NextRequest) {
    const body = (await request.json().catch(() => ({}))) as LoginPayload;
    const wallet = body.wallet?.trim();
    const message = body.message?.trim();
    const signature = body.signature?.trim();

    if (!wallet || !message || !signature) {
        return NextResponse.json(
            { success: false, error: "wallet, message and signature are required" },
            { status: 400 }
        );
    }

    try {
        new PublicKey(wallet);
    } catch {
        return NextResponse.json(
            { success: false, error: "Invalid Solana wallet address" },
            { status: 400 }
        );
    }

    const challenge = readAlertChallenge(request);
    if (!challenge || challenge.wallet !== wallet) {
        return NextResponse.json(
            { success: false, error: "Alert sign-in challenge expired. Try again." },
            { status: 401 }
        );
    }

    const expectedMessage = buildAlertSignInMessage(challenge.wallet, challenge.nonce, challenge.issuedAt);
    if (message !== expectedMessage) {
        return NextResponse.json(
            { success: false, error: "Alert sign-in message mismatch" },
            { status: 400 }
        );
    }

    const signatureValid = verifyAlertSignature(wallet, message, signature);
    if (!signatureValid) {
        return NextResponse.json(
            { success: false, error: "Wallet signature could not be verified" },
            { status: 401 }
        );
    }

    await prisma.alertPreference.upsert({
        where: { walletAddress: wallet },
        create: { walletAddress: wallet },
        update: {},
    });

    const response = NextResponse.json({ success: true, wallet });
    clearAlertChallengeCookie(response);
    setAlertSessionCookie(response, wallet);
    return response;
}
