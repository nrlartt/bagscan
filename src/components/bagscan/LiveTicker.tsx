"use client";

import { ExternalLink, Radio, Rocket, AppWindow, Copy, Check } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { formatCurrency, shortenAddress } from "@/lib/utils";
import type { NormalizedToken } from "@/lib/bags/types";

interface LiveTickerProps {
    tokens: NormalizedToken[];
}

const SCAN_MINT = "BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS";
const SCAN_LINKS = {
    bags: "https://bags.fm/BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS",
    dexscreener: "https://dexscreener.com/solana/gcnkpzr8rjnsv973cnk81dx58yudedjtatwt2lu8lclt",
    hackathon: "https://bags.fm/apps/e982488c-b22c-42f6-ad86-d41e5d4aaa6b",
};
const SCAN_IMAGE_FALLBACK = "https://ipfs.io/ipfs/QmTGhFhBXSaRApTMwTuoX1uswHAbw4Br6kCfSTAMtt6Mta";

export function LiveTicker({ tokens }: LiveTickerProps) {
    const scanToken = useMemo(
        () =>
            tokens.find((token) => token.tokenMint === SCAN_MINT) ??
            tokens.find((token) => token.symbol?.toUpperCase() === "SCAN") ??
            null,
        [tokens]
    );

    const changePositive = (scanToken?.priceChange24h ?? 0) >= 0;

    return (
        <div className="mb-6 overflow-hidden border-2 border-[#00ff41]/20 bg-black/80">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#00ff41]/15 px-4 py-2.5">
                <div className="flex items-center gap-2">
                    <Radio className="h-3.5 w-3.5 animate-pulse text-[#00ff41]" />
                    <span className="text-[10px] tracking-[0.15em] text-[#00ff41]/60">
                        LIVE FEED
                    </span>
                    <span className="text-[9px] tracking-wider text-[#00ff41]/25">
                        $SCAN ECOSYSTEM PANEL
                    </span>
                </div>
                <div className="text-[9px] tracking-[0.15em] text-[#00ff41]/28">
                    BAGSCAN NATIVE TOKEN PROFILE
                </div>
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] lg:items-start">
                <div className="space-y-4">
                    <div className="flex flex-wrap items-start gap-3">
                        <div className="relative h-12 w-12 overflow-hidden border border-[#00ff41]/25 bg-[#00ff41]/[0.04] shadow-[0_0_18px_rgba(0,255,65,0.08)]">
                            <Image
                                src={scanToken?.image || SCAN_IMAGE_FALLBACK}
                                alt="$SCAN"
                                fill
                                className="object-cover"
                                unoptimized
                            />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span
                                    className="text-sm tracking-[0.16em] text-[#00ff41]"
                                    style={{ textShadow: "0 0 8px rgba(0,255,65,0.25)" }}
                                >
                                    $SCAN
                                </span>
                                <span className="border border-[#00ff41]/18 bg-[#00ff41]/8 px-2 py-1 text-[9px] tracking-[0.16em] text-[#9dffb8]">
                                    BAGSCAN NATIVE
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="border border-[#00ff41]/12 bg-[#00ff41]/[0.03] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[9px] tracking-[0.18em] text-[#00ff41]/34">CONTRACT ADDRESS</p>
                                <p className="mt-1 break-all text-[11px] tracking-[0.12em] text-[#d8ffe6]/78">
                                    {SCAN_MINT}
                                </p>
                            </div>
                            <CopyAddressButton value={SCAN_MINT} />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <ExternalChip href={SCAN_LINKS.bags} label="TRADE ON BAGS" icon={<Rocket className="h-3 w-3" />} />
                        <ExternalChip href={SCAN_LINKS.dexscreener} label="VIEW DEXSCREENER" icon={<ExternalLink className="h-3 w-3" />} />
                        <ExternalChip href={SCAN_LINKS.hackathon} label="BAGS HACKATHON APP" icon={<AppWindow className="h-3 w-3" />} />
                    </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                    <MetricCard
                        label="Ticker"
                        value="$SCAN"
                        hint={shortenAddress(SCAN_MINT, 6)}
                    />
                    <MetricCard
                        label="Bags Listing"
                        value="LIVE"
                        hint="bags.fm token page"
                    />
                    <MetricCard
                        label="Price"
                        value={
                            scanToken?.priceUsd !== undefined
                                ? formatCurrency(scanToken.priceUsd, {
                                    compact: false,
                                    decimals: scanToken.priceUsd < 0.01 ? 6 : 4,
                                })
                                : "TRACK ON DEX"
                        }
                        hint="live when indexed"
                    />
                    <MetricCard
                        label="24H Move"
                        value={
                            scanToken?.priceChange24h !== undefined
                                ? `${changePositive ? "+" : ""}${scanToken.priceChange24h.toFixed(1)}%`
                                : "LIVE"
                        }
                        hint={
                            scanToken?.volume24hUsd !== undefined
                                ? `VOL ${formatCurrency(scanToken.volume24hUsd)}`
                                : "dexscreener linked"
                        }
                        tone={
                            scanToken?.priceChange24h === undefined
                                ? "neutral"
                                : changePositive
                                    ? "positive"
                                    : "negative"
                        }
                    />
                </div>
            </div>
        </div>
    );
}

function ExternalChip({
    href,
    label,
    icon,
}: {
    href: string;
    label: string;
    icon: ReactNode;
}) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-[#00ff41]/18 bg-[#00ff41]/[0.03] px-3 py-2 text-[10px] tracking-[0.15em] text-[#9dffb8] transition-all hover:border-[#00ff41]/36 hover:bg-[#00ff41]/[0.08] hover:text-[#d8ffe6]"
        >
            {icon}
            {label}
        </a>
    );
}

function MetricCard({
    label,
    value,
    hint,
    tone = "neutral",
}: {
    label: string;
    value: string;
    hint: string;
    tone?: "neutral" | "positive" | "negative";
}) {
    return (
        <div className="border border-[#00ff41]/10 bg-black/45 p-3">
            <p className="text-[9px] tracking-[0.18em] text-[#00ff41]/34">{label}</p>
            <p
                className={[
                    "mt-2 text-sm tracking-[0.1em]",
                    tone === "positive"
                        ? "text-[#9dffb8]"
                        : tone === "negative"
                            ? "text-[#ff8f70]"
                            : "text-[#d8ffe6]",
                ].join(" ")}
            >
                {value}
            </p>
            <p className="mt-1 text-[10px] tracking-[0.16em] text-[#00ff41]/28">{hint}</p>
        </div>
    );
}

function CopyAddressButton({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);

    return (
        <button
            type="button"
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(value);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1400);
                } catch {
                    setCopied(false);
                }
            }}
            className="inline-flex items-center gap-1.5 border border-[#00ff41]/15 px-2.5 py-1.5 text-[10px] tracking-[0.15em] text-[#00ff41]/55 transition-colors hover:border-[#00ff41]/35 hover:text-[#00ff41]"
        >
            {copied ? <Check className="h-3 w-3 text-[#00ff41]" /> : <Copy className="h-3 w-3" />}
            {copied ? "COPIED" : "COPY CA"}
        </button>
    );
}
