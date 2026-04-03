import { BagsSDK } from "@bagsfm/bags-sdk";
import { Connection } from "@solana/web3.js";
import { getRpcUrl } from "@/lib/solana";

declare global {
    var __bagscanBagsSdk: BagsSDK | undefined;
}

export function getBagsSdk() {
    if (!globalThis.__bagscanBagsSdk) {
        const connection = new Connection(getRpcUrl(), "confirmed");
        globalThis.__bagscanBagsSdk = new BagsSDK(
            process.env.BAGS_API_KEY ?? "",
            connection,
            "confirmed"
        );
    }

    return globalThis.__bagscanBagsSdk;
}
