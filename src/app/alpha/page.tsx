"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import {
    Zap, Flame, AlertTriangle, Shield, ExternalLink,
    RefreshCw, Wifi, WifiOff, Eye, ChevronRight, Activity, Loader2,
    Radio, Cpu,
} from "lucide-react";
import type { AlphaFeedResponse, AlphaToken, AlphaSignal, AlphaSignalSeverity, RadarTrend } from "@/lib/alpha/types";

const SCAN_MINT = "BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS";
const SCAN_BAGS_URL = `https://bags.fm/${SCAN_MINT}`;
const SCAN_JUP_URL = `https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${SCAN_MINT}`;
const BREAKING_WINDOW_MS = 2 * 60 * 60 * 1000;
const EMPTY_TOKENS: AlphaToken[] = [];
const EMPTY_TRENDS: RadarTrend[] = [];

type QuickFilter = "all" | "rug-check" | "momentum" | "new-launches" | "last-minute";

interface AlphaAccessCheck {
    eligible: boolean;
    balanceUi: string;
    requiredUi: string;
    mint: string;
}

export default function AlphaPage() {
    const { connected, publicKey } = useWallet();
    const { setVisible } = useWalletModal();

    const {
        data: accessData,
        isLoading: isAccessLoading,
        isFetching: isAccessFetching,
        error: accessError,
        refetch: refetchAccess,
    } = useQuery<AlphaAccessCheck>({
        queryKey: ["alpha-access", publicKey?.toBase58()],
        enabled: connected && !!publicKey,
        staleTime: 30_000,
        refetchInterval: 60_000,
        retry: 1,
        queryFn: async () => {
            if (!publicKey) throw new Error("Wallet not connected");

            const wallet = publicKey.toBase58();
            const res = await fetch(
                `/api/alpha/access?wallet=${encodeURIComponent(wallet)}`,
                { cache: "no-store" }
            );
            const payload = await res.json().catch(() => null);

            if (!res.ok || !payload?.success || !payload?.data) {
                throw new Error(payload?.error ?? "Failed to verify SCAN balance");
            }

            return payload.data as AlphaAccessCheck;
        },
    });

    const hasAccess = connected && !!accessData?.eligible;
    const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

    const { data, isLoading, error, refetch, isFetching } = useQuery<AlphaFeedResponse>({
        queryKey: ["alpha-feed"],
        queryFn: async () => {
            const res = await fetch("/api/alpha");
            if (!res.ok) throw new Error("Failed to fetch alpha feed");
            return res.json();
        },
        refetchInterval: 90_000,
        enabled: hasAccess,
    });

    const tokens = data?.tokens ?? EMPTY_TOKENS;
    const totalSignals = data?.totalSignals ?? 0;
    const xquikEnabled = data?.xquikEnabled ?? false;
    const radarTrends = data?.radarTrends ?? EMPTY_TRENDS;
    const filteredTokens = useMemo(
        () => applyQuickFilter(tokens, quickFilter),
        [tokens, quickFilter]
    );
    const breakingTrends = useMemo(
        () => getBreakingTrends(radarTrends),
        [radarTrends]
    );
    const trendingTokens = useMemo(
        () =>
            [...tokens]
                .filter((token) => token.isTrendingNow)
                .sort((a, b) => {
                    const trendingDiff = (b.trendingNowScore ?? 0) - (a.trendingNowScore ?? 0);
                    if (trendingDiff !== 0) return trendingDiff;
                    return b.alphaScore - a.alphaScore;
                })
                .slice(0, 6),
        [tokens]
    );

    const criticalTokens = filteredTokens.filter((t) => t.alphaScore >= 60);
    const hotTokens = filteredTokens.filter((t) => t.alphaScore >= 30 && t.alphaScore < 60);
    const watchTokens = filteredTokens.filter((t) => t.alphaScore > 0 && t.alphaScore < 30);

    if (!connected) {
        return (
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
                <div className="crt-panel p-10 text-center">
                    <Shield className="w-12 h-12 text-[#ffaa00] mx-auto mb-5" />
                    <h1 className="text-2xl sm:text-3xl text-[#ffaa00] tracking-[0.12em]">ALPHA ACCESS RESTRICTED</h1>
                    <p className="text-sm sm:text-base text-[#00ff41]/60 tracking-wider mt-4 max-w-2xl mx-auto">
                        THE ALPHA PAGE IS AVAILABLE ONLY TO WALLETS HOLDING AT LEAST 2,000,000 SCAN TOKENS.
                    </p>
                    <AccessLinks />
                    <button
                        onClick={() => setVisible(true)}
                        className="mt-6 px-7 py-3 border-2 border-[#00ff41]/50 bg-[#00ff41]/10 text-[#00ff41] text-sm tracking-wider hover:bg-[#00ff41]/20 transition-all"
                    >
                        CONNECT WALLET
                    </button>
                </div>
            </div>
        );
    }

    if (isAccessLoading || isAccessFetching) {
        return (
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
                <div className="crt-panel p-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[#00ff41]/50 mx-auto mb-3" />
                    <p className="text-[10px] text-[#00ff41]/40 tracking-wider">SCAN BALANCE CHECK IN PROGRESS...</p>
                </div>
            </div>
        );
    }

    if (accessError) {
        return (
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
                <div className="crt-panel crt-panel-red p-8 text-center">
                    <AlertTriangle className="w-10 h-10 text-[#ff4400] mx-auto mb-3" />
                    <p className="text-sm text-[#ff4400] tracking-wider">ACCESS CHECK FAILED</p>
                    <p className="text-[10px] text-[#ff4400]/40 mt-2 tracking-wider">{String(accessError)}</p>
                    <button
                        onClick={() => refetchAccess()}
                        className="mt-4 px-4 py-2 border border-[#ff4400]/50 text-[#ff4400] text-xs tracking-wider hover:bg-[#ff4400]/10 transition-colors"
                    >
                        RETRY
                    </button>
                </div>
            </div>
        );
    }

    if (!accessData?.eligible) {
        return (
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
                <div className="crt-panel p-10 text-center">
                    <Shield className="w-12 h-12 text-[#ffaa00] mx-auto mb-4" />
                    <h1 className="text-2xl sm:text-3xl text-[#ffaa00] tracking-[0.12em]">INSUFFICIENT SCAN BALANCE</h1>
                    <p className="text-sm sm:text-base text-[#00ff41]/60 tracking-wider mt-4">
                        REQUIRED: {accessData?.requiredUi ?? "2,000,000"} SCAN
                    </p>
                    <p className="text-sm sm:text-base text-[#00ff41]/60 tracking-wider mt-2">
                        CURRENT WALLET BALANCE: {accessData?.balanceUi ?? "0"} SCAN
                    </p>
                    <AccessLinks mint={accessData?.mint} />
                    <button
                        onClick={() => refetchAccess()}
                        className="mt-6 px-6 py-2.5 border border-[#00ff41]/30 text-[#00ff41]/70 text-sm tracking-wider hover:bg-[#00ff41]/10 transition-colors"
                    >
                        REFRESH BALANCE
                    </button>
                </div>
            </div>
        );
    }

    const lastUpdatedLabel = data?.lastUpdated ? formatTimeAgo(data.lastUpdated) : "SYNCING";

    return (
        <div className="alpha-premium-shell mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
            {/* â•”â•â• HEADER â•â•â•— */}
                        <section className="alpha-hero-panel mb-6 animate-fade-in">
                <div className="relative z-[1] grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.95fr)] xl:items-end">
                    <div className="space-y-5">
                        <div className="flex flex-wrap items-start gap-4">
                            <div className="alpha-hero-mark">
                                <Zap className="h-7 w-7 text-[#ffaa00]" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="alpha-kicker">Private Flow Intelligence</p>
                                <h1 className="alpha-hero-title">BAGS ALPHA TERMINAL</h1>
                                <p className="max-w-3xl text-sm leading-7 text-[#d8ffe6]/72 sm:text-[15px]">
                                    Premium discovery surface for live Bags momentum, rug pressure, creator traction, and
                                    high-conviction trend rotations. Built to read cleanly at high resolution without losing signal density.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2.5">
                            <div className="alpha-inline-chip border-[#ffaa00]/25 bg-[#ffaa00]/10 text-[#ffd37a]">
                                <span className="status-dot status-dot-amber" />
                                LIVE SIGNALS {totalSignals}
                            </div>
                            <div className="alpha-inline-chip border-[#00ff41]/20 bg-[#00ff41]/10 text-[#9dffb8]">
                                <span className="status-dot status-dot-green" />
                                TOKENS TRACKED {tokens.length}
                            </div>
                            <div
                                className={cn(
                                    "alpha-inline-chip",
                                    xquikEnabled
                                        ? "border-[#00aaff]/20 bg-[#00aaff]/10 text-[#8dd8ff]"
                                        : "border-[#ffaa00]/20 bg-[#ffaa00]/10 text-[#ffd37a]"
                                )}
                            >
                                {xquikEnabled ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                                {xquikEnabled ? "X SIGNAL GRAPH ONLINE" : "X SIGNAL GRAPH DEGRADED"}
                            </div>
                            <div className="alpha-inline-chip border-white/10 bg-white/[0.03] text-white/60">
                                LAST SCAN {lastUpdatedLabel}
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-2">
                        <div className="alpha-hero-metric">
                            <span className="alpha-hero-metric-label">Trending Pins</span>
                            <span className="alpha-hero-metric-value text-[#ffaa00]">{trendingTokens.length}</span>
                            <span className="alpha-hero-metric-note">Highest live-momentum mints stay pinned above the main feed.</span>
                        </div>
                        <div className="alpha-hero-metric">
                            <span className="alpha-hero-metric-label">Critical Alerts</span>
                            <span className="alpha-hero-metric-value text-[#ff7d50]">{criticalTokens.length}</span>
                            <span className="alpha-hero-metric-note">Aggressive price and flow combinations demanding immediate review.</span>
                        </div>
                        <div className="alpha-hero-metric sm:col-span-3 xl:col-span-2">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <span className="alpha-hero-metric-label">Refresh Stream</span>
                                    <p className="alpha-hero-metric-note mt-1">
                                        Pool motion, discovery source, and creator context stay synced in one premium surface.
                                    </p>
                                </div>
                                <button
                                    onClick={() => refetch()}
                                    disabled={isFetching}
                                    className="inline-flex items-center gap-2 rounded-full border border-[#00ff41]/25 bg-black/35 px-4 py-2 text-[11px] tracking-[0.24em] text-[#9dffb8] transition-all hover:border-[#00ff41]/45 hover:bg-[#00ff41]/10 hover:text-[#d8ffe6] disabled:opacity-50"
                                >
                                    <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                                    REFRESH
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* â•”â•â• SYSTEM STATUS GRID â•â•â•— */}
            {!isLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 stagger-children">
                    <SystemStatusCard label="CRITICAL" value={criticalTokens.length} status="critical" icon={<AlertTriangle className="w-4 h-4" />} />
                    <SystemStatusCard label="HOT SIGNALS" value={hotTokens.length} status="warning" icon={<Flame className="w-4 h-4" />} />
                    <SystemStatusCard label="WATCHLIST" value={watchTokens.length} status="online" icon={<Eye className="w-4 h-4" />} />
                    <SystemStatusCard label="RADAR FEED" value={radarTrends.length} status="info" icon={<Radio className="w-4 h-4" />} />
                </div>
            )}

            {!isLoading && (
                <QuickFilterPanel
                    activeFilter={quickFilter}
                    onChange={setQuickFilter}
                    matchedCount={filteredTokens.length}
                />
            )}

            {!isLoading && breakingTrends.length > 0 && (
                <BreakingRadarPanel trends={breakingTrends} />
            )}

            {!isLoading && trendingTokens.length > 0 && (
                <TrendingBagsPanel tokens={trendingTokens} />
            )}

            {/* Loading state */}
            {isLoading ? (
                <AlphaSkeleton />
            ) : error ? (
                <div className="alpha-section-panel crt-panel crt-panel-red p-12 text-center">
                    <AlertTriangle className="w-10 h-10 text-[#ff4400] mx-auto mb-3" />
                    <p className="text-[#ff4400] tracking-wider text-sm">SYSTEM ERROR :: ALPHA FEED OFFLINE</p>
                    <p className="text-[#ff4400]/40 text-xs mt-2 tracking-wider">{String(error)}</p>
                    <button onClick={() => refetch()} className="mt-4 px-4 py-2 border border-[#ff4400]/50 text-[#ff4400] text-xs tracking-wider hover:bg-[#ff4400]/10 transition-colors">
                        RETRY CONNECTION
                    </button>
                </div>
            ) : tokens.length === 0 ? (
                <div className="alpha-section-panel crt-panel p-12 text-center">
                    <Cpu className="w-10 h-10 text-[#00ff41]/30 mx-auto mb-3" />
                    <p className="text-[#00ff41]/70 tracking-wider text-sm">NO ALPHA SIGNALS DETECTED</p>
                    <p className="text-[#00ff41]/30 text-xs mt-2 tracking-wider">AWAITING MARKET ACTIVITY_</p>
                </div>
            ) : filteredTokens.length === 0 ? (
                <div className="alpha-section-panel crt-panel p-12 text-center">
                    <Activity className="w-10 h-10 text-[#00ff41]/30 mx-auto mb-3" />
                    <p className="text-[#00ff41]/70 tracking-wider text-sm">NO TOKENS MATCH THIS QUICK FILTER</p>
                    <p className="text-[#00ff41]/30 text-xs mt-2 tracking-wider">TRY SWITCHING TO ALL OR MOMENTUM</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {criticalTokens.length > 0 && (
                        <AlphaSection
                            title="â•”â•â• CRITICAL ALPHA â•â•â•—"
                            subtitle="PRIORITY SIGNALS :: IMMEDIATE ATTENTION REQUIRED"
                            panelClass="crt-panel-red"
                            dotClass="status-dot-red"
                            tokens={criticalTokens}
                        />
                    )}

                    {hotTokens.length > 0 && (
                        <AlphaSection
                            title="â•”â•â• HOT SIGNALS â•â•â•—"
                            subtitle="EMERGING ALPHA OPPORTUNITIES"
                            panelClass="crt-panel-amber"
                            dotClass="status-dot-amber"
                            tokens={hotTokens}
                        />
                    )}

                    {watchTokens.length > 0 && (
                        <AlphaSection
                            title="â•”â•â• WATCHLIST â•â•â•—"
                            subtitle="EARLY ACTIVITY INDICATORS"
                            panelClass=""
                            dotClass="status-dot-green"
                            tokens={watchTokens}
                        />
                    )}

                    {radarTrends.length > 0 && (
                        <RadarSection trends={radarTrends} />
                    )}

                    {/* MOTHER terminal */}
                    <div className="crt-panel p-4">
                        <div className="panel-header">â•”â•â• MOTHER COMPUTER INTERFACE â•â•â•—</div>
                        <div className="bg-black p-4 border border-[#00ff41]/10 font-mono text-[11px] leading-relaxed">
                            <p className="text-[#00ff41]/70">READY_</p>
                            <p className="text-[#00ff41]/50 mt-1">&gt; QUERY: ALPHA SCAN STATUS</p>
                            <p className="text-[#00ff41]/70 mt-1">&gt; {filteredTokens.length} TOKENS MATCHING {quickFilter.toUpperCase()} :: {totalSignals} SIGNALS ACTIVE</p>
                            <p className="text-[#ffaa00]/60 mt-1">&gt; {trendingTokens.length} TRENDING BAGS PINNED TO TOP</p>
                            <p className="text-[#00ff41]/70 mt-1">&gt; {criticalTokens.length} CRITICAL ALERTS PENDING REVIEW</p>
                            {!xquikEnabled && (
                                <p className="text-[#ffaa00]/60 mt-1">&gt; WARNING: X/TWITTER FEED DISCONNECTED - SUBSCRIBE AT XQUIK.COM</p>
                            )}
                            <p className="text-[#00ff41]/70 mt-1">&gt; RECOMMEND: MONITOR HIGH-PRIORITY SIGNALS</p>
                            <p className="text-[#00ff41] mt-2 animate-crt-blink">_</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// â”€â”€ SystemStatusCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SystemStatusCard({ label, value, status, icon }: {
    label: string; value: number; status: "online" | "warning" | "critical" | "info"; icon: React.ReactNode;
}) {
    const colors = {
        online: { border: "border-[#00ff41]/18", text: "text-[#9dffb8]", dim: "text-[#84ffad]/55", iconBg: "border-[#00ff41]/20 bg-[#00ff41]/10" },
        warning: { border: "border-[#ffaa00]/18", text: "text-[#ffd37a]", dim: "text-[#ffd37a]/55", iconBg: "border-[#ffaa00]/20 bg-[#ffaa00]/10" },
        critical: { border: "border-[#ff4400]/20", text: "text-[#ff8c64]", dim: "text-[#ff8c64]/55", iconBg: "border-[#ff4400]/20 bg-[#ff4400]/10" },
        info: { border: "border-[#00aaff]/20", text: "text-[#8dd8ff]", dim: "text-[#8dd8ff]/55", iconBg: "border-[#00aaff]/20 bg-[#00aaff]/10" },
    };
    const c = colors[status];

    return (
        <div className={cn("alpha-status-card", c.border)}>
            <div className={cn("inline-flex h-11 w-11 items-center justify-center rounded-2xl border", c.iconBg, c.text)}>
                {icon}
            </div>
            <p className="mt-4 text-[10px] uppercase tracking-[0.32em] text-white/42">{label}</p>
            <p className={cn("mt-2 text-3xl font-semibold tracking-[0.08em]", c.text)} style={{ textShadow: "0 0 14px currentColor" }}>
                {value}
            </p>
            <div className="mt-4 h-px w-full bg-white/8" />
            <p className={cn("mt-3 text-[10px] uppercase tracking-[0.26em]", c.dim)}>
                Live Monitor
            </p>
        </div>
    );
}

// â”€â”€ RadarSection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function QuickFilterPanel({
    activeFilter,
    onChange,
    matchedCount,
}: {
    activeFilter: QuickFilter;
    onChange: (filter: QuickFilter) => void;
    matchedCount: number;
}) {
    const filters: Array<{ key: QuickFilter; label: string }> = [
        { key: "all", label: "ALL" },
        { key: "rug-check", label: "RUG-CHECK" },
        { key: "momentum", label: "MOMENTUM" },
        { key: "new-launches", label: "NEW LAUNCHES" },
        { key: "last-minute", label: "LAST-MINUTE" },
    ];

    return (
        <div className="alpha-section-panel crt-panel mb-6 animate-fade-in p-4">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#00ff41]/12 pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="status-dot status-dot-green" />
                        <p className="text-[11px] uppercase tracking-[0.34em] text-[#d8ffe6]">Quick Filters</p>
                    </div>
                    <p className="mt-2 text-[11px] leading-6 text-white/42">
                        Trim the feed to rug pressure, fresh launches, or last-minute momentum without losing the live signal stack.
                    </p>
                </div>
                <div className="alpha-inline-chip border-[#00ff41]/18 bg-[#00ff41]/10 text-[#9dffb8]">
                    {matchedCount} LIVE MATCHES
                </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2.5">
                {filters.map((filter) => {
                    const active = activeFilter === filter.key;
                    return (
                        <button
                            key={filter.key}
                            onClick={() => onChange(filter.key)}
                            className={cn(
                                "rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.22em] transition-all",
                                active
                                    ? "border-[#00ff41]/40 bg-[#00ff41]/12 text-[#d8ffe6] shadow-[0_0_20px_rgba(0,255,65,0.08)]"
                                    : "border-white/10 bg-black/30 text-white/44 hover:border-[#00ff41]/20 hover:bg-[#00ff41]/8 hover:text-[#b4ffca]"
                            )}
                        >
                            {filter.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
function TrendingBagsPanel({ tokens }: { tokens: AlphaToken[] }) {
    return (
        <div className="alpha-section-panel crt-panel crt-panel-amber mb-6 animate-fade-in p-4">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#ffaa00]/16 pb-4">
                <div>
                    <div className="flex items-center gap-2 text-[#ffd37a]">
                        <span className="status-dot status-dot-amber" />
                        <p className="text-[11px] uppercase tracking-[0.34em]">Trending Bags Now</p>
                    </div>
                    <p className="mt-2 max-w-3xl text-[11px] leading-6 text-[#ffe3ac]/45">
                        Only live-flow mints with real activity, price strength, and crowd traction stay pinned here.
                    </p>
                </div>
                <div className="alpha-inline-chip border-[#ffaa00]/18 bg-[#ffaa00]/10 text-[#ffd37a]">
                    PINNED LIVE {tokens.length}
                </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3 stagger-children">
                {tokens.map((token, index) => (
                    <AlphaCard key={token.tokenMint} token={token} trendingRank={index + 1} />
                ))}
            </div>
        </div>
    );
}
function BreakingRadarPanel({ trends }: { trends: RadarTrend[] }) {
    return (
        <div className="alpha-section-panel crt-panel crt-panel-amber mb-6 animate-fade-in p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4 border-b border-[#ffaa00]/16 pb-4">
                <div>
                    <div className="flex items-center gap-2 text-[#ffd37a]">
                        <span className="status-dot status-dot-amber" />
                        <p className="text-[11px] uppercase tracking-[0.34em]">Breaking Crypto Radar</p>
                    </div>
                    <p className="mt-2 text-[11px] leading-6 text-[#ffe3ac]/45">Macro narratives and external momentum spikes from the last 120 minutes.</p>
                </div>
                <div className="alpha-inline-chip border-[#ffaa00]/18 bg-[#ffaa00]/10 text-[#ffd37a]">
                    LAST 120M
                </div>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 stagger-children">
                {trends.slice(0, 6).map((trend) => (
                    <a
                        key={trend.id}
                        href={trend.url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-[22px] border border-[#ffaa00]/14 bg-black/55 p-4 transition-all hover:border-[#ffaa00]/30 hover:bg-[#ffaa00]/8"
                    >
                        <p className="line-clamp-2 text-[12px] leading-6 tracking-[0.12em] text-[#ffd37a]/85">
                            {trend.title}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-[#ffd37a]/40">
                            <span>{trend.source.replace("_", " ").toUpperCase()}</span>
                            <span>SCORE {trend.score}</span>
                            <span className="ml-auto">{formatTimeAgo(trend.publishedAt)}</span>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}
function RadarSection({ trends }: { trends: RadarTrend[] }) {
    return (
        <div className="alpha-section-panel crt-panel animate-fade-in p-4">
            <div className="mb-4 flex items-center gap-2 border-b border-[#00aaff]/10 pb-4 text-[#8dd8ff]">
                <span className="status-dot status-dot-blue" />
                <div>
                    <p className="text-[11px] uppercase tracking-[0.34em]">External Radar Feed</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#8dd8ff]/35">Supplemental catalyst scan outside core Bags discovery</p>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 stagger-children">
                {trends.slice(0, 12).map((trend) => (
                    <a
                        key={trend.id}
                        href={trend.url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-[22px] border border-[#00aaff]/12 bg-black/45 p-4 transition-all hover:border-[#00aaff]/28 hover:bg-[#00aaff]/7"
                    >
                        <p className="line-clamp-2 text-[12px] leading-6 tracking-[0.12em] text-[#a7e7ff]/80 transition-colors group-hover:text-[#d2f4ff]">
                            {trend.title}
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-[#8dd8ff]/38">
                            <span>{trend.source.replace("_", " ").toUpperCase()}</span>
                            <span>SCORE {trend.score}</span>
                            <ExternalLink className="ml-auto h-3.5 w-3.5 text-[#8dd8ff]/25 transition-colors group-hover:text-[#8dd8ff]/70" />
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}
function AlphaSection({
    title,
    subtitle,
    panelClass,
    dotClass,
    tokens,
}: {
    title: string;
    subtitle: string;
    panelClass: string;
    dotClass: string;
    tokens: AlphaToken[];
}) {
    return (
        <div className={cn("alpha-section-panel crt-panel animate-fade-in p-4", panelClass)}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className={cn("status-dot", dotClass)} />
                        <p className="text-[11px] uppercase tracking-[0.34em] text-[#d8ffe6]">{title}</p>
                    </div>
                    <p className="mt-2 text-[11px] leading-6 text-white/38">{subtitle}</p>
                </div>
                <div className="alpha-inline-chip border-white/10 bg-white/[0.03] text-white/55">
                    {tokens.length} LIVE NAMES
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3 stagger-children">
                {tokens.map((token) => (
                    <AlphaCard key={token.tokenMint} token={token} />
                ))}
            </div>
        </div>
    );
}
function AlphaCard({ token, trendingRank }: { token: AlphaToken; trendingRank?: number }) {
    const scoreColor =
        token.alphaScore >= 60 ? "#ff7d50"
            : token.alphaScore >= 30 ? "#ffaa00"
                : "#00ff41";
    const rugRiskScore = token.rugRiskScore ?? 0;
    const rugRiskLevel = token.rugRiskLevel ?? scoreToRiskLevel(rugRiskScore);
    const rugRiskClass =
        rugRiskLevel === "high"
            ? "border-[#ff4400]/20 bg-[#ff4400]/10 text-[#ff8c64]"
            : rugRiskLevel === "medium"
                ? "border-[#ffaa00]/20 bg-[#ffaa00]/10 text-[#ffd37a]"
                : "border-[#00ff41]/15 bg-[#00ff41]/8 text-[#9dffb8]";
    const showTrendingBadge = Boolean(trendingRank) || token.isTrendingNow;
    const discoveryLabel = getDiscoverySourceLabel(token.discoverySource);
    const creatorHandle = token.creatorDisplay ?? token.twitterUsername;
    const priceText = formatUsdPrice(token.priceUsd);
    const metrics: Array<{ label: string; value: string; tone: string }> = [];

    if (token.volume24hUsd !== undefined) {
        metrics.push({ label: "24H VOL", value: `$${fmtCompact(token.volume24hUsd)}`, tone: "text-[#9dffb8]" });
    }
    if (token.txCount24h !== undefined) {
        metrics.push({ label: "TX COUNT", value: fmtCompact(token.txCount24h), tone: "text-[#ffd37a]" });
    }
    if (token.earnedUsd !== undefined && token.earnedUsd > 0) {
        metrics.push({ label: "FEES", value: `$${fmtCompact(token.earnedUsd)}`, tone: "text-[#ffd37a]" });
    }
    if (token.creatorFollowers !== undefined) {
        metrics.push({ label: "FOLLOWERS", value: fmtCompact(token.creatorFollowers), tone: "text-[#8dd8ff]" });
    }
    if (token.tweetCount !== undefined && token.tweetCount > 0) {
        metrics.push({ label: "POSTS", value: fmtCompact(token.tweetCount), tone: "text-[#8dd8ff]" });
    }

    return (
        <Link href={`/token/${token.tokenMint}`} className="alpha-card-shell group">
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    {showTrendingBadge && (
                        <span className="alpha-badge-chip border-[#ffaa00]/22 bg-[#ffaa00]/10 text-[#ffd37a]">
                            {trendingRank ? `TREND #${trendingRank}` : `TRENDING NOW ${token.trendingNowScore ?? 0}`}
                        </span>
                    )}
                    {rugRiskScore > 0 && (
                        <span className={cn("alpha-badge-chip", rugRiskClass)}>
                            RUG {rugRiskScore}
                        </span>
                    )}
                    {discoveryLabel && (
                        <span className="alpha-badge-chip border-[#00aaff]/18 bg-[#00aaff]/10 text-[#8dd8ff]">
                            {discoveryLabel}
                        </span>
                    )}
                    {token.isTrendingNow && (
                        <span className="alpha-badge-chip border-white/10 bg-white/[0.04] text-white/60">
                            HOT NOW {token.trendingNowScore ?? 0}
                        </span>
                    )}
                </div>

                <div
                    className="alpha-score-chip"
                    style={{
                        borderColor: `${scoreColor}55`,
                        color: scoreColor,
                        boxShadow: `0 0 22px ${scoreColor}18`,
                    }}
                >
                    <Zap className="h-3.5 w-3.5" />
                    <span>{token.alphaScore}</span>
                </div>
            </div>

            <div className="mt-4 flex items-start gap-4">
                <div className="relative h-14 w-14 overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.03] shadow-[0_14px_28px_rgba(0,0,0,0.35)]">
                    {token.image ? (
                        <Image src={token.image} alt={token.symbol ?? ""} fill className="object-cover" unoptimized />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#00ff41]/8 text-lg text-[#00ff41]/45">
                            {token.symbol?.charAt(0) ?? "?"}
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-lg font-semibold uppercase tracking-[0.14em] text-[#d8ffe6] transition-colors group-hover:text-white">
                            ${token.symbol}
                        </span>
                        {token.name && (
                            <span className="truncate text-[11px] uppercase tracking-[0.22em] text-white/40">
                                {token.name}
                            </span>
                        )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                        {priceText && (
                            <span className="text-[13px] font-medium tracking-[0.08em] text-[#9dffb8]">
                                ${priceText}
                            </span>
                        )}
                        {token.priceChange24h !== undefined && (
                            <span
                                className={cn(
                                    "rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.22em]",
                                    token.priceChange24h >= 0
                                        ? "border-[#00ff41]/18 bg-[#00ff41]/10 text-[#9dffb8]"
                                        : "border-[#ff4400]/20 bg-[#ff4400]/10 text-[#ff8c64]"
                                )}
                            >
                                {token.priceChange24h >= 0 ? "+" : ""}{token.priceChange24h.toFixed(1)}%
                            </span>
                        )}
                        {token.pairCreatedAt && (
                            <span className="text-[10px] uppercase tracking-[0.22em] text-white/34">
                                LAUNCHED {formatTimeAgo(token.pairCreatedAt)}
                            </span>
                        )}
                    </div>

                    {creatorHandle && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/44">
                            <div className="relative h-5 w-5 overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
                                {token.creatorPfp ? (
                                    <Image src={token.creatorPfp} alt={creatorHandle} fill className="object-cover" unoptimized />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[9px] text-white/45">
                                        {creatorHandle.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <span className="truncate">@{creatorHandle}</span>
                            {token.twitterUsername && (
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        window.open(`https://x.com/${token.twitterUsername}`, "_blank", "noopener,noreferrer");
                                    }}
                                    className="inline-flex items-center gap-1 text-[#8dd8ff]/65 transition-colors hover:text-[#8dd8ff]"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {metrics.length > 0 && (
                <div className="alpha-metric-grid mt-4">
                    {metrics.slice(0, 4).map((metric) => (
                        <div key={`${token.tokenMint}-${metric.label}`} className="alpha-metric-tile">
                            <span className="text-[9px] uppercase tracking-[0.24em] text-white/32">{metric.label}</span>
                            <span className={cn("mt-2 text-[13px] font-medium tracking-[0.08em]", metric.tone)}>
                                {metric.value}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {token.isTrendingNow && token.trendingReasons && token.trendingReasons.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {token.trendingReasons.slice(0, 3).map((reason) => (
                        <span
                            key={`${token.tokenMint}-${reason}`}
                            className="alpha-badge-chip border-[#ffaa00]/16 bg-[#ffaa00]/10 text-[#ffd37a]/88"
                        >
                            {reason}
                        </span>
                    ))}
                </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
                {token.signals.slice(0, 4).map((signal, idx) => (
                    <SignalBadge key={`${signal.type}-${idx}`} signal={signal} />
                ))}
                {token.signals.length > 4 && (
                    <span className="alpha-badge-chip border-white/10 bg-white/[0.03] text-white/42">
                        +{token.signals.length - 4} MORE
                    </span>
                )}
            </div>

            {token.latestCreatorTweet && (
                <div className="mt-4 rounded-[22px] border border-[#00aaff]/12 bg-[#03131b]/80 p-3">
                    <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[#8dd8ff]/55">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current text-[#8dd8ff]/65">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        <span>CREATOR FEED {token.twitterUsername ? `@${token.twitterUsername}` : "LIVE"}</span>
                    </div>
                    <p className="line-clamp-3 text-[12px] leading-6 text-[#c4efff]/72">
                        {token.latestCreatorTweet}
                    </p>
                </div>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-white/6 pt-3 text-[10px] uppercase tracking-[0.24em] text-white/28">
                <span>{shortMint(token.tokenMint)}</span>
                <ChevronRight className="h-4 w-4 text-[#00ff41]/25 transition-all group-hover:translate-x-0.5 group-hover:text-[#00ff41]/65" />
            </div>
        </Link>
    );
}

function SignalBadge({ signal }: { signal: AlphaSignal }) {
    const colors: Record<AlphaSignalSeverity, string> = {
        critical: "border-[#ff4400]/20 bg-[#ff4400]/10 text-[#ff8c64]",
        high: "border-[#ffaa00]/20 bg-[#ffaa00]/10 text-[#ffd37a]",
        medium: "border-[#00ff41]/18 bg-[#00ff41]/10 text-[#9dffb8]",
        low: "border-white/10 bg-white/[0.03] text-white/45",
    };

    return (
        <div className={cn("alpha-badge-chip", colors[signal.severity])}>
            <span>{signal.title}</span>
            {signal.value && <span className="opacity-60">{signal.value}</span>}
        </div>
    );
}

function AlphaSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="alpha-status-card animate-pulse">
                        <div className="h-11 w-11 rounded-2xl border border-white/8 bg-white/[0.04]" />
                        <div className="mt-4 h-3 w-20 rounded-full bg-white/[0.05]" />
                        <div className="mt-3 h-8 w-12 rounded-full bg-white/[0.07]" />
                    </div>
                ))}
            </div>
            <div className="alpha-section-panel crt-panel p-4">
                <div className="h-4 w-56 rounded-full bg-white/[0.06]" />
                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="alpha-card-shell animate-pulse">
                            <div className="h-5 w-32 rounded-full bg-white/[0.05]" />
                            <div className="mt-4 flex items-start gap-4">
                                <div className="h-14 w-14 rounded-[18px] bg-white/[0.05]" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-28 rounded-full bg-white/[0.06]" />
                                    <div className="h-3 w-20 rounded-full bg-white/[0.05]" />
                                </div>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="h-16 rounded-[18px] bg-white/[0.04]" />
                                <div className="h-16 rounded-[18px] bg-white/[0.04]" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function formatUsdPrice(price?: number): string | null {
    if (price === undefined) return null;
    if (price >= 1) return price.toFixed(4);
    if (price >= 0.001) return price.toFixed(6);
    return price.toExponential(2);
}

function getDiscoverySourceLabel(source?: string): string | null {
    if (!source) return null;
    if (source === "bags-pool-scan") return "BAGS SCAN";
    if (source === "sync-trending-cache") return "TREND CACHE";
    return "DEX SEARCH";
}

function shortMint(mint: string): string {
    return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}
function fmtCompact(n: number): string {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toFixed(0);
}

function formatTimeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return "JUST NOW";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}M AGO`;
    const hours = Math.floor(minutes / 60);
    return `${hours}H AGO`;
}

function applyQuickFilter(tokens: AlphaToken[], filter: QuickFilter): AlphaToken[] {
    if (filter === "all") return tokens;

    return tokens.filter((token) => {
        if (filter === "rug-check") {
            return (token.rugRiskScore ?? 0) >= 35;
        }

        if (filter === "momentum") {
            return (
                token.alphaScore >= 30 ||
                (token.priceChange24h ?? 0) >= 12 ||
                (token.volume24hUsd ?? 0) >= 20_000 ||
                (token.txCount24h ?? 0) >= 180
            );
        }

        if (filter === "new-launches") {
            return isRecentLaunch(token.pairCreatedAt, 24);
        }

        if (filter === "last-minute") {
            return isRecentLaunch(token.pairCreatedAt, 2) || hasUrgentSignal(token) || (token.txCount24h ?? 0) >= 300;
        }

        return true;
    });
}

function hasUrgentSignal(token: AlphaToken): boolean {
    return token.signals.some((signal) => signal.severity === "critical");
}

function isRecentLaunch(pairCreatedAt?: string, maxAgeHours: number = 24): boolean {
    if (!pairCreatedAt) return false;
    const ts = new Date(pairCreatedAt).getTime();
    if (!Number.isFinite(ts)) return false;
    const ageMs = Date.now() - ts;
    if (ageMs < 0) return true;
    return ageMs <= maxAgeHours * 60 * 60 * 1000;
}

function getBreakingTrends(trends: RadarTrend[]): RadarTrend[] {
    const now = Date.now();
    return trends
        .filter((trend) => {
            const published = new Date(trend.publishedAt).getTime();
            if (!Number.isFinite(published)) return false;
            const age = now - published;
            return age >= 0 && age <= BREAKING_WINDOW_MS;
        })
        .sort((a, b) => {
            const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
            if (scoreDiff !== 0) return scoreDiff;
            return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        });
}

function scoreToRiskLevel(score: number): "low" | "medium" | "high" {
    if (score >= 65) return "high";
    if (score >= 35) return "medium";
    return "low";
}

function AccessLinks({ mint }: { mint?: string }) {
    return (
        <div className="mt-5">
            <p className="text-xs text-[#00ff41]/45 tracking-wider break-all">SCAN CA: {mint ?? SCAN_MINT}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
                <a
                    href={SCAN_BAGS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#00ff41]/25 text-[11px] text-[#00ff41]/65 tracking-wider hover:text-[#00ff41] hover:border-[#00ff41]/50 hover:bg-[#00ff41]/5 transition-all"
                >
                    BAGS.FM
                    <ExternalLink className="w-3 h-3" />
                </a>
                <a
                    href={SCAN_JUP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#00aaff]/25 text-[11px] text-[#00aaff]/70 tracking-wider hover:text-[#00aaff] hover:border-[#00aaff]/45 hover:bg-[#00aaff]/5 transition-all"
                >
                    JUP.AG
                    <ExternalLink className="w-3 h-3" />
                </a>
            </div>
        </div>
    );
}




