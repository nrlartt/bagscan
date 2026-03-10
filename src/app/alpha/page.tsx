"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Connection, PublicKey } from "@solana/web3.js";
import { cn } from "@/lib/utils";
import { getRpcUrl } from "@/lib/solana";
import Link from "next/link";
import Image from "next/image";
import {
    Zap, TrendingUp, TrendingDown, Flame, AlertTriangle, DollarSign,
    Users, MessageCircle, Shield, Rocket, BarChart3, ExternalLink,
    RefreshCw, Wifi, WifiOff, Eye, ChevronRight, Activity, Loader2,
    Radio, Cpu, Battery,
} from "lucide-react";
import type { AlphaFeedResponse, AlphaToken, AlphaSignal, AlphaSignalSeverity, RadarTrend } from "@/lib/alpha/types";

const SCAN_MINT = "BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS";
const MIN_SCAN_REQUIRED = BigInt(10_000_000);
const SCAN_BAGS_URL = `https://bags.fm/${SCAN_MINT}`;
const SCAN_JUP_URL = `https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${SCAN_MINT}`;
const BREAKING_WINDOW_MS = 2 * 60 * 60 * 1000;

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

            const connection = new Connection(getRpcUrl(), "confirmed");
            const mint = new PublicKey(SCAN_MINT);
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, { mint });

            let totalRaw = BigInt(0);
            let decimals = 0;

            for (const account of tokenAccounts.value) {
                const parsedData = account.account.data as {
                    parsed?: {
                        info?: {
                            tokenAmount?: {
                                amount?: string;
                                decimals?: number;
                            };
                        };
                    };
                };
                const tokenAmount = parsedData.parsed?.info?.tokenAmount;
                if (!tokenAmount?.amount) continue;
                decimals = tokenAmount.decimals ?? decimals;
                try {
                    totalRaw += BigInt(tokenAmount.amount);
                } catch {
                    // ignore malformed amount
                }
            }

            const thresholdRaw = MIN_SCAN_REQUIRED * (BigInt(10) ** BigInt(decimals));
            return {
                eligible: totalRaw >= thresholdRaw,
                balanceUi: formatTokenAmount(totalRaw, decimals),
                requiredUi: Number(MIN_SCAN_REQUIRED).toLocaleString("en-US"),
                mint: SCAN_MINT,
            };
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

    const tokens = data?.tokens ?? [];
    const totalSignals = data?.totalSignals ?? 0;
    const xquikEnabled = data?.xquikEnabled ?? false;
    const radarTrends = data?.radarTrends ?? [];
    const filteredTokens = useMemo(
        () => applyQuickFilter(tokens, quickFilter),
        [tokens, quickFilter]
    );
    const breakingTrends = useMemo(
        () => getBreakingTrends(radarTrends),
        [radarTrends]
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
                        THE ALPHA PAGE IS AVAILABLE ONLY TO WALLETS HOLDING AT LEAST 10,000,000 SCAN TOKENS.
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
                        REQUIRED: {accessData?.requiredUi ?? "10,000,000"} SCAN
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

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            {/* ╔══ HEADER ══╗ */}
            <div className="mb-6 animate-fade-in">
                <div className="crt-panel p-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <div className="relative w-12 h-12 border-2 border-[#ffaa00]/60 flex items-center justify-center" style={{ boxShadow: '0 0 16px rgba(255,170,0,0.15)' }}>
                                <Zap className="w-6 h-6 text-[#ffaa00]" />
                            </div>
                            <div>
                                <h1 className="text-lg tracking-[0.2em] text-crt-amber">
                                    ╔══ BAGS ALPHA CHANNEL ══╗
                                </h1>
                                <p className="text-[10px] text-[#00ff41]/40 tracking-[0.15em] mt-0.5">
                                    REAL-TIME SIGNAL DETECTION ENGINE :: ACTIVE
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 text-[9px] tracking-[0.1em] border",
                                xquikEnabled
                                    ? "border-[#00ff41]/30 text-[#00ff41]/70"
                                    : "border-[#ffaa00]/30 text-[#ffaa00]/70"
                            )}>
                                {xquikEnabled ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                                {xquikEnabled ? "X/TWITTER LINKED" : "X/TWITTER OFFLINE"}
                            </div>
                            <button
                                onClick={() => refetch()}
                                disabled={isFetching}
                                className="p-2 border border-[#00ff41]/30 text-[#00ff41]/60 hover:text-[#00ff41] hover:border-[#00ff41]/60 hover:bg-[#00ff41]/5 transition-all disabled:opacity-50"
                            >
                                <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
                            </button>
                        </div>
                    </div>

                    {/* Stats bar */}
                    {!isLoading && (
                        <div className="flex items-center gap-6 mt-4 pt-3 border-t border-[#00ff41]/15 text-[10px] tracking-wider">
                            <div className="flex items-center gap-1.5 text-[#00ff41]/50">
                                <span className="status-dot status-dot-amber" />
                                <span><span className="text-[#ffaa00]">{totalSignals}</span> SIGNALS DETECTED</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[#00ff41]/50">
                                <span className="status-dot status-dot-green" />
                                <span><span className="text-[#00ff41]">{tokens.length}</span> TOKENS TRACKED</span>
                            </div>
                            {data?.lastUpdated && (
                                <div className="text-[#00ff41]/30">
                                    LAST SCAN: {formatTimeAgo(data.lastUpdated)}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ╔══ SYSTEM STATUS GRID ══╗ */}
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

            {/* Loading state */}
            {isLoading ? (
                <AlphaSkeleton />
            ) : error ? (
                <div className="crt-panel crt-panel-red p-12 text-center">
                    <AlertTriangle className="w-10 h-10 text-[#ff4400] mx-auto mb-3" />
                    <p className="text-[#ff4400] tracking-wider text-sm">SYSTEM ERROR :: ALPHA FEED OFFLINE</p>
                    <p className="text-[#ff4400]/40 text-xs mt-2 tracking-wider">{String(error)}</p>
                    <button onClick={() => refetch()} className="mt-4 px-4 py-2 border border-[#ff4400]/50 text-[#ff4400] text-xs tracking-wider hover:bg-[#ff4400]/10 transition-colors">
                        RETRY CONNECTION
                    </button>
                </div>
            ) : tokens.length === 0 ? (
                <div className="crt-panel p-12 text-center">
                    <Cpu className="w-10 h-10 text-[#00ff41]/30 mx-auto mb-3" />
                    <p className="text-[#00ff41]/70 tracking-wider text-sm">NO ALPHA SIGNALS DETECTED</p>
                    <p className="text-[#00ff41]/30 text-xs mt-2 tracking-wider">AWAITING MARKET ACTIVITY_</p>
                </div>
            ) : filteredTokens.length === 0 ? (
                <div className="crt-panel p-12 text-center">
                    <Activity className="w-10 h-10 text-[#00ff41]/30 mx-auto mb-3" />
                    <p className="text-[#00ff41]/70 tracking-wider text-sm">NO TOKENS MATCH THIS QUICK FILTER</p>
                    <p className="text-[#00ff41]/30 text-xs mt-2 tracking-wider">TRY SWITCHING TO ALL OR MOMENTUM</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {criticalTokens.length > 0 && (
                        <AlphaSection
                            title="╔══ CRITICAL ALPHA ══╗"
                            subtitle="PRIORITY SIGNALS :: IMMEDIATE ATTENTION REQUIRED"
                            panelClass="crt-panel-red"
                            dotClass="status-dot-red"
                            tokens={criticalTokens}
                        />
                    )}

                    {hotTokens.length > 0 && (
                        <AlphaSection
                            title="╔══ HOT SIGNALS ══╗"
                            subtitle="EMERGING ALPHA OPPORTUNITIES"
                            panelClass="crt-panel-amber"
                            dotClass="status-dot-amber"
                            tokens={hotTokens}
                        />
                    )}

                    {watchTokens.length > 0 && (
                        <AlphaSection
                            title="╔══ WATCHLIST ══╗"
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
                        <div className="panel-header">╔══ MOTHER COMPUTER INTERFACE ══╗</div>
                        <div className="bg-black p-4 border border-[#00ff41]/10 font-mono text-[11px] leading-relaxed">
                            <p className="text-[#00ff41]/70">READY_</p>
                            <p className="text-[#00ff41]/50 mt-1">&gt; QUERY: ALPHA SCAN STATUS</p>
                            <p className="text-[#00ff41]/70 mt-1">&gt; {filteredTokens.length} TOKENS MATCHING {quickFilter.toUpperCase()} :: {totalSignals} SIGNALS ACTIVE</p>
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

// ── SystemStatusCard ────────────────────────

function SystemStatusCard({ label, value, status, icon }: {
    label: string; value: number; status: "online" | "warning" | "critical" | "info"; icon: React.ReactNode;
}) {
    const colors = {
        online: { border: "border-[#00ff41]/50", text: "text-[#00ff41]", bg: "bg-[#00ff41]/5" },
        warning: { border: "border-[#ffaa00]/50", text: "text-[#ffaa00]", bg: "bg-[#ffaa00]/5" },
        critical: { border: "border-[#ff4400]/50", text: "text-[#ff4400]", bg: "bg-[#ff4400]/5" },
        info: { border: "border-[#00aaff]/50", text: "text-[#00aaff]", bg: "bg-[#00aaff]/5" },
    };
    const c = colors[status];

    return (
        <div className={cn("border-2 p-3 text-center transition-all hover:bg-opacity-10", c.border, c.bg)}>
            <div className={cn("flex items-center justify-center gap-2 mb-1", c.text)}>{icon}</div>
            <p className="text-[9px] text-[#00ff41]/40 tracking-[0.15em]">{label}</p>
            <p className={cn("text-2xl font-medium mt-1 tracking-wider", c.text)} style={{ textShadow: '0 0 10px currentColor' }}>
                {value}
            </p>
        </div>
    );
}

// ── RadarSection ─────────────────────────────

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
        <div className="crt-panel p-4 mb-6 animate-fade-in">
            <div className="panel-header flex items-center gap-2">
                <span className="status-dot status-dot-green" />
                ╔══ QUICK FILTER ══╗
                <span className="ml-auto text-[#00ff41]/30">{matchedCount} MATCHES</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
                {filters.map((filter) => {
                    const active = activeFilter === filter.key;
                    return (
                        <button
                            key={filter.key}
                            onClick={() => onChange(filter.key)}
                            className={cn(
                                "px-3 py-1.5 border text-[10px] tracking-[0.12em] transition-all",
                                active
                                    ? "border-[#00ff41]/60 text-[#00ff41] bg-[#00ff41]/10"
                                    : "border-[#00ff41]/20 text-[#00ff41]/50 hover:text-[#00ff41]/80 hover:border-[#00ff41]/40 hover:bg-[#00ff41]/5"
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

function BreakingRadarPanel({ trends }: { trends: RadarTrend[] }) {
    return (
        <div className="crt-panel crt-panel-amber p-4 mb-6 animate-fade-in">
            <div className="panel-header flex items-center gap-2">
                <span className="status-dot status-dot-amber" />
                ╔══ BREAKING CRYPTO RADAR ══╗
                <span className="ml-auto text-[#ffaa00]/40">LAST 120M</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-2 stagger-children">
                {trends.slice(0, 6).map((trend) => (
                    <a
                        key={trend.id}
                        href={trend.url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 border border-[#ffaa00]/20 bg-black/45 hover:bg-[#ffaa00]/5 hover:border-[#ffaa00]/40 transition-all"
                    >
                        <p className="text-[11px] text-[#ffaa00]/80 tracking-wider line-clamp-2 leading-relaxed">
                            {trend.title}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-[8px] tracking-[0.12em]">
                            <span className="text-[#ffaa00]/35">{trend.source.replace("_", " ").toUpperCase()}</span>
                            <span className="text-[#ffaa00]/30">SCORE {trend.score}</span>
                            <span className="text-[#ffaa00]/25 ml-auto">{formatTimeAgo(trend.publishedAt)}</span>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}

function RadarSection({ trends }: { trends: RadarTrend[] }) {
    return (
        <div className="crt-panel p-4 animate-fade-in">
            <div className="panel-header flex items-center gap-2">
                <span className="status-dot status-dot-blue" />
                ╔══ EXTERNAL RADAR FEED ══╗
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 stagger-children">
                {trends.slice(0, 12).map((trend) => (
                    <a
                        key={trend.id}
                        href={trend.url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 border border-[#00aaff]/15 bg-black/40 hover:bg-[#00aaff]/5 hover:border-[#00aaff]/30 transition-all group"
                    >
                        <p className="text-[11px] text-[#00aaff]/80 group-hover:text-[#00aaff] transition-colors line-clamp-2 tracking-wider leading-relaxed">
                            {trend.title}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-[8px] text-[#00aaff]/30 px-1.5 py-0.5 border border-[#00aaff]/10 tracking-wider">
                                {trend.source.replace("_", " ").toUpperCase()}
                            </span>
                            <span className="text-[8px] text-[#00aaff]/20 tracking-wider">
                                SCORE: {trend.score}
                            </span>
                            <ExternalLink className="w-2.5 h-2.5 text-[#00aaff]/20 group-hover:text-[#00aaff]/50 transition-colors ml-auto" />
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}

// ── AlphaSection ─────────────────────────────

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
        <div className={cn("crt-panel p-4 animate-fade-in", panelClass)}>
            <div className="panel-header flex items-center gap-2">
                <span className={cn("status-dot", dotClass)} />
                {title}
                <span className="ml-auto text-[#00ff41]/30">[{tokens.length}]</span>
            </div>
            <p className="text-[9px] text-[#00ff41]/30 tracking-[0.1em] mb-3 -mt-1">{subtitle}</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 stagger-children">
                {tokens.map((token) => (
                    <AlphaCard key={token.tokenMint} token={token} />
                ))}
            </div>
        </div>
    );
}

// ── AlphaCard ────────────────────────────────

function AlphaCard({ token }: { token: AlphaToken }) {
    const scoreColor =
        token.alphaScore >= 60 ? "#ff4400"
            : token.alphaScore >= 30 ? "#ffaa00"
                : "#00ff41";
    const rugRiskScore = token.rugRiskScore ?? 0;
    const rugRiskLevel = token.rugRiskLevel ?? scoreToRiskLevel(rugRiskScore);
    const rugRiskClass =
        rugRiskLevel === "high"
            ? "border-[#ff4400]/35 text-[#ff4400]/75"
            : rugRiskLevel === "medium"
                ? "border-[#ffaa00]/35 text-[#ffaa00]/75"
                : "border-[#00ff41]/20 text-[#00ff41]/50";

    return (
        <Link
            href={`/token/${token.tokenMint}`}
            className="group border border-[#00ff41]/15 bg-black/60 p-4 relative overflow-hidden hover:border-[#00ff41]/40 hover:bg-[#00ff41]/[0.02] transition-all"
        >
            {rugRiskScore > 0 && (
                <div className={cn("absolute top-3 left-3 px-1.5 py-0.5 border text-[8px] tracking-wider", rugRiskClass)}>
                    RUG {rugRiskScore}
                </div>
            )}

            {/* Score badge */}
            <div className="absolute top-3 right-3 flex items-center gap-1 text-xs tracking-wider" style={{ color: scoreColor, textShadow: `0 0 8px ${scoreColor}` }}>
                <Zap className="w-3 h-3" />
                <span className="font-medium">{token.alphaScore}</span>
            </div>

            {/* Token header */}
            <div className="flex items-center gap-3 mb-3">
                <div className="relative w-10 h-10 overflow-hidden flex-shrink-0 border border-[#00ff41]/20">
                    {token.image ? (
                        <Image src={token.image} alt={token.symbol ?? ""} fill className="object-cover" unoptimized />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#00ff41]/40 text-sm bg-[#00ff41]/5">
                            {token.symbol?.charAt(0) ?? "?"}
                        </div>
                    )}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[#00ff41] text-xs tracking-wider group-hover:text-[#00ff41] transition-colors" style={{ textShadow: '0 0 6px rgba(0,255,65,0.3)' }}>
                            ${token.symbol}
                        </span>
                        {token.name && (
                            <span className="text-[9px] text-[#00ff41]/25 truncate max-w-[120px] tracking-wider">
                                {token.name}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        {token.priceUsd !== undefined && (
                            <span className="text-[10px] text-[#00ff41]/50 tracking-wider">
                                ${token.priceUsd < 0.01 ? token.priceUsd.toExponential(2) : token.priceUsd.toFixed(4)}
                            </span>
                        )}
                        {token.priceChange24h !== undefined && (
                            <span className={cn(
                                "text-[9px] tracking-wider",
                                token.priceChange24h >= 0 ? "text-[#00ff41]" : "text-[#ff4400]"
                            )}>
                                {token.priceChange24h >= 0 ? "+" : ""}{token.priceChange24h.toFixed(1)}%
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Metrics row */}
            <div className="flex items-center gap-3 mb-3 text-[9px] tracking-wider">
                {token.volume24hUsd !== undefined && (
                    <div className="flex items-center gap-1 text-[#00ff41]/40">
                        <BarChart3 className="w-2.5 h-2.5" />
                        <span>VOL ${fmtCompact(token.volume24hUsd)}</span>
                    </div>
                )}
                {token.earnedUsd !== undefined && token.earnedUsd > 0 && (
                    <div className="flex items-center gap-1 text-[#ffaa00]/40">
                        <DollarSign className="w-2.5 h-2.5" />
                        <span>${fmtCompact(token.earnedUsd)}</span>
                    </div>
                )}
                {token.creatorFollowers !== undefined && (
                    <div className="flex items-center gap-1 text-[#00aaff]/40">
                        <Users className="w-2.5 h-2.5" />
                        <span>{fmtCompact(token.creatorFollowers)}</span>
                    </div>
                )}
                {token.tweetCount !== undefined && token.tweetCount > 0 && (
                    <div className="flex items-center gap-1 text-[#00aaff]/40">
                        <MessageCircle className="w-2.5 h-2.5" />
                        <span>{token.tweetCount}</span>
                    </div>
                )}
            </div>

            {/* Creator */}
            {token.creatorDisplay && (
                <div className="flex items-center gap-1.5 mb-3">
                    {token.creatorPfp && (
                        <div className="relative w-4 h-4 overflow-hidden flex-shrink-0 border border-[#00ff41]/15">
                            <Image src={token.creatorPfp} alt="" fill className="object-cover" unoptimized />
                        </div>
                    )}
                    <span className="text-[9px] text-[#00ff41]/30 tracking-wider">
                        @{token.creatorDisplay}
                    </span>
                    {token.twitterUsername && (
                        <a
                            href={`https://x.com/${token.twitterUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#00aaff]/30 hover:text-[#00aaff] transition-colors"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                    )}
                </div>
            )}

            {/* Signals */}
            <div className="flex flex-wrap gap-1.5">
                {token.signals.slice(0, 4).map((signal, idx) => (
                    <SignalBadge key={`${signal.type}-${idx}`} signal={signal} />
                ))}
                {token.signals.length > 4 && (
                    <span className="text-[8px] text-[#00ff41]/20 px-2 py-0.5 border border-[#00ff41]/10 tracking-wider">
                        +{token.signals.length - 4}
                    </span>
                )}
            </div>

            {/* Latest tweet */}
            {token.latestCreatorTweet && (
                <div className="mt-3 p-2.5 border border-[#00aaff]/10 bg-black/60">
                    <div className="flex items-center gap-1 mb-1">
                        <svg viewBox="0 0 24 24" className="w-3 h-3 text-[#00aaff]/30 fill-current">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        <span className="text-[8px] text-[#00aaff]/25 tracking-wider">FEED: @{token.twitterUsername}</span>
                    </div>
                    <p className="text-[9px] text-[#00aaff]/40 line-clamp-2 leading-relaxed tracking-wider">
                        {token.latestCreatorTweet}
                    </p>
                </div>
            )}

            <ChevronRight className="absolute bottom-3 right-3 w-3.5 h-3.5 text-[#00ff41]/15 group-hover:text-[#00ff41]/50 transition-all group-hover:translate-x-0.5" />
        </Link>
    );
}

// ── SignalBadge ──────────────────────────────

function SignalBadge({ signal }: { signal: AlphaSignal }) {
    const colors: Record<AlphaSignalSeverity, string> = {
        critical: "border-[#ff4400]/30 text-[#ff4400]/70",
        high: "border-[#ffaa00]/30 text-[#ffaa00]/70",
        medium: "border-[#00ff41]/30 text-[#00ff41]/70",
        low: "border-[#00ff41]/15 text-[#00ff41]/40",
    };

    return (
        <div className={cn("flex items-center gap-1 px-2 py-0.5 border text-[8px] tracking-wider", colors[signal.severity])}>
            <span>{signal.title}</span>
            {signal.value && <span className="opacity-60">{signal.value}</span>}
        </div>
    );
}

// ── AlphaSkeleton ───────────────────────────

function AlphaSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="border-2 border-[#00ff41]/15 p-3 text-center animate-pulse">
                        <div className="w-6 h-6 mx-auto mb-2 border border-[#00ff41]/10" />
                        <div className="w-16 h-3 bg-[#00ff41]/5 mx-auto mb-1" />
                        <div className="w-8 h-6 bg-[#00ff41]/10 mx-auto" />
                    </div>
                ))}
            </div>
            <div className="crt-panel p-4">
                <div className="w-48 h-4 bg-[#00ff41]/10 mb-4" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="border border-[#00ff41]/10 bg-black/60 p-4 animate-pulse">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 border border-[#00ff41]/10" />
                                <div>
                                    <div className="w-20 h-3 bg-[#00ff41]/10" />
                                    <div className="w-14 h-2 bg-[#00ff41]/5 mt-1" />
                                </div>
                            </div>
                            <div className="flex gap-1.5">
                                <div className="w-20 h-4 border border-[#00ff41]/5" />
                                <div className="w-16 h-4 border border-[#00ff41]/5" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Utilities ────────────────────────────────

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

function formatTokenAmount(raw: bigint, decimals: number): string {
    const safeDecimals = Math.max(0, decimals);
    if (safeDecimals === 0) return raw.toString();

    const scale = BigInt(10) ** BigInt(safeDecimals);
    const whole = raw / scale;
    const fraction = raw % scale;

    if (fraction === BigInt(0)) return whole.toString();

    const fractionText = fraction
        .toString()
        .padStart(safeDecimals, "0")
        .replace(/0+$/, "");

    return `${whole.toString()}.${fractionText}`;
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
                (token.volume24hUsd ?? 0) >= 20_000
            );
        }

        if (filter === "new-launches") {
            return isRecentLaunch(token.pairCreatedAt, 24);
        }

        if (filter === "last-minute") {
            return isRecentLaunch(token.pairCreatedAt, 2) || hasUrgentSignal(token);
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
