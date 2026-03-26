import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/db";
import { AlertAccessError, ensureAlertAccess } from "@/lib/alerts/access";
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

function toAlertLoginErrorMessage(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (/P1001|Can't reach database server/i.test(message)) {
        return "Alerts database is unreachable. Update DATABASE_URL to the Supabase pooler connection string.";
    }

    if (/P2021|table.*AlertPreference|relation .*AlertPreference/i.test(message)) {
        return "Alert tables are missing. Run prisma db push or execute scripts/alerts-postgres.sql.";
    }

    if (/self-signed certificate|TLS connection/i.test(message)) {
        return "Supabase TLS verification failed. Use a pooler DATABASE_URL with uselibpqcompat=true and restart the app.";
    }

    return message || "Alert sign-in failed";
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

    try {
        await ensureAlertAccess(wallet);
        await prisma.alertPreference.upsert({
            where: { walletAddress: wallet },
            create: { walletAddress: wallet },
            update: {},
        });
    } catch (error) {
        if (error instanceof AlertAccessError) {
            return NextResponse.json(
                { success: false, error: error.message, data: error.access },
                { status: error.status }
            );
        }
        console.error("[api/alerts/auth/login] error:", error);
        return NextResponse.json(
            { success: false, error: toAlertLoginErrorMessage(error) },
            { status: 500 }
        );
    }

    const response = NextResponse.json({ success: true, wallet });
    clearAlertChallengeCookie(response);
    setAlertSessionCookie(response, wallet);
    return response;
}
