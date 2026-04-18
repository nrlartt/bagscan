export const dynamic = "force-dynamic";
export { preferredRegion } from "../../segment-config";

import { NextRequest, NextResponse } from "next/server";
import { getJupiterPredictionOrderStatus } from "@/lib/jupiter/prediction";

interface Params {
    params: Promise<{
        orderPubkey: string;
    }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        const { orderPubkey } = await params;
        if (!orderPubkey) {
            return NextResponse.json(
                { success: false, error: "Missing orderPubkey." },
                { status: 400 }
            );
        }

        const status = await getJupiterPredictionOrderStatus(orderPubkey);
        return NextResponse.json(
            {
                success: true,
                data: status,
            },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            }
        );
    } catch (error) {
        console.error("[api/prediction/order-status] error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Prediction order status could not be loaded.",
            },
            { status: 500 }
        );
    }
}
