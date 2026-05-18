"use client";

import Link from "next/link";
import { RemoteFillImage } from "./RemoteFillImage";
import { formatCurrency, formatNumber, shortenAddress, getValuationMetric } from "@/lib/utils";
import { ProviderBadge } from "./Badges";
import type { NormalizedToken } from "@/lib/bags/types";
import { ChevronRight } from "lucide-react";

/**
 * Column order tuned for discover / explore grids:
 * identity → market cap → volume → activity → holders → liquidity → price → 24h move.
 */
interface TokenTableProps {
    tokens: NormalizedToken[];
}

export function TokenTable({ tokens }: TokenTableProps) {
    return (
        <div className="-mx-px overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-[34rem] text-xs">
                <thead>
                    <tr className="border-b border-[#00ff41]/15">
                        <th className="text-left py-3 px-3 text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30 font-normal">
                            TOKEN
                        </th>
                        <th className="text-right py-3 px-3 text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30 font-normal">
                            MCAP
                        </th>
                        <th className="text-right py-3 px-3 text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30 font-normal">
                            VOLUME
                        </th>
                        <th className="text-right py-3 px-3 text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30 font-normal hidden sm:table-cell">
                            TXNS
                        </th>
                        <th className="text-right py-3 px-3 text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30 font-normal hidden lg:table-cell">
                            HLD
                        </th>
                        <th className="text-right py-3 px-3 text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30 font-normal hidden xl:table-cell">
                            LIQ
                        </th>
                        <th className="text-right py-3 px-3 text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30 font-normal">
                            PRICE
                        </th>
                        <th className="text-right py-3 px-3 text-[9px] uppercase tracking-[0.15em] text-[#00ff41]/30 font-normal hidden sm:table-cell">
                            24H
                        </th>
                        <th className="py-3 px-2 w-8" />
                    </tr>
                </thead>
                <tbody>
                    {tokens.map((token) => {
                        const valuation = getValuationMetric(token);
                        return (
                            <tr
                                key={token.tokenMint}
                                className="border-b border-[#00ff41]/5 hover:bg-[#00ff41]/[0.03] transition-colors group"
                            >
                                <td className="py-3 px-3">
                                    <Link href={`/token/${token.tokenMint}`} className="flex min-w-0 max-w-[11rem] items-center gap-2 sm:max-w-none sm:gap-3">
                                        <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden border border-[#00ff41]/15">
                                            <RemoteFillImage
                                                src={token.image}
                                                alt={token.name ?? "Token"}
                                                sizes="48px"
                                                className="object-cover"
                                                fallback={
                                                    <div className="absolute inset-0 flex items-center justify-center bg-[#00ff41]/5 text-xs text-[#00ff41]/30">
                                                        {token.symbol?.charAt(0) ?? "?"}
                                                    </div>
                                                }
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-[#00ff41]/80 tracking-wider transition-colors group-hover:text-[#00ff41]">
                                                {token.name ?? shortenAddress(token.tokenMint)}
                                            </p>
                                            <div className="flex items-center gap-1.5">
                                                {token.symbol ? (
                                                    <span className="text-[10px] text-[#00ff41]/25 tracking-wider">
                                                        ${token.symbol}
                                                    </span>
                                                ) : null}
                                                <ProviderBadge provider={token.provider} className="scale-[0.8] origin-left" />
                                            </div>
                                        </div>
                                    </Link>
                                </td>
                                <td className="py-3 px-3 text-right">
                                    <div className="tracking-wider">
                                        <span className="text-[9px] text-[#00ff41]/24">{valuation.shortLabel}</span>
                                        <div className="text-[#00ff41]/60">{formatCurrency(valuation.value)}</div>
                                    </div>
                                </td>
                                <td className="py-3 px-3 text-right">
                                    <span className="text-[#00ff41]/40 tracking-wider">
                                        {formatCurrency(token.volume24hUsd)}
                                    </span>
                                </td>
                                <td className="py-3 px-3 text-right hidden sm:table-cell">
                                    {token.txCount24h !== undefined ? (
                                        <div className="text-[#00ff41]/40 tracking-wider">
                                            <span>{formatNumber(token.txCount24h)}</span>
                                            {token.buyCount24h !== undefined ? (
                                                <div className="text-[9px] text-[#00ff41]/20">
                                                    {token.buyCount24h}B / {token.sellCount24h ?? 0}S
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <span className="text-[#00ff41]/15">—</span>
                                    )}
                                </td>
                                <td className="py-3 px-3 text-right hidden lg:table-cell">
                                    {token.holderCount !== undefined && token.holderCount > 0 ? (
                                        <span className="text-[#00ff41]/40 tracking-wider">
                                            {formatNumber(token.holderCount)}
                                        </span>
                                    ) : (
                                        <span className="text-[#00ff41]/15">—</span>
                                    )}
                                </td>
                                <td className="py-3 px-3 text-right hidden xl:table-cell">
                                    <span className="text-[#00ff41]/40 tracking-wider">
                                        {formatCurrency(token.liquidityUsd)}
                                    </span>
                                </td>
                                <td className="py-3 px-3 text-right">
                                    <span className="text-[#00ff41]/60 tracking-wider">
                                        {formatCurrency(token.priceUsd, { compact: false, decimals: 6 })}
                                    </span>
                                </td>
                                <td className="py-3 px-3 text-right hidden sm:table-cell">
                                    {token.priceChange24h !== undefined ? (
                                        <span
                                            className={`tracking-wider ${
                                                token.priceChange24h >= 0 ? "text-[#00ff41]" : "text-[#ff4400]"
                                            }`}
                                        >
                                            {token.priceChange24h >= 0 ? "+" : ""}
                                            {token.priceChange24h.toFixed(1)}%
                                        </span>
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
