"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Activity,
    AlertTriangle,
    Flame,
    RefreshCw,
    Rocket,
    TrendingUp,
    Zap,
} from "lucide-react";
import {
    cn,
    formatCompactDecimal,
    formatCurrency,
    formatNumber,
    formatTokenPrice,
    shortenAddress,
} from "@/lib/utils";
import { RemoteFillImage } from "./RemoteFillImage";
import { ErrorState } from "./States";
import { RhBondingBar, rhFormatPct, rhTimeAgoShort } from "./RhUi";
import { RhLogo } from "./RhLogo";
import type { RhAlphaFeed, RhAlphaSeverity, RhAlphaToken } from "@/lib/rh/alpha";

type RhAlphaFilter = "all" | "curve" | "graduated" | "risk";

const EMPTY: RhAlphaToken[] = [];

const SEVERITY_STYLE: Record<RhAlphaSeverity, string> = {
    critical: "border-[#00C805]/45 bg-[#00C805]/12 text-[#00C805]",
    high: "border-[#00C805]/30 bg-[#00C805]/[0.07] text-[#00C805]/90",
    medium: "border-white/12 bg-white/[0.04] text-white/70",
    low: "border-white/8 bg-white/[0.02] text-white/45",
};

const RISK_STYLE = "border-[#ff5f5f]/35 bg-[#ff5f5f]/[0.08] text-[#ff8a8a]";

async function fetchRhAlpha(): Promise<RhAlphaFeed & { success: boolean; error?: string }> {
    const res = await fetch("/api/rh/alpha");
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load Robinhood alpha");
    return json;
}

function ScoreBadge({ score }: { score: number }) {
    const tone =
        score >= 60
            ? "border-[#00C805]/50 bg-[#00C805]/15 text-[#00C805]"
            : score >= 30
              ? "border-[#00C805]/25 bg-[#00C805]/[0.06] text-[#00C805]/85"
              : "border-white/12 bg-white/[0.03] text-white/50";
    return (
        <span
            className={cn(
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[12px] font-bold tabular-nums",
                tone
            )}
            title={`Alpha score ${score}/100`}
        >
            {score}
        </span>
    );
}

function StatChip({ label, value }: { label: string; value: string }) {
    return (
        <span className="inline-flex items-baseline gap-1 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2 py-1">
            <span className="text-[8px] tracking-[0.12em] text-white/30">{label}</span>
            <span className="text-[10px] font-semibold tabular-nums text-white/80">{value}</span>
        </span>
    );
}

function AlphaRow({ token, rank }: { token: RhAlphaToken; rank: number }) {
    const priceChange = token.priceChangePct7d;
    const changePositive = (priceChange ?? 0) >= 0;

    return (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0a0c0a]/80 p-3 transition-colors hover:border-[#00C805]/28 sm:p-4">
            <div className="flex items-start gap-3">
                <span className="mt-1 w-5 shrink-0 text-center text-[11px] font-bold tabular-nums text-white/25">
                    {rank}
                </span>

                <Link
                    href={`/token/${token.address}`}
                    className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black"
                >
                    <RemoteFillImage
                        src={token.image}
                        alt=""
                        sizes="44px"
                        className="object-cover"
                        fallback={
                            <span className="absolute inset-0 flex items-center justify-center text-xs text-[#00C805]/35">
                                {token.symbol?.charAt(0) ?? "?"}
                            </span>
                        }
                    />
                </Link>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link
                            href={`/token/${token.address}`}
                            className="truncate text-[13px] font-semibold text-white/95 hover:text-[#00C805]"
                        >
                            {token.symbol ? `$${token.symbol}` : shortenAddress(token.address)}
                        </Link>
                        <span className="truncate text-[10px] text-white/35">{token.name}</span>
                        {token.isMigrated ? (
                            <span className="shrink-0 rounded border border-[#00C805]/30 px-1.5 py-0.5 text-[8px] tracking-wider text-[#00C805]/80">
                                POOL
                            </span>
                        ) : (
                            <span className="shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[8px] tracking-wider text-white/45">
                                CURVE {rhFormatPct(token.bondingProgressPct)}
                            </span>
                        )}
                        {token.lastTradeAt ? (
                            <span className="shrink-0 text-[9px] text-white/25">
                                last trade {rhTimeAgoShort(token.lastTradeAt)} ago
                            </span>
                        ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {token.signals.map((signal) => (
                            <span
                                key={`${token.address}-${signal.type}`}
                                title={signal.description}
                                className={cn(
                                    "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] tracking-[0.08em]",
                                    signal.risk ? RISK_STYLE : SEVERITY_STYLE[signal.severity]
                                )}
                            >
                                {signal.risk ? <AlertTriangle className="h-2.5 w-2.5" /> : null}
                                {signal.title}
                                {signal.value ? (
                                    <span className="font-semibold tabular-nums opacity-80">{signal.value}</span>
                                ) : null}
                            </span>
                        ))}
                        {token.signals.length === 0 ? (
                            <span className="text-[9px] tracking-[0.1em] text-white/25">
                                TRADED, NO ACTIVE SIGNALS
                            </span>
                        ) : null}
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <StatChip
                            label="7D VOL"
                            value={
                                token.volumeUsd7d != null
                                    ? formatCurrency(token.volumeUsd7d)
                                    : `${formatCompactDecimal(token.volumeEth7d)} ETH`
                            }
                        />
                        <StatChip
                            label="7D TRADES"
                            value={`${formatNumber(token.trades7d, false)}${token.tradesTruncated ? "+" : ""}`}
                        />
                        <StatChip label="WALLETS" value={formatNumber(token.uniqueTraders7d, false)} />
                        {token.buyPressurePct != null ? (
                            <StatChip label="BUYS" value={`${Math.round(token.buyPressurePct)}%`} />
                        ) : null}
                        {token.trades24h > 0 ? <StatChip label="24H" value={`${token.trades24h} tr`} /> : null}
                    </div>

                    {!token.isMigrated ? (
                        <RhBondingBar
                            progress={token.bondingProgressPct}
                            showLabel={false}
                            className="mt-2.5 max-w-[260px]"
                        />
                    ) : null}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <ScoreBadge score={token.alphaScore} />
                    <p className="text-[11px] font-semibold tabular-nums text-white/85">
                        {token.priceUsd != null
                            ? formatTokenPrice(token.priceUsd)
                            : token.priceEth != null
                              ? `${formatCompactDecimal(token.priceEth)} ETH`
                              : "—"}
                    </p>
                    {priceChange != null ? (
                        <p
                            className={cn(
                                "text-[10px] font-semibold tabular-nums",
                                changePositive ? "text-[#00C805]" : "text-[#ff8a8a]"
                            )}
                        >
                            {changePositive ? "+" : ""}
                            {priceChange.toFixed(1)}% 7d
                        </p>
                    ) : null}
                    {token.fdvUsd != null ? (
                        <p className="text-[9px] tabular-nums text-white/30">{formatCurrency(token.fdvUsd)} FDV</p>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function Tier({
    title,
    icon: Icon,
    tokens,
    startRank,
    hint,
}: {
    title: string;
    icon: typeof Flame;
    tokens: RhAlphaToken[];
    startRank: number;
    hint?: string;
}) {
    if (tokens.length === 0) return null;
    return (
        <section className="mb-6">
            <div className="mb-2.5 flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-[#00C805]" />
                <h2 className="text-[11px] tracking-[0.18em] text-white/70">{title}</h2>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] tabular-nums text-white/45">
                    {tokens.length}
                </span>
                {hint ? <span className="text-[9px] text-white/25">{hint}</span> : null}
            </div>
            <div className="space-y-2">
                {tokens.map((token, i) => (
                    <AlphaRow key={token.address} token={token} rank={startRank + i} />
                ))}
            </div>
        </section>
    );
}

export function RhAlphaBoard() {
    const [filter, setFilter] = useState<RhAlphaFilter>("all");

    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ["rh-alpha"],
        queryFn: fetchRhAlpha,
        refetchInterval: 60_000,
        staleTime: 30_000,
    });

    const tokens = data?.tokens ?? EMPTY;

    const filtered = useMemo(() => {
        switch (filter) {
            case "curve":
                return tokens.filter((t) => !t.isMigrated);
            case "graduated":
                return tokens.filter((t) => t.isMigrated);
            case "risk":
                return tokens.filter((t) => t.signals.some((s) => s.risk));
            default:
                return tokens;
        }
    }, [tokens, filter]);

    const critical = filtered.filter((t) => t.alphaScore >= 60);
    const hot = filtered.filter((t) => t.alphaScore >= 30 && t.alphaScore < 60);
    const watch = filtered.filter((t) => t.alphaScore < 30);

    return (
        <div className="mx-auto w-full min-w-0 max-w-[1680px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
            {/* Hero */}
            <div className="mb-5 overflow-hidden rounded-2xl border border-[#00C805]/18 bg-gradient-to-br from-[#0c140c] via-[#0a0f0a] to-[#070907]">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="min-w-0">
                        <div className="mb-2 flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#00C805]/25 bg-[#00C805]/[0.08]">
                                <Zap className="h-4 w-4 text-[#00C805]" />
                            </span>
                            <RhLogo size={16} />
                            <span className="text-[10px] tracking-[0.2em] text-[#00C805]/70">
                                ROBINHOOD ALPHA · CHAIN 4663
                            </span>
                        </div>
                        <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                            Live flow intelligence
                        </h1>
                        <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-white/45">
                            On-chain trade flow scored into signals: curve momentum, volume, buy/sell pressure, whale
                            prints and crowd formation. Windowed over 7 days — early-chain flow is thin, so a 24h
                            view would read empty.
                        </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                        <div className="flex items-center gap-4 text-right">
                            <div>
                                <p className="text-lg font-semibold tabular-nums text-[#00C805]">
                                    {data?.totalSignals ?? 0}
                                </p>
                                <p className="text-[9px] tracking-[0.14em] text-white/35">SIGNALS</p>
                            </div>
                            <div>
                                <p className="text-lg font-semibold tabular-nums text-white/85">{data?.scanned ?? 0}</p>
                                <p className="text-[9px] tracking-[0.14em] text-white/35">SCANNED</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => refetch()}
                                disabled={isFetching}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 px-3 py-2 text-[10px] tracking-[0.14em] text-white/55 transition-colors hover:border-[#00C805]/30 hover:text-[#00C805] disabled:opacity-40"
                            >
                                <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
                                REFRESH
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-4 flex flex-wrap gap-1.5">
                {(
                    [
                        { id: "all" as const, label: "ALL SIGNALS", icon: Activity },
                        { id: "curve" as const, label: "ON CURVE", icon: Rocket },
                        { id: "graduated" as const, label: "GRADUATED", icon: TrendingUp },
                        { id: "risk" as const, label: "RISK FLAGS", icon: AlertTriangle },
                    ] as const
                ).map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setFilter(id)}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] tracking-[0.14em] transition-all",
                            filter === id
                                ? "border-[#00C805]/45 bg-[#00C805]/12 text-[#00C805]"
                                : "border-white/10 text-white/40 hover:border-[#00C805]/25 hover:text-white/65"
                        )}
                        aria-pressed={filter === id}
                    >
                        <Icon className="h-3 w-3" />
                        {label}
                    </button>
                ))}
            </div>

            {error ? (
                <ErrorState error="Failed to load the Robinhood alpha feed" onRetry={() => refetch()} />
            ) : isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-28 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]"
                        />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-20 text-center">
                    <Zap className="mx-auto h-9 w-9 text-[#00C805]/25" />
                    <p className="mt-3 text-[12px] tracking-[0.12em] text-white/50">NO SIGNALS IN THIS VIEW</p>
                    <p className="mx-auto mt-1.5 max-w-sm text-[10px] leading-relaxed text-white/30">
                        {filter === "all"
                            ? "Nothing on Robinhood Chain cleared the signal thresholds in the last 7 days."
                            : "Try another filter — the full board may still have activity."}
                    </p>
                </div>
            ) : (
                <>
                    <Tier
                        title="CRITICAL"
                        icon={Flame}
                        tokens={critical}
                        startRank={1}
                        hint="score 60+"
                    />
                    <Tier
                        title="HOT"
                        icon={TrendingUp}
                        tokens={hot}
                        startRank={critical.length + 1}
                        hint="score 30–59"
                    />
                    <Tier
                        title="WATCH"
                        icon={Activity}
                        tokens={watch}
                        startRank={critical.length + hot.length + 1}
                        hint="early or quiet"
                    />
                </>
            )}

            <p className="mt-6 text-[10px] leading-relaxed text-white/25">
                Signals are derived from indexed Robinhood Chain trades and curve state — not investment advice. Trade
                counts marked with “+” hit the per-token page limit, so those totals are a lower bound.
                {data?.generatedAt ? ` Updated ${rhTimeAgoShort(data.generatedAt) ?? "just now"} ago.` : ""}
            </p>
        </div>
    );
}
