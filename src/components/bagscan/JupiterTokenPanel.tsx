"use client";

import Image from "next/image";
import { ShieldCheck, ExternalLink, BadgeCheck } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { JupiterTokenDetail } from "@/lib/jupiter/types";

interface JupiterTokenPanelProps {
    data: JupiterTokenDetail;
}

function StatusPill({
    label,
    tone = "green",
}: {
    label: string;
    tone?: "green" | "blue" | "amber";
}) {
    const classes =
        tone === "blue"
            ? "border-[#8dd8ff]/25 bg-[#00aaff]/10 text-[#8dd8ff]/75"
            : tone === "amber"
                ? "border-[#ffaa00]/25 bg-[#ffaa00]/10 text-[#ffcf66]/75"
                : "border-[#00ff41]/25 bg-[#00ff41]/10 text-[#9cffba]/75";

    return (
        <span
            className={`inline-flex items-center gap-1 border px-2 py-1 text-[9px] tracking-[0.18em] ${classes}`}
        >
            <BadgeCheck className="h-3 w-3" />
            {label}
        </span>
    );
}

function MiniMetric({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="border border-[#00ff41]/12 bg-[#00ff41]/[0.035] px-3 py-3">
            <p className="text-[9px] tracking-[0.18em] text-[#00ff41]/36">{label}</p>
            <p className="mt-2 text-sm tracking-[0.12em] text-[#d8ffe6]/88">{value}</p>
        </div>
    );
}

export function JupiterTokenPanel({ data }: JupiterTokenPanelProps) {
    return (
        <div className="crt-panel animate-slide-in-right overflow-hidden border border-[#8dd8ff]/14 bg-[linear-gradient(180deg,rgba(0,170,255,0.07),rgba(0,0,0,0.42))] p-0 shadow-[0_0_26px_rgba(0,170,255,0.06)]">
            <div className="border-b border-[#8dd8ff]/10 px-4 py-4">
                <div className="panel-header flex items-center gap-2 text-[#8dd8ff]/78">
                    <ShieldCheck className="h-4 w-4 text-[#8dd8ff]/65" />
                    ╔══ JUPITER MARKET INTEL ══╗
                </div>
            </div>

            <div className="space-y-4 px-4 py-4">
                <div className="flex items-start gap-3">
                    {data.icon ? (
                        <div className="relative h-11 w-11 overflow-hidden border border-[#8dd8ff]/18 bg-[#8dd8ff]/[0.04]">
                            <Image src={data.icon} alt={data.name ?? data.symbol ?? "Jupiter token"} fill className="object-cover" unoptimized />
                        </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm tracking-[0.12em] text-[#d8ffe6]/9">
                                {data.name ?? data.symbol ?? "Jupiter Token"}
                            </h3>
                            {data.symbol ? (
                                <span className="border border-[#8dd8ff]/18 px-2 py-0.5 text-[9px] tracking-[0.18em] text-[#8dd8ff]/68">
                                    ${data.symbol}
                                </span>
                            ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {data.verified ? <StatusPill label="VERIFIED" /> : null}
                            {data.strict ? <StatusPill label="STRICT" tone="blue" /> : null}
                            {data.organicScore !== null && data.organicScore !== undefined ? (
                                <StatusPill label={`ORGANIC ${Math.round(data.organicScore)}`} tone="amber" />
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {data.marketCap ? (
                        <MiniMetric label="JUP MARKET CAP" value={formatCurrency(data.marketCap)} />
                    ) : null}
                    {data.liquidity ? (
                        <MiniMetric label="JUP LIQUIDITY" value={formatCurrency(data.liquidity)} />
                    ) : null}
                    {data.volume24h ? (
                        <MiniMetric label="24H VOLUME" value={formatCurrency(data.volume24h)} />
                    ) : null}
                    {data.holderCount ? (
                        <MiniMetric label="HOLDER COUNT" value={formatNumber(data.holderCount)} />
                    ) : null}
                    {data.priceChange24h !== null && data.priceChange24h !== undefined ? (
                        <MiniMetric
                            label="24H MOVE"
                            value={`${data.priceChange24h >= 0 ? "+" : ""}${data.priceChange24h.toFixed(2)}%`}
                        />
                    ) : null}
                    {data.audit?.topHoldersPercentage !== null && data.audit?.topHoldersPercentage !== undefined ? (
                        <MiniMetric
                            label="TOP HOLDERS"
                            value={`${data.audit.topHoldersPercentage.toFixed(2)}%`}
                        />
                    ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                    <a
                        href={data.jupiterTokenPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 border border-[#8dd8ff]/25 bg-[#00aaff]/10 px-3 py-2 text-[10px] tracking-[0.16em] text-[#8dd8ff]/78 transition hover:bg-[#00aaff]/18 hover:text-[#b7e8ff]"
                    >
                        OPEN JUPITER TOKEN PAGE
                        <ExternalLink className="h-3 w-3" />
                    </a>
                    {data.twitter ? (
                        <a
                            href={data.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 border border-[#00ff41]/18 bg-[#00ff41]/8 px-3 py-2 text-[10px] tracking-[0.16em] text-[#9cffba]/72 transition hover:bg-[#00ff41]/14 hover:text-[#c9ffd7]"
                        >
                            PROJECT X
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
