"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { MetricCard } from "@/components/bagscan/MetricCard";
import { CopyButton } from "@/components/bagscan/CopyButton";
import { ProviderBadge, CreatorBadge } from "@/components/bagscan/Badges";
import { BuyWidget } from "@/components/bagscan/BuyWidget";
import { ClaimEventsList } from "@/components/bagscan/ClaimEventsList";
import { SnapshotChart } from "@/components/bagscan/SnapshotChart";
import { BubbleMapEmbed } from "@/components/bagscan/BubbleMapEmbed";
import { JupiterTokenPanel } from "@/components/bagscan/JupiterTokenPanel";
import { ErrorState } from "@/components/bagscan/States";
import { DetailSkeleton } from "@/components/bagscan/Skeletons";
import {
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
    TrendingUp, Coins, Zap, Users, ExternalLink,
    DollarSign, BarChart3, Activity, ArrowUpDown, Percent,
    Layers, UserCheck, Twitter, ArrowLeft, Calendar, Building2,
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

    if (isLoading) {
        return (
            <div className="mx-auto max-w-[92rem] px-4 py-8 sm:px-6 lg:px-8">
                <DetailSkeleton />
            </div>
        );
    }

    if (error || !data?.success || !data?.data?.token) {
        return (
            <div className="mx-auto max-w-[92rem] px-4 py-8 sm:px-6 lg:px-8">
                <ErrorState
                    title="TOKEN NOT FOUND"
                    error={error ? String(error) : "This token could not be loaded."}
                    onRetry={() => refetch()}
                />
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
    const secondaryMetrics: Array<{
        key: string;
        label: string;
        value: string;
        subValue?: string;
        icon: React.ReactNode;
    }> = [];

    if (token.liquidityUsd !== undefined) {
        secondaryMetrics.push({
            key: "liquidity",
            label: "Liquidity",
            value: formatCurrency(token.liquidityUsd),
            icon: <BarChart3 className="w-5 h-5" />,
        });
    }

    if (token.volume24hUsd !== undefined) {
        secondaryMetrics.push({
            key: "volume",
            label: "24h Volume",
            value: formatCurrency(token.volume24hUsd),
            icon: <Activity className="w-5 h-5" />,
        });
    }

    if (token.txCount24h !== undefined) {
        secondaryMetrics.push({
            key: "tx",
            label: "24h Transactions",
            value: formatNumber(token.txCount24h),
            subValue: token.buyCount24h !== undefined ? `${token.buyCount24h}B / ${token.sellCount24h ?? 0}S` : undefined,
            icon: <ArrowUpDown className="w-5 h-5" />,
        });
    }

    if (token.holderCount !== undefined && token.holderCount > 0) {
        secondaryMetrics.push({
            key: "holders",
            label: "Holders",
            value: formatNumber(token.holderCount),
            icon: <Users className="w-5 h-5" />,
        });
    }

    return (
        <div className="mx-auto max-w-[92rem] px-4 py-8 sm:px-6 lg:px-8">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-[10px] text-[#00ff41]/30 mb-6 animate-fade-in tracking-wider">
                <Link href="/" className="flex items-center gap-1 hover:text-[#00ff41]/60 transition-colors">
                    <ArrowLeft className="w-3 h-3" />
                    DISCOVER
                </Link>
                <span className="text-[#00ff41]/15">│</span>
                <span className="text-[#00ff41]/50">{token.symbol ?? shortenAddress(mint)}</span>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.85fr)_minmax(320px,0.95fr)]">
                {/* Left column */}
                <div className="space-y-6">
                    {/* Hero */}
                    <div className="crt-panel p-6 animate-fade-in-scale">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                            <div className="relative w-16 h-16 overflow-hidden flex-shrink-0 border-2 border-[#00ff41]/30" style={{ boxShadow: '0 0 12px rgba(0,255,65,0.1)' }}>
                                {token.image ? (
                                    <Image src={token.image} alt={token.name ?? "Token"} fill className="object-cover" unoptimized />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[#00ff41]/30 text-2xl bg-[#00ff41]/5">
                                        {token.symbol?.charAt(0) ?? "?"}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <h1 className="text-lg text-[#00ff41] tracking-[0.1em]" style={{ textShadow: '0 0 10px rgba(0,255,65,0.3)' }}>
                                        {token.name ?? "UNKNOWN TOKEN"}
                                    </h1>
                                    {token.symbol && (
                                        <span className="text-xs text-[#00ff41]/40 tracking-wider border border-[#00ff41]/15 px-2 py-0.5">
                                            ${token.symbol}
                                        </span>
                                    )}
                                    <ProviderBadge provider={token.provider} username={token.providerUsername} />
                                    <CreatorBadge isCreator={token.isCreator} isAdmin={token.isAdmin} />
                                    {token.isMigrated && (
                                        <span className="px-2 py-0.5 text-[9px] tracking-wider bg-[#00ff41]/10 text-[#00ff41]/60 border border-[#00ff41]/20">
                                            DAMM v2
                                        </span>
                                    )}
                                    {token.isMigrated === false && token.dbcPoolKey && (
                                        <span className="px-2 py-0.5 text-[9px] tracking-wider bg-[#00aaff]/10 text-[#00aaff]/60 border border-[#00aaff]/20">
                                            DBC
                                        </span>
                                    )}
                                </div>

                                {token.priceUsd !== undefined && (
                                    <div className="mt-2 flex flex-wrap items-baseline gap-3">
                                        <span className="text-xl text-[#00ff41] tracking-wider" style={{ textShadow: '0 0 12px rgba(0,255,65,0.3)' }}>
                                            {formatCurrency(token.priceUsd, { compact: false, decimals: 6 })}
                                        </span>
                                        {token.priceChange24h !== undefined && (
                                            <span className={`text-xs tracking-wider px-2 py-0.5 border ${priceChangePositive ? "text-[#00ff41] border-[#00ff41]/30 bg-[#00ff41]/5" : "text-[#ff4400] border-[#ff4400]/30 bg-[#ff4400]/5"}`}>
                                                {priceChangePositive ? "+" : ""}{token.priceChange24h.toFixed(2)}%
                                            </span>
                                        )}
                                    </div>
                                )}

                                {token.pairCreatedAt && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <Calendar className="w-3 h-3 text-[#ffaa00]/50" />
                                        <span className="text-[10px] text-[#ffaa00]/60 tracking-wider">
                                            LAUNCHED: {formatLaunchDate(token.pairCreatedAt)}
                                        </span>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mt-3 flex-wrap">
                                    <CopyButton value={token.tokenMint} label={shortenAddress(token.tokenMint)} />
                                    <LinkChip href={getExplorerTokenUrl(token.tokenMint)} label="SOLSCAN" />
                                    <LinkChip href={`https://dexscreener.com/solana/${token.tokenMint}`} label="DEXSCREENER" />
                                    <LinkChip href={`https://bags.fm/${token.tokenMint}`} label="BAGS.FM" accent />
                                    {officialXUrl && officialXHandle && (
                                        <a
                                            href={officialXUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] tracking-wider bg-[#00aaff]/10 hover:bg-[#00aaff]/20 text-[#00aaff]/60 hover:text-[#00aaff] transition-all border border-[#00aaff]/20"
                                        >
                                            <Twitter className="w-3 h-3" />
                                            @{officialXHandle}
                                            {officialProjectFollowers ? (
                                                <span className="text-[#8dd8ff]/55">
                                                    · {formatNumber(officialProjectFollowers)}
                                                </span>
                                            ) : null}
                                        </a>
                                    )}
                                </div>
                                {token.description && (
                                    <p className="text-[11px] text-[#00ff41]/30 mt-3 leading-relaxed line-clamp-2 tracking-wider">
                                        {token.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="crt-panel p-5 animate-fade-in">
                        <div className="panel-header flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-[#00ff41]/55" />
                            ╔══ MARKET SNAPSHOT ══╗
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <MetricCard
                                label="Price"
                                value={formatCurrency(token.priceUsd, { compact: false, decimals: 6 })}
                                icon={<DollarSign className="w-5 h-5" />}
                                subValue={token.priceChange24h !== undefined ? `${token.priceChange24h >= 0 ? "+" : ""}${token.priceChange24h.toFixed(1)}% 24h move` : undefined}
                                className="min-h-[134px] border-[#00ff41]/20 bg-[linear-gradient(180deg,rgba(0,255,65,0.08),rgba(0,255,65,0.02))] shadow-[0_0_24px_rgba(0,255,65,0.05)] sm:min-h-[144px] xl:col-span-2"
                            />
                            <MetricCard
                                label={valuation.longLabel}
                                value={formatCurrency(valuation.value)}
                                tooltip={valuation.source === "market-cap" ? "BagScan displays the official market cap when Bags provides it." : valuation.source === "fdv" ? "FDV fallback shown because official Bags market cap is unavailable." : undefined}
                                icon={<TrendingUp className="w-5 h-5" />}
                                subValue={valuation.source === "market-cap" ? "Official Bags market cap" : valuation.source === "fdv" ? "FDV fallback surface" : undefined}
                                className="min-h-[134px] border-[#00ff41]/18 bg-[linear-gradient(180deg,rgba(0,255,65,0.055),rgba(0,0,0,0.4))] sm:min-h-[144px] xl:col-span-2"
                            />
                            <MetricCard
                                label="Lifetime Fees"
                                value={formatCurrency(token.lifetimeFees)}
                                subValue={token.lifetimeFeesSol !== undefined ? `${token.lifetimeFeesSol.toFixed(2)} SOL total` : undefined}
                                icon={<Coins className="w-5 h-5" />}
                                className="min-h-[120px]"
                            />
                            <MetricCard
                                label="Fee Claimers"
                                value={formatNumber(token.claimStats?.length ?? token.claimCount)}
                                subValue={token.claimVolume ? `${formatCurrency(token.claimVolume)} claimed` : undefined}
                                icon={<Zap className="w-5 h-5" />}
                                className="min-h-[120px]"
                            />
                            {secondaryMetrics.map((item) => (
                                <MetricCard
                                    key={item.key}
                                    label={item.label}
                                    value={item.value}
                                    subValue={item.subValue}
                                    icon={item.icon}
                                    className="min-h-[120px]"
                                />
                            ))}
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="crt-panel p-5 animate-fade-in">
                        <div className="panel-header flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-[#00ff41]/50" />
                            ╔══ PRICE HISTORY ══╗
                        </div>
                        <SnapshotChart data={snapshots} />
                    </div>

                    <BubbleMapEmbed mint={token.tokenMint} symbol={token.symbol} />

                    {/* Fee Share Breakdown */}
                    {token.claimStats && token.claimStats.length > 0 && (
                        <div className="crt-panel p-5 animate-fade-in">
                            <div className="panel-header flex items-center gap-2">
                                <Percent className="w-4 h-4 text-[#00ff41]/50" />
                                ╔══ FEE SHARE BREAKDOWN ══╗
                            </div>
                            <FeeShareTable stats={token.claimStats} />
                        </div>
                    )}

                </div>

                {/* Right column */}
                <div className="space-y-6">
                    <div className="animate-slide-in-right" style={{ animationDelay: "100ms" }}>
                        <BuyWidget tokenMint={token.tokenMint} tokenSymbol={token.symbol} />
                    </div>

                    {jupiter ? (
                        <div className="animate-slide-in-right" style={{ animationDelay: "115ms" }}>
                            <JupiterTokenPanel data={jupiter} />
                        </div>
                    ) : null}

                    <div className="crt-panel animate-slide-in-right overflow-hidden border border-[#00aaff]/14 bg-[linear-gradient(180deg,rgba(0,170,255,0.07),rgba(0,0,0,0.42))] p-0 shadow-[0_0_26px_rgba(0,170,255,0.06)]" style={{ animationDelay: "130ms" }}>
                        <div className="border-b border-[#00aaff]/10 px-4 py-4">
                            <div className="panel-header flex items-center gap-2 text-[#8dd8ff]/76">
                                <Twitter className="w-4 h-4 text-[#8dd8ff]/65" />
                                ╔══ OFFICIAL SOCIAL LINKS ══╗
                            </div>
                            <p className="mt-2 text-[10px] tracking-[0.12em] text-[#8dd8ff]/38">
                                Project identity, X visibility, and public links resolved from the live Bags token data.
                            </p>
                        </div>
                        <div className="space-y-4 px-4 py-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="border border-[#8dd8ff]/12 bg-[#8dd8ff]/[0.04] px-3 py-3">
                                    <p className="text-[10px] tracking-[0.18em] text-[#8dd8ff]/48">OFFICIAL X</p>
                                    <p className="mt-2 text-sm tracking-[0.12em] text-[#d8ffe6]/84">
                                        {officialXHandle ? `@${officialXHandle}` : "Not exposed"}
                                    </p>
                                    <p className="mt-1 text-[10px] tracking-[0.12em] text-[#d8ffe6]/38">
                                        {officialProjectFollowers !== undefined
                                            ? `${formatNumber(officialProjectFollowers)} followers`
                                            : "Follower count not exposed"}
                                    </p>
                                </div>
                                <div className="border border-[#00ff41]/12 bg-[#00ff41]/[0.035] px-3 py-3">
                                    <p className="text-[10px] tracking-[0.18em] text-[#00ff41]/42">CREATOR X</p>
                                    <p className="mt-2 text-sm tracking-[0.12em] text-[#d8ffe6]/84">
                                        {officialCreatorXHandle ? `@${officialCreatorXHandle}` : "Not exposed"}
                                    </p>
                                    <p className="mt-1 text-[10px] tracking-[0.12em] text-[#d8ffe6]/38">
                                        {token.creatorDisplay ?? "Primary creator profile"}
                                    </p>
                                </div>
                                <div className="border border-white/8 bg-white/[0.025] px-3 py-3">
                                    <p className="text-[10px] tracking-[0.18em] text-[#00ff41]/34">WEBSITE</p>
                                    <p className="mt-2 text-sm tracking-[0.12em] text-[#d8ffe6]/78">
                                        {officialWebsiteHost ?? "Not exposed"}
                                    </p>
                                </div>
                                <div className="border border-white/8 bg-white/[0.025] px-3 py-3">
                                    <p className="text-[10px] tracking-[0.18em] text-[#00ff41]/34">TELEGRAM</p>
                                    <p className="mt-2 text-sm tracking-[0.12em] text-[#d8ffe6]/78">
                                        {officialTelegramUrl ? "Public group / channel" : "Not exposed"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {officialXUrl ? <LinkChip href={officialXUrl} label="OPEN X" /> : null}
                                {officialWebsiteUrl ? <LinkChip href={officialWebsiteUrl} label="OPEN SITE" /> : null}
                                {officialTelegramUrl ? <LinkChip href={officialTelegramUrl} label="OPEN TG" /> : null}
                                <LinkChip href={`https://bags.fm/${token.tokenMint}`} label="OPEN BAGS" accent />
                            </div>
                        </div>
                    </div>

                    <div className="crt-panel animate-slide-in-right overflow-hidden p-0" style={{ animationDelay: "160ms" }}>
                        <div className="flex items-center justify-between gap-3 border-b border-[#00ff41]/10 px-4 py-4">
                            <div className="min-w-0">
                                <div className="panel-header flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-[#ffaa00]/55" />
                                    ╔══ RECENT CLAIM EVENTS ══╗
                                </div>
                                <p className="mt-2 text-[10px] tracking-[0.12em] text-[#00ff41]/32">
                                    Latest visible fee claims, kept compact for quick scanning.
                                </p>
                            </div>
                        </div>
                        <div className="px-2 py-2">
                            <div className="max-h-[24rem] overflow-y-auto pr-1 xl:max-h-[38rem]">
                                <ClaimEventsList events={claimEvents} compact limit={24} />
                            </div>
                        </div>
                    </div>

                    {incorporation && (
                        <div className="crt-panel p-5 animate-slide-in-right" style={{ animationDelay: "150ms" }}>
                            <div className="panel-header flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-[#8dd8ff]/60" />
                                INCORPORATION
                            </div>
                            <div className="space-y-3">
                                <InfoRow label="STATUS" value={incorporation.incorporationStatus} />
                                <InfoRow label="CATEGORY" value={incorporation.category ?? "Uncategorized"} />
                                <InfoRow
                                    label="READY"
                                    value={incorporation.isReadyForIncorporation ? "YES" : "IN PROGRESS"}
                                />
                                <InfoRow
                                    label="BAGS SHARE"
                                    value={`${(incorporation.incorporationShareBasisPoint / 100).toFixed(2)}%`}
                                />
                                {incorporation.twitterHandle ? (
                                    <InfoRow label="HANDLE" value={`@${incorporation.twitterHandle}`} />
                                ) : null}
                                {incorporation.preferredCompanyNames.length > 0 ? (
                                    <div className="border border-[#8dd8ff]/12 bg-[#8dd8ff]/[0.03] p-3">
                                        <p className="text-[10px] text-[#8dd8ff]/45 tracking-[0.18em]">
                                            PREFERRED COMPANY NAMES
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {incorporation.preferredCompanyNames.map((name) => (
                                                <span
                                                    key={name}
                                                    className="border border-[#8dd8ff]/15 px-2 py-1 text-[10px] tracking-[0.16em] text-[#d8ffe6]/72"
                                                >
                                                    {name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                                <InfoRow
                                    label="FOUNDERS"
                                    value={String(incorporation.founders?.length ?? 0)}
                                />
                            </div>
                        </div>
                    )}

                    {(token.dbcPoolKey || token.dammV2PoolKey) && (
                        <div className="crt-panel p-5 animate-slide-in-right" style={{ animationDelay: "200ms" }}>
                            <div className="panel-header flex items-center gap-2">
                                <Layers className="w-4 h-4 text-[#00aaff]/50" />
                                ╔══ POOL INFO ══╗
                            </div>
                            <div className="space-y-3">
                                <InfoRow label="POOL TYPE" value={token.isMigrated ? "Meteora DAMM v2" : "Meteora DBC"} />
                                {token.pairCreatedAt && <InfoRow label="LAUNCH DATE" value={formatLaunchDate(token.pairCreatedAt)} />}
                                {token.dexId && <InfoRow label="DEX" value={token.dexId} />}
                                {token.dbcPoolKey && (
                                        <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center sm:justify-between">
                                            <span className="text-[10px] text-[#00ff41]/25 tracking-[0.15em]">DBC POOL</span>
                                            <CopyButton value={token.dbcPoolKey} label={shortenAddress(token.dbcPoolKey)} />
                                        </div>
                                    )}
                                {token.dammV2PoolKey && (
                                    <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center sm:justify-between">
                                        <span className="text-[10px] text-[#00ff41]/25 tracking-[0.15em]">DAMM V2 POOL</span>
                                        <CopyButton value={token.dammV2PoolKey} label={shortenAddress(token.dammV2PoolKey)} />
                                    </div>
                                )}
                                {token.totalSupply !== undefined && (
                                    <InfoRow label="TOTAL SUPPLY" value={formatNumber(token.decimals ? token.totalSupply / Math.pow(10, token.decimals) : token.totalSupply)} />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Creators */}
                    <div className="crt-panel p-5 animate-slide-in-right" style={{ animationDelay: "300ms" }}>
                        <div className="panel-header flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-[#00ff41]/50" />
                            ╔══ CREATORS & FEE CLAIMERS ══╗
                        </div>
                        {token.creators && token.creators.length > 0 ? (
                            <div className="space-y-3">
                                {token.creators.map((c, i) => (
                                    <CreatorCard key={c.wallet ?? i} creator={c} />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {token.creatorPfp && (
                                    <div className="relative w-10 h-10 overflow-hidden border border-[#00ff41]/20">
                                        <Image src={token.creatorPfp} alt="Creator" fill className="object-cover" unoptimized />
                                    </div>
                                )}
                                <InfoRow label="DISPLAY" value={token.creatorDisplay} />
                                {officialCreatorXHandle && (
                                    <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center sm:justify-between">
                                        <span className="text-[10px] text-[#00ff41]/25 tracking-[0.15em]">TWITTER</span>
                                        <a
                                            href={`https://x.com/${officialCreatorXHandle}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 text-[11px] text-[#00aaff]/60 hover:text-[#00aaff] transition-colors tracking-wider"
                                        >
                                            <Twitter className="w-3 h-3" />
                                            @{officialCreatorXHandle}
                                        </a>
                                    </div>
                                )}
                                {token.creatorWallet && (
                                    <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center sm:justify-between">
                                        <span className="text-[10px] text-[#00ff41]/25 tracking-[0.15em]">WALLET</span>
                                        <CopyButton value={token.creatorWallet} label={shortenAddress(token.creatorWallet)} />
                                    </div>
                                )}
                                <InfoRow label="ROYALTY" value={token.royaltyBps !== undefined ? bpsToPercent(token.royaltyBps) : undefined} />
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}

function LinkChip({ href, label, accent }: { href: string; label: string; accent?: boolean }) {
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
            <ExternalLink className="w-3 h-3" />
        </a>
    );
}

function CreatorCard({ creator }: { creator: BagsCreatorV3 }) {
    const displayName = creator.providerUsername ?? creator.twitterUsername ?? creator.bagsUsername ?? creator.username;
    const twitterHandle = creator.twitterUsername ?? (creator.provider === "twitter" ? creator.providerUsername : null);

    return (
        <div className="p-3 border border-[#00ff41]/10 bg-black/40 hover:border-[#00ff41]/25 transition-all group">
            <div className="flex items-center gap-3">
                {creator.pfp && (
                    <div className="relative w-9 h-9 overflow-hidden border border-[#00ff41]/20 flex-shrink-0">
                        <Image src={creator.pfp} alt={displayName ?? "Creator"} fill className="object-cover" unoptimized />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        {twitterHandle ? (
                            <a
                                href={`https://twitter.com/${twitterHandle}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[11px] text-[#00aaff]/60 hover:text-[#00aaff] tracking-wider transition-colors"
                            >
                                <Twitter className="w-3 h-3" />
                                @{twitterHandle}
                            </a>
                        ) : (
                            <span className="text-[11px] text-[#00ff41]/60 tracking-wider truncate">
                                {displayName ?? shortenAddress(creator.wallet)}
                            </span>
                        )}
                        {creator.isCreator && (
                            <span className="px-1.5 py-0.5 text-[8px] bg-[#00ff41]/10 text-[#00ff41]/50 border border-[#00ff41]/15 tracking-wider">CREATOR</span>
                        )}
                        {creator.isAdmin && (
                            <span className="px-1.5 py-0.5 text-[8px] bg-[#ffaa00]/10 text-[#ffaa00]/50 border border-[#ffaa00]/15 tracking-wider">ADMIN</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        {creator.provider && creator.provider !== "unknown" && creator.provider !== "twitter" && (
                            <span className="text-[9px] text-[#00ff41]/25 capitalize tracking-wider">{creator.provider}</span>
                        )}
                        <span className="text-[9px] text-[#00ff41]/15 tracking-wider">{shortenAddress(creator.wallet)}</span>
                        {creator.royaltyBps > 0 && (
                            <span className="text-[9px] text-[#00ff41]/25 tracking-wider">{bpsToPercent(creator.royaltyBps)} share</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function FeeShareTable({ stats }: { stats: BagsClaimStatEntry[] }) {
    const LAMPORTS = 1_000_000_000;
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
                <thead>
                    <tr className="text-[#00ff41]/30 border-b border-[#00ff41]/10">
                        <th className="text-left py-2 font-normal tracking-[0.15em]">CLAIMER</th>
                        <th className="text-right py-2 font-normal tracking-[0.15em]">SHARE</th>
                        <th className="text-right py-2 font-normal tracking-[0.15em]">CLAIMED (SOL)</th>
                    </tr>
                </thead>
                <tbody>
                    {stats.map((s, i) => {
                        let claimedSol = 0;
                        try { claimedSol = Number(BigInt(s.totalClaimed)) / LAMPORTS; } catch { /* skip */ }
                        const displayName = s.providerUsername ?? s.twitterUsername ?? s.bagsUsername ?? s.username;
                        const twitterHandle = s.twitterUsername ?? (s.provider === "twitter" ? s.providerUsername : null);
                        return (
                            <tr key={s.wallet ?? i} className="border-b border-[#00ff41]/5 hover:bg-[#00ff41]/[0.02] transition-colors">
                                <td className="py-2.5">
                                    <div className="flex items-center gap-2">
                                        {s.pfp && (
                                            <div className="relative w-5 h-5 overflow-hidden flex-shrink-0 border border-[#00ff41]/10">
                                                <Image src={s.pfp} alt="" fill className="object-cover" unoptimized />
                                            </div>
                                        )}
                                        {twitterHandle ? (
                                            <a href={`https://twitter.com/${twitterHandle}`} target="_blank" rel="noopener noreferrer"
                                               className="flex items-center gap-1 text-[#00aaff]/50 hover:text-[#00aaff] truncate max-w-[120px] transition-colors tracking-wider">
                                                <Twitter className="w-3 h-3 flex-shrink-0" />
                                                @{twitterHandle}
                                            </a>
                                        ) : (
                                            <span className="text-[#00ff41]/50 truncate max-w-[120px] tracking-wider">
                                                {displayName ?? shortenAddress(s.wallet)}
                                            </span>
                                        )}
                                        {s.isCreator && <span className="text-[8px] text-[#00ff41]/30 tracking-wider">CREATOR</span>}
                                    </div>
                                </td>
                                <td className="py-2.5 text-right text-[#00ff41]/40 tracking-wider">{bpsToPercent(s.royaltyBps)}</td>
                                <td className="py-2.5 text-right text-[#00ff41]/60 tracking-wider">{claimedSol > 0 ? claimedSol.toFixed(4) : "—"}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
    if (!value) return null;
    return (
        <div className="flex flex-col gap-1 py-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[10px] text-[#00ff41]/25 tracking-[0.15em]">{label}</span>
            <span className="break-words text-[11px] text-[#00ff41]/60 tracking-wider sm:text-right">{value}</span>
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
