import { getTokenHolderAccess } from "@/lib/scan/access";
import type { TalkAccessState } from "./types";

export const TALK_SCAN_MINT = "BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS";
export const TALK_MIN_SCAN_REQUIRED = 2_500_000;

export class TalkAccessError extends Error {
    readonly status = 403;
    readonly access: TalkAccessState;

    constructor(access: TalkAccessState) {
        super(createTalkAccessDeniedMessage(access));
        this.name = "TalkAccessError";
        this.access = access;
    }
}

export function createTalkAccessDeniedMessage(access: Pick<TalkAccessState, "requiredUi" | "balanceUi">) {
    return `Talk To Bags is reserved for wallets holding at least ${access.requiredUi} $SCAN. Current balance: ${access.balanceUi} $SCAN.`;
}

export async function getTalkAccess(wallet: string): Promise<TalkAccessState> {
    const result = await getTokenHolderAccess({
        wallet,
        mint: TALK_SCAN_MINT,
        minimumUi: TALK_MIN_SCAN_REQUIRED,
    });

    return {
        wallet: result.wallet,
        eligible: result.eligible,
        mint: result.mint,
        balanceUi: result.balanceUi,
        requiredUi: result.requiredUi,
        shortfallUi: result.shortfallUi,
        checkedAt: result.checkedAt,
    };
}

export async function ensureTalkAccess(wallet: string) {
    const access = await getTalkAccess(wallet);
    if (!access.eligible) {
        throw new TalkAccessError(access);
    }
    return access;
}
