"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { Loader2, Wallet, ExternalLink, AlertCircle, Zap } from "lucide-react";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { getExplorerUrl, SOL_MINT } from "@/lib/solana";

interface BuyWidgetProps {
    tokenMint: string;
    tokenSymbol?: string;
    className?: string;
    variant?: "default" | "pump";
}

type Step = "input" | "quoting" | "quoted" | "signing" | "success" | "error";

export function BuyWidget({ tokenMint, tokenSymbol, className, variant = "default" }: BuyWidgetProps) {
    const { connected, publicKey, signTransaction } = useWallet();
    const { setVisible } = useWalletModal();
    const isBagsMint = tokenMint.endsWith("BAGS");
    const isPump = variant === "pump";

    const [step, setStep] = useState<Step>("input");
    const [amount, setAmount] = useState("0.1");
    const [slippage, setSlippage] = useState(
        process.env.NEXT_PUBLIC_DEFAULT_SLIPPAGE_BPS || "100"
    );
    const [quote, setQuote] = useState<Record<string, unknown> | null>(null);
    const [txSig, setTxSig] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const outputAmount = getNumericField(quote, "outputAmount", "outAmount");
    const priceImpact = getNumericField(quote, "priceImpact", "priceImpactPct");
    const fee = getNumericField(quote, "fee");

    const fetchQuote = useCallback(async () => {
        if (!amount || parseFloat(amount) <= 0) return;
        setStep("quoting");
        setError(null);
        try {
            const amountInBaseUnits = toSolBaseUnits(amount);
            if (amountInBaseUnits <= 0) {
                throw new Error("Amount must be greater than zero");
            }

            const res = await fetch("/api/jupiter/order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    outputMint: tokenMint,
                    inputMint: SOL_MINT,
                    amount: amountInBaseUnits,
                    taker: publicKey?.toBase58(),
                    slippageBps: parseInt(slippage, 10),
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || "Quote failed");
            setQuote(data.data);
            setStep("quoted");
        } catch (e) {
            setError(String(e));
            setStep("error");
        }
    }, [tokenMint, amount, slippage, publicKey]);

    const executeBuy = useCallback(async () => {
        if (!publicKey || !signTransaction) return;
        setStep("signing");
        setError(null);
        try {
            const amountInBaseUnits = toSolBaseUnits(amount);
            if (amountInBaseUnits <= 0) {
                throw new Error("Amount must be greater than zero");
            }

            const quoteRequestId = getQuoteRequestId(quote);
            if (!quote && !quoteRequestId) {
                throw new Error("Missing quote payload. Please fetch quote again.");
            }

            const txData = getStringField(
                quote,
                "transaction",
                "serializedTransaction",
                "swapTransaction"
            );
            if (!txData || !quoteRequestId) {
                throw new Error("Missing Jupiter order transaction. Please fetch quote again.");
            }

            const txBuffer = decodeTransactionData(txData);
            const transaction = VersionedTransaction.deserialize(txBuffer);
            const signed = await signTransaction(transaction);

            const executeRes = await fetch("/api/jupiter/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    outputMint: tokenMint,
                    requestId: quoteRequestId,
                    signedTransaction: uint8ArrayToBase64(signed.serialize()),
                }),
            });
            const executeData = await executeRes.json();
            if (!executeData.success) {
                throw new Error(executeData.error || "Jupiter execution failed");
            }

            const sig =
                getStringField(executeData.data, "signature", "txid") ??
                quoteRequestId;
            setTxSig(sig);
            setStep("success");
        } catch (e) {
            setError(String(e));
            setStep("error");
        }
    }, [quote, tokenMint, amount, publicKey, signTransaction]);

    return (
        <div
            className={cn(
                isPump
                    ? "rounded-2xl border border-white/[0.08] bg-[#14181c] p-4"
                    : "crt-panel p-5",
                className
            )}
        >
            {isPump ? (
                <div className="mb-4 flex rounded-xl bg-black/35 p-0.5">
                    <span className="flex flex-1 items-center justify-center rounded-lg bg-[#53ffb2] py-2.5 text-xs font-semibold text-black">
                        Buy
                    </span>
                    <button
                        type="button"
                        disabled
                        title="Sell routing is not available in BagScan yet"
                        className="flex flex-1 items-center justify-center rounded-lg py-2.5 text-xs font-medium text-white/25"
                    >
                        Sell
                    </button>
                </div>
            ) : (
                <div className="panel-header flex items-center gap-2">
                    <Zap className="h-4 w-4 text-[#ffaa00]/50" />
                    ╔══ QUICK BUY {tokenSymbol ? `$${tokenSymbol}` : ""} ══╗
                </div>
            )}

            {!isBagsMint ? (
                <div
                    className={cn(
                        "px-4 py-4",
                        isPump
                            ? "rounded-xl border border-amber-500/30 bg-amber-500/10"
                            : "border border-[#ffaa00]/25 bg-[#ffaa00]/5"
                    )}
                >
                    <p
                        className={cn(
                            "text-[10px] tracking-wider",
                            isPump ? "text-amber-200/90" : "text-[#ffaa00]/75"
                        )}
                    >
                        QUICK BUY IS ENABLED ONLY FOR ...BAGS TOKENS.
                    </p>
                </div>
            ) : !connected ? (
                <button
                    onClick={() => setVisible(true)}
                    className={cn(
                        "flex w-full items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all duration-300",
                        isPump
                            ? "rounded-xl bg-[#53ffb2] text-black hover:brightness-110"
                            : "border-2 border-[#00ff41]/40 bg-[#00ff41]/10 text-[#00ff41] text-xs tracking-wider hover:border-[#00ff41]/60 hover:bg-[#00ff41]/20"
                    )}
                    style={isPump ? undefined : { textShadow: "0 0 6px rgba(0,255,65,0.3)" }}
                >
                    <Wallet className="h-4 w-4" />
                    CONNECT WALLET TO BUY
                </button>
            ) : (
                <div className="space-y-3">
                    <div>
                        <label
                            className={cn(
                                "mb-1 block text-[10px] font-medium uppercase tracking-widest",
                                isPump ? "text-white/40" : "text-[9px] text-[#00ff41]/30 tracking-[0.2em]"
                            )}
                        >
                            Amount (SOL)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={amount}
                            onChange={(e) => {
                                setAmount(e.target.value);
                                setStep("input");
                            }}
                            className={cn(
                                "w-full px-3 py-3 text-sm focus:outline-none disabled:opacity-50",
                                isPump
                                    ? "rounded-xl border border-white/[0.1] bg-black/40 text-white placeholder:text-white/25 focus:border-[#53ffb2]/50"
                                    : "border border-[#00ff41]/20 bg-black/60 text-xs tracking-wider text-[#00ff41] focus:border-[#00ff41]/50 focus:shadow-[0_0_10px_rgba(0,255,65,0.1)]"
                            )}
                            disabled={step === "quoting" || step === "signing"}
                        />
                    </div>

                    <div>
                        <label
                            className={cn(
                                "mb-1 block text-[10px] font-medium uppercase tracking-widest",
                                isPump ? "text-white/40" : "text-[9px] text-[#00ff41]/30 tracking-[0.2em]"
                            )}
                        >
                            Slippage (bps)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="10000"
                            value={slippage}
                            onChange={(e) => {
                                setSlippage(e.target.value);
                                setStep("input");
                            }}
                            className={cn(
                                "w-full px-3 py-2.5 text-sm focus:outline-none disabled:opacity-50",
                                isPump
                                    ? "rounded-xl border border-white/[0.1] bg-black/40 text-white focus:border-[#53ffb2]/50"
                                    : "border border-[#00ff41]/20 bg-black/60 text-xs tracking-wider text-[#00ff41] focus:border-[#00ff41]/50 focus:shadow-[0_0_10px_rgba(0,255,65,0.1)]"
                            )}
                            disabled={step === "quoting" || step === "signing"}
                        />
                        <p
                            className={cn(
                                "mt-1 text-[10px]",
                                isPump ? "text-white/30" : "text-[8px] tracking-wider text-[#00ff41]/15"
                            )}
                        >
                            100 bps = 1% slippage
                        </p>
                    </div>

                    {quote && step === "quoted" && (
                        <div
                            className={cn(
                                "space-y-1.5 p-3",
                                isPump
                                    ? "rounded-xl border border-white/[0.08] bg-black/30"
                                    : "border border-[#00ff41]/15 bg-black/40"
                            )}
                        >
                            {outputAmount !== null && (
                                <div
                                    className={cn(
                                        "flex justify-between text-[11px]",
                                        isPump ? "text-white/80" : "text-[10px] tracking-wider"
                                    )}
                                >
                                    <span className={isPump ? "text-white/45" : "text-[#00ff41]/30"}>You receive</span>
                                    <span className={isPump ? "font-medium text-[#53ffb2]" : "text-[#00ff41]/70"}>
                                        {formatNumber(outputAmount, false)} {tokenSymbol ?? "tokens"}
                                    </span>
                                </div>
                            )}
                            {priceImpact !== null && (
                                <div
                                    className={cn(
                                        "flex justify-between text-[11px]",
                                        isPump ? "" : "text-[10px] tracking-wider"
                                    )}
                                >
                                    <span className={isPump ? "text-white/45" : "text-[#00ff41]/30"}>Price impact</span>
                                    <span
                                        className={cn(
                                            priceImpact > 5 ? "text-[#ff6b4a]" : isPump ? "text-white/70" : "text-[#00ff41]/60"
                                        )}
                                    >
                                        {priceImpact.toFixed(2)}%
                                    </span>
                                </div>
                            )}
                            {fee !== null && (
                                <div
                                    className={cn(
                                        "flex justify-between text-[11px]",
                                        isPump ? "" : "text-[10px] tracking-wider"
                                    )}
                                >
                                    <span className={isPump ? "text-white/45" : "text-[#00ff41]/30"}>Fee</span>
                                    <span className={isPump ? "text-white/60" : "text-[#00ff41]/50"}>{formatCurrency(fee)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        {(step === "input" || step === "error") && (
                            <button
                                onClick={fetchQuote}
                                disabled={!amount || parseFloat(amount) <= 0}
                                className={cn(
                                    "w-full py-2.5 text-[11px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-30",
                                    isPump
                                        ? "rounded-xl border border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.1]"
                                        : "border border-[#00ff41]/30 bg-[#00ff41]/5 text-[10px] tracking-wider text-[#00ff41]/70 hover:bg-[#00ff41]/10 hover:text-[#00ff41]"
                                )}
                            >
                                Get quote
                            </button>
                        )}

                        {step === "quoting" && (
                            <button
                                disabled
                                className={cn(
                                    "flex w-full items-center justify-center gap-2 py-2.5 text-[11px]",
                                    isPump
                                        ? "rounded-xl border border-white/10 text-white/40"
                                        : "border border-[#00ff41]/15 text-[10px] tracking-wider text-[#00ff41]/30"
                                )}
                            >
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Fetching quote…
                            </button>
                        )}

                        {step === "quoted" && (
                            <button
                                onClick={executeBuy}
                                className={cn(
                                    "w-full py-3.5 text-sm font-semibold transition-all",
                                    isPump
                                        ? "rounded-xl bg-[#53ffb2] text-black hover:brightness-110"
                                        : "border-2 border-[#00ff41]/50 bg-[#00ff41]/15 text-xs tracking-wider text-[#00ff41] hover:border-[#00ff41]/70 hover:bg-[#00ff41]/25"
                                )}
                                style={isPump ? undefined : { textShadow: "0 0 6px rgba(0,255,65,0.3)" }}
                            >
                                Place trade
                            </button>
                        )}

                        {step === "signing" && (
                            <button
                                disabled
                                className={cn(
                                    "flex w-full items-center justify-center gap-2 py-3 text-[11px]",
                                    isPump
                                        ? "rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-200/70"
                                        : "border border-[#ffaa00]/30 bg-[#ffaa00]/5 text-[10px] tracking-wider text-[#ffaa00]/50"
                                )}
                            >
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Awaiting signature…
                            </button>
                        )}

                        {step === "success" && txSig && (
                            <div
                                className={cn(
                                    "p-3",
                                    isPump
                                        ? "rounded-xl border border-[#53ffb2]/35 bg-[#53ffb2]/10"
                                        : "border border-[#00ff41]/30 bg-[#00ff41]/5"
                                )}
                            >
                                <p
                                    className={cn(
                                        "mb-2 text-[11px] font-medium",
                                        isPump ? "text-[#53ffb2]" : "text-[10px] tracking-wider text-[#00ff41]"
                                    )}
                                    style={isPump ? undefined : { textShadow: "0 0 4px rgba(0,255,65,0.3)" }}
                                >
                                    Transaction sent
                                </p>
                                <a
                                    href={getExplorerUrl(txSig)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                        "flex items-center gap-1 text-[10px]",
                                        isPump
                                            ? "text-[#53ffb2]/80 hover:text-[#53ffb2]"
                                            : "text-[9px] tracking-wider text-[#00ff41]/40 hover:text-[#00ff41]/70"
                                    )}
                                >
                                    View on explorer
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div
                            className={cn(
                                "p-3",
                                isPump
                                    ? "rounded-xl border border-red-500/35 bg-red-500/10"
                                    : "border border-[#ff4400]/30 bg-[#ff4400]/5"
                            )}
                        >
                            <div className="flex items-start gap-2">
                                <AlertCircle
                                    className={cn(
                                        "mt-0.5 h-4 w-4 flex-shrink-0",
                                        isPump ? "text-red-400/80" : "text-[#ff4400]/50"
                                    )}
                                />
                                <div>
                                    <p
                                        className={cn(
                                            "text-[11px]",
                                            isPump ? "text-red-200/90" : "text-[10px] tracking-wider text-[#ff4400]/60"
                                        )}
                                    >
                                        {error}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setError(null);
                                            setStep("input");
                                        }}
                                        className={cn(
                                            "mt-1 text-[10px]",
                                            isPump
                                                ? "text-red-300/70 hover:text-red-200"
                                                : "text-[9px] tracking-wider text-[#ff4400]/30 hover:text-[#ff4400]/60"
                                        )}
                                    >
                                        Try again
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function getQuoteRequestId(quote: Record<string, unknown> | null): string | null {
    if (!quote) return null;

    const direct =
        typeof quote.quoteRequestId === "string"
            ? quote.quoteRequestId
            : typeof quote.requestId === "string"
                ? quote.requestId
            : typeof quote.id === "string"
                ? quote.id
                : null;
    if (direct) return direct;

    const nested = quote.quoteRequest as Record<string, unknown> | undefined;
    if (nested && typeof nested.id === "string") {
        return nested.id;
    }

    return null;
}

function toSolBaseUnits(amountUi: string): number {
    const parsed = Number(amountUi);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.floor(parsed * 1_000_000_000);
}

function getNumericField(
    quote: Record<string, unknown> | null,
    ...keys: string[]
): number | null {
    if (!quote) return null;

    for (const key of keys) {
        const raw = quote[key];
        if (typeof raw === "number" && Number.isFinite(raw)) return raw;
        if (typeof raw === "string") {
            const parsed = Number(raw);
            if (Number.isFinite(parsed)) return parsed;
        }
    }

    return null;
}

function getStringField(
    payload: Record<string, unknown> | null | undefined,
    ...keys: string[]
): string | null {
    if (!payload) return null;

    for (const key of keys) {
        const raw = payload[key];
        if (typeof raw === "string" && raw.trim().length > 0) {
            return raw;
        }
    }

    return null;
}

function decodeTransactionData(raw: string): Uint8Array {
    const base64 = tryDecodeBase64(raw);
    if (base64) return base64;

    const base58 = tryDecodeBase58(raw);
    if (base58) return base58;

    throw new Error("Unsupported transaction encoding returned by swap API");
}

function tryDecodeBase64(raw: string): Uint8Array | null {
    try {
        const bytes = base64ToUint8Array(raw);
        VersionedTransaction.deserialize(bytes);
        return bytes;
    } catch {
        return null;
    }
}

function tryDecodeBase58(raw: string): Uint8Array | null {
    try {
        const bytes = bs58.decode(raw);
        VersionedTransaction.deserialize(bytes);
        return bytes;
    } catch {
        return null;
    }
}

function base64ToUint8Array(raw: string): Uint8Array {
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
}
