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
}

export function ClaimEventsList({ events, className }: ClaimEventsListProps) {
    if (!events || events.length === 0) {
        return (
            <div className={className}>
                <p className="text-[10px] text-[#00ff41]/25 text-center py-6 tracking-wider">
                    NO CLAIM EVENTS AVAILABLE
                </p>
            </div>
        );
    }

    return (
        <div className={className}>
            <div className="space-y-0.5">
                {events.slice(0, 30).map((event, i) => {
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
                            className="flex items-center justify-between py-2.5 px-3 hover:bg-[#00ff41]/[0.02] transition-colors group border-b border-[#00ff41]/5 last:border-0"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <Zap className="w-3.5 h-3.5 text-[#ffaa00]/40 flex-shrink-0" />
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-[11px] text-[#00ff41]/50 truncate tracking-wider">
                                            {shortenAddress(event.wallet ?? "")}
                                        </p>
                                        {event.isCreator && (
                                            <span className="text-[8px] text-[#00ff41]/30 tracking-wider">CREATOR</span>
                                        )}
                                    </div>
                                    {event.timestamp && (
                                        <p className="text-[9px] text-[#00ff41]/20 tracking-wider">
                                            {(() => {
                                                const d = parseTimestamp(event.timestamp);
                                                if (isNaN(d.getTime()) || d.getFullYear() < 2020) return event.timestamp;
                                                return formatDistanceToNow(d, { addSuffix: true });
                                            })()}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-3">
                                <p className="text-[11px] text-[#00ff41]/60 tracking-wider">
                                    {solAmount > 0 ? `${solAmount.toFixed(4)} SOL` : "—"}
                                </p>
                                {event.signature && (
                                    <a
                                        href={`https://solscan.io/tx/${event.signature}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[9px] text-[#00ff41]/15 hover:text-[#00ff41]/50 transition-colors tracking-wider"
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
