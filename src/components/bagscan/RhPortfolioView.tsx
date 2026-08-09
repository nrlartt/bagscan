"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Check,
    Copy,
    Coins,
    ExternalLink,
    RefreshCw,
    Search,
    Share2,
    Wallet,
} from "lucide-react";
import {
    cn,
    copyToClipboard,
    formatCompactDecimal,
    formatCurrency,
    formatNumber,
    formatTokenPrice,
    shortenAddress,
} from "@/lib/utils";
import { BAGSCAN_NETWORKS, isEvmAddress } from "@/lib/networks";
import { RemoteFillImage } from "./RemoteFillImage";
import { ErrorState } from "./States";
import { RhBondingBar, rhFormatPct } from "./RhUi";
import { NetworkIcon, RH_THEME } from "./NetworkIcons";
import type { RhPortfolioView as RhPortfolioData } from "@/lib/bags/rh-portfolio";

type RhPortfolioTab = "holdings" | "fees";

interface RhPortfolioApiResponse {
    success: boolean;
    data?: RhPortfolioData;
    error?: string;
}

async function fetchRhPortfolio(owner: string): Promise<RhPortfolioData> {
    const res = await fetch(`/api/rh/portfolio?owner=${encodeURIComponent(owner)}`, {
        cache: "no-store",
    });
    const payload = (await res.json()) as RhPortfolioApiResponse;
    if (!res.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Failed to load Robinhood portfolio");
    }
    return payload.data;
}

function StatCard({
    label,
    value,
    sub,
    accent,
}: {
    label: string;
    value: string;
    sub?: string;
    accent?: boolean;
}) {
    return (
        <div
            className={cn(
                "rounded-2xl border px-4 py-3.5",
                accent ? "border-[#00C805]/25 bg-[#00C805]/[0.06]" : "border-white/[0.08] bg-white/[0.02]"
            )}
        >
            <p className="text-[9px] tracking-[0.16em] text-white/35">{label}</p>
            <p
                className={cn(
                    "mt-1.5 text-lg font-semibold tabular-nums",
                    accent ? "text-[#00C805]" : "text-white/92"
                )}
            >
                {value}
            </p>
            {sub ? <p className="mt-0.5 text-[10px] tabular-nums text-white/35">{sub}</p> : null}
        </div>
    );
}

function ethLabel(eth: number | undefined, digits = 4): string {
    if (eth == null || !Number.isFinite(eth)) return "—";
    return `${formatCompactDecimal(eth, { significant: digits })} ETH`;
}

export function RhPortfolioView({ walletParam }: { walletParam: string }) {
    const [walletInput, setWalletInput] = useState(walletParam);
    const [tab, setTab] = useState<RhPortfolioTab>("holdings");
    const [holdingSearch, setHoldingSearch] = useState("");
    const [hideDust, setHideDust] = useState(true);
    const [copiedAddr, setCopiedAddr] = useState(false);
    const [copiedShare, setCopiedShare] = useState(false);

    // Follow `?wallet=` when it changes (deep links, shared portfolio URLs).
    const [seededParam, setSeededParam] = useState(walletParam);
    if (seededParam !== walletParam) {
        setSeededParam(walletParam);
        if (walletParam) setWalletInput(walletParam);
    }

    const owner = walletInput.trim();
    const ownerValid = owner.length > 0 && isEvmAddress(owner);
    const ownerError = owner.length > 0 && !ownerValid ? "INVALID ROBINHOOD CHAIN ADDRESS (0x…)" : null;

    const query = useQuery({
        queryKey: ["rh-portfolio", owner.toLowerCase()],
        enabled: ownerValid,
        queryFn: () => fetchRhPortfolio(owner),
        staleTime: 20_000,
        refetchInterval: 45_000,
    });

    const data = query.data;
    const summary = data?.summary;

    const visibleHoldings = useMemo(() => {
        let list = data?.holdings ?? [];
        if (hideDust) {
            list = list.filter((h) => (h.valueUsd != null ? h.valueUsd >= 0.01 : h.balance > 0));
        }
        const q = holdingSearch.trim().toLowerCase();
        if (q) {
            list = list.filter(
                (h) =>
                    h.address.toLowerCase().includes(q) ||
                    (h.symbol?.toLowerCase().includes(q) ?? false) ||
                    (h.name?.toLowerCase().includes(q) ?? false)
            );
        }
        return list;
    }, [data, hideDust, holdingSearch]);

    async function handleCopyAddress() {
        if (!ownerValid) return;
        if (await copyToClipboard(owner)) {
            setCopiedAddr(true);
            window.setTimeout(() => setCopiedAddr(false), 1500);
        }
    }

    async function handleShare() {
        if (!ownerValid || typeof window === "undefined") return;
        const url = `${window.location.origin}/portfolio?wallet=${encodeURIComponent(owner)}`;
        if (await copyToClipboard(url)) {
            setCopiedShare(true);
            window.setTimeout(() => setCopiedShare(false), 1500);
        }
    }

    return (
        <div className="mx-auto w-full min-w-0 max-w-[1200px] px-2 py-4 sm:px-5 lg:px-8">
            <div className="overflow-hidden rounded-xl border border-[#00C805]/15 bg-[#0a0c0a] shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:rounded-2xl">
                {/* Header */}
                <div className="border-b border-white/[0.06] p-4 sm:p-7">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                            <div
                                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#00C805]/20 bg-gradient-to-br from-[#0d1a0d] to-[#070907] text-xl font-semibold text-white/80"
                                style={{ boxShadow: `0 0 0 2px ${RH_THEME.greenBorder}` }}
                            >
                                {ownerValid ? owner.slice(-2).toUpperCase() : <Wallet className="h-6 w-6 text-[#00C805]/50" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
                                        {ownerValid ? shortenAddress(owner, 5) : "WALLET"}
                                    </h1>
                                    <span className="inline-flex items-center gap-1 rounded-full border border-[#00C805]/30 bg-[#00C805]/10 px-2 py-0.5 text-[9px] tracking-wider text-[#00C805]">
                                        <NetworkIcon network="robinhood" size={12} />
                                        ROBINHOOD
                                    </span>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {ownerValid ? (
                                        <>
                                            <span className="truncate font-mono text-[11px] text-white/40 sm:text-xs">
                                                {shortenAddress(owner, 8)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => void handleCopyAddress()}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-[#00C805]/70 transition-colors hover:border-[#00C805]/30 hover:text-[#00C805]"
                                                aria-label="Copy address"
                                            >
                                                {copiedAddr ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                            </button>
                                        </>
                                    ) : (
                                        <span className="text-xs text-white/35">
                                            Paste a Robinhood Chain address to load holdings and creator fees
                                        </span>
                                    )}
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => void handleShare()}
                                        disabled={!ownerValid}
                                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/[0.08] disabled:opacity-35 sm:min-h-0 sm:px-4 sm:text-xs"
                                    >
                                        <Share2 className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{copiedShare ? "LINK COPIED" : "SHARE"}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => query.refetch()}
                                        disabled={!ownerValid || query.isFetching}
                                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-3 py-2 text-[11px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40 sm:min-h-0 sm:px-4 sm:text-xs"
                                        style={{ backgroundColor: RH_THEME.green }}
                                    >
                                        <RefreshCw className={cn("h-3.5 w-3.5 shrink-0", query.isFetching && "animate-spin")} />
                                        REFRESH
                                    </button>
                                    {ownerValid ? (
                                        <a
                                            href={BAGSCAN_NETWORKS.robinhood.explorerTokenUrl(owner)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/15 px-3 py-2 text-[11px] text-white/60 transition-colors hover:border-[#00C805]/30 hover:text-[#00C805] sm:min-h-0 sm:px-4 sm:text-xs"
                                        >
                                            EXPLORER
                                            <ExternalLink className="h-3 w-3 shrink-0" />
                                        </a>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <div className="w-full max-w-sm shrink-0">
                            <label className="block">
                                <span className="mb-1.5 block text-[9px] tracking-[0.16em] text-white/35">
                                    WALLET ADDRESS
                                </span>
                                <input
                                    value={walletInput}
                                    onChange={(e) => setWalletInput(e.target.value)}
                                    placeholder="0x…"
                                    spellCheck={false}
                                    autoComplete="off"
                                    className="w-full rounded-xl border border-white/[0.09] bg-black/50 px-3 py-2.5 font-mono text-[12px] text-white/90 placeholder:text-white/25 focus:border-[#00C805]/45 focus:outline-none"
                                />
                            </label>
                            {ownerError ? (
                                <p className="mt-1.5 text-[10px] tracking-[0.1em] text-[#ff5f5f]/80">{ownerError}</p>
                            ) : (
                                <p className="mt-1.5 text-[10px] leading-relaxed text-white/30">
                                    Robinhood Chain is EVM — Solana wallet connection does not apply here, so portfolios
                                    are looked up by address.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Body */}
                {!ownerValid ? (
                    <div className="px-6 py-20 text-center">
                        <Wallet className="mx-auto h-9 w-9 text-[#00C805]/25" />
                        <p className="mt-3 text-[12px] tracking-[0.12em] text-white/50">NO WALLET LOADED</p>
                        <p className="mx-auto mt-1.5 max-w-sm text-[10px] leading-relaxed text-white/30">
                            Paste a Robinhood Chain address above to see token holdings, ETH balance and creator fee
                            positions.
                        </p>
                    </div>
                ) : query.error ? (
                    <div className="p-6">
                        <ErrorState
                            error="Failed to load this Robinhood portfolio"
                            onRetry={() => query.refetch()}
                        />
                    </div>
                ) : query.isLoading ? (
                    <div className="grid gap-3 p-4 sm:p-6">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-16 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]"
                            />
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-2.5 border-b border-white/[0.06] p-4 sm:grid-cols-4 sm:gap-3 sm:p-6">
                            <StatCard
                                label="TOTAL VALUE"
                                value={
                                    summary?.totalValueUsd != null
                                        ? formatCurrency(summary.totalValueUsd)
                                        : ethLabel((summary?.tokenValueEth ?? 0) + (summary?.ethBalance ?? 0))
                                }
                                sub={`${summary?.holdingsCount ?? 0} token${summary?.holdingsCount === 1 ? "" : "s"}`}
                                accent
                            />
                            <StatCard
                                label="TOKEN VALUE"
                                value={
                                    summary?.tokenValueUsd
                                        ? formatCurrency(summary.tokenValueUsd)
                                        : ethLabel(summary?.tokenValueEth)
                                }
                                sub={ethLabel(summary?.tokenValueEth)}
                            />
                            <StatCard
                                label="ETH BALANCE"
                                value={ethLabel(summary?.ethBalance)}
                                sub={
                                    summary?.ethValueUsd != null
                                        ? formatCurrency(summary.ethValueUsd)
                                        : summary?.wethBalance
                                          ? `+ ${ethLabel(summary.wethBalance)} WETH`
                                          : undefined
                                }
                            />
                            <StatCard
                                label="CLAIMABLE FEES"
                                value={ethLabel(summary?.claimableEth)}
                                sub={
                                    summary?.lifetimeEarnedEth
                                        ? `${ethLabel(summary.lifetimeEarnedEth)} lifetime`
                                        : undefined
                                }
                            />
                        </div>

                        {/* Tabs */}
                        <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 pt-3 sm:px-6">
                            {(
                                [
                                    { id: "holdings" as const, label: "HOLDINGS", count: data?.holdings.length ?? 0 },
                                    { id: "fees" as const, label: "CREATOR FEES", count: data?.earnings.length ?? 0 },
                                ] as const
                            ).map(({ id, label, count }) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setTab(id)}
                                    className={cn(
                                        "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[10px] tracking-[0.14em] transition-colors",
                                        tab === id
                                            ? "border-[#00C805] text-[#00C805]"
                                            : "border-transparent text-white/35 hover:text-white/65"
                                    )}
                                    aria-pressed={tab === id}
                                >
                                    {label}
                                    <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] tabular-nums text-white/45">
                                        {count}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {tab === "holdings" ? (
                            <div className="p-4 sm:p-6">
                                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="relative w-full sm:max-w-xs">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
                                        <input
                                            value={holdingSearch}
                                            onChange={(e) => setHoldingSearch(e.target.value)}
                                            placeholder="Filter holdings…"
                                            className="w-full rounded-xl border border-white/[0.08] bg-black/40 py-2 pl-9 pr-3 text-[11px] text-white/85 placeholder:text-white/25 focus:border-[#00C805]/40 focus:outline-none"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setHideDust((v) => !v)}
                                        className={cn(
                                            "self-start rounded-full border px-3 py-1.5 text-[10px] tracking-[0.12em] transition-colors",
                                            hideDust
                                                ? "border-[#00C805]/35 text-[#00C805]"
                                                : "border-white/12 text-white/40 hover:text-white/70"
                                        )}
                                        aria-pressed={hideDust}
                                    >
                                        HIDE DUST
                                    </button>
                                </div>

                                {visibleHoldings.length === 0 ? (
                                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-16 text-center">
                                        <Coins className="mx-auto h-8 w-8 text-[#00C805]/25" />
                                        <p className="mt-3 text-[11px] tracking-[0.12em] text-white/45">
                                            {(data?.holdings.length ?? 0) > 0
                                                ? "NO HOLDINGS MATCH THIS FILTER"
                                                : "NO ROBINHOOD TOKEN HOLDINGS"}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {visibleHoldings.map((h) => (
                                            <Link
                                                key={h.address}
                                                href={`/token/${h.address}`}
                                                className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 transition-colors hover:border-[#00C805]/30 hover:bg-[#00C805]/[0.03] sm:p-3.5"
                                            >
                                                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black">
                                                    <RemoteFillImage
                                                        src={h.image}
                                                        alt=""
                                                        sizes="40px"
                                                        className="object-cover"
                                                        fallback={
                                                            <span className="absolute inset-0 flex items-center justify-center text-xs text-[#00C805]/35">
                                                                {h.symbol?.charAt(0) ?? "?"}
                                                            </span>
                                                        }
                                                    />
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="truncate text-[12px] font-semibold text-white/92">
                                                            {h.symbol ? `$${h.symbol}` : shortenAddress(h.address)}
                                                        </p>
                                                        {h.isMigrated ? (
                                                            <span className="shrink-0 rounded border border-[#00C805]/30 px-1 py-0.5 text-[8px] tracking-wider text-[#00C805]/80">
                                                                POOL
                                                            </span>
                                                        ) : (
                                                            <span className="shrink-0 text-[9px] tabular-nums text-white/30">
                                                                {rhFormatPct(h.bondingProgressPct)} curve
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="truncate text-[10px] text-white/38">
                                                        {formatNumber(h.balance)} {h.symbol ?? "tokens"}
                                                        {h.supplyPct != null && h.supplyPct > 0
                                                            ? ` · ${h.supplyPct < 0.01 ? "<0.01" : h.supplyPct.toFixed(2)}% of supply`
                                                            : ""}
                                                    </p>
                                                    {!h.isMigrated ? (
                                                        <RhBondingBar
                                                            progress={h.bondingProgressPct}
                                                            showLabel={false}
                                                            className="mt-1.5 max-w-[220px]"
                                                        />
                                                    ) : null}
                                                </div>

                                                <div className="shrink-0 text-right">
                                                    <p className="text-[12px] font-semibold tabular-nums text-white/92">
                                                        {h.valueUsd != null ? formatCurrency(h.valueUsd) : ethLabel(h.valueEth, 3)}
                                                    </p>
                                                    <p className="text-[10px] tabular-nums text-white/35">
                                                        {h.priceUsd != null
                                                            ? formatTokenPrice(h.priceUsd)
                                                            : h.priceEth != null
                                                              ? `${formatCompactDecimal(h.priceEth)} ETH`
                                                              : "—"}
                                                    </p>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}

                                <p className="mt-4 text-[10px] leading-relaxed text-white/25">
                                    Values are marked at the live curve or pool price and converted with the current
                                    ETH/USD rate. Robinhood Chain trade history is indexed per token, so cost basis and
                                    unrealized PnL are not available on this network yet.
                                </p>
                            </div>
                        ) : (
                            <div className="p-4 sm:p-6">
                                {(data?.earnings.length ?? 0) === 0 ? (
                                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-16 text-center">
                                        <Coins className="mx-auto h-8 w-8 text-[#00C805]/25" />
                                        <p className="mt-3 text-[11px] tracking-[0.12em] text-white/45">
                                            NO CREATOR FEE POSITIONS
                                        </p>
                                        <p className="mx-auto mt-1.5 max-w-sm text-[10px] leading-relaxed text-white/30">
                                            Fee positions appear here once this wallet launches a token or is added to a
                                            fee share on Robinhood Chain.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {data?.earnings.map((e) => (
                                            <div
                                                key={`${e.address}-${e.feeShare}`}
                                                className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 sm:p-3.5"
                                            >
                                                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black">
                                                    <RemoteFillImage
                                                        src={e.image}
                                                        alt=""
                                                        sizes="40px"
                                                        className="object-cover"
                                                        fallback={
                                                            <span className="absolute inset-0 flex items-center justify-center text-xs text-[#00C805]/35">
                                                                {e.symbol?.charAt(0) ?? "?"}
                                                            </span>
                                                        }
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <Link
                                                        href={`/token/${e.address}`}
                                                        className="truncate text-[12px] font-semibold text-white/92 hover:text-[#00C805]"
                                                    >
                                                        {e.symbol ? `$${e.symbol}` : shortenAddress(e.address)}
                                                    </Link>
                                                    <p className="truncate text-[10px] text-white/35">
                                                        {e.name ?? shortenAddress(e.address)} · fee share{" "}
                                                        {shortenAddress(e.feeShare)}
                                                    </p>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <p className="text-[12px] font-semibold tabular-nums text-[#00C805]">
                                                        {ethLabel(e.claimableEth)}
                                                    </p>
                                                    <p className="text-[10px] tabular-nums text-white/35">
                                                        {ethLabel(e.lifetimeEth)} lifetime
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#00C805]/15 bg-[#00C805]/[0.04] p-3.5">
                                    <div>
                                        <p className="text-[10px] tracking-[0.14em] text-[#00C805]/70">
                                            LIFETIME CREATOR FEES
                                        </p>
                                        <p className="mt-0.5 text-sm font-semibold tabular-nums text-white/90">
                                            {ethLabel(summary?.lifetimeEarnedEth)}
                                            {summary?.lifetimeEarnedUsd != null
                                                ? ` · ${formatCurrency(summary.lifetimeEarnedUsd)}`
                                                : ""}
                                        </p>
                                    </div>
                                    <a
                                        href="https://bags.fm/?network=robinhood"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-semibold tracking-[0.12em] text-black transition-opacity hover:opacity-90"
                                        style={{ backgroundColor: RH_THEME.green }}
                                    >
                                        CLAIM ON BAGS
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                            </div>
                        )}

                        {data?.truncated ? (
                            <p className="px-6 pb-5 text-[10px] text-white/30">
                                This wallet holds more positions than the API returns in one page — showing the first
                                batch.
                            </p>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
}
