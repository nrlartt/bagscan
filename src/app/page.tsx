"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TokenCard } from "@/components/bagscan/TokenCard";
import { TokenTable } from "@/components/bagscan/TokenTable";
import { LiveTicker } from "@/components/bagscan/LiveTicker";
import { ErrorState } from "@/components/bagscan/States";
import { TokenCardSkeleton, TokenTableSkeleton } from "@/components/bagscan/Skeletons";
import { useDiscoverySearch } from "@/components/bagscan/DiscoverySearchContext";
import { useNetwork } from "@/components/bagscan/NetworkContext";
import { RhDiscoverHome } from "@/components/bagscan/RhDiscoverHome";
import { ExploreCharityStrip, FeaturedLaunchesGrid } from "@/components/bagscan/ExploreSections";
import { ExploreFiltersPopover } from "@/components/bagscan/ExploreFiltersPopover";
import { cn } from "@/lib/utils";
import type { ExploreMarketFilters } from "@/lib/explore-filters";
import { hasActiveMarketFilters } from "@/lib/explore-filters";
import type { NormalizedToken } from "@/lib/bags/types";
import type { ExploreLane } from "@/lib/sync";
import { useWatchlist } from "@/hooks/useWatchlist";
import {
    Search,
    SearchX,
    LayoutGrid,
    List,
    type LucideIcon,
    TrendingUp,
    Flame,
    Sparkles,
    CircleDollarSign,
    Bot,
    History,
    ArrowRightLeft,
    Star,
} from "lucide-react";

interface TokensResponse {
  success: boolean;
  data: NormalizedToken[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    tab: string;
    lane?: string;
    totalPools?: number;
  };
}

const EMPTY_TOKENS: NormalizedToken[] = [];

const EXPLORE_LANES: { id: ExploreLane; label: string; icon: LucideIcon }[] = [
    { id: "trending", label: "TRENDING", icon: Flame },
    { id: "movers", label: "MOVERS", icon: TrendingUp },
    { id: "new", label: "NEW", icon: Sparkles },
    { id: "mcap", label: "MCAP", icon: CircleDollarSign },
    { id: "agents", label: "AGENTS", icon: Bot },
    { id: "oldest", label: "OLDEST", icon: History },
    { id: "last_trade", label: "LAST TRADE", icon: ArrowRightLeft },
    { id: "watchlist", label: "WATCHLIST", icon: Star },
];

function buildExploreParams(
  lane: ExploreLane,
  feedPage: number,
  watchlistParam: string,
  marketFilters: ExploreMarketFilters
): string {
  const p = new URLSearchParams();
  p.set("tab", "explore");
  p.set("lane", lane);
  p.set("page", String(feedPage));
  p.set("pageSize", "48");
  if (watchlistParam) p.set("watchlist", watchlistParam);
  if (marketFilters.mcapMin !== undefined) {
    p.set("mcapMin", String(Math.round(marketFilters.mcapMin)));
  }
  if (marketFilters.mcapMax !== undefined) {
    p.set("mcapMax", String(Math.round(marketFilters.mcapMax)));
  }
  if (marketFilters.volMin !== undefined) {
    p.set("volMin", String(Math.round(marketFilters.volMin)));
  }
  if (marketFilters.volMax !== undefined) {
    p.set("volMax", String(Math.round(marketFilters.volMax)));
  }
  return p.toString();
}

function exploreLaneStaleMs(lane: ExploreLane): number {
  if (lane === "last_trade") return 4_000;
  if (lane === "new") return 5_000;
  if (lane === "trending") return 30_000;
  return 8_000;
}

async function fetchTokensResponse(params: string): Promise<TokensResponse> {
  const controller = new AbortController();
  const timeoutMs = (() => {
    if (params.includes("search=")) return 25_000;
    if (params.includes("tab=new")) return 40_000;
    return 60_000;
  })();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
  const { network } = useNetwork();
  if (network === "robinhood") {
    return <RhDiscoverHome />;
  }
  return <SolanaDiscoverHome />;
}

function SolanaDiscoverHome() {
  const { debouncedSearch } = useDiscoverySearch();
  const [lane, setLane] = useState<ExploreLane>("new");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [feedPage, setFeedPage] = useState(1);
  const [marketFilters, setMarketFilters] = useState<ExploreMarketFilters>({});
  const skipScrollOnce = useRef(true);
  const { watchlistParam, toggle, has } = useWatchlist();

  const isSearching = debouncedSearch.length >= 2;

  // A new lane, query or filter set is a new result list — reset pagination during
  // render rather than in an effect, which would cost an extra paint.
  const feedResetKey = `${lane}|${isSearching}|${JSON.stringify(marketFilters)}`;
  const [lastFeedResetKey, setLastFeedResetKey] = useState(feedResetKey);
  if (lastFeedResetKey !== feedResetKey) {
    setLastFeedResetKey(feedResetKey);
    setFeedPage(1);
  }

  const queryClient = useQueryClient();

  const prefetchExploreLane = useCallback(
    (targetLane: ExploreLane) => {
      if (isSearching) return;
      if (hasActiveMarketFilters(marketFilters)) return;
      if (targetLane === "watchlist" && !watchlistParam) return;
      const p = buildExploreParams(targetLane, 1, watchlistParam, marketFilters);
      void queryClient.prefetchQuery({
        queryKey: ["tokens", p],
        queryFn: () => fetchTokensResponse(p),
        staleTime: exploreLaneStaleMs(targetLane),
        gcTime: 10 * 60 * 1000,
      });
    },
    [isSearching, marketFilters, queryClient, watchlistParam]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isSearching || hasActiveMarketFilters(marketFilters)) return;
    if (feedPage !== 1) return;

    const run = () => {
      for (const { id } of EXPLORE_LANES) {
        if (id === "watchlist" && !watchlistParam) continue;
        prefetchExploreLane(id);
      }
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(run, { timeout: 1200 });
      return () => window.cancelIdleCallback(idleId);
    }
    const t = setTimeout(run, 100);
    return () => clearTimeout(t);
  }, [isSearching, marketFilters, watchlistParam, feedPage, prefetchExploreLane]);

  const exploreParams = useMemo(
    () => buildExploreParams(lane, feedPage, watchlistParam, marketFilters),
    [lane, feedPage, watchlistParam, marketFilters]
  );

  const searchParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("search", debouncedSearch);
    p.set("pageSize", "48");
    return p.toString();
  }, [debouncedSearch]);

  const params = isSearching ? searchParams : exploreParams;

  const { data, isLoading, error, refetch } = useQuery<TokensResponse>({
    queryKey: ["tokens", params],
    queryFn: () => fetchTokensResponse(params),
    placeholderData: (previousData) => previousData,
    refetchInterval: isSearching
      ? false
      : lane === "last_trade"
        ? 8_000
        : lane === "new"
          ? 12_000
          : lane === "trending"
            ? 45_000
            : 20_000,
    staleTime: isSearching
      ? 0
      : lane === "last_trade"
        ? 4_000
        : lane === "new"
          ? 5_000
          : lane === "trending"
            ? 30_000
            : 8_000,
    gcTime: 10 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnWindowFocus: true,
  });

  const trendingSpotlightQuery = useQuery<TokensResponse>({
    queryKey: ["tokens", "spotlight-trending", "tab", "trending"],
    queryFn: () =>
      fetchTokensResponse("tab=trending&page=1&pageSize=48"),
    enabled: !isSearching,
    staleTime: 20_000,
    refetchInterval: !isSearching ? 20_000 : false,
  });

  const moversStripQuery = useQuery<TokensResponse>({
    queryKey: ["tokens", "strip-movers"],
    queryFn: () =>
      fetchTokensResponse("tab=explore&lane=movers&page=1&pageSize=30"),
    enabled: !isSearching,
    staleTime: 20_000,
  });

  const latestStripParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("tab", "explore");
    p.set("lane", "new");
    p.set("page", "1");
    p.set("pageSize", "48");
    return p.toString();
  }, []);

  const needsLatestStrip = !isSearching && lane === "new" && feedPage !== 1;

  const { data: latestStripData } = useQuery<TokensResponse>({
    queryKey: ["tokens", latestStripParams],
    queryFn: () => fetchTokensResponse(latestStripParams),
    enabled: needsLatestStrip,
    placeholderData: (previous) => previous,
    refetchInterval: needsLatestStrip ? 12_000 : false,
    staleTime: 5_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnWindowFocus: true,
  });

  const meta = data?.meta;
  const totalPools = meta?.totalPools;
  const tokens = (data?.data as NormalizedToken[] | undefined) ?? EMPTY_TOKENS;

  const trendingSpotlightTokens =
    (trendingSpotlightQuery.data?.data as NormalizedToken[] | undefined) ?? EMPTY_TOKENS;

  /** Hero row: preserve DexScreener Bags trending order (trendingScoreH6), same as their /solana/bags board. */
  const trendingSpotlightHead = useMemo(
    () => trendingSpotlightTokens.slice(0, 4),
    [trendingSpotlightTokens]
  );

  const stripTokens =
    (moversStripQuery.data?.data as NormalizedToken[] | undefined) ?? EMPTY_TOKENS;

  const latestPageOneTokens =
    !isSearching && lane === "new" && feedPage === 1 ? tokens : EMPTY_TOKENS;
  const latestStripTokens =
    (latestStripData?.data as NormalizedToken[] | undefined) ?? EMPTY_TOKENS;
  const tickerTokens = !isSearching
    ? lane === "new"
      ? feedPage === 1
        ? latestPageOneTokens
        : latestStripTokens
      : tokens.slice(0, 36)
    : EMPTY_TOKENS;

  useEffect(() => {
    if (skipScrollOnce.current) {
      skipScrollOnce.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [feedPage]);

  const emptyWatchlist = !isSearching && lane === "watchlist" && tokens.length === 0;

    return (
    <div className="mx-auto w-full min-w-0 max-w-[90rem] px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 border-b border-[#00ff41]/15 pb-5 animate-fade-in sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[15px] tracking-[0.14em] text-[#00ff41] sm:text-base" style={{ textShadow: "0 0 10px rgba(0,255,65,0.28)" }}>
            BAGSCAN
          </h1>
          <p className="mt-1 max-w-xl text-[10px] leading-relaxed tracking-[0.12em] text-[#00ff41]/42">
            Discover Bags-native tokens: Dex trending (24H), movers, new launches, and watchlist — enriched with Dex data and the BagScan pool index.
          </p>
          <a
            href="https://bags.fm/BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex text-[9px] tracking-[0.14em] text-[#00ff41]/35 transition-colors hover:text-[#00ff41]/65"
          >
            NATIVE <span className="mx-1 text-[#00ff41]/55">$SCAN</span> · TRADE ON BAGS
          </a>
        </div>
        {totalPools ? (
          <div className="shrink-0 text-right text-[10px] tracking-[0.18em] text-[#00ff41]/38">
            <span className="text-[#00ff41]/55">{totalPools.toLocaleString()}</span>
            <span className="ml-2 text-[#00ff41]/30">INDEXED</span>
          </div>
        ) : null}
      </div>

      {!isSearching ? (
        <>
          <ExploreCharityStrip tokens={stripTokens} fallbackLabel />
          <FeaturedLaunchesGrid tokens={trendingSpotlightHead} />
        </>
      ) : null}

      {!isSearching && (
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 px-0.5 text-[10px] tracking-[0.22em] text-[#00ff41]/40">EXPLORE COINS</p>
            <div className="-mx-1 flex max-w-full flex-nowrap gap-1 overflow-x-auto overscroll-x-contain px-1 pb-1 [-webkit-overflow-scrolling:touch] scrollbar-thin">
              {EXPLORE_LANES.map(({ id, label, icon }) => (
                <ExploreLanePill
                  key={id}
                  active={lane === id}
                  label={label}
                  icon={icon}
                  onClick={() => setLane(id)}
                  onWarm={() => prefetchExploreLane(id)}
                />
              ))}
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 self-start sm:mt-6 lg:w-auto lg:flex-nowrap">
            <ExploreFiltersPopover applied={marketFilters} onApply={setMarketFilters} />
            <div className="flex overflow-hidden rounded-lg border border-[#00ff41]/15">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-2 transition-colors",
                  viewMode === "grid" ? "bg-[#00ff41]/10 text-[#00ff41]" : "text-[#00ff41]/30 hover:text-[#00ff41]/60"
                )}
                aria-pressed={viewMode === "grid"}
              >
                <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden text-[10px] font-medium tracking-wide sm:inline">GRID</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex items-center gap-1.5 border-l border-[#00ff41]/15 px-2.5 py-2 transition-colors",
                  viewMode === "table" ? "bg-[#00ff41]/10 text-[#00ff41]" : "text-[#00ff41]/30 hover:text-[#00ff41]/60"
                )}
                aria-pressed={viewMode === "table"}
              >
                <List className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden text-[10px] font-medium tracking-wide sm:inline">TABLE</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {!isSearching && (
        <LiveTicker tokens={tickerTokens} mode={lane === "new" ? "latest" : "trending"} />
      )}

      {isSearching && (
        <div className="flex items-center gap-2 text-[10px] text-[#00ff41]/40 mb-5 tracking-wider">
          <Search className="w-3.5 h-3.5 text-[#00ff41]/50" />
          {isLoading ? (
            "SEARCHING..."
          ) : (
            <>
              FOUND <span className="text-[#00ff41]">{tokens.length}</span> RESULTS FOR &quot;
              {debouncedSearch}&quot;
            </>
          )}
        </div>
      )}

      {isLoading ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <TokenCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <TokenTableSkeleton />
        )
      ) : error ? (
        <ErrorState error={String(error)} onRetry={() => refetch()} />
      ) : emptyWatchlist ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h3 className="text-sm text-[#00ff41]/50 tracking-[0.15em]">WATCHLIST EMPTY</h3>
          <p className="text-[10px] text-[#00ff41]/25 mt-2 max-w-md tracking-wider">
            STAR TOKENS ON CARDS TO ADD THEM HERE. STORED LOCALLY IN THIS BROWSER.
          </p>
        </div>
      ) : tokens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <SearchX className="w-10 h-10 text-[#00ff41]/20 mb-4" />
          <h3 className="text-sm text-[#00ff41]/50 tracking-[0.15em]">
            {isSearching ? "NO TOKENS FOUND" : "NO RESULTS FOR THIS RAIL"}
          </h3>
          <p className="text-[10px] text-[#00ff41]/25 mt-2 max-w-md tracking-wider">
            {isSearching ? "TRY A DIFFERENT QUERY OR PASTE A FULL MINT ADDRESS." : "TRY ANOTHER TAB OR RETRY."}
          </p>
          {!isSearching && (
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 text-[10px] tracking-wider border border-[#00ff41]/30 text-[#00ff41]/60 hover:text-[#00ff41] hover:bg-[#00ff41]/5 transition-colors"
            >
              RETRY NOW
            </button>
          )}
        </div>
      ) : (
        <>
          {viewMode === "table" ? (
            <div className="animate-fade-in overflow-hidden border border-[#00ff41]/15 bg-black/60">
              <div className="border-b border-[#00ff41]/12 px-4 py-3 text-[10px] tracking-[0.18em] text-[#00ff41]/45">
                {lane.toUpperCase().replace(/_/g, " ")} · TABLE
              </div>
              <TokenTable tokens={tokens} />
            </div>
          ) : (
            <div
              className={cn(
                "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-fade-in",
                lane !== "new" && "stagger-children"
              )}
            >
              {tokens.map((t, i) => (
                <TokenCard
                  key={t.tokenMint}
                  token={t}
                  index={i}
                  surfaceVariant={lane === "movers" || lane === "trending" ? "trending" : "default"}
                  showSparkline={!isSearching && viewMode === "grid"}
                  watchlisted={has(t.tokenMint)}
                  exploreLane={isSearching ? undefined : lane}
                  onToggleWatchlist={
                    isSearching
                      ? undefined
                      : () => {
                          toggle(t.tokenMint);
                        }
                  }
                />
              ))}
            </div>
          )}
          {meta && meta.totalPages > 1 ? (
            <FeedPagination page={feedPage} totalPages={meta.totalPages} onPageChange={setFeedPage} />
          ) : null}
        </>
      )}
    </div>
  );
}

function ExploreLanePill({
    active,
    label,
    icon: Icon,
    onClick,
    onWarm,
}: {
    active: boolean;
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    onWarm?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            onMouseEnter={onWarm}
            onFocus={onWarm}
            className={cn(
                "inline-flex shrink-0 items-center gap-1.5 border px-2 py-1.5 text-[8px] tracking-[0.14em] transition-all duration-200 sm:px-2.5 sm:text-[9px]",
                active
                    ? "border-[#00ff41]/55 bg-[#00ff41]/12 text-[#00ff41] ring-1 ring-[#00ff41]/25"
                    : "border-[#00ff41]/12 bg-black/50 text-[#00ff41]/40 hover:border-[#00ff41]/28 hover:text-[#00ff41]/70"
            )}
            style={active ? { textShadow: "0 0 6px rgba(0,255,65,0.35)" } : undefined}
        >
            <Icon className="h-3 w-3 shrink-0 opacity-90 sm:h-3.5 sm:w-3.5" aria-hidden />
            {label}
        </button>
    );
}

function FeedPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <nav
      className="mt-6 flex flex-wrap items-center justify-center gap-4 border border-[#00ff41]/12 bg-black/40 px-4 py-3"
      aria-label="Feed pages"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className={cn(
          "border px-3 py-1.5 text-[9px] tracking-[0.16em] transition-colors disabled:opacity-25",
          "border-[#00ff41]/25 text-[#00ff41]/70 hover:border-[#00ff41]/45 hover:bg-[#00ff41]/8 disabled:pointer-events-none"
        )}
      >
        PREV
      </button>
      <span className="text-[9px] tracking-[0.2em] text-[#00ff41]/45">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className={cn(
          "border px-3 py-1.5 text-[9px] tracking-[0.16em] transition-colors disabled:opacity-25",
          "border-[#00ff41]/25 text-[#00ff41]/70 hover:border-[#00ff41]/45 hover:bg-[#00ff41]/8 disabled:pointer-events-none"
        )}
      >
        NEXT
      </button>
    </nav>
  );
}
