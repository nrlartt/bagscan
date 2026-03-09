"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Loader2, Radio } from "lucide-react";
import type { NormalizedToken } from "@/lib/bags/types";
import { formatCurrency, shortenAddress } from "@/lib/utils";

interface NewLaunchesResponse {
    success: boolean;
    data: NormalizedToken[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
        tab: string;
    };
}

function timeAgo(dateStr?: string): string | null {
    if (!dateStr) return null;
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (diffMs < 0) return null;

    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export function RecentBagscanLaunches() {
    const { data, isLoading, isError, refetch, isFetching } = useQuery<NewLaunchesResponse>({
        queryKey: ["launch-recent-bagscan"],
        queryFn: async () => {
            const res = await fetch("/api/tokens?tab=new&pageSize=8", { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "API error");
            return json;
        },
        refetchInterval: 20_000,
        staleTime: 10_000,
        retry: 2,
    });

    const tokens = data?.data ?? [];

    return (
        <section className="mt-10 space-y-3">
            <div className="panel-header">RECENT BAGSCAN DEPLOYS</div>
            <div className="p-3 border border-[#ffb800]/15 bg-[#ffb800]/[0.02] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Radio className="w-4 h-4 text-[#ffb800]" />
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#ffb800] animate-ping opacity-50" />
                    </div>
                    <span className="text-[10px] text-[#ffb800]/80 tracking-[0.15em]">
                        TOKENS DEPLOYED ON BAGSCAN
                    </span>
                </div>
                <span className="text-[8px] text-[#ffb800]/30 tracking-wider">
                    {isFetching ? "REFRESHING..." : "AUTO-REFRESH 20s"}
                </span>
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-3 border border-[#00ff41]/10 bg-black/60 p-3 animate-pulse"
                        >
                            <div className="w-9 h-9 border border-[#00ff41]/10 bg-[#00ff41]/[0.03]" />
                            <div className="flex-1 space-y-1">
                                <div className="h-2.5 w-28 bg-[#00ff41]/[0.06]" />
                                <div className="h-2 w-20 bg-[#00ff41]/[0.04]" />
                            </div>
                            <div className="h-2.5 w-16 bg-[#00ff41]/[0.05]" />
                        </div>
                    ))}
                </div>
            ) : isError ? (
                <div className="border border-[#ff4400]/20 bg-[#ff4400]/5 p-4 text-center">
                    <p className="text-[10px] text-[#ff4400]/70 tracking-wider">
                        BAGSCAN DEPLOYS COULD NOT BE LOADED
                    </p>
                    <button
                        onClick={() => refetch()}
                        className="mt-3 px-4 py-1.5 border border-[#00ff41]/20 text-[10px] text-[#00ff41]/50 hover:text-[#00ff41]/80 transition-colors tracking-wider"
                    >
                        RETRY
                    </button>
                </div>
            ) : tokens.length === 0 ? (
                <div className="border border-[#00ff41]/10 bg-black/60 p-4 text-center">
                    <p className="text-[10px] text-[#00ff41]/35 tracking-wider">
                        NO DEPLOYED TOKENS FOUND YET
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {tokens.slice(0, 6).map((token) => {
                        const launchedAgo = timeAgo(token.pairCreatedAt);
                        const change = token.priceChange24h;
                        const isPositive = (change ?? 0) >= 0;

                        return (
                            <Link
                                key={token.tokenMint}
                                href={`/token/${token.tokenMint}`}
                                className="group flex items-center gap-3 border border-[#00ff41]/10 bg-black/60 p-3 hover:border-[#00ff41]/35 hover:bg-[#00ff41]/[0.02] transition-all"
                            >
                                <div className="relative w-9 h-9 overflow-hidden flex-shrink-0 border border-[#00ff41]/15">
                                    {token.image ? (
                                        <Image
                                            src={token.image}
                                            alt={token.name ?? token.symbol ?? "Token"}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[#00ff41]/35 text-xs bg-[#00ff41]/5">
                                            {token.symbol?.charAt(0) ?? "?"}
                                        </div>
                                    )}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs text-[#00ff41]/85 tracking-wider truncate group-hover:text-[#00ff41] transition-colors">
                                            {token.name ?? shortenAddress(token.tokenMint)}
                                        </p>
                                        {token.symbol && (
                                            <span className="text-[9px] text-[#00ff41]/30 tracking-wider">
                                                ${token.symbol}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[9px] text-[#00ff41]/25 tracking-wider">
                                        <span>{shortenAddress(token.tokenMint)}</span>
                                        {launchedAgo && <span>- {launchedAgo}</span>}
                                    </div>
                                </div>

                                <div className="hidden sm:block text-right">
                                    <p className="text-[10px] text-[#00ff41]/55 tracking-wider">
                                        FDV {formatCurrency(token.marketCap ?? token.fdvUsd)}
                                    </p>
                                    <p className="text-[9px] text-[#00ff41]/30 tracking-wider">
                                        24H VOL {formatCurrency(token.volume24hUsd)}
                                    </p>
                                </div>

                                {change !== undefined && (
                                    <span className={`text-[10px] tracking-wider ${isPositive ? "text-[#00ff41]" : "text-[#ff4400]"}`}>
                                        {isPositive ? "+" : ""}
                                        {change.toFixed(1)}%
                                    </span>
                                )}

                                <ExternalLink className="w-3.5 h-3.5 text-[#00ff41]/20 group-hover:text-[#00ff41]/60 transition-colors" />
                            </Link>
                        );
                    })}
                </div>
            )}
            {isFetching && !isLoading && (
                <div className="flex items-center justify-center gap-1.5 text-[8px] text-[#00ff41]/20 tracking-wider">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    SYNCING DEPLOYS
                </div>
            )}
        </section>
    );
}
