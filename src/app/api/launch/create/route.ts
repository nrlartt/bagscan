export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createLaunchSchema } from "@/lib/validators";
import { createLaunchTransaction } from "@/lib/bags/client";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = createLaunchSchema.parse(body);

        const result = await createLaunchTransaction({
            ipfs: data.ipfs,
            tokenMint: data.tokenMint,
            wallet: data.wallet,
            initialBuyLamports: data.initialBuyLamports,
            configKey: data.configKey,
            tipWallet: data.tipWallet || undefined,
            tipLamports: data.tipLamports,
        });

        try {
            await prisma.launchDraft.create({
                data: {
                    tokenMint: data.tokenMint,
                    tokenMetadata: data.ipfs,
                    feeShareConfig: data.configKey,
                    partnerIncluded: data.partnerIncluded ?? true,
                    name: body.name ?? "Unknown",
                    symbol: body.symbol ?? "???",
                    description: body.description ?? "",
                    imageUrl: body.imageUrl,
                    website: body.website,
                    twitter: body.twitter,
                    telegram: body.telegram,
                    walletAddress: data.wallet,
                },
            });
        } catch (e) {
            console.error("[api/launch/create] draft save error:", e);
        }

        return NextResponse.json({ success: true, data: result });
    } catch (e) {
        console.error("[api/launch/create] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}
