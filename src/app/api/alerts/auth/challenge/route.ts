import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import {
    createAlertChallenge,
    setAlertChallengeCookie,
} from "@/lib/alerts/auth";

export async function GET(request: NextRequest) {
    const wallet = request.nextUrl.searchParams.get("wallet")?.trim();
    if (!wallet) {
        return NextResponse.json(
            { success: false, error: "Missing wallet query parameter" },
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

    const challenge = createAlertChallenge(wallet);
    const response = NextResponse.json({
        success: true,
        wallet,
        message: challenge.message,
        issuedAt: challenge.issuedAt,
    });
    setAlertChallengeCookie(response, challenge.token);
    return response;
}
