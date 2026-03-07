"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import { Loader2, Wallet, ExternalLink, AlertCircle, Zap } from "lucide-react";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { getExplorerUrl } from "@/lib/solana";

interface BuyWidgetProps {
    tokenMint: string;
    tokenSymbol?: string;
    className?: string;
}

type Step = "input" | "quoting" | "quoted" | "signing" | "success" | "error";

export function BuyWidget({ tokenMint, tokenSymbol, className }: BuyWidgetProps) {
    const { connected, publicKey, signTransaction } = useWallet();
    const { setVisible } = useWalletModal();

    const [step, setStep] = useState<Step>("input");
    const [amount, setAmount] = useState("0.1");
    const [slippage, setSlippage] = useState(
        process.env.NEXT_PUBLIC_DEFAULT_SLIPPAGE_BPS || "100"
    );
    const [quote, setQuote] = useState<Record<string, unknown> | null>(null);
    const [txSig, setTxSig] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchQuote = useCallback(async () => {
        if (!amount || parseFloat(amount) <= 0) return;
        setStep("quoting");
        setError(null);
        try {
            const res = await fetch("/api/quote", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tokenMint,
                    amount: parseFloat(amount),
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
    }, [tokenMint, amount, slippage]);

    const executeBuy = useCallback(async () => {
        if (!publicKey || !signTransaction) return;
        setStep("signing");
        setError(null);
        try {
            const res = await fetch("/api/swap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tokenMint,
                    userPublicKey: publicKey.toBase58(),
                    amount: parseFloat(amount),
                    slippageBps: parseInt(slippage, 10),
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || "Swap failed");

            const txData = data.data.transaction || data.data.serializedTransaction;
            if (!txData) throw new Error("No transaction returned");

            const txBuffer = Buffer.from(txData, "base64");
            const transaction = VersionedTransaction.deserialize(txBuffer);
            const signed = await signTransaction(transaction);

            const { Connection } = await import("@solana/web3.js");
            const connection = new Connection(
                process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
            );
            const sig = await connection.sendRawTransaction(signed.serialize(), {
                skipPreflight: true,
            });
            setTxSig(sig);
            setStep("success");
        } catch (e) {
            setError(String(e));
            setStep("error");
        }
    }, [tokenMint, amount, slippage, publicKey, signTransaction]);

    return (
        <div className={cn("crt-panel p-5", className)}>
            <div className="panel-header flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#ffaa00]/50" />
                ╔══ QUICK BUY {tokenSymbol ? `$${tokenSymbol}` : ""} ══╗
            </div>

            {!connected ? (
                <button
                    onClick={() => setVisible(true)}
                    className="w-full py-3 border-2 border-[#00ff41]/40 bg-[#00ff41]/10 text-[#00ff41] text-xs tracking-wider
                     hover:bg-[#00ff41]/20 hover:border-[#00ff41]/60
                     transition-all duration-300 flex items-center justify-center gap-2"
                    style={{ textShadow: '0 0 6px rgba(0,255,65,0.3)' }}
                >
                    <Wallet className="w-4 h-4" />
                    CONNECT WALLET TO BUY
                </button>
            ) : (
                <div className="space-y-3">
                    <div>
                        <label className="text-[9px] text-[#00ff41]/30 uppercase tracking-[0.2em] mb-1 block">AMOUNT (SOL)</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={amount}
                            onChange={(e) => { setAmount(e.target.value); setStep("input"); }}
                            className="w-full px-3 py-2.5 bg-black/60 border border-[#00ff41]/20 text-xs text-[#00ff41] tracking-wider focus:outline-none focus:border-[#00ff41]/50 focus:shadow-[0_0_10px_rgba(0,255,65,0.1)]"
                            disabled={step === "quoting" || step === "signing"}
                        />
                    </div>

                    <div>
                        <label className="text-[9px] text-[#00ff41]/30 uppercase tracking-[0.2em] mb-1 block">SLIPPAGE (BPS)</label>
                        <input
                            type="number"
                            min="0"
                            max="10000"
                            value={slippage}
                            onChange={(e) => { setSlippage(e.target.value); setStep("input"); }}
                            className="w-full px-3 py-2.5 bg-black/60 border border-[#00ff41]/20 text-xs text-[#00ff41] tracking-wider focus:outline-none focus:border-[#00ff41]/50 focus:shadow-[0_0_10px_rgba(0,255,65,0.1)]"
                            disabled={step === "quoting" || step === "signing"}
                        />
                        <p className="text-[8px] text-[#00ff41]/15 mt-0.5 tracking-wider">100 BPS = 1% SLIPPAGE</p>
                    </div>

                    {quote && step === "quoted" && (
                        <div className="p-3 border border-[#00ff41]/15 bg-black/40 space-y-1.5">
                            {quote.outputAmount !== undefined && (
                                <div className="flex justify-between text-[10px] tracking-wider">
                                    <span className="text-[#00ff41]/30">YOU RECEIVE</span>
                                    <span className="text-[#00ff41]/70">{formatNumber(quote.outputAmount as number, false)} {tokenSymbol ?? "TOKENS"}</span>
                                </div>
                            )}
                            {quote.priceImpact !== undefined && (
                                <div className="flex justify-between text-[10px] tracking-wider">
                                    <span className="text-[#00ff41]/30">PRICE IMPACT</span>
                                    <span className={cn((quote.priceImpact as number) > 5 ? "text-[#ff4400]" : "text-[#00ff41]/60")}>
                                        {(quote.priceImpact as number).toFixed(2)}%
                                    </span>
                                </div>
                            )}
                            {quote.fee !== undefined && (
                                <div className="flex justify-between text-[10px] tracking-wider">
                                    <span className="text-[#00ff41]/30">FEE</span>
                                    <span className="text-[#00ff41]/50">{formatCurrency(quote.fee as number)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        {(step === "input" || step === "error") && (
                            <button
                                onClick={fetchQuote}
                                disabled={!amount || parseFloat(amount) <= 0}
                                className="w-full py-2.5 border border-[#00ff41]/30 bg-[#00ff41]/5 text-[#00ff41]/70 text-[10px] tracking-wider
                                 hover:bg-[#00ff41]/10 hover:text-[#00ff41] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                GET QUOTE
                            </button>
                        )}

                        {step === "quoting" && (
                            <button disabled className="w-full py-2.5 border border-[#00ff41]/15 text-[#00ff41]/30 text-[10px] tracking-wider flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                FETCHING QUOTE...
                            </button>
                        )}

                        {step === "quoted" && (
                            <button
                                onClick={executeBuy}
                                className="w-full py-3 border-2 border-[#00ff41]/50 bg-[#00ff41]/15 text-[#00ff41] text-xs tracking-wider
                                 hover:bg-[#00ff41]/25 hover:border-[#00ff41]/70 transition-all"
                                style={{ textShadow: '0 0 6px rgba(0,255,65,0.3)' }}
                            >
                                BUY {tokenSymbol ?? "TOKEN"}
                            </button>
                        )}

                        {step === "signing" && (
                            <button disabled className="w-full py-3 border border-[#ffaa00]/30 bg-[#ffaa00]/5 text-[#ffaa00]/50 text-[10px] tracking-wider flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                AWAITING SIGNATURE...
                            </button>
                        )}

                        {step === "success" && txSig && (
                            <div className="p-3 border border-[#00ff41]/30 bg-[#00ff41]/5">
                                <p className="text-[10px] text-[#00ff41] tracking-wider mb-2" style={{ textShadow: '0 0 4px rgba(0,255,65,0.3)' }}>
                                    ▶ TRANSACTION SENT
                                </p>
                                <a
                                    href={getExplorerUrl(txSig)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[9px] text-[#00ff41]/40 hover:text-[#00ff41]/70 flex items-center gap-1 tracking-wider"
                                >
                                    VIEW ON EXPLORER
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="p-3 border border-[#ff4400]/30 bg-[#ff4400]/5">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-[#ff4400]/50 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[10px] text-[#ff4400]/60 tracking-wider">{error}</p>
                                    <button
                                        onClick={() => { setError(null); setStep("input"); }}
                                        className="text-[9px] text-[#ff4400]/30 hover:text-[#ff4400]/60 mt-1 tracking-wider"
                                    >
                                        TRY AGAIN
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
