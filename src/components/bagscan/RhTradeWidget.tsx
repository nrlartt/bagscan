"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    useAccount,
    useBalance,
    useConnect,
    useReadContract,
    useSwitchChain,
    useWaitForTransactionReceipt,
    useWriteContract,
} from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, Check, ExternalLink, Loader2, TriangleAlert, Wallet } from "lucide-react";
import { maxUint256 } from "viem";
import { cn, formatCurrency } from "@/lib/utils";
import { RH_CHAIN_ID, RH_THEME, rhExplorerPoolUrl, rhExplorerTxUrl } from "@/lib/rh/chain";
import { ROBINHOOD_LAUNCHPAD } from "@/lib/rh/addresses";
import {
    DEFAULT_SLIPPAGE_BPS,
    ERC20_ABI,
    RH_CURVE_ABI,
    SLIPPAGE_OPTIONS_BPS,
    applySlippage,
    formatUnitsSafe,
    parseUnitsSafe,
} from "@/lib/rh/curve";
import {
    PERMIT2_ABI,
    PERMIT2_EXPIRY_SECONDS,
    UNIVERSAL_ROUTER_ABI,
    WETH_ABI,
    encodeV4SwapExecuteArgs,
    maxUint160,
    nextPoolTradeStep,
    poolInputToken,
} from "@/lib/rh/pool";
import type { RhQuoteResponse, RhTradeSide } from "@/lib/rh/api-types";
import type { RhTokenView } from "@/lib/rh/token";

const QUICK_ETH = ["0.001", "0.005", "0.01", "0.05"] as const;
const QUICK_SELL_PCT = [25, 50, 75, 100] as const;

const WETH = ROBINHOOD_LAUNCHPAD.weth as `0x${string}`;
const PERMIT2 = ROBINHOOD_LAUNCHPAD.permit2 as `0x${string}`;
const UNIVERSAL_ROUTER = ROBINHOOD_LAUNCHPAD.universalRouter as `0x${string}`;

async function fetchQuote(
    tokenAddress: string,
    side: RhTradeSide,
    amountWei: bigint
): Promise<RhQuoteResponse> {
    const params = new URLSearchParams({
        tokenAddress,
        side,
        amountWei: amountWei.toString(),
    });
    const res = await fetch(`/api/rh/quote?${params}`);
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error ?? "Quote failed");
    return json.data as RhQuoteResponse;
}

export function RhTradeWidget({ token, ethUsd }: { token: RhTokenView; ethUsd?: number }) {
    const [side, setSide] = useState<RhTradeSide>("buy");
    const [amount, setAmount] = useState("");
    const [slippageBps, setSlippageBps] = useState<number>(DEFAULT_SLIPPAGE_BPS);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const { address, isConnected, chainId } = useAccount();
    const { connectors, connect, isPending: isConnecting } = useConnect();
    const { switchChain, isPending: isSwitching } = useSwitchChain();
    const { writeContractAsync, isPending: isWriting } = useWriteContract();
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
    const receipt = useWaitForTransactionReceipt({ hash: txHash, chainId: RH_CHAIN_ID });

    const curve = token.curve as `0x${string}` | undefined;
    const tokenAddress = token.address as `0x${string}`;
    const isPool = token.isMigrated;
    const wrongChain = isConnected && chainId !== RH_CHAIN_ID;

    const { data: ethBalance } = useBalance({
        address,
        chainId: RH_CHAIN_ID,
        query: { enabled: Boolean(address), refetchInterval: 20_000 },
    });

    const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
        abi: ERC20_ABI,
        address: tokenAddress,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
        chainId: RH_CHAIN_ID,
        query: { enabled: Boolean(address), refetchInterval: 20_000 },
    });

    const { data: wethBalance, refetch: refetchWethBalance } = useReadContract({
        abi: WETH_ABI,
        address: WETH,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
        chainId: RH_CHAIN_ID,
        query: { enabled: Boolean(address && isPool), refetchInterval: 20_000 },
    });

    const poolInput = isPool ? poolInputToken(tokenAddress, side) : null;

    const { data: curveAllowance, refetch: refetchCurveAllowance } = useReadContract({
        abi: ERC20_ABI,
        address: tokenAddress,
        functionName: "allowance",
        args: address && curve ? [address, curve] : undefined,
        chainId: RH_CHAIN_ID,
        query: { enabled: Boolean(address && curve && !isPool && side === "sell") },
    });

    const { data: erc20ToPermit2, refetch: refetchErc20ToPermit2 } = useReadContract({
        abi: ERC20_ABI,
        address: poolInput ?? undefined,
        functionName: "allowance",
        args: address && poolInput ? [address, PERMIT2] : undefined,
        chainId: RH_CHAIN_ID,
        query: { enabled: Boolean(address && poolInput && isPool) },
    });

    const { data: permit2Allowance, refetch: refetchPermit2Allowance } = useReadContract({
        abi: PERMIT2_ABI,
        address: PERMIT2,
        functionName: "allowance",
        args: address && poolInput ? [address, poolInput, UNIVERSAL_ROUTER] : undefined,
        chainId: RH_CHAIN_ID,
        query: { enabled: Boolean(address && poolInput && isPool) },
    });

    const amountWei = useMemo(() => parseUnitsSafe(amount || "0"), [amount]);
    const hasAmount = amountWei != null && amountWei > 0n;

    const quoteQuery = useQuery({
        queryKey: ["rh-quote", tokenAddress, side, amountWei?.toString() ?? "0"],
        queryFn: () => fetchQuote(tokenAddress, side, amountWei!),
        enabled: hasAmount,
        refetchInterval: 15_000,
        retry: false,
    });

    const quote = quoteQuery.data;
    const minOut = quote ? applySlippage(BigInt(quote.amountOutWei), slippageBps) : null;

    const [lastAmountKey, setLastAmountKey] = useState(`${side}|${amount}`);
    const amountKey = `${side}|${amount}`;
    if (lastAmountKey !== amountKey) {
        setLastAmountKey(amountKey);
        if (txHash) setTxHash(undefined);
        if (submitError) setSubmitError(null);
    }

    const wethBeforeSwapRef = useRef<bigint | null>(null);
    const unwrapAttemptedRef = useRef(false);

    useEffect(() => {
        if (receipt.isSuccess) {
            void refetchTokenBalance();
            void refetchWethBalance();
            if (!isPool) void refetchCurveAllowance();
            if (isPool) {
                void refetchErc20ToPermit2();
                void refetchPermit2Allowance();
            }
        }
    }, [
        receipt.isSuccess,
        refetchTokenBalance,
        refetchWethBalance,
        refetchCurveAllowance,
        refetchErc20ToPermit2,
        refetchPermit2Allowance,
        isPool,
    ]);

    // After a pool sell swap, unwrap WETH proceeds back to native ETH.
    useEffect(() => {
        if (
            !receipt.isSuccess ||
            !isPool ||
            side !== "sell" ||
            wethBeforeSwapRef.current == null ||
            unwrapAttemptedRef.current ||
            !address
        ) {
            return;
        }

        unwrapAttemptedRef.current = true;

        void (async () => {
            try {
                const result = await refetchWethBalance();
                const wethAfter = (result.data as bigint | undefined) ?? 0n;
                const delta = wethAfter - wethBeforeSwapRef.current!;
                wethBeforeSwapRef.current = null;
                if (delta <= 0n) return;

                const hash = await writeContractAsync({
                    abi: WETH_ABI,
                    address: WETH,
                    functionName: "withdraw",
                    args: [delta],
                    chainId: RH_CHAIN_ID,
                });
                setTxHash(hash);
            } catch {
                /* unwrap is optional — proceeds stay as WETH */
            } finally {
                unwrapAttemptedRef.current = false;
            }
        })();
    }, [receipt.isSuccess, isPool, side, address, refetchWethBalance, writeContractAsync]);

    const insufficientEth =
        side === "buy" && hasAmount && ethBalance != null && amountWei! > ethBalance.value;
    const insufficientTokens =
        side === "sell" && hasAmount && tokenBalance != null && amountWei! > (tokenBalance as bigint);

    const poolStep =
        isPool && hasAmount
            ? nextPoolTradeStep({
                  side,
                  amountIn: amountWei!,
                  wethBalance: (wethBalance as bigint | undefined) ?? 0n,
                  erc20ToPermit2: (erc20ToPermit2 as bigint | undefined) ?? 0n,
                  permit2Amount: permit2Allowance?.[0] ?? 0n,
                  permit2Expiration: Number(permit2Allowance?.[1] ?? 0),
              })
            : null;

    const needsCurveApproval =
        !isPool &&
        side === "sell" &&
        hasAmount &&
        curveAllowance != null &&
        (curveAllowance as bigint) < amountWei!;

    async function handleSubmit() {
        setSubmitError(null);
        if (!hasAmount || minOut == null) return;

        try {
            if (isPool) {
                if (poolStep === "wrap") {
                    const wrapAmount =
                        amountWei! > ((wethBalance as bigint | undefined) ?? 0n)
                            ? amountWei! - ((wethBalance as bigint | undefined) ?? 0n)
                            : 0n;
                    const hash = await writeContractAsync({
                        abi: WETH_ABI,
                        address: WETH,
                        functionName: "deposit",
                        value: wrapAmount,
                        chainId: RH_CHAIN_ID,
                    });
                    setTxHash(hash);
                    return;
                }

                if (poolStep === "approve_erc20" && poolInput) {
                    const hash = await writeContractAsync({
                        abi: ERC20_ABI,
                        address: poolInput,
                        functionName: "approve",
                        args: [PERMIT2, maxUint256],
                        chainId: RH_CHAIN_ID,
                    });
                    setTxHash(hash);
                    return;
                }

                if (poolStep === "approve_permit2" && poolInput) {
                    const nowSec = Math.floor(Date.now() / 1000);
                    const hash = await writeContractAsync({
                        abi: PERMIT2_ABI,
                        address: PERMIT2,
                        functionName: "approve",
                        args: [poolInput, UNIVERSAL_ROUTER, maxUint160, nowSec + PERMIT2_EXPIRY_SECONDS],
                        chainId: RH_CHAIN_ID,
                    });
                    setTxHash(hash);
                    return;
                }

                if (poolStep === "swap") {
                    if (side === "sell") {
                        wethBeforeSwapRef.current = (wethBalance as bigint | undefined) ?? 0n;
                    }
                    const { commands, inputs, deadline } = encodeV4SwapExecuteArgs(
                        tokenAddress,
                        side,
                        amountWei!,
                        minOut
                    );
                    const hash = await writeContractAsync({
                        abi: UNIVERSAL_ROUTER_ABI,
                        address: UNIVERSAL_ROUTER,
                        functionName: "execute",
                        args: [commands, inputs, deadline],
                        chainId: RH_CHAIN_ID,
                    });
                    setTxHash(hash);
                    return;
                }

                return;
            }

            if (!curve) return;

            if (needsCurveApproval) {
                const hash = await writeContractAsync({
                    abi: ERC20_ABI,
                    address: tokenAddress,
                    functionName: "approve",
                    args: [curve, amountWei!],
                    chainId: RH_CHAIN_ID,
                });
                setTxHash(hash);
                return;
            }

            const hash =
                side === "buy"
                    ? await writeContractAsync({
                          abi: RH_CURVE_ABI,
                          address: curve,
                          functionName: "buy",
                          args: [minOut],
                          value: amountWei!,
                          chainId: RH_CHAIN_ID,
                      })
                    : await writeContractAsync({
                          abi: RH_CURVE_ABI,
                          address: curve,
                          functionName: "sell",
                          args: [amountWei!, minOut],
                          chainId: RH_CHAIN_ID,
                      });
            setTxHash(hash);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Transaction failed";
            setSubmitError(/user rejected|denied/i.test(message) ? null : message.split("\n")[0]);
        }
    }

    function actionLabel(): string {
        if (insufficientEth) return "INSUFFICIENT ETH";
        if (insufficientTokens) return `INSUFFICIENT ${token.symbol ?? "TOKENS"}`;
        if (isPool) {
            switch (poolStep) {
                case "wrap":
                    return "WRAP ETH";
                case "approve_erc20":
                    return "APPROVE";
                case "approve_permit2":
                    return "ENABLE ROUTER";
                case "swap":
                    return side === "buy" ? "BUY" : "SELL";
                default:
                    return side === "buy" ? "BUY" : "SELL";
            }
        }
        if (needsCurveApproval) return "APPROVE";
        return side === "buy" ? "BUY" : "SELL";
    }

    const outputLabel = side === "buy" ? token.symbol ?? "tokens" : "ETH";
    const inputLabel = side === "buy" ? "ETH" : token.symbol ?? "tokens";
    const quotedOut = quote ? formatUnitsSafe(BigInt(quote.amountOutWei), 18, side === "buy" ? 2 : 6) : null;
    const busy = isWriting || receipt.isLoading;
    const canTrade = isPool ? Boolean(poolStep) : Boolean(curve);

    return (
        <div className="rounded-2xl border border-[#00C805]/25 bg-gradient-to-b from-[#0a120a] to-[#070907] p-4 shadow-[0_0_40px_rgba(0,200,5,0.06)]">
            {isPool ? (
                <p className="mb-3 text-[9px] tracking-[0.14em] text-[#00C805]/55">
                    GRADUATED · UNISWAP V4 POOL
                </p>
            ) : null}

            <div className="mb-3 flex rounded-xl border border-white/[0.08] p-1">
                {(["buy", "sell"] as const).map((s) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => {
                            setSide(s);
                            setAmount("");
                        }}
                        className={cn(
                            "flex-1 rounded-lg py-2 text-[11px] font-semibold tracking-[0.14em] transition-colors",
                            side === s
                                ? s === "buy"
                                    ? "bg-[#00C805] text-black"
                                    : "bg-[#ff5f5f] text-black"
                                : "text-white/45 hover:text-white/75"
                        )}
                        aria-pressed={side === s}
                    >
                        {s.toUpperCase()}
                    </button>
                ))}
            </div>

            <label className="block">
                <span className="mb-1 flex items-center justify-between text-[9px] tracking-[0.14em] text-white/35">
                    <span>YOU PAY ({inputLabel})</span>
                    {isConnected ? (
                        <span className="tabular-nums">
                            {side === "buy"
                                ? ethBalance
                                    ? `${formatUnitsSafe(ethBalance.value, 18, 5)} ETH`
                                    : "—"
                                : tokenBalance != null
                                  ? formatUnitsSafe(tokenBalance as bigint, 18, 2)
                                  : "—"}
                        </span>
                    ) : null}
                </span>
                <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.0"
                    className="w-full rounded-xl border border-white/[0.09] bg-black/50 px-3 py-3 text-lg font-semibold tabular-nums text-white/92 placeholder:text-white/20 focus:border-[#00C805]/45 focus:outline-none"
                />
            </label>

            <div className="mt-2 flex flex-wrap gap-1.5">
                {side === "buy"
                    ? QUICK_ETH.map((v) => (
                          <button
                              key={v}
                              type="button"
                              onClick={() => setAmount(v)}
                              className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[10px] tabular-nums text-white/50 transition-colors hover:border-[#00C805]/30 hover:text-[#00C805]"
                          >
                              {v} ETH
                          </button>
                      ))
                    : QUICK_SELL_PCT.map((p) => (
                          <button
                              key={p}
                              type="button"
                              disabled={tokenBalance == null}
                              onClick={() => {
                                  if (tokenBalance == null) return;
                                  const part = ((tokenBalance as bigint) * BigInt(p)) / 100n;
                                  setAmount(formatUnitsSafe(part, 18, 18));
                              }}
                              className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[10px] tabular-nums text-white/50 transition-colors hover:border-[#00C805]/30 hover:text-[#00C805] disabled:opacity-30"
                          >
                              {p}%
                          </button>
                      ))}
            </div>

            <div className="my-3 flex justify-center">
                <ArrowDown className="h-4 w-4 text-white/25" />
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-black/40 px-3 py-3">
                <p className="text-[9px] tracking-[0.14em] text-white/35">YOU RECEIVE ({outputLabel})</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-white/92">
                    {quoteQuery.isFetching && !quote ? (
                        <Loader2 className="h-4 w-4 animate-spin text-white/40" />
                    ) : quotedOut ? (
                        quotedOut
                    ) : (
                        "—"
                    )}
                </p>
                {quote && side === "sell" && ethUsd != null ? (
                    <p className="text-[10px] tabular-nums text-white/35">
                        ≈ {formatCurrency((Number(BigInt(quote.amountOutWei)) / 1e18) * ethUsd)}
                    </p>
                ) : null}
                {quote && side === "buy" && ethUsd != null && hasAmount ? (
                    <p className="text-[10px] tabular-nums text-white/35">
                        ≈ {formatCurrency((Number(amountWei!) / 1e18) * ethUsd)}
                    </p>
                ) : null}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[9px] tracking-[0.14em] text-white/35">SLIPPAGE</span>
                <div className="flex gap-1">
                    {SLIPPAGE_OPTIONS_BPS.map((bps) => (
                        <button
                            key={bps}
                            type="button"
                            onClick={() => setSlippageBps(bps)}
                            className={cn(
                                "rounded-lg px-2 py-1 text-[10px] tabular-nums transition-colors",
                                slippageBps === bps
                                    ? "bg-[#00C805]/15 text-[#00C805]"
                                    : "text-white/40 hover:text-white/70"
                            )}
                        >
                            {bps / 100}%
                        </button>
                    ))}
                </div>
            </div>

            {minOut != null ? (
                <p className="mt-2 text-[10px] tabular-nums text-white/30">
                    Minimum received {formatUnitsSafe(minOut, 18, side === "buy" ? 2 : 6)} {outputLabel}
                </p>
            ) : null}

            {quoteQuery.error ? (
                <p className="mt-2 text-[10px] leading-relaxed text-[#ff8a8a]">
                    {(quoteQuery.error as Error).message}
                </p>
            ) : null}

            <div className="mt-4">
                {!isConnected ? (
                    <button
                        type="button"
                        onClick={() => connectors[0] && connect({ connector: connectors[0] })}
                        disabled={isConnecting}
                        className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[11px] font-semibold tracking-[0.12em] text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: RH_THEME.green }}
                    >
                        <Wallet className="h-3.5 w-3.5" />
                        {isConnecting ? "CONNECTING…" : "CONNECT WALLET"}
                    </button>
                ) : wrongChain ? (
                    <button
                        type="button"
                        onClick={() => switchChain({ chainId: RH_CHAIN_ID })}
                        disabled={isSwitching}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#ffb800]/40 bg-[#ffb800]/10 py-3.5 text-[11px] font-semibold tracking-[0.12em] text-[#ffb800] disabled:opacity-50"
                    >
                        <TriangleAlert className="h-3.5 w-3.5" />
                        {isSwitching ? "SWITCHING…" : "SWITCH TO ROBINHOOD CHAIN"}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={
                            !hasAmount ||
                            !canTrade ||
                            !quote ||
                            busy ||
                            Boolean(insufficientEth) ||
                            Boolean(insufficientTokens)
                        }
                        className={cn(
                            "flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[11px] font-semibold tracking-[0.12em] text-black transition-opacity hover:opacity-90 disabled:opacity-40",
                            side === "buy" ? "bg-[#00C805]" : "bg-[#ff5f5f]"
                        )}
                    >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        {actionLabel()}
                    </button>
                )}
            </div>

            {submitError ? (
                <p className="mt-2 break-words text-[10px] leading-relaxed text-[#ff8a8a]">{submitError}</p>
            ) : null}

            {txHash ? (
                <a
                    href={rhExplorerTxUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-white/12 py-2.5 text-[10px] tracking-[0.12em] text-white/55 transition-colors hover:border-[#00C805]/30 hover:text-[#00C805]"
                >
                    {receipt.isLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : receipt.isSuccess ? (
                        <Check className="h-3.5 w-3.5 text-[#00C805]" />
                    ) : (
                        <ExternalLink className="h-3.5 w-3.5" />
                    )}
                    {receipt.isLoading ? "PENDING…" : receipt.isSuccess ? "CONFIRMED — VIEW TX" : "VIEW TX"}
                </a>
            ) : null}

            {isPool ? (
                <a
                    href={rhExplorerPoolUrl(token.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center justify-center gap-1.5 text-[9px] tracking-[0.12em] text-white/30 transition-colors hover:text-[#00C805]"
                >
                    VIEW POOL ON EXPLORER
                    <ExternalLink className="h-3 w-3" />
                </a>
            ) : null}

            <p className="mt-3 text-[9px] leading-relaxed text-white/25">
                {isPool
                    ? "Trades route through the Robinhood UniversalRouter and Uniswap V4 pool. Buys wrap ETH to WETH; sells unwrap proceeds automatically when possible."
                    : "Trades execute directly against this token's bonding curve contract. Quotes are read on-chain and move with every trade — the slippage bound is what protects you."}
            </p>
        </div>
    );
}
