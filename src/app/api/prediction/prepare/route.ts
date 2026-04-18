export const dynamic = "force-dynamic";
export { preferredRegion } from "../segment-config";

import { NextRequest, NextResponse } from "next/server";
import { predictionPrepareBodySchema } from "@/lib/validators";
import {
    getJupiterPredictionFundingOrder,
    USDC_MINT,
} from "@/lib/jupiter/swap";
import { SCAN_MINT } from "@/lib/scan/constants";
import {
    formatRawAmountToUi,
    getMintDecimals,
    parseUiAmountToRaw,
} from "@/lib/solana/mint";

const SAFE_DEPOSIT_BUFFER_BPS = 9850;
const USDC_DECIMALS = 6;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = predictionPrepareBodySchema.parse(body);

        const scanDecimals = await getMintDecimals(SCAN_MINT);
        const scanAmountRaw = parseUiAmountToRaw(data.scanAmountUi, scanDecimals);

        if (scanAmountRaw <= BigInt(0)) {
            return NextResponse.json(
                { success: false, error: "Enter a valid $SCAN amount." },
                { status: 400 }
            );
        }

        const fundingOrder = await getJupiterPredictionFundingOrder({
            taker: data.ownerPubkey,
            amount: Number(scanAmountRaw),
            slippageBps: data.slippageBps ?? 250,
        });

        const quotedOutRaw = BigInt(
            String(
                fundingOrder.outputAmount ??
                    fundingOrder.outAmount ??
                    0
            )
        );

        if (quotedOutRaw <= BigInt(0)) {
            throw new Error("Jupiter did not return a usable USDC funding quote.");
        }

        const reservedOutRaw =
            (quotedOutRaw * BigInt(SAFE_DEPOSIT_BUFFER_BPS)) / BigInt(10_000);
        const leftoverRaw = quotedOutRaw - reservedOutRaw;

        return NextResponse.json({
            success: true,
            data: {
                fundingOrder,
                fundingMint: USDC_MINT,
                scanMint: SCAN_MINT,
                scanDecimals,
                scanAmountRaw: scanAmountRaw.toString(),
                scanAmountUi: formatRawAmountToUi(scanAmountRaw, scanDecimals),
                quotedOutRaw: quotedOutRaw.toString(),
                quotedOutUi: formatRawAmountToUi(quotedOutRaw, USDC_DECIMALS),
                reservedOutRaw: reservedOutRaw.toString(),
                reservedOutUi: formatRawAmountToUi(reservedOutRaw, USDC_DECIMALS),
                leftoverRaw: leftoverRaw.toString(),
                leftoverUi: formatRawAmountToUi(leftoverRaw, USDC_DECIMALS),
                reserveBps: SAFE_DEPOSIT_BUFFER_BPS,
            },
        });
    } catch (error) {
        console.error("[api/prediction/prepare] error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Prediction funding preview could not be prepared.",
            },
            { status: 500 }
        );
    }
}
