"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TokenCard } from "@/components/bagscan/TokenCard";
import { TokenTable } from "@/components/bagscan/TokenTable";
import { LiveTicker } from "@/components/bagscan/LiveTicker";
import { EmptyState, ErrorState } from "@/components/bagscan/States";
import { TokenCardSkeleton, TokenTableSkeleton } from "@/components/bagscan/Skeletons";
import { formatCurrency, cn, shortenAddress, getValuationMetric } from "@/lib/utils";
import type { NormalizedToken } from "@/lib/bags/types";
import {
  Flame, Rocket, Trophy, Search, SearchX, X, LayoutGrid, List,
  DollarSign, BarChart3, Layers, Cpu, AppWindow, Radio, Sparkles,
  BadgeCheck, Activity, ExternalLink, Clock3, Globe2, Users,
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

interface HackathonLeaderboardEntry {
  uuid: string;
  name: string;
  description: string;
  category: string;
  categories?: string[];
  status?: string;
  icon: string;
  tokenAddress: string;
  duplicateCount?: number;
  twitterUrl?: string;
  twitterHandle?: string;
  twitterFollowers?: number;
  upvotes?: number;
  downvotes?: number;
  voteScore?: number;
  priceUsd?: number;
  marketCap?: number;
  fdvUsd?: number;
  volume24hUsd?: number;
  priceChange24h?: number;
  liquidityUsd?: number;
  symbol?: string;
  leaderboardMode: "votes" | "market";
}

interface HackathonApp {
  uuid: string;
  name: string;
  description: string;
  category?: string;
  categories?: string[];
  status?: string;
  icon: string;
  tokenAddress: string;
  duplicateCount?: number;
  twitterUrl?: string;
  priceUsd?: number;
  marketCap?: number;
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
  data: NormalizedToken[] | LeaderboardEntry[] | HackathonApp[] | HackathonLeaderboardEntry[];
  stats?: PlatformStats;
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    tab: string;
    scope?: string;
    mode?: string;
    totalPools?: number;
    totalHackathonApps?: number;
    acceptedOverall?: number;
    trackedMarketCap?: number;
  };
}

type Tab = "trending" | "spotlight" | "new" | "hackathon" | "leaderboard";
type LeaderboardScope = "platform" | "hackathon";
type HackathonLeaderboardMode = "votes" | "market";
const EMPTY_LEADERBOARD: LeaderboardEntry[] = [];
const EMPTY_HACKATHON_LEADERBOARD: HackathonLeaderboardEntry[] = [];
const EMPTY_HACKATHON_APPS: HackathonApp[] = [];
const EMPTY_TOKENS: NormalizedToken[] = [];

async function fetchTokensResponse(params: string): Promise<TokensResponse> {
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
}

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("trending");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [sort, setSort] = useState("volume-desc");
  const [leaderboardScope, setLeaderboardScope] = useState<LeaderboardScope>("platform");
  const [hackathonLeaderboardMode, setHackathonLeaderboardMode] = useState<HackathonLeaderboardMode>("votes");
  const queryClient = useQueryClient();

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
      if (tab === "leaderboard") {
        p.set("scope", leaderboardScope);
        if (leaderboardScope === "hackathon") {
          p.set("mode", hackathonLeaderboardMode);
        }
      }
    }
    p.set("pageSize", "48");
    return p.toString();
  }, [debouncedSearch, isSearching, tab, sort, leaderboardScope, hackathonLeaderboardMode]);

  const spotlightParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("tab", "spotlight");
    p.set("pageSize", "48");
    return p.toString();
  }, []);

  const { data, isLoading, error, refetch } = useQuery<TokensResponse>({
    queryKey: ["tokens", params],
    queryFn: () => fetchTokensResponse(params),
    placeholderData: (previousData) => previousData,
    refetchInterval: isSearching ? false : tab === "new" ? 15_000 : tab === "spotlight" ? 90_000 : 30_000,
    staleTime: tab === "new" ? 0 : tab === "spotlight" ? 45_000 : 10_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnWindowFocus: tab !== "spotlight",
  });

  useEffect(() => {
    if (isSearching || tab === "spotlight") {
      return;
    }

    const timer = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: ["tokens", spotlightParams],
        queryFn: () => fetchTokensResponse(spotlightParams),
        staleTime: 45_000,
      }).catch(() => {});
    }, 1_250);

    return () => clearTimeout(timer);
  }, [isSearching, queryClient, spotlightParams, tab]);

  const meta = data?.meta;
  const stats = data?.stats;
  const totalPools = meta?.totalPools;

  const isSpotlight = !isSearching && tab === "spotlight";
  const isLeaderboard = !isSearching && tab === "leaderboard";
  const isHackathonLeaderboard = isLeaderboard && leaderboardScope === "hackathon";
  const isPlatformLeaderboard = isLeaderboard && leaderboardScope === "platform";
  const isHackathon = !isSearching && tab === "hackathon";
  const leaderboardEntries = isPlatformLeaderboard ? ((data?.data as LeaderboardEntry[] | undefined) ?? EMPTY_LEADERBOARD) : EMPTY_LEADERBOARD;
  const hackathonLeaderboardEntries = isHackathonLeaderboard ? ((data?.data as HackathonLeaderboardEntry[] | undefined) ?? EMPTY_HACKATHON_LEADERBOARD) : EMPTY_HACKATHON_LEADERBOARD;
  const hackathonApps = isHackathon ? ((data?.data as HackathonApp[] | undefined) ?? EMPTY_HACKATHON_APPS) : EMPTY_HACKATHON_APPS;
  const tokens = (!isLeaderboard && !isHackathon) ? ((data?.data as NormalizedToken[] | undefined) ?? EMPTY_TOKENS) : EMPTY_TOKENS;
  const spotlightTokens = isSpotlight ? tokens : EMPTY_TOKENS;
  const trendingTokens = !isSearching && tab === "trending" ? tokens : [];

  const [hackathonFilter, setHackathonFilter] = useState<string>("all");
  const sortedHackathonApps = useMemo(
    () => [...hackathonApps].sort(compareHackathonApps),
    [hackathonApps]
  );
  const acceptedHackathonCount = useMemo(
    () => sortedHackathonApps.filter((app) => normalizeHackathonStatus(app.status) === "accepted").length,
    [sortedHackathonApps]
  );
  const liveHackathonTokenCount = useMemo(
    () => sortedHackathonApps.filter((app) => Boolean(app.tokenAddress)).length,
    [sortedHackathonApps]
  );
  const trackedHackathonVolume = useMemo(
    () => sortedHackathonApps.reduce((sum, app) => sum + (app.volume24hUsd ?? 0), 0),
    [sortedHackathonApps]
  );
  const hackathonCategories = useMemo(() => {
    const cats = Array.from(
      new Set(
        sortedHackathonApps.flatMap((app) =>
          (app.categories && app.categories.length > 0 ? app.categories : [app.category]).filter(
            (category): category is string => Boolean(category)
          )
        )
      )
    ).sort((a, b) => a.localeCompare(b));

    return [
      { value: "all", label: "ALL CATEGORIES" },
      { value: "accepted", label: "ACCEPTED ONLY" },
      ...cats.map((category) => ({
        value: `category:${category}`,
        label: category.toUpperCase(),
      })),
    ];
  }, [sortedHackathonApps]);
  const filteredApps = useMemo(() => {
    if (hackathonFilter === "all") {
      return sortedHackathonApps;
    }

    if (hackathonFilter === "accepted") {
      return sortedHackathonApps.filter((app) => normalizeHackathonStatus(app.status) === "accepted");
    }

    if (hackathonFilter.startsWith("category:")) {
      const selectedCategory = hackathonFilter.slice("category:".length);
      return sortedHackathonApps.filter((app) =>
        (app.categories && app.categories.length > 0 ? app.categories : [app.category]).includes(selectedCategory)
      );
    }

    return sortedHackathonApps;
  }, [hackathonFilter, sortedHackathonApps]);
  const currentHackathonFilterLabel = useMemo(() => {
    return hackathonCategories.find((option) => option.value === hackathonFilter)?.label ?? "ALL CATEGORIES";
  }, [hackathonCategories, hackathonFilter]);

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
      {isPlatformLeaderboard && stats && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 stagger-children">
          <StatCard label="CREATOR EARNINGS" value={formatCompactUsd(stats.totalCreatorEarnings)} icon={<DollarSign className="w-4 h-4" />} />
          <StatCard label="TRADING VOLUME" value={formatCompactUsd(stats.totalVolume)} icon={<BarChart3 className="w-4 h-4" />} />
          <StatCard label="PROJECTS FUNDED" value={formatCompactNum(stats.totalProjects)} icon={<Layers className="w-4 h-4" />} />
        </div>
      )}

      {/* LIVE Ticker */}
      {!isSearching && tab === "trending" && (
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
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-stretch gap-1 border border-[#00ff41]/15 bg-black/40 p-1">
            <TabButton active={tab === "trending"} onClick={() => setTab("trending")} icon={<Flame className="w-3 h-3" />} label="TRENDING" />
            <TabButton active={tab === "spotlight"} onClick={() => setTab("spotlight")} icon={<Sparkles className="w-3 h-3" />} label="SPOTLIGHT" />
            <TabButton active={tab === "new"} onClick={() => setTab("new")} icon={<Rocket className="w-3 h-3" />} label="NEW LAUNCHES" />
            <TabButton active={tab === "hackathon"} onClick={() => setTab("hackathon")} icon={<AppWindow className="w-3 h-3" />} label="HACKATHON" />
            <TabButton active={tab === "leaderboard"} onClick={() => setTab("leaderboard")} icon={<Trophy className="w-3 h-3" />} label="LEADERBOARD" />
          </div>

          {tab === "trending" && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full min-w-0 px-3 py-2 bg-black/80 border border-[#00ff41]/20 text-[10px] text-[#00ff41]/60 tracking-wider focus:outline-none focus:border-[#00ff41]/50 appearance-none cursor-pointer sm:w-auto"
              >
                <option value="volume-desc">VOLUME ↓</option>
                <option value="liquidity-desc">LIQUIDITY ↓</option>
                <option value="fdv-desc">VALUATION ↓</option>
                <option value="gainers">TOP GAINERS</option>
                <option value="losers">TOP LOSERS</option>
              </select>
              <div className="flex self-start overflow-hidden border border-[#00ff41]/15 sm:self-auto">
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
                className="w-full min-w-0 px-3 py-2 bg-black/80 border border-[#00ff41]/20 text-[10px] text-[#00ff41]/60 tracking-wider focus:outline-none focus:border-[#00ff41]/50 appearance-none cursor-pointer sm:w-auto"
              >
                {hackathonCategories.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {tab === "leaderboard" && (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <div className="flex overflow-hidden border border-[#00ff41]/15">
                <button
                  onClick={() => setLeaderboardScope("platform")}
                  className={cn(
                    "px-3 py-2 text-[10px] tracking-[0.15em] transition-colors",
                    leaderboardScope === "platform"
                      ? "bg-[#00ff41]/10 text-[#00ff41]"
                      : "text-[#00ff41]/35 hover:text-[#00ff41]/70"
                  )}
                >
                  PLATFORM
                </button>
                <button
                  onClick={() => setLeaderboardScope("hackathon")}
                  className={cn(
                    "border-l border-[#00ff41]/15 px-3 py-2 text-[10px] tracking-[0.15em] transition-colors",
                    leaderboardScope === "hackathon"
                      ? "bg-[#00ff41]/10 text-[#00ff41]"
                      : "text-[#00ff41]/35 hover:text-[#00ff41]/70"
                  )}
                >
                  HACKATHON
                </button>
              </div>
              {leaderboardScope === "hackathon" ? (
                <div className="flex overflow-hidden border border-[#00aaff]/18">
                  <button
                    onClick={() => setHackathonLeaderboardMode("votes")}
                    className={cn(
                      "px-3 py-2 text-[10px] tracking-[0.15em] transition-colors",
                      hackathonLeaderboardMode === "votes"
                        ? "bg-[#00aaff]/10 text-[#8dd8ff]"
                        : "text-[#00aaff]/40 hover:text-[#8dd8ff]"
                    )}
                  >
                    BY VOTES
                  </button>
                  <button
                    onClick={() => setHackathonLeaderboardMode("market")}
                    className={cn(
                      "border-l border-[#00aaff]/18 px-3 py-2 text-[10px] tracking-[0.15em] transition-colors",
                      hackathonLeaderboardMode === "market"
                        ? "bg-[#00aaff]/10 text-[#8dd8ff]"
                        : "text-[#00aaff]/40 hover:text-[#8dd8ff]"
                    )}
                  >
                    BY MARKET
                  </button>
                </div>
              ) : null}
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
          <HackathonSection
            apps={sortedHackathonApps}
            filteredApps={filteredApps}
            acceptedCount={acceptedHackathonCount}
            acceptedOverall={meta?.acceptedOverall}
            totalHackathonApps={meta?.totalHackathonApps}
            liveTokenCount={liveHackathonTokenCount}
            trackedVolume={trackedHackathonVolume}
            selectedFilterLabel={currentHackathonFilterLabel}
          />
        )
      ) : isLeaderboard ? (
        (isHackathonLeaderboard ? hackathonLeaderboardEntries.length === 0 : leaderboardEntries.length === 0) ? (
          <EmptyState title="NO LEADERBOARD DATA" description="AWAITING DATA FEED..." />
        ) : (
          isHackathonLeaderboard ? (
            <HackathonLeaderboardList
              entries={hackathonLeaderboardEntries}
              mode={hackathonLeaderboardMode}
              acceptedOverall={meta?.acceptedOverall}
              totalHackathonApps={meta?.totalHackathonApps}
              trackedMarketCap={meta?.trackedMarketCap}
            />
          ) : (
            <LeaderboardList entries={leaderboardEntries} />
          )
        )
      ) : isSpotlight ? (
        spotlightTokens.length === 0 ? (
          <EmptyState title="NO SPOTLIGHT TOKENS" description="WAITING FOR ENOUGH CONVICTION SIGNALS TO BUILD THE FEATURED BOARD..." />
        ) : (
          <SpotlightSection tokens={spotlightTokens} />
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
          {!isSearching && tab === "trending" ? (
            <TrendingSection
              tokens={tokens}
            >
              {viewMode === "table" ? (
                <div className="animate-fade-in overflow-hidden border border-[#00ff41]/18 bg-[linear-gradient(180deg,rgba(0,0,0,0.9),rgba(0,18,8,0.92))] shadow-[0_0_32px_rgba(0,255,65,0.05)]">
                  <div className="border-b border-[#00ff41]/12 px-4 py-3 text-[10px] tracking-[0.18em] text-[#00ff41]/45">
                    TRENDING TABLE VIEW • LIVE FLOW SORTING
                  </div>
                  <TokenTable tokens={tokens} />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 stagger-children">
                  {tokens.map((t, i) => (
                    <TokenCard
                      key={t.tokenMint}
                      token={t}
                      index={i}
                      surfaceVariant="trending"
                    />
                  ))}
                </div>
              )}
            </TrendingSection>
          ) : !isSearching && tab === "new" ? (
            <NewLaunchSection tokens={tokens}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-fade-in">
                {tokens.map((t, i) => (
                  <TokenCard
                    key={t.tokenMint}
                    token={t}
                    isNewLaunch
                    index={i}
                    surfaceVariant="new"
                  />
                ))}
              </div>
            </NewLaunchSection>
          ) : viewMode === "table" && !isSearching ? (
            <div className="animate-fade-in border border-[#00ff41]/15 bg-black/60 overflow-hidden">
              <TokenTable tokens={tokens} />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 stagger-children">
              {tokens.map((t, i) => (
                <TokenCard
                  key={t.tokenMint}
                  token={t}
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
        "flex grow items-center justify-center gap-1.5 px-3 py-2 text-center text-[10px] tracking-[0.12em] transition-all duration-200 border sm:grow-0 sm:px-4",
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
      <p className="mt-0.5 text-lg font-medium tracking-wider text-[#00ff41] sm:text-xl" style={{ textShadow: '0 0 10px rgba(0,255,65,0.3)' }}>{value}</p>
    </div>
  );
}

function LeaderboardList({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="space-y-2 animate-fade-in">
      <div className="flex items-center gap-2 mb-3 text-[10px] tracking-wider">
        <Trophy className="w-3.5 h-3.5 text-[#ffaa00]" />
        <span className="text-[#ffaa00]/80 tracking-[0.2em]">PLATFORM LEADERBOARD</span>
        <span className="text-[#00ff41]/20">BY CREATOR EARNINGS</span>
      </div>
      {entries.map((entry, idx) => (
        <LeaderboardRow key={getPlatformLeaderboardKey(entry, idx)} entry={entry} rank={idx + 1} />
      ))}
    </div>
  );
}

function HackathonLeaderboardList({
  entries,
  mode,
  acceptedOverall,
  totalHackathonApps,
  trackedMarketCap,
}: {
  entries: HackathonLeaderboardEntry[];
  mode: HackathonLeaderboardMode;
  acceptedOverall?: number;
  totalHackathonApps?: number;
  trackedMarketCap?: number;
}) {
  const acceptedOnBoard = entries.filter((entry) => normalizeHackathonStatus(entry.status) === "accepted").length;
  const liveTokenCount = entries.filter((entry) => Boolean(entry.tokenAddress)).length;
  const totalUpvotes = entries.reduce((sum, entry) => sum + (entry.upvotes ?? 0), 0);
  const totalVolume = entries.reduce((sum, entry) => sum + (entry.volume24hUsd ?? 0), 0);
  const trackedBoardValuation = entries.reduce((sum, entry) => sum + (getValuationMetric(entry).value ?? 0), 0);

  return (
    <div className="animate-fade-in">
      <div className="mb-5 overflow-hidden border border-[#00aaff]/18 bg-[linear-gradient(135deg,rgba(0,170,255,0.08),rgba(0,170,255,0.02)_28%,rgba(0,0,0,0.84)_72%)] shadow-[0_0_44px_rgba(0,170,255,0.06)]">
        <div className="grid gap-4 p-5 xl:grid-cols-[1.28fr,0.95fr]">
          <div className="relative overflow-hidden border border-[#00aaff]/10 bg-black/35 p-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,170,255,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(0,255,65,0.08),transparent_42%)]" />
            <div className="relative">
              <div className="flex items-center gap-2 text-[10px] tracking-wider">
                <Trophy className="w-3.5 h-3.5 text-[#8dd8ff]" />
                <span className="text-[#8dd8ff] tracking-[0.18em]">HACKATHON LEADERBOARD</span>
                <span className="text-[#00ff41]/20">{mode === "votes" ? "BY VOTES" : "BY MARKET"}</span>
              </div>
              <h2 className="mt-4 text-[18px] tracking-[0.18em] text-[#dff6ff] sm:text-[22px]" style={{ textShadow: "0 0 14px rgba(0,170,255,0.16)" }}>
                TOP HACKATHON PROJECTS, SEPARATED FROM THE MAIN TOKEN BOARD
              </h2>
              <p className="mt-4 max-w-3xl text-[10px] leading-relaxed tracking-[0.15em] text-[#9edfff]/72">
                Hackathon leaderboard uses the Bags App Store feed directly. Switch between vote-driven ranking and market-driven ranking so
                competition momentum and token traction do not get mixed into the same list.
              </p>
              <div className="mt-4 border-l-2 border-[#00aaff]/22 pl-4 text-[9px] leading-6 tracking-[0.16em] text-[#00ff41]/42">
                {mode === "votes"
                  ? "VOTE MODE USES LIVE HACKATHON UPVOTES AND DOWNVOTES AS THE PRIMARY RANKING SIGNAL."
                  : "MARKET MODE PRIORITIZES ACCEPTED PROJECTS, LIVE TOKENS, VOLUME, AND VALUATION STRENGTH."}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <PremiumBoardStatTile label="TOP APPS" value={formatCompactNum(entries.length)} hint={`Leaderboard slice from ${formatCompactNum(totalHackathonApps ?? entries.length)} total apps.`} accent="cyan" icon={<AppWindow className="h-4 w-4" />} />
            <PremiumBoardStatTile label="ACCEPTED ON BOARD" value={formatCompactNum(acceptedOnBoard)} hint="Accepted projects inside this top slice." accent="amber" icon={<BadgeCheck className="h-4 w-4" />} />
            <PremiumBoardStatTile label="ACCEPTED OVERALL" value={formatCompactNum(acceptedOverall ?? acceptedOnBoard)} hint="Accepted projects across the full hackathon feed." accent="green" icon={<BadgeCheck className="h-4 w-4" />} />
            <PremiumBoardStatTile
              label={mode === "votes" ? "TOTAL UPVOTES" : "TRACKED VALUE"}
              value={mode === "votes" ? formatCompactNum(totalUpvotes) : formatCompactUsd(trackedMarketCap ?? trackedBoardValuation)}
              hint={mode === "votes" ? `24H volume ${formatCompactUsd(totalVolume)}.` : `${formatCompactNum(liveTokenCount)} live-token apps on board. MCAP first, FDV fallback.`}
              accent="cyan"
              icon={mode === "votes" ? <Activity className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {entries.map((entry, index) => (
          <HackathonLeaderboardRow key={getHackathonAppKey(entry, index)} entry={entry} rank={index + 1} mode={mode} />
        ))}
      </div>
    </div>
  );
}

function HackathonLeaderboardRow({
  entry,
  rank,
  mode,
}: {
  entry: HackathonLeaderboardEntry;
  rank: number;
  mode: HackathonLeaderboardMode;
}) {
  const status = normalizeHackathonStatus(entry.status);
  const hasToken = Boolean(entry.tokenAddress);
  const changePositive = (entry.priceChange24h ?? 0) >= 0;
  const href = hasToken ? `/token/${entry.tokenAddress}` : `https://bags.fm/apps/${entry.uuid}`;
  const metricLabel = mode === "votes" ? "VOTE SCORE" : "24H VOL";
  const metricValue = mode === "votes"
    ? `${entry.voteScore ?? 0}`
    : entry.volume24hUsd
      ? formatCurrency(entry.volume24hUsd)
      : "--";
  const valuation = getValuationMetric(entry);
  const categoryLabel = getHackathonPrimaryCategory(entry);
  const metricHint = mode === "votes"
    ? `UP ${entry.upvotes ?? 0} / DOWN ${entry.downvotes ?? 0}`
    : `${valuation.shortLabel} ${formatCurrency(valuation.value)}`;

  return (
    <Link
      href={href}
      target={hasToken ? undefined : "_blank"}
      rel={hasToken ? undefined : "noopener noreferrer"}
      className="group flex flex-wrap items-center gap-3 border border-[#00aaff]/12 bg-[linear-gradient(180deg,rgba(0,0,0,0.9),rgba(0,18,28,0.92))] px-3 py-3 transition-all hover:border-[#00aaff]/30 hover:shadow-[0_16px_48px_rgba(0,170,255,0.06)] sm:flex-nowrap sm:gap-4 sm:px-4"
    >
      <span
        className={cn(
          "w-6 text-center text-xs tracking-wider",
          rank === 1 ? "text-[#ffaa00]" : rank === 2 ? "text-[#8dd8ff]" : rank === 3 ? "text-[#9dffb8]" : "text-[#00aaff]/30"
        )}
        style={rank <= 3 ? { textShadow: "0 0 6px currentColor" } : undefined}
      >
        {rank}
      </span>

      <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden border border-[#00aaff]/16 bg-black/50">
        {entry.icon ? (
          <Image src={entry.icon} alt={entry.name} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-[#00aaff]/35">
            {entry.name.charAt(0)}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-xs tracking-wider text-[#dff6ff]">{entry.name}</span>
          <span className={cn(
            "border px-1.5 py-0.5 text-[8px] tracking-[0.18em]",
            status === "accepted"
              ? "border-[#ffaa00]/24 bg-[#ffaa00]/10 text-[#ffd37a]"
              : "border-[#00aaff]/22 bg-[#00aaff]/10 text-[#8dd8ff]"
          )}>
            {status === "accepted" ? "ACCEPTED" : "IN REVIEW"}
          </span>
          <span className="border border-[#00ff41]/14 bg-[#00ff41]/[0.04] px-1.5 py-0.5 text-[8px] tracking-[0.18em] text-[#9dffb8]">
            {categoryLabel.toUpperCase()}
          </span>
          {hasToken ? (
            <span className="border border-[#00ff41]/18 bg-[#00ff41]/10 px-1.5 py-0.5 text-[8px] tracking-[0.18em] text-[#9dffb8]">
              LIVE TOKEN
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] tracking-[0.14em] text-[#00ff41]/35">
          {entry.twitterHandle ? <span>@{entry.twitterHandle}</span> : null}
          {entry.twitterFollowers ? <span>{formatCompactNum(entry.twitterFollowers)} followers</span> : null}
          {hasToken ? <span>{shortenAddress(entry.tokenAddress)}</span> : <span>BAGS APP PROFILE</span>}
        </div>
      </div>

      <div className="w-full flex-shrink-0 text-left sm:w-auto sm:text-right">
        <p className="text-xs tracking-wider text-[#8dd8ff]" style={{ textShadow: "0 0 6px rgba(0,170,255,0.3)" }}>
          {metricValue}
        </p>
        <p className="text-[8px] tracking-[0.16em] text-[#00aaff]/35">{metricLabel}</p>
        <p className="mt-1 text-[8px] tracking-[0.14em] text-[#00ff41]/28">{metricHint}</p>
        {mode === "market" && entry.priceChange24h !== undefined ? (
          <p className={cn("mt-1 text-[8px] tracking-[0.14em]", changePositive ? "text-[#00ff41]/65" : "text-[#ff4400]/65")}>
            {changePositive ? "+" : ""}{entry.priceChange24h.toFixed(1)}%
          </p>
        ) : null}
      </div>
    </Link>
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
      className="group flex flex-wrap items-center gap-3 border border-[#00ff41]/10 bg-black/60 px-3 py-3 transition-all hover:border-[#00ff41]/30 hover:bg-[#00ff41]/[0.02] sm:flex-nowrap sm:gap-4 sm:px-4"
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

      <div className="w-full flex-shrink-0 text-left sm:w-auto sm:text-right">
        <p className="text-xs text-[#ffaa00] tracking-wider" style={{ textShadow: '0 0 6px rgba(255,170,0,0.3)' }}>
          {formatCurrency(entry.earnedUsd)}
        </p>
        <p className="text-[8px] text-[#ffaa00]/30 tracking-[0.15em]">EARNED</p>
      </div>
    </Link>
  );
}

function getTokenAgeHours(dateStr?: string) {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / (1000 * 60 * 60);
}

function formatTokenAgeLabel(hours: number | null) {
  if (hours === null) return "LIVE";
  if (hours < 1) return "<1H";
  if (hours < 24) return `${Math.round(hours)}H`;
  const days = hours / 24;
  if (days < 7) return `${Math.round(days)}D`;
  return `${Math.round(days / 7)}W`;
}

function TrendingSection({
  tokens,
  children,
}: {
  tokens: NormalizedToken[];
  children: React.ReactNode;
}) {
  const totalVolume = tokens.reduce((sum, token) => sum + (token.volume24hUsd ?? 0), 0);
  const totalLiquidity = tokens.reduce((sum, token) => sum + (token.liquidityUsd ?? 0), 0);
  const totalValuation = tokens.reduce((sum, token) => sum + (getValuationMetric(token).value ?? 0), 0);
  const activePairs = tokens.filter((token) => (token.txCount24h ?? 0) >= 50).length;
  const gainers = tokens.filter((token) => (token.priceChange24h ?? 0) > 0).length;

  return (
    <div className="animate-fade-in">
      <div className="mb-5 overflow-hidden border border-[#00ff41]/18 bg-[linear-gradient(135deg,rgba(0,255,65,0.08),rgba(0,255,65,0.02)_28%,rgba(0,0,0,0.82)_72%)] shadow-[0_0_44px_rgba(0,255,65,0.05)]">
        <div className="grid gap-4 p-5 xl:grid-cols-[1.28fr,0.95fr]">
          <div className="relative overflow-hidden border border-[#00ff41]/10 bg-black/35 p-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,255,65,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(0,170,255,0.08),transparent_42%)]" />
            <div className="relative">
              <div className="flex items-center gap-2 text-[10px] tracking-wider">
                <Flame className="w-3.5 h-3.5 text-[#ffaa00]" />
                <span className="text-[#9dffb8] tracking-[0.18em]">TRENDING MARKET BOARD</span>
                <span className="text-[#00ff41]/20">PREMIUM LIVE FLOW</span>
              </div>
              <h2 className="mt-4 text-[18px] tracking-[0.18em] text-[#d8ffe6] sm:text-[22px]" style={{ textShadow: "0 0 14px rgba(0,255,65,0.14)" }}>
                THE STRONGEST LIVE BAGS TOKENS, RANKED BY CURRENT ACTIVITY
              </h2>
              <p className="mt-4 max-w-3xl text-[10px] leading-relaxed tracking-[0.15em] text-[#9dffb8]/70">
                Trending is the real-time BagScan flow board. It favors tokens holding live volume, liquidity, price movement, and active trade
                traffic instead of static popularity.
              </p>
              <div className="mt-4 border-l-2 border-[#00ff41]/22 pl-4 text-[9px] leading-6 tracking-[0.16em] text-[#00ff41]/42">
                THIS VIEW STAYS CLOSE TO THE MARKET TAPE, SO THE BOARD SHIFTS WITH LIVE FLOW.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <PremiumBoardStatTile label="LIVE TOKENS" value={formatCompactNum(tokens.length)} hint="Tracked trending pairs." accent="green" icon={<Flame className="h-4 w-4" />} />
            <PremiumBoardStatTile label="24H VOLUME" value={formatCompactUsd(totalVolume)} hint="Current flow on board." accent="green" icon={<BarChart3 className="h-4 w-4" />} />
            <PremiumBoardStatTile label="COMBINED VALUE" value={formatCompactUsd(totalValuation)} hint={`MCAP first, FDV fallback. Liquidity ${formatCompactUsd(totalLiquidity)}.`} accent="cyan" icon={<Layers className="h-4 w-4" />} />
            <PremiumBoardStatTile label="ACTIVE PAIRS" value={formatCompactNum(activePairs)} hint={`${gainers} gainers in positive territory.`} accent="amber" icon={<Activity className="h-4 w-4" />} />
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}

function NewLaunchSection({
  tokens,
  children,
}: {
  tokens: NormalizedToken[];
  children: React.ReactNode;
}) {
  const launched24h = tokens.filter((token) => {
    const hours = getTokenAgeHours(token.pairCreatedAt);
    return hours !== null && hours <= 24;
  }).length;
  const livePriced = tokens.filter((token) => token.priceUsd !== undefined || token.volume24hUsd !== undefined).length;
  const migrated = tokens.filter((token) => Boolean(token.isMigrated)).length;
  const freshestAge = tokens.reduce<number | null>((best, token) => {
    const hours = getTokenAgeHours(token.pairCreatedAt);
    if (hours === null) return best;
    if (best === null) return hours;
    return Math.min(best, hours);
  }, null);

  return (
    <div className="animate-fade-in">
      <div className="mb-5 overflow-hidden border border-[#ffb800]/18 bg-[linear-gradient(135deg,rgba(255,184,0,0.08),rgba(255,184,0,0.02)_28%,rgba(0,0,0,0.84)_72%)] shadow-[0_0_44px_rgba(255,184,0,0.06)]">
        <div className="grid gap-4 p-5 xl:grid-cols-[1.28fr,0.95fr]">
          <div className="relative overflow-hidden border border-[#ffb800]/10 bg-black/35 p-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,184,0,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,120,0,0.10),transparent_40%)]" />
            <div className="relative">
              <div className="flex items-center gap-2 text-[10px] tracking-wider">
                <Rocket className="w-3.5 h-3.5 text-[#ffb800]" />
                <span className="text-[#ffd37a] tracking-[0.18em]">NEW LAUNCH DISCOVERY BOARD</span>
                <span className="text-[#ffb800]/22">PREMIUM EARLY FLOW</span>
              </div>
              <h2 className="mt-4 text-[18px] tracking-[0.18em] text-[#fff3d1] sm:text-[22px]" style={{ textShadow: "0 0 14px rgba(255,184,0,0.16)" }}>
                FRESH BAGS LAUNCHES, SURFACED WHILE THEY ARE STILL EARLY
              </h2>
              <p className="mt-4 max-w-3xl text-[10px] leading-relaxed tracking-[0.15em] text-[#ffd37a]/72">
                New Launches is built for early discovery. It highlights recent Bags entries, surfaces tokens that are already finding liquidity,
                and keeps the board biased toward freshness without losing market context.
              </p>
              <div className="mt-4 border-l-2 border-[#ffb800]/22 pl-4 text-[9px] leading-6 tracking-[0.16em] text-[#ffb800]/45">
                THIS VIEW IS DESIGNED TO HELP YOU CATCH NEW FLOW BEFORE IT BECOMES MATURE MARKET STRUCTURE.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <PremiumBoardStatTile label="LIVE LAUNCHES" value={formatCompactNum(tokens.length)} hint="Tokens currently on the board." accent="amber" icon={<Rocket className="h-4 w-4" />} />
            <PremiumBoardStatTile label="WITH MARKET DATA" value={formatCompactNum(livePriced)} hint="Already showing live price or volume." accent="amber" icon={<Radio className="h-4 w-4" />} />
            <PremiumBoardStatTile label="UNDER 24H" value={formatCompactNum(launched24h)} hint="Very recent discovery window." accent="green" icon={<Clock3 className="h-4 w-4" />} />
            <PremiumBoardStatTile label="MIGRATED" value={formatCompactNum(migrated)} hint={`Freshest board age ${formatTokenAgeLabel(freshestAge)}.`} accent="orange" icon={<Layers className="h-4 w-4" />} />
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}

function PremiumBoardStatTile({
  label,
  value,
  hint,
  icon,
  accent = "green",
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent?: "green" | "amber" | "cyan" | "orange";
}) {
  const accentClass =
    accent === "amber"
      ? "text-[#ffd37a]"
      : accent === "cyan"
        ? "text-[#8dd8ff]"
        : accent === "orange"
          ? "text-[#ffb36b]"
          : "text-[#d8ffe6]";

  return (
    <div className="border border-white/10 bg-black/40 p-4">
      <div className="flex items-center gap-2 text-white/30">
        {icon}
        <span className="text-[8px] tracking-[0.18em]">{label}</span>
      </div>
      <span className={cn("mt-2 block text-[18px] tracking-[0.08em]", accentClass)}>{value}</span>
      <span className="mt-2 block text-[9px] tracking-[0.14em] text-[#00ff41]/28">{hint}</span>
    </div>
  );
}

function normalizeHackathonLabel(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeHackathonStatus(status?: string | null) {
  return normalizeHackathonLabel(status) === "accepted" ? "accepted" : "in review";
}

function getHackathonTwitterHandle(url?: string) {
  if (!url) return null;
  return url
    .replace(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .trim() || null;
}

function getHackathonPrimaryCategory(app: Pick<HackathonApp, "category" | "categories">) {
  const directCategory = app.category?.trim();
  if (directCategory) {
    return directCategory;
  }

  const fallbackCategory = app.categories?.find((category) => typeof category === "string" && category.trim().length > 0)?.trim();
  return fallbackCategory || "Other";
}

function getHackathonAppKey(app: Pick<HackathonApp, "uuid" | "tokenAddress" | "name" | "category">, index: number) {
  return [
    app.uuid || "hackathon",
    app.tokenAddress || "app",
    app.name || "unnamed",
    app.category || "other",
    index,
  ].join(":");
}

function getPlatformLeaderboardKey(
  entry: Pick<LeaderboardEntry, "tokenMint" | "name" | "creatorDisplay" | "providerUsername">,
  index: number
) {
  return [
    entry.tokenMint || "platform",
    entry.name || "unnamed",
    entry.creatorDisplay || entry.providerUsername || "creator",
    index,
  ].join(":");
}

function compareHackathonApps(a: HackathonApp, b: HackathonApp) {
  const acceptedDiff = Number(normalizeHackathonStatus(b.status) === "accepted") - Number(normalizeHackathonStatus(a.status) === "accepted");
  if (acceptedDiff !== 0) return acceptedDiff;

  const liveTokenDiff = Number(Boolean(b.tokenAddress)) - Number(Boolean(a.tokenAddress));
  if (liveTokenDiff !== 0) return liveTokenDiff;

  const volumeDiff = (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0);
  if (volumeDiff !== 0) return volumeDiff;

  const marketCapDiff = (b.marketCap ?? 0) - (a.marketCap ?? 0);
  if (marketCapDiff !== 0) return marketCapDiff;

  return (a.name || "").localeCompare(b.name || "");
}

function HackathonSection({
  apps,
  filteredApps,
  acceptedCount,
  acceptedOverall,
  totalHackathonApps,
  liveTokenCount,
  trackedVolume,
  selectedFilterLabel,
}: {
  apps: HackathonApp[];
  filteredApps: HackathonApp[];
  acceptedCount: number;
  acceptedOverall?: number;
  totalHackathonApps?: number;
  liveTokenCount: number;
  trackedVolume: number;
  selectedFilterLabel: string;
}) {
  const trackedValuation = apps.reduce((sum, app) => sum + (getValuationMetric(app).value ?? 0), 0);
  const officialTotalApps = totalHackathonApps ?? apps.length;
  const officialAcceptedCount = acceptedOverall ?? acceptedCount;

  return (
    <div className="animate-fade-in">
      <div className="mb-5 overflow-hidden border border-[#00aaff]/18 bg-[linear-gradient(135deg,rgba(0,170,255,0.08),rgba(0,170,255,0.02)_28%,rgba(0,0,0,0.82)_72%)] shadow-[0_0_44px_rgba(0,170,255,0.06)]">
        <div className="grid gap-4 p-5 xl:grid-cols-[1.3fr,0.95fr]">
          <div className="relative overflow-hidden border border-[#00aaff]/10 bg-black/35 p-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,170,255,0.14),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(0,255,65,0.08),transparent_40%)]" />
            <div className="relative">
              <div className="flex items-center gap-2 text-[10px] tracking-wider">
                <AppWindow className="w-3.5 h-3.5 text-[#00aaff]" />
                <span className="text-[#8dd8ff] tracking-[0.18em]">HACKATHON APP STORE</span>
                <span className="text-[#00ff41]/20">PREMIUM PROJECT BOARD</span>
              </div>
              <h2 className="mt-4 text-[18px] tracking-[0.18em] text-[#dff6ff] sm:text-[22px]" style={{ textShadow: "0 0 14px rgba(0,170,255,0.16)" }}>
                BAGS HACKATHON PROJECTS, WITH ACCEPTED TEAMS PINNED
              </h2>
              <p className="mt-4 max-w-3xl text-[10px] leading-relaxed text-[#9edfff]/72 tracking-[0.15em]">
                BagScan tracks the full Bags Hackathon App Store, enriches tokenized entries with live market data, and surfaces accepted
                projects as a first-class view. This board is designed to feel curated, not merely listed.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] tracking-[0.16em]">
                <span className="border border-[#00aaff]/22 bg-[#00aaff]/10 px-2 py-1 text-[#8dd8ff]">
                  HACKATHON APPS ({officialTotalApps})
                </span>
                <span className="border border-[#ffaa00]/24 bg-[#ffaa00]/10 px-2 py-1 text-[#ffd37a]">
                  ACCEPTED ({officialAcceptedCount})
                </span>
                <span className="border border-[#00ff41]/18 bg-[#00ff41]/10 px-2 py-1 text-[#9dffb8]">
                  UNIQUE PROJECTS ({apps.length})
                </span>
                {selectedFilterLabel !== "ALL CATEGORIES" ? (
                  <span className="border border-[#00ff41]/18 bg-[#00ff41]/10 px-2 py-1 text-[#9dffb8]">
                    FILTERED {filteredApps.length} - {selectedFilterLabel}
                  </span>
                ) : null}
                <span className="text-[#00ff41]/25">BAGS APP STORE</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <HackathonStatTile label="TOTAL APPS" value={formatCompactNum(officialTotalApps)} hint="Official Bags hackathon app count before BagScan dedupe." icon={<AppWindow className="h-4 w-4" />} />
            <HackathonStatTile label="ACCEPTED" value={formatCompactNum(officialAcceptedCount)} hint="Accepted projects across the full feed." icon={<BadgeCheck className="h-4 w-4" />} accent="text-[#ffd37a]" />
            <HackathonStatTile label="LIVE TOKENS" value={formatCompactNum(liveTokenCount)} hint="Entries with token pages." icon={<Layers className="h-4 w-4" />} accent="text-[#9dffb8]" />
            <HackathonStatTile label="24H VOLUME" value={formatCompactUsd(trackedVolume)} hint="Tracked volume across listed tokens." icon={<Activity className="h-4 w-4" />} accent="text-[#8dd8ff]" />
          </div>
        </div>
        <div className="border-t border-[#00aaff]/12 bg-black/35 px-5 py-3 text-[10px] tracking-[0.18em] text-[#00ff41]/40">
          ACCEPTED PROJECTS ARE PINNED FIRST, THEN LIVE TOKEN ACTIVITY, VOLUME, AND VALUATION STRENGTH.
          <span className="ml-2 text-[#00aaff]/40">TRACKED VALUE {formatCompactUsd(trackedValuation)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
        {filteredApps.map((app, index) => <HackathonCard key={getHackathonAppKey(app, index)} app={app} />)}
      </div>
    </div>
  );
}

function HackathonCard({ app }: { app: HackathonApp }) {
  const status = normalizeHackathonStatus(app.status);
  const changePositive = (app.priceChange24h ?? 0) >= 0;
  const hasPrice = app.priceChange24h !== undefined;
  const hasToken = Boolean(app.tokenAddress);
  const twitterHandle = getHackathonTwitterHandle(app.twitterUrl);
  const categoryLabel = getHackathonPrimaryCategory(app);
  const href = hasToken ? `/token/${app.tokenAddress}` : `https://bags.fm/apps/${app.uuid}`;
  const valuation = getValuationMetric(app);

  return (
    <Link
      href={href}
      target={hasToken ? undefined : "_blank"}
      rel={hasToken ? undefined : "noopener noreferrer"}
      className="group relative block overflow-hidden border border-[#00aaff]/14 bg-[linear-gradient(180deg,rgba(0,0,0,0.92),rgba(0,20,30,0.9))] p-4 transition-all duration-300 hover:border-[#00aaff]/38 hover:bg-[#00aaff]/[0.03] hover:shadow-[0_20px_60px_rgba(0,170,255,0.08)]"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(0,170,255,0.65),transparent)] opacity-80" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden border border-[#00aaff]/18 bg-black/45 shadow-[0_0_18px_rgba(0,170,255,0.08)]">
            {app.icon ? (
              <Image src={app.icon} alt={app.name} fill className="object-cover" unoptimized />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#00aaff]/5 text-sm text-[#00aaff]/35">
                {app.name.charAt(0)}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn(
                "border px-1.5 py-0.5 text-[8px] tracking-[0.18em]",
                status === "accepted"
                  ? "border-[#ffaa00]/24 bg-[#ffaa00]/10 text-[#ffd37a]"
                  : "border-[#00aaff]/22 bg-[#00aaff]/10 text-[#8dd8ff]"
              )}>
                {status === "accepted" ? "ACCEPTED" : "IN REVIEW"}
              </span>
              {hasToken ? (
                <span className="border border-[#00ff41]/18 bg-[#00ff41]/10 px-1.5 py-0.5 text-[8px] tracking-[0.18em] text-[#9dffb8]">
                  LIVE TOKEN
                </span>
              ) : null}
            </div>
            <h3 className="mt-2 truncate text-[15px] tracking-[0.14em] text-[#dff6ff] group-hover:text-white">
              {app.name}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] tracking-[0.14em] text-[#00ff41]/38">
              <span>{categoryLabel.toUpperCase()}</span>
              {app.symbol ? <span className="text-[#8dd8ff]">${app.symbol}</span> : null}
              {twitterHandle ? <span>@{twitterHandle}</span> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="border border-[#00aaff]/18 bg-black/50 px-1.5 py-0.5 text-[8px] tracking-[0.16em] text-[#00aaff]/65">
            {categoryLabel.toUpperCase()}
          </span>
        </div>
      </div>

      <p className="mt-3 min-h-[48px] text-[9px] leading-relaxed tracking-[0.13em] text-[#9edfff]/48 line-clamp-3">
        {app.description}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 min-[520px]:grid-cols-4">
        <HackathonMetric
          label={valuation.shortLabel}
          value={formatCurrency(valuation.value)}
        />
        <HackathonMetric label="24H VOL" value={app.volume24hUsd ? formatCurrency(app.volume24hUsd) : "--"} />
        <HackathonMetric label="LIQ" value={app.liquidityUsd ? formatCurrency(app.liquidityUsd) : "--"} />
        <HackathonMetric
          label="24H"
          value={app.priceChange24h !== undefined ? `${changePositive ? "+" : ""}${app.priceChange24h.toFixed(1)}%` : "--"}
          tone={hasPrice ? (changePositive ? "green" : "red") : "muted"}
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#00aaff]/10 pt-3">
        <div className="text-[9px] tracking-[0.14em] text-[#00ff41]/32">
          {hasToken ? shortenAddress(app.tokenAddress) : "HACKATHON APP ONLY"}
        </div>
        <div className="flex items-center gap-1.5 text-[9px] tracking-[0.14em] text-[#00aaff]/55">
          {hasToken ? "OPEN TOKEN PROFILE" : "BAGS APP PROFILE"}
          <ExternalLink className="h-3 w-3" />
        </div>
      </div>
    </Link>
  );
}

function HackathonStatTile({
  label,
  value,
  hint,
  icon,
  accent = "text-[#dff6ff]",
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="border border-[#00aaff]/12 bg-black/40 p-4">
      <div className="flex items-center gap-2 text-[#00aaff]/38">
        {icon}
        <span className="text-[8px] tracking-[0.18em]">{label}</span>
      </div>
      <span className={cn("mt-2 block text-[18px] tracking-[0.08em]", accent)}>{value}</span>
      <span className="mt-2 block text-[9px] tracking-[0.14em] text-[#00ff41]/28">{hint}</span>
    </div>
  );
}

function HackathonMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "green" | "red" | "muted";
}) {
  return (
    <div className="border border-[#00aaff]/10 bg-black/35 p-2">
      <span className="block text-[8px] tracking-[0.16em] text-[#00aaff]/35">{label}</span>
      <span
        className={cn(
          "mt-1 block text-[10px] tracking-[0.14em]",
          tone === "green"
            ? "text-[#00ff41]/75"
            : tone === "red"
              ? "text-[#ff4400]/75"
              : tone === "muted"
                ? "text-[#00aaff]/35"
                : "text-[#dff6ff]/80"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function SpotlightSection({ tokens }: { tokens: NormalizedToken[] }) {
  const combinedVolume = tokens.reduce((sum, token) => sum + (token.volume24hUsd ?? 0), 0);
  const combinedValuation = tokens.reduce((sum, token) => sum + (getValuationMetric(token).value ?? 0), 0);
  const totalTransactions = tokens.reduce((sum, token) => sum + (token.txCount24h ?? 0), 0);
  const pulseProject = pickDailySpotlightPulseProject(tokens);
  const pulseValuation = pulseProject ? getValuationMetric(pulseProject) : null;
  const pulsePositive = (pulseProject?.priceChange24h ?? 0) >= 0;
  const pulseSourceLabels = (pulseProject?.spotlightSources ?? []).slice(0, 3).map(formatSpotlightSourceLabel);
  const pulseReasons = (pulseProject?.spotlightReasons ?? []).slice(0, 3);
  const pulseSubline =
    pulseProject?.creatorDisplay ||
    pulseProject?.providerUsername ||
    pulseProject?.bagsUsername ||
    "BAGS PROJECT";
  const pulseProfile = pulseProject ? getSpotlightCreatorProfile(pulseProject) : null;
  const pulseWebsite = pulseProject?.website ? getDisplayHost(pulseProject.website) : null;
  const pulseFollowers = pulseProject?.creatorFollowers ? formatCompactNum(pulseProject.creatorFollowers) : null;
  const pulseIdentity = pulseProfile?.label ?? "OFFICIAL CREATOR PROFILE PENDING";
  const pulseBuyPressure = formatPulseBuyPressure(pulseProject);

  return (
    <div className="animate-fade-in">
      <div className="mb-6 overflow-hidden border border-[#ffb84d]/22 bg-[linear-gradient(135deg,rgba(255,184,77,0.12),rgba(255,184,77,0.03)_24%,rgba(0,0,0,0.9)_62%,rgba(0,40,22,0.92)_100%)] shadow-[0_0_65px_rgba(255,170,0,0.08)]">
        <div className="relative grid gap-4 p-5 xl:grid-cols-[1.18fr,0.82fr] xl:p-6">
          <div className="pointer-events-none absolute -left-16 top-[-58px] h-44 w-44 rounded-full bg-[#ffaa00]/18 blur-3xl" />
          <div className="pointer-events-none absolute right-[-40px] top-10 h-48 w-48 rounded-full bg-[#00ff41]/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-84px] left-1/3 h-48 w-48 rounded-full bg-[#00aaff]/12 blur-3xl" />

          <div className="relative overflow-hidden border border-[#ffcf7b]/16 bg-[linear-gradient(145deg,rgba(255,180,55,0.09),rgba(255,180,55,0.03)_22%,rgba(0,0,0,0.74)_58%,rgba(0,255,65,0.05)_100%)] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),0_0_30px_rgba(255,170,0,0.05)] xl:p-6">
            <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,214,143,0.95),transparent)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,196,87,0.22),transparent_32%),radial-gradient(circle_at_70%_25%,rgba(0,255,65,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(0,170,255,0.10),transparent_42%)]" />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2 text-[10px] tracking-wider">
                <span className="inline-flex items-center gap-2 border border-[#ffcf7b]/26 bg-black/35 px-2.5 py-1 text-[#ffe4a8] shadow-[0_0_18px_rgba(255,196,87,0.08)]">
                  <Sparkles className="h-3.5 w-3.5 text-[#ffaa00]" />
                  SPOTLIGHT
                </span>
                <span className="inline-flex items-center gap-2 border border-[#00ff41]/18 bg-[#00ff41]/[0.05] px-2.5 py-1 text-[#b9ffc8]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00ff41] shadow-[0_0_10px_rgba(0,255,65,0.9)]" />
                  LIVE CURATION
                </span>
              </div>

              <h2 className="mt-5 max-w-3xl text-[20px] tracking-[0.2em] text-[#fff6dc] sm:text-[24px]" style={{ textShadow: "0 0 18px rgba(255,186,82,0.22)" }}>
                FEATURED BAGS PROJECTS
              </h2>
              <p className="mt-4 max-w-3xl text-[10px] leading-relaxed tracking-[0.16em] text-[#ffe4a8]/78 sm:text-[11px]">
                A premium showcase of standout Bags projects, enriched with live valuation, trading flow, and activity context.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <SpotlightHeroPill label="Curated selection" accent="amber" />
                <SpotlightHeroPill label="Live market data" accent="green" />
                <SpotlightHeroPill label="Dynamic rotation" accent="cyan" />
              </div>
            </div>
          </div>

          <div className="relative grid gap-3">
            <div className="relative overflow-hidden border border-[#ffcf7b]/16 bg-[linear-gradient(145deg,rgba(255,170,0,0.1),rgba(255,170,0,0.02)_28%,rgba(0,0,0,0.8)_64%,rgba(0,170,255,0.06)_100%)] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),0_0_35px_rgba(255,170,0,0.06)]">
              <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,214,143,0.9),transparent)]" />
              <div className="absolute -right-10 top-[-28px] h-28 w-28 rounded-full bg-[#ffaa00]/18 blur-3xl" />
              <div className="absolute -left-8 bottom-[-38px] h-24 w-24 rounded-full bg-[#00ff41]/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[9px] tracking-[0.18em] text-[#ffcf7b]/75">CURRENT PULSE</div>
                  <div className="inline-flex items-center gap-2 border border-[#00ff41]/18 bg-black/35 px-2 py-1 text-[8px] tracking-[0.18em] text-[#b9ffc8]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00ff41] shadow-[0_0_10px_rgba(0,255,65,0.9)]" />
                    DAILY ROTATION
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-4">
                  <div className="relative h-16 w-16 overflow-hidden border border-[#ffcf7b]/20 bg-black/45 shadow-[0_0_24px_rgba(255,170,0,0.08)]">
                    {pulseProject?.image ? (
                      <Image src={pulseProject.image} alt={pulseProject.name ?? "Spotlight project"} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg text-[#ffaa00]/50">
                        {pulseProject?.symbol?.charAt(0) ?? "?"}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] tracking-[0.16em] text-[#fff6dc]" style={{ textShadow: "0 0 12px rgba(255,186,82,0.16)" }}>
                      {pulseProject?.name ?? "Spotlight Feed"}
                    </div>
                    <div className="mt-1 text-[10px] tracking-[0.16em] text-[#00ff41]/46">
                      {pulseProject?.symbol ? `$${pulseProject.symbol}` : "LIVE BAGS PROJECT"}
                    </div>
                    <div className="mt-1 text-[9px] tracking-[0.15em] text-[#b9ffc8]/34">
                      {pulseSubline}
                    </div>
                  </div>
                </div>

                {pulseSourceLabels.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {pulseSourceLabels.map((source) => (
                      <span
                        key={`pulse-${source}`}
                        className="border border-[#00ff41]/14 bg-[linear-gradient(90deg,rgba(0,255,65,0.08),rgba(0,255,65,0.03))] px-2 py-1 text-[8px] tracking-[0.16em] text-[#c8ffd4]"
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <PulseProofTile
                    label="OFFICIAL X"
                    value={pulseIdentity}
                    hint={pulseProfile ? "creator account from Bags" : "official creator profile unavailable"}
                    icon={<X className="h-3.5 w-3.5" />}
                    href={pulseProfile?.href ?? undefined}
                  />
                  <PulseProofTile
                    label="FOLLOWERS"
                    value={pulseFollowers ?? "--"}
                    hint={pulseFollowers ? "creator account reach" : "followers unavailable"}
                    icon={<Users className="h-3.5 w-3.5" />}
                    href={pulseProfile?.href ?? undefined}
                  />
                  <PulseProofTile
                    label="WEBSITE"
                    value={pulseWebsite ?? "--"}
                    hint={pulseWebsite ? "public project site" : "link unavailable"}
                    icon={<Globe2 className="h-3.5 w-3.5" />}
                    href={pulseProject?.website ?? undefined}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <SpotlightMetric label={pulseValuation?.shortLabel ?? "VALUE"} value={formatCurrency(pulseValuation?.value)} />
                  <SpotlightMetric label="24H VOL" value={formatCurrency(pulseProject?.volume24hUsd)} />
                  <SpotlightMetric label="24H TX" value={pulseProject?.txCount24h ? formatCompactNum(pulseProject.txCount24h) : "--"} />
                  <SpotlightMetric
                    label="MOTION"
                    value={pulseProject?.priceChange24h !== undefined ? `${pulsePositive ? "+" : ""}${pulseProject.priceChange24h.toFixed(1)}%` : "--"}
                    tone={pulseProject?.priceChange24h === undefined ? "muted" : pulsePositive ? "green" : "red"}
                  />
                  <SpotlightMetric label="FEES" value={formatCurrency(pulseProject?.lifetimeFees)} />
                  <SpotlightMetric label="FLOW" value={pulseBuyPressure} />
                </div>

                {pulseReasons.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {pulseReasons.map((reason) => (
                      <span
                        key={`pulse-reason-${reason}`}
                        className="border border-[#ffaa00]/12 bg-[#ffaa00]/[0.04] px-2 py-1 text-[8px] tracking-[0.14em] text-[#ffd37a]/80"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={pulseProject ? `/token/${pulseProject.tokenMint}` : "#"}
                    className="inline-flex items-center gap-2 border border-[#ffcf7b]/18 bg-[#ffaa00]/[0.07] px-3 py-2 text-[9px] tracking-[0.16em] text-[#ffe4a8] transition-colors hover:border-[#ffcf7b]/34 hover:bg-[#ffaa00]/[0.12]"
                  >
                    OPEN TOKEN
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  {pulseProfile?.href ? (
                    <a
                      href={pulseProfile.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 border border-[#00ff41]/16 bg-[#00ff41]/[0.05] px-3 py-2 text-[9px] tracking-[0.16em] text-[#c8ffd4] transition-colors hover:border-[#00ff41]/30 hover:bg-[#00ff41]/[0.09]"
                    >
                      OPEN PROFILE
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  {pulseProject?.website ? (
                    <a
                      href={pulseProject.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 border border-[#00aaff]/16 bg-[#00aaff]/[0.05] px-3 py-2 text-[9px] tracking-[0.16em] text-[#9edfff] transition-colors hover:border-[#00aaff]/30 hover:bg-[#00aaff]/[0.09]"
                    >
                      OPEN SITE
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#ffcf7b]/10 pt-3 text-[8px] tracking-[0.18em] text-[#b9ffc8]/34">
                  <span>{tokens.length} PROJECTS</span>
                  <span>{formatCompactUsd(combinedValuation)} VALUE</span>
                  <span>{formatCompactUsd(combinedVolume)} FLOW</span>
                  <span>{formatCompactNum(totalTransactions)} 24H TX</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 stagger-children">
        {tokens.map((token) => (
          <SpotlightCard key={token.tokenMint} token={token} />
        ))}
      </div>
    </div>
  );
}

function SpotlightCard({ token }: { token: NormalizedToken }) {
  const changePositive = (token.priceChange24h ?? 0) >= 0;
  const reasons = token.spotlightReasons ?? [];
  const sources = token.spotlightSources ?? [];
  const valuation = getValuationMetric(token);
  const projectTitle = token.name ?? token.symbol ?? "BAGS PROJECT";
  const projectSubline = token.creatorDisplay || token.providerUsername || token.bagsUsername || "BAGS PROJECT";
  const sourceLabels = sources.slice(0, 3).map(formatSpotlightSourceLabel);

  return (
    <Link
      href={`/token/${token.tokenMint}`}
      className="group relative block overflow-hidden border border-[#ffcf7b]/18 bg-[linear-gradient(145deg,rgba(255,170,0,0.08),rgba(255,170,0,0.02)_26%,rgba(0,0,0,0.86)_64%,rgba(0,255,65,0.05)_100%)] p-[1px] shadow-[0_0_35px_rgba(255,170,0,0.04)] transition-all duration-300 hover:border-[#ffd891]/32 hover:shadow-[0_0_55px_rgba(255,170,0,0.11)] hover:-translate-y-[2px]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,185,72,0.22),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(0,255,65,0.12),transparent_34%),radial-gradient(circle_at_70%_80%,rgba(0,170,255,0.10),transparent_28%)] opacity-90" />
      <div className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(0,0,0,0.62),rgba(0,0,0,0.88))] p-4 sm:p-5">
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,221,148,0.95),transparent)]" />
        <div className="absolute -right-8 top-[-24px] h-24 w-24 rounded-full bg-[#ffaa00]/18 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute -left-8 bottom-[-30px] h-20 w-20 rounded-full bg-[#00ff41]/10 blur-3xl" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="relative h-14 w-14 overflow-hidden border border-[#ffcf7b]/22 bg-black/55 flex-shrink-0 shadow-[0_0_22px_rgba(255,170,0,0.08)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,200,110,0.18),transparent_48%)]" />
              {token.image ? (
                <Image src={token.image} alt={token.name ?? "Token"} fill className="object-cover" unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-[#ffaa00]/45">
                  {token.symbol?.charAt(0) ?? "?"}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 border border-[#ffcf7b]/24 bg-[#ffaa00]/10 px-2 py-1 text-[8px] tracking-[0.18em] text-[#ffe4a8] shadow-[0_0_16px_rgba(255,170,0,0.07)]">
                  <BadgeCheck className="h-3 w-3 text-[#ffaa00]" />
                  FEATURED
                </span>
                {token.spotlightAgeLabel ? (
                  <span className="border border-[#00ff41]/14 bg-[#00ff41]/[0.05] px-2 py-1 text-[8px] tracking-[0.16em] text-[#b9ffc8]">
                    {token.spotlightAgeLabel}
                  </span>
                ) : null}
                {token.symbol ? (
                  <span className="text-[9px] tracking-[0.14em] text-[#ffcf7b]/55">${token.symbol}</span>
                ) : null}
              </div>
              <h3 className="mt-3 truncate text-[16px] tracking-[0.14em] text-[#fff7e3] group-hover:text-white" style={{ textShadow: "0 0 12px rgba(255,170,0,0.12)" }}>
                {projectTitle}
              </h3>
              <p className="mt-1 truncate text-[10px] tracking-[0.14em] text-[#9dffb8]/42">
                {projectSubline}
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 border border-[#00aaff]/18 bg-black/35 px-2 py-1 text-[8px] tracking-[0.18em] text-[#8dd8ff]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00ff41] shadow-[0_0_10px_rgba(0,255,65,0.9)]" />
            LIVE
          </div>
        </div>

        {sourceLabels.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {sourceLabels.map((source) => (
              <span
                key={`${token.tokenMint}-${source}`}
                className="border border-[#00ff41]/14 bg-[linear-gradient(90deg,rgba(0,255,65,0.08),rgba(0,255,65,0.03))] px-2 py-1 text-[8px] tracking-[0.16em] text-[#c8ffd4]"
              >
                {source}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2 min-[500px]:grid-cols-4">
          <SpotlightMetric
            label="24H"
            value={
              token.priceChange24h !== undefined
                ? `${changePositive ? "+" : ""}${token.priceChange24h.toFixed(1)}%`
                : "--"
            }
            tone={token.priceChange24h === undefined ? "muted" : changePositive ? "green" : "red"}
          />
          <SpotlightMetric
            label={valuation.shortLabel}
            value={formatCurrency(valuation.value)}
          />
          <SpotlightMetric
            label="VOLUME"
            value={token.volume24hUsd ? formatCurrency(token.volume24hUsd) : "--"}
          />
          <SpotlightMetric
            label="LIQUIDITY"
            value={token.liquidityUsd ? formatCurrency(token.liquidityUsd) : "--"}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#ffcf7b]/10 pt-3">
          <div className="text-[9px] tracking-[0.14em] text-[#b9ffc8]/34">
            {token.txCount24h
              ? `${token.txCount24h.toLocaleString()} TX / 24H`
              : token.priceUsd
                ? formatCurrency(token.priceUsd, { compact: false, decimals: 6 })
                : "LIVE BAGS PROJECT"}
          </div>
          <div className="inline-flex items-center gap-1.5 text-[9px] tracking-[0.14em] text-[#ffe4a8]/58">
            {token.lifetimeFees
              ? `FEES ${formatCurrency(token.lifetimeFees)}`
              : token.isTrendingNow
                ? "LIVE MOMENTUM"
                : "LIVE PROFILE"}
            <ExternalLink className="h-3 w-3" />
          </div>
        </div>

        {reasons.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {reasons.map((reason) => (
              <span
                key={`${token.tokenMint}-${reason}`}
                className="border border-[#ffaa00]/12 bg-[#ffaa00]/[0.04] px-2 py-1 text-[8px] tracking-[0.14em] text-[#ffd37a]/80"
              >
                {reason}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function SpotlightMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "green" | "red" | "muted";
}) {
  return (
    <div className="overflow-hidden border border-[#ffcf7b]/10 bg-[linear-gradient(180deg,rgba(255,170,0,0.07),rgba(0,0,0,0.62))] p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]">
      <span className="block text-[8px] tracking-[0.16em] text-[#ffcf7b]/38">{label}</span>
      <span
        className={cn(
          "mt-1.5 block text-[10px] tracking-[0.14em]",
          tone === "green"
            ? "text-[#b9ffc8]"
            : tone === "red"
              ? "text-[#ff8a5b]"
              : tone === "muted"
                ? "text-[#ffcf7b]/35"
                : "text-[#fff6dc]/88"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function PulseProofTile({
  label,
  value,
  hint,
  icon,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-[#00ff41]/38">
        {icon}
        <span className="text-[8px] tracking-[0.16em]">{label}</span>
      </div>
      <span className="mt-1.5 block truncate text-[10px] tracking-[0.14em] text-[#dfffe8]">{value}</span>
      <span className="mt-1 block truncate text-[8px] tracking-[0.14em] text-[#9dffb8]/32">{hint}</span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="overflow-hidden border border-[#00ff41]/10 bg-[linear-gradient(180deg,rgba(0,255,65,0.06),rgba(0,0,0,0.62))] p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] transition-colors hover:border-[#00ff41]/26 hover:bg-[linear-gradient(180deg,rgba(0,255,65,0.1),rgba(0,0,0,0.62))]"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="overflow-hidden border border-[#00ff41]/10 bg-[linear-gradient(180deg,rgba(0,255,65,0.06),rgba(0,0,0,0.62))] p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]">
      {content}
    </div>
  );
}

function SpotlightHeroPill({
  label,
  accent,
}: {
  label: string;
  accent: "amber" | "green" | "cyan";
}) {
  const classes =
    accent === "green"
      ? "border-[#00ff41]/18 bg-[#00ff41]/[0.06] text-[#c8ffd4]"
      : accent === "cyan"
        ? "border-[#00aaff]/18 bg-[#00aaff]/[0.06] text-[#9edfff]"
        : "border-[#ffaa00]/20 bg-[#ffaa00]/[0.08] text-[#ffe4a8]";

  return (
    <span className={cn("border px-2.5 py-1 text-[8px] tracking-[0.18em] shadow-[0_0_14px_rgba(255,255,255,0.02)]", classes)}>
      {label}
    </span>
  );
}

function formatSpotlightSourceLabel(source: string) {
  const normalized = source.trim().toUpperCase();

  switch (normalized) {
    case "POOL INDEX":
      return "MARKET";
    case "TRENDING":
      return "LIVE FLOW";
    case "LEADERBOARD":
      return "FEES";
    case "NEW LAUNCH":
      return "NEW";
    default:
      return normalized;
  }
}

function pickDailySpotlightPulseProject(tokens: NormalizedToken[]) {
  if (tokens.length === 0) {
    return null;
  }

  const rotationKey = new Date().toISOString().slice(0, 10);
  const liveCandidates = tokens.filter((token) => token.volume24hUsd || token.txCount24h || token.priceChange24h !== undefined);
  const pool = liveCandidates.length > 0 ? liveCandidates : tokens;

  return [...pool].sort((a, b) => {
    const aHash = getDailyPulseHash(`${rotationKey}:${a.tokenMint}:${a.symbol ?? ""}`);
    const bHash = getDailyPulseHash(`${rotationKey}:${b.tokenMint}:${b.symbol ?? ""}`);

    if (aHash !== bHash) {
      return bHash - aHash;
    }

    return (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0);
  })[0] ?? null;
}

function getDailyPulseHash(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getSpotlightCreatorProfile(token: NormalizedToken) {
  const normalizedCreatorSocials = (token.creators ?? []).map((creator) => ({
    provider: creator.provider?.toLowerCase(),
    providerUsername: normalizeSocialHandle(creator.providerUsername),
    twitterUsername: normalizeSocialHandle(creator.twitterUsername),
  }));

  const twitterHandle =
    normalizedCreatorSocials.find((creator) => creator.twitterUsername)?.twitterUsername ||
    normalizedCreatorSocials.find((creator) => creator.provider === "twitter" && creator.providerUsername)?.providerUsername ||
    normalizeSocialHandle(token.twitterUsername) ||
    (token.provider === "twitter" ? normalizeSocialHandle(token.providerUsername) : undefined);

  if (twitterHandle) {
    return {
      label: `X @${twitterHandle}`,
      href: `https://x.com/${twitterHandle}`,
    };
  }

  const creatorGithubHandle =
    normalizedCreatorSocials.find((creator) => creator.provider === "github" && creator.providerUsername)?.providerUsername;

  if (creatorGithubHandle) {
    return {
      label: `GH @${creatorGithubHandle}`,
      href: `https://github.com/${creatorGithubHandle}`,
    };
  }

  const providerUsername = normalizeSocialHandle(token.providerUsername);

  if (providerUsername && token.provider) {
    const provider = token.provider.toLowerCase();
    if (provider === "github") {
      return {
        label: `GH @${providerUsername}`,
        href: `https://github.com/${providerUsername}`,
      };
    }

    return {
      label: `${provider.toUpperCase()} @${providerUsername}`,
      href: null,
    };
  }

  if (token.bagsUsername) {
    return {
      label: `BAGS @${token.bagsUsername}`,
      href: null,
    };
  }

  return null;
}

function normalizeSocialHandle(handle?: string | null) {
  if (!handle) {
    return undefined;
  }

  return handle.trim().replace(/^@+/, "") || undefined;
}

function getDisplayHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0] || url;
  }
}

function formatPulseBuyPressure(token: NormalizedToken | null) {
  if (!token) {
    return "--";
  }

  const buys = token.buyCount24h ?? 0;
  const sells = token.sellCount24h ?? 0;

  if (buys === 0 && sells === 0) {
    return "--";
  }

  return `${buys}/${sells}`;
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
