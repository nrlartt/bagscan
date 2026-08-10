"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, ExternalLink } from "lucide-react";
import { cn, formatCompactDecimal, shortenAddress } from "@/lib/utils";
import { rhExplorerTxUrl } from "@/lib/rh/chain";
import type { RhTrade, RhTradesResponse } from "@/lib/rh/api-types";
import { parseWeiToEth } from "@/lib/rh/mappers";
import { rhTimeAgoShort } from "./RhUi";

function tradeEth(trade: RhTrade): number | undefined {
    return parseWeiToEth(trade.ethWei);
}

function TradeRow({ trade }: { trade: RhTrade }) {
    const eth = tradeEth(trade);
    const isBuy = trade.kind === "buy";
    const ago = rhTimeAgoShort(new Date(trade.timestamp * 1000).toISOString());

    return (
        <div className="flex items-center gap-3 border-b border-white/[0.05] px-1 py-2.5 last:border-0">
            <span
                className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                    isBuy
                        ? "border-[#00C805]/30 bg-[#00C805]/10 text-[#00C805]"
                        : "border-[#ff6b6b]/25 bg-[#ff6b6b]/10 text-[#ff8a8a]"
                )}
            >
                {isBuy ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold tracking-wide text-white/85">
                    {isBuy ? "BUY" : "SELL"}
                    <span className="ml-2 font-normal text-white/35">{trade.venue}</span>
                </p>
                <p className="truncate text-[10px] text-white/35">
                    {shortenAddress(trade.account, 6)}
                    {ago ? ` · ${ago} ago` : null}
                </p>
            </div>
            <div className="shrink-0 text-right">
                {eth != null ? (
                    <p className="text-[11px] font-semibold tabular-nums text-white/80">
                        {formatCompactDecimal(eth, { significant: 4 })} ETH
                    </p>
                ) : (
                    <p className="text-[11px] text-white/30">—</p>
                )}
                <Link
                    href={rhExplorerTxUrl(trade.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-[9px] text-white/30 hover:text-[#00C805]"
                >
                    tx
                    <ExternalLink className="h-2.5 w-2.5" />
                </Link>
            </div>
        </div>
    );
}

async function fetchTrades(address: string): Promise<RhTradesResponse> {
    const res = await fetch(`/api/rh/trades?address=${encodeURIComponent(address)}&limit=40`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Failed to load trades");
    return json.data as RhTradesResponse;
}

export function RhTradesFeed({ address }: { address: string }) {
    const { data, isLoading, error } = useQuery({
        queryKey: ["rh-trades", address],
        queryFn: () => fetchTrades(address),
        refetchInterval: 20_000,
        staleTime: 10_000,
    });

    const trades = data?.trades ?? [];

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] tracking-[0.16em] text-white/35">RECENT TRADES</p>
                {trades.length > 0 ? (
                    <span className="text-[9px] tabular-nums text-white/30">{trades.length} indexed</span>
                ) : null}
            </div>

            {isLoading ? (
                <div className="space-y-2 py-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-10 animate-pulse rounded-lg bg-white/[0.04]" />
                    ))}
                </div>
            ) : error ? (
                <p className="py-6 text-center text-[10px] text-white/35">Trade history unavailable.</p>
            ) : trades.length === 0 ? (
                <p className="py-6 text-center text-[10px] text-white/35">No indexed trades yet.</p>
            ) : (
                <div>{trades.map((t) => (
                    <TradeRow key={`${t.id}-${t.logIndex}`} trade={t} />
                ))}</div>
            )}
        </div>
    );
}
