"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import {
    ArrowUpRight,
    Check,
    Coins,
    Copy,
    DollarSign,
    RefreshCw,
    Search,
    Share2,
    TrendingUp,
    Wallet,
} from "lucide-react";
import { cn, copyToClipboard, formatCurrency, formatNumber, shortenAddress } from "@/lib/utils";
import { fetchPortfolio } from "@/lib/portfolio/client";
import type { PortfolioResponse } from "@/lib/portfolio/types";
import { SOL_MINT } from "@/lib/solana";

/** Pump-style accent — high-contrast mint on dark. */
const ACCENT = "#53ffb2";
const ACCENT_MUTED = "rgba(83,255,178,0.45)";

type PortfolioTab = "balances" | "rewards";

export default function PortfolioPage() {
    const { publicKey, connected } = useWallet();
    const { setVisible } = useWalletModal();
    const [walletInput, setWalletInput] = useState("");
    const [tab, setTab] = useState<PortfolioTab>("balances");
    const [holdingSearch, setHoldingSearch] = useState("");
    const [hideDust, setHideDust] = useState(true);
    const [copiedAddr, setCopiedAddr] = useState(false);
    const [copiedShare, setCopiedShare] = useState(false);

    const connectedWallet = publicKey?.toBase58() ?? "";
    const trackedWallet = walletInput.trim() || connectedWallet;
    const deferredWallet = useDeferredValue(trackedWallet);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const q = new URLSearchParams(window.location.search).get("wallet");
        if (q?.trim()) setWalletInput(q.trim());
    }, []);

    const walletError = useMemo(() => {
        if (!deferredWallet) return null;
        try {
            new PublicKey(deferredWallet);
            return null;
        } catch {
            return "INVALID SOLANA WALLET ADDRESS";
        }
    }, [deferredWallet]);

    const portfolioQuery = useQuery({
        queryKey: ["portfolio", deferredWallet],
        enabled: Boolean(deferredWallet) && !walletError,
        queryFn: () => fetchPortfolio(deferredWallet),
        staleTime: 20_000,
        refetchInterval: 45_000,
    });

    const portfolio = portfolioQuery.data;
    const summary = portfolio?.summary;

    const topHolding = useMemo(() => {
        if (!portfolio?.holdings.length || !summary?.totalValueUsd) return null;
        const h = portfolio.holdings[0];
        const v = h.valueUsd ?? 0;
        if (v <= 0) return null;
        const pct = (v / summary.totalValueUsd) * 100;
        return { holding: h, pct };
    }, [portfolio, summary]);

    const dataSinceLabel = useMemo(() => formatDataSince(portfolio?.costBasis.oldestTimestamp), [portfolio]);

    const visibleHoldings = useMemo(() => {
        let list = portfolio?.holdings ?? [];
        if (hideDust) list = list.filter((h) => (h.valueUsd ?? 0) >= 0.01);
        const q = holdingSearch.trim().toLowerCase();
        if (q) {
            list = list.filter(
                (h) =>
                    h.mint.toLowerCase().includes(q) ||
                    (h.symbol?.toLowerCase().includes(q) ?? false) ||
                    (h.name?.toLowerCase().includes(q) ?? false)
            );
        }
        return list;
    }, [portfolio, hideDust, holdingSearch]);

    async function handleCopyAddress() {
        if (!deferredWallet) return;
        const ok = await copyToClipboard(deferredWallet);
        if (ok) {
            setCopiedAddr(true);
            window.setTimeout(() => setCopiedAddr(false), 1500);
        }
    }

    async function handleShare() {
        if (!deferredWallet || typeof window === "undefined") return;
        const url = `${window.location.origin}/portfolio?wallet=${encodeURIComponent(deferredWallet)}`;
        const ok = await copyToClipboard(url);
        if (ok) {
            setCopiedShare(true);
            window.setTimeout(() => setCopiedShare(false), 1500);
        }
    }

    const displayName = deferredWallet ? shortenAddress(deferredWallet, 5) : "WALLET";

    return (
        <div className="mx-auto w-full min-w-0 max-w-[1200px] px-2 py-4 sm:px-5 lg:px-8">
            <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#12141a] shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:rounded-2xl">
                <div className="border-b border-white/[0.06] p-4 sm:p-7">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                            <div
                                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[#1a2030] to-[#0e1014] text-xl font-semibold text-white/80"
                                style={{ boxShadow: `0 0 0 2px ${ACCENT}33` }}
                            >
                                {deferredWallet ? deferredWallet.slice(-2).toUpperCase() : "?"}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
                                    {displayName}
                                </h1>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {deferredWallet ? (
                                        <>
                                            <span className="truncate font-mono text-[11px] text-white/40 sm:text-xs">
                                                {shortenAddress(deferredWallet, 8)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => void handleCopyAddress()}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/45 transition-colors hover:border-white/20 hover:text-white"
                                                aria-label="Copy address"
                                                style={{ color: ACCENT_MUTED }}
                                            >
                                                {copiedAddr ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                            </button>
                                        </>
                                    ) : (
                                        <span className="text-xs text-white/35">Connect or paste a wallet to load balances</span>
                                    )}
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void handleShare()}
                                        disabled={!deferredWallet}
                                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/[0.08] disabled:opacity-35 sm:min-h-0 sm:px-4 sm:text-xs"
                                    >
                                        <Share2 className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{copiedShare ? "LINK COPIED" : "SHARE"}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => portfolioQuery.refetch()}
                                        disabled={!deferredWallet || Boolean(walletError) || portfolioQuery.isFetching}
                                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-3 py-2 text-[11px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40 sm:min-h-0 sm:px-4 sm:text-xs"
                                        style={{ backgroundColor: ACCENT }}
                                    >
                                        <RefreshCw className={cn("h-3.5 w-3.5 shrink-0", portfolioQuery.isFetching && "animate-spin")} />
                                        REFRESH
                                    </button>
                                    {!connected ? (
                                        <button
                                            type="button"
                                            onClick={() => setVisible(true)}
                                            className="col-span-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/15 px-3 py-2 text-[11px] font-medium text-white/70 hover:bg-white/[0.05] sm:col-span-1 sm:min-h-0 sm:px-4 sm:text-xs"
                                        >
                                            <Wallet className="h-3.5 w-3.5 shrink-0" />
                                            CONNECT
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setWalletInput("")}
                                            className="col-span-2 inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/10 px-3 py-2 text-[11px] text-white/50 hover:text-white/75 sm:col-span-1 sm:min-h-0 sm:px-4 sm:text-xs"
                                        >
                                            USE CONNECTED
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="w-full shrink-0 lg:max-w-sm">
                            <label className="text-[10px] font-medium uppercase tracking-wider text-white/35">Track wallet</label>
                            <input
                                value={walletInput}
                                onChange={(e) => setWalletInput(e.target.value)}
                                placeholder={connectedWallet || "Paste Solana address"}
                                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[#53ffb2]/40 focus:outline-none focus:ring-1 focus:ring-[#53ffb2]/25"
                            />
                            {walletError ? (
                                <p className="mt-2 text-xs text-red-400/90">{walletError}</p>
                            ) : deferredWallet ? (
                                <p className="mt-2 text-[10px] text-white/30">Indexing Bags-relevant pairs and cost basis…</p>
                            ) : null}
                        </div>
                    </div>

                    <div className="mt-6 flex gap-1 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
                        {(
                            [
                                { id: "balances" as const, label: "Wallet" },
                                { id: "rewards" as const, label: "Creator rewards" },
                            ] as const
                        ).map(({ id, label }) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setTab(id)}
                                className={cn(
                                    "shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                                    tab === id ? "text-black" : "text-white/45 hover:text-white/70"
                                )}
                                style={
                                    tab === id
                                        ? { backgroundColor: ACCENT }
                                        : { backgroundColor: "rgba(255,255,255,0.06)" }
                                }
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 sm:p-7">
                    {!deferredWallet ? (
                        <EmptyState message="Connect a wallet or paste a public address to see your portfolio." />
                    ) : tab === "rewards" ? (
                        <CreatorRewardsPanel portfolio={portfolio} portfolioQuery={portfolioQuery} />
                    ) : (
                        <>
                            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <PumpStatCard
                                    label="Total value"
                                    value={summary ? formatCurrency(summary.totalValueUsd) : "—"}
                                    sub={summary ? `${formatNumber(summary.pricedHoldingsCount, false)} priced · SOL incl.` : "Live scan"}
                                    icon={<DollarSign className="h-4 w-4" />}
                                />
                                <PumpStatCard
                                    label="Top holding"
                                    value={
                                        topHolding
                                            ? topHolding.holding.symbol
                                                ? `$${topHolding.holding.symbol}`
                                                : shortenAddress(topHolding.holding.mint, 4)
                                            : "—"
                                    }
                                    sub={
                                        topHolding
                                            ? `${topHolding.pct.toFixed(1)}% of wallet · ${formatCurrency(topHolding.holding.valueUsd ?? 0)}`
                                            : "No positions yet"
                                    }
                                    icon={<TrendingUp className="h-4 w-4" />}
                                />
                                <PumpStatCard
                                    label="Coins"
                                    value={summary ? String(summary.holdingsCount) : "—"}
                                    sub={summary ? `${formatNumber(summary.costBasisCompleteHoldingsCount, false)} full basis` : "—"}
                                    icon={<Coins className="h-4 w-4" />}
                                />
                                <PumpStatCard
                                    label="On-chain data"
                                    value={dataSinceLabel}
                                    sub="Oldest tx in basis window"
                                    icon={<Wallet className="h-4 w-4" />}
                                />
                            </div>

                            <div className="mt-8 grid min-w-0 gap-6 xl:grid-cols-[1fr_minmax(260px,320px)] xl:items-start">
                                <div className="min-w-0">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-base font-semibold text-white">Balances</h2>
                                                {summary ? (
                                                    <span
                                                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-black"
                                                        style={{ backgroundColor: ACCENT }}
                                                    >
                                                        {holdingSearch.trim() || hideDust
                                                            ? `${visibleHoldings.length}/${portfolio?.holdings.length ?? 0}`
                                                            : visibleHoldings.length}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="mt-0.5 text-xs text-white/40">Coin balances on this wallet</p>
                                        </div>
                                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                            <div className="relative min-h-[44px] w-full sm:min-h-0 sm:max-w-[220px]">
                                                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
                                                <input
                                                    value={holdingSearch}
                                                    onChange={(e) => setHoldingSearch(e.target.value)}
                                                    placeholder="Search holdings…"
                                                    className="w-full rounded-full border border-white/10 bg-black/35 py-2.5 pl-8 pr-3 text-xs text-white placeholder:text-white/25 focus:border-[#53ffb2]/35 focus:outline-none"
                                                />
                                            </div>
                                            <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-[11px] text-white/45">
                                                <input
                                                    type="checkbox"
                                                    checked={hideDust}
                                                    onChange={(e) => setHideDust(e.target.checked)}
                                                    className="rounded border-white/20 bg-black/40"
                                                />
                                                Hide &lt; $0.01
                                            </label>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                    {!deferredWallet ? null : portfolioQuery.isLoading ? (
                                        <LoadingTable />
                                    ) : portfolioQuery.isError ? (
                                        <EmptyState
                                            tone="error"
                                            message={
                                                portfolioQuery.error instanceof Error
                                                    ? portfolioQuery.error.message
                                                    : "Portfolio failed to load."
                                            }
                                        />
                                    ) : portfolio && portfolio.holdings.length === 0 ? (
                                        <EmptyState message="No fungible token holdings found for this wallet." />
                                    ) : (
                                        <>
                                            <div className="space-y-2 sm:hidden">
                                                {summary && summary.solBalance > 0 ? (
                                                    <SolMobileCard solBalance={summary.solBalance} solValueUsd={summary.solValueUsd} />
                                                ) : null}
                                                {visibleHoldings.map((holding) => (
                                                    <HoldingMobileCard key={`m-${holding.mint}-${holding.tokenAccount}`} holding={holding} />
                                                ))}
                                            </div>
                                            <div className="hidden overflow-hidden rounded-xl border border-white/[0.06] bg-[#0c0e12] sm:block">
                                            <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                                                <table className="w-full min-w-[520px] text-left text-xs lg:min-w-[640px]">
                                                    <thead>
                                                        <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-white/35">
                                                            <th className="px-4 py-3 font-medium">Coin</th>
                                                            <th className="px-4 py-3 font-medium text-right">Value</th>
                                                            <th className="px-4 py-3 text-right font-medium">MC</th>
                                                            <th className="px-4 py-3 font-medium text-right">PnL</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/[0.04]">
                                                        {summary && summary.solBalance > 0 ? (
                                                            <SolBalanceRow solBalance={summary.solBalance} solValueUsd={summary.solValueUsd} />
                                                        ) : null}
                                                        {visibleHoldings.map((holding) => (
                                                            <HoldingTableRow key={`${holding.mint}-${holding.tokenAccount}`} holding={holding} />
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        </>
                                    )}
                                    </div>
                                </div>

                                <aside className="min-w-0 space-y-3 rounded-xl border border-white/[0.06] bg-[#141820] p-3 sm:p-4">
                                    <h3 className="text-sm font-semibold text-white">Creator rewards</h3>
                                    <p className="text-[11px] leading-relaxed text-white/40">
                                        Bags fee-share positions for this wallet (claim on Bags).
                                    </p>
                                    {!deferredWallet || portfolioQuery.isLoading ? (
                                        <div className="space-y-2 pt-2">
                                            {Array.from({ length: 3 }).map((_, i) => (
                                                <div key={i} className="h-14 animate-pulse rounded-lg bg-white/[0.04]" />
                                            ))}
                                        </div>
                                    ) : portfolioQuery.isError ? (
                                        <p className="text-xs text-red-400/80">Could not load rewards.</p>
                                    ) : !portfolio?.claimablePositions.length ? (
                                        <p className="text-xs text-white/35">No claimable fee positions found.</p>
                                    ) : (
                                        <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                                            {portfolio.claimablePositions.map((position) => (
                                                <li key={`${position.baseMint}-${position.userBps ?? "c"}`}>
                                                    <Link
                                                        href={`/token/${position.baseMint}`}
                                                        className="flex items-center gap-3 rounded-xl border border-transparent bg-black/25 p-2.5 transition-colors hover:border-[#53ffb2]/25 hover:bg-black/40"
                                                    >
                                                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/50">
                                                            {position.image ? (
                                                                <Image
                                                                    src={position.image}
                                                                    alt=""
                                                                    fill
                                                                    className="object-cover"
                                                                    unoptimized
                                                                />
                                                            ) : (
                                                                <span className="flex h-full w-full items-center justify-center text-xs text-white/30">
                                                                    {(position.symbol ?? "?").charAt(0)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-xs font-medium text-white">
                                                                {position.name ?? position.symbol ?? shortenAddress(position.baseMint, 4)}
                                                            </p>
                                                            <p className="text-[10px] text-[#53ffb2]/70">
                                                                {formatCurrency(position.claimableUsd)}
                                                            </p>
                                                        </div>
                                                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-white/20" />
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </aside>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function formatDataSince(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const diff = Date.now() - d.getTime();
    if (diff < 0) return "—";
    const day = 86400000;
    const days = Math.floor(diff / day);
    if (days < 1) return "24h";
    if (days < 30) return `${days}d`;
    const mo = Math.floor(days / 30);
    if (mo < 12) return `${mo}mo`;
    return `${Math.floor(days / 365)}y`;
}

function SolMobileCard({ solBalance, solValueUsd }: { solBalance: number; solValueUsd: number }) {
    return (
        <Link
            href={`/token/${SOL_MINT}`}
            className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-black/25 p-3 active:bg-black/40"
        >
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-indigo-600/30 text-sm font-bold text-white/90">
                    ◎
                </div>
                <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">Solana</p>
                    <p className="text-[10px] text-white/40">SOL</p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-white/25" />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3 text-[10px]">
                <div>
                    <p className="text-white/35">Value</p>
                    <p className="mt-0.5 font-medium tabular-nums text-white">{formatCurrency(solValueUsd)}</p>
                </div>
                <div className="text-right">
                    <p className="text-white/35">Balance</p>
                    <p className="mt-0.5 font-medium tabular-nums text-white/85">{solBalance.toFixed(4)} SOL</p>
                </div>
            </div>
        </Link>
    );
}

function HoldingMobileCard({ holding }: { holding: PortfolioResponse["holdings"][number] }) {
    const pnl = holding.unrealizedPnlUsd;
    const pnlOk = pnl !== undefined && Number.isFinite(pnl);
    const pnlPositive = (pnl ?? 0) >= 0;

    return (
        <Link
            href={`/token/${holding.mint}`}
            className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-black/25 p-3 active:bg-black/40"
        >
            <div className="flex items-center gap-3">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/50">
                    {holding.image ? (
                        <Image src={holding.image} alt="" fill className="object-cover" unoptimized />
                    ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm text-white/30">
                            {(holding.symbol ?? "?").charAt(0)}
                        </span>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">
                        {holding.name ?? shortenAddress(holding.mint, 4)}
                    </p>
                    <p className="text-[10px] text-white/40">
                        {holding.symbol ? `$${holding.symbol}` : shortenAddress(holding.mint, 4)}
                    </p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-white/25" />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3 text-[10px]">
                <div>
                    <p className="text-white/35">Value</p>
                    <p className="mt-0.5 font-medium tabular-nums text-white">
                        {holding.valueUsd !== undefined ? formatCurrency(holding.valueUsd) : "—"}
                    </p>
                    <p className="mt-0.5 text-[9px] tabular-nums text-white/30">{formatTokenAmount(holding.amount)}</p>
                </div>
                <div className="text-right">
                    <p className="text-white/35">PnL</p>
                    <p
                        className={cn(
                            "mt-0.5 font-medium tabular-nums",
                            !pnlOk && "text-white/25",
                            pnlOk && pnlPositive && "text-[#53ffb2]",
                            pnlOk && !pnlPositive && "text-[#ff6b6b]"
                        )}
                    >
                        {pnlOk ? formatSignedCurrency(pnl) : "—"}
                    </p>
                </div>
                <div className="col-span-2 border-t border-white/[0.04] pt-3">
                    <p className="text-white/35">MC</p>
                    <p className="mt-0.5 tabular-nums text-white/75">
                        {holding.marketCapUsd !== undefined ? formatCurrency(holding.marketCapUsd) : "—"}
                    </p>
                </div>
            </div>
        </Link>
    );
}

function SolBalanceRow({ solBalance, solValueUsd }: { solBalance: number; solValueUsd: number }) {
    return (
        <tr className="transition-colors hover:bg-white/[0.02]">
            <td className="px-4 py-3">
                <Link href={`/token/${SOL_MINT}`} className="group flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-indigo-600/30 text-xs font-bold text-white/90">
                        ◎
                    </div>
                    <div className="min-w-0">
                        <p className="font-medium text-white group-hover:text-[#53ffb2]">Solana</p>
                        <p className="text-[10px] text-white/35">SOL</p>
                    </div>
                </Link>
            </td>
            <td className="px-4 py-3 text-right">
                <p className="font-medium tabular-nums text-white">{formatCurrency(solValueUsd)}</p>
                <p className="text-[10px] tabular-nums text-white/35">{solBalance.toFixed(4)} SOL</p>
            </td>
            <td className="px-4 py-3 text-right text-white/25">—</td>
            <td className="px-4 py-3 text-right text-white/25">—</td>
        </tr>
    );
}

function HoldingTableRow({ holding }: { holding: PortfolioResponse["holdings"][number] }) {
    const pnl = holding.unrealizedPnlUsd;
    const pnlOk = pnl !== undefined && Number.isFinite(pnl);
    const pnlPositive = (pnl ?? 0) >= 0;

    return (
        <tr className="transition-colors hover:bg-white/[0.02]">
            <td className="px-4 py-3">
                <Link href={`/token/${holding.mint}`} className="group flex items-center gap-3">
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/50">
                        {holding.image ? (
                            <Image src={holding.image} alt="" fill className="object-cover" unoptimized />
                        ) : (
                            <span className="flex h-full w-full items-center justify-center text-xs text-white/30">
                                {(holding.symbol ?? "?").charAt(0)}
                            </span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate font-medium text-white group-hover:text-[#53ffb2]">
                            {holding.name ?? shortenAddress(holding.mint, 4)}
                        </p>
                        <p className="text-[10px] text-white/40">
                            {holding.symbol ? `$${holding.symbol}` : shortenAddress(holding.mint, 4)}
                        </p>
                    </div>
                </Link>
            </td>
            <td className="px-4 py-3 text-right">
                <p className="font-medium tabular-nums text-white">
                    {holding.valueUsd !== undefined ? formatCurrency(holding.valueUsd) : "—"}
                </p>
                <p className="text-[10px] tabular-nums text-white/35">{formatTokenAmount(holding.amount)}</p>
            </td>
            <td className="px-4 py-3 text-right tabular-nums text-white/60">
                {holding.marketCapUsd !== undefined ? formatCurrency(holding.marketCapUsd) : "—"}
            </td>
            <td
                className={cn(
                    "px-4 py-3 text-right font-medium tabular-nums",
                    !pnlOk && "text-white/25",
                    pnlOk && pnlPositive && "text-[#53ffb2]",
                    pnlOk && !pnlPositive && "text-[#ff6b6b]"
                )}
            >
                {pnlOk ? formatSignedCurrency(pnl) : "—"}
            </td>
        </tr>
    );
}

function CreatorRewardsPanel({
    portfolio,
    portfolioQuery,
}: {
    portfolio: PortfolioResponse | undefined;
    portfolioQuery: {
        isLoading: boolean;
        isError: boolean;
        error: unknown;
    };
}) {
    if (portfolioQuery.isLoading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
                ))}
            </div>

        );
    }
    if (portfolioQuery.isError) {
        return (
            <EmptyState
                tone="error"
                message={portfolioQuery.error instanceof Error ? portfolioQuery.error.message : "Failed to load."}
            />
        );
    }
    if (!portfolio?.claimablePositions.length) {
        return <EmptyState message="No Bags creator reward positions for this wallet." />;
    }
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {portfolio.claimablePositions.map((position) => (
                <Link
                    key={`${position.baseMint}-${position.userBps}`}
                    href={`/token/${position.baseMint}`}
                    className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-[#0c0e12] p-4 transition-colors hover:border-[#53ffb2]/30"
                >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10">
                        {position.image ? (
                            <Image src={position.image} alt="" fill className="object-cover" unoptimized />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm text-white/30">
                                {(position.symbol ?? "?").charAt(0)}
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white">
                            {position.symbol ? `$${position.symbol}` : shortenAddress(position.baseMint, 4)}
                        </p>
                        <p className="text-xs text-white/40">
                            {position.userBps ? `${(position.userBps / 100).toFixed(2)}% share` : "Fee share"}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-semibold text-[#53ffb2]">{position.claimableSol.toFixed(4)} SOL</p>
                        <p className="text-[11px] text-white/45">{formatCurrency(position.claimableUsd)}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-white/25" />
                </Link>
            ))}
        </div>
    );
}

function PumpStatCard({
    label,
    value,
    sub,
    icon,
}: {
    label: string;
    value: string;
    sub: string;
    icon: ReactNode;
}) {
    return (
        <div className="rounded-xl border border-white/[0.06] bg-[#141820] p-4">
            <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</span>
                <span className="text-white/30">{icon}</span>
            </div>
            <p className="mt-3 text-lg font-semibold tracking-tight text-white sm:text-xl">{value}</p>
            <p className="mt-1 text-[11px] leading-snug text-white/38">{sub}</p>
        </div>
    );
}

function EmptyState({ message, tone = "default" }: { message: string; tone?: "default" | "error" }) {
    return (
        <div
            className={cn(
                "flex min-h-[200px] items-center justify-center rounded-xl border border-white/[0.06] bg-[#0c0e12] px-6 py-12 text-center text-sm",
                tone === "error" ? "text-red-400/90" : "text-white/40"
            )}
        >
            {message}
        </div>
    );
}

function LoadingTable() {
    return (
        <div className="space-y-2 rounded-xl border border-white/[0.06] bg-[#0c0e12] p-4">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-4 py-3">
                    <div className="h-9 w-9 animate-pulse rounded-full bg-white/[0.06]" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
                        <div className="h-2 w-16 animate-pulse rounded bg-white/[0.04]" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function formatSignedCurrency(value: number) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${formatCurrency(value)}`;
}

function formatTokenAmount(value: number) {
    if (!Number.isFinite(value)) return "—";
    if (value >= 1_000_000) return formatNumber(value);
    if (value >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
    return value.toLocaleString("en-US", { maximumFractionDigits: 8 });
}
