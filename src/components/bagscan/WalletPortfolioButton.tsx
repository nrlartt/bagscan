"use client";

import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
    ChevronDown,
    Copy,
    ExternalLink,
    Layers,
    LogOut,
    RefreshCw,
    Sparkles,
    TrendingDown,
    TrendingUp,
    Wallet,
} from "lucide-react";
import { fetchPortfolio } from "@/lib/portfolio/client";
import type { PortfolioResponse } from "@/lib/portfolio/types";
import { cn, copyToClipboard, formatCurrency, formatNumber, shortenAddress } from "@/lib/utils";

export function WalletPortfolioButton() {
    const { publicKey, connected, disconnect } = useWallet();
    const { setVisible } = useWalletModal();
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const walletAddress = publicKey?.toBase58() ?? "";

    const portfolioQuery = useQuery<PortfolioResponse>({
        queryKey: ["wallet-portfolio-popover", walletAddress],
        enabled: connected && open && Boolean(walletAddress),
        queryFn: () => fetchPortfolio(walletAddress),
        staleTime: 20_000,
        refetchInterval: open ? 45_000 : false,
        refetchOnWindowFocus: false,
    });

    const portfolio = portfolioQuery.data;
    const summary = portfolio?.summary;
    const holdingsPreview = portfolio?.holdings.slice(0, 4) ?? [];
    const claimablePreview = portfolio?.claimablePositions.slice(0, 3) ?? [];
    const pnlPositive = (summary?.totalUnrealizedPnlUsd ?? 0) >= 0;

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [open]);

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), 1400);
        return () => window.clearTimeout(timer);
    }, [copied]);

    if (!connected || !walletAddress) {
        return (
            <button
                type="button"
                onClick={() => setVisible(true)}
                className="inline-flex h-9 items-center gap-2 border-2 border-[#00ff41]/40 bg-black/80 px-3 text-[10px] tracking-[0.14em] text-[#00ff41] transition-all hover:border-[#00ff41]/70 hover:bg-[#00ff41]/8 hover:shadow-[0_0_12px_rgba(0,255,65,0.1),inset_0_0_12px_rgba(0,255,65,0.03)]"
            >
                <Wallet className="h-3.5 w-3.5" />
                CONNECT WALLET
            </button>
        );
    }

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className={cn(
                    "group inline-flex h-9 items-center gap-2.5 border-2 px-3 text-[#00ff41] transition-all",
                    open
                        ? "border-[#00ff41]/70 bg-[#00ff41]/10 shadow-[0_0_18px_rgba(0,255,65,0.12)]"
                        : "border-[#00ff41]/40 bg-black/80 hover:border-[#00ff41]/70 hover:bg-[#00ff41]/8 hover:shadow-[0_0_12px_rgba(0,255,65,0.1)]"
                )}
                aria-expanded={open}
                aria-haspopup="dialog"
            >
                <span className="h-2 w-2 rounded-full bg-[#00ff41] shadow-[0_0_12px_rgba(0,255,65,0.9)]" />
                <span className="hidden text-left sm:flex sm:flex-col">
                    <span className="text-[8px] tracking-[0.22em] text-[#00ff41]/45">WALLET</span>
                    <span className="text-[10px] tracking-[0.16em] text-[#d8ffe6]">
                        {shortenAddress(walletAddress, 5)}
                    </span>
                </span>
                <span className="text-[10px] tracking-[0.16em] text-[#d8ffe6] sm:hidden">
                    {shortenAddress(walletAddress, 4)}
                </span>
                <ChevronDown
                    className={cn(
                        "h-3.5 w-3.5 text-[#00ff41]/70 transition-transform duration-200",
                        open && "rotate-180"
                    )}
                />
            </button>

            {open ? (
                <>
                    <button
                        type="button"
                        aria-label="Close wallet portfolio"
                        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px] sm:hidden"
                        onClick={() => setOpen(false)}
                    />

                    <div className="fixed inset-x-3 top-[4.5rem] z-50 max-h-[calc(100vh-6rem)] overflow-y-auto border border-[#00ff41]/20 bg-[#03140b]/95 shadow-[0_30px_90px_rgba(0,0,0,0.55),0_0_40px_rgba(0,255,65,0.08)] backdrop-blur-xl sm:absolute sm:right-0 sm:left-auto sm:top-[calc(100%+14px)] sm:w-[680px] sm:max-w-[92vw] sm:max-h-[80vh]">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,255,65,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(0,170,255,0.12),transparent_38%)]" />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_24%),repeating-linear-gradient(180deg,rgba(0,255,65,0.05)_0,rgba(0,255,65,0.05)_1px,transparent_1px,transparent_4px)] opacity-40" />

                        <div className="relative">
                            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#00ff41]/12 px-4 py-4 sm:px-5">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#00ff41]/58">
                                        <Wallet className="h-3.5 w-3.5" />
                                        Connected Portfolio
                                    </div>
                                    <h3 className="mt-2 text-xl tracking-[0.16em] text-[#d8ffe6]">
                                        WALLET TERMINAL
                                    </h3>
                                    <p className="mt-2 text-[11px] tracking-[0.18em] text-[#9dffb8]/70">
                                        {walletAddress}
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => portfolioQuery.refetch()}
                                        disabled={portfolioQuery.isFetching}
                                        className="inline-flex h-9 items-center gap-2 border border-[#00ff41]/16 bg-[#00ff41]/8 px-3 text-[10px] tracking-[0.16em] text-[#9dffb8] transition-all hover:bg-[#00ff41]/14 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <RefreshCw className={cn("h-3.5 w-3.5", portfolioQuery.isFetching && "animate-spin")} />
                                        REFRESH
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const success = await copyToClipboard(walletAddress);
                                            if (success) setCopied(true);
                                        }}
                                        className="inline-flex h-9 items-center gap-2 border border-white/10 bg-white/[0.04] px-3 text-[10px] tracking-[0.16em] text-white/70 transition-all hover:border-white/18 hover:bg-white/[0.08]"
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                        {copied ? "COPIED" : "COPY"}
                                    </button>
                                    <Link
                                        href={`https://solscan.io/account/${walletAddress}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex h-9 items-center gap-2 border border-[#00aaff]/16 bg-[#00aaff]/8 px-3 text-[10px] tracking-[0.16em] text-[#8dd8ff] transition-all hover:bg-[#00aaff]/14"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        EXPLORER
                                    </Link>
                                </div>
                            </div>

                            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4">
                                <CompactStat
                                    label="Total Value"
                                    value={summary ? formatCurrency(summary.totalValueUsd) : "--"}
                                    hint={summary ? `${formatNumber(summary.holdingsCount, false)} holdings` : "Waiting for scan"}
                                    tone="emerald"
                                />
                                <CompactStat
                                    label="Unrealized PnL"
                                    value={summary ? formatSignedCurrency(summary.totalUnrealizedPnlUsd) : "--"}
                                    hint={summary ? formatSignedPercent(summary.totalUnrealizedPnlPercent) : "Average-cost basis"}
                                    tone={pnlPositive ? "emerald" : "rose"}
                                    icon={pnlPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                />
                                <CompactStat
                                    label="Claimable Fees"
                                    value={summary ? `${summary.claimableFeesSol.toFixed(4)} SOL` : "--"}
                                    hint={summary ? formatCurrency(summary.claimableFeesUsd) : "Bags positions"}
                                    tone="amber"
                                    icon={<Layers className="h-3.5 w-3.5" />}
                                />
                                <CompactStat
                                    label="Coverage"
                                    value={
                                        portfolio?.costBasis
                                            ? portfolio.costBasis.historyComplete
                                                ? "FULL"
                                                : "PARTIAL"
                                            : "--"
                                    }
                                    hint={
                                        portfolio?.costBasis
                                            ? `${formatNumber(portfolio.costBasis.transactionsScanned, false)} tx scanned`
                                            : "Transaction history"
                                    }
                                    tone="blue"
                                    icon={<Sparkles className="h-3.5 w-3.5" />}
                                />
                            </div>

                            <div className="grid gap-5 border-t border-[#00ff41]/12 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1.18fr)_minmax(230px,0.82fr)]">
                                <div>
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff41]/52">
                                                Holdings Preview
                                            </p>
                                            <h4 className="mt-1 text-sm tracking-[0.16em] text-[#d8ffe6]">
                                                LIVE POSITIONS
                                            </h4>
                                        </div>
                                        {portfolio?.costBasis ? (
                                            <span
                                                className={cn(
                                                    "inline-flex items-center gap-2 border px-2 py-1 text-[9px] tracking-[0.18em]",
                                                    portfolio.costBasis.historyComplete
                                                        ? "border-[#00ff41]/16 bg-[#00ff41]/8 text-[#9dffb8]"
                                                        : "border-[#ffaa00]/20 bg-[#ffaa00]/10 text-[#ffd37a]"
                                                )}
                                            >
                                                {portfolio.costBasis.historyComplete ? "FULL HISTORY" : "PARTIAL HISTORY"}
                                            </span>
                                        ) : null}
                                    </div>

                                    {!portfolio && portfolioQuery.isLoading ? (
                                        <div className="mt-4 space-y-3">
                                            {Array.from({ length: 4 }).map((_, index) => (
                                                <div key={index} className="animate-pulse border border-[#00ff41]/10 bg-black/45 p-3">
                                                    <div className="h-3 w-28 bg-[#00ff41]/10" />
                                                    <div className="mt-3 h-3 w-44 bg-[#00ff41]/8" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : portfolioQuery.isError ? (
                                        <div className="mt-4 border border-[#ff8f70]/20 bg-[#ff8f70]/8 p-4 text-sm leading-6 text-[#ffb39f]">
                                            {portfolioQuery.error instanceof Error
                                                ? portfolioQuery.error.message
                                                : "Portfolio preview failed to load."}
                                        </div>
                                    ) : holdingsPreview.length === 0 ? (
                                        <div className="mt-4 border border-[#00ff41]/10 bg-black/45 p-4 text-sm leading-6 text-[#00ff41]/42">
                                            No fungible positions found for this wallet yet.
                                        </div>
                                    ) : (
                                        <div className="mt-4 space-y-3">
                                            {holdingsPreview.map((holding) => (
                                                <PreviewHoldingRow
                                                    key={`${holding.mint}-${holding.tokenAccount}`}
                                                    holding={holding}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff41]/52">
                                            Fee Share
                                        </p>
                                        <h4 className="mt-1 text-sm tracking-[0.16em] text-[#d8ffe6]">
                                            CLAIMABLE BAGS
                                        </h4>
                                    </div>

                                    {!portfolio && portfolioQuery.isLoading ? (
                                        <div className="space-y-3">
                                            {Array.from({ length: 3 }).map((_, index) => (
                                                <div key={index} className="animate-pulse border border-[#00ff41]/10 bg-black/45 p-3">
                                                    <div className="h-3 w-24 bg-[#00ff41]/10" />
                                                    <div className="mt-3 h-3 w-32 bg-[#00ff41]/8" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : claimablePreview.length === 0 ? (
                                        <div className="border border-[#00ff41]/10 bg-black/45 p-4 text-sm leading-6 text-[#00ff41]/42">
                                            No claimable Bags fee-share positions are available right now.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {claimablePreview.map((position) => (
                                                <PreviewClaimableRow
                                                    key={`${position.baseMint}-${position.userBps ?? position.claimableSol}`}
                                                    position={position}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    <div className="border border-white/10 bg-white/[0.03] p-4">
                                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/46">
                                            Current Wallet
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-[#d8ffe6]/76">
                                            Quick portfolio view now lives directly behind the wallet address. Open the full page any time for deeper scanning.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#00ff41]/12 px-4 py-4 sm:px-5">
                                <div className="text-[10px] uppercase tracking-[0.2em] text-[#00ff41]/42">
                                    Click the connected wallet address to reopen this panel
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Link
                                        href="/portfolio"
                                        onClick={() => setOpen(false)}
                                        className="inline-flex h-9 items-center gap-2 border border-[#00ff41]/16 bg-[#00ff41]/8 px-3 text-[10px] tracking-[0.16em] text-[#9dffb8] transition-all hover:bg-[#00ff41]/14"
                                    >
                                        OPEN FULL PORTFOLIO
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOpen(false);
                                            setVisible(true);
                                        }}
                                        className="inline-flex h-9 items-center gap-2 border border-[#00aaff]/16 bg-[#00aaff]/8 px-3 text-[10px] tracking-[0.16em] text-[#8dd8ff] transition-all hover:bg-[#00aaff]/14"
                                    >
                                        SWITCH WALLET
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            setOpen(false);
                                            try {
                                                await disconnect();
                                            } catch {
                                                // Keep the UI responsive even if the wallet adapter rejects disconnect.
                                            }
                                        }}
                                        className="inline-flex h-9 items-center gap-2 border border-[#ff8f70]/20 bg-[#ff8f70]/10 px-3 text-[10px] tracking-[0.16em] text-[#ffb39f] transition-all hover:bg-[#ff8f70]/16"
                                    >
                                        <LogOut className="h-3.5 w-3.5" />
                                        DISCONNECT
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}

function CompactStat({
    label,
    value,
    hint,
    tone,
    icon,
}: {
    label: string;
    value: string;
    hint: string;
    tone: "emerald" | "rose" | "amber" | "blue";
    icon?: ReactNode;
}) {
    const toneClass = {
        emerald: "text-[#9dffb8] border-[#00ff41]/14 bg-[#00ff41]/8",
        rose: "text-[#ffb39f] border-[#ff8f70]/16 bg-[#ff8f70]/10",
        amber: "text-[#ffd37a] border-[#ffaa00]/16 bg-[#ffaa00]/10",
        blue: "text-[#8dd8ff] border-[#00aaff]/16 bg-[#00aaff]/10",
    }[tone];

    return (
        <div className={cn("border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]", toneClass)}>
            <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/46">{label}</span>
                {icon ? <span className="opacity-85">{icon}</span> : null}
            </div>
            <p className="mt-3 text-xl tracking-[0.08em] text-[#f3fff6]">{value}</p>
            <p className="mt-2 text-[11px] leading-5 text-white/46">{hint}</p>
        </div>
    );
}

function PreviewHoldingRow({ holding }: { holding: PortfolioResponse["holdings"][number] }) {
    const pnlPositive = (holding.unrealizedPnlUsd ?? 0) >= 0;

    return (
        <Link
            href={`/token/${holding.mint}`}
            className="group flex items-center gap-3 border border-[#00ff41]/10 bg-black/45 p-3 transition-all hover:border-[#00ff41]/22 hover:bg-[#00ff41]/[0.03]"
        >
            <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden border border-[#00ff41]/15 bg-black/40">
                {holding.image ? (
                    <Image
                        src={holding.image}
                        alt={holding.symbol ?? holding.name ?? holding.mint}
                        fill
                        className="object-cover"
                        unoptimized
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-[#00ff41]/35">
                        {(holding.symbol ?? holding.name ?? "?").charAt(0)}
                    </div>
                )}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-sm tracking-[0.1em] text-[#d8ffe6]">
                        {holding.symbol ? `$${holding.symbol}` : shortenAddress(holding.mint)}
                    </p>
                    <span
                        className={cn(
                            "border px-1.5 py-0.5 text-[9px] tracking-[0.18em]",
                            holding.costBasisStatus === "complete" && "border-[#00ff41]/18 bg-[#00ff41]/8 text-[#9dffb8]",
                            holding.costBasisStatus === "partial" && "border-[#ffaa00]/20 bg-[#ffaa00]/10 text-[#ffd37a]",
                            holding.costBasisStatus === "unknown" && "border-white/10 bg-white/[0.03] text-white/55"
                        )}
                    >
                        {holding.costBasisStatus.toUpperCase()}
                    </span>
                </div>
                <p className="mt-1 text-[11px] tracking-[0.16em] text-[#00ff41]/42">
                    {formatTokenAmount(holding.amount)} tokens
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] tracking-[0.16em]">
                    <span className="text-white/52">
                        Value {holding.valueUsd !== undefined ? formatCurrency(holding.valueUsd) : "--"}
                    </span>
                    <span className={pnlPositive ? "text-[#9dffb8]" : "text-[#ff8f70]"}>
                        PnL {holding.unrealizedPnlUsd !== undefined ? formatSignedCurrency(holding.unrealizedPnlUsd) : "--"}
                    </span>
                </div>
            </div>
        </Link>
    );
}

function PreviewClaimableRow({
    position,
}: {
    position: PortfolioResponse["claimablePositions"][number];
}) {
    return (
        <Link
            href={`/token/${position.baseMint}`}
            className="group flex items-center gap-3 border border-[#00ff41]/10 bg-black/45 p-3 transition-all hover:border-[#00ff41]/22 hover:bg-[#00ff41]/[0.03]"
        >
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden border border-[#00ff41]/15 bg-black/40">
                {position.image ? (
                    <Image
                        src={position.image}
                        alt={position.symbol ?? position.name ?? position.baseMint}
                        fill
                        className="object-cover"
                        unoptimized
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-[#00ff41]/35">
                        {(position.symbol ?? position.name ?? "?").charAt(0)}
                    </div>
                )}
            </div>

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm tracking-[0.1em] text-[#d8ffe6]">
                    {position.symbol ? `$${position.symbol}` : shortenAddress(position.baseMint)}
                </p>
                <p className="mt-1 text-[11px] tracking-[0.16em] text-[#00ff41]/42">
                    {position.userBps ? `${(position.userBps / 100).toFixed(2)}% share` : "Fee-share position"}
                </p>
            </div>

            <div className="text-right">
                <p className="text-sm tracking-[0.08em] text-[#ffd37a]">
                    {position.claimableSol.toFixed(4)} SOL
                </p>
                <p className="mt-1 text-[10px] tracking-[0.16em] text-[#ffd37a]/60">
                    {formatCurrency(position.claimableUsd)}
                </p>
            </div>
        </Link>
    );
}

function formatSignedCurrency(value: number | undefined) {
    if (value === undefined || !Number.isFinite(value)) return "--";
    const sign = value > 0 ? "+" : "";
    return `${sign}${formatCurrency(value)}`;
}

function formatSignedPercent(value: number | undefined) {
    if (value === undefined || !Number.isFinite(value)) return "--";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
}

function formatTokenAmount(value: number) {
    if (!Number.isFinite(value)) return "--";
    if (value >= 1_000_000) return formatNumber(value);
    if (value >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
    return value.toLocaleString("en-US", { maximumFractionDigits: 8 });
}
