"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TokenCard } from "@/components/bagscan/TokenCard";
import { TokenTable } from "@/components/bagscan/TokenTable";
import { LiveTicker } from "@/components/bagscan/LiveTicker";
import { EmptyState, ErrorState } from "@/components/bagscan/States";
import { TokenCardSkeleton, TokenTableSkeleton } from "@/components/bagscan/Skeletons";
import { formatCurrency, cn } from "@/lib/utils";
import type { NormalizedToken } from "@/lib/bags/types";
import {
  Flame, Rocket, Trophy, Search, SearchX, X, LayoutGrid, List,
  DollarSign, BarChart3, Layers, Cpu, AppWindow, Radio,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

// ── Types ────────────────────────────────────

interface LeaderboardEntry {
  tokenMint: string;
  name?: string;
  symbol?: string;
  image?: string;
  creatorDisplay?: string;
  creatorPfp?: string;
  provider?: string;
  providerUsername?: string;
  twitterUsername?: string;
  earnedLamports: string;
  earnedSol: number;
  earnedUsd: number;
  priceUsd?: number;
  volume24hUsd?: number;
  priceChange24h?: number;
}

interface HackathonApp {
  uuid: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  tokenAddress: string;
  twitterUrl?: string;
  priceUsd?: number;
  fdvUsd?: number;
  volume24hUsd?: number;
  priceChange24h?: number;
  liquidityUsd?: number;
  symbol?: string;
}

interface PlatformStats {
  totalProjects: number;
  totalCreatorEarnings: number;
  totalVolume: number;
}

interface TokensResponse {
  success: boolean;
  data: NormalizedToken[] | LeaderboardEntry[] | HackathonApp[];
  stats?: PlatformStats;
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    tab: string;
    totalPools?: number;
  };
}

type Tab = "trending" | "new" | "hackathon" | "leaderboard";
const EMPTY_LEADERBOARD: LeaderboardEntry[] = [];
const EMPTY_HACKATHON_APPS: HackathonApp[] = [];
const EMPTY_TOKENS: NormalizedToken[] = [];

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("trending");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [sort, setSort] = useState("volume-desc");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const isSearching = debouncedSearch.length >= 2;

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (isSearching) {
      p.set("search", debouncedSearch);
    } else {
      p.set("tab", tab);
      if (tab === "trending") p.set("sort", sort);
    }
    p.set("pageSize", "48");
    return p.toString();
  }, [debouncedSearch, isSearching, tab, sort]);

  const { data, isLoading, error, refetch } = useQuery<TokensResponse>({
    queryKey: ["tokens", params],
    queryFn: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const res = await fetch(`/api/tokens?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "API error");
        return json;
      } finally {
        clearTimeout(timeout);
      }
    },
    refetchInterval: isSearching ? false : (tab === "new" ? 15_000 : 30_000),
    staleTime: tab === "new" ? 0 : 10_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnWindowFocus: true,
  });

  const meta = data?.meta;
  const stats = data?.stats;
  const totalPools = meta?.totalPools;

  const isLeaderboard = !isSearching && tab === "leaderboard";
  const isHackathon = !isSearching && tab === "hackathon";
  const leaderboardEntries = isLeaderboard ? ((data?.data as LeaderboardEntry[] | undefined) ?? EMPTY_LEADERBOARD) : EMPTY_LEADERBOARD;
  const hackathonApps = isHackathon ? ((data?.data as HackathonApp[] | undefined) ?? EMPTY_HACKATHON_APPS) : EMPTY_HACKATHON_APPS;
  const tokens = (!isLeaderboard && !isHackathon) ? ((data?.data as NormalizedToken[] | undefined) ?? EMPTY_TOKENS) : EMPTY_TOKENS;
  const trendingTokens = !isSearching && tab === "trending" ? tokens : [];

  const [hackathonFilter, setHackathonFilter] = useState<string>("all");
  const hackathonCategories = useMemo(() => {
    const cats = new Set(hackathonApps.map((a) => a.category));
    return ["all", ...Array.from(cats).sort()];
  }, [hackathonApps]);
  const filteredApps = hackathonFilter === "all"
    ? hackathonApps
    : hackathonApps.filter((a) => a.category === hackathonFilter);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      {/* ╔══ HEADER PANEL ══╗ */}
      <div className="mb-6 animate-fade-in">
        <div className="crt-panel p-4">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-[#00ff41]/60" />
            <div>
              <h1 className="text-sm tracking-[0.2em] text-[#00ff41]" style={{ textShadow: '0 0 8px rgba(0,255,65,0.3)' }}>
                ╔══ BAGSCAN DISCOVERY TERMINAL ══╗
              </h1>
              <p className="text-[9px] text-[#00ff41]/30 tracking-[0.15em] mt-0.5">
                TOKEN EXPLORATION SYSTEM
                {totalPools ? (
                  <span> — <span className="text-[#00ff41]/60">{totalPools.toLocaleString()}</span> TOKENS INDEXED</span>
                ) : null}
                <span className="hidden sm:inline"> — </span>
                <a
                  href="https://bags.fm/BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline text-[#00ff41]/40 hover:text-[#00ff41]/70 transition-colors"
                >
                  POWERED BY <span className="text-[#00ff41]/60">$SCAN</span>
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Stats (only on leaderboard tab) */}
      {isLeaderboard && stats && (
        <div className="grid grid-cols-3 gap-3 mb-6 stagger-children">
          <StatCard label="CREATOR EARNINGS" value={formatCompactUsd(stats.totalCreatorEarnings)} icon={<DollarSign className="w-4 h-4" />} />
          <StatCard label="TRADING VOLUME" value={formatCompactUsd(stats.totalVolume)} icon={<BarChart3 className="w-4 h-4" />} />
          <StatCard label="PROJECTS FUNDED" value={formatCompactNum(stats.totalProjects)} icon={<Layers className="w-4 h-4" />} />
        </div>
      )}

      {/* LIVE Ticker */}
      {!isSearching && tab === "trending" && trendingTokens.length > 0 && (
        <LiveTicker tokens={trendingTokens} />
      )}

      {/* Search bar */}
      <div className="mb-5 animate-fade-in">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00ff41]/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SEARCH ALL TOKENS BY NAME, SYMBOL, OR MINT ADDRESS..."
            className="w-full pl-12 pr-12 py-3 bg-black/80 border-2 border-[#00ff41]/25 text-xs text-[#00ff41] placeholder-[#00ff41]/20 tracking-wider
                       focus:outline-none focus:border-[#00ff41]/60 focus:shadow-[0_0_15px_rgba(0,255,65,0.1)]
                       transition-all duration-300"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#00ff41]/30 hover:text-[#00ff41]">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tab bar + controls */}
      {!isSearching && (
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-0.5 p-0.5 border border-[#00ff41]/15 bg-black/40">
            <TabButton active={tab === "trending"} onClick={() => setTab("trending")} icon={<Flame className="w-3 h-3" />} label="TRENDING" />
            <TabButton active={tab === "new"} onClick={() => setTab("new")} icon={<Rocket className="w-3 h-3" />} label="NEW LAUNCHES" />
            <TabButton active={tab === "hackathon"} onClick={() => setTab("hackathon")} icon={<AppWindow className="w-3 h-3" />} label="HACKATHON" />
            <TabButton active={tab === "leaderboard"} onClick={() => setTab("leaderboard")} icon={<Trophy className="w-3 h-3" />} label="LEADERBOARD" />
          </div>

          {tab === "trending" && (
            <div className="flex items-center gap-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="px-3 py-2 bg-black/80 border border-[#00ff41]/20 text-[10px] text-[#00ff41]/60 tracking-wider focus:outline-none focus:border-[#00ff41]/50 appearance-none cursor-pointer"
              >
                <option value="volume-desc">VOLUME ↓</option>
                <option value="liquidity-desc">LIQUIDITY ↓</option>
                <option value="fdv-desc">MARKET CAP ↓</option>
                <option value="gainers">TOP GAINERS</option>
                <option value="losers">TOP LOSERS</option>
              </select>
              <div className="flex border border-[#00ff41]/15 overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn("p-2 transition-colors", viewMode === "grid" ? "bg-[#00ff41]/10 text-[#00ff41]" : "text-[#00ff41]/30 hover:text-[#00ff41]/60")}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={cn("p-2 transition-colors border-l border-[#00ff41]/15", viewMode === "table" ? "bg-[#00ff41]/10 text-[#00ff41]" : "text-[#00ff41]/30 hover:text-[#00ff41]/60")}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
          {tab === "hackathon" && (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={hackathonFilter}
                onChange={(e) => setHackathonFilter(e.target.value)}
                className="px-3 py-2 bg-black/80 border border-[#00ff41]/20 text-[10px] text-[#00ff41]/60 tracking-wider focus:outline-none focus:border-[#00ff41]/50 appearance-none cursor-pointer"
              >
                {hackathonCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === "all" ? "ALL CATEGORIES" : cat.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Search results header */}
      {isSearching && (
        <div className="flex items-center gap-2 text-[10px] text-[#00ff41]/40 mb-5 tracking-wider">
          <Search className="w-3.5 h-3.5 text-[#00ff41]/50" />
          {isLoading ? "SEARCHING..." : (
            <>FOUND <span className="text-[#00ff41]">{tokens.length}</span> RESULTS FOR &quot;{debouncedSearch}&quot;</>
          )}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        isLeaderboard || isHackathon ? (
          <LeaderboardSkeleton />
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <TokenCardSkeleton key={i} />)}
          </div>
        ) : (
          <TokenTableSkeleton />
        )
      ) : error ? (
        <ErrorState error={String(error)} onRetry={() => refetch()} />
      ) : isHackathon ? (
        filteredApps.length === 0 ? (
          <EmptyState title="NO HACKATHON APPS" description="NO APPLICATIONS FOUND FOR THIS CATEGORY..." />
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-4 text-[10px] tracking-wider">
              <AppWindow className="w-3.5 h-3.5 text-[#00aaff]" />
              <span className="text-[#00ff41]/50">
                HACKATHON APPS ({hackathonApps.length})
              </span>
              {hackathonFilter !== "all" && (
                <span className="text-[#00aaff]/30">FILTERED {filteredApps.length}</span>
              )}
              <span className="text-[#00ff41]/20">— BAGS APP STORE</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger-children">
              {filteredApps.map((app) => <HackathonCard key={app.uuid} app={app} />)}
            </div>
          </div>
        )
      ) : isLeaderboard ? (
        leaderboardEntries.length === 0 ? (
          <EmptyState title="NO LEADERBOARD DATA" description="AWAITING DATA FEED..." />
        ) : (
          <LeaderboardList entries={leaderboardEntries} />
        )
      ) : tokens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <SearchX className="w-10 h-10 text-[#00ff41]/20 mb-4" />
          <h3 className="text-sm text-[#00ff41]/50 tracking-[0.15em]">
            {isSearching ? "NO TOKENS FOUND" : "CONNECTING TO DATA FEED..."}
          </h3>
          <p className="text-[10px] text-[#00ff41]/25 mt-2 max-w-md tracking-wider">
            {isSearching ? "TRY A DIFFERENT QUERY OR PASTE A FULL MINT ADDRESS." : "DATA FEED IS BEING ESTABLISHED. AUTO-RETRYING..."}
          </p>
          {!isSearching && (
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 text-[10px] tracking-wider border border-[#00ff41]/30 text-[#00ff41]/60 hover:text-[#00ff41] hover:bg-[#00ff41]/5 transition-colors"
            >
              RETRY NOW
            </button>
          )}
        </div>
      ) : (
        <>
          {!isSearching && tab === "new" && (
            <div className="mb-5 p-3 border border-[#ffb800]/15 bg-[#ffb800]/[0.02] animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <Radio className="w-4 h-4 text-[#ffb800]" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#ffb800] animate-ping opacity-50" />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#ffb800]/80 tracking-[0.15em]" style={{ textShadow: '0 0 6px rgba(255,184,0,0.2)' }}>
                      LIVE NEW LAUNCHES
                    </span>
                    <span className="text-[9px] text-[#ffb800]/30 ml-2 tracking-wider">
                      ({tokens.length} TOKENS)
                    </span>
                  </div>
                </div>
                <span className="text-[8px] text-[#ffb800]/25 tracking-wider animate-pulse">
                  ● AUTO-REFRESHING
                </span>
              </div>
            </div>
          )}
          {!isSearching && tab === "trending" && (
            <div className="flex items-center gap-2 mb-4 text-[10px] tracking-wider">
              <Flame className="w-3.5 h-3.5 text-[#ffaa00]" />
              <span className="text-[#00ff41]/50">TRENDING ({tokens.length})</span>
            </div>
          )}
          {viewMode === "table" && !isSearching ? (
            <div className="animate-fade-in border border-[#00ff41]/15 bg-black/60 overflow-hidden">
              <TokenTable tokens={tokens} />
            </div>
          ) : (
            <div className={cn(
              "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3",
              tab === "new" ? "animate-fade-in" : "stagger-children"
            )}>
              {tokens.map((t, i) => (
                <TokenCard
                  key={t.tokenMint}
                  token={t}
                  isNewLaunch={!isSearching && tab === "new"}
                  index={i}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2 text-[10px] tracking-[0.12em] transition-all duration-200 border",
        active
          ? "border-[#00ff41]/50 bg-[#00ff41]/10 text-[#00ff41]"
          : "border-transparent text-[#00ff41]/30 hover:text-[#00ff41]/60 hover:bg-[#00ff41]/5"
      )}
      style={active ? { textShadow: '0 0 6px rgba(0,255,65,0.3)' } : undefined}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="border-2 border-[#00ff41]/25 bg-black/80 p-4 text-center">
      <div className="flex items-center justify-center gap-2 mb-1.5">
        <span className="text-[#00ff41]/40">{icon}</span>
      </div>
      <p className="text-[9px] text-[#00ff41]/30 uppercase tracking-[0.2em]">{label}</p>
      <p className="text-xl font-medium text-[#00ff41] mt-0.5 tracking-wider" style={{ textShadow: '0 0 10px rgba(0,255,65,0.3)' }}>{value}</p>
    </div>
  );
}

function LeaderboardList({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="space-y-2 animate-fade-in">
      <div className="flex items-center gap-2 mb-3 text-[10px] tracking-wider">
        <Trophy className="w-3.5 h-3.5 text-[#ffaa00]" />
        <span className="text-[#ffaa00]/80 tracking-[0.2em]">LEADERBOARD</span>
        <span className="text-[#00ff41]/20">BY CREATOR EARNINGS</span>
      </div>
      {entries.map((entry, idx) => (
        <LeaderboardRow key={entry.tokenMint} entry={entry} rank={idx + 1} />
      ))}
    </div>
  );
}

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const rankColors: Record<number, string> = {
    1: "text-[#ffaa00]",
    2: "text-[#00ff41]/70",
    3: "text-[#ff4400]/70",
  };

  return (
    <Link
      href={`/token/${entry.tokenMint}`}
      className="flex items-center gap-4 px-4 py-3 border border-[#00ff41]/10 bg-black/60 hover:border-[#00ff41]/30 hover:bg-[#00ff41]/[0.02] transition-all group"
    >
      <span className={cn("text-xs tracking-wider w-6 text-center", rankColors[rank] ?? "text-[#00ff41]/25")}
        style={rank <= 3 ? { textShadow: '0 0 6px currentColor' } : undefined}>
        {rank}
      </span>

      <div className="relative w-9 h-9 overflow-hidden flex-shrink-0 border border-[#00ff41]/15 group-hover:border-[#00ff41]/30 transition-all">
        {entry.image ? (
          <Image src={entry.image} alt={entry.symbol ?? ""} fill className="object-cover" unoptimized />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#00ff41]/30 text-xs bg-[#00ff41]/5">
            {entry.symbol?.charAt(0) ?? "?"}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#00ff41] tracking-wider group-hover:text-[#00ff41] transition-colors" style={{ textShadow: '0 0 4px rgba(0,255,65,0.2)' }}>
            ${entry.symbol}
          </span>
          {entry.provider && <span className="status-dot status-dot-green" style={{ width: '4px', height: '4px' }} />}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {entry.creatorPfp && (
            <div className="relative w-3.5 h-3.5 overflow-hidden flex-shrink-0 border border-[#00ff41]/10">
              <Image src={entry.creatorPfp} alt="" fill className="object-cover" unoptimized />
            </div>
          )}
          <span className="text-[9px] text-[#00ff41]/25 truncate tracking-wider">
            {entry.creatorDisplay ? `@${entry.creatorDisplay}` : ""}
          </span>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-xs text-[#ffaa00] tracking-wider" style={{ textShadow: '0 0 6px rgba(255,170,0,0.3)' }}>
          {formatCurrency(entry.earnedUsd)}
        </p>
        <p className="text-[8px] text-[#ffaa00]/30 tracking-[0.15em]">EARNED</p>
      </div>
    </Link>
  );
}

function HackathonCard({ app }: { app: HackathonApp }) {
  const changePositive = (app.priceChange24h ?? 0) >= 0;
  const hasPrice = !!app.priceUsd;
  const twitterHandle = app.twitterUrl?.replace(/https?:\/\/(x\.com|twitter\.com)\/?/i, "").replace(/\/$/, "");

  return (
    <Link
      href={`/token/${app.tokenAddress}`}
      className="group block border border-[#00aaff]/15 bg-black/70 p-4 relative overflow-hidden hover:border-[#00aaff]/40 hover:bg-[#00aaff]/[0.02] transition-all"
    >
      {/* Category badge */}
      <div className="absolute top-2 right-2">
        <span className="text-[8px] px-1.5 py-0.5 border border-[#00aaff]/25 text-[#00aaff]/60 tracking-[0.12em] bg-[#00aaff]/5">
          {app.category.toUpperCase()}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="relative w-11 h-11 overflow-hidden flex-shrink-0 border border-[#00aaff]/20 group-hover:border-[#00aaff]/40 transition-all">
          {app.icon ? (
            <Image src={app.icon} alt={app.name} fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#00aaff]/40 text-sm bg-[#00aaff]/5">
              {app.name.charAt(0)}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 pr-16">
          <h3 className="text-xs text-[#00aaff] truncate tracking-wider group-hover:text-[#00aaff] transition-colors" style={{ textShadow: '0 0 6px rgba(0,170,255,0.3)' }}>
            {app.name}
          </h3>
          {app.symbol && (
            <span className="text-[9px] text-[#00aaff]/30 tracking-wider">${app.symbol}</span>
          )}
          {twitterHandle && (
            <span className="text-[9px] text-[#00ff41]/25 tracking-wider block mt-0.5">
              @{twitterHandle}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="mt-2 text-[9px] text-[#00ff41]/30 tracking-wide leading-relaxed line-clamp-2">
        {app.description}
      </p>

      {/* Market data */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="p-1.5 border border-[#00aaff]/10 bg-black/40">
          <span className="text-[8px] text-[#00aaff]/30 tracking-[0.12em] block">FDV</span>
          <span className="text-[10px] text-[#00aaff]/70 tracking-wider">
            {app.fdvUsd ? formatCurrency(app.fdvUsd) : "—"}
          </span>
        </div>
        <div className="p-1.5 border border-[#00aaff]/10 bg-black/40">
          <span className="text-[8px] text-[#00aaff]/30 tracking-[0.12em] block">24H VOL</span>
          <span className="text-[10px] text-[#00aaff]/70 tracking-wider">
            {app.volume24hUsd ? formatCurrency(app.volume24hUsd) : "—"}
          </span>
        </div>
        <div className="p-1.5 border border-[#00aaff]/10 bg-black/40">
          <span className="text-[8px] text-[#00aaff]/30 tracking-[0.12em] block">24H</span>
          <span className={cn("text-[10px] tracking-wider", hasPrice ? (changePositive ? "text-[#00ff41]/70" : "text-[#ff4400]/70") : "text-[#00aaff]/30")}>
            {app.priceChange24h !== undefined ? `${changePositive ? "+" : ""}${app.priceChange24h.toFixed(1)}%` : "—"}
          </span>
        </div>
      </div>
    </Link>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border border-[#00ff41]/10 bg-black/60 animate-pulse">
          <div className="w-6 h-3 bg-[#00ff41]/5" />
          <div className="w-9 h-9 border border-[#00ff41]/5 bg-[#00ff41]/[0.02]" />
          <div className="flex-1">
            <div className="h-3 w-20 bg-[#00ff41]/5 mb-1" />
            <div className="h-2 w-14 bg-[#00ff41]/[0.03]" />
          </div>
          <div className="text-right">
            <div className="h-3 w-16 bg-[#ffaa00]/5 mb-1" />
            <div className="h-2 w-10 bg-[#ffaa00]/[0.03]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatCompactUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B+`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M+`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K+`;
  return `$${n.toFixed(0)}`;
}

function formatCompactNum(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M+`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K+`;
  return n.toLocaleString();
}
