"use client";

import { formatDistanceToNow } from "date-fns";
import { shortenAddress } from "@/lib/utils";
import { Zap } from "lucide-react";
import type { BagsClaimEvent } from "@/lib/bags/types";

const LAMPORTS_PER_SOL = 1_000_000_000;

function parseTimestamp(ts: string): Date {
    const num = Number(ts);
    if (!isNaN(num) && num > 0) {
        return new Date(num < 1e12 ? num * 1000 : num);
    }
    return new Date(ts);
}

interface ClaimEventsListProps {
    events: BagsClaimEvent[];
    className?: string;
    compact?: boolean;
    limit?: number;
}

export function ClaimEventsList({
    events,
    className,
    compact = false,
    limit = 30,
}: ClaimEventsListProps) {
    if (!events || events.length === 0) {
        return (
            <div className={className}>
                <p className={`text-center tracking-wider text-[#00ff41]/25 ${compact ? "py-4 text-[10px]" : "py-6 text-[10px]"}`}>
                    NO CLAIM EVENTS AVAILABLE
                </p>
            </div>
        );
    }

    return (
        <div className={className}>
            <div className="space-y-0.5">
                {events.slice(0, limit).map((event, i) => {
                    let solAmount = 0;
                    try {
                        solAmount = Number(BigInt(event.amount)) / LAMPORTS_PER_SOL;
                    } catch {
                        solAmount = Number(event.amount) || 0;
                        if (solAmount > 1_000_000) solAmount = solAmount / LAMPORTS_PER_SOL;
                    }

                    return (
                        <div
                            key={event.signature ?? i}
                            className={`group flex items-center justify-between border-b border-[#00ff41]/5 transition-colors last:border-0 ${
                                compact
                                    ? "px-2.5 py-2 hover:bg-[#00ff41]/[0.03]"
                                    : "px-3 py-2.5 hover:bg-[#00ff41]/[0.02]"
                            }`}
                        >
                            <div className={`min-w-0 flex items-center ${compact ? "gap-2.5" : "gap-3"}`}>
                                <Zap className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} flex-shrink-0 text-[#ffaa00]/40`} />
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className={`${compact ? "text-[10px]" : "text-[11px]"} truncate tracking-wider text-[#00ff41]/50`}>
                                            {shortenAddress(event.wallet ?? "")}
                                        </p>
                                        {event.isCreator && (
                                            <span className="text-[8px] tracking-wider text-[#00ff41]/30">CREATOR</span>
                                        )}
                                    </div>
                                    {event.timestamp && (
                                        <p className={`${compact ? "text-[8px]" : "text-[9px]"} tracking-wider text-[#00ff41]/20`}>
                                            {(() => {
                                                const d = parseTimestamp(event.timestamp);
                                                if (isNaN(d.getTime()) || d.getFullYear() < 2020) return event.timestamp;
                                                return formatDistanceToNow(d, { addSuffix: true });
                                            })()}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className={`flex-shrink-0 text-right ${compact ? "ml-2" : "ml-3"}`}>
                                <p className={`${compact ? "text-[10px]" : "text-[11px]"} tracking-wider text-[#00ff41]/60`}>
                                    {solAmount > 0 ? `${solAmount.toFixed(4)} SOL` : "—"}
                                </p>
                                {event.signature && (
                                    <a
                                        href={`https://solscan.io/tx/${event.signature}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`${compact ? "text-[8px]" : "text-[9px]"} tracking-wider text-[#00ff41]/15 transition-colors hover:text-[#00ff41]/50`}
                                    >
                                        VIEW TX
                                    </a>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
