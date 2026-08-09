"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    LayoutGrid,
    List,
    ExternalLink,
    Rocket,
    Sparkles,
    TrendingUp,
    SearchX,
    ArrowUpRight,
} from "lucide-react";
import {
    cn,
    formatCurrency,
    formatCompactDecimal,
    formatTokenPrice,
    shortenAddress,
    getValuationMetric,
} from "@/lib/utils";
import { useDiscoverySearch } from "./DiscoverySearchContext";
import { RemoteFillImage, REMOTE_IMAGE_SIZES_GRID } from "./RemoteFillImage";
import { ErrorState } from "./States";
import { TokenCardSkeleton } from "./Skeletons";
import { BAGSCAN_NETWORKS } from "@/lib/networks";
import { NetworkIcon, RH_THEME } from "./NetworkIcons";
import { RhBondingBar, rhFormatPct, rhClampPct, rhTimeAgoShort } from "./RhUi";
import type { NormalizedToken } from "@/lib/bags/types";
import { parseRhFixed18 } from "@/lib/bags/rh-mappers";

type RhLane = "new" | "graduated";

interface RhTokensResponse {
    success: boolean;
    data: NormalizedToken[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
        tab: string;
        chain: string;
    };
}

const EMPTY: NormalizedToken[] = [];

async function fetchRhTokens(params: string): Promise<RhTokensResponse> {
    const res = await fetch(`/api/rh/tokens?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "API error");
    return json;
}

function RhFeaturedStrip({ tokens }: { tokens: NormalizedToken[] }) {
    if (tokens.length === 0) return null;

    return (
        <div className="mb-5 overflow-hidden rounded-2xl border border-[#00C805]/15 bg-gradient-to-b from-[#0a120a]/95 to-[#070a07] shadow-[0_8px_40px_rgba(0,200,5,0.06)]">
            <div className="flex items-center gap-2 border-b border-[#00C805]/10 px-4 py-3">
                <TrendingUp className="h-4 w-4 shrink-0 text-[#00C805]" />
                <span className="text-sm font-medium tracking-tight text-white/88">Fresh on curve</span>
                <span className="rounded-full bg-[#00C805]/10 px-2 py-0.5 text-[10px] tracking-wide text-[#00C805]/80">
                    Robinhood
                </span>
            </div>
            <div className="flex gap-3 overflow-x-auto overscroll-x-contain px-3 py-3 [-webkit-overflow-scrolling:touch] scrollbar-thin">
                {tokens.slice(0, 10).map((token, i) => {
                    const mcap = token.marketCap ?? token.fdvUsd;
                    return (
                        <Link
                            key={token.tokenMint}
                            href={`/token/${token.tokenMint}`}
                            className="group flex min-w-[210px] shrink-0 items-center gap-3 rounded-xl border border-white/[0.07] bg-black/40 px-3 py-2.5 transition-all hover:border-[#00C805]/35 hover:bg-[#00C805]/[0.04]"
                        >
                            <span className="min-w-[1.1rem] text-center text-xs font-bold tabular-nums text-white/40 group-hover:text-[#00C805]">
                                {i + 1}
                            </span>
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black">
                                <RemoteFillImage
                                    src={token.image}
                                    alt=""
                                    sizes="40px"
                                    className="object-cover"
                                    fallback={
                                        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-[#00C805]/35">
                                            {token.symbol?.charAt(0) ?? "?"}
                                        </span>
                                    }
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-white/90">
                                    {token.symbol ? `$${token.symbol}` : shortenAddress(token.tokenMint)}
                                </p>
                                <p className="truncate text-[10px] text-white/38">
                                    {token.bondingProgressPct != null ? `${rhFormatPct(token.bondingProgressPct)} · ` : ""}
                                    {mcap != null && mcap > 0 ? formatCurrency(mcap) : "—"}
                                </p>
                            </div>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-white/20 group-hover:text-[#00C805]/70" />
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

function RhTokenCard({ token, index }: { token: NormalizedToken; index: number }) {
    const priceEth = parseRhFixed18(token.priceEthPerToken ?? null);
    const valuation = getValuationMetric(token);
    const mcap = valuation.value;
    const age = rhTimeAgoShort(token.pairCreatedAt);

    return (
        <Link
            href={`/token/${token.tokenMint}`}
            className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border bg-[#0a0c0a]/90 transition-all duration-300",
                "border-[#00C805]/12 hover:border-[#00C805]/38 hover:shadow-[0_16px_48px_rgba(0,200,5,0.1)] hover:-translate-y-0.5"
            )}
            style={{ animationDelay: `${index * 40}ms` }}
        >
            <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-white/[0.06] bg-black/80">
                <RemoteFillImage
                    src={token.image}
                    alt={token.name ?? "Token"}
                    sizes={REMOTE_IMAGE_SIZES_GRID}
                    className="transition-transform duration-500 group-hover:scale-[1.04]"
                    fallback={
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#00C805]/10 to-black text-4xl font-semibold text-[#00C805]/20">
                            {token.symbol?.charAt(0) ?? "?"}
                        </div>
                    }
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#070907] via-[#070907]/80 to-transparent" />
                <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
                    {age ? (
                        <span className="rounded-md border border-white/10 bg-black/65 px-2 py-0.5 text-[9px] tracking-wider text-white/55 backdrop-blur-sm">
                            {age}
                        </span>
                    ) : null}
                    {token.isMigrated ? (
                        <span className="rounded-md border border-[#00C805]/35 bg-[#00C805]/15 px-2 py-0.5 text-[9px] font-semibold tracking-wider text-[#00C805]">
                            GRADUATED
                        </span>
                    ) : null}
                </div>
                {mcap != null && mcap > 0 ? (
                    <span
                        className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-md border border-white/10 bg-black/70 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/92 backdrop-blur-md"
                        title={valuation.description}
                    >
                        {formatCurrency(mcap)}{" "}
                        <span className="text-[8px] font-normal text-white/40">{valuation.shortLabel}</span>
                    </span>
                ) : null}
            </div>

            <div className="flex flex-1 flex-col gap-2.5 p-3.5">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold tracking-wide text-white/95">
                            {token.symbol ? `$${token.symbol}` : shortenAddress(token.tokenMint)}
                        </p>
                        <p className="truncate text-[10px] text-white/42">{token.name ?? "—"}</p>
                    </div>
                    <div className="shrink-0 text-right">
                        {token.priceUsd != null ? (
                            <>
                                <p className="text-[11px] font-semibold tabular-nums text-white/88">
                                    {formatTokenPrice(token.priceUsd)}
                                </p>
                                {priceEth != null ? (
                                    <p className="text-[9px] tabular-nums text-white/30">
                                        {formatCompactDecimal(priceEth)} ETH
                                    </p>
                                ) : null}
                            </>
                        ) : priceEth != null ? (
                            <p className="text-[11px] font-semibold tabular-nums text-white/88">
                                {formatCompactDecimal(priceEth)} ETH
                            </p>
                        ) : (
                            <p className="text-[11px] text-white/28">—</p>
                        )}
                    </div>
                </div>

                {!token.isMigrated ? (
                    <RhBondingBar progress={token.bondingProgressPct} showLabel />
                ) : (
                    <p className="text-[9px] tracking-[0.12em] text-[#00C805]/55">UNISWAP V4 POOL LIVE</p>
                )}

                <p className="mt-auto truncate font-mono text-[9px] text-white/22">{shortenAddress(token.tokenMint)}</p>
            </div>
        </Link>
    );
}

export function RhDiscoverHome() {
    const { debouncedSearch } = useDiscoverySearch();
    const [lane, setLane] = useState<RhLane>("new");
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
    const [page, setPage] = useState(1);
    const isSearching = debouncedSearch.length >= 2;

    // Switching lane or query starts a new result set — reset pagination during
    // render instead of in an effect, which would cost an extra paint.
    const resultKey = `${lane}|${debouncedSearch}`;
    const [lastResultKey, setLastResultKey] = useState(resultKey);
    if (lastResultKey !== resultKey) {
        setLastResultKey(resultKey);
        setPage(1);
    }

    const params = useMemo(() => {
        const p = new URLSearchParams();
        p.set("page", String(page));
        p.set("pageSize", "48");
        if (isSearching) {
            p.set("search", debouncedSearch);
        } else if (lane === "graduated") {
            p.set("migrated", "true");
        } else {
            p.set("migrated", "false");
        }
        return p.toString();
    }, [page, lane, debouncedSearch, isSearching]);

    const featuredParams = "page=1&pageSize=12&migrated=false";

    const { data, isLoading, error, refetch } = useQuery<RhTokensResponse>({
        queryKey: ["rh-tokens", params],
        queryFn: () => fetchRhTokens(params),
        refetchInterval: 20_000,
        staleTime: 10_000,
    });

    const { data: featuredData } = useQuery<RhTokensResponse>({
        queryKey: ["rh-tokens", "featured", featuredParams],
        queryFn: () => fetchRhTokens(featuredParams),
        enabled: !isSearching,
        staleTime: 15_000,
        refetchInterval: 25_000,
    });

    const tokens = data?.data ?? EMPTY;
    const featured = featuredData?.data ?? EMPTY;
    const meta = data?.meta;

    return (
        <div className="mx-auto w-full min-w-0 max-w-[90rem] px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
            {/* Hero */}
            <div className="mb-5 overflow-hidden rounded-2xl border border-[#00C805]/18 bg-gradient-to-br from-[#0c140c] via-[#0a0f0a] to-[#070907]">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="min-w-0">
                        <div className="mb-2 flex items-center gap-2">
                            <NetworkIcon network="robinhood" size={22} />
                            <span className="text-[10px] tracking-[0.2em] text-[#00C805]/70">BAGS V2 · CHAIN 4663</span>
                        </div>
                        <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                            Discover Robinhood launches
                        </h1>
                        <p className="mt-1.5 max-w-xl text-[11px] leading-relaxed text-white/45">
                            Bonding-curve tokens with live progress, spot prices, and graduated Uniswap V4 pools — powered by the Bags API.
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                        {meta?.total != null ? (
                            <div className="text-right text-[10px] tracking-[0.14em] text-white/35">
                                <span className="text-lg font-semibold tabular-nums text-[#00C805]">
                                    {meta.total.toLocaleString()}
                                </span>
                                <span className="ml-2">indexed</span>
                            </div>
                        ) : null}
                        <a
                            href={BAGSCAN_NETWORKS.robinhood.launchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[11px] font-semibold tracking-[0.1em] text-black transition-opacity hover:opacity-90"
                            style={{ backgroundColor: RH_THEME.green, boxShadow: `0 0 28px ${RH_THEME.greenGlow}` }}
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                            LAUNCH NOW
                            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                        </a>
                    </div>
                </div>
            </div>

            {!isSearching ? <RhFeaturedStrip tokens={featured} /> : null}

            {/* Controls */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="mb-2 text-[10px] tracking-[0.22em] text-[#00C805]/45">
                        {isSearching ? "SEARCH RESULTS" : "ALL LAUNCHES"}
                    </p>
                    {!isSearching ? (
                        <div className="flex flex-wrap gap-1.5">
                            {(
                                [
                                    { id: "new" as const, label: "BONDING", icon: Rocket },
                                    { id: "graduated" as const, label: "GRADUATED", icon: TrendingUp },
                                ] as const
                            ).map(({ id, label, icon: Icon }) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setLane(id)}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] tracking-[0.14em] transition-all",
                                        lane === id
                                            ? "border-[#00C805]/45 bg-[#00C805]/12 text-[#00C805] shadow-[0_0_20px_rgba(0,200,5,0.08)]"
                                            : "border-white/10 text-white/40 hover:border-[#00C805]/25 hover:text-white/65"
                                    )}
                                >
                                    <Icon className="h-3 w-3" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[11px] text-white/45">
                            Results for <span className="text-[#00C805]">&quot;{debouncedSearch}&quot;</span>
                        </p>
                    )}
                </div>

                <div className="flex overflow-hidden rounded-lg border border-[#00C805]/15 self-start">
                    <button
                        type="button"
                        onClick={() => setViewMode("grid")}
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 py-2 transition-colors",
                            viewMode === "grid" ? "bg-[#00C805]/12 text-[#00C805]" : "text-white/30 hover:text-white/60"
                        )}
                        aria-pressed={viewMode === "grid"}
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        <span className="hidden text-[10px] sm:inline">GRID</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode("table")}
                        className={cn(
                            "flex border-l border-[#00C805]/15 px-2.5 py-2 transition-colors",
                            viewMode === "table" ? "bg-[#00C805]/12 text-[#00C805]" : "text-white/30 hover:text-white/60"
                        )}
                        aria-pressed={viewMode === "table"}
                    >
                        <List className="h-3.5 w-3.5" />
                        <span className="hidden text-[10px] sm:inline">TABLE</span>
                    </button>
                </div>
            </div>

            {error ? (
                <ErrorState error="Failed to load Robinhood tokens" onRetry={() => refetch()} />
            ) : isLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <TokenCardSkeleton key={i} />
                    ))}
                </div>
            ) : tokens.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-20 text-center">
                    {isSearching ? (
                        <SearchX className="mx-auto h-9 w-9 text-[#00C805]/25" />
                    ) : (
                        <Rocket className="mx-auto h-9 w-9 text-[#00C805]/25" />
                    )}
                    <p className="mt-3 text-[12px] tracking-[0.12em] text-white/50">
                        {isSearching ? "No matching tokens" : "No tokens in this lane yet"}
                    </p>
                    <p className="mx-auto mt-1.5 max-w-sm text-[10px] leading-relaxed text-white/30">
                        {isSearching
                            ? "Search matches this page of results — paste a full 0x token address for an exact lookup."
                            : "Nothing has been indexed on this lane yet. Check the other lane or start a launch."}
                    </p>
                    <a
                        href={BAGSCAN_NETWORKS.robinhood.launchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#00C805]/30 px-4 py-2 text-[10px] tracking-[0.14em] text-[#00C805] transition-colors hover:bg-[#00C805]/10"
                    >
                        LAUNCH ON ROBINHOOD
                        <ExternalLink className="h-3 w-3" />
                    </a>
                </div>
            ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {tokens.map((token, i) => (
                        <RhTokenCard key={token.tokenMint} token={token} index={i} />
                    ))}
                </div>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0a0c0a]/50">
                    <table className="w-full min-w-[720px] text-left text-[11px]">
                        <thead className="border-b border-white/10 bg-white/[0.03] text-[9px] tracking-[0.14em] text-white/38">
                            <tr>
                                <th className="px-3 py-3">TOKEN</th>
                                <th className="px-3 py-3">PRICE</th>
                                <th className="px-3 py-3">MCAP</th>
                                <th className="px-3 py-3">CURVE</th>
                                <th className="px-3 py-3">CREATOR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tokens.map((token) => {
                                const mcap = token.marketCap ?? token.fdvUsd;
                                return (
                                    <tr
                                        key={token.tokenMint}
                                        className="border-b border-white/[0.05] transition-colors hover:bg-[#00C805]/[0.03]"
                                    >
                                        <td className="px-3 py-2.5">
                                            <Link
                                                href={`/token/${token.tokenMint}`}
                                                className="flex items-center gap-2.5"
                                            >
                                                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black">
                                                    <RemoteFillImage
                                                        src={token.image}
                                                        alt=""
                                                        sizes="32px"
                                                        className="object-cover"
                                                        fallback={
                                                            <span className="absolute inset-0 flex items-center justify-center text-[10px] text-[#00C805]/35">
                                                                {token.symbol?.charAt(0) ?? "?"}
                                                            </span>
                                                        }
                                                    />
                                                </div>
                                                <span>
                                                    <span className="block font-semibold text-white/90">
                                                        {token.symbol ? `$${token.symbol}` : shortenAddress(token.tokenMint)}
                                                    </span>
                                                    <span className="block text-[10px] text-white/35">{token.name}</span>
                                                </span>
                                            </Link>
                                        </td>
                                        <td className="px-3 py-2.5 tabular-nums text-white/75">
                                            {token.priceUsd != null
                                                ? formatTokenPrice(token.priceUsd)
                                                : token.priceEthPerToken
                                                  ? `${formatCompactDecimal(parseRhFixed18(token.priceEthPerToken))} ETH`
                                                  : "—"}
                                        </td>
                                        <td className="px-3 py-2.5 tabular-nums text-white/55">
                                            {mcap != null && mcap > 0 ? formatCurrency(mcap) : "—"}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex min-w-[88px] items-center gap-2">
                                                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                                                    <div
                                                        className="h-full rounded-full bg-[#00C805]"
                                                        style={{
                                                            width: `${rhClampPct(token.bondingProgressPct) ?? 0}%`,
                                                        }}
                                                    />
                                                </div>
                                                <span className="shrink-0 tabular-nums text-[#00C805]/85">
                                                    {rhFormatPct(token.bondingProgressPct)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 font-mono text-white/40">
                                            {shortenAddress(token.creatorWallet ?? "—")}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {meta && meta.totalPages > 1 ? (
                <div className="mt-8 flex items-center justify-center gap-3">
                    <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="rounded-lg border border-white/12 px-4 py-2 text-[10px] tracking-wider text-white/50 transition-colors hover:border-[#00C805]/30 hover:text-[#00C805] disabled:opacity-30"
                    >
                        PREV
                    </button>
                    <span className="text-[10px] tabular-nums text-white/40">
                        Page {page} of {meta.totalPages}
                    </span>
                    <button
                        type="button"
                        disabled={page >= meta.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="rounded-lg border border-white/12 px-4 py-2 text-[10px] tracking-wider text-white/50 transition-colors hover:border-[#00C805]/30 hover:text-[#00C805] disabled:opacity-30"
                    >
                        NEXT
                    </button>
                </div>
            ) : null}
        </div>
    );
}
