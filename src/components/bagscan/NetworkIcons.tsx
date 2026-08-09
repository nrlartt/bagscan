import { cn } from "@/lib/utils";
import type { BagScanNetwork } from "@/lib/networks";

/**
 * Official Solana logomark — three slanted bars on a 397.7 × 311.7 canvas.
 * Drawn with `currentColor` so each surface picks its own tint (dark on the
 * light network pill, light on the terminal chrome).
 */
const SOLANA_VIEWBOX = { width: 397.7, height: 311.7 } as const;

const SOLANA_PATHS = [
    "M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z",
    "M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z",
    "M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z",
];

/** Robinhood feather — neon green, no background circle (bags.fm style). */
const ROBINHOOD_FEATHER =
    "M2.84 24h.53c.096 0 .192-.048.224-.128C7.591 13.696 11.94 8.656 14.67 5.638c.112-.128.064-.225-.096-.225h-4.88a.55.55 0 0 0-.45.225L5.746 9.972c-.514.642-.642 1.236-.642 2.086v4.43c-1.14 3.194-1.862 5.361-2.392 7.32-.032.125.016.192.129.192M20.447.646c-.754-.802-4.157-.834-5.73-.224a3 3 0 0 0-.786.465 41 41 0 0 0-3.323 3.178c-.112.113-.064.225.097.225h5.409c.497 0 .786.289.786.786v6.1c0 .16.128.208.225.064l3.258-4.254c.53-.69.69-.898.835-1.861.192-1.413.08-3.58-.77-4.479m-6.982 16.18 2.231-3.676a.7.7 0 0 0 .064-.29V6.73c0-.16-.112-.225-.224-.097-3.355 3.74-5.971 7.672-8.395 12.407-.06.12.016.225.16.177l5.009-1.54c.565-.174.882-.402 1.155-.852";

interface NetworkIconProps {
    network: BagScanNetwork;
    size?: number;
    className?: string;
}

export function SolanaNetworkIcon({ size = 18, className }: { size?: number; className?: string }) {
    const height = Math.round(size * (SOLANA_VIEWBOX.height / SOLANA_VIEWBOX.width));
    return (
        <svg
            width={size}
            height={height}
            viewBox={`0 0 ${SOLANA_VIEWBOX.width} ${SOLANA_VIEWBOX.height}`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("shrink-0", className)}
            aria-hidden
        >
            {SOLANA_PATHS.map((d) => (
                <path key={d.slice(0, 12)} fill="currentColor" d={d} />
            ))}
        </svg>
    );
}

export function RobinhoodNetworkIcon({ size = 18, className }: { size?: number; className?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("shrink-0", className)}
            aria-hidden
        >
            <path fill="#00C805" d={ROBINHOOD_FEATHER} />
        </svg>
    );
}

export function NetworkIcon({ network, size = 18, className }: NetworkIconProps) {
    if (network === "robinhood") {
        return <RobinhoodNetworkIcon size={size} className={className} />;
    }
    // No hard-coded tint: the Solana mark inherits `currentColor` from its surface.
    return <SolanaNetworkIcon size={size} className={className} />;
}

/** Robinhood accent palette for RH-specific surfaces. */
export const RH_THEME = {
    green: "#00C805",
    greenDim: "rgba(0,200,5,0.12)",
    greenBorder: "rgba(0,200,5,0.28)",
    greenGlow: "rgba(0,200,5,0.14)",
} as const;
