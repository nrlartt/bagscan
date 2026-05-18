"use client";

import Link from "next/link";
import { useMemo } from "react";
import { RemoteFillImage } from "./RemoteFillImage";
import { Radio } from "lucide-react";
import { formatCurrency, shortenAddress, getValuationMetric, cn } from "@/lib/utils";
import type { NormalizedToken } from "@/lib/bags/types";

interface LiveTickerProps {
    tokens: NormalizedToken[];
    /** What the marquee highlights (label only). */
    mode?: "trending" | "latest";
}

const SCAN_MINT = "BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS";
const SCAN_LINK = "https://bags.fm/BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS";
const MAX_STRIP_TOKENS_TRENDING = 28;
const MAX_STRIP_TOKENS_LATEST = 48;

export function LiveTicker({ tokens, mode = "trending" }: LiveTickerProps) {
    const stripTokens = useMemo(() => {
        const withoutScan = tokens.filter((t) => t.tokenMint !== SCAN_MINT);
        const cap = mode === "latest" ? MAX_STRIP_TOKENS_LATEST : MAX_STRIP_TOKENS_TRENDING;
        return withoutScan.slice(0, cap);
    }, [tokens, mode]);

    const scanFromFeed = useMemo(
        () => tokens.find((t) => t.tokenMint === SCAN_MINT) ?? null,
        [tokens]
    );

    return (
        <div className="mb-5 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0a0c] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[box-shadow,border-color] duration-500 motion-safe:animate-[border-glow_5s_ease-in-out_infinite]">
            <div className="flex min-h-[44px] items-stretch">
                <div className="flex shrink-0 items-center gap-2 border-r border-white/[0.06] bg-[#121214] px-3 py-2">
                    <Radio className="h-3.5 w-3.5 shrink-0 animate-pulse text-emerald-400" />
                    <span className="hidden flex-col text-[9px] font-medium leading-tight tracking-wide text-white/45 sm:flex">
                        <span className="text-white/70">MARKET</span>
                        {mode === "latest" ? (
                            <span className="text-emerald-400/90">Fresh tape</span>
                        ) : (
                            <span className="text-white/35">Flow tape</span>
                        )}
                    </span>
                </div>
                <div className="bagscan-marquee-outer min-w-0 flex-1 py-2 pr-1">
                    <div
                        className="bagscan-marquee-track"
                        role="presentation"
                        aria-label={mode === "latest" ? "Market tape — latest launches" : "Market tape — trending"}
                    >
                        <MarqueeSegment stripTokens={stripTokens} scanFromFeed={scanFromFeed} idPrefix="a" mode={mode} />
                        <MarqueeSegment
                            stripTokens={stripTokens}
                            scanFromFeed={scanFromFeed}
                            idPrefix="b"
                            ariaHidden
                            mode={mode}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function MarqueeSegment({
    stripTokens,
    scanFromFeed,
    idPrefix,
    ariaHidden = false,
    mode = "trending",
}: {
    stripTokens: NormalizedToken[];
    scanFromFeed: NormalizedToken | null;
    idPrefix: string;
    ariaHidden?: boolean;
    mode?: "trending" | "latest";
}) {
    return (
        <div className="flex items-center gap-0 px-2" aria-hidden={ariaHidden ? true : undefined}>
            <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] tracking-wide text-white/55">
                {mode === "latest" ? (
                    <span className="font-medium text-emerald-400/90">NEW</span>
                ) : null}
                <span className="font-semibold text-[#c4f59c]/90">$SCAN</span>
                <a
                    href={SCAN_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/50 underline-offset-2 transition-colors hover:text-white/80"
                >
                    Trade
                </a>
                {scanFromFeed?.priceChange24h !== undefined ? (
                    <span
                        className={
                            scanFromFeed.priceChange24h >= 0 ? "font-medium text-emerald-400" : "font-medium text-red-400"
                        }
                    >
                        {scanFromFeed.priceChange24h >= 0 ? "+" : ""}
                        {scanFromFeed.priceChange24h.toFixed(1)}%
                    </span>
                ) : null}
                <span className="text-white/20">·</span>
            </span>

            {stripTokens.map((token) => (
                <TickerTokenItem key={`${idPrefix}-${token.tokenMint}`} token={token} />
            ))}
        </div>
    );
}

function TickerTokenItem({ token }: { token: NormalizedToken }) {
    const valuation = getValuationMetric(token);
    const change = token.priceChange24h;
    const changePositive = (change ?? 0) >= 0;

    return (
        <Link
            href={`/token/${token.tokenMint}`}
            className="inline-flex items-center gap-2 whitespace-nowrap border-l border-white/[0.06] px-3 text-[10px] tracking-wide text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white/85"
        >
            <span className="relative block h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/[0.08]">
                <RemoteFillImage
                    src={token.image}
                    alt=""
                    sizes="32px"
                    className="object-cover"
                    fallback={
                        <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white/35">
                            {token.symbol?.charAt(0) ?? "?"}
                        </span>
                    }
                />
            </span>
            <span className="max-w-[100px] truncate font-semibold text-white/88">
                {token.symbol ? `$${token.symbol}` : shortenAddress(token.tokenMint)}
            </span>
            {valuation.value !== undefined && valuation.value > 0 ? (
                <span className="hidden text-white/40 sm:inline">{formatCurrency(valuation.value)}</span>
            ) : null}
            <span className="hidden text-white/25 sm:inline">/</span>
            {token.volume24hUsd !== undefined && token.volume24hUsd > 0 ? (
                <span className="hidden text-white/40 md:inline">{formatCurrency(token.volume24hUsd)} vol</span>
            ) : null}
            {change !== undefined ? (
                <span
                    className={cn(
                        "font-semibold tabular-nums",
                        changePositive ? "text-emerald-400" : "text-red-400"
                    )}
                >
                    {changePositive ? "+" : ""}
                    {change.toFixed(1)}%
                </span>
            ) : null}
            <span className="text-white/15">·</span>
        </Link>
    );
}
