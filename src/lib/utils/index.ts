import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Shorten a Solana address: ABcD...xYzW */
export function shortenAddress(address: string, chars = 4): string {
    if (!address) return "";
    if (address.length <= chars * 2 + 3) return address;
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/** Format a number as compact currency: $1.2M */
export function formatCurrency(
    value: number | null | undefined,
    opts?: { compact?: boolean; decimals?: number }
): string {
    if (value === null || value === undefined || !Number.isFinite(value))
        return "—";
    const { compact = true, decimals = 2 } = opts ?? {};
    if (compact && Math.abs(value) >= 1_000) {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            notation: "compact",
            maximumFractionDigits: decimals,
        }).format(value);
    }
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals > 2 ? decimals : 6,
    }).format(value);
}

export type ValuationSource = "market-cap" | "fdv" | "none";

export function getValuationMetric(input: {
    marketCap?: number | null;
    fdvUsd?: number | null;
}): {
    value: number | undefined;
    shortLabel: "MCAP" | "FDV" | "VAL";
    longLabel: "Market Cap" | "FDV" | "Valuation";
    source: ValuationSource;
    description?: string;
} {
    if (input.marketCap !== null && input.marketCap !== undefined && Number.isFinite(input.marketCap)) {
        return {
            value: input.marketCap,
            shortLabel: "MCAP",
            longLabel: "Market Cap",
            source: "market-cap",
            description: "Official Bags market cap",
        };
    }

    if (input.fdvUsd !== null && input.fdvUsd !== undefined && Number.isFinite(input.fdvUsd)) {
        return {
            value: input.fdvUsd,
            shortLabel: "FDV",
            longLabel: "FDV",
            source: "fdv",
            description: "Estimated fully diluted valuation fallback",
        };
    }

    return {
        value: undefined,
        shortLabel: "VAL",
        longLabel: "Valuation",
        source: "none",
    };
}

/** Format plain number compactly: 1.2M */
export function formatNumber(
    value: number | null | undefined,
    compact = true
): string {
    if (value === null || value === undefined || !Number.isFinite(value))
        return "—";
    if (compact) {
        return new Intl.NumberFormat("en-US", {
            notation: "compact",
            maximumFractionDigits: 2,
        }).format(value);
    }
    return new Intl.NumberFormat("en-US").format(value);
}

/** Basis points → percent string: 250 → "2.5%" */
export function bpsToPercent(bps: number | null | undefined): string {
    if (bps === null || bps === undefined) return "—";
    return `${(bps / 100).toFixed(2)}%`;
}

/** Copy to clipboard helper. */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}
