"use client";

import Link from "next/link";
import Image from "next/image";
import { formatCurrency } from "@/lib/utils";
import type { NormalizedToken } from "@/lib/bags/types";
import { Radio } from "lucide-react";

interface LiveTickerProps {
    tokens: NormalizedToken[];
}

export function LiveTicker({ tokens }: LiveTickerProps) {
    const withPrice = tokens.filter((t) => t.priceUsd && t.symbol && t.name);
    if (withPrice.length === 0) return null;

    const items = [...withPrice, ...withPrice];

    return (
        <div className="mb-6 border-2 border-[#00ff41]/20 bg-black/80 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[#00ff41]/15">
                <Radio className="w-3.5 h-3.5 text-[#00ff41] animate-pulse" />
                <span className="text-[10px] text-[#00ff41]/60 tracking-[0.15em]">
                    LIVE FEED
                </span>
                <span className="text-[9px] text-[#00ff41]/25 tracking-wider">
                    {withPrice.length} ACTIVE
                </span>
            </div>
            <div className="ticker-container py-2.5">
                <div className="flex gap-3 animate-ticker whitespace-nowrap">
                    {items.map((t, i) => {
                        const up = (t.priceChange24h ?? 0) >= 0;
                        return (
                            <Link
                                key={`${t.tokenMint}-${i}`}
                                href={`/token/${t.tokenMint}`}
                                className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#00ff41]/5 transition-colors flex-shrink-0 group border border-transparent hover:border-[#00ff41]/20"
                            >
                                {t.image && (
                                    <div className="relative w-5 h-5 overflow-hidden flex-shrink-0 border border-[#00ff41]/15">
                                        <Image src={t.image} alt={t.symbol ?? ""} fill className="object-cover" unoptimized />
                                    </div>
                                )}
                                <span className="text-[11px] text-[#00ff41]/70 tracking-wider group-hover:text-[#00ff41] transition-colors">
                                    {t.symbol}
                                </span>
                                <span className="text-[11px] text-[#00ff41]/30 tracking-wider">
                                    {formatCurrency(t.priceUsd, { compact: false, decimals: t.priceUsd && t.priceUsd < 0.01 ? 6 : 4 })}
                                </span>
                                {t.priceChange24h !== undefined && (
                                    <span className={`text-[10px] tracking-wider ${up ? "text-[#00ff41]" : "text-[#ff4400]"}`}>
                                        {up ? "+" : ""}{t.priceChange24h.toFixed(1)}%
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
