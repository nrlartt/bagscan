"use client";

import Link from "next/link";
import Image from "next/image";
import { formatCurrency, formatNumber, shortenAddress, cn, getValuationMetric } from "@/lib/utils";
import { ProviderBadge } from "./Badges";
import type { NormalizedToken } from "@/lib/bags/types";
import { TrendingUp, Activity, ArrowUpDown, Zap, ArrowRightLeft, Radio, Clock } from "lucide-react";

function timeAgo(dateStr?: string): string | null {
    if (!dateStr) return null;
    const ms = Date.now() - new Date(dateStr).getTime();
    if (ms < 0) return null;
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s AGO`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m AGO`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h AGO`;
    const day = Math.floor(hr / 24);
    return `${day}d AGO`;
}

interface TokenCardProps {
    token: NormalizedToken;
    isNewLaunch?: boolean;
    index?: number;
    surfaceVariant?: "default" | "trending" | "new";
}

export function TokenCard({
    token,
    isNewLaunch,
    index = 0,
    surfaceVariant = "default",
}: TokenCardProps) {
    const changePositive = (token.priceChange24h ?? 0) >= 0;
    const valuation = getValuationMetric(token);
    const hasMarketData = !!(token.priceUsd || valuation.value || token.volume24hUsd);
    const isMigrated = !!token.isMigrated;
    const isNew = isNewLaunch && !hasMarketData;
    const launchTime = timeAgo(token.pairCreatedAt);
    const isPremiumTrending = surfaceVariant === "trending";
    const isPremiumNew = surfaceVariant === "new";
    const isPremium = isPremiumTrending || isPremiumNew;
    const useLaunchPalette = isPremiumNew || isNew;

    return (
        <Link
            href={`/token/${token.tokenMint}`}
            className={cn(
                "group block border p-4 relative overflow-hidden transition-all duration-300",
                isPremium
                    ? useLaunchPalette
                        ? "border-[#ffb800]/16 bg-[linear-gradient(180deg,rgba(0,0,0,0.92),rgba(40,22,0,0.92))] shadow-[0_0_28px_rgba(255,184,0,0.04)] hover:border-[#ffb800]/38 hover:shadow-[0_20px_60px_rgba(255,184,0,0.10)]"
                        : "border-[#00ff41]/16 bg-[linear-gradient(180deg,rgba(0,0,0,0.92),rgba(0,22,10,0.92))] shadow-[0_0_28px_rgba(0,255,65,0.04)] hover:border-[#00ff41]/38 hover:shadow-[0_20px_60px_rgba(0,255,65,0.08)]"
                    : isNew
                        ? "bg-black/70 border-[#ffb800]/15 new-launch-card hover:border-[#ffb800]/50"
                        : "bg-black/70 border-[#00ff41]/15 hover:border-[#00ff41]/40 hover:bg-[#00ff41]/[0.02]"
            )}
            style={isNew ? { animationDelay: `${index * 150}ms` } : undefined}
        >
            {isPremium && (
                <>
                    <div
                        className={cn(
                            "absolute inset-x-0 top-0 h-px opacity-85",
                            useLaunchPalette
                                ? "bg-[linear-gradient(90deg,transparent,rgba(255,184,0,0.7),transparent)]"
                                : "bg-[linear-gradient(90deg,transparent,rgba(0,255,65,0.6),transparent)]"
                        )}
                    />
                    <div
                        className={cn(
                            "absolute inset-0 opacity-90",
                            useLaunchPalette
                                ? "bg-[radial-gradient(circle_at_top_right,rgba(255,184,0,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,120,0,0.08),transparent_36%)]"
                                : "bg-[radial-gradient(circle_at_top_right,rgba(0,255,65,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(0,170,255,0.08),transparent_36%)]"
                        )}
                    />
                </>
            )}

            {/* Animated scanline for new tokens */}
            {isNew && (
                <div className="absolute inset-0 pointer-events-none z-0">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#ffb800]/[0.03] via-transparent to-transparent" />
                </div>
            )}

            {/* Header */}
            <div className="relative flex items-start gap-3 z-[1]">
                <div className={cn(
                    "relative w-10 h-10 overflow-hidden flex-shrink-0 border transition-all",
                    useLaunchPalette
                        ? "border-[#ffb800]/25 group-hover:border-[#ffb800]/50"
                        : "border-[#00ff41]/20 group-hover:border-[#00ff41]/40"
                )}>
                    {token.image ? (
                        <Image src={token.image} alt={token.name ?? "Token"} fill className="object-cover" unoptimized />
                    ) : (
                        <div className={cn(
                            "w-full h-full flex items-center justify-center text-sm",
                            useLaunchPalette ? "text-[#ffb800]/40 bg-[#ffb800]/5" : "text-[#00ff41]/40 bg-[#00ff41]/5"
                        )}>
                            {token.symbol?.charAt(0) ?? "?"}
                        </div>
                    )}
                    {/* Live signal indicator for new tokens */}
                    {isNew && (
                        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5">
                            <span className="absolute inset-0 rounded-full bg-[#ffb800] animate-ping opacity-40" />
                            <span className="relative block w-2.5 h-2.5 rounded-full bg-[#ffb800]" style={{ boxShadow: '0 0 4px #ffb800' }} />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className={cn(
                            "text-xs truncate tracking-wider transition-colors",
                            useLaunchPalette ? "text-[#ffb800] group-hover:text-[#ffcf63]" : "text-[#00ff41] group-hover:text-[#8dffb1]"
                        )} style={{ textShadow: useLaunchPalette ? '0 0 6px rgba(255,184,0,0.3)' : '0 0 6px rgba(0,255,65,0.3)' }}>
                            {token.name ?? shortenAddress(token.tokenMint)}
                        </h3>
                        {token.symbol && (
                            <span className={cn(
                                "text-[9px] tracking-wider border px-1.5 py-0.5",
                                useLaunchPalette ? "text-[#ffb800]/40 border-[#ffb800]/14 bg-[#ffb800]/[0.04]" : "text-[#00ff41]/35 border-[#00ff41]/12 bg-[#00ff41]/[0.03]"
                            )}>
                                ${token.symbol}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        {token.creatorDisplay && (
                            <span className={cn("text-[10px] truncate tracking-wider", useLaunchPalette ? "text-[#ffb800]/28" : "text-[#00ff41]/30")}>
                                {token.creatorDisplay}
                            </span>
                        )}
                        <ProviderBadge provider={token.provider} className="scale-90 origin-left" />
                    </div>
                </div>
                {token.priceChange24h !== undefined ? (
                    <div className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] tracking-wider border ${changePositive ? "text-[#00ff41] border-[#00ff41]/30 bg-[#00ff41]/5" : "text-[#ff4400] border-[#ff4400]/30 bg-[#ff4400]/5"}`}>
                        {changePositive ? "+" : ""}{token.priceChange24h.toFixed(1)}%
                    </div>
                ) : isNew ? (
                    <div className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 text-[10px] tracking-wider border text-[#ffb800] border-[#ffb800]/30 bg-[#ffb800]/5 new-badge-animated">
                        <Radio className="w-2.5 h-2.5" />
                        LIVE
                    </div>
                ) : !hasMarketData ? (
                    <div className="flex-shrink-0 px-1.5 py-0.5 text-[10px] tracking-wider border text-[#ffb800] border-[#ffb800]/30 bg-[#ffb800]/5 animate-pulse">
                        NEW
                    </div>
                ) : null}
            </div>

            {/* Metrics */}
            <div className="relative mt-4 grid grid-cols-2 gap-2 z-[1]">
                {hasMarketData ? (
                    <>
                        <div className={cn("p-2 border bg-black/40", useLaunchPalette ? "border-[#ffb800]/10" : "border-[#00ff41]/10")}>
                            <div className="flex items-center gap-1">
                                <TrendingUp className={cn("w-3 h-3", useLaunchPalette ? "text-[#ffb800]/35" : "text-[#00ff41]/30")} />
                                <span className={cn("text-[9px] uppercase tracking-[0.15em]", useLaunchPalette ? "text-[#ffb800]/35" : "text-[#00ff41]/30")}>
                                    {valuation.shortLabel}
                                </span>
                            </div>
                            <p className={cn("text-xs mt-0.5 tracking-wider", useLaunchPalette ? "text-[#fff0bd]/80" : "text-[#00ff41]/80")}>
                                {formatCurrency(valuation.value)}
                            </p>
                        </div>
                        <div className={cn("p-2 border bg-black/40", useLaunchPalette ? "border-[#ffb800]/10" : "border-[#00ff41]/10")}>
                            <div className="flex items-center gap-1">
                                <Activity className={cn("w-3 h-3", useLaunchPalette ? "text-[#ffb800]/35" : "text-[#00ff41]/30")} />
                                <span className={cn("text-[9px] uppercase tracking-[0.15em]", useLaunchPalette ? "text-[#ffb800]/35" : "text-[#00ff41]/30")}>24H VOL</span>
                            </div>
                            <p className={cn("text-xs mt-0.5 tracking-wider", useLaunchPalette ? "text-[#fff0bd]/80" : "text-[#00ff41]/80")}>
                                {formatCurrency(token.volume24hUsd)}
                            </p>
                        </div>
                    </>
                ) : (
                    <>
                        <div className={cn("p-2 border bg-black/40", isNew ? "border-[#ffb800]/10" : "border-[#ffb800]/10")}>
                            <div className="flex items-center gap-1">
                                <Zap className="w-3 h-3 text-[#ffb800]/40" />
                                <span className="text-[9px] text-[#ffb800]/40 uppercase tracking-[0.15em]">STATUS</span>
                            </div>
                            <p className="text-[10px] text-[#ffb800]/60 mt-0.5 tracking-wider">
                                {isMigrated ? "MIGRATED" : "BONDING CURVE"}
                            </p>
                        </div>
                        <div className={cn("p-2 border bg-black/40", isNew ? "border-[#ffb800]/10" : "border-[#ffb800]/10")}>
                            <div className="flex items-center gap-1">
                                <ArrowRightLeft className="w-3 h-3 text-[#ffb800]/40" />
                                <span className="text-[9px] text-[#ffb800]/40 uppercase tracking-[0.15em]">PHASE</span>
                            </div>
                            <p className="text-[10px] text-[#ffb800]/60 mt-0.5 tracking-wider">
                                {isMigrated ? "DEX LIVE" : "EARLY STAGE"}
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* Bottom row */}
            <div className={cn("relative mt-3 flex items-center justify-between z-[1]", isPremium ? "border-t pt-3" : "", useLaunchPalette ? "border-[#ffb800]/10" : "border-[#00ff41]/10")}>
                <span className={cn("text-[9px] tracking-wider", useLaunchPalette ? "text-[#ffb800]/18" : "text-[#00ff41]/15")}>
                    {shortenAddress(token.tokenMint)}
                </span>
                <div className="flex items-center gap-2">
                    {isNewLaunch && launchTime && (
                        <span className="inline-flex items-center gap-1 text-[9px] text-[#ffb800]/40 tracking-wider">
                            <Clock className="w-2.5 h-2.5" />
                            {launchTime}
                        </span>
                    )}
                    {token.txCount24h !== undefined && token.txCount24h > 0 ? (
                        <span className={cn("inline-flex items-center gap-1 text-[9px] tracking-wider", useLaunchPalette ? "text-[#ffb800]/35" : "text-[#00ff41]/25")}>
                            <ArrowUpDown className="w-2.5 h-2.5" />
                            {formatNumber(token.txCount24h)} TXS
                        </span>
                    ) : token.priceUsd ? (
                        <span className={cn("text-[9px] tracking-wider", useLaunchPalette ? "text-[#ffb800]/35" : "text-[#00ff41]/25")}>
                            ${token.priceUsd < 0.0001 ? token.priceUsd.toExponential(2) : token.priceUsd.toFixed(6)}
                        </span>
                    ) : isNew && !launchTime ? (
                        <span className="text-[8px] text-[#ffb800]/20 tracking-[0.15em]">JUST LAUNCHED</span>
                    ) : null}
                </div>
            </div>
        </Link>
    );
}
