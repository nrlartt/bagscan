"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import { useRouter, useSearchParams } from "next/navigation";
import bs58 from "bs58";
import {
    ArrowLeft,
    ArrowUpRight,
    CheckCircle2,
    ChevronDown,
    ExternalLink,
    Loader2,
    Target,
    Wallet,
    XCircle,
} from "lucide-react";
import type {
    JupiterPredictionEvent,
    JupiterPredictionPosition,
    JupiterPredictionTradingStatus,
} from "@/lib/jupiter/types";
import { SCAN_BAGS_URL, SCAN_SYMBOL } from "@/lib/scan/constants";
import { cn, formatCurrency, formatNumber, shortenAddress } from "@/lib/utils";
import { getExplorerUrl } from "@/lib/solana";
import { sendSignedTransactionWithRetry } from "./send-signed-transaction";

interface EventPayload {
    tradingStatus: JupiterPredictionTradingStatus;
    event: JupiterPredictionEvent;
    relatedEvents: JupiterPredictionEvent[];
}

function isAlreadyProcessedMessage(message: string) {
    return /alreadyprocessed|already been processed/i.test(message);
}

function isRegionBlockedMessage(message: string) {
    return /trading is not available in your region|not available in your region/i.test(message);
}

function isJupiterRateLimitMessage(message: string) {
    return /jupiter|jup\.ag|api\.jup|ultra\/v1|prediction\/v1|credits|developer portal|plan limit/i.test(
        message
    );
}

function normalizePredictionUiError(message: string) {
    if (isAlreadyProcessedMessage(message)) {
        return "This transaction was already submitted. BagScan is checking the live result now.";
    }

    if (isRegionBlockedMessage(message)) {
        return "Prediction trading is currently unavailable for this region or environment.";
    }

    if (/429|too many requests|rate limit/i.test(message)) {
        if (isJupiterRateLimitMessage(message)) {
            return "Jupiter APIs are rate-limiting this action. Please wait a few seconds and try again. A higher Jupiter Developer plan increases shared limits.";
        }
        if (/solana|jsonrpc|blockhash|signature verification|sendtransaction/i.test(message)) {
            return "Solana RPC rate limits were hit. Ensure HELIUS_API_KEY is set on the server, wait briefly, and try again.";
        }
        return "This step was rate-limited. Wait a few seconds and retry. Production needs HELIUS_API_KEY for Solana and enough Jupiter API quota for swaps and prediction.";
    }

    return message;
}

function EventHeroSection({
    event,
    marketsCount,
    selectedChance,
    selectedPrice,
    side,
}: {
    event: JupiterPredictionEvent;
    marketsCount: number;
    selectedChance: number | null;
    selectedPrice: number | null;
    side: "YES" | "NO";
}) {
    return (
        <section className="mb-6 border border-[#00ff41]/14 bg-[radial-gradient(circle_at_top,rgba(0,255,65,0.08),transparent_38%),linear-gradient(180deg,rgba(2,18,10,0.96),rgba(0,0,0,0.94))] p-5 sm:p-6">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_320px]">
                <div className="border border-[#00ff41]/12 bg-black/24 p-5">
                    <div className="flex items-start gap-4">
                        <PredictionImageThumb title={event.title} imageUrl={event.imageUrl} size="hero" />
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#ffaa00]/74">
                                <span>{(event.category ?? "Prediction").toUpperCase()}</span>
                                <span className="text-[#00ff41]/36">/</span>
                                <span>{event.status ?? "live"}</span>
                                {event.closeTime ? (
                                    <>
                                        <span className="text-[#00ff41]/36">/</span>
                                        <span>{formatDateCompact(event.closeTime)}</span>
                                    </>
                                ) : null}
                            </div>
                            <h1 className="mt-3 max-w-4xl text-2xl tracking-[0.14em] text-[#f2fff6] sm:text-4xl sm:tracking-[0.18em]">
                                {event.title}
                            </h1>
                            {event.description ? (
                                <p className="mt-4 max-w-4xl text-sm leading-7 text-[#d8ffe6]/64 line-clamp-3">{event.description}</p>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="border border-[#ffaa00]/18 bg-[linear-gradient(180deg,rgba(255,170,0,0.08),rgba(0,0,0,0.16))] p-4">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-[#ffaa00]/72">Active Position Lens</p>
                        <span className="text-[10px] uppercase tracking-[0.18em] text-[#ffaa00]/46">
                            {marketsCount} markets
                        </span>
                    </div>
                    <div className="mt-4 grid gap-3">
                        <div className="border border-[#ffaa00]/14 bg-black/18 p-4">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[#00ff41]/36">Current Side</p>
                            <p className={side === "YES" ? "mt-2 text-3xl tracking-[0.14em] text-[#e7ffc1]" : "mt-2 text-3xl tracking-[0.14em] text-[#d2f4ff]"}>
                                {side}
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <MiniMetric label="Chance" value={selectedChance !== null ? `${selectedChance.toFixed(1)}%` : "--"} />
                            <MiniMetric
                                label="Price"
                                value={selectedPrice !== null ? formatCurrency(selectedPrice, { compact: false, decimals: 2 }) : "--"}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Market Volume" value={formatCurrency(event.volumeUsd)} hint="Live event volume across the active contract board." />
                <MetricCard label="Markets" value={formatNumber(marketsCount, false)} hint="Open outcomes available for fast selection." />
                <MetricCard label="Selected Chance" value={selectedChance !== null ? `${selectedChance.toFixed(1)}%` : "--"} hint={`${side} side probability from the selected market.`} />
                <MetricCard label="Selected Price" value={selectedPrice !== null ? formatCurrency(selectedPrice, { compact: false, decimals: 2 }) : "--"} hint="Current price for the side you are preparing to enter." />
            </div>
        </section>
    );
}

function MarketBoardSection({
    markets,
    selectedMarket,
    side,
    onSelectMarket,
    onSelectSide,
    rulesSummary,
}: {
    markets: JupiterPredictionEvent["markets"];
    selectedMarket: JupiterPredictionEvent["markets"][number] | null;
    side: "YES" | "NO";
    onSelectMarket: (marketId: string) => void;
    onSelectSide: (side: "YES" | "NO") => void;
    rulesSummary?: string;
}) {
    const shouldScroll = markets.length > 6;

    return (
        <section className="border border-[#00ff41]/12 bg-black/24 p-5">
            <div className="flex items-center justify-between gap-3">
                <div className="panel-header flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#ffaa00]/60" />
                    Live Outcome Board
                </div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#00ff41]/38">
                    {markets.length} live markets
                </div>
            </div>

            <div
                className={cn(
                    "mt-5 space-y-3",
                    shouldScroll && "max-h-[760px] overflow-y-auto pr-2"
                )}
            >
                {markets.map((market) => {
                    const yesProbability = market.yesProbability ?? 0;
                    const noProbability = market.noProbability ?? Math.max(0, 100 - yesProbability);
                    const active = market.marketId === selectedMarket?.marketId;
                    return (
                        <div
                            key={market.marketId}
                            className={
                                active
                                    ? "border border-[#ffaa00]/38 bg-[linear-gradient(180deg,rgba(255,170,0,0.10),rgba(255,170,0,0.03))] p-4 shadow-[0_0_26px_rgba(255,170,0,0.08)]"
                                    : "border border-[#00ff41]/10 bg-[#00ff41]/[0.03] p-4 transition hover:border-[#00ff41]/24 hover:bg-[#00ff41]/[0.05]"
                            }
                        >
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                <div className="flex min-w-0 items-start gap-3">
                                    <PredictionImageThumb title={market.title} imageUrl={market.imageUrl} size="market" />
                                    <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#00ff41]/42">
                                        {active ? (
                                            <span className="border border-[#ffaa00]/28 bg-[#ffaa00]/10 px-2 py-1 text-[#ffd37a]">
                                                Active Market
                                            </span>
                                        ) : null}
                                        <span>{(market.status ?? "open").toUpperCase()}</span>
                                        {market.closeTime ? <span>{formatDateCompact(market.closeTime)}</span> : null}
                                        <span>{formatCurrency(market.volumeUsd)} vol</span>
                                    </div>
                                    <h2 className="mt-2 text-[15px] tracking-[0.1em] text-[#d8ffe6]">{market.title}</h2>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 xl:min-w-[360px]">
                                    <ProbabilityStrip label="Yes" value={yesProbability} tone="yes" />
                                    <ProbabilityStrip label="No" value={noProbability} tone="no" />
                                </div>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_120px]">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSelectMarket(market.marketId);
                                        onSelectSide("YES");
                                    }}
                                    className={
                                        active && side === "YES"
                                            ? "border border-[#adcc60]/50 bg-[linear-gradient(180deg,rgba(173,204,96,0.18),rgba(173,204,96,0.08))] px-3 py-3 text-[11px] uppercase tracking-[0.22em] text-[#f1ffd1] shadow-[0_0_18px_rgba(173,204,96,0.10)] transition"
                                            : "border border-[#adcc60]/18 bg-[#adcc60]/[0.05] px-3 py-3 text-[11px] uppercase tracking-[0.22em] text-[#d3ee9d] transition hover:border-[#adcc60]/34 hover:bg-[#adcc60]/[0.10]"
                                    }
                                >
                                    Select Yes
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSelectMarket(market.marketId);
                                        onSelectSide("NO");
                                    }}
                                    className={
                                        active && side === "NO"
                                            ? "border border-[#00aaff]/50 bg-[linear-gradient(180deg,rgba(0,170,255,0.18),rgba(0,170,255,0.08))] px-3 py-3 text-[11px] uppercase tracking-[0.22em] text-[#d2f4ff] shadow-[0_0_18px_rgba(0,170,255,0.10)] transition"
                                            : "border border-[#00aaff]/18 bg-[#00aaff]/[0.05] px-3 py-3 text-[11px] uppercase tracking-[0.22em] text-[#8dd8ff] transition hover:border-[#00aaff]/34 hover:bg-[#00aaff]/[0.10]"
                                    }
                                >
                                    Select No
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onSelectMarket(market.marketId)}
                                    className={
                                        active
                                            ? "border border-[#ffaa00]/34 bg-[#ffaa00]/10 px-3 py-3 text-[11px] uppercase tracking-[0.22em] text-[#ffd37a] transition"
                                            : "border border-[#00ff41]/12 bg-black/22 px-3 py-3 text-[11px] uppercase tracking-[0.22em] text-[#00ff41]/58 transition hover:border-[#00ff41]/28"
                                    }
                                >
                                    Inspect
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_280px]">
                <div className="border border-white/8 bg-white/[0.02] p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/54">Rules Summary</p>
                    <p className="mt-3 text-sm leading-7 text-white/72">
                        {rulesSummary ?? "Review the active market title, timing, and live odds before entering a position."}
                    </p>
                </div>
                <div className="border border-[#ffaa00]/12 bg-[#ffaa00]/[0.04] p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#ffaa00]/62">Active Market Summary</p>
                    <div className="mt-4 space-y-3">
                        <MiniMetric
                            label="Outcome"
                            value={selectedMarket?.title ?? "Choose a market"}
                        />
                        <MiniMetric
                            label="Closes"
                            value={selectedMarket?.closeTime ? formatDateCompact(selectedMarket.closeTime) : "Live"}
                        />
                        <MiniMetric
                            label="Volume"
                            value={formatCurrency(selectedMarket?.volumeUsd)}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}

function EventPositionsSection({
    connected,
    positionsLoading,
    eventPositions,
    claimingPosition,
    closingPosition,
    onClaim,
    onClose,
}: {
    connected: boolean;
    positionsLoading: boolean;
    eventPositions: JupiterPredictionPosition[];
    claimingPosition: string | null;
    closingPosition: string | null;
    onClaim: (positionPubkey: string) => void;
    onClose: (positionPubkey: string) => void;
}) {
    return (
        <section className="border border-[#00ff41]/12 bg-[#00ff41]/[0.02] p-4">
            <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#00ff41]/54">Your Event Positions</p>
                {connected ? (
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[#00ff41]/34">
                        {formatNumber(eventPositions.length, false)} visible
                    </span>
                ) : null}
            </div>

            {!connected ? (
                <div className="mt-4 border border-[#00ff41]/12 bg-black/20 px-4 py-4 text-[11px] tracking-[0.14em] text-[#00ff41]/52">
                    Connect a wallet to see positions tied to this event.
                </div>
            ) : positionsLoading ? (
                <div className="mt-4 flex min-h-[120px] items-center justify-center border border-[#00ff41]/12 bg-black/16">
                    <Loader2 className="h-4 w-4 animate-spin text-[#00ff41]/56" />
                </div>
            ) : eventPositions.length === 0 ? (
                <div className="mt-4 border border-[#00ff41]/12 bg-black/20 px-4 py-4 text-[11px] tracking-[0.14em] text-[#00ff41]/52">
                    No positions are visible for this event yet.
                </div>
            ) : (
                <div className="mt-4 space-y-3">
                    {eventPositions.map((position) => {
                        const claimable = (position.status ?? "").toLowerCase() === "claimable";
                        const closable = !claimable && !["claimed", "closed"].includes((position.status ?? "").toLowerCase());
                        const busyClaim = claimingPosition === position.positionPubkey;
                        const busyClose = closingPosition === position.positionPubkey;

                        return (
                            <div key={position.positionPubkey} className="border border-[#00ff41]/10 bg-black/24 p-4">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#ffaa00]/72">
                                            <span>{position.side ?? "POSITION"}</span>
                                            <span className="text-[#00ff41]/34">/</span>
                                            <span>{(position.status ?? "open").toUpperCase()}</span>
                                        </div>
                                        <h3 className="mt-2 text-sm tracking-[0.12em] text-[#d8ffe6]">
                                            {position.marketTitle ?? shortenAddress(position.positionPubkey, 6)}
                                        </h3>
                                    </div>
                                    <div className="grid min-w-0 gap-3 sm:grid-cols-4">
                                        <MiniMetric label="Contracts" value={position.quantity !== null && position.quantity !== undefined ? formatNumber(position.quantity, false) : "--"} />
                                        <MiniMetric label="Avg Price" value={position.averagePrice !== null && position.averagePrice !== undefined ? formatCurrency(position.averagePrice, { compact: false, decimals: 2 }) : "--"} />
                                        <MiniMetric label="Mark" value={position.currentPrice !== null && position.currentPrice !== undefined ? formatCurrency(position.currentPrice, { compact: false, decimals: 2 }) : "--"} />
                                        <MiniMetric label="PnL" value={position.unrealizedPnlUsd !== null && position.unrealizedPnlUsd !== undefined ? formatCurrency(position.unrealizedPnlUsd, { compact: false, decimals: 2 }) : "--"} />
                                    </div>
                                </div>

                                {(claimable || closable) ? (
                                    <div className="mt-4 flex flex-wrap gap-3">
                                        {claimable ? (
                                            <button
                                                type="button"
                                                onClick={() => onClaim(position.positionPubkey)}
                                                disabled={busyClaim}
                                                className="inline-flex items-center gap-2 border border-[#ffaa00]/28 bg-[#ffaa00]/10 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-[#ffd37a] transition hover:border-[#ffaa00]/54 hover:bg-[#ffaa00]/14 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                {busyClaim ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                                Claim
                                            </button>
                                        ) : null}
                                        {closable ? (
                                            <button
                                                type="button"
                                                onClick={() => onClose(position.positionPubkey)}
                                                disabled={busyClose}
                                                className="inline-flex items-center gap-2 border border-[#ff4400]/28 bg-[#ff4400]/10 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-[#ffb39a] transition hover:border-[#ff4400]/54 hover:bg-[#ff4400]/14 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                {busyClose ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                                                Close To $SCAN
                                            </button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

function PredictionEntryPanel({
    connected,
    selectedMarket,
    side,
    scanAmountUi,
    slippageBps,
    prepare,
    fundingSig,
    predictionSig,
    orderPubkey,
    orderStatus,
    tradingOpen,
    busy,
    error,
    primaryActionLabel,
    onAmountChange,
    onSlippageChange,
    onSideChange,
    onEnter,
    onConnect,
}: {
    connected: boolean;
    selectedMarket: JupiterPredictionEvent["markets"][number] | null;
    side: "YES" | "NO";
    scanAmountUi: string;
    slippageBps: string;
    prepare: PrepareData | null;
    fundingSig: string | null;
    predictionSig: string | null;
    orderPubkey: string | null;
    orderStatus: string | null;
    tradingOpen: boolean;
    busy: boolean;
    error: string | null;
    primaryActionLabel: string;
    onAmountChange: (value: string) => void;
    onSlippageChange: (value: string) => void;
    onSideChange: (value: "YES" | "NO") => void;
    onEnter: () => void;
    onConnect: () => void;
}) {
    return (
        <aside className="h-fit border border-[#ffaa00]/18 bg-[linear-gradient(180deg,rgba(255,170,0,0.08),rgba(0,0,0,0.18))] p-4 sm:p-5 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6.5rem)] xl:overflow-y-auto">
            <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#ffaa00]/76">Enter Position</div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#ffaa00]/54">$SCAN only</div>
            </div>

            <div className="mt-4 border border-[#ffaa00]/14 bg-black/22 p-4">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#ffaa00]/52">Selected Market</p>
                    <span
                        className={
                            side === "YES"
                                ? "border border-[#adcc60]/32 bg-[#adcc60]/12 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[#e7ffc1]"
                                : "border border-[#00aaff]/32 bg-[#00aaff]/12 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[#d2f4ff]"
                        }
                    >
                        {side} active
                    </span>
                </div>
                <h2 className="mt-2 text-[15px] tracking-[0.12em] text-[#fff5d4]">
                    {selectedMarket?.title ?? "Choose a market"}
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                    <MiniMetric label="YES" value={formatOdds(selectedMarket?.yesPrice, selectedMarket?.yesProbability)} />
                    <MiniMetric label="NO" value={formatOdds(selectedMarket?.noPrice, selectedMarket?.noProbability)} />
                </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
                {(["YES", "NO"] as const).map((value) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => onSideChange(value)}
                        className={
                            side === value
                                ? value === "YES"
                                    ? "border border-[#adcc60]/48 bg-[linear-gradient(180deg,rgba(173,204,96,0.18),rgba(173,204,96,0.08))] px-3 py-4 text-[12px] uppercase tracking-[0.24em] text-[#f1ffd1] shadow-[0_0_18px_rgba(173,204,96,0.10)] transition"
                                    : "border border-[#00aaff]/48 bg-[linear-gradient(180deg,rgba(0,170,255,0.18),rgba(0,170,255,0.08))] px-3 py-4 text-[12px] uppercase tracking-[0.24em] text-[#d2f4ff] shadow-[0_0_18px_rgba(0,170,255,0.10)] transition"
                                : "border border-[#00ff41]/12 bg-black/24 px-3 py-4 text-[12px] uppercase tracking-[0.24em] text-[#00ff41]/52 transition hover:border-[#00ff41]/28 hover:bg-[#00ff41]/[0.06]"
                        }
                    >
                        {value}
                    </button>
                ))}
            </div>

            <div className="mt-4 border border-white/8 bg-black/22 p-4">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/54">Entry Summary</p>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-white/38">
                        One-click flow
                    </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <MiniMetric label="Side" value={side} />
                    <MiniMetric label="Odds" value={formatOdds(side === "YES" ? selectedMarket?.yesPrice : selectedMarket?.noPrice, side === "YES" ? selectedMarket?.yesProbability : selectedMarket?.noProbability)} />
                    <MiniMetric label="Funding" value={`${formatNumber(Number(scanAmountUi || 0), false)} $SCAN`} />
                </div>
            </div>

            <label className="mt-4 block">
                <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-[#00ff41]/38">
                    Funding Amount ($SCAN)
                </span>
                <input
                    value={scanAmountUi}
                    onChange={(e) => onAmountChange(e.target.value)}
                    type="number"
                    min="0"
                    step="1"
                    className="w-full border border-[#00ff41]/18 bg-black/45 px-3 py-3 text-sm tracking-[0.12em] text-[#d8ffe6] outline-none transition focus:border-[#00ff41]/42"
                />
            </label>

            <div className="mt-4 grid grid-cols-3 gap-2">
                {["1000000", "10000000", "100000000"].map((amount) => (
                    <button
                        key={amount}
                        type="button"
                        onClick={() => onAmountChange(amount)}
                        className="border border-[#00ff41]/12 bg-[#00ff41]/[0.04] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-[#9cffba] transition hover:border-[#00ff41]/28 hover:bg-[#00ff41]/[0.1]"
                    >
                        {formatNumber(Number(amount), false)}
                    </button>
                ))}
            </div>

            {error ? <ErrorPanel compact message={error} /> : null}

            <ActionButton
                label={primaryActionLabel}
                icon={!connected ? <Wallet className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                onClick={connected ? onEnter : onConnect}
                busy={busy}
                disabled={!selectedMarket || !tradingOpen}
                tone={side === "YES" ? "yes" : "no"}
            />

            <details className="mt-4 border border-white/8 bg-white/[0.02]">
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-white/62">
                    Advanced Entry Settings
                    <ChevronDown className="h-3.5 w-3.5" />
                </summary>
                <div className="border-t border-white/8 px-4 py-4">
                    <label className="block">
                        <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-[#00ff41]/34">
                            Slippage (bps)
                        </span>
                        <input
                            value={slippageBps}
                            onChange={(e) => onSlippageChange(e.target.value)}
                            type="number"
                            min="0"
                            max="5000"
                            step="10"
                            className="w-full border border-[#00ff41]/18 bg-black/45 px-3 py-3 text-sm tracking-[0.12em] text-[#d8ffe6] outline-none transition focus:border-[#00ff41]/42"
                        />
                    </label>
                    {prepare ? (
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <MiniMetric label="Quoted USDC" value={prepare.quotedOutUi} />
                            <MiniMetric label="Reserved" value={prepare.reservedOutUi} />
                            <MiniMetric label="Buffer" value={prepare.leftoverUi} />
                            <MiniMetric label="Model" value={`${prepare.reserveBps / 100}%`} />
                        </div>
                    ) : (
                        <p className="mt-4 text-[10px] leading-5 tracking-[0.14em] text-white/52">
                            A funding preview is generated automatically on your first entry attempt.
                        </p>
                    )}
                </div>
            </details>

            {(fundingSig || predictionSig || orderPubkey || orderStatus) ? (
                <div className="mt-4 border border-[#00ff41]/12 bg-black/30 px-4 py-4 text-[10px] tracking-[0.16em] text-[#d8ffe6]/72">
                    {fundingSig ? <StatusLine label="Funding swap" value="CONFIRMED" href={getExplorerUrl(fundingSig)} /> : null}
                    {predictionSig ? <StatusLine label="Prediction tx" value="SENT" href={getExplorerUrl(predictionSig)} /> : null}
                    {orderPubkey ? <StatusLine label="Order pubkey" value={shortenAddress(orderPubkey, 6)} /> : null}
                    {orderStatus ? <StatusLine label="Order status" value={orderStatus.toUpperCase()} /> : null}
                </div>
            ) : null}

            <div className="mt-4 text-[10px] leading-5 tracking-[0.14em] text-white/54">
                This flow funds prediction positions with <span className="text-[#00ff41]">${SCAN_SYMBOL}</span>. It is not investment advice.
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                <Link
                    href={SCAN_BAGS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 border border-[#00ff41]/18 bg-[#00ff41]/8 px-3 py-2 text-[10px] tracking-[0.16em] text-[#9cffba]/74 transition hover:bg-[#00ff41]/14 hover:text-[#d8ffe6]"
                >
                    Get $SCAN
                    <ExternalLink className="h-3 w-3" />
                </Link>
            </div>
        </aside>
    );
}

function RelatedEventsPanel({ relatedEvents }: { relatedEvents: JupiterPredictionEvent[] }) {
    return (
        <section className="border border-[#00ff41]/12 bg-black/22 p-4">
            <div className="panel-header">Related Events</div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {relatedEvents.length === 0 ? (
                    <div className="border border-[#00ff41]/10 bg-[#00ff41]/[0.03] px-4 py-4 text-[11px] tracking-[0.14em] text-[#00ff41]/50 lg:col-span-2 xl:col-span-3">
                        No closely related live events were available on this pass.
                    </div>
                ) : (
                    relatedEvents.map((item) => (
                        <Link
                            key={item.eventId}
                            href={`/prediction/${encodeURIComponent(item.eventId)}`}
                            className="group block border border-[#00ff41]/10 bg-[#00ff41]/[0.03] p-4 transition hover:border-[#00ff41]/24 hover:bg-[#00ff41]/[0.06]"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-start gap-3">
                                    <PredictionImageThumb title={item.title} imageUrl={item.imageUrl} size="related" />
                                    <div className="min-w-0">
                                        <p className="text-[10px] uppercase tracking-[0.18em] text-[#ffaa00]/60">
                                            {item.category ?? "Prediction"}
                                        </p>
                                        <h3 className="mt-2 line-clamp-2 text-sm tracking-[0.08em] text-[#d8ffe6]">
                                            {item.title}
                                        </h3>
                                    </div>
                                </div>
                                <ArrowUpRight className="h-4 w-4 shrink-0 text-[#00ff41]/34 transition group-hover:text-[#00ff41]/66" />
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.16em] text-[#00ff41]/40">
                                <span>{formatCurrency(item.volumeUsd)} vol</span>
                                <span>{formatNumber(item.markets.length, false)} markets</span>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </section>
    );
}

interface PrepareData {
    fundingOrder: Record<string, unknown>;
    quotedOutUi: string;
    reservedOutUi: string;
    reservedOutRaw: string;
    leftoverUi: string;
    reserveBps: number;
}

interface PredictionUsdcBalance {
    rawAmount: string;
    uiAmount: string;
    decimals: number;
}

export function PredictionEventTerminal({ eventId }: { eventId: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialMarketId = searchParams.get("market") ?? "";

    const { connected, publicKey, signTransaction } = useWallet();
    const { setVisible } = useWalletModal();
    const wallet = publicKey?.toBase58() ?? "";

    const [marketId, setMarketId] = useState(initialMarketId);
    const [side, setSide] = useState<"YES" | "NO">("YES");
    const [scanAmountUi, setScanAmountUi] = useState("1000000");
    const [slippageBps, setSlippageBps] = useState("250");
    const [prepare, setPrepare] = useState<PrepareData | null>(null);
    const [fundingSig, setFundingSig] = useState<string | null>(null);
    const [predictionSig, setPredictionSig] = useState<string | null>(null);
    const [orderPubkey, setOrderPubkey] = useState<string | null>(null);
    const [orderStatus, setOrderStatus] = useState<string | null>(null);
    const [claimingPosition, setClaimingPosition] = useState<string | null>(null);
    const [closingPosition, setClosingPosition] = useState<string | null>(null);
    const [busy, setBusy] = useState<"enter" | "claim" | "close" | null>(null);
    const [error, setError] = useState<string | null>(null);

    const eventQuery = useQuery<EventPayload>({
        queryKey: ["prediction-event", eventId],
        queryFn: async () => {
            const res = await fetch(`/api/prediction/event/${encodeURIComponent(eventId)}`);
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Prediction event could not be loaded.");
            return json.data;
        },
        staleTime: 60_000,
        refetchInterval: 90_000,
    });

    const positions = useQuery<JupiterPredictionPosition[]>({
        queryKey: ["prediction-positions", wallet],
        enabled: connected && Boolean(wallet),
        queryFn: async () => {
            const res = await fetch(`/api/prediction/positions?ownerPubkey=${encodeURIComponent(wallet)}`);
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Prediction positions could not be loaded.");
            return json.data;
        },
        staleTime: 20_000,
        refetchInterval: connected ? 45_000 : false,
    });

    const event = eventQuery.data?.event ?? null;
    const relatedEvents = eventQuery.data?.relatedEvents ?? [];
    const markets = useMemo(
        () => event?.markets.filter((item) => (item.status ?? "").toLowerCase() !== "closed") ?? [],
        [event]
    );
    const selectedMarket = useMemo(
        () => markets.find((item) => item.marketId === marketId) ?? markets[0] ?? null,
        [marketId, markets]
    );
    const eventPositions = useMemo(() => {
        if (!event) return [];
        return (positions.data ?? []).filter((position) => position.eventId === event.eventId);
    }, [event, positions.data]);
    const selectedChance = useMemo(() => {
        if (!selectedMarket) return null;
        return side === "YES" ? selectedMarket.yesProbability ?? null : selectedMarket.noProbability ?? null;
    }, [selectedMarket, side]);
    const selectedPrice = useMemo(() => {
        if (!selectedMarket) return null;
        return side === "YES" ? selectedMarket.yesPrice ?? null : selectedMarket.noPrice ?? null;
    }, [selectedMarket, side]);

    useEffect(() => {
        if (markets.length > 0 && !markets.some((item) => item.marketId === marketId)) {
            setMarketId(markets[0]?.marketId ?? "");
        }
    }, [marketId, markets]);

    useEffect(() => {
        setPrepare(null);
        setFundingSig(null);
        setPredictionSig(null);
        setOrderPubkey(null);
        setOrderStatus(null);
        setError(null);
    }, [marketId, side, scanAmountUi, slippageBps]);

    async function refetchPositionsUntil(
        predicate: (items: JupiterPredictionPosition[]) => boolean,
        attempts = 6,
        delayMs = 1500
    ) {
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            const result = await positions.refetch();
            const nextItems = result.data ?? positions.data ?? [];
            if (predicate(nextItems)) {
                return true;
            }
            if (attempt < attempts - 1) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }

        return false;
    }

    function selectMarket(nextMarketId: string) {
        setMarketId(nextMarketId);
        const params = new URLSearchParams(searchParams.toString());
        params.set("market", nextMarketId);
        router.replace(`/prediction/${encodeURIComponent(eventId)}?${params.toString()}`, { scroll: false });
    }

    async function prepareFundingRequest() {
        if (!wallet) throw new Error("Connect a wallet to continue.");

        const res = await fetch("/api/prediction/prepare", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ownerPubkey: wallet,
                scanAmountUi: Number(scanAmountUi),
                slippageBps: Number(slippageBps),
            }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Funding preview failed.");
        setPrepare(json.data);
        return json.data as PrepareData;
    }

    async function getPredictionUsdcBalance() {
        if (!wallet) throw new Error("Connect a wallet to continue.");

        const res = await fetch(`/api/prediction/usdc-balance?ownerPubkey=${encodeURIComponent(wallet)}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "USDC balance could not be checked.");
        return json.data as PredictionUsdcBalance;
    }

    async function waitForSettlementOrder(baselineRaw: string, attempts = 10, delayMs = 1500) {
        if (!wallet) throw new Error("Connect a wallet to continue.");

        for (let attempt = 0; attempt < attempts; attempt += 1) {
            const settlementRes = await fetch("/api/prediction/settlement", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ownerPubkey: wallet,
                    baselineRaw,
                    slippageBps: Number(slippageBps),
                }),
            });
            const settlementJson = await settlementRes.json();

            if (!settlementJson.success) {
                throw new Error(
                    normalizePredictionUiError(
                        settlementJson.error || "Position closed, but auto-convert to $SCAN could not be prepared."
                    )
                );
            }

            if (!settlementJson.data?.skipped) {
                return settlementJson.data;
            }

            if (attempt < attempts - 1) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }

        throw new Error(
            "Position closed, but the settlement funds have not landed yet. Please try the close-to-$SCAN step again in a moment."
        );
    }

    async function settleUsdcDeltaBackToScan(
        baselineRaw: string,
        fallbackMessage: string,
        attempts = 10,
        delayMs = 1500
    ) {
        if (!signTransaction) {
            throw new Error(fallbackMessage);
        }

        const settlementData = await waitForSettlementOrder(baselineRaw, attempts, delayMs);
        const settlementTx = getStringField(
            settlementData?.settlementOrder,
            "transaction",
            "serializedTransaction",
            "swapTransaction"
        );
        const requestId = getStringField(
            settlementData?.settlementOrder,
            "requestId",
            "quoteRequestId",
            "id"
        );

        if (!settlementTx || !requestId) {
            throw new Error(fallbackMessage);
        }

        const signedSettlement = await signTransaction(
            VersionedTransaction.deserialize(decodeTransactionData(settlementTx))
        );

        const executeRes = await fetch("/api/prediction/settlement-execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                requestId,
                signedTransaction: uint8ArrayToBase64(signedSettlement.serialize()),
            }),
        });
        const executeJson = await executeRes.json();
        if (!executeJson.success) {
            throw new Error(
                normalizePredictionUiError(
                    executeJson.error || fallbackMessage
                )
            );
        }

        return executeJson.data as Record<string, unknown>;
    }

    async function verifyPredictionEligibility(prepared: PrepareData) {
        if (!wallet || !selectedMarket) {
            throw new Error("Choose a live market first.");
        }

        const eligibilityRes = await fetch("/api/prediction/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ownerPubkey: wallet,
                marketId: selectedMarket.marketId,
                isYes: side === "YES",
                depositAmount: prepared.reservedOutRaw,
            }),
        });
        const eligibilityJson = await eligibilityRes.json();
        if (!eligibilityJson.success) {
            throw new Error(
                normalizePredictionUiError(
                    eligibilityJson.error || "Prediction order is unavailable for this environment."
                )
            );
        }

        return true;
    }

    async function fundPreparedPrediction(prepared: PrepareData) {
        if (!signTransaction) throw new Error("Wallet signing is required.");

        const tx = getStringField(prepared.fundingOrder, "transaction", "serializedTransaction", "swapTransaction");
        const requestId = getStringField(prepared.fundingOrder, "requestId", "quoteRequestId", "id");
        if (!tx || !requestId) throw new Error("Funding transaction is incomplete.");

        const signed = await signTransaction(VersionedTransaction.deserialize(decodeTransactionData(tx)));
        const res = await fetch("/api/prediction/funding-execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId, signedTransaction: uint8ArrayToBase64(signed.serialize()) }),
        });
        const json = await res.json();
        if (!json.success) {
            throw new Error(normalizePredictionUiError(json.error || "Funding swap failed."));
        }

        const signature = getStringField(json.data, "signature", "txid") ?? requestId;
        setFundingSig(signature);
        return signature;
    }

    async function openPreparedPosition(prepared: PrepareData) {
        if (!wallet || !signTransaction || !selectedMarket) throw new Error("Choose a live market first.");

        const orderRes = await fetch("/api/prediction/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ownerPubkey: wallet,
                marketId: selectedMarket.marketId,
                isYes: side === "YES",
                depositAmount: prepared.reservedOutRaw,
            }),
        });
        const orderJson = await orderRes.json();
        if (!orderJson.success) throw new Error(orderJson.error || "Prediction order failed.");

        const tx = getStringField(orderJson.data, "transaction", "serializedTransaction");
        const pubkey = getStringField(orderJson.data, "orderPubkey");
        if (!tx || !pubkey) throw new Error("Prediction order transaction is incomplete.");

        const signed = await signTransaction(VersionedTransaction.deserialize(decodeTransactionData(tx)));
        setOrderPubkey(pubkey);
        let signature: string | null = null;

        try {
            const sendJson = await sendSignedTransactionWithRetry(signed.serialize());
            signature = getStringField(sendJson.data, "signature");
            setPredictionSig(signature);
        } catch (sendError) {
            const message = sendError instanceof Error ? sendError.message : String(sendError);
            if (!isAlreadyProcessedMessage(message)) {
                throw sendError;
            }
        }

        await pollOrderStatus(pubkey, setOrderStatus);
        await positions.refetch();

        return { signature, orderPubkey: pubkey };
    }

    async function enterPosition() {
        if (!connected || !wallet) {
            setVisible(true);
            return;
        }

        if (!signTransaction) {
            setError("Wallet signing is required for this prediction entry.");
            return;
        }

        if (!selectedMarket) {
            setError("Choose a live market first.");
            return;
        }

        setBusy("enter");
        setError(null);

        try {
            const usdcBaseline = await getPredictionUsdcBalance();
            const prepared = prepare ?? (await prepareFundingRequest());
            let fundedThisPass = false;

            setOrderStatus("checking");
            await verifyPredictionEligibility(prepared);

            if (!fundingSig) {
                setOrderStatus("funding");
                await fundPreparedPrediction(prepared);
                fundedThisPass = true;
            }

            try {
                setOrderStatus("ordering");
                await openPreparedPosition(prepared);
            } catch (orderError) {
                if (fundedThisPass || fundingSig) {
                    try {
                        await settleUsdcDeltaBackToScan(
                            usdcBaseline.rawAmount,
                            "Prediction entry failed after funding, and auto-return to $SCAN could not be completed.",
                            8,
                            1200
                        );
                    } catch (settlementError) {
                        const orderMessage =
                            orderError instanceof Error ? orderError.message : "Prediction entry failed.";
                        const settlementMessage =
                            settlementError instanceof Error
                                ? settlementError.message
                                : "Auto-return to $SCAN failed.";
                        throw new Error(
                            `${normalizePredictionUiError(orderMessage)} Auto-return to $SCAN also failed: ${normalizePredictionUiError(settlementMessage)}`
                        );
                    }

                    const orderMessage =
                        orderError instanceof Error ? orderError.message : "Prediction entry failed.";

                    if (isRegionBlockedMessage(orderMessage)) {
                        throw new Error(
                            "Prediction trading is currently unavailable for this region or environment. Your funds were returned to $SCAN."
                        );
                    }

                    throw new Error(
                        `${normalizePredictionUiError(orderMessage)} Funds were returned to $SCAN.`
                    );
                }

                throw orderError;
            }
        } catch (entryError) {
            setError(
                normalizePredictionUiError(
                    entryError instanceof Error ? entryError.message : "Prediction entry failed."
                )
            );
            if (!orderStatus || orderStatus === "ordering") {
                setOrderStatus("failed");
            }
        } finally {
            setBusy(null);
        }
    }

    async function claimPosition(positionPubkey: string) {
        if (!wallet || !signTransaction) {
            setVisible(true);
            return;
        }

        setClaimingPosition(positionPubkey);
        setError(null);
        try {
            const claimRes = await fetch("/api/prediction/claim", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ownerPubkey: wallet, positionPubkey }),
            });
            const claimJson = await claimRes.json();
            if (!claimJson.success) throw new Error(claimJson.error || "Claim transaction could not be created.");
            const tx = getStringField(claimJson.data, "transaction", "serializedTransaction");
            if (!tx) throw new Error("Claim transaction is incomplete.");
            const signed = await signTransaction(VersionedTransaction.deserialize(decodeTransactionData(tx)));
            try {
                await sendSignedTransactionWithRetry(signed.serialize());
            } catch (claimError) {
                const message =
                    claimError instanceof Error ? claimError.message : String(claimError);
                if (!isAlreadyProcessedMessage(message)) {
                    throw claimError;
                }
            }
            await refetchPositionsUntil(
                (items) =>
                    !items.some((item) => item.positionPubkey === positionPubkey && (item.claimablePayoutUsd ?? 0) > 0),
                6,
                1200
            );
        } catch (claimError) {
            setError(
                normalizePredictionUiError(
                    claimError instanceof Error ? claimError.message : "Claim failed."
                )
            );
        } finally {
            setClaimingPosition(null);
        }
    }

    async function closePosition(positionPubkey: string) {
        if (!wallet || !signTransaction) {
            setVisible(true);
            return;
        }

        setClosingPosition(positionPubkey);
        setError(null);
        try {
            const usdcBaseline = await getPredictionUsdcBalance();
            const closeRes = await fetch("/api/prediction/close", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ownerPubkey: wallet, positionPubkey }),
            });
            const closeJson = await closeRes.json();
            if (!closeJson.success) throw new Error(closeJson.error || "Close transaction could not be created.");
            const closeTx = getStringField(closeJson.data, "transaction", "serializedTransaction");
            if (!closeTx) throw new Error("Close transaction is incomplete.");
            const signed = await signTransaction(VersionedTransaction.deserialize(decodeTransactionData(closeTx)));
            try {
                await sendSignedTransactionWithRetry(signed.serialize());
            } catch (closeError) {
                const message =
                    closeError instanceof Error ? closeError.message : String(closeError);
                if (!isAlreadyProcessedMessage(message)) {
                    throw closeError;
                }
            }
            await refetchPositionsUntil(
                (items) => !items.some((item) => item.positionPubkey === positionPubkey),
                8,
                1200
            );

            const settlementData = await waitForSettlementOrder(usdcBaseline.rawAmount);
            const settlementTx = getStringField(
                settlementData?.settlementOrder,
                "transaction",
                "serializedTransaction",
                "swapTransaction"
            );
            const requestId = getStringField(
                settlementData?.settlementOrder,
                "requestId",
                "quoteRequestId",
                "id"
            );
            if (!settlementTx || !requestId) {
                throw new Error("Position closed, but the $SCAN settlement transaction is incomplete.");
            }

            const signedSettlement = await signTransaction(
                VersionedTransaction.deserialize(decodeTransactionData(settlementTx))
            );

            const executeRes = await fetch("/api/prediction/settlement-execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    requestId,
                    signedTransaction: uint8ArrayToBase64(signedSettlement.serialize()),
                }),
            });
            const executeJson = await executeRes.json();
            if (!executeJson.success) {
                throw new Error(
                    normalizePredictionUiError(
                        executeJson.error ||
                            "Position closed, but auto-convert to $SCAN failed. Funds remain in USDC."
                    )
                );
            }
        } catch (closeError) {
            setError(
                normalizePredictionUiError(
                    closeError instanceof Error ? closeError.message : "Close position failed."
                )
            );
        } finally {
            setClosingPosition(null);
        }
    }

    const primaryActionLabel = !connected
        ? "CONNECT WALLET"
        : busy === "enter"
            ? "ENTERING POSITION"
            : fundingSig && !predictionSig
                ? `CONTINUE ${side} WITH $${SCAN_SYMBOL}`
                : `ENTER ${side} WITH $${SCAN_SYMBOL}`;

    return (
        <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8">
            <div className="mb-5 flex items-center justify-between gap-3">
                <Link
                    href="/prediction"
                    className="inline-flex items-center gap-2 border border-[#00ff41]/18 bg-[#00ff41]/[0.04] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[#9cffba] transition hover:border-[#00ff41]/34 hover:bg-[#00ff41]/10"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back To Prediction Markets
                </Link>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#00ff41]/42">
                    {eventQuery.data?.tradingStatus.open ? "Live Trading" : "Status Checked"}
                </div>
            </div>

            {eventQuery.isLoading ? (
                <LoaderPanel label="LOADING EVENT DETAIL" />
            ) : eventQuery.error ? (
                <ErrorPanel message={String(eventQuery.error)} />
            ) : !event ? (
                <ErrorPanel message="Prediction event could not be found on this pass." />
            ) : (
                <>
                    <EventHeroSection
                        event={event}
                        marketsCount={markets.length}
                        selectedChance={selectedChance}
                        selectedPrice={selectedPrice}
                        side={side}
                    />

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_400px]">
                        <div className="min-w-0">
                            <MarketBoardSection
                                markets={markets}
                                selectedMarket={selectedMarket}
                                side={side}
                                onSelectMarket={selectMarket}
                                onSelectSide={setSide}
                                rulesSummary={event.description}
                            />
                        </div>
                        <PredictionEntryPanel
                            connected={connected}
                            selectedMarket={selectedMarket}
                            side={side}
                            scanAmountUi={scanAmountUi}
                            slippageBps={slippageBps}
                            prepare={prepare}
                            fundingSig={fundingSig}
                            predictionSig={predictionSig}
                            orderPubkey={orderPubkey}
                            orderStatus={orderStatus}
                            tradingOpen={eventQuery.data?.tradingStatus.open ?? true}
                            busy={busy === "enter"}
                            error={error}
                            primaryActionLabel={primaryActionLabel}
                            onAmountChange={setScanAmountUi}
                            onSlippageChange={setSlippageBps}
                            onSideChange={setSide}
                            onEnter={enterPosition}
                            onConnect={() => setVisible(true)}
                        />
                    </div>

                    <div className="mt-6">
                        <EventPositionsSection
                            connected={connected}
                            positionsLoading={positions.isLoading}
                            eventPositions={eventPositions}
                            claimingPosition={claimingPosition}
                            closingPosition={closingPosition}
                            onClaim={claimPosition}
                            onClose={closePosition}
                        />
                    </div>

                    <div className="mt-6">
                        <RelatedEventsPanel relatedEvents={relatedEvents} />
                    </div>
                </>
            )}
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

function PredictionImageThumb({
    title,
    imageUrl,
    size,
}: {
    title: string;
    imageUrl?: string;
    size: "hero" | "market" | "related";
}) {
    const className =
        size === "hero"
            ? "h-16 w-16 sm:h-20 sm:w-20"
            : size === "related"
                ? "h-12 w-12"
                : "h-11 w-11";

    if (imageUrl) {
        return (
            <div className={`${className} shrink-0 overflow-hidden border border-white/10 bg-black/30 shadow-[0_0_18px_rgba(255,255,255,0.04)]`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={imageUrl}
                    alt={title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                />
            </div>
        );
    }

    return (
        <div className={`${className} flex shrink-0 items-center justify-center border border-[#00ff41]/14 bg-[#00ff41]/[0.05] text-[11px] uppercase tracking-[0.2em] text-[#00ff41]/52`}>
            {title.slice(0, 2)}
        </div>
    );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className="border border-[#00ff41]/10 bg-black/28 px-3 py-3">
            <p className="text-[9px] uppercase tracking-[0.2em] text-[#00ff41]/34">{label}</p>
            <p className="mt-2 text-sm tracking-[0.12em] text-[#d8ffe6]/86">{value}</p>
        </div>
    );
}

function ProbabilityStrip({ label, value, tone }: { label: string; value: number; tone: "yes" | "no" }) {
    const safeValue = Math.max(0, Math.min(100, value));
    const gradient =
        tone === "yes"
            ? "linear-gradient(90deg,rgba(173,204,96,0.26),rgba(173,204,96,0.04))"
            : "linear-gradient(90deg,rgba(0,170,255,0.26),rgba(0,170,255,0.04))";
    const accent = tone === "yes" ? "text-[#dff7ae]" : "text-[#b8ecff]";

    return (
        <div className="border border-white/8 bg-black/22 px-3 py-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-white/62">
                <span>{label}</span>
                <span className={accent}>{safeValue.toFixed(1)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full" style={{ width: `${safeValue}%`, background: gradient }} />
            </div>
        </div>
    );
}

function ActionButton({
    label,
    icon,
    onClick,
    busy,
    disabled,
    tone = "yes",
}: {
    label: string;
    icon: ReactNode;
    onClick: () => void;
    busy?: boolean;
    disabled?: boolean;
    tone?: "yes" | "no";
}) {
    const classes =
        tone === "yes"
            ? "border-[#adcc60]/36 bg-[#adcc60]/12 text-[#e7ffc1] hover:border-[#adcc60]/56 hover:bg-[#adcc60]/18"
            : "border-[#00aaff]/36 bg-[#00aaff]/12 text-[#b8ecff] hover:border-[#00aaff]/56 hover:bg-[#00aaff]/18";

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled || busy}
            className={`mt-4 inline-flex w-full items-center justify-center gap-2 border px-4 py-3 text-[11px] uppercase tracking-[0.22em] transition disabled:cursor-not-allowed disabled:opacity-40 ${classes}`}
        >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
            {label}
        </button>
    );
}

function LoaderPanel({ label }: { label: string }) {
    return (
        <div className="flex min-h-[280px] items-center justify-center border border-[#00ff41]/12 bg-[#00ff41]/[0.03]">
            <div className="flex items-center gap-2 text-[11px] tracking-[0.2em] text-[#00ff41]/56">
                <Loader2 className="h-4 w-4 animate-spin" />
                {label}
            </div>
        </div>
    );
}

function ErrorPanel({ message, compact = false }: { message: string; compact?: boolean }) {
    return (
        <div className={`border border-[#ff4400]/28 bg-[#ff4400]/8 text-[11px] tracking-[0.14em] text-[#ff9d7a] ${compact ? "mt-4 px-4 py-4" : "px-4 py-5"}`}>
            {message}
        </div>
    );
}

function StatusLine({ label, value, href }: { label: string; value: string; href?: string }) {
    return (
        <div className="flex items-center justify-between gap-4 py-1">
            <span className="text-[#00ff41]/36">{label}</span>
            {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#8dd8ff] hover:text-[#b8ecff]">
                    {value}
                    <ExternalLink className="h-3 w-3" />
                </a>
            ) : (
                <span>{value}</span>
            )}
        </div>
    );
}

function formatOdds(price: number | null | undefined, probability: number | null | undefined) {
    if (price !== null && price !== undefined) return formatCurrency(price, { compact: false, decimals: 2 });
    if (probability !== null && probability !== undefined) return `${probability.toFixed(1)}%`;
    return "--";
}

function getStringField(payload: Record<string, unknown> | null | undefined, ...keys: string[]) {
    if (!payload) return null;
    for (const key of keys) {
        const value = payload[key];
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
}

function decodeTransactionData(raw: string) {
    const base64 = tryDecodeBase64(raw);
    if (base64) return base64;
    const base58 = tryDecodeBase58(raw);
    if (base58) return base58;
    throw new Error("Unsupported Jupiter transaction encoding.");
}

function tryDecodeBase64(raw: string) {
    try {
        const bytes = base64ToUint8Array(raw);
        VersionedTransaction.deserialize(bytes);
        return bytes;
    } catch {
        return null;
    }
}

function tryDecodeBase58(raw: string) {
    try {
        const bytes = bs58.decode(raw);
        VersionedTransaction.deserialize(bytes);
        return bytes;
    } catch {
        return null;
    }
}

function base64ToUint8Array(raw: string) {
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array) {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return btoa(binary);
}

async function pollOrderStatus(orderPubkey: string, setStatus: (value: string) => void) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
        try {
            const res = await fetch(`/api/prediction/order-status/${orderPubkey}`);
            const json = await res.json();
            if (json.success) {
                const status = getStringField(json.data, "status", "fillStatus") ?? "pending";
                setStatus(status);
                if (["filled", "matched", "open", "resting", "completed"].some((item) => status.toLowerCase().includes(item))) return;
            } else {
                setStatus("pending");
            }
        } catch {
            setStatus("pending");
        }
        await new Promise((resolve) => setTimeout(resolve, 1800));
    }
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
