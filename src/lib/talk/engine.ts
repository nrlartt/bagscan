import {
    getBagsPoolInfo,
    getBagsPools,
    getClaimablePositions,
    getClaimStatsDetailed,
    getCreatorsV3,
    getHackathonApps,
    getLifetimeFees,
    type HackathonApp,
} from "@/lib/bags/client";
import type { BagsClaimStatEntry, BagsCreatorV3, BagsPool } from "@/lib/bags/types";
import type { TalkAction, TalkCard, TalkContext, TalkMetric, TalkReply, TalkIntent } from "@/lib/talk/types";
import { formatCurrency, formatNumber, getValuationMetric, shortenAddress } from "@/lib/utils";

const BASE58_MINT_REGEX = /\b[1-9A-HJ-NP-Za-km-z]{32,48}\b/;
const TOKEN_SYMBOL_REGEX = /\$([A-Za-z0-9._-]{2,20})/;
const LAMPORTS_PER_SOL = 1_000_000_000;
const POOLS_TTL_MS = 60_000;
const HACKATHON_TTL_MS = 5 * 60_000;

const QUERY_STOP_WORDS = new Set([
    "a",
    "about",
    "analyze",
    "bags",
    "buy",
    "check",
    "copilot",
    "created",
    "create",
    "deploy",
    "discover",
    "for",
    "from",
    "has",
    "have",
    "help",
    "hot",
    "how",
    "in",
    "is",
    "launch",
    "leaderboard",
    "me",
    "most",
    "much",
    "many",
    "my",
    "of",
    "on",
    "portfolio",
    "right",
    "show",
    "talk",
    "tell",
    "the",
    "this",
    "that",
    "it",
    "top",
    "to",
    "token",
    "tokens",
    "trade",
    "trending",
    "creator",
    "does",
    "did",
    "give",
    "get",
    "earned",
    "earn",
    "current",
    "currently",
    "now",
    "what",
    "which",
    "who",
    "with",
]);

const TRAILING_TOKEN_TERMS_REGEX = /\b(token|coin|project|app|pool)\b$/i;
const TRAILING_BAGS_CONTEXT_REGEX = /\b(on|in|from)\s+bags(?:\s+platform)?$/i;
const QUOTED_TOKEN_REGEX = /["'`“”]([^"'`“”]{2,90})["'`“”]/;

interface OfficialPoolView {
    tokenMint: string;
    poolAddress?: string;
    name?: string;
    symbol?: string;
    image?: string;
    description?: string;
    website?: string;
    twitter?: string;
    projectTwitterHandle?: string;
    projectTwitterFollowers?: number;
    telegram?: string;
    creatorWallet?: string;
    creatorDisplay?: string;
    creatorUsername?: string;
    creatorPfp?: string;
    provider?: string;
    providerUsername?: string;
    priceUsd?: number;
    marketCap?: number;
    fdvUsd?: number;
    liquidityUsd?: number;
    volume24hUsd?: number;
    totalSupply?: number;
    royaltyBps?: number;
    createdAt?: string;
}

interface ParsedPrompt {
    cleaned: string;
    lowered: string;
    intent: TalkIntent;
    tokenQuery?: string;
    referencesActiveToken?: boolean;
    leaderboardScope?: "market-cap" | "volume";
    hackathonScope?: "all" | "accepted" | "ai-agents";
}

interface OfficialHackathonFeed {
    apps: HackathonApp[];
    totalItems: number;
    acceptedOverall: number;
}

let officialPoolsCache: { pools: OfficialPoolView[]; ts: number } | null = null;
let officialHackathonCache: { feed: OfficialHackathonFeed; ts: number } | null = null;

function safeNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeHandle(value?: string) {
    if (!value) return undefined;
    return value
        .replace(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//i, "")
        .replace(/^@+/, "")
        .split(/[/?#]/)[0]
        ?.trim() || undefined;
}

function normalizeSearchKey(value?: string) {
    if (!value) return "";
    return value.toLowerCase().replace(/^[@$]+/, "").replace(/[^a-z0-9]/g, "");
}

function normalizeExternalUrl(value?: string) {
    if (!value) return undefined;
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function normalizeWebsiteHost(value?: string) {
    const href = normalizeExternalUrl(value);
    if (!href) return undefined;

    try {
        return new URL(href).hostname.replace(/^www\./i, "");
    } catch {
        return undefined;
    }
}

function lamportsToSol(value?: string | number | null) {
    if (value === null || value === undefined) return undefined;
    try {
        const lamports = typeof value === "string" ? BigInt(value) : BigInt(Math.floor(value));
        return Number(lamports) / LAMPORTS_PER_SOL;
    } catch {
        return undefined;
    }
}

function formatSolAmount(value: number | undefined) {
    if (value === undefined || !Number.isFinite(value)) return "—";
    return `${value.toFixed(value >= 10 ? 2 : 4)} SOL`;
}

function truncate(text: string | undefined, max = 140) {
    if (!text) return undefined;
    const trimmed = text.trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function metric(label: string, value: string, tone?: TalkMetric["tone"]): TalkMetric {
    return { label, value, tone };
}

function action(label: string, href: string, tone: TalkAction["tone"] = "default"): TalkAction {
    return { label, href, tone };
}

function formatAgeLabel(value?: string) {
    if (!value) return "Official pool";
    const hours = Math.max(0, (Date.now() - new Date(value).getTime()) / 3_600_000);
    if (!Number.isFinite(hours)) return "Official pool";
    if (hours < 1) return "<1h";
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
}

function dedupeNonEmpty(values: Array<string | undefined>) {
    const seen = new Set<string>();
    const output: string[] = [];

    for (const value of values) {
        const cleaned = value?.trim();
        if (!cleaned) continue;
        const key = cleaned.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(cleaned);
    }

    return output;
}

function cleanupTokenPhrase(value: string) {
    let cleaned = value
        .trim()
        .replace(/^[("'`“”\[]+/, "")
        .replace(/[)"'`“”\].,!?;:]+$/, "")
        .replace(/\s+/g, " ");

    let changed = true;
    while (changed && cleaned) {
        const next = cleaned
            .replace(/^(the|a|an)\s+/i, "")
            .replace(TRAILING_BAGS_CONTEXT_REGEX, "")
            .replace(TRAILING_TOKEN_TERMS_REGEX, "")
            .trim();

        changed = next !== cleaned;
        cleaned = next;
    }

    return cleaned || undefined;
}

function extractStructuredTokenQuery(message: string) {
    const quoted = message.match(QUOTED_TOKEN_REGEX)?.[1];
    if (quoted) {
        return cleanupTokenPhrase(quoted);
    }

    const patterns = [
        /\bwho\s+created\s+(.+?)(?:\?|$)/i,
        /\b(?:what|how\s+much)\s+fees?\s+has\s+(.+?)(?:\s+earned|\?|$)/i,
        /\b(?:what|how\s+much)\s+has\s+(.+?)(?:\s+earned|\?|$)/i,
        /\bcreator\s+of\s+(.+?)(?:\?|$)/i,
        /\b(?:tell\s+me\s+about|about)\s+(.+?)(?:\?|$)/i,
        /\b(?:analyze|analyse|inspect|check)\s+(.+?)(?:\?|$)/i,
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern)?.[1];
        if (!match) continue;
        const cleaned = cleanupTokenPhrase(match);
        if (cleaned) return cleaned;
    }

    return undefined;
}

function parseTokenQuery(message: string) {
    const mintMatch = message.match(BASE58_MINT_REGEX)?.[0];
    if (mintMatch) return mintMatch;

    const symbolMatch = message.match(TOKEN_SYMBOL_REGEX)?.[1];
    if (symbolMatch) return symbolMatch;

    const structured = extractStructuredTokenQuery(message);
    if (structured) return structured;

    const stripped = cleanupTokenPhrase(
        message
            .replace(/[^A-Za-z0-9.\-_ ]/g, " ")
            .split(/\s+/)
            .map((part) => part.trim())
            .filter(Boolean)
            .filter((part) => !QUERY_STOP_WORDS.has(part.toLowerCase()))
            .slice(0, 6)
            .join(" ")
    );

    if (!stripped) return undefined;
    return stripped;
}

function referencesActiveToken(lowered: string) {
    return /\b(this token|that token|this coin|that coin|this project|that project|this one|that one|it)\b/i.test(lowered);
}

function isTokenSpecificQuestion(lowered: string) {
    return /\b(who created|creator|created by|fees|fee split|fee-share|claim stats|claimers|claimed|website|telegram|twitter|x account|x handle|tell me about|analyze|analyse|about this|about that)\b/i.test(lowered);
}

function parsePrompt(message: string): ParsedPrompt {
    const cleaned = message.trim();
    const lowered = cleaned.toLowerCase();
    const tokenQuery = parseTokenQuery(cleaned);
    const refersToActiveToken = referencesActiveToken(lowered);
    const tokenSpecificQuestion = isTokenSpecificQuestion(lowered);
    const looksLikeDirectTokenLookup =
        Boolean(tokenQuery) &&
        cleaned.split(/\s+/).filter(Boolean).length <= 3 &&
        !/\b(hackathon|launch|leaderboard|market|volume|accepted|ai agents|wallet|claimable)\b/i.test(lowered);
    const asksForPopularToken = /\b(most popular|popular token|top token|top project|what.?s hot|what is hot|right now|most active|highest volume)\b/i.test(lowered);
    const asksForMarketCapBoard = /\b(highest market cap|largest market cap|biggest market cap|top market cap|market cap board)\b/i.test(lowered);

    if (/\b(launch|deploy|create token|token launch)\b/i.test(lowered)) {
        return { cleaned, lowered, intent: "launch", tokenQuery };
    }

    if (/\b(alert|alerts|notify|telegram|browser push|notification)\b/i.test(lowered)) {
        return { cleaned, lowered, intent: "alerts", tokenQuery };
    }

    if (/\b(portfolio|pnl|holdings|claimable positions|claimable|wallet)\b/i.test(lowered)) {
        return { cleaned, lowered, intent: "portfolio", tokenQuery };
    }

    if (/\b(trade|buy|sell|swap)\b/i.test(lowered)) {
        return { cleaned, lowered, intent: "trade", tokenQuery };
    }

    if (/\bleaderboard\b/i.test(lowered)) {
        return {
            cleaned,
            lowered,
            intent: "leaderboard",
            tokenQuery,
            leaderboardScope: /\bvolume\b/i.test(lowered) ? "volume" : "market-cap",
        };
    }

    if (asksForMarketCapBoard) {
        return {
            cleaned,
            lowered,
            intent: "leaderboard",
            tokenQuery,
            leaderboardScope: "market-cap",
        };
    }

    if (/\b(hackathon|accepted|ai agents|app store)\b/i.test(lowered)) {
        return {
            cleaned,
            lowered,
            intent: "hackathon",
            tokenQuery,
            hackathonScope: /\bai agents\b/i.test(lowered)
                ? "ai-agents"
                : /\baccepted\b/i.test(lowered)
                    ? "accepted"
                    : "all",
        };
    }

    if (/\b(new launch|new launches|fresh|recent launches|recent deploys)\b/i.test(lowered)) {
        return { cleaned, lowered, intent: "new-launches", tokenQuery };
    }

    if (/\bspotlight\b/i.test(lowered)) {
        return { cleaned, lowered, intent: "spotlight", tokenQuery };
    }

    if (asksForPopularToken || /\b(alpha|trending|featured|hot|market flow|market board)\b/i.test(lowered)) {
        return { cleaned, lowered, intent: "market", tokenQuery };
    }

    if (tokenSpecificQuestion && (tokenQuery || refersToActiveToken)) {
        return {
            cleaned,
            lowered,
            intent: "token",
            tokenQuery,
            referencesActiveToken: refersToActiveToken,
        };
    }

    if (looksLikeDirectTokenLookup && tokenQuery) {
        return {
            cleaned,
            lowered,
            intent: "token",
            tokenQuery,
        };
    }

    if (tokenQuery && (/\b(about|analyze|analyse|check|token|project|who created|creator)\b/i.test(lowered) || TOKEN_SYMBOL_REGEX.test(cleaned) || BASE58_MINT_REGEX.test(cleaned))) {
        return { cleaned, lowered, intent: "token", tokenQuery };
    }

    return { cleaned, lowered, intent: "overview", tokenQuery };
}

function mapOfficialPool(raw: BagsPool): OfficialPoolView | null {
    if (!raw.tokenMint) return null;

    return {
        tokenMint: raw.tokenMint,
        poolAddress: raw.poolAddress ?? undefined,
        name: raw.name ?? undefined,
        symbol: raw.symbol ?? undefined,
        image: raw.image ?? undefined,
        description: raw.description ?? undefined,
        website: raw.website ?? undefined,
        twitter: raw.twitter ?? undefined,
        projectTwitterHandle: raw.projectTwitterHandle ?? undefined,
        projectTwitterFollowers: safeNumber(raw.projectTwitterFollowers),
        telegram: raw.telegram ?? undefined,
        creatorWallet: raw.creatorWallet ?? undefined,
        creatorDisplay: raw.creatorDisplayName ?? raw.creatorUsername ?? undefined,
        creatorUsername: raw.creatorUsername ?? undefined,
        creatorPfp: raw.creatorPfp ?? undefined,
        provider: raw.provider ?? undefined,
        providerUsername: raw.providerUsername ?? undefined,
        priceUsd: safeNumber(raw.tokenPriceUsd ?? raw.tokenPrice),
        marketCap: safeNumber(raw.marketCap),
        fdvUsd: safeNumber(raw.fdvUsd ?? raw.fdv),
        liquidityUsd: safeNumber(raw.liquidityUsd ?? raw.liquidity),
        volume24hUsd: safeNumber(raw.volume24hUsd ?? raw.volume24h),
        totalSupply: safeNumber(raw.totalSupply),
        royaltyBps: safeNumber(raw.royaltyBps),
        createdAt:
            typeof (raw as { createdAt?: unknown }).createdAt === "string"
                ? (raw as { createdAt: string }).createdAt
                : undefined,
    };
}

async function loadOfficialPools() {
    if (officialPoolsCache && Date.now() - officialPoolsCache.ts < POOLS_TTL_MS) {
        return officialPoolsCache.pools;
    }

    const rawPools = await getBagsPools();
    const pools = rawPools.map(mapOfficialPool).filter((pool): pool is OfficialPoolView => pool !== null);
    officialPoolsCache = { pools, ts: Date.now() };
    return pools;
}

async function loadOfficialHackathonFeed(): Promise<OfficialHackathonFeed> {
    if (officialHackathonCache && Date.now() - officialHackathonCache.ts < HACKATHON_TTL_MS) {
        return officialHackathonCache.feed;
    }

    const firstPage = await getHackathonApps(1);
    const remaining = await Promise.all(
        Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) => getHackathonApps(index + 2))
    );
    const apps = [firstPage, ...remaining].flatMap((page) => page.applications);
    const feed = {
        apps,
        totalItems: firstPage.totalItems || apps.length,
        acceptedOverall: apps.filter((app) => (app.status ?? "").trim().toLowerCase() === "accepted").length,
    };
    officialHackathonCache = { feed, ts: Date.now() };
    return feed;
}

function getBagsTokenHref(tokenMint: string) {
    return `https://bags.fm/${tokenMint}`;
}

function getHackathonAppHref(uuid: string) {
    return `https://bags.fm/apps/${uuid}`;
}

function buildOfficialPoolCard(pool: OfficialPoolView, eyebrow?: string): TalkCard {
    const valuation = getValuationMetric({ marketCap: pool.marketCap, fdvUsd: pool.fdvUsd });
    const metrics: TalkMetric[] = [];

    if (valuation.value !== undefined) {
        metrics.push(metric(valuation.shortLabel, formatCurrency(valuation.value), "info"));
    }
    if (pool.volume24hUsd !== undefined) {
        metrics.push(metric("24H VOL", formatCurrency(pool.volume24hUsd), "info"));
    }
    if (pool.liquidityUsd !== undefined) {
        metrics.push(metric("LIQ", formatCurrency(pool.liquidityUsd), "default"));
    }
    if (pool.priceUsd !== undefined) {
        metrics.push(metric("PRICE", formatCurrency(pool.priceUsd, { compact: false, decimals: 4 }), "info"));
    }

    return {
        id: pool.tokenMint,
        title: pool.name ?? pool.symbol ?? shortenAddress(pool.tokenMint, 6),
        subtitle: [
            pool.symbol ? `$${pool.symbol}` : shortenAddress(pool.tokenMint, 5),
            normalizeHandle(pool.provider === "twitter" ? pool.providerUsername : pool.twitter)
                ? `@${normalizeHandle(pool.provider === "twitter" ? pool.providerUsername : pool.twitter)}`
                : pool.creatorDisplay,
        ].filter(Boolean).join(" • "),
        eyebrow,
        description: truncate(pool.description) ?? "Official BAGS pool data",
        href: getBagsTokenHref(pool.tokenMint),
        metrics: metrics.slice(0, 4),
    };
}

function buildHackathonCard(app: HackathonApp, eyebrow?: string): TalkCard {
    const twitterHandle = normalizeHandle(app.twitterUrl) ?? app.twitterUser?.username ?? undefined;
    const voteScore = (app.upvotes ?? 0) - (app.downvotes ?? 0);
    const followers = app.twitterUser?.public_metrics?.followers_count;

    return {
        id: app.uuid,
        title: app.name,
        subtitle: [app.category, twitterHandle ? `@${twitterHandle}` : undefined].filter(Boolean).join(" • "),
        eyebrow,
        description: truncate(app.description, 132) ?? "Official BAGS Hackathon application",
        href: getHackathonAppHref(app.uuid),
        metrics: [
            metric("STATUS", (app.status ?? "in review").toUpperCase(), (app.status ?? "").toLowerCase() === "accepted" ? "positive" : "warning"),
            metric("VOTES", formatNumber(voteScore, false), "default"),
            metric("UP", formatNumber(app.upvotes ?? 0, false), "positive"),
            metric("FOLLOWERS", followers !== undefined ? formatNumber(followers) : "—", "info"),
        ],
    };
}

interface PoolMatch {
    pool: OfficialPoolView;
    textScore: number;
    tieScore: number;
}

interface OfficialPoolCandidate {
    pool: OfficialPoolView;
    textScore: number;
    tieScore: number;
    source: "pool" | "hackathon";
}

interface OfficialPoolResolution {
    pool: OfficialPoolView | null;
    candidates: OfficialPoolView[];
    confidence: "high" | "medium" | "low";
}

function scoreAlias(alias: string, rawQuery: string, normalizedQuery: string) {
    const rawAlias = alias.toLowerCase().trim();
    const normalizedAlias = normalizeSearchKey(alias);
    if (!rawAlias || !normalizedAlias || !normalizedQuery) return 0;

    let score = 0;

    if (rawAlias === rawQuery || normalizedAlias === normalizedQuery) score += 7_500;
    if (rawAlias.startsWith(rawQuery) || normalizedAlias.startsWith(normalizedQuery)) score += 2_000;
    if (rawAlias.endsWith(rawQuery) || normalizedAlias.endsWith(normalizedQuery)) score += 1_700;
    if (rawAlias.includes(rawQuery) || normalizedAlias.includes(normalizedQuery)) score += 1_000;

    const queryTerms = rawQuery
        .split(/\s+/)
        .map((term) => normalizeSearchKey(term))
        .filter(Boolean);

    if (queryTerms.length > 1) {
        const coveredTerms = queryTerms.filter((term) => normalizedAlias.includes(term)).length;
        if (coveredTerms > 0) {
            score += coveredTerms * 420;
        }
        if (coveredTerms === queryTerms.length) {
            score += 900;
        }
    }

    return score;
}

function getOfficialPoolAliases(pool: OfficialPoolView) {
    return dedupeNonEmpty([
        pool.tokenMint,
        pool.symbol,
        pool.name,
        pool.projectTwitterHandle,
        normalizeHandle(pool.twitter),
        pool.providerUsername,
        pool.creatorDisplay,
        pool.creatorUsername,
        normalizeWebsiteHost(pool.website),
    ]);
}

function scorePoolCandidate(pool: OfficialPoolView, query: string): PoolMatch {
    const rawQuery = query.toLowerCase().trim().replace(/^\$/, "");
    const normalizedQuery = normalizeSearchKey(rawQuery);
    const aliases = getOfficialPoolAliases(pool);
    const textScore = aliases.reduce((best, alias) => Math.max(best, scoreAlias(alias, rawQuery, normalizedQuery)), 0);

    return {
        pool,
        textScore,
        tieScore: (pool.marketCap ?? 0) / 1_000_000 + (pool.volume24hUsd ?? 0) / 100_000,
    };
}

function scoreHackathonCandidate(app: HackathonApp, query: string): number {
    const rawQuery = query.toLowerCase().trim().replace(/^\$/, "");
    const normalizedQuery = normalizeSearchKey(rawQuery);
    const aliases = dedupeNonEmpty([
        app.tokenAddress,
        app.name,
        normalizeHandle(app.twitterUrl),
        app.twitterUser?.username,
    ]);

    return aliases.reduce((best, alias) => Math.max(best, scoreAlias(alias, rawQuery, normalizedQuery)), 0);
}

function getMatchConfidence(bestScore: number, secondScore?: number, bestTieScore = 0, secondTieScore = 0) {
    if (bestScore >= 7_000) return "high";
    if (
        bestScore >= 1_500 &&
        (
            !secondScore ||
            bestScore >= secondScore * 1.35 ||
            bestTieScore >= secondTieScore * 1.6
        )
    ) {
        return "medium";
    }
    if (
        bestScore >= 900 &&
        secondScore === bestScore &&
        bestTieScore >= secondTieScore * 2
    ) {
        return "medium";
    }
    return "low";
}

function mergeOfficialPoolWithHackathonApp(
    tokenMint: string,
    pool: OfficialPoolView | null,
    app: HackathonApp
): OfficialPoolView {
    return {
        tokenMint,
        poolAddress: pool?.poolAddress,
        name: pool?.name ?? app.name,
        symbol: pool?.symbol,
        image: pool?.image ?? app.icon,
        description: pool?.description ?? app.description,
        website: pool?.website,
        twitter: pool?.twitter ?? app.twitterUrl,
        telegram: pool?.telegram,
        creatorWallet: pool?.creatorWallet,
        creatorDisplay: pool?.creatorDisplay,
        creatorUsername: pool?.creatorUsername,
        creatorPfp: pool?.creatorPfp,
        provider: pool?.provider,
        providerUsername: pool?.providerUsername,
        priceUsd: pool?.priceUsd,
        marketCap: pool?.marketCap,
        fdvUsd: pool?.fdvUsd,
        liquidityUsd: pool?.liquidityUsd,
        volume24hUsd: pool?.volume24hUsd,
        totalSupply: pool?.totalSupply,
        royaltyBps: pool?.royaltyBps,
        createdAt: pool?.createdAt,
    };
}

async function getOfficialHackathonCandidates(query: string, pools: OfficialPoolView[]): Promise<OfficialPoolCandidate[]> {
    const feed = await loadOfficialHackathonFeed();
    return feed.apps
        .filter((app) => Boolean(app.tokenAddress))
        .map((app) => {
            const textScore = scoreHackathonCandidate(app, query);
            const voteScore = (app.upvotes ?? 0) - (app.downvotes ?? 0);
            const followers = app.twitterUser?.public_metrics?.followers_count ?? 0;
            const poolFromList = pools.find((pool) => pool.tokenMint.toLowerCase() === app.tokenAddress.toLowerCase()) ?? null;

            return {
                pool: mergeOfficialPoolWithHackathonApp(app.tokenAddress, poolFromList, app),
                textScore,
                tieScore:
                    voteScore +
                    followers / 10_000 +
                    ((app.status ?? "").trim().toLowerCase() === "accepted" ? 4 : 0),
                source: "hackathon" as const,
            };
        })
        .filter((match) => match.textScore > 0)
        .sort((a, b) => b.textScore - a.textScore || b.tieScore - a.tieScore);
}

function mergeCandidateLists(poolCandidates: PoolMatch[], hackathonCandidates: OfficialPoolCandidate[]) {
    const merged = new Map<string, OfficialPoolCandidate>();

    for (const candidate of poolCandidates) {
        merged.set(candidate.pool.tokenMint, {
            pool: candidate.pool,
            textScore: candidate.textScore,
            tieScore: candidate.tieScore,
            source: "pool",
        });
    }

    for (const candidate of hackathonCandidates) {
        const existing = merged.get(candidate.pool.tokenMint);
        if (!existing) {
            merged.set(candidate.pool.tokenMint, candidate);
            continue;
        }

        if (
            candidate.textScore > existing.textScore ||
            (candidate.textScore === existing.textScore && candidate.tieScore > existing.tieScore)
        ) {
            merged.set(candidate.pool.tokenMint, {
                ...candidate,
                pool: {
                    ...existing.pool,
                    ...candidate.pool,
                    tokenMint: candidate.pool.tokenMint,
                },
            });
            continue;
        }

        merged.set(candidate.pool.tokenMint, {
            ...existing,
            pool: {
                ...candidate.pool,
                ...existing.pool,
                tokenMint: existing.pool.tokenMint,
            },
        });
    }

    return [...merged.values()].sort((a, b) => b.textScore - a.textScore || b.tieScore - a.tieScore);
}

async function resolveOfficialPool(query: string): Promise<OfficialPoolResolution> {
    const pools = await loadOfficialPools();
    const q = query.toLowerCase().trim().replace(/^\$/, "");
    const poolCandidates = pools
        .map((pool) => scorePoolCandidate(pool, q))
        .filter((match) => match.textScore > 0)
        .sort((a, b) => b.textScore - a.textScore || b.tieScore - a.tieScore);

    const hackathonCandidates = await getOfficialHackathonCandidates(q, pools);
    const ranked = mergeCandidateLists(poolCandidates, hackathonCandidates);
    const best = ranked[0];

    if (!best) {
        return {
            pool: null,
            candidates: [],
            confidence: "low",
        };
    }

    const confidence = getMatchConfidence(best.textScore, ranked[1]?.textScore, best.tieScore, ranked[1]?.tieScore ?? 0);
    return {
        pool: confidence === "low" ? null : best.pool,
        candidates: ranked.slice(0, 4).map((candidate) => candidate.pool),
        confidence,
    };
}

function sumClaimedSol(stats: BagsClaimStatEntry[]) {
    return stats.reduce((sum, stat) => sum + (lamportsToSol(stat.totalClaimed) ?? 0), 0);
}

function getPrimaryCreator(creators: BagsCreatorV3[]) {
    return creators.find((creator) => creator.isCreator) ?? creators[0] ?? null;
}

function buildTalkContext(
    intent: TalkIntent,
    pool?: OfficialPoolView | null
): TalkContext | undefined {
    if (!pool) {
        return { lastIntent: intent };
    }

    return {
        activeTokenMint: pool.tokenMint,
        activeTokenName: pool.name,
        activeTokenSymbol: pool.symbol,
        lastIntent: intent,
    };
}

function withContext(reply: TalkReply, context?: TalkContext): TalkReply {
    return {
        ...reply,
        context: context ?? { lastIntent: reply.intent },
    };
}

function buildNeedTokenReply(context?: TalkContext): TalkReply {
    const reference = context?.activeTokenName
        ? `The last active token in this chat is ${context.activeTokenName}${context.activeTokenSymbol ? ` ($${context.activeTokenSymbol})` : ""}.`
        : "There is no active token in this chat yet.";

    return withContext(
        {
            intent: "token",
            title: "WHICH TOKEN?",
            summary: "I need a token name, $symbol, or mint address before I can answer a token-specific question from official BAGS data.",
            bullets: [
                reference,
                "Use an exact token name, a $SYMBOL, or paste the mint address.",
                "I will not guess when the official BAGS pool match is weak.",
            ],
            cards: [],
            actions: [action("Open BAGS", "https://bags.fm", "info")],
            suggestions: [
                "Who created $HIVE?",
                "What fees has Agent Inc. earned?",
                "Tell me about 2TsmuYUrsctE57VLckZBYEEzdokUF8j8e1GavekWBAGS",
            ],
        },
        context
    );
}

function buildOfficialCandidatesReply(query: string, candidates: OfficialPoolView[]): TalkReply {
    const titleQuery = query.startsWith("$") ? query : `$${query.toUpperCase()}`;

    return withContext({
        intent: "token",
        title: "MULTIPLE OFFICIAL MATCHES",
        summary: `I could not verify a single exact official BAGS token for ${titleQuery}, but I found a few close first-party matches.`,
        bullets: [
            "Choose one of the official candidates below, or send a full mint address for an exact answer.",
            "This usually happens when a query matches project names more closely than official token symbols.",
        ],
        cards: candidates.map((candidate, index) =>
            buildOfficialPoolCard(candidate, index === 0 ? "Closest official match" : "Official candidate")
        ),
        actions: [action("Open BAGS", "https://bags.fm", "info")],
        suggestions: candidates
            .map((candidate) => candidate.name ?? candidate.symbol ?? candidate.tokenMint)
            .filter((value): value is string => Boolean(value))
            .slice(0, 4),
    });
}

function buildUnsupportedBagScanLayerReply(layer: "alpha" | "spotlight"): TalkReply {
    return {
        intent: "spotlight",
        title: layer === "alpha" ? "OFFICIAL BAGS MODE" : "SPOTLIGHT IS NOT PART OF OFFICIAL BAGS MODE",
        summary:
            layer === "alpha"
                ? "Talk to Bags is running in first-party BAGS mode and does not use any derived ranking or commentary layer."
                : "Spotlight is a separate curation layer. Talk to Bags ignores it and answers only from official BAGS data.",
        bullets: [
            "In this mode I can still show official market flow, recent launches, creator info, fee data, claimables, and hackathon activity.",
            "Ask for recent launches, official market board, token creator, token earnings, accepted hackathon apps, or launch help instead.",
        ],
        cards: [],
        actions: [
            action("Show Official Market Board", "https://bags.fm", "info"),
            action("Open BAGS", "https://bags.fm"),
        ],
        suggestions: [
            "Show me recent launches on BAGS",
            "Who created this token?",
            "Show me accepted hackathon projects",
            "What fees has this token earned?",
        ],
    };
}

async function buildOverviewReply(wallet?: string): Promise<TalkReply> {
    const [pools, hackathon] = await Promise.all([loadOfficialPools(), loadOfficialHackathonFeed()]);
    const withMarketCap = pools.filter((pool) => pool.marketCap !== undefined).length;
    const withVolume = pools.filter((pool) => pool.volume24hUsd !== undefined).length;

    return withContext({
        intent: "overview",
        title: "TALK TO BAGS",
        summary: "First-party BAGS copilot. This mode answers only from official BAGS pool, creator, fee, claim, launch, and hackathon data.",
        bullets: [
            `${formatNumber(pools.length, false)} official BAGS pools are currently indexed in this session.`,
            `${formatNumber(withMarketCap, false)} pools expose official market cap, while ${formatNumber(withVolume, false)} expose 24h volume.`,
            `${formatNumber(hackathon.totalItems, false)} official hackathon apps are available, with ${formatNumber(hackathon.acceptedOverall, false)} accepted teams.`,
            wallet
                ? `Wallet context is limited to official BAGS claimable positions for ${shortenAddress(wallet, 6)}.`
                : "Connect a wallet if you want official BAGS claimable-position answers.",
        ],
        cards: [
            {
                id: "official-market",
                title: "Official Market Board",
                subtitle: "Market cap and volume straight from BAGS",
                eyebrow: "POOLS",
                description: "Ask for top market cap pools, top volume pools, recent launches, or creator-linked token details.",
                href: "https://bags.fm",
                metrics: [
                    metric("POOLS", formatNumber(pools.length, false), "info"),
                    metric("MCAP", formatNumber(withMarketCap, false), "default"),
                ],
            },
            {
                id: "official-fees",
                title: "Fees + Claims",
                subtitle: "Creator earnings and claimable positions",
                eyebrow: "MONETIZATION",
                description: "Ask who created a token, how much it has earned, and whether a wallet can claim BAGS fees.",
            },
            {
                id: "official-hackathon",
                title: "Hackathon",
                subtitle: "Accepted teams, votes, and app profiles",
                eyebrow: "BUILDERS",
                description: "Ask for accepted projects, AI Agents, or raw official vote momentum from the Bags Hackathon feed.",
                href: "https://bags.fm/hackathon/apps",
                metrics: [
                    metric("APPS", formatNumber(hackathon.totalItems, false), "info"),
                    metric("ACCEPTED", formatNumber(hackathon.acceptedOverall, false), "positive"),
                ],
            },
        ],
        actions: [
            action("Open BAGS", "https://bags.fm", "info"),
            action("Open Hackathon", "https://bags.fm/hackathon/apps"),
        ],
        suggestions: [
            "Show me recent launches on BAGS",
            "Show me the official market board",
            "Who created this token?",
            "Show me accepted hackathon projects",
        ],
    });
}

async function buildOfficialMarketFlowReply(): Promise<TalkReply> {
    const pools = await loadOfficialPools();
    const top = [...pools]
        .filter((pool) => pool.volume24hUsd !== undefined || pool.marketCap !== undefined)
        .sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0) || (b.marketCap ?? 0) - (a.marketCap ?? 0))
        .slice(0, 4);
    const leader = top[0];

    return withContext({
        intent: "market",
        title: "OFFICIAL BAGS MARKET FLOW",
        summary: "This is a raw official BAGS market view ordered only by first-party volume and market cap data.",
        bullets: [
            `${formatNumber(top.length, false)} official pools are shown in this market-flow slice.`,
            leader
                ? `${leader.name ?? leader.symbol ?? shortenAddress(leader.tokenMint, 6)} is currently the most active visible token based on official 24h flow.`
                : "No official market-flow pools were returned.",
            leader?.volume24hUsd !== undefined
                ? `Its official 24h volume currently reads ${formatCurrency(leader.volume24hUsd)}.`
                : "The current leader did not expose an official 24h volume field on this pass.",
            "No derived ranking, conviction scoring, or external enrichment is used in this mode.",
        ],
        cards: top.map((pool, index) => buildOfficialPoolCard(pool, index === 0 ? "Lead official flow" : undefined)),
        actions: [
            action("Open BAGS", "https://bags.fm", "info"),
            ...(leader ? [action(`Open ${leader.symbol ?? "Lead Pool"}`, getBagsTokenHref(leader.tokenMint))] : []),
        ],
        suggestions: [
            "Show me recent launches on BAGS",
            "Show me the official market board",
            "Tell me about this token",
            "Who created this token?",
        ],
    }, buildTalkContext("market", leader));
}

async function buildRecentLaunchesReply(): Promise<TalkReply> {
    const pools = await loadOfficialPools();
    const launches = [...pools]
        .filter((pool) => pool.createdAt)
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
        .slice(0, 4);

    return withContext({
        intent: "new-launches",
        title: "RECENT BAGS LAUNCHES",
        summary: "This view uses only official BAGS pool timestamps and pool metadata. No external ordering or derived freshness scoring is involved.",
        bullets: [
            `${formatNumber(launches.length, false)} recent official launches are shown in this slice.`,
            launches[0]
                ? `${launches[0].name ?? launches[0].symbol ?? shortenAddress(launches[0].tokenMint, 6)} is currently the newest visible official pool at ${formatAgeLabel(launches[0].createdAt)}.`
                : "The current BAGS pool feed did not expose any launch timestamps on this pass.",
            "If a pool has no official createdAt value, it will not be ranked here.",
        ],
        cards: launches.map((pool) => buildOfficialPoolCard(pool, pool.createdAt ? `${formatAgeLabel(pool.createdAt)} live` : "Official pool")),
        actions: [
            action("Open BAGS", "https://bags.fm", "info"),
            action("Open Launch", "/launch"),
        ],
        suggestions: [
            "Show me the official market board",
            "Who created this token?",
            "What fees has this token earned?",
            "How do I launch a token on BAGS?",
        ],
    }, buildTalkContext("new-launches", launches[0]));
}

async function buildLeaderboardReply(scope: ParsedPrompt["leaderboardScope"]): Promise<TalkReply> {
    const pools = await loadOfficialPools();
    const sorted = [...pools]
        .filter((pool) => scope === "volume" ? pool.volume24hUsd !== undefined : (pool.marketCap !== undefined || pool.fdvUsd !== undefined))
        .sort((a, b) => scope === "volume"
            ? (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0) || (b.marketCap ?? 0) - (a.marketCap ?? 0)
            : (b.marketCap ?? b.fdvUsd ?? 0) - (a.marketCap ?? a.fdvUsd ?? 0) || (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0)
        )
        .slice(0, 4);

    return withContext({
        intent: "leaderboard",
        title: scope === "volume" ? "OFFICIAL BAGS VOLUME BOARD" : "OFFICIAL BAGS MARKET CAP BOARD",
        summary:
            scope === "volume"
                ? "This board is ranked directly by official BAGS 24h volume, with market cap used only as a tie-breaker."
                : "This board is ranked directly by official BAGS market cap, with FDV used only when official market cap is missing.",
        bullets: [
            `${formatNumber(sorted.length, false)} official pools are shown in this slice.`,
            sorted[0]
                ? `${sorted[0].name ?? sorted[0].symbol ?? shortenAddress(sorted[0].tokenMint, 6)} currently leads this official board.`
                : "No official pools matched this board.",
            "No extra scoring, creator heuristics, or external market enrichment is used here.",
        ],
        cards: sorted.map((pool, index) => buildOfficialPoolCard(pool, `Rank #${index + 1}`)),
        actions: [
            action("Open BAGS", "https://bags.fm", "info"),
            ...(sorted[0] ? [action(`Open ${sorted[0].symbol ?? "Lead Pool"}`, getBagsTokenHref(sorted[0].tokenMint))] : []),
        ],
        suggestions: [
            scope === "volume" ? "Show me the market cap board" : "Show me the volume board",
            "Show me recent launches on BAGS",
            "Tell me about this token",
            "Who created this token?",
        ],
    }, buildTalkContext("leaderboard", sorted[0]));
}

async function buildTokenReply(query: string): Promise<TalkReply> {
    const resolution = await resolveOfficialPool(query);
    const pool = resolution.pool;
    if (!pool) {
        if (resolution.candidates.length > 0) {
            return buildOfficialCandidatesReply(query, resolution.candidates);
        }

        return withContext({
            intent: "token",
            title: "TOKEN NOT FOUND",
            summary: "I could not verify that token from the official BAGS token and hackathon feeds.",
            bullets: [
                "Try an exact app name, a $SYMBOL, or paste the full mint address.",
                "I only answer from official BAGS surfaces, so I will not guess when the match is weak.",
            ],
            cards: [],
            actions: [action("Open BAGS", "https://bags.fm", "info")],
            suggestions: [
                "Show me recent launches on BAGS",
                "Who created $HIVE?",
                "What fees has Agent Inc. earned?",
            ],
        });
    }

    const [poolInfo, creators, feesLamports, claimStats] = await Promise.all([
        getBagsPoolInfo(pool.tokenMint),
        getCreatorsV3(pool.tokenMint),
        getLifetimeFees(pool.tokenMint),
        getClaimStatsDetailed(pool.tokenMint),
    ]);

    const primaryCreator = getPrimaryCreator(creators);
    const lifetimeFeesSol = lamportsToSol(feesLamports);
    const totalClaimedSol = sumClaimedSol(claimStats);
    const valuation = getValuationMetric({ marketCap: pool.marketCap, fdvUsd: pool.fdvUsd });
    const normalizedQuery = normalizeSearchKey(query);
    const normalizedName = normalizeSearchKey(pool.name);
    const normalizedSymbol = normalizeSearchKey(pool.symbol);
    const matchedViaProjectAlias =
        normalizedQuery.length >= 3 &&
        normalizedName.includes(normalizedQuery) &&
        normalizedQuery !== normalizedSymbol &&
        normalizedName !== normalizedQuery;

    return withContext({
        intent: "token",
        title: pool.name ?? pool.symbol ?? shortenAddress(pool.tokenMint, 6),
        summary: "This answer is built only from official BAGS token, creator, and fee data.",
        bullets: [
            ...(matchedViaProjectAlias && pool.symbol
                ? [`Your query matched the official project name ${pool.name}; the official BAGS token symbol for this pool is $${pool.symbol}.`]
                : []),
            valuation.value !== undefined
                ? `${valuation.longLabel} currently reads ${formatCurrency(valuation.value)} from the official BAGS pool feed.`
                : "No official valuation field is currently exposed for this pool.",
            lifetimeFeesSol !== undefined
                ? `Official lifetime fees currently read ${formatSolAmount(lifetimeFeesSol)}.`
                : "Official lifetime fees are not currently exposed for this token.",
            primaryCreator
                ? `The primary creator is ${primaryCreator.provider === "twitter" && primaryCreator.providerUsername ? `@${primaryCreator.providerUsername}` : primaryCreator.providerUsername ?? primaryCreator.username ?? shortenAddress(primaryCreator.wallet, 6)}.`
                : "No creator profile is currently exposed in the official creator feed.",
            claimStats.length > 0
                ? `${formatNumber(claimStats.length, false)} claimers are visible, with ${formatSolAmount(totalClaimedSol)} claimed in total.`
                : "No official claim stats are currently visible for this token.",
            poolInfo?.dammV2PoolKey ? "This pool shows a migrated DAMM v2 key in the official BAGS pool state." : "This token is using the current official BAGS pool state surface.",
        ],
        cards: [
            buildOfficialPoolCard(pool, "Official pool"),
            {
                id: `${pool.tokenMint}-creator`,
                title: "Creator Profile",
                subtitle: primaryCreator
                    ? [
                        primaryCreator.provider === "twitter" && primaryCreator.providerUsername ? `@${primaryCreator.providerUsername}` : undefined,
                        primaryCreator.username,
                    ].filter(Boolean).join(" • ")
                    : "No official creator profile",
                eyebrow: "CREATOR",
                description: primaryCreator
                    ? `Wallet ${shortenAddress(primaryCreator.wallet, 6)} with ${formatNumber(primaryCreator.royaltyBps ?? 0, false)} BPS royalty.`
                    : "The official creator endpoint did not return a profile for this pool.",
                metrics: [
                    metric("ROYALTY", primaryCreator?.royaltyBps !== undefined ? `${(primaryCreator.royaltyBps / 100).toFixed(2)}%` : "—", "default"),
                    metric("CLAIMERS", formatNumber(claimStats.length, false), "info"),
                    metric("FEES", lifetimeFeesSol !== undefined ? formatSolAmount(lifetimeFeesSol) : "—", "warning"),
                    metric("CLAIMED", claimStats.length > 0 ? formatSolAmount(totalClaimedSol) : "—", "default"),
                ],
            },
        ],
        actions: [
            action("Open BAGS Token", getBagsTokenHref(pool.tokenMint), "info"),
            ...(normalizeExternalUrl(pool.website) ? [action("Open Website", normalizeExternalUrl(pool.website)!)] : []),
        ],
        suggestions: [
            "Who created this token?",
            "What fees has this token earned?",
            "Show me recent launches on BAGS",
            "How do I launch a token on BAGS?",
        ],
    }, buildTalkContext("token", pool));
}

async function buildHackathonReply(scope: ParsedPrompt["hackathonScope"]): Promise<TalkReply> {
    const feed = await loadOfficialHackathonFeed();
    const filtered = [...feed.apps]
        .filter((app) => {
            if (scope === "accepted") return (app.status ?? "").trim().toLowerCase() === "accepted";
            if (scope === "ai-agents") return app.category.trim().toLowerCase() === "ai agents";
            return true;
        })
        .sort((a, b) => {
            const acceptedDiff = Number((b.status ?? "").trim().toLowerCase() === "accepted") - Number((a.status ?? "").trim().toLowerCase() === "accepted");
            if (acceptedDiff !== 0) return acceptedDiff;
            return ((b.upvotes ?? 0) - (b.downvotes ?? 0)) - ((a.upvotes ?? 0) - (a.downvotes ?? 0));
        });

    const title =
        scope === "accepted"
            ? "OFFICIAL ACCEPTED HACKATHON PROJECTS"
            : scope === "ai-agents"
                ? "OFFICIAL HACKATHON AI AGENTS"
                : "OFFICIAL HACKATHON APP STORE";

    return withContext({
        intent: "hackathon",
        title,
        summary: "This view uses the raw official Bags Hackathon feed only, without dedupe or market enrichment.",
        bullets: [
            `${formatNumber(feed.totalItems, false)} official hackathon apps are currently available, with ${formatNumber(feed.acceptedOverall, false)} accepted overall.`,
            `${formatNumber(filtered.length, false)} apps match this slice.`,
            filtered[0]
                ? `${filtered[0].name} currently leads this slice with a vote score of ${formatNumber((filtered[0].upvotes ?? 0) - (filtered[0].downvotes ?? 0), false)}.`
                : "No hackathon apps matched this filter.",
        ],
        cards: filtered.slice(0, 4).map((app, index) => buildHackathonCard(app, index === 0 ? "Lead official app" : undefined)),
        actions: [
            action("Open Hackathon", "https://bags.fm/hackathon/apps", "info"),
            ...(filtered[0] ? [action(`Open ${filtered[0].name}`, getHackathonAppHref(filtered[0].uuid))] : []),
        ],
        suggestions: [
            "Show me accepted hackathon projects",
            "Show me AI Agents from the hackathon",
            "Who created this token?",
            "Show me recent launches on BAGS",
        ],
    });
}

async function buildWalletReply(wallet?: string): Promise<TalkReply> {
    if (!wallet) {
        return withContext({
            intent: "portfolio",
            title: "OFFICIAL BAGS WALLET CONTEXT",
            summary: "In BAGS-only mode I only answer wallet questions from the official claimable-positions endpoint.",
            bullets: [
                "Connect a wallet if you want to see whether it has claimable BAGS fee-share positions.",
                "This mode does not use holdings, PnL, or external pricing layers.",
            ],
            cards: [],
            actions: [action("Open BAGS", "https://bags.fm", "info")],
            suggestions: [
                "Can this wallet claim BAGS fees?",
                "How do I launch a token on BAGS?",
                "Show me accepted hackathon projects",
            ],
        });
    }

    const [positions, pools] = await Promise.all([getClaimablePositions(wallet), loadOfficialPools()]);
    const poolMap = new Map(pools.map((pool) => [pool.tokenMint, pool]));
    const totalClaimableSol = positions.reduce((sum, position) => sum + (position.claimableDisplayAmount ?? lamportsToSol(position.totalClaimableLamportsUserShare) ?? 0), 0);

    return withContext({
        intent: "portfolio",
        title: "OFFICIAL CLAIMABLE POSITIONS",
        summary: `This wallet view is built only from the official BAGS claimable-positions endpoint for ${shortenAddress(wallet, 6)}.`,
        bullets: [
            `${formatNumber(positions.length, false)} claimable positions are currently visible.`,
            positions.length > 0
                ? `Total claimable amount reads ${formatSolAmount(totalClaimableSol)} across the visible positions.`
                : "No official claimable positions are currently available for this wallet.",
            "No extra portfolio value, cost basis, or non-BAGS token balances are used in this mode.",
        ],
        cards: positions.slice(0, 4).map((position) => {
            const pool = poolMap.get(position.baseMint);
            const claimableSol = position.claimableDisplayAmount ?? lamportsToSol(position.totalClaimableLamportsUserShare);
            return {
                id: `${position.baseMint}-${position.userBps ?? "claim"}`,
                title: pool?.name ?? pool?.symbol ?? shortenAddress(position.baseMint, 6),
                subtitle: pool?.symbol ? `$${pool.symbol}` : shortenAddress(position.baseMint, 5),
                eyebrow: position.isMigrated ? "Migrated position" : "Active position",
                description: position.userBps !== null && position.userBps !== undefined
                    ? `User share ${((position.userBps ?? 0) / 100).toFixed(2)}%.`
                    : "Official claimable position.",
                href: getBagsTokenHref(position.baseMint),
                metrics: [
                    metric("CLAIMABLE", claimableSol !== undefined ? formatSolAmount(claimableSol) : "—", "warning"),
                    metric("USER BPS", position.userBps !== null && position.userBps !== undefined ? formatNumber(position.userBps, false) : "—", "default"),
                    metric("MIGRATED", position.isMigrated ? "YES" : "NO", position.isMigrated ? "info" : "default"),
                    metric("CUSTOM VAULT", position.isCustomFeeVault ? "YES" : "NO", "default"),
                ],
            } satisfies TalkCard;
        }),
        actions: [action("Open BAGS", "https://bags.fm", "info")],
        suggestions: [
            "How do I launch a token on BAGS?",
            "What fees has this token earned?",
            "Who created this token?",
        ],
    }, buildTalkContext("portfolio", poolMap.get(positions[0]?.baseMint ?? "")));
}

async function buildLaunchReply(): Promise<TalkReply> {
    return withContext({
        intent: "launch",
        title: "OFFICIAL BAGS LAUNCH FLOW",
        summary: "This reply reflects the official BAGS launch stack only: metadata creation, fee-share config, and launch transaction creation.",
        bullets: [
            "Official launch inputs include token metadata, image or metadata URL, website, X, and Telegram.",
            "Fee-share config is created separately before the launch transaction so recipient wallets and BPS are explicit.",
            "The launch flow can also include tip wallet and tip lamports in the official BAGS launch transaction request.",
        ],
        cards: [
            {
                id: "bags-launch-metadata",
                title: "Create Token Info",
                subtitle: "Official BAGS metadata step",
                eyebrow: "STEP 1",
                description: "Prepare name, symbol, description, media, and social links for the token launch.",
            },
            {
                id: "bags-launch-fee-share",
                title: "Fee Share Config",
                subtitle: "Official BAGS fee split",
                eyebrow: "STEP 2",
                description: "Create claimers and basis points before the launch transaction is built.",
            },
            {
                id: "bags-launch-tx",
                title: "Launch Transaction",
                subtitle: "Official BAGS serialized transaction",
                eyebrow: "STEP 3",
                description: "Create the launch transaction with token mint, wallet, initial buy, config key, and optional tip data.",
            },
        ],
        actions: [
            action("Open Launch", "/launch", "info"),
            action("Open BAGS", "https://bags.fm"),
        ],
        suggestions: [
            "What should I prepare before launch?",
            "How do fee-share recipients work?",
            "Can a wallet claim BAGS fees?",
            "Show me recent launches on BAGS",
        ],
    });
}

async function buildAlertsReply(): Promise<TalkReply> {
    return withContext({
        intent: "alerts",
        title: "BAGS-ONLY MODE",
        summary: "Alerts are not part of the official BAGS data surface, so this mode does not answer from alert state or notification rules.",
        bullets: [
            "Talk to Bags is currently restricted to first-party BAGS token, creator, fee, claim, launch, and hackathon data.",
            "Use the notification center directly if you want alert setup help outside official BAGS data.",
        ],
        cards: [],
        actions: [
            action("Open Launch", "/launch"),
            action("Open BAGS", "https://bags.fm", "info"),
        ],
        suggestions: [
            "Show me recent launches on BAGS",
            "What fees has this token earned?",
            "Can this wallet claim BAGS fees?",
        ],
    });
}

async function buildTradeReply(query?: string): Promise<TalkReply> {
    if (!query) {
        return withContext({
            intent: "trade",
            title: "TRADE ROUTING",
            summary: "This mode stays read-only, but it can still resolve an official BAGS token and route you to the official token page.",
            bullets: [
                "Ask with an exact token name, mint, or $SYMBOL.",
                "No extra trading heuristics or external routing intelligence are used in this mode.",
            ],
            cards: [],
            actions: [action("Open BAGS", "https://bags.fm", "info")],
            suggestions: [
                "Buy $HIVE on BAGS",
                "Tell me about this token",
                "Who created this token?",
            ],
        });
    }

    const resolution = await resolveOfficialPool(query);
    const pool = resolution.pool;
    if (!pool) {
        if (resolution.candidates.length > 0) {
            return buildOfficialCandidatesReply(query, resolution.candidates);
        }

        return withContext({
            intent: "trade",
            title: "OFFICIAL TOKEN NOT FOUND",
            summary: "I could not verify that trade target from the official BAGS token and hackathon feeds.",
            bullets: [
                "Try an exact app name, mint, or $SYMBOL.",
                "I stay inside official BAGS data, so I will not guess a weak match.",
            ],
            cards: [],
            actions: [action("Open BAGS", "https://bags.fm", "info")],
            suggestions: [
                "Show me recent launches on BAGS",
                "Show me the official market board",
                "Tell me about this token",
            ],
        });
    }

    const normalizedQuery = normalizeSearchKey(query);
    const normalizedName = normalizeSearchKey(pool.name);
    const normalizedSymbol = normalizeSearchKey(pool.symbol);
    const matchedViaProjectAlias =
        normalizedQuery.length >= 3 &&
        normalizedName.includes(normalizedQuery) &&
        normalizedQuery !== normalizedSymbol &&
        normalizedName !== normalizedQuery;

    return withContext({
        intent: "trade",
        title: `OFFICIAL ROUTE // ${pool.name ?? pool.symbol ?? shortenAddress(pool.tokenMint, 6)}`,
        summary: "The token is resolved from the official BAGS pool feed. Continue on the official BAGS token page if you want to trade.",
        bullets: [
            ...(matchedViaProjectAlias && pool.symbol
                ? [`Your query matched the official project name ${pool.name}; the official BAGS token symbol for this pool is $${pool.symbol}.`]
                : []),
            pool.priceUsd !== undefined
                ? `Official pool price currently reads ${formatCurrency(pool.priceUsd, { compact: false, decimals: 4 })}.`
                : "No official price field is currently exposed for this pool.",
            pool.volume24hUsd !== undefined
                ? `Official 24h volume currently reads ${formatCurrency(pool.volume24hUsd)}.`
                : "No official 24h volume field is currently exposed for this pool.",
            "This mode does not create a derived trade preview or use any ranking context.",
        ],
        cards: [buildOfficialPoolCard(pool, "Official trade target")],
        actions: [
            action("Open Official Token", getBagsTokenHref(pool.tokenMint), "info"),
        ],
        suggestions: [
            "Tell me about this token",
            "Who created this token?",
            "What fees has this token earned?",
        ],
    }, buildTalkContext("trade", pool));
}

export async function generateTalkReplyLocal(message: string, wallet?: string, context?: TalkContext): Promise<TalkReply> {
    const parsed = parsePrompt(message);
    const contextTokenQuery =
        parsed.referencesActiveToken && context?.activeTokenMint
            ? context.activeTokenMint
            : undefined;
    const resolvedTokenQuery = parsed.tokenQuery ?? contextTokenQuery;

    switch (parsed.intent) {
        case "market":
            return await buildOfficialMarketFlowReply();
        case "spotlight":
            return buildUnsupportedBagScanLayerReply("spotlight");
        case "new-launches":
            return await buildRecentLaunchesReply();
        case "leaderboard":
            return await buildLeaderboardReply(parsed.leaderboardScope ?? "market-cap");
        case "hackathon":
            return await buildHackathonReply(parsed.hackathonScope ?? "all");
        case "token":
            return resolvedTokenQuery ? await buildTokenReply(resolvedTokenQuery) : buildNeedTokenReply(context);
        case "portfolio":
            return await buildWalletReply(wallet);
        case "launch":
            return await buildLaunchReply();
        case "alerts":
            return await buildAlertsReply();
        case "trade":
            return await buildTradeReply(parsed.tokenQuery);
        case "overview":
        default:
            return await buildOverviewReply(wallet);
    }
}
