"use client";

import Link from "next/link";
import Image from "next/image";
import { formatCurrency, formatNumber, shortenAddress, getValuationMetric } from "@/lib/utils";
import { ProviderBadge } from "./Badges";
import type { NormalizedToken } from "@/lib/bags/types";
import { ChevronRight } from "lucide-react";

interface TokenTableProps {
    tokens: NormalizedToken[];
}

export function TokenTable({ tokens }: TokenTableProps) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr className="border-b border-[#00ff41]/15">
                        <th className="text-left py-3 px-3 text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30 font-normal">TOKEN</th>
                        <th className="text-right py-3 px-3 text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30 font-normal">PRICE</th>
                        <th className="text-right py-3 px-3 text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30 font-normal hidden sm:table-cell">24H %</th>
                        <th className="text-right py-3 px-3 text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30 font-normal">VAL</th>
                        <th className="text-right py-3 px-3 text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30 font-normal hidden md:table-cell">VOLUME</th>
                        <th className="text-right py-3 px-3 text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30 font-normal hidden lg:table-cell">LIQUIDITY</th>
                        <th className="text-right py-3 px-3 text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30 font-normal hidden xl:table-cell">TXNS</th>
                        <th className="py-3 px-2 w-8" />
                    </tr>
                </thead>
                <tbody>
                    {tokens.map((token) => {
                        const valuation = getValuationMetric(token);
                        return (
                        <tr key={token.tokenMint} className="border-b border-[#00ff41]/5 hover:bg-[#00ff41]/[0.03] transition-colors group">
                            <td className="py-3 px-3">
                                <Link href={`/token/${token.tokenMint}`} className="flex items-center gap-3">
                                    <div className="relative w-8 h-8 overflow-hidden flex-shrink-0 border border-[#00ff41]/15">
                                        {token.image ? (
                                            <Image src={token.image} alt={token.name ?? "Token"} fill className="object-cover" unoptimized />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-[#00ff41]/30 text-xs bg-[#00ff41]/5">
                                                {token.symbol?.charAt(0) ?? "?"}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-[#00ff41]/80 tracking-wider group-hover:text-[#00ff41] transition-colors">
                                            {token.name ?? shortenAddress(token.tokenMint)}
                                        </p>
                                        <div className="flex items-center gap-1.5">
                                            {token.symbol && <span className="text-[10px] text-[#00ff41]/25 tracking-wider">${token.symbol}</span>}
                                            <ProviderBadge provider={token.provider} className="scale-[0.8] origin-left" />
                                        </div>
                                    </div>
                                </Link>
                            </td>
                            <td className="py-3 px-3 text-right">
                                <span className="text-[#00ff41]/60 tracking-wider">
                                    {formatCurrency(token.priceUsd, { compact: false, decimals: 6 })}
                                </span>
                            </td>
                            <td className="py-3 px-3 text-right hidden sm:table-cell">
                                {token.priceChange24h !== undefined ? (
                                    <span className={`tracking-wider ${token.priceChange24h >= 0 ? "text-[#00ff41]" : "text-[#ff4400]"}`}>
                                        {token.priceChange24h >= 0 ? "+" : ""}{token.priceChange24h.toFixed(1)}%
                                    </span>
                                ) : (
                                    <span className="text-[#00ff41]/15">—</span>
                                )}
                            </td>
                            <td className="py-3 px-3 text-right">
                                <div className="tracking-wider">
                                    <span className="text-[9px] text-[#00ff41]/24">{valuation.shortLabel}</span>
                                    <div className="text-[#00ff41]/60">{formatCurrency(valuation.value)}</div>
                                </div>
                            </td>
                            <td className="py-3 px-3 text-right hidden md:table-cell">
                                <span className="text-[#00ff41]/40 tracking-wider">{formatCurrency(token.volume24hUsd)}</span>
                            </td>
                            <td className="py-3 px-3 text-right hidden lg:table-cell">
                                <span className="text-[#00ff41]/40 tracking-wider">{formatCurrency(token.liquidityUsd)}</span>
                            </td>
                            <td className="py-3 px-3 text-right hidden xl:table-cell">
                                {token.txCount24h !== undefined ? (
                                    <div className="text-[#00ff41]/40 tracking-wider">
                                        <span>{formatNumber(token.txCount24h)}</span>
                                        {token.buyCount24h !== undefined && (
                                            <div className="text-[9px] text-[#00ff41]/20">
                                                {token.buyCount24h}B / {token.sellCount24h ?? 0}S
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-[#00ff41]/15">—</span>
                                )}
                            </td>
                            <td className="py-3 px-2">
                                <Link href={`/token/${token.tokenMint}`}>
                                    <ChevronRight className="w-4 h-4 text-[#00ff41]/10 group-hover:text-[#00ff41]/40 transition-colors" />
                                </Link>
                            </td>
                        </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
