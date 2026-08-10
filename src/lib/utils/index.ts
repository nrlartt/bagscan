import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Shorten an address for display: 0xAB...cdEF */
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

function trimTrailingZeros(value: string): string {
    return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
}

/**
 * Render a small decimal without collapsing it to zero.
 * Bonding-curve tokens routinely price below $0.0001, where `toFixed(2)` prints
 * "0.00" and `toExponential()` prints "1.23e-7" — both unreadable on a card.
 */
export function formatCompactDecimal(
    value: number | null | undefined,
    opts?: { significant?: number; maxDecimals?: number }
): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    const { significant = 3, maxDecimals = 18 } = opts ?? {};
    const abs = Math.abs(value);
    if (abs === 0) return "0";
    if (abs >= 1) return trimTrailingZeros(value.toFixed(2));
    if (abs >= 0.01) return trimTrailingZeros(value.toFixed(4));

    // Keep `significant` digits past the leading zeros: 0.000000123 → "0.000000123"
    const leadingZeros = -Math.floor(Math.log10(abs)) - 1;
    const decimals = Math.min(maxDecimals, leadingZeros + significant);
    return trimTrailingZeros(value.toFixed(decimals));
}

/** USD price of a single token, readable across the whole magnitude range. */
export function formatTokenPrice(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    if (value >= 1) return formatCurrency(value, { compact: value >= 1_000_000 });
    return `$${formatCompactDecimal(value)}`;
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

export { parseFetchResponseAsJson } from "./parse-fetch-json";

/** Copy to clipboard helper. */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}
