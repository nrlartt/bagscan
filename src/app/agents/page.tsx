import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
    Activity,
    ArrowUpRight,
    BadgeCheck,
    Bot,
    Clock3,
    Coins,
    ExternalLink,
    Layers,
    Sparkles,
} from "lucide-react";
import { syncHackathonApps, type EnrichedHackathonApp } from "@/lib/sync";
import { cn, formatCurrency, formatNumber, shortenAddress, getValuationMetric } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "AI Agents - BagScan",
    description: "Live AI Agents category from the Bags Hackathon App Store.",
};

const HACKATHON_URL = "https://bags.fm/hackathon/apps";
const AI_AGENTS_CATEGORY = "ai agents";

export default async function AgentsPage() {
    const apps = await syncHackathonApps();
    const aiAgentApps = apps
        .filter((app) => {
            const categories = app.categories && app.categories.length > 0 ? app.categories : [app.category];
            return categories.some((category) => normalizeLabel(category) === AI_AGENTS_CATEGORY);
        })
        .sort(compareAiAgentApps);

    const acceptedCount = aiAgentApps.filter((app) => normalizeStatus(app.status) === "accepted").length;
    const liveTokenCount = aiAgentApps.filter((app) => Boolean(app.tokenAddress)).length;
    const totalVolume24h = aiAgentApps.reduce((sum, app) => sum + (app.volume24hUsd ?? 0), 0);
    const totalTrackedValuation = aiAgentApps.reduce((sum, app) => sum + (getValuationMetric(app).value ?? 0), 0);

    return (
        <div className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
            <section className="crt-panel relative overflow-hidden p-6 sm:p-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,255,65,0.14),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(0,170,255,0.14),transparent_34%)]" />
                <div className="relative z-[1] grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)] xl:items-end">
                    <div className="space-y-5">
                        <div className="flex flex-wrap items-start gap-4">
                            <div className="flex h-14 w-14 items-center justify-center border border-[#00ff41]/25 bg-[#00ff41]/10 shadow-[0_0_24px_rgba(0,255,65,0.12)]">
                                <Bot className="h-7 w-7 text-[#00ff41]" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] uppercase tracking-[0.34em] text-[#00ff41]/55">Live Bags Hackathon Feed</p>
                                <h1
                                    className="mt-2 text-3xl tracking-[0.16em] text-[#d8ffe6] sm:text-5xl"
                                    style={{ textShadow: "0 0 16px rgba(0,255,65,0.18)" }}
                                >
                                    AI AGENTS
                                </h1>
                                <p className="mt-4 max-w-3xl text-sm leading-7 text-[#d8ffe6]/70 sm:text-[15px]">
                                    This page mirrors the current <span className="text-[#00ff41]/85">AI Agents</span> category
                                    from the Bags Hackathon App Store and enriches live tokenized entries with BagScan market data.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2.5">
                            <div className="inline-flex items-center gap-2 border border-[#00ff41]/20 bg-[#00ff41]/10 px-3 py-2 text-[11px] tracking-[0.18em] text-[#9dffb8]">
                                <span className="h-2 w-2 rounded-full bg-[#00ff41] shadow-[0_0_10px_rgba(0,255,65,0.75)]" />
                                LIVE CATEGORY SYNC
                            </div>
                            <div className="inline-flex items-center gap-2 border border-[#00aaff]/20 bg-[#00aaff]/10 px-3 py-2 text-[11px] tracking-[0.18em] text-[#8dd8ff]">
                                <Sparkles className="h-3.5 w-3.5" />
                                {aiAgentApps.length} AGENT APPS
                            </div>
                            <a
                                href={HACKATHON_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] tracking-[0.18em] text-white/65 transition-colors hover:text-white"
                            >
                                SOURCE: BAGS HACKATHON
                                <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                        <StatCard
                            label="Accepted"
                            value={formatNumber(acceptedCount, false)}
                            hint="Accepted projects inside AI Agents right now."
                            accent="text-[#ffd37a]"
                            icon={<BadgeCheck className="h-4 w-4" />}
                        />
                        <StatCard
                            label="Tokenized"
                            value={formatNumber(liveTokenCount, false)}
                            hint="Entries with a Bags token page already available."
                            accent="text-[#8dd8ff]"
                            icon={<Coins className="h-4 w-4" />}
                        />
                        <StatCard
                            label="24H Volume"
                            value={formatCurrency(totalVolume24h)}
                            hint="Sum of tracked 24h volume for listed agent tokens."
                            accent="text-[#9dffb8]"
                            icon={<Activity className="h-4 w-4" />}
                        />
                        <StatCard
                            label="Tracked Value"
                            value={formatCurrency(totalTrackedValuation)}
                            hint="Official market cap first, FDV fallback for tokenized AI agent apps."
                            accent="text-[#ffb36b]"
                            icon={<Layers className="h-4 w-4" />}
                        />
                    </div>
                </div>
            </section>

            <section className="crt-panel mt-6 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#00ff41]/12 pb-4">
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.28em] text-[#00ff41]/55">Curated by Category</p>
                        <h2 className="mt-1 text-lg tracking-[0.16em] text-[#d8ffe6] sm:text-xl">BAGS HACKATHON AI AGENTS</h2>
                    </div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[#00ff41]/45">
                        Accepted projects are pinned first, then live token activity.
                    </p>
                </div>

                {aiAgentApps.length === 0 ? (
                    <div className="py-16 text-center">
                        <p className="text-sm tracking-[0.18em] text-[#ffaa00]">No AI Agents apps found in the current hackathon feed.</p>
                        <a
                            href={HACKATHON_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex items-center gap-2 border border-[#00ff41]/20 bg-[#00ff41]/10 px-4 py-2 text-xs tracking-[0.18em] text-[#9dffb8]"
                        >
                            OPEN BAGS HACKATHON
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    </div>
                ) : (
                    <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                        {aiAgentApps.map((app, index) => (
                            <AgentAppCard key={app.uuid} app={app} rank={index + 1} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function AgentAppCard({ app, rank }: { app: EnrichedHackathonApp; rank: number }) {
    const status = normalizeStatus(app.status);
    const twitterHandle = getTwitterHandle(app.twitterUrl);
    const hasToken = Boolean(app.tokenAddress);
    const changePositive = (app.priceChange24h ?? 0) >= 0;
    const valuation = getValuationMetric(app);
    const categories = app.categories && app.categories.length > 0 ? app.categories : [app.category];
    const displayCategory = categories.some((category) => normalizeLabel(category) === AI_AGENTS_CATEGORY)
        ? "AI Agents"
        : app.category;

    return (
        <article className="group relative overflow-hidden border border-[#00ff41]/12 bg-[linear-gradient(180deg,rgba(0,0,0,0.92),rgba(0,22,10,0.94))] p-4 transition-all duration-300 hover:border-[#00ff41]/28 hover:shadow-[0_20px_60px_rgba(0,255,65,0.08)] sm:p-5">
            <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(0,255,65,0.5),transparent)] opacity-70" />

            <div className="flex items-start gap-3">
                <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden border border-[#00ff41]/15 bg-black/40">
                    {app.icon ? (
                        <Image src={app.icon} alt={app.name} fill className="object-cover" unoptimized />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#00ff41]/5 text-lg text-[#00ff41]/35">
                            {app.name.charAt(0)}
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="border border-[#00ff41]/16 bg-[#00ff41]/8 px-1.5 py-0.5 text-[10px] tracking-[0.2em] text-[#00ff41]/68">
                                    #{rank.toString().padStart(2, "0")}
                                </span>
                                <span
                                    className={cn(
                                        "border px-1.5 py-0.5 text-[10px] tracking-[0.2em]",
                                        status === "accepted"
                                            ? "border-[#ffaa00]/30 bg-[#ffaa00]/10 text-[#ffd37a]"
                                            : "border-[#00aaff]/25 bg-[#00aaff]/10 text-[#8dd8ff]"
                                    )}
                                >
                                    {status === "accepted" ? "ACCEPTED" : "IN REVIEW"}
                                </span>
                                {hasToken ? (
                                    <span className="border border-[#00ff41]/20 bg-[#00ff41]/10 px-1.5 py-0.5 text-[10px] tracking-[0.2em] text-[#9dffb8]">
                                        LIVE TOKEN
                                    </span>
                                ) : null}
                            </div>

                            <h3 className="mt-3 truncate text-lg tracking-[0.08em] text-[#d8ffe6]">{app.name}</h3>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] tracking-[0.18em] text-[#00ff41]/45">
                                <span>{displayCategory.toUpperCase()}</span>
                                {app.symbol ? <span className="text-[#8dd8ff]">${app.symbol}</span> : null}
                                {twitterHandle ? <span>@{twitterHandle}</span> : null}
                            </div>
                        </div>

                        {hasToken ? (
                            <div className="text-right">
                                <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff41]/35">Token</p>
                                <p className="mt-1 text-xs tracking-[0.16em] text-[#00ff41]/72">
                                    {shortenAddress(app.tokenAddress)}
                                </p>
                            </div>
                        ) : (
                            <div className="text-right">
                                <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff41]/35">Status</p>
                                <p className="mt-1 text-xs tracking-[0.16em] text-[#ffaa00]/75">Hackathon App Only</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <p className="mt-4 line-clamp-4 text-sm leading-6 text-[#d8ffe6]/66">{app.description}</p>

            <div className="mt-5 grid grid-cols-2 gap-2 xl:grid-cols-4">
                <MetricTile label={valuation.shortLabel} value={formatCurrency(valuation.value)} />
                <MetricTile label="24H VOL" value={formatCurrency(app.volume24hUsd)} />
                <MetricTile label="LIQUIDITY" value={formatCurrency(app.liquidityUsd)} />
                <MetricTile
                    label="24H"
                    value={
                        app.priceChange24h !== undefined
                            ? `${changePositive ? "+" : ""}${app.priceChange24h.toFixed(1)}%`
                            : "-"
                    }
                    tone={app.priceChange24h === undefined ? "neutral" : changePositive ? "positive" : "negative"}
                />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
                {hasToken ? (
                    <Link
                        href={`/token/${app.tokenAddress}`}
                        className="inline-flex items-center gap-2 border border-[#00ff41]/22 bg-[#00ff41]/10 px-3 py-2 text-[11px] tracking-[0.18em] text-[#9dffb8] transition-all hover:bg-[#00ff41]/16"
                    >
                        OPEN TOKEN
                        <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                ) : (
                    <span className="inline-flex items-center gap-2 border border-[#ffaa00]/20 bg-[#ffaa00]/8 px-3 py-2 text-[11px] tracking-[0.18em] text-[#ffd37a]">
                        <Clock3 className="h-3.5 w-3.5" />
                        WAITING FOR TOKEN PAGE
                    </span>
                )}

                {app.twitterUrl ? (
                    <a
                        href={app.twitterUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 border border-[#00aaff]/20 bg-[#00aaff]/8 px-3 py-2 text-[11px] tracking-[0.18em] text-[#8dd8ff] transition-all hover:bg-[#00aaff]/14"
                    >
                        OPEN X
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                ) : null}
            </div>
        </article>
    );
}

function StatCard({
    label,
    value,
    hint,
    accent,
    icon,
}: {
    label: string;
    value: string;
    hint: string;
    accent: string;
    icon: ReactNode;
}) {
    return (
        <div className="border border-white/10 bg-black/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.24em] text-white/48">{label}</span>
                <span className={cn("flex h-8 w-8 items-center justify-center border border-white/10 bg-white/[0.03]", accent)}>
                    {icon}
                </span>
            </div>
            <p className={cn("mt-4 text-2xl tracking-[0.08em] sm:text-3xl", accent)}>{value}</p>
            <p className="mt-2 text-xs leading-5 text-white/44">{hint}</p>
        </div>
    );
}

function MetricTile({
    label,
    value,
    tone = "neutral",
}: {
    label: string;
    value: string;
    tone?: "neutral" | "positive" | "negative";
}) {
    return (
        <div className="border border-[#00ff41]/10 bg-black/40 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#00ff41]/32">{label}</p>
            <p
                className={cn(
                    "mt-1 text-sm tracking-[0.08em]",
                    tone === "positive" && "text-[#9dffb8]",
                    tone === "negative" && "text-[#ff8f70]",
                    tone === "neutral" && "text-[#d8ffe6]/82"
                )}
            >
                {value}
            </p>
        </div>
    );
}

function normalizeLabel(value?: string | null) {
    return (value ?? "").trim().toLowerCase();
}

function normalizeStatus(status?: string | null) {
    const normalized = normalizeLabel(status);
    if (normalized === "accepted") return "accepted";
    return "in review";
}

function getTwitterHandle(url?: string) {
    if (!url) return null;
    return url
        .replace(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//i, "")
        .replace(/^@/, "")
        .split(/[/?#]/)[0]
        .trim() || null;
}

function compareAiAgentApps(a: EnrichedHackathonApp, b: EnrichedHackathonApp) {
    const acceptedDiff = Number(normalizeStatus(b.status) === "accepted") - Number(normalizeStatus(a.status) === "accepted");
    if (acceptedDiff !== 0) return acceptedDiff;

    const liveTokenDiff = Number(Boolean(b.tokenAddress)) - Number(Boolean(a.tokenAddress));
    if (liveTokenDiff !== 0) return liveTokenDiff;

    const volumeDiff = (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0);
    if (volumeDiff !== 0) return volumeDiff;

    const marketCapDiff = (b.marketCap ?? 0) - (a.marketCap ?? 0);
    if (marketCapDiff !== 0) return marketCapDiff;

    return a.name.localeCompare(b.name);
}
