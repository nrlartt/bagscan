"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { cn, formatCurrency, shortenAddress, getValuationMetric } from "@/lib/utils";
import type { NormalizedToken } from "@/lib/bags/types";
import { RemoteFillImage, REMOTE_IMAGE_SIZES_GRID } from "./RemoteFillImage";

function timeAgoHeroStrip(dateStr?: string): string | null {
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

function StripRow({ rank, token }: { rank: number; token: NormalizedToken }) {
    const mcap = token.marketCap ?? token.fdvUsd;
    const ch = token.priceChange24h;
    const up = (ch ?? 0) >= 0;
    return (
        <Link
            href={`/token/${token.tokenMint}`}
            className={cn(
                "group flex min-w-[200px] shrink-0 items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0a0a0c] px-3 py-2.5",
                "transition-all duration-200 hover:border-[#ff6b9d]/35 hover:bg-[#121214] hover:shadow-[0_0_20px_rgba(255,107,157,0.06)]"
            )}
        >
            <span className="min-w-[1.25rem] text-center text-sm font-bold tabular-nums text-white/50 transition-colors group-hover:text-[#ff6b9d]">
                {rank}
            </span>
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-white/[0.06] bg-black ring-1 ring-white/[0.04]">
                <RemoteFillImage
                    src={token.image}
                    alt=""
                    sizes="40px"
                    className="object-cover"
                    fallback={
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white/25">
                            {token.symbol?.charAt(0) ?? "?"}
                        </span>
                    }
                />
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold tracking-wide text-white/90">
                    {token.symbol ? `$${token.symbol}` : shortenAddress(token.tokenMint)}
                </p>
                {mcap != null && mcap > 0 ? (
                    <p className="truncate text-[10px] tracking-wide text-white/40">{formatCurrency(mcap)} MC</p>
                ) : (
                    <p className="text-[10px] text-white/30">—</p>
                )}
            </div>
            {ch != null && Number.isFinite(ch) ? (
                <span
                    className={cn(
                        "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                        up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                    )}
                >
                    {up ? "+" : ""}
                    {ch.toFixed(1)}%
                </span>
            ) : (
                <span className="shrink-0 text-[10px] text-white/25">—</span>
            )}
        </Link>
    );
}

/** Horizontal rank rail: numbered row, round avatars, MC + change badge. */
export function ExploreCharityStrip({
    tokens,
    fallbackLabel,
}: {
    tokens: NormalizedToken[];
    fallbackLabel?: boolean;
}) {
    if (tokens.length === 0) return null;

    return (
        <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 mb-5">
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-[#121214]/95 to-[#0a0a0c] shadow-[0_8px_40px_rgba(0,0,0,0.5)] backdrop-blur-md supports-[backdrop-filter]:bg-[#121214]/90">
                <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
                    <Heart className="h-4 w-4 shrink-0 fill-[#ff6b9d]/30 text-[#ff6b9d]" />
                    <span className="text-sm font-medium tracking-tight text-white/85">
                        {fallbackLabel ? "Top movers" : "Charity coins"}
                    </span>
                    <span className="ml-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] tracking-wide text-white/40">
                        Bags
                    </span>
                </div>
                <div className="flex gap-3 overflow-x-auto overscroll-x-contain px-3 py-3 [-webkit-overflow-scrolling:touch] scrollbar-thin [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
                    {tokens.slice(0, 12).map((t, i) => (
                        <StripRow key={t.tokenMint} rank={i + 1} token={t} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function FeaturedLaunchCard({
    token,
    rank,
    secondaryBadge = "NEW",
}: {
    token: NormalizedToken;
    rank: number;
    secondaryBadge?: string;
}) {
    const valuation = getValuationMetric(token);
    const age = timeAgoHeroStrip(token.pairCreatedAt);
    const mcap = token.marketCap ?? token.fdvUsd;
    const ch = token.priceChange24h;
    const up = (ch ?? 0) >= 0;

    return (
        <Link
            href={`/token/${token.tokenMint}`}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a0c] transition-all duration-300 hover:border-[#00ff41]/35 hover:shadow-[0_0_28px_rgba(0,255,65,0.07)]"
        >
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-black">
                <RemoteFillImage
                    src={token.image}
                    alt={token.name ?? ""}
                    sizes={REMOTE_IMAGE_SIZES_GRID}
                    priority={rank <= 4}
                    className="object-cover transition duration-500 group-hover:scale-[1.04]"
                    fallback={
                        <div className="absolute inset-0 flex items-center justify-center text-3xl text-[#00ff41]/15">
                            {token.symbol?.charAt(0) ?? "?"}
                        </div>
                    }
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                {(valuation.value ?? mcap) != null && (valuation.value ?? mcap)! > 0 ? (
                    <span className="pointer-events-none absolute bottom-2 left-2 z-[2] max-w-[min(100%,12rem)] truncate rounded-md border border-white/12 bg-black/70 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/92 backdrop-blur-md">
                        {formatCurrency((valuation.value ?? mcap)!)}{" "}
                        <span className="text-[8px] font-normal tracking-wide text-white/45">MC</span>
                    </span>
                ) : null}

                <div className="absolute left-2 top-2 flex items-center gap-1.5">
                    <span className="border border-[#00ff41]/40 bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-[#00ff41]">
                        #{rank}
                    </span>
                    <span className="border border-white/15 bg-black/60 px-1.5 py-0.5 text-[8px] tracking-[0.15em] text-white/70">
                        {secondaryBadge}
                    </span>
                </div>

                {ch != null && Number.isFinite(ch) ? (
                    <span
                        className={cn(
                            "absolute right-2 top-2 border px-1.5 py-0.5 text-[9px] font-medium tracking-wide backdrop-blur-sm",
                            up
                                ? "border-[#00ff41]/35 bg-black/55 text-[#00ff41]"
                                : "border-[#ff4400]/35 bg-black/55 text-[#ff4400]"
                        )}
                    >
                        {up ? "+" : ""}
                        {ch.toFixed(1)}%
                    </span>
                ) : null}

                {token.isMigrated ? (
                    <span className="absolute bottom-14 right-2 border border-[#00ff41]/30 bg-black/65 px-1.5 py-0.5 text-[8px] tracking-wider text-[#00ff41]/85">
                        GRADUATED
                    </span>
                ) : null}
            </div>

            <div className="flex flex-1 flex-col gap-1.5 p-3 pt-2">
                <div>
                    <h3 className="truncate text-sm font-semibold tracking-tight text-white/95 group-hover:text-[#8dffb1]">
                        {token.name ?? shortenAddress(token.tokenMint)}
                    </h3>
                    {token.symbol ? (
                        <p className="truncate text-[10px] tracking-widest text-[#00ff41]/50">${token.symbol}</p>
                    ) : null}
                </div>

                <div className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-1 border-t border-[#00ff41]/10 pt-2">
                    <div>
                        <p className="text-[8px] tracking-[0.18em] text-[#00ff41]/35">
                            {valuation.value !== undefined ? valuation.shortLabel : "MCAP"}
                        </p>
                        <p className="text-xs font-medium tracking-wide text-[#00ff41]">
                            {valuation.value !== undefined
                                ? formatCurrency(valuation.value)
                                : mcap != null && mcap > 0
                                  ? formatCurrency(mcap)
                                  : "—"}
                        </p>
                    </div>
                    {age ? (
                        <span className="text-[9px] tabular-nums tracking-wider text-white/40">{age}</span>
                    ) : null}
                </div>
            </div>
        </Link>
    );
}

/** Hero grid: caller supplies tokens in Dex trending order (first N). */
export function FeaturedLaunchesGrid({ tokens }: { tokens: NormalizedToken[] }) {
    const picks = tokens.slice(0, 4);
    if (picks.length === 0) return null;

    return (
        <section className="mb-6 animate-fade-in" aria-label="Trending on Bags">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-0.5">
                <div>
                    <h2 className="text-sm font-medium tracking-tight text-white/80">
                        Trending on Bags
                    </h2>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-3 lg:grid-cols-4">
                {picks.map((t, i) => (
                    <FeaturedLaunchCard key={t.tokenMint} token={t} rank={i + 1} secondaryBadge="TREND" />
                ))}
            </div>
        </section>
    );
}
