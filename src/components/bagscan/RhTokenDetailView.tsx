"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Check, ExternalLink, Share2 } from "lucide-react";
import { CopyButton } from "./CopyButton";
import { ErrorState } from "./States";
import { DetailSkeleton } from "./Skeletons";
import { RemoteFillImage } from "./RemoteFillImage";
import {
    copyToClipboard,
    formatCurrency,
    formatCompactDecimal,
    formatTokenPrice,
    shortenAddress,
} from "@/lib/utils";
import { rhExplorerTokenUrl } from "@/lib/rh/chain";
import { RhLogo } from "./RhLogo";
import { RhBondingBar, RhStatPill, rhFormatPct, rhTimeAgoShort } from "./RhUi";
import type { RhTokenState } from "@/lib/rh/api-types";
import type { RhTokenView } from "@/lib/rh/token";
import { parseRhFixed18, parseWeiToEth } from "@/lib/rh/mappers";
import { RhTradeWidget } from "./RhTradeWidget";

interface RhTokenDetailResponse {
    success: boolean;
    data: {
        token: RhTokenView;
        state: RhTokenState;
        ethUsd?: number;
    };
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
            <p className="text-[10px] tracking-[0.16em] text-white/35">{title}</p>
            <div className="mt-3">{children}</div>
        </div>
    );
}

export function RhTokenDetailView({ address }: { address: string }) {
    const [linkCopied, setLinkCopied] = useState(false);
    const { data, isLoading, error, refetch } = useQuery<RhTokenDetailResponse>({
        queryKey: ["rh-token", address],
        queryFn: async () => {
            const res = await fetch(`/api/rh/token?address=${encodeURIComponent(address)}`);
            if (!res.ok) throw new Error("Failed to fetch token");
            return res.json();
        },
        enabled: !!address,
        refetchInterval: 20_000,
    });

    if (isLoading) return <DetailSkeleton />;
    if (error || !data?.success) {
        return (
            <div className="mx-auto max-w-4xl px-4 py-8">
                <ErrorState error="Robinhood token not found" onRetry={() => refetch()} />
            </div>
        );
    }

    const token = data.data.token;
    const state = data.data.state;
    const priceEth = parseRhFixed18(state.priceEthPerToken);
    const fdv = token.fdvUsd;
    const raisedEth = parseWeiToEth(state.totalRaisedWei);
    const thresholdEth = parseWeiToEth(state.thresholdQuoteWei);
    const explorerUrl = rhExplorerTokenUrl(address);
    const age = rhTimeAgoShort(token.createdAt);
    const raisedPct =
        raisedEth != null && thresholdEth != null && thresholdEth > 0
            ? Math.min(100, (raisedEth / thresholdEth) * 100)
            : null;

    return (
        <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
            <Link
                href="/"
                className="mb-4 inline-flex items-center gap-1.5 text-[10px] tracking-[0.14em] text-[#00C805]/55 transition-colors hover:text-[#00C805]"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                BACK TO DISCOVER
            </Link>

            {/* Banner */}
            <div className="relative mb-5 overflow-hidden rounded-2xl border border-[#00C805]/15 bg-[#070907]">
                <div className="relative h-36 sm:h-44">
                    <RemoteFillImage
                        src={token.image}
                        alt=""
                        sizes="100vw"
                        className="object-cover opacity-35 blur-[1px]"
                        fallback={<div className="absolute inset-0 bg-gradient-to-br from-[#00C805]/15 to-black" />}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#070907] via-[#070907]/70 to-[#070907]/20" />
                </div>
                <div className="relative -mt-14 flex flex-wrap items-end gap-4 px-4 pb-4 sm:px-6 sm:pb-5">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-[#00C805]/30 bg-black shadow-[0_12px_40px_rgba(0,200,5,0.15)] sm:h-28 sm:w-28">
                        <RemoteFillImage
                            src={token.image}
                            alt={token.name ?? ""}
                            sizes="112px"
                            className="object-cover"
                            fallback={
                                <span className="absolute inset-0 flex items-center justify-center text-3xl font-semibold text-[#00C805]/30">
                                    {token.symbol?.charAt(0) ?? "?"}
                                </span>
                            }
                        />
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-xl font-semibold text-white sm:text-2xl">
                                {token.symbol ? `$${token.symbol}` : shortenAddress(address)}
                            </h1>
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#00C805]/30 bg-[#00C805]/10 px-2 py-0.5 text-[9px] tracking-wider text-[#00C805]">
                                <RhLogo size={14} />
                                ROBINHOOD
                            </span>
                            {token.isMigrated ? (
                                <span className="rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[9px] tracking-wider text-white/55">
                                    GRADUATED
                                </span>
                            ) : null}
                            {age ? (
                                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-white/40">
                                    {age} ago
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-0.5 text-sm text-white/45">{token.name}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <code className="rounded-lg bg-black/50 px-2 py-0.5 font-mono text-[10px] text-white/55">
                                {shortenAddress(address)}
                            </code>
                            <CopyButton value={address} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="min-w-0 space-y-5">
                    <div className="rounded-2xl border border-[#00C805]/15 bg-gradient-to-br from-[#0a120a] to-[#070907] p-4 sm:p-6">
                        <p className="text-[10px] tracking-[0.16em] text-[#00C805]/55">FULLY DILUTED VALUE</p>
                        <p className="mt-1 text-3xl font-semibold tabular-nums text-white sm:text-4xl">
                            {fdv != null && fdv > 0
                                ? formatCurrency(fdv)
                                : priceEth != null
                                  ? `${formatCompactDecimal(priceEth)} ETH`
                                  : "—"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-sm tabular-nums text-white/45">
                            {token.priceUsd != null ? (
                                <span>{formatTokenPrice(token.priceUsd)} / token</span>
                            ) : null}
                            {priceEth != null ? (
                                <span>{formatCompactDecimal(priceEth, { significant: 4 })} ETH / token</span>
                            ) : null}
                        </div>
                        <p className="mt-2 text-[10px] text-white/30">
                            Spot price times the fixed 1B supply, converted at the live ETH/USD rate.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <RhStatPill label="BONDING" value={rhFormatPct(state.bondingProgressPct)} accent />
                        <RhStatPill
                            label="RAISED"
                            value={raisedEth != null ? `${formatCompactDecimal(raisedEth, { significant: 3 })} ETH` : "—"}
                        />
                        <RhStatPill
                            label="THRESHOLD"
                            value={
                                thresholdEth != null
                                    ? `${formatCompactDecimal(thresholdEth, { significant: 3 })} ETH`
                                    : "—"
                            }
                        />
                        <RhStatPill label="STATUS" value={state.migrated ? "Pool live" : "Bonding"} />
                    </div>

                    {!state.migrated ? (
                        <DetailSection title="BONDING CURVE PROGRESS">
                            <RhBondingBar progress={state.bondingProgressPct} showLabel={false} />
                            <div className="mt-3 flex justify-between text-[10px] text-white/40">
                                <span>0%</span>
                                <span className="font-semibold tabular-nums text-[#00C805]">
                                    {rhFormatPct(state.bondingProgressPct)}
                                </span>
                                <span>100%</span>
                            </div>
                            {raisedPct != null ? (
                                <p className="mt-2 text-[10px] text-white/38">
                                    {raisedPct.toFixed(1)}% of graduation threshold raised on-chain
                                </p>
                            ) : null}
                        </DetailSection>
                    ) : null}

                    {token.description ? (
                        <DetailSection title="DESCRIPTION">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/65">
                                {token.description}
                            </p>
                        </DetailSection>
                    ) : null}

                    <DetailSection title="CONTRACTS">
                        <dl className="grid gap-3 sm:grid-cols-2">
                            {[
                                { label: "Token", value: address },
                                { label: "Curve", value: state.curve },
                                { label: "Fee share", value: state.feeShare },
                                { label: "Pool ID", value: state.poolId },
                            ].map(({ label, value }) => (
                                <div key={label} className="rounded-xl border border-white/[0.06] bg-black/30 p-3">
                                    <dt className="text-[9px] tracking-[0.12em] text-white/30">{label}</dt>
                                    <dd className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-white/55">
                                        <span className="truncate">{shortenAddress(value)}</span>
                                        <CopyButton value={value} />
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </DetailSection>
                </div>

                <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
                    <RhTradeWidget token={token} ethUsd={data.data.ethUsd} />

                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                        <p className="text-[10px] tracking-[0.16em] text-white/35">CREATOR</p>
                        <div className="mt-2 flex items-center gap-2">
                            <code className="font-mono text-[11px] text-white/60">
                                {shortenAddress(token.creator ?? "—")}
                            </code>
                            {token.creator ? <CopyButton value={token.creator} /> : null}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 rounded-xl border border-white/12 py-2.5 text-[10px] tracking-wider text-white/50 transition-colors hover:border-[#00C805]/30 hover:text-[#00C805]"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            VIEW ON EXPLORER
                        </a>
                        <button
                            type="button"
                            onClick={async () => {
                                const ok = await copyToClipboard(window.location.href);
                                if (!ok) return;
                                setLinkCopied(true);
                                window.setTimeout(() => setLinkCopied(false), 1600);
                            }}
                            className="flex items-center justify-center gap-2 rounded-xl border border-white/12 py-2.5 text-[10px] tracking-wider text-white/50 transition-colors hover:border-white/25 hover:text-white/75"
                        >
                            {linkCopied ? <Check className="h-3.5 w-3.5 text-[#00C805]" /> : <Share2 className="h-3.5 w-3.5" />}
                            {linkCopied ? "LINK COPIED" : "COPY LINK"}
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    );
}
