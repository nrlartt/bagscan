import { getTokenHolderAccess } from "@/lib/scan/access";
import type { AlertAccessState } from "./types";

export const ALERTS_SCAN_MINT = "BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS";
export const ALERTS_MIN_SCAN_REQUIRED = 2_500_000;

export class AlertAccessError extends Error {
    readonly status = 403;
    readonly access: AlertAccessState;

    constructor(access: AlertAccessState) {
        super(createAlertAccessDeniedMessage(access));
        this.name = "AlertAccessError";
        this.access = access;
    }
}

export function createAlertAccessDeniedMessage(access: Pick<AlertAccessState, "requiredUi" | "balanceUi">) {
    return `Alerts are reserved for wallets holding at least ${access.requiredUi} $SCAN. Current balance: ${access.balanceUi} $SCAN.`;
}

export async function getAlertAccess(wallet: string): Promise<AlertAccessState> {
    const result = await getTokenHolderAccess({
        wallet,
        mint: ALERTS_SCAN_MINT,
        minimumUi: ALERTS_MIN_SCAN_REQUIRED,
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

export async function ensureAlertAccess(wallet: string) {
    const access = await getAlertAccess(wallet);
    if (!access.eligible) {
        throw new AlertAccessError(access);
    }
    return access;
}
