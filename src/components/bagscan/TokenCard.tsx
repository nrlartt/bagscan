"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
    formatCurrency,
    formatNumber,
    formatTokenPrice,
    shortenAddress,
    cn,
    getValuationMetric,
} from "@/lib/utils";
import { ProviderBadge } from "./Badges";
import { RemoteFillImage, REMOTE_IMAGE_SIZES_GRID } from "./RemoteFillImage";
import type { NormalizedToken } from "@/lib/bags/types";
import type { ExploreLane } from "@/lib/sync";
import { TrendingUp, Activity, ArrowUpDown, Zap, ArrowRightLeft, Radio, Clock, Star } from "lucide-react";

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

/** Compact age label (e.g. 3d, 2h). */
function timeAgoShort(dateStr?: string): string | null {
    if (!dateStr) return null;
    const ms = Date.now() - new Date(dateStr).getTime();
    if (ms < 0) return null;
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 48) return `${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 60) return `${day}d`;
    const mo = Math.floor(day / 30);
    return `${mo}mo`;
}

/** Footer timing / context aligned with the active EXPLORE COINS lane (not always “pair age”). */
function ExploreFeedContextRow({ token, lane }: { token: NormalizedToken; lane?: ExploreLane }) {
    if (lane === "last_trade") {
        const parts: string[] = [];
        if ((token.txCount5m ?? 0) > 0) parts.push(`${formatNumber(token.txCount5m!)} tx · 5m`);
        if ((token.txCount1h ?? 0) > 0) parts.push(`${formatNumber(token.txCount1h!)} tx · 1h`);
        if (parts.length === 0 && (token.txCount24h ?? 0) > 0) {
            parts.push(`${formatNumber(token.txCount24h!)} tx · 24h`);
        }
        const label = parts.length > 0 ? parts.join(" · ") : "DEX activity…";
        return (
            <span className="inline-flex items-center gap-0.5 text-[9px] tracking-wider text-[#00ff41]/42">
                <Activity className="h-2.5 w-2.5 shrink-0" />
                {label}
            </span>
        );
    }
    if (lane === "mcap") {
        return (
            <span className="inline-flex items-center gap-0.5 text-[9px] tracking-wider text-[#00ff41]/32">
                <TrendingUp className="h-2.5 w-2.5 shrink-0" />
                BY MCAP
            </span>
        );
    }
    if (lane === "trending") {
        const ch = token.priceChange24h;
        const v = token.volume24hUsd;
        const parts: string[] = [];
        if (ch !== undefined && Number.isFinite(ch)) {
            parts.push(`24H ${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%`);
        }
        if (v != null && v > 0) {
            parts.push(`VOL ${formatCurrency(v)}`);
        }
        if (parts.length === 0) return null;
        const chOk = ch !== undefined && Number.isFinite(ch);
        return (
            <span
                className={cn(
                    "inline-flex items-center gap-0.5 text-[9px] font-medium tabular-nums tracking-wider",
                    chOk && (ch as number) >= 0 ? "text-emerald-400/88" : chOk ? "text-red-400/88" : "text-[#00ff41]/40"
                )}
            >
                <TrendingUp className="h-2.5 w-2.5 shrink-0" />
                {parts.join(" · ")}
            </span>
        );
    }
    if (lane === "movers") {
        const ch = token.priceChange24h;
        if (ch === undefined || !Number.isFinite(ch)) return null;
        return (
            <span
                className={cn(
                    "inline-flex items-center gap-0.5 text-[9px] font-medium tabular-nums tracking-wider",
                    ch >= 0 ? "text-emerald-400/90" : "text-red-400/90"
                )}
            >
                <Zap className="h-2.5 w-2.5 shrink-0" />
                24H {ch >= 0 ? "+" : ""}
                {ch.toFixed(1)}%
            </span>
        );
    }
    if (lane === "agents") {
        const v = token.volume24hUsd;
        if (v === undefined || v <= 0) return null;
        return (
            <span className="inline-flex items-center gap-0.5 text-[9px] tracking-wider text-[#00ff41]/38">
                <Activity className="h-2.5 w-2.5 shrink-0" />
                24H VOL {formatCurrency(v)}
            </span>
        );
    }
    if (lane === "oldest") {
        const age = timeAgoShort(token.pairCreatedAt);
        if (!age) return null;
        return (
            <span className="inline-flex items-center gap-0.5 text-[9px] tracking-wider text-[#00ff41]/35">
                <Clock className="h-2.5 w-2.5 shrink-0" />
                PAIR {age}
            </span>
        );
    }
    const age = timeAgoShort(token.pairCreatedAt);
    if (!age) return null;
    return (
        <span className="inline-flex items-center gap-0.5 text-[9px] tracking-wider text-[#00ff41]/35">
            <Clock className="h-2.5 w-2.5 shrink-0" />
            {age}
        </span>
    );
}

/** Approximate intraday path from 24h change (visual only — no OHLC feed yet). */
function MiniSparkline({ change }: { change?: number }) {
    const up = (change ?? 0) >= 0;
    const points = useMemo(() => {
        const n = 16;
        let y = 52;
        const out: string[] = [];
        const bias = up ? 1.4 : -1.4;
        for (let i = 0; i < n; i++) {
            const jitter = Math.sin(i * 0.55) * 7 + (Math.cos(i * 0.9) * 4 + bias);
            y = Math.max(18, Math.min(82, y + jitter));
            out.push(`${(i / (n - 1)) * 100},${y}`);
        }
        return out.join(" ");
    }, [up]);

    return (
        <svg
            className="pointer-events-none absolute inset-x-2 bottom-1.5 z-[1] h-10 w-[calc(100%-16px)] opacity-90"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
        >
            <polyline fill="none" stroke={up ? "#00ff41" : "#ff4400"} strokeWidth="2" points={points} />
        </svg>
    );
}

interface TokenCardProps {
    token: NormalizedToken;
    isNewLaunch?: boolean;
    index?: number;
    surfaceVariant?: "default" | "trending" | "new";
    showSparkline?: boolean;
    watchlisted?: boolean;
    onToggleWatchlist?: (e: React.MouseEvent) => void;
    exploreLane?: ExploreLane;
}

export function TokenCard({
    token,
    isNewLaunch,
    index = 0,
    surfaceVariant = "default",
    showSparkline = false,
    watchlisted = false,
    onToggleWatchlist,
    exploreLane,
}: TokenCardProps) {
    if (isNewLaunch) {
        return (
            <NewLaunchTokenCard
                token={token}
                index={index}
                surfaceVariant={surfaceVariant}
            />
        );
    }

    return (
        <ExploreFeedTokenCard
            token={token}
            index={index}
            surfaceVariant={surfaceVariant}
            showSparkline={showSparkline}
            watchlisted={watchlisted}
            onToggleWatchlist={onToggleWatchlist}
            exploreLane={exploreLane}
        />
    );
}

function ExploreFeedTokenCard({
    token,
    index = 0,
    surfaceVariant = "default",
    showSparkline = false,
    watchlisted = false,
    onToggleWatchlist,
    exploreLane,
}: Omit<TokenCardProps, "isNewLaunch">) {
    const changePositive = (token.priceChange24h ?? 0) >= 0;
    const valuation = getValuationMetric(token);
    const hasMarketData = !!(token.priceUsd || valuation.value || token.volume24hUsd);
    const isMigrated = !!token.isMigrated;
    const isTrendingShell = surfaceVariant === "trending";

    const creatorLabel =
        token.creatorDisplay ||
        (token.creatorUsername ? `@${token.creatorUsername}` : null);

    const mcapForBadge = valuation.value ?? token.marketCap ?? token.fdvUsd;

    return (
        <div
            className={cn(
                "group relative overflow-hidden rounded-2xl border transition-all duration-300",
                "bg-black/70 border-[#00ff41]/15 hover:border-[#00ff41]/45 hover:bg-[#00ff41]/[0.02]",
                "hover:shadow-[0_14px_48px_rgba(0,255,65,0.07)] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
                isTrendingShell && "shadow-[0_0_28px_rgba(0,255,65,0.04)]",
                exploreLane === "new" && "animate-explore-card-in motion-reduce:animate-none motion-reduce:opacity-100"
            )}
            style={{ animationDelay: `${index * 48}ms` }}
        >
            <Link
                href={`/token/${token.tokenMint}`}
                className="block overflow-hidden"
            >
            <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-[#00ff41]/10 bg-black/80">
                <RemoteFillImage
                    src={token.image}
                    alt={token.name ?? "Token"}
                    sizes={REMOTE_IMAGE_SIZES_GRID}
                    priority={index < 20}
                    quality={index < 20 ? 68 : 58}
                    className="transition-transform duration-500 group-hover:scale-[1.03]"
                    fallback={
                    <div className="absolute inset-0 flex items-center justify-center text-3xl text-[#00ff41]/25">
                        {token.symbol?.charAt(0) ?? "?"}
                    </div>
                    }
                />
                {showSparkline ? <MiniSparkline change={token.priceChange24h} /> : null}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/85 to-transparent" />
                {mcapForBadge != null && mcapForBadge > 0 ? (
                    <span
                        className={cn(
                            "pointer-events-none absolute bottom-2 left-2 z-[2] max-w-[calc(100%-4rem)] truncate rounded-md border border-white/12 bg-black/70 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/92 backdrop-blur-md",
                            exploreLane === "new" && "explore-mc-pill motion-reduce:animate-none"
                        )}
                    >
                        {formatCurrency(mcapForBadge)}{" "}
                        <span className="text-[8px] font-normal tracking-wide text-white/45">MC</span>
                    </span>
                ) : null}
                {token.priceChange24h !== undefined ? (
                    <div
                        className={cn(
                            "absolute right-2 top-2 px-1.5 py-0.5 text-[10px] tracking-wider border backdrop-blur-sm z-[2]",
                            changePositive
                                ? "border-[#00ff41]/35 bg-black/50 text-[#00ff41]"
                                : "border-[#ff4400]/35 bg-black/50 text-[#ff4400]"
                        )}
                    >
                        {changePositive ? "+" : ""}
                        {token.priceChange24h.toFixed(1)}%
                    </div>
                ) : null}
            </div>

            <div className="space-y-2 p-3">
                <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                        <p
                            className={cn(
                                "text-base font-medium leading-none tracking-tight text-white/95",
                                !valuation.value && !token.priceUsd && "text-white/35"
                            )}
                        >
                            {valuation.value !== undefined
                                ? formatCurrency(valuation.value)
                                : token.priceUsd
                                  ? formatTokenPrice(token.priceUsd)
                                  : "—"}
                        </p>
                        <p className="mt-1 text-[9px] tracking-[0.16em] text-[#00ff41]/40">
                            {valuation.value !== undefined ? `${valuation.shortLabel} · ON BAGS` : "PRICE"}
                        </p>
                    </div>
                </div>

                <div className="min-w-0 space-y-0.5">
                    <h3 className="truncate text-xs font-semibold tracking-wide text-[#00ff41] transition-colors group-hover:text-[#8dffb1]">
                        {token.name ?? shortenAddress(token.tokenMint)}
                    </h3>
                    {token.symbol ? (
                        <span className="text-[10px] tracking-wider text-white/40">${token.symbol}</span>
                    ) : null}
                </div>

                {token.description ? (
                    <p className="line-clamp-2 text-[10px] leading-snug tracking-wide text-white/45">
                        {token.description}
                    </p>
                ) : null}

                {token.isMigrated === true ? (
                    <div className="space-y-1">
                        <div className="flex justify-between text-[8px] tracking-[0.14em] text-[#00ff41]/38">
                            <span>POOL</span>
                            <span className="text-[#00ff41]/55">GRADUATED</span>
                        </div>
                        <div className="h-1 overflow-hidden border border-[#00ff41]/20 bg-black/60">
                            <div className="h-full w-full bg-[#00ff41]/75" />
                        </div>
                    </div>
                ) : token.isMigrated === false ? (
                    <div className="space-y-1">
                        <div className="flex justify-between text-[8px] tracking-[0.14em] text-[#ffb800]/45">
                            <span>CURVE</span>
                            <span className="text-[#ffb800]/30">ACTIVE</span>
                        </div>
                        <div className="relative h-1 overflow-hidden border border-[#ffb800]/25 bg-black/60">
                            <div className="bonding-curve-shimmer" />
                        </div>
                    </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                    {hasMarketData ? (
                        <>
                            <div className="border border-[#00ff41]/10 bg-black/40 p-2">
                                <div className="flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3 text-[#00ff41]/30" />
                                    <span className="text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30">
                                        {valuation.shortLabel}
                                    </span>
                                </div>
                                <p className="mt-0.5 text-xs tracking-wider text-[#00ff41]/80">
                                    {formatCurrency(valuation.value)}
                                </p>
                            </div>
                            <div className="border border-[#00ff41]/10 bg-black/40 p-2">
                                <div className="flex items-center gap-1">
                                    <Activity className="h-3 w-3 text-[#00ff41]/30" />
                                    <span className="text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30">
                                        24H VOL
                                    </span>
                                </div>
                                <p className="mt-0.5 text-xs tracking-wider text-[#00ff41]/80">
                                    {formatCurrency(token.volume24hUsd)}
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="border border-[#00ff41]/10 bg-black/40 p-2">
                                <div className="flex items-center gap-1">
                                    <Zap className="h-3 w-3 text-[#00ff41]/30" />
                                    <span className="text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30">
                                        STATUS
                                    </span>
                                </div>
                                <p className="mt-0.5 text-[10px] tracking-wider text-[#00ff41]/50">
                                    {isMigrated ? "MIGRATED" : "BONDING CURVE"}
                                </p>
                            </div>
                            <div className="border border-[#00ff41]/10 bg-black/40 p-2">
                                <div className="flex items-center gap-1">
                                    <ArrowRightLeft className="h-3 w-3 text-[#00ff41]/30" />
                                    <span className="text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30">
                                        PHASE
                                    </span>
                                </div>
                                <p className="mt-0.5 text-[10px] tracking-wider text-[#00ff41]/50">
                                    {isMigrated ? "DEX LIVE" : "EARLY STAGE"}
                                </p>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-2 border-t border-[#00ff41]/10 pt-2">
                    <div className="relative h-7 w-7 flex-shrink-0 overflow-hidden border border-[#00ff41]/20">
                        <RemoteFillImage
                            src={token.creatorPfp}
                            alt=""
                            sizes="28px"
                            className="object-cover"
                            fallback={
                                <div className="absolute inset-0 flex items-center justify-center bg-[#00ff41]/5 text-[10px] text-[#00ff41]/35">
                                    C
                                </div>
                            }
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            {creatorLabel ? (
                                <span className="truncate text-[10px] tracking-wide text-[#00ff41]/55">
                                    {creatorLabel}
                                </span>
                            ) : null}
                            {token.creatorWallet ? (
                                <span className="text-[9px] tracking-wider text-white/30">
                                    {shortenAddress(token.creatorWallet)}
                                </span>
                            ) : null}
                            <ExploreFeedContextRow token={token} lane={exploreLane} />
                        </div>
                        <ProviderBadge provider={token.provider} className="mt-0.5 scale-90 origin-left" />
                    </div>
                    {token.txCount24h !== undefined && token.txCount24h > 0 ? (
                        <span className="inline-flex flex-shrink-0 items-center gap-1 text-[9px] tracking-wider text-[#00ff41]/30">
                            <ArrowUpDown className="h-2.5 w-2.5" />
                            {formatNumber(token.txCount24h)}
                        </span>
                    ) : null}
                </div>

                <div className="text-[8px] tracking-wider text-[#00ff41]/15">{shortenAddress(token.tokenMint)}</div>
            </div>
            </Link>
            {onToggleWatchlist ? (
                <button
                    type="button"
                    className="absolute left-2 top-2 z-20 border border-[#00ff41]/25 bg-black/65 p-1.5 text-[#00ff41]/55 transition-colors hover:border-[#00ff41]/45 hover:text-[#00ff41]"
                    onClick={(e) => {
                        e.preventDefault();
                        onToggleWatchlist(e);
                    }}
                    aria-label={watchlisted ? "Remove from watchlist" : "Add to watchlist"}
                >
                    <Star className={cn("h-3.5 w-3.5", watchlisted && "fill-[#00ff41] text-[#00ff41]")} />
                </button>
            ) : null}
        </div>
    );
}

function NewLaunchTokenCard({
    token,
    index = 0,
    surfaceVariant = "default",
}: Omit<TokenCardProps, "isNewLaunch"> & { token: NormalizedToken }) {
    const changePositive = (token.priceChange24h ?? 0) >= 0;
    const valuation = getValuationMetric(token);
    const hasMarketData = !!(token.priceUsd || valuation.value || token.volume24hUsd);
    const isMigrated = !!token.isMigrated;
    const isNew = !hasMarketData;
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

            {isNew && (
                <div className="pointer-events-none absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#ffb800]/[0.03] via-transparent to-transparent" />
                </div>
            )}

            <div className="relative z-[1] flex items-start gap-3">
                <div
                    className={cn(
                        "relative h-10 w-10 flex-shrink-0 overflow-hidden border transition-all",
                        useLaunchPalette
                            ? "border-[#ffb800]/25 group-hover:border-[#ffb800]/50"
                            : "border-[#00ff41]/20 group-hover:border-[#00ff41]/40"
                    )}
                >
                    <RemoteFillImage
                        src={token.image}
                        alt={token.name ?? "Token"}
                        sizes="40px"
                        className="object-cover"
                        fallback={
                            <div
                                className={cn(
                                    "absolute inset-0 flex items-center justify-center text-sm",
                                    useLaunchPalette ? "bg-[#ffb800]/5 text-[#ffb800]/40" : "bg-[#00ff41]/5 text-[#00ff41]/40"
                                )}
                            >
                                {token.symbol?.charAt(0) ?? "?"}
                            </div>
                        }
                    />
                    {isNew && (
                        <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5">
                            <span className="absolute inset-0 animate-ping rounded-full bg-[#ffb800] opacity-40" />
                            <span
                                className="relative block h-2.5 w-2.5 rounded-full bg-[#ffb800]"
                                style={{ boxShadow: "0 0 4px #ffb800" }}
                            />
                        </div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h3
                            className={cn(
                                "truncate text-xs tracking-wider transition-colors",
                                useLaunchPalette
                                    ? "text-[#ffb800] group-hover:text-[#ffcf63]"
                                    : "text-[#00ff41] group-hover:text-[#8dffb1]"
                            )}
                            style={{
                                textShadow: useLaunchPalette ? "0 0 6px rgba(255,184,0,0.3)" : "0 0 6px rgba(0,255,65,0.3)",
                            }}
                        >
                            {token.name ?? shortenAddress(token.tokenMint)}
                        </h3>
                        {token.symbol && (
                            <span
                                className={cn(
                                    "border px-1.5 py-0.5 text-[9px] tracking-wider",
                                    useLaunchPalette
                                        ? "border-[#ffb800]/14 bg-[#ffb800]/[0.04] text-[#ffb800]/40"
                                        : "border-[#00ff41]/12 bg-[#00ff41]/[0.03] text-[#00ff41]/35"
                                )}
                            >
                                ${token.symbol}
                            </span>
                        )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                        {token.description ? (
                            <span
                                className={cn(
                                    "line-clamp-1 text-[9px] tracking-wide",
                                    useLaunchPalette ? "text-[#ffb800]/40" : "text-[#00ff41]/35"
                                )}
                            >
                                {token.description}
                            </span>
                        ) : token.creatorDisplay ? (
                            <span
                                className={cn(
                                    "truncate text-[10px] tracking-wider",
                                    useLaunchPalette ? "text-[#ffb800]/28" : "text-[#00ff41]/30"
                                )}
                            >
                                {token.creatorDisplay}
                            </span>
                        ) : null}
                        <ProviderBadge provider={token.provider} className="origin-left scale-90" />
                    </div>
                </div>
                {token.priceChange24h !== undefined ? (
                    <div
                        className={`flex-shrink-0 border px-1.5 py-0.5 text-[10px] tracking-wider ${
                            changePositive
                                ? "border-[#00ff41]/30 bg-[#00ff41]/5 text-[#00ff41]"
                                : "border-[#ff4400]/30 bg-[#ff4400]/5 text-[#ff4400]"
                        }`}
                    >
                        {changePositive ? "+" : ""}
                        {token.priceChange24h.toFixed(1)}%
                    </div>
                ) : isNew ? (
                    <div className="new-badge-animated flex flex-shrink-0 items-center gap-1 border border-[#ffb800]/30 bg-[#ffb800]/5 px-1.5 py-0.5 text-[10px] tracking-wider text-[#ffb800]">
                        <Radio className="h-2.5 w-2.5" />
                        LIVE
                    </div>
                ) : !hasMarketData ? (
                    <div className="flex-shrink-0 animate-pulse border border-[#ffb800]/30 bg-[#ffb800]/5 px-1.5 py-0.5 text-[10px] tracking-wider text-[#ffb800]">
                        NEW
                    </div>
                ) : null}
            </div>

            {token.isMigrated === true ? (
                <div className="relative z-[1] mt-3 space-y-1">
                    <div className="flex justify-between text-[8px] tracking-[0.14em] text-[#00ff41]/38">
                        <span>POOL</span>
                        <span className="text-[#00ff41]/55">GRADUATED</span>
                    </div>
                    <div className="h-1 overflow-hidden border border-[#00ff41]/20 bg-black/60">
                        <div className="h-full w-full bg-[#00ff41]/75" />
                    </div>
                </div>
            ) : token.isMigrated === false ? (
                <div className="relative z-[1] mt-3 space-y-1">
                    <div className="flex justify-between text-[8px] tracking-[0.14em] text-[#ffb800]/45">
                        <span>CURVE</span>
                        <span className="text-[#ffb800]/30">ACTIVE</span>
                    </div>
                    <div className="relative h-1 overflow-hidden border border-[#ffb800]/25 bg-black/60">
                        <div className="bonding-curve-shimmer" />
                    </div>
                </div>
            ) : null}

            <div className="relative z-[1] mt-4 grid grid-cols-2 gap-2">
                {hasMarketData ? (
                    <>
                        <div
                            className={cn(
                                "border bg-black/40 p-2",
                                useLaunchPalette ? "border-[#ffb800]/10" : "border-[#00ff41]/10"
                            )}
                        >
                            <div className="flex items-center gap-1">
                                <TrendingUp
                                    className={cn(
                                        "h-3 w-3",
                                        useLaunchPalette ? "text-[#ffb800]/35" : "text-[#00ff41]/30"
                                    )}
                                />
                                <span
                                    className={cn(
                                        "text-[9px] uppercase tracking-[0.15em]",
                                        useLaunchPalette ? "text-[#ffb800]/35" : "text-[#00ff41]/30"
                                    )}
                                >
                                    {valuation.shortLabel}
                                </span>
                            </div>
                            <p
                                className={cn(
                                    "mt-0.5 text-xs tracking-wider",
                                    useLaunchPalette ? "text-[#fff0bd]/80" : "text-[#00ff41]/80"
                                )}
                            >
                                {formatCurrency(valuation.value)}
                            </p>
                        </div>
                        <div
                            className={cn(
                                "border bg-black/40 p-2",
                                useLaunchPalette ? "border-[#ffb800]/10" : "border-[#00ff41]/10"
                            )}
                        >
                            <div className="flex items-center gap-1">
                                <Activity
                                    className={cn(
                                        "h-3 w-3",
                                        useLaunchPalette ? "text-[#ffb800]/35" : "text-[#00ff41]/30"
                                    )}
                                />
                                <span
                                    className={cn(
                                        "text-[9px] uppercase tracking-[0.15em]",
                                        useLaunchPalette ? "text-[#ffb800]/35" : "text-[#00ff41]/30"
                                    )}
                                >
                                    24H VOL
                                </span>
                            </div>
                            <p
                                className={cn(
                                    "mt-0.5 text-xs tracking-wider",
                                    useLaunchPalette ? "text-[#fff0bd]/80" : "text-[#00ff41]/80"
                                )}
                            >
                                {formatCurrency(token.volume24hUsd)}
                            </p>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="border border-[#ffb800]/10 bg-black/40 p-2">
                            <div className="flex items-center gap-1">
                                <Zap className="h-3 w-3 text-[#ffb800]/40" />
                                <span className="text-[9px] uppercase tracking-[0.15em] text-[#ffb800]/40">STATUS</span>
                            </div>
                            <p className="mt-0.5 text-[10px] tracking-wider text-[#ffb800]/60">
                                {isMigrated ? "MIGRATED" : "BONDING CURVE"}
                            </p>
                        </div>
                        <div className="border border-[#ffb800]/10 bg-black/40 p-2">
                            <div className="flex items-center gap-1">
                                <ArrowRightLeft className="h-3 w-3 text-[#ffb800]/40" />
                                <span className="text-[9px] uppercase tracking-[0.15em] text-[#ffb800]/40">PHASE</span>
                            </div>
                            <p className="mt-0.5 text-[10px] tracking-wider text-[#ffb800]/60">
                                {isMigrated ? "DEX LIVE" : "EARLY STAGE"}
                            </p>
                        </div>
                    </>
                )}
            </div>

            <div
                className={cn(
                    "relative z-[1] mt-3 flex items-center justify-between",
                    isPremium ? "border-t pt-3" : "",
                    useLaunchPalette ? "border-[#ffb800]/10" : "border-[#00ff41]/10"
                )}
            >
                <span
                    className={cn(
                        "text-[9px] tracking-wider",
                        useLaunchPalette ? "text-[#ffb800]/18" : "text-[#00ff41]/15"
                    )}
                >
                    {shortenAddress(token.tokenMint)}
                </span>
                <div className="flex items-center gap-2">
                    {launchTime && (
                        <span className="inline-flex items-center gap-1 text-[9px] tracking-wider text-[#ffb800]/40">
                            <Clock className="h-2.5 w-2.5" />
                            {launchTime}
                        </span>
                    )}
                    {token.txCount24h !== undefined && token.txCount24h > 0 ? (
                        <span
                            className={cn(
                                "inline-flex items-center gap-1 text-[9px] tracking-wider",
                                useLaunchPalette ? "text-[#ffb800]/35" : "text-[#00ff41]/25"
                            )}
                        >
                            <ArrowUpDown className="h-2.5 w-2.5" />
                            {formatNumber(token.txCount24h)} TXS
                        </span>
                    ) : token.priceUsd ? (
                        <span
                            className={cn(
                                "text-[9px] tracking-wider",
                                useLaunchPalette ? "text-[#ffb800]/35" : "text-[#00ff41]/25"
                            )}
                        >
                            {formatTokenPrice(token.priceUsd)}
                        </span>
                    ) : isNew && !launchTime ? (
                        <span className="text-[8px] tracking-[0.15em] text-[#ffb800]/20">JUST LAUNCHED</span>
                    ) : null}
                </div>
            </div>
        </Link>
    );
}
