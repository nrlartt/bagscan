"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Flame, Loader2, Search, Target } from "lucide-react";
import type { JupiterPredictionEvent, JupiterPredictionTradingStatus } from "@/lib/jupiter/types";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

interface MarketboardData {
    tradingStatus: JupiterPredictionTradingStatus;
    events: JupiterPredictionEvent[];
}

export function PredictionBrowse() {
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("all");
    const [visibleCount, setVisibleCount] = useState(24);
    const deferredSearch = useDeferredValue(search);

    const marketboard = useQuery<MarketboardData>({
        queryKey: ["prediction-marketboard"],
        queryFn: async () => {
            const res = await fetch("/api/prediction/marketboard");
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Prediction marketboard could not be loaded.");
            return json.data;
        },
        staleTime: 60_000,
        refetchInterval: 90_000,
    });

    const events = useMemo(() => marketboard.data?.events ?? [], [marketboard.data?.events]);
    const categories = useMemo(
        () => ["all", ...new Set(events.map((item) => (item.category ?? "other").toLowerCase()))],
        [events]
    );

    const filteredEvents = useMemo(() => {
        const query = deferredSearch.trim().toLowerCase();
        return events.filter((event) => {
            const categoryMatch = category === "all" || (event.category ?? "other").toLowerCase() === category;
            if (!categoryMatch) return false;
            if (!query) return true;

            return [event.title, event.description, event.category, ...event.markets.map((market) => market.title)]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query));
        });
    }, [category, deferredSearch, events]);

    const visibleEvents = useMemo(() => filteredEvents.slice(0, visibleCount), [filteredEvents, visibleCount]);

    useEffect(() => {
        setVisibleCount(24);
    }, [category, deferredSearch]);

    return (
        <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8">
            <section className="mb-6 border border-[#00ff41]/14 bg-[radial-gradient(circle_at_top,rgba(0,255,65,0.08),transparent_35%),linear-gradient(180deg,rgba(2,18,9,0.94),rgba(2,10,5,0.98))] p-5 sm:p-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-4xl">
                        <p className="text-[11px] uppercase tracking-[0.28em] text-[#ffaa00]/72">BagScan Prediction</p>
                        <h1 className="mt-3 text-3xl tracking-[0.22em] text-[#d8ffe6] sm:text-4xl">PREDICTION</h1>
                        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#d8ffe6]/62">
                            Track live event markets, step into a focused contract board, and fund every BagScan prediction
                            entry directly with <span className="text-[#00ff41]">$SCAN</span>.
                        </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
                        <MetricCard
                            label="Live Events"
                            value={formatNumber(filteredEvents.length, false)}
                            hint="Highest-volume events visible on this pass."
                        />
                        <MetricCard
                            label="Browse Status"
                            value={marketboard.data?.tradingStatus.open ? "LIVE" : "CHECKED"}
                            hint={marketboard.data?.tradingStatus.reason ?? "Live market availability is checked on each pass."}
                        />
                        <MetricCard
                            label="Funding"
                            value="$SCAN"
                            hint="Prediction entries stay anchored to the BagScan native token."
                        />
                    </div>
                </div>
            </section>

            <section className="mb-6 border border-[#00ff41]/12 bg-[linear-gradient(180deg,rgba(3,16,9,0.62),rgba(0,0,0,0.32))] p-3 sm:p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                    <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#00ff41]/42">
                                <Search className="h-3.5 w-3.5" />
                                Search Event Flow
                            </div>
                            <p className="hidden text-[10px] uppercase tracking-[0.18em] text-[#00ff41]/34 sm:block">
                                Every live entry stays funded with <span className="text-[#00ff41]/78">$SCAN</span>
                            </p>
                        </div>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            type="text"
                            placeholder="Election, crypto, sports, macro..."
                            className="w-full border border-[#00ff41]/16 bg-black/45 px-3 py-3 text-sm tracking-[0.12em] text-[#d8ffe6] outline-none transition focus:border-[#00ff41]/38 focus:bg-black/55"
                        />
                    </div>

                    <div className="xl:w-[560px]">
                        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[#ffaa00]/70">
                            <Flame className="h-3.5 w-3.5" />
                            Category Lens
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {categories.slice(0, 10).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setCategory(item)}
                                    className={cn(
                                        "border px-3 py-2 text-[10px] uppercase tracking-[0.2em] transition",
                                        category === item
                                            ? "border-[#ffaa00]/44 bg-[linear-gradient(180deg,rgba(255,170,0,0.16),rgba(255,170,0,0.06))] text-[#ffe19b] shadow-[0_0_14px_rgba(255,170,0,0.08)]"
                                            : "border-[#00ff41]/14 bg-[#00ff41]/[0.03] text-[#00ff41]/58 hover:border-[#00ff41]/28 hover:bg-[#00ff41]/[0.07]"
                                    )}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="border border-[#00ff41]/12 bg-black/25 p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-[#00ff41]/68">
                        <Target className="h-4 w-4 text-[#ffaa00]/60" />
                        Prediction Markets
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#00ff41]/38">
                        Showing {visibleEvents.length} of {filteredEvents.length}
                    </p>
                </div>

                {marketboard.isLoading ? (
                    <LoaderPanel label="LOADING LIVE MARKETS" />
                ) : marketboard.error ? (
                    <ErrorPanel message={String(marketboard.error)} />
                ) : filteredEvents.length === 0 ? (
                    <div className="border border-[#00ff41]/12 bg-[#00ff41]/[0.03] px-4 py-5 text-[11px] tracking-[0.14em] text-[#00ff41]/54">
                        No live prediction events matched this filter yet.
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {visibleEvents.map((event) => (
                                <PredictionEventCard key={event.eventId} event={event} />
                            ))}
                        </div>
                        {filteredEvents.length > visibleEvents.length ? (
                            <div className="mt-5 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => setVisibleCount((current) => current + 12)}
                                    className="border border-[#ffaa00]/22 bg-[#ffaa00]/[0.06] px-4 py-3 text-[10px] uppercase tracking-[0.22em] text-[#ffd37a] transition hover:border-[#ffaa00]/38 hover:bg-[#ffaa00]/[0.12]"
                                >
                                    Load More Events
                                </button>
                            </div>
                        ) : null}
                    </>
                )}
            </section>
        </div>
    );
}

function PredictionEventCard({ event }: { event: JupiterPredictionEvent }) {
    const primaryMarkets = event.markets.slice(0, 3);

    return (
        <Link
            href={`/prediction/${encodeURIComponent(event.eventId)}`}
            className="group border border-[#00ff41]/12 bg-[linear-gradient(180deg,rgba(2,12,8,0.94),rgba(0,0,0,0.92))] p-4 transition hover:border-[#00ff41]/28 hover:bg-[linear-gradient(180deg,rgba(4,20,10,0.96),rgba(0,0,0,0.94))] hover:shadow-[0_0_22px_rgba(0,255,65,0.06)]"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <PredictionEventThumb event={event} size="md" />
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-[#ffaa00]/72">{event.category ?? "Prediction"}</p>
                        <h2 className="mt-2 line-clamp-2 text-[16px] tracking-[0.08em] text-[#d8ffe6]">{event.title}</h2>
                    </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[#00ff41]/34 transition group-hover:text-[#00ff41]/68" />
            </div>

            <div className="mt-4 space-y-2">
                {primaryMarkets.map((market) => (
                    <div key={market.marketId} className="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-3 border border-[#00ff41]/8 bg-black/22 px-3 py-3">
                        <div className="min-w-0">
                            <p className="truncate text-[12px] tracking-[0.08em] text-[#d8ffe6]/88">{market.title}</p>
                        </div>
                        <div className="rounded-sm bg-[linear-gradient(90deg,rgba(173,204,96,0.18),rgba(0,170,255,0.16))] px-2 py-1 text-center text-[10px] uppercase tracking-[0.18em] text-[#d8ffe6]">
                            Yes {formatCompactProbability(market.yesProbability)}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-[#00ff41]/44">
                <span>{event.closeTime ? formatDateCompact(event.closeTime) : "Live"}</span>
                <span>{formatCurrency(event.volumeUsd)} vol</span>
            </div>

            <div className="mt-4 inline-flex items-center gap-2 border border-[#ffaa00]/18 bg-[#ffaa00]/[0.07] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[#ffd37a] transition group-hover:border-[#ffaa00]/34 group-hover:bg-[#ffaa00]/[0.12]">
                Open Event
                <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
        </Link>
    );
}

function PredictionEventThumb({
    event,
    size = "md",
}: {
    event: Pick<JupiterPredictionEvent, "imageUrl" | "title">;
    size?: "md" | "lg";
}) {
    const dimensions = size === "lg" ? "h-14 w-14" : "h-12 w-12";

    if (event.imageUrl) {
        return (
            <div className={cn("overflow-hidden border border-white/10 bg-black/30 shadow-[0_0_18px_rgba(255,255,255,0.04)]", dimensions)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={event.imageUrl}
                    alt={event.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                />
            </div>
        );
    }

    return (
        <div className={cn("flex items-center justify-center border border-[#00ff41]/14 bg-[#00ff41]/[0.05] text-[11px] uppercase tracking-[0.2em] text-[#00ff41]/52", dimensions)}>
            {event.title.slice(0, 2)}
        </div>
    );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
    return (
        <div className="border border-[#00ff41]/12 bg-black/35 px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff41]/36">{label}</p>
            <p className="mt-3 text-xl tracking-[0.14em] text-[#d8ffe6]">{value}</p>
            <p className="mt-3 text-[10px] leading-5 tracking-[0.14em] text-[#d8ffe6]/42">{hint}</p>
        </div>
    );
}

function LoaderPanel({ label }: { label: string }) {
    return (
        <div className="flex min-h-[240px] items-center justify-center border border-[#00ff41]/12 bg-[#00ff41]/[0.03]">
            <div className="flex items-center gap-2 text-[11px] tracking-[0.2em] text-[#00ff41]/56">
                <Loader2 className="h-4 w-4 animate-spin" />
                {label}
            </div>
        </div>
    );
}

function ErrorPanel({ message }: { message: string }) {
    return <div className="border border-[#ff4400]/28 bg-[#ff4400]/8 px-4 py-5 text-[11px] tracking-[0.14em] text-[#ff9d7a]">{message}</div>;
}

function formatDateCompact(value: string) {
    try {
        return new Date(value).toLocaleString("en-GB", {
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
    } catch {
        return value;
    }
}

function formatCompactProbability(probability: number | null | undefined) {
    if (probability === null || probability === undefined) return "--";
    return `${probability.toFixed(0)}%`;
}
