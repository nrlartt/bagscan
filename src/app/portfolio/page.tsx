"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import {
    ArrowUpRight,
    Coins,
    DollarSign,
    Layers,
    RefreshCw,
    Search,
    Sparkles,
    TrendingDown,
    TrendingUp,
    Wallet,
} from "lucide-react";
import { cn, formatCurrency, formatNumber, shortenAddress } from "@/lib/utils";
import { fetchPortfolio } from "@/lib/portfolio/client";
import type { PortfolioResponse } from "@/lib/portfolio/types";

export default function PortfolioPage() {
    const { publicKey, connected } = useWallet();
    const { setVisible } = useWalletModal();
    const [walletInput, setWalletInput] = useState("");

    const connectedWallet = publicKey?.toBase58() ?? "";
    const trackedWallet = walletInput.trim() || connectedWallet;
    const deferredWallet = useDeferredValue(trackedWallet);

    const walletError = useMemo(() => {
        if (!deferredWallet) return null;
        try {
            return new PublicKey(deferredWallet).toBase58() ? null : "Invalid wallet";
        } catch {
            return "INVALID SOLANA WALLET ADDRESS";
        }
    }, [deferredWallet]);

    const portfolioQuery = useQuery<PortfolioResponse>({
        queryKey: ["portfolio", deferredWallet],
        enabled: Boolean(deferredWallet) && !walletError,
        queryFn: () => fetchPortfolio(deferredWallet),
        staleTime: 20_000,
        refetchInterval: 45_000,
    });

    const portfolio = portfolioQuery.data;
    const summary = portfolio?.summary;

    return (
        <div className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
            <section className="crt-panel relative overflow-hidden p-6 sm:p-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,255,65,0.15),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(0,170,255,0.14),transparent_34%)]" />
                <div className="relative z-[1] grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.95fr)] xl:items-end">
                    <div className="space-y-5">
                        <div className="flex flex-wrap items-start gap-4">
                            <div className="flex h-14 w-14 items-center justify-center border border-[#00ff41]/25 bg-[#00ff41]/10 shadow-[0_0_24px_rgba(0,255,65,0.14)]">
                                <Wallet className="h-7 w-7 text-[#00ff41]" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] uppercase tracking-[0.34em] text-[#00ff41]/55">Phase 2 In Development</p>
                                <h1
                                    className="mt-2 text-3xl tracking-[0.16em] text-[#d8ffe6] sm:text-5xl"
                                    style={{ textShadow: "0 0 16px rgba(0,255,65,0.18)" }}
                                >
                                    PORTFOLIO TRACKER
                                </h1>
                                <p className="mt-4 max-w-3xl text-sm leading-7 text-[#d8ffe6]/70 sm:text-[15px]">
                                    Track live wallet value, actual average-cost basis, unrealized PnL, and Bags fee-share claimables in one terminal.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2.5">
                            <div className="inline-flex items-center gap-2 border border-[#00ff41]/20 bg-[#00ff41]/10 px-3 py-2 text-[11px] tracking-[0.18em] text-[#9dffb8]">
                                <span className="h-2 w-2 rounded-full bg-[#00ff41] shadow-[0_0_10px_rgba(0,255,65,0.75)]" />
                                LIVE WALLET SCAN
                            </div>
                            <div className="inline-flex items-center gap-2 border border-[#00aaff]/20 bg-[#00aaff]/10 px-3 py-2 text-[11px] tracking-[0.18em] text-[#8dd8ff]">
                                <Sparkles className="h-3.5 w-3.5" />
                                TRUE COST BASIS
                            </div>
                            <div className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] tracking-[0.18em] text-white/65">
                                Bags claimable fees included
                            </div>
                        </div>
                    </div>

                    <div className="border border-white/10 bg-black/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/48">
                            <Search className="h-3.5 w-3.5" />
                            Track Wallet
                        </div>
                        <div className="mt-4 flex flex-col gap-3">
                            <input
                                value={walletInput}
                                onChange={(event) => setWalletInput(event.target.value)}
                                placeholder={connectedWallet || "Paste any Solana wallet address"}
                                className="w-full border border-[#00ff41]/15 bg-black/60 px-3 py-3 text-xs tracking-wider text-[#00ff41] placeholder-[#00ff41]/15 transition-all focus:border-[#00ff41]/40 focus:outline-none focus:shadow-[0_0_10px_rgba(0,255,65,0.08)]"
                            />

                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => portfolioQuery.refetch()}
                                    disabled={!deferredWallet || Boolean(walletError) || portfolioQuery.isFetching}
                                    className="inline-flex items-center gap-2 border border-[#00ff41]/20 bg-[#00ff41]/10 px-3 py-2 text-[11px] tracking-[0.18em] text-[#9dffb8] transition-all hover:bg-[#00ff41]/16 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <RefreshCw className={cn("h-3.5 w-3.5", portfolioQuery.isFetching && "animate-spin")} />
                                    REFRESH
                                </button>
                                {connected ? (
                                    <button
                                        onClick={() => setWalletInput("")}
                                        className="inline-flex items-center gap-2 border border-[#00aaff]/20 bg-[#00aaff]/10 px-3 py-2 text-[11px] tracking-[0.18em] text-[#8dd8ff] transition-all hover:bg-[#00aaff]/16"
                                    >
                                        USE CONNECTED WALLET
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setVisible(true)}
                                        className="inline-flex items-center gap-2 border border-[#ffaa00]/20 bg-[#ffaa00]/10 px-3 py-2 text-[11px] tracking-[0.18em] text-[#ffd37a] transition-all hover:bg-[#ffaa00]/16"
                                    >
                                        CONNECT WALLET
                                    </button>
                                )}
                            </div>

                            <p className="text-[11px] leading-5 text-white/45">
                                Cost basis uses wallet transaction history with an <span className="text-[#9dffb8]">average-cost</span> model. Daily movement is still shown separately as a live market signal.
                            </p>
                            {walletError ? (
                                <p className="text-[11px] tracking-[0.16em] text-[#ff8f70]">{walletError}</p>
                            ) : deferredWallet ? (
                                <p className="text-[11px] tracking-[0.16em] text-[#00ff41]/45">
                                    TRACKING {shortenAddress(deferredWallet, 6)}
                                </p>
                            ) : (
                                <p className="text-[11px] tracking-[0.16em] text-[#00ff41]/35">
                                    CONNECT A WALLET OR PASTE ANY PUBLIC ADDRESS TO START.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Total Value"
                    value={summary ? formatCurrency(summary.totalValueUsd) : "—"}
                    hint={summary ? `${formatNumber(summary.holdingsCount, false)} holdings tracked` : "Waiting for wallet scan"}
                    accent="text-[#d8ffe6]"
                    icon={<DollarSign className="h-4 w-4" />}
                />
                <StatCard
                    label="Cost Basis"
                    value={summary ? formatCurrency(summary.totalCostBasisUsd) : "—"}
                    hint={
                        summary
                            ? `${formatNumber(summary.costBasisCompleteHoldingsCount, false)}/${formatNumber(summary.costBasisHoldingsCount, false)} holdings fully covered`
                            : "Built from wallet transaction history"
                    }
                    accent="text-[#8dd8ff]"
                    icon={<Coins className="h-4 w-4" />}
                />
                <StatCard
                    label="Unrealized PnL"
                    value={summary ? formatSignedCurrency(summary.totalUnrealizedPnlUsd) : "—"}
                    hint={
                        summary
                            ? `${formatSignedPercent(summary.totalUnrealizedPnlPercent)} vs total basis`
                            : "Current value minus tracked cost basis"
                    }
                    accent={summary && summary.totalUnrealizedPnlUsd < 0 ? "text-[#ff8f70]" : "text-[#9dffb8]"}
                    icon={summary && summary.totalUnrealizedPnlUsd < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                />
                <StatCard
                    label="Claimable Fees"
                    value={summary ? `${summary.claimableFeesSol.toFixed(4)} SOL` : "—"}
                    hint={summary ? `${formatCurrency(summary.claimableFeesUsd)} across ${summary.claimablePositionsCount} positions` : "Bags fee-share positions"}
                    accent="text-[#ffd37a]"
                    icon={<Layers className="h-4 w-4" />}
                />
            </section>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.9fr)]">
                <section className="crt-panel p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#00ff41]/12 pb-4">
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.28em] text-[#00ff41]/55">Live Holdings</p>
                            <h2 className="mt-1 text-lg tracking-[0.16em] text-[#d8ffe6] sm:text-xl">CURRENT PORTFOLIO</h2>
                        </div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-[#00ff41]/45">
                            Average-cost basis and unrealized PnL
                        </p>
                    </div>

                    {portfolio?.costBasis ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-2 border border-[#00ff41]/16 bg-[#00ff41]/8 px-2.5 py-1 text-[10px] tracking-[0.18em] text-[#9dffb8]">
                                METHOD {portfolio.costBasis.method.toUpperCase()}
                            </span>
                            <span
                                className={cn(
                                    "inline-flex items-center gap-2 border px-2.5 py-1 text-[10px] tracking-[0.18em]",
                                    portfolio.costBasis.historyComplete
                                        ? "border-[#00ff41]/16 bg-[#00ff41]/8 text-[#9dffb8]"
                                        : "border-[#ffaa00]/20 bg-[#ffaa00]/10 text-[#ffd37a]"
                                )}
                            >
                                {portfolio.costBasis.historyComplete ? "FULL HISTORY COVERAGE" : "PARTIAL HISTORY COVERAGE"}
                            </span>
                            <span className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] tracking-[0.18em] text-white/60">
                                {portfolio.costBasis.transactionsScanned} TX SCANNED
                            </span>
                        </div>
                    ) : null}

                    {!deferredWallet ? (
                        <EmptyPanel message="Connect a wallet or paste an address to load portfolio holdings." />
                    ) : portfolioQuery.isLoading ? (
                        <LoadingPanel rows={6} />
                    ) : portfolioQuery.isError ? (
                        <EmptyPanel message={portfolioQuery.error instanceof Error ? portfolioQuery.error.message : "Portfolio scan failed."} tone="error" />
                    ) : portfolio && portfolio.holdings.length === 0 ? (
                        <EmptyPanel message="No fungible token holdings found for this wallet." />
                    ) : (
                        <div className="mt-5 space-y-3">
                            {portfolio?.holdings.map((holding) => (
                                <HoldingRow key={`${holding.mint}-${holding.tokenAccount}`} holding={holding} />
                            ))}
                        </div>
                    )}
                </section>

                <section className="space-y-6">
                    <div className="crt-panel p-4 sm:p-5">
                        <div className="border-b border-[#00ff41]/12 pb-4">
                            <p className="text-[11px] uppercase tracking-[0.28em] text-[#00ff41]/55">Bags Monetization</p>
                            <h2 className="mt-1 text-lg tracking-[0.16em] text-[#d8ffe6] sm:text-xl">CLAIMABLE FEES</h2>
                        </div>

                        {!deferredWallet ? (
                            <EmptyPanel message="Claimable Bags fee-share positions will appear here after wallet scan." compact />
                        ) : portfolioQuery.isLoading ? (
                            <LoadingPanel rows={3} compact />
                        ) : portfolioQuery.isError ? (
                            <EmptyPanel message="Unable to load Bags claimable positions." tone="error" compact />
                        ) : portfolio && portfolio.claimablePositions.length === 0 ? (
                            <EmptyPanel message="No claimable Bags fee-share positions found." compact />
                        ) : (
                            <div className="mt-5 space-y-3">
                                {portfolio?.claimablePositions.map((position) => (
                                    <ClaimableRow key={`${position.baseMint}-${position.userBps ?? "claim"}`} position={position} />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="crt-panel p-4 sm:p-5">
                        <div className="border-b border-[#00ff41]/12 pb-4">
                            <p className="text-[11px] uppercase tracking-[0.28em] text-[#00ff41]/55">Release Notes</p>
                            <h2 className="mt-1 text-lg tracking-[0.16em] text-[#d8ffe6] sm:text-xl">MVP SCOPE</h2>
                        </div>
                        <ul className="mt-5 space-y-3 text-sm leading-6 text-[#d8ffe6]/62">
                            <li>Live holdings are fetched directly from the selected Solana wallet.</li>
                            <li>Average-cost basis is reconstructed from wallet transaction history when coverage is available.</li>
                            <li>Token pricing and 24h movement are enriched from live market data when available.</li>
                            <li>Wallets with missing older history or transfer-only inflows are marked as partial cost-basis coverage.</li>
                            <li>Bags fee-share claimables are surfaced separately so creator-side revenue is visible next to portfolio exposure.</li>
                        </ul>
                    </div>
                </section>
            </div>
        </div>
    );
}

function HoldingRow({ holding }: { holding: PortfolioResponse["holdings"][number] }) {
    const unrealizedPositive = (holding.unrealizedPnlUsd ?? 0) >= 0;
    const dailyPositive = (holding.pnl24hUsd ?? 0) >= 0;

    return (
        <Link
            href={`/token/${holding.mint}`}
            className="group flex flex-col gap-4 border border-[#00ff41]/10 bg-black/60 p-4 transition-all hover:border-[#00ff41]/28 hover:bg-[#00ff41]/[0.02] md:flex-row md:items-center"
        >
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden border border-[#00ff41]/15 bg-black/40">
                    {holding.image ? (
                        <Image src={holding.image} alt={holding.symbol ?? holding.name ?? holding.mint} fill className="object-cover" unoptimized />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-[#00ff41]/35">
                            {(holding.symbol ?? holding.name ?? "?").charAt(0)}
                        </div>
                    )}
                </div>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm tracking-[0.1em] text-[#d8ffe6]">
                            {holding.symbol ? `$${holding.symbol}` : shortenAddress(holding.mint)}
                        </h3>
                        <span
                            className={cn(
                                "border px-1.5 py-0.5 text-[10px] tracking-[0.18em]",
                                holding.costBasisStatus === "complete" && "border-[#00ff41]/18 bg-[#00ff41]/8 text-[#9dffb8]",
                                holding.costBasisStatus === "partial" && "border-[#ffaa00]/20 bg-[#ffaa00]/10 text-[#ffd37a]",
                                holding.costBasisStatus === "unknown" && "border-white/10 bg-white/[0.03] text-white/55"
                            )}
                        >
                            {holding.costBasisStatus.toUpperCase()}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.2em] text-[#00ff41]/35">
                            {holding.name ?? "Unknown Token"}
                        </span>
                    </div>
                    <p className="mt-1 text-[11px] tracking-[0.16em] text-[#00ff41]/40">
                        {formatTokenAmount(holding.amount)} tokens
                    </p>
                    {holding.averageCostUsd !== undefined ? (
                        <p className="mt-1 text-[11px] tracking-[0.16em] text-[#8dd8ff]/55">
                            AVG COST {formatCurrency(holding.averageCostUsd, { compact: false, decimals: 4 })}
                        </p>
                    ) : null}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 md:w-[420px] md:grid-cols-4">
                <MetricTile label="Price" value={holding.priceUsd !== undefined ? formatCurrency(holding.priceUsd, { compact: false, decimals: 4 }) : "—"} />
                <MetricTile
                    label="Basis"
                    value={holding.costBasisUsd !== undefined ? formatCurrency(holding.costBasisUsd) : "—"}
                    tone={holding.costBasisStatus === "complete" ? "neutral" : holding.costBasisStatus === "partial" ? "positive" : "neutral"}
                />
                <MetricTile
                    label="PnL"
                    value={holding.unrealizedPnlUsd !== undefined ? formatSignedCurrency(holding.unrealizedPnlUsd) : "—"}
                    tone={
                        holding.unrealizedPnlUsd === undefined ? "neutral" : unrealizedPositive ? "positive" : "negative"
                    }
                />
                <MetricTile
                    label="24H"
                    value={holding.pnl24hUsd !== undefined ? formatSignedCurrency(holding.pnl24hUsd) : "—"}
                    tone={holding.pnl24hUsd === undefined ? "neutral" : dailyPositive ? "positive" : "negative"}
                />
            </div>

            <ArrowUpRight className="hidden h-4 w-4 text-[#00ff41]/28 transition-colors group-hover:text-[#00ff41]/72 md:block" />
        </Link>
    );
}

function ClaimableRow({ position }: { position: PortfolioResponse["claimablePositions"][number] }) {
    return (
        <Link
            href={`/token/${position.baseMint}`}
            className="group flex items-center gap-3 border border-[#00ff41]/10 bg-black/60 p-4 transition-all hover:border-[#00ff41]/28 hover:bg-[#00ff41]/[0.02]"
        >
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden border border-[#00ff41]/15 bg-black/40">
                {position.image ? (
                    <Image src={position.image} alt={position.symbol ?? position.name ?? position.baseMint} fill className="object-cover" unoptimized />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-[#00ff41]/35">
                        {(position.symbol ?? position.name ?? "?").charAt(0)}
                    </div>
                )}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm tracking-[0.1em] text-[#d8ffe6]">
                        {position.symbol ? `$${position.symbol}` : shortenAddress(position.baseMint)}
                    </h3>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#00ff41]/35">
                        {position.isMigrated ? "Migrated" : "Active"}
                    </span>
                </div>
                <p className="mt-1 text-[11px] tracking-[0.16em] text-[#00ff41]/40">
                    {position.userBps ? `${(position.userBps / 100).toFixed(2)}% share` : "Fee-share position"}
                </p>
            </div>

            <div className="text-right">
                <p className="text-sm tracking-[0.08em] text-[#ffd37a]">{position.claimableSol.toFixed(4)} SOL</p>
                <p className="mt-1 text-[11px] tracking-[0.16em] text-[#ffd37a]/60">{formatCurrency(position.claimableUsd)}</p>
            </div>
        </Link>
    );
}

function StatCard({
    label,
    value,
    hint,
    accent,
    icon,
}: {
    label: string;
    value: string;
    hint: string;
    accent: string;
    icon: ReactNode;
}) {
    return (
        <div className="border border-white/10 bg-black/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.24em] text-white/48">{label}</span>
                <span className={cn("flex h-8 w-8 items-center justify-center border border-white/10 bg-white/[0.03]", accent)}>
                    {icon}
                </span>
            </div>
            <p className={cn("mt-4 text-2xl tracking-[0.08em] sm:text-3xl", accent)}>{value}</p>
            <p className="mt-2 text-xs leading-5 text-white/44">{hint}</p>
        </div>
    );
}

function MetricTile({
    label,
    value,
    tone = "neutral",
}: {
    label: string;
    value: string;
    tone?: "neutral" | "positive" | "negative";
}) {
    return (
        <div className="border border-[#00ff41]/10 bg-black/40 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#00ff41]/32">{label}</p>
            <p
                className={cn(
                    "mt-1 text-sm tracking-[0.08em]",
                    tone === "positive" && "text-[#9dffb8]",
                    tone === "negative" && "text-[#ff8f70]",
                    tone === "neutral" && "text-[#d8ffe6]/82"
                )}
            >
                {value}
            </p>
        </div>
    );
}

function EmptyPanel({
    message,
    tone = "default",
    compact = false,
}: {
    message: string;
    tone?: "default" | "error";
    compact?: boolean;
}) {
    return (
        <div
            className={cn(
                "flex items-center justify-center text-center text-sm leading-6",
                compact ? "py-10" : "py-16",
                tone === "error" ? "text-[#ff8f70]" : "text-[#00ff41]/40"
            )}
        >
            <p className="max-w-md">{message}</p>
        </div>
    );
}

function LoadingPanel({ rows, compact = false }: { rows: number; compact?: boolean }) {
    return (
        <div className={cn("space-y-3", compact ? "mt-5" : "mt-5")}>
            {Array.from({ length: rows }).map((_, index) => (
                <div key={index} className="border border-[#00ff41]/10 bg-black/50 p-4 animate-pulse">
                    <div className="h-3 w-28 bg-[#00ff41]/8" />
                    <div className="mt-3 h-3 w-48 bg-[#00ff41]/6" />
                </div>
            ))}
        </div>
    );
}

function formatSignedCurrency(value: number) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${formatCurrency(value)}`;
}

function formatSignedPercent(value: number) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
}

function formatTokenAmount(value: number) {
    if (!Number.isFinite(value)) return "—";
    if (value >= 1_000_000) return formatNumber(value);
    if (value >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
    return value.toLocaleString("en-US", { maximumFractionDigits: 8 });
}
