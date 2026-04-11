"use client";

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import Link from "next/link";
import { ArrowRightLeft, CheckCircle2, ExternalLink, Loader2, ShieldCheck, Target, Wallet, XCircle } from "lucide-react";
import type { JupiterPredictionEvent, JupiterPredictionPosition, JupiterPredictionTradingStatus } from "@/lib/jupiter/types";
import { SCAN_BAGS_URL, SCAN_SYMBOL } from "@/lib/scan/constants";
import { cn, formatCurrency, formatNumber, shortenAddress } from "@/lib/utils";
import { getExplorerUrl } from "@/lib/solana";

interface MarketboardData {
    tradingStatus: JupiterPredictionTradingStatus;
    events: JupiterPredictionEvent[];
}

interface PrepareData {
    fundingOrder: Record<string, unknown>;
    quotedOutUi: string;
    reservedOutUi: string;
    reservedOutRaw: string;
    leftoverUi: string;
    reserveBps: number;
}

export function PredictionTerminal() {
    const { connected, publicKey, signTransaction } = useWallet();
    const { setVisible } = useWalletModal();
    const wallet = publicKey?.toBase58() ?? "";

    const [eventId, setEventId] = useState("");
    const [marketId, setMarketId] = useState("");
    const [side, setSide] = useState<"YES" | "NO">("YES");
    const [scanAmountUi, setScanAmountUi] = useState("25000");
    const [slippageBps, setSlippageBps] = useState("250");
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("all");
    const [prepare, setPrepare] = useState<PrepareData | null>(null);
    const [fundingSig, setFundingSig] = useState<string | null>(null);
    const [predictionSig, setPredictionSig] = useState<string | null>(null);
    const [orderPubkey, setOrderPubkey] = useState<string | null>(null);
    const [orderStatus, setOrderStatus] = useState<string | null>(null);
    const [claimingPosition, setClaimingPosition] = useState<string | null>(null);
    const [closingPosition, setClosingPosition] = useState<string | null>(null);
    const [busy, setBusy] = useState<"prepare" | "fund" | "order" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const deferredSearch = useDeferredValue(search);

    const marketboard = useQuery<MarketboardData>({
        queryKey: ["prediction-marketboard"],
        queryFn: async () => {
            const res = await fetch("/api/prediction/marketboard");
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Prediction marketboard could not be loaded.");
            return json.data;
        },
        staleTime: 20_000,
        refetchInterval: 30_000,
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
        staleTime: 15_000,
        refetchInterval: connected ? 30_000 : false,
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
    const visibleEvents = useMemo(() => filteredEvents.slice(0, 12), [filteredEvents]);
    const selectedEvent = useMemo(() => filteredEvents.find((item) => item.eventId === eventId) ?? filteredEvents[0] ?? null, [filteredEvents, eventId]);
    const markets = useMemo(() => selectedEvent?.markets.filter((item) => (item.status ?? "").toLowerCase() !== "closed") ?? [], [selectedEvent]);
    const selectedMarket = useMemo(() => markets.find((item) => item.marketId === marketId) ?? markets[0] ?? null, [marketId, markets]);

    useEffect(() => {
        if (!eventId && filteredEvents[0]) setEventId(filteredEvents[0].eventId);
    }, [eventId, filteredEvents]);

    useEffect(() => {
        if (filteredEvents.length > 0 && !filteredEvents.some((item) => item.eventId === eventId)) {
            setEventId(filteredEvents[0]?.eventId ?? "");
        }
    }, [eventId, filteredEvents]);

    useEffect(() => {
        if (selectedEvent && !markets.some((item) => item.marketId === marketId)) {
            setMarketId(markets[0]?.marketId ?? "");
        }
    }, [marketId, markets, selectedEvent]);

    useEffect(() => {
        setPrepare(null);
        setFundingSig(null);
        setPredictionSig(null);
        setOrderPubkey(null);
        setOrderStatus(null);
        setError(null);
    }, [marketId, side, scanAmountUi, slippageBps]);

    async function previewFunding() {
        if (!connected || !wallet) return setVisible(true);
        setBusy("prepare");
        setError(null);
        try {
            const res = await fetch("/api/prediction/prepare", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ownerPubkey: wallet, scanAmountUi: Number(scanAmountUi), slippageBps: Number(slippageBps) }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Funding preview failed.");
            setPrepare(json.data);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Funding preview failed.");
        } finally {
            setBusy(null);
        }
    }

    async function executeFunding() {
        if (!prepare || !signTransaction) return;
        setBusy("fund");
        setError(null);
        try {
            const tx = getStringField(prepare.fundingOrder, "transaction", "serializedTransaction", "swapTransaction");
            const requestId = getStringField(prepare.fundingOrder, "requestId", "quoteRequestId", "id");
            if (!tx || !requestId) throw new Error("Funding transaction is incomplete.");
            const signed = await signTransaction(VersionedTransaction.deserialize(decodeTransactionData(tx)));
            const res = await fetch("/api/prediction/funding-execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId, signedTransaction: uint8ArrayToBase64(signed.serialize()) }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Funding swap failed.");
            setFundingSig(getStringField(json.data, "signature", "txid") ?? requestId);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Funding swap failed.");
        } finally {
            setBusy(null);
        }
    }

    async function openPosition() {
        if (!wallet || !signTransaction || !prepare || !selectedMarket) return;
        setBusy("order");
        setError(null);
        setOrderStatus("creating");
        try {
            const orderRes = await fetch("/api/prediction/order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ownerPubkey: wallet, marketId: selectedMarket.marketId, isYes: side === "YES", depositAmount: prepare.reservedOutRaw }),
            });
            const orderJson = await orderRes.json();
            if (!orderJson.success) throw new Error(orderJson.error || "Prediction order failed.");
            const tx = getStringField(orderJson.data, "transaction", "serializedTransaction");
            const pubkey = getStringField(orderJson.data, "orderPubkey");
            if (!tx || !pubkey) throw new Error("Prediction order transaction is incomplete.");
            const signed = await signTransaction(VersionedTransaction.deserialize(decodeTransactionData(tx)));
            const sendJson = await sendSignedTransaction(signed.serialize());
            setPredictionSig(getStringField(sendJson.data, "signature"));
            setOrderPubkey(pubkey);
            await pollOrderStatus(pubkey, setOrderStatus);
            positions.refetch();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Prediction order failed.");
            setOrderStatus("failed");
        } finally {
            setBusy(null);
        }
    }

    async function claimPosition(positionPubkey: string) {
        if (!wallet || !signTransaction) return;
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
            await sendSignedTransaction(signed.serialize());
            await positions.refetch();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Claim failed.");
        } finally {
            setClaimingPosition(null);
        }
    }

    async function closePosition(positionPubkey: string) {
        if (!wallet || !signTransaction) return;
        setClosingPosition(positionPubkey);
        setError(null);
        try {
            const closeRes = await fetch("/api/prediction/close", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ownerPubkey: wallet, positionPubkey }),
            });
            const closeJson = await closeRes.json();
            if (!closeJson.success) throw new Error(closeJson.error || "Close transaction could not be created.");
            const tx = getStringField(closeJson.data, "transaction", "serializedTransaction");
            if (!tx) throw new Error("Close transaction is incomplete.");
            const signed = await signTransaction(VersionedTransaction.deserialize(decodeTransactionData(tx)));
            await sendSignedTransaction(signed.serialize());
            await positions.refetch();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Close position failed.");
        } finally {
            setClosingPosition(null);
        }
    }

    return (
        <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8">
            <section className="crt-panel mb-6 border border-[#ffaa00]/20 bg-[linear-gradient(135deg,rgba(255,170,0,0.06),rgba(0,0,0,0.8)_45%,rgba(0,255,65,0.04))] p-6">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_380px]">
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.32em] text-[#ffaa00]/68">Jupiter Prediction</p>
                        <h1 className="mt-2 text-3xl tracking-[0.28em] text-[#d8ffe6] sm:text-4xl">PREDICTION DESK</h1>
                        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#d8ffe6]/66">Open YES / NO positions with <span className="text-[#00ff41]">${SCAN_SYMBOL}</span> only. BagScan converts ${SCAN_SYMBOL} into USDC first, then opens the selected Jupiter market in a guarded two-step flow.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                        <MetricCard label="Funding Token" value={`$${SCAN_SYMBOL}`} hint="This desk funds positions only from the BagScan native token." />
                        <MetricCard label="Events Live" value={formatNumber(filteredEvents.length, false)} hint="Top visible Jupiter prediction events pulled into BagScan." />
                        <MetricCard label="Trading Status" value={(marketboard.data?.tradingStatus.open ?? false) ? "OPEN" : "CHECKED"} hint={marketboard.data?.tradingStatus.reason ?? "Availability depends on Jupiter's live prediction status."} />
                    </div>
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_420px]">
                <section className="crt-panel p-5">
                    <div className="panel-header flex items-center gap-2"><Target className="h-4 w-4 text-[#ffaa00]/60" />PREDICTION MARKETS</div>
                    {marketboard.isLoading ? <LoaderPanel label="LOADING LIVE MARKETS" /> : marketboard.error ? <ErrorPanel message={String(marketboard.error)} /> : <>
                        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                            <label className="block">
                                <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-[#00ff41]/38">Search Events Or Markets</span>
                                <input value={search} onChange={(e) => setSearch(e.target.value)} type="text" placeholder="Election, sports, crypto, yes..." className="w-full border border-[#00ff41]/18 bg-black/45 px-3 py-3 text-sm tracking-[0.12em] text-[#d8ffe6] outline-none transition focus:border-[#00ff41]/42" />
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-[#00ff41]/38">Category</span>
                                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-[#00ff41]/18 bg-black/45 px-3 py-3 text-sm tracking-[0.12em] text-[#d8ffe6] outline-none transition focus:border-[#00ff41]/42">
                                    {categories.map((item) => (
                                        <option key={item} value={item}>
                                            {item.toUpperCase()}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className="mt-6 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-[#00ff41]/42">
                            <span>Showing {Math.min(filteredEvents.length, 12)} of {filteredEvents.length} live events</span>
                            {filteredEvents.length > 12 ? <span>Refine search or category to narrow the board</span> : null}
                        </div>
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            {visibleEvents.map((event) => {
                                const primary = event.markets[0];
                                const active = event.eventId === selectedEvent?.eventId;
                                return (
                                    <button key={event.eventId} type="button" onClick={() => { setEventId(event.eventId); setMarketId(event.eventId === eventId ? marketId : event.markets[0]?.marketId ?? ""); }} className={cn("border p-4 text-left transition-all", active ? "border-[#ffaa00]/42 bg-[#ffaa00]/8 shadow-[0_0_24px_rgba(255,170,0,0.08)]" : "border-[#00ff41]/12 bg-[#00ff41]/[0.03] hover:border-[#00ff41]/26")}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-[0.22em] text-[#ffaa00]/72">{event.category ?? "Prediction Event"}</p>
                                                <h2 className="mt-2 text-[15px] tracking-[0.12em] text-[#d8ffe6]">{event.title}</h2>
                                            </div>
                                            <span className="border border-[#00ff41]/12 px-2 py-1 text-[9px] tracking-[0.18em] text-[#00ff41]/54">{event.markets.length} MARKETS</span>
                                        </div>
                                        <p className="mt-2 line-clamp-3 text-[11px] leading-6 tracking-[0.12em] text-[#d8ffe6]/46">{event.description ?? "Live Jupiter prediction event."}</p>
                                        <div className="mt-4 grid grid-cols-2 gap-3">
                                            <MiniMetric label="Primary YES" value={formatOdds(primary?.yesPrice, primary?.yesProbability)} />
                                            <MiniMetric label="Primary NO" value={formatOdds(primary?.noPrice, primary?.noProbability)} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {filteredEvents.length === 0 ? <div className="mt-6 border border-[#00ff41]/12 bg-[#00ff41]/[0.03] px-4 py-5 text-[11px] tracking-[0.14em] text-[#00ff41]/54">No live prediction events matched this filter yet.</div> : null}

                        {selectedEvent ? <div className="mt-6 border border-[#00ff41]/12 bg-[#00ff41]/[0.03] p-4">
                            <p className="text-[10px] uppercase tracking-[0.22em] text-[#ffaa00]/72">Selected Event</p>
                            <h3 className="mt-2 text-lg tracking-[0.12em] text-[#d8ffe6]">{selectedEvent.title}</h3>
                            {selectedEvent.description ? <p className="mt-2 text-[11px] leading-6 tracking-[0.12em] text-[#d8ffe6]/52">{selectedEvent.description}</p> : null}
                            <div className="mt-4 space-y-3">
                                {markets.slice(0, 12).map((market) => {
                                    const active = market.marketId === selectedMarket?.marketId;
                                    return (
                                        <button key={market.marketId} type="button" onClick={() => setMarketId(market.marketId)} className={cn("grid w-full gap-3 border px-4 py-4 text-left transition-all md:grid-cols-[minmax(0,1fr)_120px_120px_110px]", active ? "border-[#00aaff]/34 bg-[#00aaff]/10 shadow-[0_0_18px_rgba(0,170,255,0.08)]" : "border-[#00ff41]/12 bg-black/20 hover:border-[#00ff41]/24")}>
                                            <div>
                                                <p className="text-sm tracking-[0.1em] text-[#d8ffe6]">{market.title}</p>
                                                <div className="mt-2 flex flex-wrap gap-2 text-[10px] tracking-[0.18em] text-[#00ff41]/42">
                                                    <span>{(market.status ?? "open").toUpperCase()}</span>
                                                    {market.closeTime ? <span>{formatDateCompact(market.closeTime)}</span> : null}
                                                </div>
                                            </div>
                                            <MiniMetric label="YES" value={formatOdds(market.yesPrice, market.yesProbability)} />
                                            <MiniMetric label="NO" value={formatOdds(market.noPrice, market.noProbability)} />
                                            <MiniMetric label="Volume" value={formatCurrency(market.volumeUsd)} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div> : null}
                    </>}
                </section>

                <section className="crt-panel p-5">
                    <div className="panel-header flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-[#ffaa00]/60" />SCAN COMPOSER</div>
                    <div className="mt-5 space-y-4">
                        <FieldBlock label="Selected Event" value={selectedEvent?.title ?? "Choose a live event"} />
                        <FieldBlock label="Selected Market" value={selectedMarket?.title ?? "Choose a live market"} />
                        {selectedMarket ? <div className="grid grid-cols-2 gap-3">
                            <MiniMetric label="YES" value={formatOdds(selectedMarket.yesPrice, selectedMarket.yesProbability)} />
                            <MiniMetric label="NO" value={formatOdds(selectedMarket.noPrice, selectedMarket.noProbability)} />
                            <MiniMetric label="Volume" value={formatCurrency(selectedMarket.volumeUsd)} />
                            <MiniMetric label="Close" value={selectedMarket.closeTime ? formatDateCompact(selectedMarket.closeTime) : "TBA"} />
                        </div> : null}
                        <div className="grid grid-cols-2 gap-3">
                            {(["YES", "NO"] as const).map((value) => <button key={value} type="button" onClick={() => setSide(value)} className={cn("border px-3 py-3 text-[11px] tracking-[0.22em] transition-all", side === value ? value === "YES" ? "border-[#00ff41]/40 bg-[#00ff41]/10 text-[#b8ffca]" : "border-[#ff4400]/36 bg-[#ff4400]/10 text-[#ffb39a]" : "border-[#00ff41]/12 bg-black/25 text-[#00ff41]/45 hover:border-[#00ff41]/26")}>{value}</button>)}
                        </div>
                        <label className="block"><span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-[#00ff41]/38">Funding Amount ($SCAN)</span><input value={scanAmountUi} onChange={(e) => setScanAmountUi(e.target.value)} type="number" min="0" step="1" className="w-full border border-[#00ff41]/18 bg-black/45 px-3 py-3 text-sm tracking-[0.12em] text-[#d8ffe6] outline-none transition focus:border-[#00ff41]/42" /></label>
                        <label className="block"><span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-[#00ff41]/38">Slippage (bps)</span><input value={slippageBps} onChange={(e) => setSlippageBps(e.target.value)} type="number" min="0" max="5000" step="10" className="w-full border border-[#00ff41]/18 bg-black/45 px-3 py-3 text-sm tracking-[0.12em] text-[#d8ffe6] outline-none transition focus:border-[#00ff41]/42" /></label>
                        {prepare ? <div className="border border-[#00aaff]/18 bg-[#00aaff]/[0.06] px-4 py-4"><div className="grid grid-cols-2 gap-3"><MiniMetric label="Quoted USDC" value={prepare.quotedOutUi} /><MiniMetric label="Reserved" value={prepare.reservedOutUi} /><MiniMetric label="Buffer" value={prepare.leftoverUi} /><MiniMetric label="Model" value={`${prepare.reserveBps / 100}%`} /></div></div> : null}
                        {error ? <ErrorPanel message={error} compact /> : null}
                        {!connected ? <button type="button" onClick={() => setVisible(true)} className="inline-flex w-full items-center justify-center gap-2 border-2 border-[#00ff41]/38 bg-[#00ff41]/10 px-4 py-3 text-[11px] tracking-[0.22em] text-[#00ff41] transition hover:border-[#00ff41]/65 hover:bg-[#00ff41]/18"><Wallet className="h-4 w-4" />CONNECT WALLET TO START</button> : <div className="space-y-3">
                            <ActionButton label="PREVIEW WITH $SCAN" icon={<ArrowRightLeft className="h-4 w-4" />} onClick={previewFunding} busy={busy === "prepare"} disabled={!selectedMarket} />
                            <ActionButton label={`STEP 1: FUND WITH $${SCAN_SYMBOL}`} icon={<ShieldCheck className="h-4 w-4" />} onClick={executeFunding} busy={busy === "fund"} disabled={!prepare} tone="amber" />
                            <ActionButton label={`STEP 2: OPEN ${side}`} icon={<Target className="h-4 w-4" />} onClick={openPosition} busy={busy === "order"} disabled={!fundingSig || !prepare} tone="blue" />
                        </div>}
                        {(fundingSig || predictionSig || orderPubkey || orderStatus) ? <div className="border border-[#00ff41]/12 bg-black/30 px-4 py-4 text-[10px] tracking-[0.16em] text-[#d8ffe6]/72">
                            {fundingSig ? <StatusLine label="Funding swap" value="CONFIRMED" href={getExplorerUrl(fundingSig)} /> : null}
                            {predictionSig ? <StatusLine label="Prediction tx" value="SENT" href={getExplorerUrl(predictionSig)} /> : null}
                            {orderPubkey ? <StatusLine label="Order pubkey" value={shortenAddress(orderPubkey, 6)} /> : null}
                            {orderStatus ? <StatusLine label="Order status" value={orderStatus.toUpperCase()} /> : null}
                        </div> : null}
                        <div className="border border-white/8 bg-white/[0.02] px-4 py-4 text-[10px] leading-5 tracking-[0.14em] text-white/56">This flow uses Jupiter Prediction for the market itself and is not investment advice. Availability may vary by jurisdiction or live trading status.</div>
                        <Link href={SCAN_BAGS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 border border-[#00ff41]/18 bg-[#00ff41]/8 px-3 py-2 text-[10px] tracking-[0.16em] text-[#9cffba]/74 transition hover:bg-[#00ff41]/14 hover:text-[#d8ffe6]">GET $SCAN<ExternalLink className="h-3 w-3" /></Link>
                    </div>
                </section>
            </div>

            <section className="mt-6 crt-panel p-5">
                <div className="panel-header">YOUR PREDICTION POSITIONS</div>
                {!connected ? <div className="mt-6 border border-[#00ff41]/12 bg-[#00ff41]/[0.03] px-4 py-5 text-[11px] tracking-[0.14em] text-[#00ff41]/54">Connect a wallet to see active prediction positions.</div> : positions.isLoading ? <LoaderPanel label="LOADING POSITIONS" /> : positions.error ? <ErrorPanel message={String(positions.error)} /> : (positions.data?.length ?? 0) === 0 ? <div className="mt-6 border border-[#00ff41]/12 bg-[#00ff41]/[0.03] px-4 py-5 text-[11px] tracking-[0.14em] text-[#00ff41]/54">No positions are visible for this wallet yet.</div> : <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    {positions.data?.map((position) => {
                        const claimable = (position.status ?? "").toLowerCase() === "claimable";
                        const closable = !claimable && !["claimed", "closed"].includes((position.status ?? "").toLowerCase());
                        const busyClaim = claimingPosition === position.positionPubkey;
                        const busyClose = closingPosition === position.positionPubkey;
                        return <div key={position.positionPubkey} className="border border-[#00ff41]/12 bg-[#00ff41]/[0.03] p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#00aaff]/70">{position.side ?? "POSITION"}</p>
                                    <h3 className="mt-2 text-sm tracking-[0.12em] text-[#d8ffe6]">{position.marketTitle ?? position.eventTitle ?? shortenAddress(position.positionPubkey, 6)}</h3>
                                    {position.eventTitle && position.marketTitle ? <p className="mt-2 text-[10px] tracking-[0.16em] text-[#d8ffe6]/46">{position.eventTitle}</p> : null}
                                </div>
                                <span className="border border-[#00ff41]/14 px-2 py-1 text-[9px] tracking-[0.18em] text-[#00ff41]/54">{(position.status ?? "open").toUpperCase()}</span>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <MiniMetric label="Contracts" value={position.quantity !== null && position.quantity !== undefined ? formatNumber(position.quantity, false) : "--"} />
                                <MiniMetric label="Avg Price" value={position.averagePrice !== null && position.averagePrice !== undefined ? formatCurrency(position.averagePrice, { compact: false, decimals: 2 }) : "--"} />
                                <MiniMetric label="Mark Price" value={position.currentPrice !== null && position.currentPrice !== undefined ? formatCurrency(position.currentPrice, { compact: false, decimals: 2 }) : "--"} />
                                <MiniMetric label="PnL" value={position.unrealizedPnlUsd !== null && position.unrealizedPnlUsd !== undefined ? formatCurrency(position.unrealizedPnlUsd, { compact: false, decimals: 2 }) : "--"} />
                            </div>
                            {claimable ? <div className="mt-4 flex items-center justify-between gap-3 border border-[#ffaa00]/18 bg-[#ffaa00]/8 px-4 py-3 text-[10px] tracking-[0.16em] text-[#ffd37a]">
                                <div><p>CLAIMABLE PAYOUT</p><p className="mt-1 text-sm tracking-[0.12em] text-[#fff1c5]">{position.claimablePayoutUsd !== null && position.claimablePayoutUsd !== undefined ? formatCurrency(position.claimablePayoutUsd, { compact: false, decimals: 2 }) : "--"}</p></div>
                                <button type="button" onClick={() => claimPosition(position.positionPubkey)} disabled={busyClaim} className="inline-flex items-center gap-2 border border-[#ffaa00]/32 bg-[#ffaa00]/10 px-3 py-2 text-[10px] tracking-[0.18em] text-[#ffd37a] transition hover:border-[#ffaa00]/56 hover:bg-[#ffaa00]/16 disabled:cursor-not-allowed disabled:opacity-40">{busyClaim ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}CLAIM</button>
                            </div> : null}
                            {closable ? <div className="mt-4 flex items-center justify-between gap-3 border border-[#ff4400]/18 bg-[#ff4400]/8 px-4 py-3 text-[10px] tracking-[0.16em] text-[#ffb39a]">
                                <div><p>OPEN POSITION</p><p className="mt-1 text-sm tracking-[0.12em] text-[#ffd8c7]">Exit this position at the current market state.</p></div>
                                <button type="button" onClick={() => closePosition(position.positionPubkey)} disabled={busyClose} className="inline-flex items-center gap-2 border border-[#ff4400]/32 bg-[#ff4400]/10 px-3 py-2 text-[10px] tracking-[0.18em] text-[#ffb39a] transition hover:border-[#ff4400]/56 hover:bg-[#ff4400]/16 disabled:cursor-not-allowed disabled:opacity-40">{busyClose ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}CLOSE</button>
                            </div> : null}
                        </div>;
                    })}
                </div>}
            </section>
        </div>
    );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
    return <div className="border border-[#00ff41]/12 bg-black/35 px-4 py-4"><p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff41]/36">{label}</p><p className="mt-3 text-xl tracking-[0.14em] text-[#d8ffe6]">{value}</p><p className="mt-3 text-[10px] leading-5 tracking-[0.14em] text-[#d8ffe6]/42">{hint}</p></div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
    return <div className="border border-[#00ff41]/10 bg-black/28 px-3 py-3"><p className="text-[9px] uppercase tracking-[0.2em] text-[#00ff41]/34">{label}</p><p className="mt-2 text-sm tracking-[0.12em] text-[#d8ffe6]/86">{value}</p></div>;
}

function FieldBlock({ label, value }: { label: string; value: string }) {
    return <div className="border border-[#00ff41]/12 bg-black/30 px-4 py-4"><p className="text-[10px] uppercase tracking-[0.2em] text-[#00ff41]/36">{label}</p><p className="mt-3 text-sm tracking-[0.12em] text-[#d8ffe6]">{value}</p></div>;
}

function ActionButton({ label, icon, onClick, busy, disabled, tone = "green" }: { label: string; icon: ReactNode; onClick: () => void; busy?: boolean; disabled?: boolean; tone?: "green" | "amber" | "blue" }) {
    const classes = tone === "amber" ? "border-[#ffaa00]/28 bg-[#ffaa00]/8 text-[#ffd37a] hover:border-[#ffaa00]/52 hover:bg-[#ffaa00]/14" : tone === "blue" ? "border-[#00aaff]/28 bg-[#00aaff]/8 text-[#8dd8ff] hover:border-[#00aaff]/52 hover:bg-[#00aaff]/14" : "border-[#00ff41]/28 bg-[#00ff41]/8 text-[#9cffba] hover:border-[#00ff41]/52 hover:bg-[#00ff41]/14";
    return <button type="button" onClick={onClick} disabled={disabled || busy} className={cn("inline-flex w-full items-center justify-center gap-2 border px-4 py-3 text-[11px] tracking-[0.22em] transition disabled:cursor-not-allowed disabled:opacity-40", classes)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}{label}</button>;
}

function LoaderPanel({ label }: { label: string }) {
    return <div className="mt-6 flex min-h-[180px] items-center justify-center border border-[#00ff41]/12 bg-[#00ff41]/[0.03]"><div className="flex items-center gap-2 text-[11px] tracking-[0.2em] text-[#00ff41]/56"><Loader2 className="h-4 w-4 animate-spin" />{label}</div></div>;
}

function ErrorPanel({ message, compact = false }: { message: string; compact?: boolean }) {
    return <div className={cn("border border-[#ff4400]/28 bg-[#ff4400]/8 text-[11px] tracking-[0.14em] text-[#ff9d7a]", compact ? "px-4 py-4" : "mt-6 px-4 py-5")}>{message}</div>;
}

function StatusLine({ label, value, href }: { label: string; value: string; href?: string }) {
    return <div className="flex items-center justify-between gap-4 py-1"><span className="text-[#00ff41]/36">{label}</span>{href ? <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#8dd8ff] hover:text-[#b8ecff]">{value}<ExternalLink className="h-3 w-3" /></a> : <span>{value}</span>}</div>;
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

async function sendSignedTransaction(serialized: Uint8Array) {
    const sendRes = await fetch("/api/rpc/send-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedTransaction: uint8ArrayToBase64(serialized) }),
    });
    const sendJson = await sendRes.json();
    if (!sendJson.success) throw new Error(sendJson.error || "Transaction could not be sent.");
    return sendJson;
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
        return new Date(value).toLocaleString("en-GB", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
        return value;
    }
}
