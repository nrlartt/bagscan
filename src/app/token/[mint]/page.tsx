"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { CopyButton } from "@/components/bagscan/CopyButton";
import { ProviderBadge, CreatorBadge } from "@/components/bagscan/Badges";
import { BuyWidget } from "@/components/bagscan/BuyWidget";
import { ClaimEventsList } from "@/components/bagscan/ClaimEventsList";
import { SnapshotChart } from "@/components/bagscan/SnapshotChart";
import { JupiterTokenPanel } from "@/components/bagscan/JupiterTokenPanel";
import { ErrorState } from "@/components/bagscan/States";
import { DetailSkeleton } from "@/components/bagscan/Skeletons";
import {
    cn,
    formatCurrency,
    formatNumber,
    shortenAddress,
    bpsToPercent,
    getValuationMetric,
} from "@/lib/utils";
import { getExplorerTokenUrl } from "@/lib/solana";
import type {
    NormalizedToken,
    BagsClaimEvent,
    BagsCreatorV3,
    BagsClaimStatEntry,
    BagsIncorporationProject,
} from "@/lib/bags/types";
import type { JupiterTokenDetail } from "@/lib/jupiter/types";
import {
    Zap,
    ExternalLink,
    Layers,
    UserCheck,
    Twitter,
    ArrowLeft,
    Calendar,
    Building2,
    Share2,
    Globe,
    Send,
} from "lucide-react";

interface TokenDetailResponse {
    success: boolean;
    data: {
        token: NormalizedToken;
        claimEvents: BagsClaimEvent[];
        incorporation?: BagsIncorporationProject | null;
        jupiter?: JupiterTokenDetail | null;
        snapshots: {
            capturedAt: string;
            fdvUsd?: number | null;
            priceUsd?: number | null;
            liquidityUsd?: number | null;
            lifetimeFees?: number | null;
            volume24hUsd?: number | null;
        }[];
    };
}

export default function TokenDetailPage() {
    const params = useParams();
    const mint = params.mint as string;

    const { data, isLoading, error, refetch } = useQuery<TokenDetailResponse>({
        queryKey: ["token", mint],
        queryFn: async () => {
            const res = await fetch(`/api/tokens/${mint}`);
            if (!res.ok) throw new Error("Failed to fetch token");
            return res.json();
        },
        enabled: !!mint,
        refetchInterval: 30_000,
    });

    const [detailTab, setDetailTab] = useState<"holders" | "activity">("activity");
    const detailTabMintRef = useRef<string | null>(null);

    useEffect(() => {
        if (!mint) return;
        if (!data?.success || !data.data?.token) return;
        if (data.data.token.tokenMint !== mint) return;
        if (detailTabMintRef.current === mint) return;
        detailTabMintRef.current = mint;
        const hasHolders = data.data.token.claimStats && data.data.token.claimStats.length > 0;
        setDetailTab(hasHolders ? "holders" : "activity");
    }, [mint, data]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0d0d0d] text-white">
                <div className="mx-auto max-w-[92rem] px-4 py-8 sm:px-6 lg:px-8">
                    <DetailSkeleton />
                </div>
            </div>
        );
    }

    if (error || !data?.success || !data?.data?.token) {
        return (
            <div className="min-h-screen bg-[#0d0d0d] text-white">
                <div className="mx-auto max-w-[92rem] px-4 py-8 sm:px-6 lg:px-8">
                    <ErrorState
                        title="TOKEN NOT FOUND"
                        error={error ? String(error) : "This token could not be loaded."}
                        onRetry={() => refetch()}
                    />
                </div>
            </div>
        );
    }

    const { token, claimEvents, snapshots, incorporation, jupiter } = data.data;
    const priceChangePositive = (token.priceChange24h ?? 0) >= 0;
    const valuation = getValuationMetric(token);
    const officialXHandle = getOfficialProjectXHandle(token);
    const officialXUrl = officialXHandle ? `https://x.com/${officialXHandle}` : undefined;
    const officialCreatorXHandle = getPrimaryCreatorXHandle(token);
    const officialWebsiteUrl = normalizeExternalHref(token.website);
    const officialTelegramUrl = normalizeTelegramHref(token.telegram);
    const officialWebsiteHost = getWebsiteHost(token.website);
    const officialProjectFollowers = token.projectTwitterFollowers ?? token.creatorFollowers;

    const fourthStat =
        token.volume24hUsd !== undefined
            ? { label: "24h volume", value: formatCurrency(token.volume24hUsd) }
            : token.liquidityUsd !== undefined
                ? { label: "Liquidity", value: formatCurrency(token.liquidityUsd) }
                : token.holderCount !== undefined && token.holderCount > 0
                    ? { label: "Holders", value: formatNumber(token.holderCount) }
                    : {
                        label: "Lifetime fees",
                        value: formatCurrency(token.lifetimeFees ?? 0),
                    };

    const valuationShortLabel =
        valuation.source === "market-cap" ? "Market cap" : valuation.source === "fdv" ? "FDV" : "Valuation";

    const primaryCreator =
        token.creators?.find((c) => c.isCreator) ?? token.creators?.[0] ?? null;
    return (
        <div className="min-h-screen bg-[#0d0d0d] text-white">
            <div className="mx-auto max-w-[92rem] px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-6 flex animate-fade-in items-center gap-2 text-[11px] text-white/40">
                    <Link href="/" className="flex items-center gap-1 transition-colors hover:text-[#53ffb2]">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Discover
                    </Link>
                    <span className="text-white/15">/</span>
                    <span className="text-white/70">{token.symbol ?? shortenAddress(mint)}</span>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.72fr)_minmax(300px,1fr)]">
                    <div className="order-2 space-y-5 xl:order-1">
                        <div className="animate-fade-in-scale rounded-2xl border border-white/[0.08] bg-[#14181c] p-5 sm:p-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                                    {token.image ? (
                                        <Image src={token.image} alt={token.name ?? "Token"} fill className="object-cover" unoptimized />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-2xl text-white/25">
                                            {token.symbol?.charAt(0) ?? "?"}
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                                                {token.name ?? "Unknown token"}
                                            </h1>
                                            <p className="mt-0.5 text-sm font-medium uppercase tracking-widest text-white/45">
                                                {token.symbol ?? shortenAddress(mint)}
                                            </p>
                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <ProviderBadge provider={token.provider} username={token.providerUsername} />
                                                <CreatorBadge isCreator={token.isCreator} isAdmin={token.isAdmin} />
                                                {token.isMigrated && (
                                                    <span className="rounded-md border border-[#53ffb2]/25 bg-[#53ffb2]/10 px-2 py-0.5 text-[10px] font-medium text-[#53ffb2]">
                                                        DAMM v2
                                                    </span>
                                                )}
                                                {token.isMigrated === false && token.dbcPoolKey && (
                                                    <span className="rounded-md border border-sky-400/25 bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                                                        DBC
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <PumpShareButton title={token.name ?? token.symbol} />
                                            <a
                                                href={`https://bags.fm/${token.tokenMint}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.05] px-3 py-2 text-[11px] font-medium text-white/80 transition-colors hover:border-[#53ffb2]/35 hover:text-[#53ffb2]"
                                            >
                                                View on Bags
                                                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                                            </a>
                                            <div className="flex gap-1.5">
                                                {officialXUrl ? (
                                                    <SocialIconLink href={officialXUrl} label="X">
                                                        <Twitter className="h-4 w-4" />
                                                    </SocialIconLink>
                                                ) : null}
                                                {officialTelegramUrl ? (
                                                    <SocialIconLink href={officialTelegramUrl} label="Telegram">
                                                        <Send className="h-4 w-4" />
                                                    </SocialIconLink>
                                                ) : null}
                                                {officialWebsiteUrl ? (
                                                    <SocialIconLink href={officialWebsiteUrl} label="Website">
                                                        <Globe className="h-4 w-4" />
                                                    </SocialIconLink>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 border-t border-white/[0.06] pt-5">
                                        <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">
                                            {valuationShortLabel}
                                        </p>
                                        <p className="mt-1 text-3xl font-semibold tracking-tight text-white">
                                            {formatCurrency(valuation.value)}
                                        </p>
                                        <div className="mt-2 flex flex-wrap items-baseline gap-2 text-sm">
                                            {token.priceUsd !== undefined ? (
                                                <span className="text-white/55">
                                                    Price {formatCurrency(token.priceUsd, { compact: false, decimals: 8 })}
                                                </span>
                                            ) : null}
                                            {token.priceChange24h !== undefined ? (
                                                <span
                                                    className={cn(
                                                        "font-semibold",
                                                        priceChangePositive ? "text-[#53ffb2]" : "text-red-400"
                                                    )}
                                                >
                                                    {priceChangePositive ? "+" : ""}
                                                    {token.priceChange24h.toFixed(2)}% 24h
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>

                                    {token.pairCreatedAt && (
                                        <div className="mt-4 flex items-center gap-2 text-[11px] text-white/35">
                                            <Calendar className="h-3.5 w-3.5" />
                                            Launched {formatLaunchDate(token.pairCreatedAt)}
                                        </div>
                                    )}

                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                        <CopyButton value={token.tokenMint} label={shortenAddress(token.tokenMint)} />
                                        <LinkChip href={getExplorerTokenUrl(token.tokenMint)} label="Solscan" pump />
                                        <LinkChip
                                            href={`https://dexscreener.com/solana/${token.tokenMint}`}
                                            label="Dexscreener"
                                            pump
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="animate-fade-in rounded-2xl border border-white/[0.08] bg-[#14181c] p-4">
                            <div className="mb-3">
                                <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">Price history</p>
                                <p className="mt-0.5 text-lg font-semibold text-white">
                                    {token.priceUsd !== undefined
                                        ? formatCurrency(token.priceUsd, { compact: false, decimals: 8 })
                                        : "—"}
                                </p>
                            </div>
                            <SnapshotChart data={snapshots} variant="pump" height={276} />
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <PumpMiniStat label={valuationShortLabel} value={formatCurrency(valuation.value)} />
                            <PumpMiniStat
                                label="Price"
                                value={
                                    token.priceUsd !== undefined
                                        ? formatCurrency(token.priceUsd, { compact: false, decimals: 8 })
                                        : "—"
                                }
                            />
                            <PumpMiniStat
                                label="24h change"
                                value={
                                    token.priceChange24h !== undefined
                                        ? (token.priceChange24h >= 0 ? "+" : "") +
                                          token.priceChange24h.toFixed(2) +
                                          "%"
                                        : "—"
                                }
                                valueClassName={
                                    token.priceChange24h === undefined
                                        ? undefined
                                        : priceChangePositive
                                            ? "text-[#53ffb2]"
                                            : "text-red-400"
                                }
                            />
                            <PumpMiniStat label={fourthStat.label} value={fourthStat.value} />
                        </div>

                        {token.description ? (
                            <div className="rounded-2xl border border-white/[0.08] bg-[#14181c] p-5">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Description</p>
                                <p className="mt-3 text-sm leading-relaxed text-white/70">{token.description}</p>
                            </div>
                        ) : null}

                        <div className="rounded-2xl border border-white/[0.08] bg-[#14181c] p-5">
                            <div className="flex flex-wrap gap-1 rounded-xl bg-black/40 p-1">
                                <button
                                    type="button"
                                    disabled={!token.claimStats?.length}
                                    onClick={() => setDetailTab("holders")}
                                    className={cn(
                                        "min-h-[40px] flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                                        detailTab === "holders"
                                            ? "bg-[#53ffb2] text-black"
                                            : "text-white/45 hover:text-white/70"
                                    )}
                                >
                                    Fee share holders
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDetailTab("activity")}
                                    className={cn(
                                        "min-h-[40px] flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold transition-colors",
                                        detailTab === "activity"
                                            ? "bg-[#53ffb2] text-black"
                                            : "text-white/45 hover:text-white/70"
                                    )}
                                >
                                    Activity
                                </button>
                            </div>
                            <div className="mt-4">
                                {detailTab === "holders" && token.claimStats && token.claimStats.length > 0 ? (
                                    <FeeShareTable variant="pump" stats={token.claimStats} />
                                ) : null}
                                {detailTab === "holders" && (!token.claimStats || token.claimStats.length === 0) ? (
                                    <p className="py-8 text-center text-sm text-white/35">No fee share breakdown for this token.</p>
                                ) : null}
                                {detailTab === "activity" ? (
                                    <div className="max-h-[28rem] overflow-y-auto pr-1">
                                        <ClaimEventsList events={claimEvents} compact limit={48} />
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="order-1 space-y-5 xl:sticky xl:top-20 xl:order-2 xl:self-start">
                        <div className="animate-slide-in-right" style={{ animationDelay: "100ms" }}>
                            <BuyWidget
                                tokenMint={token.tokenMint}
                                tokenSymbol={token.symbol}
                                variant="pump"
                            />
                        </div>

                        <div
                            className="animate-slide-in-right rounded-2xl border border-white/[0.08] bg-[#14181c] p-4"
                            style={{ animationDelay: "110ms" }}
                        >
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                                Bonding curve
                            </p>
                            <p className="mt-2 text-xl font-semibold text-white">
                                {token.isMigrated === true
                                    ? "100.0%"
                                    : token.dbcPoolKey
                                        ? "In progress"
                                        : "—"}
                            </p>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                                {token.isMigrated === true ? (
                                    <div className="h-full w-full rounded-full bg-[#53ffb2]" />
                                ) : token.dbcPoolKey ? (
                                    <div className="relative h-full w-[72%] overflow-hidden rounded-full bg-[#53ffb2]/85">
                                        <div className="bonding-curve-shimmer" />
                                    </div>
                                ) : (
                                    <div className="h-full w-1/4 rounded-full bg-white/20" />
                                )}
                            </div>
                            <p className="mt-2 text-[11px] text-white/35">
                                {token.isMigrated === true
                                    ? "Migrated to AMM (Meteora DAMM v2)."
                                    : token.dbcPoolKey
                                        ? "Dynamic bonding curve active on Meteora DBC."
                                        : "Pool phase unavailable from Bags payload."}
                            </p>
                        </div>

                        {primaryCreator ? (
                            <div
                                className="animate-slide-in-right flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#14181c] p-4"
                                style={{ animationDelay: "115ms" }}
                            >
                                {primaryCreator.pfp ? (
                                    <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border border-white/10">
                                        <Image
                                            src={primaryCreator.pfp}
                                            alt=""
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    </div>
                                ) : (
                                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/40 text-sm text-white/40">
                                        {(primaryCreator.twitterUsername ?? primaryCreator.providerUsername)?.charAt(0) ?? "?"}
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-white">
                                        {primaryCreator.providerUsername ??
                                            primaryCreator.twitterUsername ??
                                            primaryCreator.bagsUsername ??
                                            "Creator"}
                                    </p>
                                    <p className="truncate text-[11px] text-white/40">
                                        {shortenAddress(primaryCreator.wallet)}
                                    </p>
                                </div>
                                {(() => {
                                    const h =
                                        primaryCreator.twitterUsername ??
                                        (primaryCreator.provider === "twitter"
                                            ? primaryCreator.providerUsername
                                            : null);
                                    return h ? (
                                        <a
                                            href={`https://x.com/${h}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="rounded-lg border border-white/12 bg-white/[0.05] px-3 py-2 text-[11px] font-medium text-white/80 transition-colors hover:border-[#53ffb2]/40 hover:text-[#53ffb2]"
                                        >
                                            Follow
                                        </a>
                                    ) : null;
                                })()}
                            </div>
                        ) : null}

                        {jupiter ? (
                            <div className="animate-slide-in-right" style={{ animationDelay: "120ms" }}>
                                <JupiterTokenPanel data={jupiter} />
                            </div>
                        ) : null}

                        <div
                            className="animate-slide-in-right rounded-2xl border border-white/[0.08] bg-[#14181c] p-4"
                            style={{ animationDelay: "125ms" }}
                        >
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                                Links
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {officialXUrl ? <LinkChip href={officialXUrl} label="X" pump /> : null}
                                {officialWebsiteUrl ? <LinkChip href={officialWebsiteUrl} label="Website" pump /> : null}
                                {officialTelegramUrl ? <LinkChip href={officialTelegramUrl} label="Telegram" pump /> : null}
                                <LinkChip href={`https://bags.fm/${token.tokenMint}`} label="Bags" pump accent />
                            </div>
                            <p className="mt-3 text-[11px] text-white/35">
                                {officialXHandle
                                    ? "Project @" +
                                      officialXHandle +
                                      (officialProjectFollowers !== undefined
                                          ? " · " + formatNumber(officialProjectFollowers) + " followers"
                                          : "")
                                    : "Official X not exposed for this token."}
                            </p>
                        </div>

                        <div
                            className="animate-slide-in-right overflow-hidden rounded-2xl border border-white/[0.08] bg-[#14181c]"
                            style={{ animationDelay: "130ms" }}
                        >
                            <div className="border-b border-white/[0.06] px-4 py-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                    <Zap className="h-4 w-4 text-[#53ffb2]" />
                                    Recent claims
                                </div>
                                <p className="mt-1 text-[11px] text-white/35">Latest on-chain fee claims visible to BagScan.</p>
                            </div>
                            <div className="max-h-80 overflow-y-auto px-2 py-2 xl:max-h-[22rem]">
                                <ClaimEventsList events={claimEvents} compact limit={24} />
                            </div>
                        </div>

                        {incorporation ? (
                            <div
                                className="animate-slide-in-right rounded-2xl border border-white/[0.08] bg-[#14181c] p-5"
                                style={{ animationDelay: "140ms" }}
                            >
                                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                    <Building2 className="h-4 w-4 text-sky-300/90" />
                                    Incorporation
                                </div>
                                <div className="mt-4 space-y-3">
                                    <InfoRow pump label="Status" value={incorporation.incorporationStatus} />
                                    <InfoRow pump label="Category" value={incorporation.category ?? "Uncategorized"} />
                                    <InfoRow
                                        pump
                                        label="Ready"
                                        value={incorporation.isReadyForIncorporation ? "Yes" : "In progress"}
                                    />
                                    <InfoRow
                                        pump
                                        label="Bags share"
                                        value={`${(incorporation.incorporationShareBasisPoint / 100).toFixed(2)}%`}
                                    />
                                    {incorporation.twitterHandle ? (
                                        <InfoRow pump label="Handle" value={`@${incorporation.twitterHandle}`} />
                                    ) : null}
                                    {incorporation.preferredCompanyNames.length > 0 ? (
                                        <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3">
                                            <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">
                                                Preferred names
                                            </p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {incorporation.preferredCompanyNames.map((name) => (
                                                    <span
                                                        key={name}
                                                        className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/70"
                                                    >
                                                        {name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                    <InfoRow pump label="Founders" value={String(incorporation.founders?.length ?? 0)} />
                                </div>
                            </div>
                        ) : null}

                        {(token.dbcPoolKey || token.dammV2PoolKey) && (
                            <div
                                className="animate-slide-in-right rounded-2xl border border-white/[0.08] bg-[#14181c] p-5"
                                style={{ animationDelay: "150ms" }}
                            >
                                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                    <Layers className="h-4 w-4 text-sky-300/90" />
                                    Pool
                                </div>
                                <div className="mt-4 space-y-3">
                                    <InfoRow
                                        pump
                                        label="Type"
                                        value={token.isMigrated ? "Meteora DAMM v2" : "Meteora DBC"}
                                    />
                                    {token.pairCreatedAt && (
                                        <InfoRow pump label="Launch" value={formatLaunchDate(token.pairCreatedAt)} />
                                    )}
                                    {token.dexId && <InfoRow pump label="DEX" value={token.dexId} />}
                                    {token.dbcPoolKey && (
                                        <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center sm:justify-between">
                                            <span className="text-[10px] uppercase tracking-wider text-white/40">DBC pool</span>
                                            <CopyButton value={token.dbcPoolKey} label={shortenAddress(token.dbcPoolKey)} />
                                        </div>
                                    )}
                                    {token.dammV2PoolKey && (
                                        <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center sm:justify-between">
                                            <span className="text-[10px] uppercase tracking-wider text-white/40">DAMM v2</span>
                                            <CopyButton value={token.dammV2PoolKey} label={shortenAddress(token.dammV2PoolKey)} />
                                        </div>
                                    )}
                                    {token.totalSupply !== undefined && (
                                        <InfoRow
                                            pump
                                            label="Total supply"
                                            value={formatNumber(
                                                token.decimals
                                                    ? token.totalSupply / Math.pow(10, token.decimals)
                                                    : token.totalSupply
                                            )}
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        <div
                            className="animate-slide-in-right rounded-2xl border border-white/[0.08] bg-[#14181c] p-5"
                            style={{ animationDelay: "160ms" }}
                        >
                            <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                <UserCheck className="h-4 w-4 text-[#53ffb2]" />
                                Creators & fee claimers
                            </div>
                            <div className="mt-4">
                                {token.creators && token.creators.length > 0 ? (
                                    <div className="space-y-3">
                                        {token.creators.map((c, i) => (
                                            <CreatorCard key={c.wallet ?? i} creator={c} pump />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {token.creatorPfp && (
                                            <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-white/10">
                                                <Image src={token.creatorPfp} alt="Creator" fill className="object-cover" unoptimized />
                                            </div>
                                        )}
                                        <InfoRow pump label="Display" value={token.creatorDisplay} />
                                        {officialCreatorXHandle && (
                                            <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center sm:justify-between">
                                                <span className="text-[10px] uppercase tracking-wider text-white/40">
                                                    Twitter
                                                </span>
                                                <a
                                                    href={`https://x.com/${officialCreatorXHandle}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1.5 text-[11px] text-sky-300 hover:text-sky-200"
                                                >
                                                    <Twitter className="h-3 w-3" />@{officialCreatorXHandle}
                                                </a>
                                            </div>
                                        )}
                                        {token.creatorWallet && (
                                            <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center sm:justify-between">
                                                <span className="text-[10px] uppercase tracking-wider text-white/40">
                                                    Wallet
                                                </span>
                                                <CopyButton value={token.creatorWallet} label={shortenAddress(token.creatorWallet)} />
                                            </div>
                                        )}
                                        <InfoRow
                                            pump
                                            label="Royalty"
                                            value={
                                                token.royaltyBps !== undefined ? bpsToPercent(token.royaltyBps) : undefined
                                            }
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PumpShareButton({ title }: { title?: string | null }) {
    const [label, setLabel] = useState("Share");

    async function onShare() {
        const url = typeof window !== "undefined" ? window.location.href : "";
        try {
            if (navigator.share) {
                await navigator.share({ title: title ?? "BagScan", url });
            } else {
                await navigator.clipboard.writeText(url);
            }
            setLabel("Copied");
        } catch {
            try {
                await navigator.clipboard.writeText(url);
                setLabel("Copied");
            } catch {
                setLabel("Share");
            }
        }
        window.setTimeout(() => setLabel("Share"), 2000);
    }

    return (
        <button
            type="button"
            onClick={() => void onShare()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.05] px-3 py-2 text-[11px] font-medium text-white/80 transition-colors hover:border-white/20 hover:bg-white/[0.08]"
        >
            <Share2 className="h-3.5 w-3.5" />
            {label}
        </button>
    );
}

function SocialIconLink({
    href,
    label,
    children,
}: {
    href: string;
    label: string;
    children: ReactNode;
}) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={label}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:border-[#53ffb2]/35 hover:text-[#53ffb2]"
        >
            {children}
        </a>
    );
}

function PumpMiniStat({
    label,
    value,
    valueClassName,
}: {
    label: string;
    value: string;
    valueClassName?: string;
}) {
    return (
        <div className="rounded-xl border border-white/[0.08] bg-[#14181c] px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">{label}</p>
            <p className={cn("mt-1 text-base font-semibold tracking-tight text-white", valueClassName)}>{value}</p>
        </div>
    );
}

function LinkChip({
    href,
    label,
    accent,
    pump,
}: {
    href: string;
    label: string;
    accent?: boolean;
    pump?: boolean;
}) {
    if (pump) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                    "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                    accent
                        ? "border-[#53ffb2]/40 bg-[#53ffb2]/15 text-[#53ffb2] hover:bg-[#53ffb2]/25"
                        : "border-white/12 bg-white/[0.05] text-white/75 hover:border-white/20 hover:text-white"
                )}
            >
                {label}
                <ExternalLink className="h-3 w-3 opacity-70" />
            </a>
        );
    }
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] tracking-wider transition-all border ${accent
                ? "bg-[#00ff41]/10 hover:bg-[#00ff41]/20 text-[#00ff41]/60 hover:text-[#00ff41] border-[#00ff41]/20"
                : "bg-[#00ff41]/5 hover:bg-[#00ff41]/10 text-[#00ff41]/40 hover:text-[#00ff41]/70 border-[#00ff41]/10"
                }`}
        >
            {label}
            <ExternalLink className="h-3 w-3" />
        </a>
    );
}

function CreatorCard({ creator, pump }: { creator: BagsCreatorV3; pump?: boolean }) {
    const displayName = creator.providerUsername ?? creator.twitterUsername ?? creator.bagsUsername ?? creator.username;
    const twitterHandle = creator.twitterUsername ?? (creator.provider === "twitter" ? creator.providerUsername : null);

    return (
        <div
            className={cn(
                "rounded-xl p-3 transition-all group",
                pump
                    ? "border border-white/10 bg-black/30 hover:border-white/18"
                    : "border border-[#00ff41]/10 bg-black/40 hover:border-[#00ff41]/25"
            )}
        >
            <div className="flex items-center gap-3">
                {creator.pfp && (
                    <div
                        className={cn(
                            "relative h-9 w-9 flex-shrink-0 overflow-hidden",
                            pump ? "rounded-lg border border-white/10" : "border border-[#00ff41]/20"
                        )}
                    >
                        <Image src={creator.pfp} alt={displayName ?? "Creator"} fill className="object-cover" unoptimized />
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        {twitterHandle ? (
                            <a
                                href={`https://twitter.com/${twitterHandle}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                    "flex items-center gap-1 text-[11px] tracking-wider transition-colors",
                                    pump
                                        ? "text-sky-300/90 hover:text-sky-200"
                                        : "text-[#00aaff]/60 hover:text-[#00aaff]"
                                )}
                            >
                                <Twitter className="h-3 w-3" />@{twitterHandle}
                            </a>
                        ) : (
                            <span
                                className={cn(
                                    "truncate text-[11px] tracking-wider",
                                    pump ? "text-white/75" : "text-[#00ff41]/60"
                                )}
                            >
                                {displayName ?? shortenAddress(creator.wallet)}
                            </span>
                        )}
                        {creator.isCreator && (
                            <span
                                className={cn(
                                    "px-1.5 py-0.5 text-[8px] tracking-wider",
                                    pump
                                        ? "border border-[#53ffb2]/25 bg-[#53ffb2]/10 text-[#53ffb2]/90"
                                        : "border border-[#00ff41]/15 bg-[#00ff41]/10 text-[#00ff41]/50"
                                )}
                            >
                                CREATOR
                            </span>
                        )}
                        {creator.isAdmin && (
                            <span
                                className={cn(
                                    "px-1.5 py-0.5 text-[8px] tracking-wider",
                                    pump
                                        ? "border border-amber-500/25 bg-amber-500/10 text-amber-200/90"
                                        : "border border-[#ffaa00]/15 bg-[#ffaa00]/10 text-[#ffaa00]/50"
                                )}
                            >
                                ADMIN
                            </span>
                        )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                        {creator.provider && creator.provider !== "unknown" && creator.provider !== "twitter" && (
                            <span
                                className={cn(
                                    "text-[9px] capitalize tracking-wider",
                                    pump ? "text-white/35" : "text-[#00ff41]/25"
                                )}
                            >
                                {creator.provider}
                            </span>
                        )}
                        <span
                            className={cn(
                                "text-[9px] tracking-wider",
                                pump ? "text-white/30" : "text-[#00ff41]/15"
                            )}
                        >
                            {shortenAddress(creator.wallet)}
                        </span>
                        {creator.royaltyBps > 0 && (
                            <span
                                className={cn(
                                    "text-[9px] tracking-wider",
                                    pump ? "text-white/40" : "text-[#00ff41]/25"
                                )}
                            >
                                {bpsToPercent(creator.royaltyBps)} share
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function FeeShareTable({
    stats,
    variant = "terminal",
}: {
    stats: BagsClaimStatEntry[];
    variant?: "terminal" | "pump";
}) {
    const LAMPORTS = 1_000_000_000;
    const isPump = variant === "pump";
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
                <thead>
                    <tr
                        className={cn(
                            "border-b",
                            isPump ? "border-white/[0.08] text-white/45" : "border-[#00ff41]/10 text-[#00ff41]/30"
                        )}
                    >
                        <th className="py-2 text-left font-normal tracking-wide">Claimer</th>
                        <th className="py-2 text-right font-normal tracking-wide">Share</th>
                        <th className="py-2 text-right font-normal tracking-wide">Claimed (SOL)</th>
                    </tr>
                </thead>
                <tbody>
                    {stats.map((s, i) => {
                        let claimedSol = 0;
                        try {
                            claimedSol = Number(BigInt(s.totalClaimed)) / LAMPORTS;
                        } catch {
                            /* skip */
                        }
                        const displayName = s.providerUsername ?? s.twitterUsername ?? s.bagsUsername ?? s.username;
                        const twitterHandle = s.twitterUsername ?? (s.provider === "twitter" ? s.providerUsername : null);
                        return (
                            <tr
                                key={s.wallet ?? i}
                                className={cn(
                                    "border-b transition-colors",
                                    isPump
                                        ? "border-white/[0.05] hover:bg-white/[0.03]"
                                        : "border-[#00ff41]/5 hover:bg-[#00ff41]/[0.02]"
                                )}
                            >
                                <td className="py-2.5">
                                    <div className="flex items-center gap-2">
                                        {s.pfp && (
                                            <div
                                                className={cn(
                                                    "relative h-5 w-5 flex-shrink-0 overflow-hidden",
                                                    isPump ? "rounded-md border border-white/10" : "border border-[#00ff41]/10"
                                                )}
                                            >
                                                <Image src={s.pfp} alt="" fill className="object-cover" unoptimized />
                                            </div>
                                        )}
                                        {twitterHandle ? (
                                            <a
                                                href={`https://twitter.com/${twitterHandle}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={cn(
                                                    "flex max-w-[140px] items-center gap-1 truncate transition-colors",
                                                    isPump
                                                        ? "text-sky-300/90 hover:text-sky-200"
                                                        : "tracking-wider text-[#00aaff]/50 hover:text-[#00aaff]"
                                                )}
                                            >
                                                <Twitter className="h-3 w-3 flex-shrink-0" />@{twitterHandle}
                                            </a>
                                        ) : (
                                            <span
                                                className={cn(
                                                    "max-w-[140px] truncate tracking-wider",
                                                    isPump ? "text-white/65" : "text-[#00ff41]/50"
                                                )}
                                            >
                                                {displayName ?? shortenAddress(s.wallet)}
                                            </span>
                                        )}
                                        {s.isCreator && (
                                            <span
                                                className={cn(
                                                    "text-[8px] tracking-wider",
                                                    isPump ? "text-[#53ffb2]/80" : "text-[#00ff41]/30"
                                                )}
                                            >
                                                CREATOR
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td
                                    className={cn(
                                        "py-2.5 text-right tracking-wider",
                                        isPump ? "text-[#53ffb2]/90" : "text-[#00ff41]/40"
                                    )}
                                >
                                    {bpsToPercent(s.royaltyBps)}
                                </td>
                                <td
                                    className={cn(
                                        "py-2.5 text-right tracking-wider",
                                        isPump ? "text-white/70" : "text-[#00ff41]/60"
                                    )}
                                >
                                    {claimedSol > 0 ? claimedSol.toFixed(4) : "—"}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function InfoRow({
    label,
    value,
    pump,
}: {
    label: string;
    value?: string | null;
    pump?: boolean;
}) {
    if (!value) return null;
    return (
        <div className="flex flex-col gap-1 py-1 sm:flex-row sm:items-center sm:justify-between">
            <span
                className={cn(
                    "text-[10px] uppercase tracking-wider",
                    pump ? "text-white/40" : "text-[#00ff41]/25 tracking-[0.15em]"
                )}
            >
                {label}
            </span>
            <span
                className={cn(
                    "break-words text-[11px] sm:text-right",
                    pump ? "text-white/75" : "text-[#00ff41]/60 tracking-wider"
                )}
            >
                {value}
            </span>
        </div>
    );
}

function normalizeSocialHandle(value?: string | null) {
    if (!value) return undefined;
    return value
        .replace(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//i, "")
        .replace(/^@+/, "")
        .split(/[/?#]/)[0]
        .trim() || undefined;
}

function normalizeExternalHref(value?: string | null) {
    if (!value) return undefined;
    return /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/+/, "")}`;
}

function normalizeTelegramHref(value?: string | null) {
    if (!value) return undefined;
    if (/^https?:\/\//i.test(value)) return value;
    return `https://t.me/${value.replace(/^@+/, "").replace(/^t\.me\//i, "")}`;
}

function getWebsiteHost(value?: string | null) {
    const href = normalizeExternalHref(value);
    if (!href) return undefined;
    try {
        return new URL(href).hostname.replace(/^www\./i, "");
    } catch {
        return undefined;
    }
}

function getOfficialProjectXHandle(token: NormalizedToken) {
    return (
        token.projectTwitterHandle ??
        normalizeSocialHandle(token.twitter) ??
        token.twitterUsername ??
        (token.provider === "twitter" ? token.providerUsername ?? undefined : undefined) ??
        token.creators?.find((creator) => creator.isCreator)?.twitterUsername ??
        token.creators?.find((creator) => creator.provider === "twitter")?.providerUsername ??
        undefined
    );
}

function getPrimaryCreatorXHandle(token: NormalizedToken) {
    const primaryCreator = token.creators?.find((creator) => creator.isCreator) ?? token.creators?.[0];
    return (
        primaryCreator?.twitterUsername ??
        (primaryCreator?.provider === "twitter" ? primaryCreator.providerUsername ?? undefined : undefined) ??
        token.twitterUsername ??
        (token.provider === "twitter" ? token.providerUsername ?? undefined : undefined) ??
        undefined
    );
}

function formatLaunchDate(dateStr: string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const pad = (n: number) => n.toString().padStart(2, "0");
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())} UTC`;
}
