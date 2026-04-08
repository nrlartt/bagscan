import {
    getBagsPoolInfo,
    getBagsPoolInfoWithStatus,
    getBagsPools,
    getClaimablePositions,
    getClaimStatsDetailed,
    getClaimStatsDetailedWithStatus,
    getCreatorsV3,
    getCreatorsV3WithStatus,
    getDexScreenerSearch,
    getHackathonApps,
    getLifetimeFees,
    getLifetimeFeesWithStatus,
    getOfficialTopTokensByLifetimeFees,
    type HackathonApp,
    type BagsFetchStatus,
    type BagsFetchResult,
} from "@/lib/bags/client";
import type { BagsClaimStatEntry, BagsCreatorV3, BagsOfficialTopToken, BagsPool } from "@/lib/bags/types";
import type { TalkAction, TalkCard, TalkContext, TalkMetric, TalkReply, TalkIntent } from "@/lib/talk/types";
import { findOfficialKnowledgeEntry, getOfficialKnowledgeEntry, getOfficialKnowledgeHub } from "@/lib/talk/officialKnowledge";
import { formatCurrency, formatNumber, getValuationMetric, shortenAddress } from "@/lib/utils";

const BASE58_MINT_REGEX = /\b[1-9A-HJ-NP-Za-km-z]{32,48}\b/;
const TOKEN_SYMBOL_REGEX = /\$([A-Za-z0-9._-]{2,20})/;
const LAMPORTS_PER_SOL = 1_000_000_000;
const POOLS_TTL_MS = 60_000;
const HACKATHON_TTL_MS = 5 * 60_000;
const CONTEXTUAL_TOKEN_REFERENCE_REGEX = /^(this|that|it|this one|that one|this token|that token|this project|that project)$/i;

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
    docsTopicId?: string;
    tokenQuery?: string;
    tokenFocus?: "creator" | "fees" | "claims" | "socials" | "overview";
    referencesActiveToken?: boolean;
    leaderboardScope?: "market-cap" | "volume" | "txns" | "oldest" | "newest" | "best";
    hackathonScope?: "all" | "accepted" | "ai-agents";
}

interface OfficialHackathonFeed {
    apps: HackathonApp[];
    totalItems: number;
    acceptedOverall: number;
}

let officialPoolsCache: { pools: OfficialPoolView[]; ts: number } | null = null;
let officialHackathonCache: { feed: OfficialHackathonFeed; ts: number } | null = null;
let officialLeaderboardCache: { tokens: OfficialLeaderboardView[]; ts: number } | null = null;
let dexBagsBoardCache: { pairs: DexBagsBoardEntry[]; ts: number } | null = null;
const TOKEN_DETAIL_OK_TTL_MS = 90_000;
const TOKEN_DETAIL_MISSING_TTL_MS = 30_000;
const TOKEN_DETAIL_STALE_FALLBACK_TTL_MS = 15 * 60_000;
const INVESTMENT_NOTICE = "NOT FINANCIAL ADVICE // OPENCLAW MARKET SCREEN";

interface OfficialLeaderboardView extends OfficialPoolView {
    lifetimeFeesSol?: number;
    holderCount?: number;
}

type DexPair = Awaited<ReturnType<typeof getDexScreenerSearch>>[number];

interface DexBagsBoardEntry {
    tokenMint: string;
    name?: string;
    symbol?: string;
    image?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
    priceUsd?: number;
    marketCap?: number;
    fdvUsd?: number;
    liquidityUsd?: number;
    volume24hUsd?: number;
    txCount24h?: number;
    priceChangeM5?: number;
    priceChangeH24?: number;
    pairCreatedAt?: number;
    pairAddress?: string;
}

interface CachedTokenDetail<T> {
    ts: number;
    result: BagsFetchResult<T>;
}

const tokenPoolInfoCache = new Map<string, CachedTokenDetail<Awaited<ReturnType<typeof getBagsPoolInfo>>>>();
const tokenCreatorsCache = new Map<string, CachedTokenDetail<Awaited<ReturnType<typeof getCreatorsV3>>>>();
const tokenFeesCache = new Map<string, CachedTokenDetail<Awaited<ReturnType<typeof getLifetimeFees>>>>();
const tokenClaimsCache = new Map<string, CachedTokenDetail<Awaited<ReturnType<typeof getClaimStatsDetailed>>>>();

const tokenPoolInfoInflight = new Map<string, Promise<BagsFetchResult<Awaited<ReturnType<typeof getBagsPoolInfo>>>>>();
const tokenCreatorsInflight = new Map<string, Promise<BagsFetchResult<Awaited<ReturnType<typeof getCreatorsV3>>>>>();
const tokenFeesInflight = new Map<string, Promise<BagsFetchResult<Awaited<ReturnType<typeof getLifetimeFees>>>>>();
const tokenClaimsInflight = new Map<string, Promise<BagsFetchResult<Awaited<ReturnType<typeof getClaimStatsDetailed>>>>>();

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

function missingFetchResult<T>(data: T): BagsFetchResult<T> {
    return {
        status: "missing",
        data,
        source: "live",
    };
}

function liveFetchResult<T>(result: BagsFetchResult<T>): BagsFetchResult<T> {
    return {
        ...result,
        source: result.source === "stale" ? "stale" : "live",
    };
}

function staleFetchResult<T>(result: BagsFetchResult<T>): BagsFetchResult<T> {
    return {
        ...result,
        source: "stale",
    };
}

function formatAgeLabel(value?: string) {
    if (!value) return "Official pool";
    const hours = Math.max(0, (Date.now() - new Date(value).getTime()) / 3_600_000);
    if (!Number.isFinite(hours)) return "Official pool";
    if (hours < 1) return "<1h";
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
}

function formatUtcDateTime(value?: string | number) {
    if (value === undefined) return "â€”";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "â€”";
    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
    }).format(date);
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

function parseExplicitTokenQuery(message: string) {
    const mintMatch = message.match(BASE58_MINT_REGEX)?.[0];
    if (mintMatch) return mintMatch;

    const symbolMatch = message.match(TOKEN_SYMBOL_REGEX)?.[1];
    if (symbolMatch) return symbolMatch;

    const structured = extractStructuredTokenQuery(message);
    if (structured && !CONTEXTUAL_TOKEN_REFERENCE_REGEX.test(structured.trim())) {
        return structured;
    }

    return undefined;
}

function parseTokenQuery(message: string) {
    const explicit = parseExplicitTokenQuery(message);
    if (explicit) return explicit;

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
    if (/\b(this token|that token|this coin|that coin|this project|that project|this one|that one)\b/i.test(lowered)) {
        return true;
    }

    if (!/\b(it|its)\b/i.test(lowered)) {
        return false;
    }

    if (/\b(best|strongest|highest|largest|biggest|most|oldest|earliest|first|newest|latest|freshest)\b/i.test(lowered) && /\b(token|coin|project)\b/i.test(lowered)) {
        return false;
    }

    const wordCount = lowered.split(/\s+/).filter(Boolean).length;
    if (wordCount > 8) {
        return false;
    }

    return /\b(who created it|what fees has it earned|what fees did it earn|tell me about it|show me its|when was it created|what are its|show its)\b/i.test(lowered);
}

function isTokenSpecificQuestion(lowered: string) {
    return /\b(who created|creator|created by|when was|created at|launch date|fees|fee split|fee-share|claim stats|claimers|claimed|website|telegram|twitter|x account|x handle|links?|social|socials|tell me about|analyze|analyse|about this|about that)\b/i.test(lowered);
}

function getTokenFocus(lowered: string): ParsedPrompt["tokenFocus"] {
    if (/\b(who created|creator|created by|who is behind|who built)\b/i.test(lowered)) {
        return "creator";
    }
    if (/\b(what fees|how much.*earned|fees?.*earned|lifetime fees|royalty)\b/i.test(lowered)) {
        return "fees";
    }
    if (/\b(claim stats|claimers|claimed|who claimed|claims)\b/i.test(lowered)) {
        return "claims";
    }
    if (/\b(website|telegram|twitter|x account|x handle|social|socials|links?)\b/i.test(lowered)) {
        return "socials";
    }
    return "overview";
}

function asksForMarketCapBoard(lowered: string) {
    return /\b(highest market cap|largest market cap|biggest market cap|top market cap|market cap board)\b/i.test(lowered);
}

function asksForVolumeBoard(lowered: string) {
    return /\b(highest|largest|biggest|top|most)\s+(trading\s+)?volume\b|\bmost traded\b|\btop by volume\b|\bvolume leader\b|\bhighest 24h volume\b|\bvolume board\b|\b24h volume board\b/i.test(lowered);
}

function asksForTxnBoard(lowered: string) {
    return /\b(highest|largest|biggest|top|most)\s+(tx|txns|transactions|trades)\b|\bmost transactions\b|\btx board\b|\btransactions board\b/i.test(lowered);
}

function asksForOldestBoard(lowered: string) {
    return /\b(oldest|earliest|first)\s+(token|coin|project)\b|\bwhich\s+is\s+the\s+oldest\b|\boldest\s+token\s+on\s+bags\b/i.test(lowered);
}

function asksForNewestBoard(lowered: string) {
    return /\b(newest|latest|freshest)\s+(token|coin|project)\b|\bwhich\s+is\s+the\s+newest\b|\bnewest\s+token\s+on\s+bags\b/i.test(lowered);
}

function asksForBestTokenBoard(lowered: string) {
    return /\b(best|strongest)\s+(token|coin|project)\b|\bbest\s+token\s+currently\b|\bbest\s+token\s+.*bags\b|\bavailable\s+for\s+purchase\b|\bworth\s+buying\b/i.test(lowered);
}

function asksForMarketWideQuestion(lowered: string) {
    return (
        asksForVolumeBoard(lowered) ||
        asksForTxnBoard(lowered) ||
        asksForBestTokenBoard(lowered) ||
        /\b(most popular|popular token|top token|top project|what.?s hot|what is hot|right now|most active|highest volume|market flow|market board)\b/i.test(lowered)
    );
}

function detectLeaderboardScope(lowered: string): ParsedPrompt["leaderboardScope"] | undefined {
    if (asksForBestTokenBoard(lowered)) return "best";
    if (asksForOldestBoard(lowered)) return "oldest";
    if (asksForNewestBoard(lowered)) return "newest";
    if (asksForMarketCapBoard(lowered)) return "market-cap";
    if (asksForVolumeBoard(lowered)) return "volume";
    if (asksForTxnBoard(lowered)) return "txns";
    return undefined;
}

function shouldRouteToDocsIntent(lowered: string) {
    return /\b(api docs?|documentation|docs?|faq|help center|support|partner key|partner fees|fee sharing|founder mode|admin settings|incorporation|company|withdraw to fiat|private key|seed phrase|transaction failed)\b/i.test(lowered);
}

function shouldInferLooseTokenQuery(cleaned: string, lowered: string) {
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 4) return false;

    return !/\b(what|which|who|when|where|why|how|best|strongest|highest|largest|biggest|most|least|oldest|earliest|first|newest|latest|freshest|popular|trending|hot|market|volume|transactions?|txns?|leaderboard|board|bags|hackathon|accepted|wallet|claimable|portfolio|alerts?|telegram|notification|buy|sell|swap|trade|purchase|worth|launch|deploy|company)\b/i.test(lowered);
}

function parsePrompt(message: string): ParsedPrompt {
    const cleaned = message.trim();
    const lowered = cleaned.toLowerCase();
    const refersToActiveToken = referencesActiveToken(lowered);
    const tokenSpecificQuestion = isTokenSpecificQuestion(lowered);
    const explicitTokenQuery = parseExplicitTokenQuery(cleaned);
    const docsTopic = !explicitTokenQuery && !refersToActiveToken ? findOfficialKnowledgeEntry(cleaned) : undefined;
    const leaderboardScope = !explicitTokenQuery && !refersToActiveToken ? detectLeaderboardScope(lowered) : undefined;
    const marketWideQuestion = !explicitTokenQuery && !refersToActiveToken && asksForMarketWideQuestion(lowered);
    const broadRankingPrompt = Boolean(leaderboardScope || marketWideQuestion);
    const inferredLooseTokenQuery = shouldInferLooseTokenQuery(cleaned, lowered) ? parseTokenQuery(cleaned) : undefined;
    const tokenQuery =
        explicitTokenQuery ??
        ((tokenSpecificQuestion && refersToActiveToken) || marketWideQuestion || leaderboardScope
            ? undefined
            : inferredLooseTokenQuery);
    const tokenFocus = getTokenFocus(lowered);
    const looksLikeDirectTokenLookup =
        Boolean(tokenQuery) &&
        cleaned.split(/\s+/).filter(Boolean).length <= 3 &&
        !/\b(hackathon|launch|leaderboard|market|volume|accepted|ai agents|wallet|claimable|best|oldest|newest|transactions?|txns?)\b/i.test(lowered);

    if (docsTopic) {
        return { cleaned, lowered, intent: "docs", docsTopicId: docsTopic.id, tokenQuery: undefined };
    }

    if (!explicitTokenQuery && !refersToActiveToken && shouldRouteToDocsIntent(lowered)) {
        return { cleaned, lowered, intent: "docs", docsTopicId: getOfficialKnowledgeHub().id, tokenQuery: undefined };
    }

    if (/\b(launch|deploy|create token|token launch)\b/i.test(lowered)) {
        return { cleaned, lowered, intent: "launch", tokenQuery };
    }

    if (/\b(alert|alerts|notify|telegram|browser push|notification)\b/i.test(lowered)) {
        return { cleaned, lowered, intent: "alerts", tokenQuery };
    }

    if (/\b(portfolio|pnl|holdings|claimable positions|claimable|wallet)\b/i.test(lowered)) {
        return { cleaned, lowered, intent: "portfolio", tokenQuery };
    }

    if (/\b(trade|buy|sell|swap)\b/i.test(lowered) && !broadRankingPrompt) {
        return { cleaned, lowered, intent: "trade", tokenQuery };
    }

    if (/\bleaderboard\b/i.test(lowered)) {
        return {
            cleaned,
            lowered,
            intent: "leaderboard",
            tokenQuery: undefined,
            leaderboardScope:
                leaderboardScope ??
                (/\bvolume\b/i.test(lowered)
                    ? "volume"
                    : /\b(tx|txns|transactions)\b/i.test(lowered)
                        ? "txns"
                        : /\b(oldest|earliest|first)\b/i.test(lowered)
                            ? "oldest"
                            : /\b(newest|latest|freshest)\b/i.test(lowered)
                                ? "newest"
                                : /\b(best|strongest)\b/i.test(lowered)
                                    ? "best"
                                    : "market-cap"),
        };
    }

    if (leaderboardScope) {
        return {
            cleaned,
            lowered,
            intent: "leaderboard",
            tokenQuery: undefined,
            leaderboardScope,
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

    if (marketWideQuestion || /\b(alpha|trending|featured|hot|market flow|market board)\b/i.test(lowered)) {
        return { cleaned, lowered, intent: "market", tokenQuery: undefined };
    }

    if (tokenSpecificQuestion && (tokenQuery || refersToActiveToken)) {
        return {
            cleaned,
            lowered,
            intent: "token",
            tokenQuery,
            tokenFocus,
            referencesActiveToken: refersToActiveToken,
        };
    }

    if (looksLikeDirectTokenLookup && tokenQuery) {
        return {
            cleaned,
            lowered,
            intent: "token",
            tokenQuery,
            tokenFocus: "overview",
        };
    }

    if (
        tokenQuery &&
        (
            /\b(about|analyze|analyse|check|who created|creator|fees|claim stats|links?|socials?|website|telegram|twitter)\b/i.test(lowered) ||
            TOKEN_SYMBOL_REGEX.test(cleaned) ||
            BASE58_MINT_REGEX.test(cleaned) ||
            shouldInferLooseTokenQuery(cleaned, lowered)
        )
    ) {
        return { cleaned, lowered, intent: "token", tokenQuery, tokenFocus };
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

function mapOfficialLeaderboardItem(raw: BagsOfficialTopToken): OfficialLeaderboardView | null {
    if (!raw.tokenMint) return null;

    return {
        tokenMint: raw.tokenMint,
        name: raw.name,
        symbol: raw.symbol,
        image: raw.image,
        website: raw.website,
        twitter: raw.twitter,
        telegram: raw.telegram,
        creatorWallet: raw.creatorWallet,
        creatorDisplay: raw.creatorUsername,
        creatorUsername: raw.creatorUsername,
        creatorPfp: raw.creatorPfp,
        provider: raw.creatorProvider ?? undefined,
        providerUsername: raw.creatorProviderUsername ?? undefined,
        priceUsd: raw.priceUsd,
        marketCap: raw.marketCap,
        fdvUsd: raw.fdvUsd,
        liquidityUsd: raw.liquidityUsd,
        volume24hUsd: raw.volume24hUsd,
        createdAt: raw.createdAt,
        lifetimeFeesSol: lamportsToSol(raw.lifetimeFeesLamports),
        holderCount: raw.holderCount,
    };
}

async function loadOfficialLeaderboard() {
    if (officialLeaderboardCache && Date.now() - officialLeaderboardCache.ts < POOLS_TTL_MS) {
        return officialLeaderboardCache.tokens;
    }

    const rawTokens = await getOfficialTopTokensByLifetimeFees();
    const tokens = rawTokens
        .map(mapOfficialLeaderboardItem)
        .filter((token): token is OfficialLeaderboardView => token !== null);

    officialLeaderboardCache = { tokens, ts: Date.now() };
    return tokens;
}

function mapDexBagsPair(pair: DexPair): DexBagsBoardEntry | null {
    const tokenMint = pair?.baseToken?.address;
    if (!tokenMint || pair.dexId !== "bags") return null;

    const socials = Array.isArray((pair.info as { socials?: Array<{ type?: string; url?: string }> } | undefined)?.socials)
        ? ((pair.info as { socials?: Array<{ type?: string; url?: string }> }).socials ?? [])
        : [];
    const websites = Array.isArray((pair.info as { websites?: Array<{ label?: string; url?: string }> } | undefined)?.websites)
        ? ((pair.info as { websites?: Array<{ label?: string; url?: string }> }).websites ?? [])
        : [];
    const twitter = socials.find((item) => item.type === "twitter")?.url;
    const telegram = socials.find((item) => item.type === "telegram")?.url;
    const website = websites.find((item) => item.url)?.url;

    return {
        tokenMint,
        name: pair.baseToken?.name,
        symbol: pair.baseToken?.symbol,
        image: pair.info?.imageUrl,
        website,
        twitter,
        telegram,
        priceUsd: safeNumber(pair.priceUsd),
        marketCap: safeNumber(pair.marketCap),
        fdvUsd: safeNumber(pair.fdv),
        liquidityUsd: safeNumber(pair.liquidity?.usd),
        volume24hUsd: safeNumber(pair.volume?.h24),
        txCount24h: safeNumber(pair.txns?.h24?.buys) !== undefined || safeNumber(pair.txns?.h24?.sells) !== undefined
            ? (safeNumber(pair.txns?.h24?.buys) ?? 0) + (safeNumber(pair.txns?.h24?.sells) ?? 0)
            : undefined,
        priceChangeM5: safeNumber((pair.priceChange as { m5?: unknown } | undefined)?.m5),
        priceChangeH24: safeNumber(pair.priceChange?.h24),
        pairCreatedAt: safeNumber(pair.pairCreatedAt),
        pairAddress: typeof pair.pairAddress === "string" ? pair.pairAddress : undefined,
    };
}

async function loadDexBagsBoard() {
    if (dexBagsBoardCache && Date.now() - dexBagsBoardCache.ts < POOLS_TTL_MS) {
        return dexBagsBoardCache.pairs;
    }

    const pairs = await getDexScreenerSearch("bags");
    const board = pairs
        .map(mapDexBagsPair)
        .filter((pair): pair is DexBagsBoardEntry => pair !== null);

    dexBagsBoardCache = { pairs: board, ts: Date.now() };
    return board;
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

async function readCachedTokenDetail<T>(
    tokenMint: string,
    cache: Map<string, CachedTokenDetail<T>>,
    inflight: Map<string, Promise<BagsFetchResult<T>>>,
    loader: () => Promise<BagsFetchResult<T>>
) {
    const cached = cache.get(tokenMint);
    const cachedAge = cached ? Date.now() - cached.ts : Number.POSITIVE_INFINITY;
    if (cached && cachedAge < getTokenDetailCacheTtl(cached.result.status)) {
        return cached.result;
    }

    const pending = inflight.get(tokenMint);
    if (pending) {
        return pending;
    }

    const next = loader()
        .then((result) => {
            const now = Date.now();
            const normalizedResult = liveFetchResult(result);
            const cacheTtl = getTokenDetailCacheTtl(normalizedResult.status);

            if (cacheTtl > 0) {
                cache.set(tokenMint, { ts: now, result: normalizedResult });
                inflight.delete(tokenMint);
                return normalizedResult;
            }

            const previous = cache.get(tokenMint);
            const previousAge = previous ? now - previous.ts : Number.POSITIVE_INFINITY;
            if (
                (normalizedResult.status === "rate_limited" || normalizedResult.status === "error") &&
                previous &&
                previous.result.status === "ok" &&
                previousAge < TOKEN_DETAIL_STALE_FALLBACK_TTL_MS
            ) {
                inflight.delete(tokenMint);
                return staleFetchResult(previous.result);
            }

            inflight.delete(tokenMint);
            return normalizedResult;
        })
        .catch((error) => {
            inflight.delete(tokenMint);
            throw error;
        });

    inflight.set(tokenMint, next);
    return next;
}

function getTokenDetailCacheTtl(status: BagsFetchStatus) {
    switch (status) {
        case "ok":
            return TOKEN_DETAIL_OK_TTL_MS;
        case "missing":
            return TOKEN_DETAIL_MISSING_TTL_MS;
        default:
            return 0;
    }
}

async function loadTokenPoolInfo(tokenMint: string) {
    return readCachedTokenDetail(tokenMint, tokenPoolInfoCache, tokenPoolInfoInflight, () =>
        getBagsPoolInfoWithStatus(tokenMint)
    );
}

async function loadTokenCreators(tokenMint: string) {
    return readCachedTokenDetail(tokenMint, tokenCreatorsCache, tokenCreatorsInflight, () =>
        getCreatorsV3WithStatus(tokenMint)
    );
}

async function loadTokenLifetimeFees(tokenMint: string) {
    return readCachedTokenDetail(tokenMint, tokenFeesCache, tokenFeesInflight, () =>
        getLifetimeFeesWithStatus(tokenMint)
    );
}

async function loadTokenClaimStats(tokenMint: string) {
    return readCachedTokenDetail(tokenMint, tokenClaimsCache, tokenClaimsInflight, () =>
        getClaimStatsDetailedWithStatus(tokenMint)
    );
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

function buildBubbleMapTalkCard(pool: OfficialPoolView): TalkCard {
    return {
        id: `${pool.tokenMint}-bubblemap`,
        kind: "bubblemap",
        mint: pool.tokenMint,
        symbol: pool.symbol,
        title: "Holder Bubblemap",
        subtitle: pool.symbol ? `$${pool.symbol}` : shortenAddress(pool.tokenMint, 5),
        eyebrow: "VISUAL",
        description: `Live holder clusters for ${pool.name ?? pool.symbol ?? "the resolved token"} on Solana.`,
        href: `https://app.bubblemaps.io/sol/token/${pool.tokenMint}`,
    };
}

function buildDexBoardCard(pair: DexBagsBoardEntry, eyebrow?: string): TalkCard {
    const valuation = getValuationMetric({ marketCap: pair.marketCap, fdvUsd: pair.fdvUsd });
    const metrics: TalkMetric[] = [];

    if (pair.volume24hUsd !== undefined) {
        metrics.push(metric("24H VOL", formatCurrency(pair.volume24hUsd), "info"));
    }
    if (valuation.value !== undefined) {
        metrics.push(metric(valuation.shortLabel, formatCurrency(valuation.value), "info"));
    }
    if (pair.txCount24h !== undefined) {
        metrics.push(metric("24H TX", formatNumber(pair.txCount24h, false), "default"));
    }
    if (pair.priceChangeH24 !== undefined) {
        metrics.push(metric("24H", `${pair.priceChangeH24 >= 0 ? "+" : ""}${pair.priceChangeH24.toFixed(2)}%`, pair.priceChangeH24 >= 0 ? "positive" : "negative"));
    }

    return {
        id: pair.tokenMint,
        title: pair.name ?? pair.symbol ?? shortenAddress(pair.tokenMint, 6),
        subtitle: [
            pair.symbol ? `$${pair.symbol}` : shortenAddress(pair.tokenMint, 5),
            normalizeHandle(pair.twitter) ? `@${normalizeHandle(pair.twitter)}` : undefined,
        ].filter(Boolean).join(" • "),
        eyebrow,
        description: "Live Bags market board used by OpenClaw for current BAGS ranking questions.",
        href: getBagsTokenHref(pair.tokenMint),
        metrics: metrics.slice(0, 4),
    };
}

function normalizeWeightedScore(value: number | undefined, max: number) {
    if (value === undefined || value <= 0 || max <= 0) return 0;
    return Math.log10(value + 1) / Math.log10(max + 1);
}

function buildCompositeBestCard(
    pair: DexBagsBoardEntry,
    holderCount: number | undefined,
    score: number,
    eyebrow?: string
): TalkCard {
    const valuation = getValuationMetric({ marketCap: pair.marketCap, fdvUsd: pair.fdvUsd });

    return {
        id: `${pair.tokenMint}-best`,
        title: pair.name ?? pair.symbol ?? shortenAddress(pair.tokenMint, 6),
        subtitle: [
            pair.symbol ? `$${pair.symbol}` : shortenAddress(pair.tokenMint, 5),
            normalizeHandle(pair.twitter) ? `@${normalizeHandle(pair.twitter)}` : undefined,
        ].filter(Boolean).join(" • "),
        eyebrow,
        description: "Composite live Bags screen using market cap, holders, 24h volume, and 24h transaction count.",
        href: getBagsTokenHref(pair.tokenMint),
        metrics: [
            metric("SCORE", score.toFixed(1), "positive"),
            metric(valuation.shortLabel, valuation.value !== undefined ? formatCurrency(valuation.value) : "â€”", "info"),
            metric("24H VOL", pair.volume24hUsd !== undefined ? formatCurrency(pair.volume24hUsd) : "â€”", "info"),
            metric("HOLDERS", holderCount !== undefined ? formatNumber(holderCount, false) : "â€”", "default"),
            metric("24H TX", pair.txCount24h !== undefined ? formatNumber(pair.txCount24h, false) : "â€”", "default"),
        ].slice(0, 4),
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
        projectTwitterHandle:
            pool?.projectTwitterHandle ??
            normalizeHandle(app.twitterUrl) ??
            app.twitterUser?.username ??
            undefined,
        projectTwitterFollowers:
            pool?.projectTwitterFollowers ??
            app.twitterUser?.public_metrics?.followers_count,
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

function getOfficialIdentityLabel(pool: OfficialPoolView) {
    return (
        pool.name ??
        (pool.symbol ? `$${pool.symbol}` : undefined) ??
        shortenAddress(pool.tokenMint, 6)
    );
}

function getCreatorDisplayLabel(creator: BagsCreatorV3 | null) {
    if (!creator) return undefined;
    if (creator.provider === "twitter" && creator.providerUsername) {
        return `@${creator.providerUsername}`;
    }
    if (creator.providerUsername) return creator.providerUsername;
    if (creator.username) return creator.username;
    return shortenAddress(creator.wallet, 6);
}

function getOfficialProjectSocials(pool: OfficialPoolView) {
    const officialXHandle =
        normalizeHandle(pool.twitter) ??
        pool.projectTwitterHandle ??
        (pool.provider === "twitter" ? pool.providerUsername : undefined);

    return {
        website: normalizeExternalUrl(pool.website),
        telegram: normalizeExternalUrl(pool.telegram),
        xHandle: officialXHandle,
        xUrl: officialXHandle ? `https://x.com/${officialXHandle}` : undefined,
    };
}

function getRateLimitMessage(subject: string) {
    return `The official BAGS ${subject} endpoint is being rate-limited right now, so I can't verify that field on this pass.`;
}

function getMissingMessage(subject: string) {
    return `The official BAGS ${subject} endpoint did not return a value for this token.`;
}

function getStaleSnapshotMessage(subject: string) {
    return `Using the most recent verified official BAGS ${subject} snapshot because the live endpoint is temporarily busy.`;
}

function buildDataAvailabilityLine(subject: string, result: BagsFetchResult<unknown>) {
    if (result.source === "stale") {
        return getStaleSnapshotMessage(subject);
    }
    if (result.status === "rate_limited") {
        return getRateLimitMessage(subject);
    }
    if (result.status === "missing") {
        return getMissingMessage(subject);
    }
    if (result.status === "error") {
        return `The official BAGS ${subject} endpoint failed on this pass, so I could not verify it cleanly.`;
    }
    return undefined;
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

function buildDocsReply(topicId?: string): TalkReply {
    const entry = topicId ? getOfficialKnowledgeEntry(topicId) : undefined;
    const resolved = entry ?? getOfficialKnowledgeHub();

    const cards: TalkCard[] = resolved.links.slice(0, 3).map((link, index) => ({
        id: `${resolved.id}-link-${index + 1}`,
        title: link.label,
        subtitle: link.href.replace(/^https?:\/\//i, ""),
        eyebrow: index === 0 ? "OFFICIAL SOURCE" : "REFERENCE",
        description: index === 0
            ? "Open the primary official Bags source for this topic."
            : "Supplementary official Bags documentation or support guidance.",
        href: link.href,
    }));

    return withContext({
        intent: "docs",
        title: resolved.title,
        summary: resolved.summary,
        bullets: resolved.bullets,
        cards,
        actions: resolved.links.slice(0, 3).map((link, index) => action(link.label, link.href, index === 0 ? "info" : "default")),
        suggestions: resolved.suggestions,
    });
}

async function buildOverviewReply(wallet?: string): Promise<TalkReply> {
    const [pools, leaderboard, hackathon] = await Promise.all([
        loadOfficialPools(),
        loadOfficialLeaderboard(),
        loadOfficialHackathonFeed(),
    ]);
    const withMarketCap = leaderboard.filter((pool) => pool.marketCap !== undefined).length;
    const withVolume = leaderboard.filter((pool) => pool.volume24hUsd !== undefined).length;

    return withContext({
        intent: "overview",
        title: "TALK TO BAGS",
        summary: "First-party BAGS copilot. This mode answers only from official BAGS pool, creator, fee, claim, launch, and hackathon data.",
        bullets: [
            `${formatNumber(pools.length, false)} official BAGS pools are currently indexed in this session.`,
            `${formatNumber(withMarketCap, false)} official top tokens expose market cap, while ${formatNumber(withVolume, false)} expose 24h volume on the official leaderboard surface.`,
            `${formatNumber(hackathon.totalItems, false)} official hackathon apps are available, with ${formatNumber(hackathon.acceptedOverall, false)} accepted teams.`,
            "Docs and FAQ questions are answered from official Bags docs and support material instead of token search.",
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
            "How do partner keys work on Bags?",
            "Show me the official market board",
            "Who created this token?",
            "Show me accepted hackathon projects",
        ],
    });
}

async function buildOfficialMarketFlowReply(): Promise<TalkReply> {
    const top = [...await loadDexBagsBoard()]
        .filter((pair) => pair.volume24hUsd !== undefined || pair.txCount24h !== undefined || pair.marketCap !== undefined)
        .sort((a, b) =>
            ((b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0)) ||
            ((b.txCount24h ?? 0) - (a.txCount24h ?? 0)) ||
            ((b.marketCap ?? b.fdvUsd ?? 0) - (a.marketCap ?? a.fdvUsd ?? 0))
        )
        .slice(0, 4);
    const leader = top[0];

    if (!leader) {
        return withContext({
            intent: "market",
            title: "BAGS MARKET FLOW",
            priorityNotice: INVESTMENT_NOTICE,
            summary: "I could not build a live Bags market-flow board on this pass because the current BAGS market surface is not exposing enough ranking data right now.",
            bullets: [
                "This market lane uses the live BAGS market board for volume, transactions, age, and valuation-style ranking.",
                "If that board is sparse or unavailable, I avoid guessing a market leader.",
                "Token-specific creator, fee, and claim questions still stay on official BAGS data.",
            ],
            cards: [],
            actions: [
                action("Open Live Bags Board", "https://dexscreener.com/solana/bags", "info"),
                action("Open BAGS", "https://bags.fm"),
            ],
            suggestions: [
                "Show me the volume board",
                "Show me the market cap board",
                "Show me recent launches on BAGS",
            ],
        });
    }

    return withContext({
        intent: "market",
        title: "BAGS MARKET FLOW",
        priorityNotice: INVESTMENT_NOTICE,
        summary: "This live Bags market view is ordered by current BAGS trading activity, with 24h volume leading and transactions plus market cap used as supporting context.",
        bullets: [
            `${formatNumber(top.length, false)} live Bags tokens are shown in this market-flow slice.`,
            leader
                ? `${leader.name ?? leader.symbol ?? shortenAddress(leader.tokenMint, 6)} is currently the most active visible token on the live BAGS market board.`
                : "No live Bags market-flow pairs were returned.",
            leader?.volume24hUsd !== undefined
                ? `Its live 24h volume currently reads ${formatCurrency(leader.volume24hUsd)}.`
                : "The current leader did not expose a 24h volume field on this pass.",
            "This lane is for live market ranking; creator, fee, and claim answers still come from official BAGS data.",
        ],
        cards: top.map((pair, index) => buildDexBoardCard(pair, index === 0 ? "Lead live flow" : undefined)),
        actions: [
            action("Open Live Bags Board", "https://dexscreener.com/solana/bags", "info"),
            ...(leader ? [action(`Open ${leader.symbol ?? "Lead Token"}`, getBagsTokenHref(leader.tokenMint))] : []),
        ],
        suggestions: [
            "Show me recent launches on BAGS",
            "Show me the volume board",
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

async function buildCompositeBestReply(): Promise<TalkReply> {
    const [pairs, officialLeaderboard] = await Promise.all([loadDexBagsBoard(), loadOfficialLeaderboard()]);
    const officialMap = new Map(officialLeaderboard.map((token) => [token.tokenMint, token]));

    const baseCandidates = pairs
        .map((pair) => {
            const official = officialMap.get(pair.tokenMint);
            return {
                pair,
                holderCount: official?.holderCount,
                marketCapValue: pair.marketCap ?? pair.fdvUsd ?? official?.marketCap ?? official?.fdvUsd,
                volume24hUsd: pair.volume24hUsd ?? official?.volume24hUsd,
                txCount24h: pair.txCount24h,
            };
        })
        .filter((candidate) =>
            candidate.marketCapValue !== undefined ||
            candidate.holderCount !== undefined ||
            candidate.volume24hUsd !== undefined ||
            candidate.txCount24h !== undefined
        );

    if (baseCandidates.length === 0) {
        return withContext({
            intent: "leaderboard",
            title: "BAGS BEST-TOKEN SCREEN",
            priorityNotice: INVESTMENT_NOTICE,
            summary: "I could not build a blended Bags screen on this pass because the live market board is too sparse.",
            bullets: [
                "This ranking needs live market cap, holder count, 24h volume, and 24h transaction activity.",
                "If those fields are missing, I avoid pretending there is a clear best token.",
                "Ask for the volume board or market cap board if you want a single-metric answer.",
            ],
            cards: [],
            actions: [action("Open Live Bags Board", "https://dexscreener.com/solana/bags", "info")],
            suggestions: [
                "Show me the volume board",
                "Show me the market cap board",
                "Which token has the most transactions on BAGS?",
            ],
        });
    }

    const maxMarketCap = Math.max(...baseCandidates.map((candidate) => candidate.marketCapValue ?? 0), 0);
    const maxHolders = Math.max(...baseCandidates.map((candidate) => candidate.holderCount ?? 0), 0);
    const maxVolume = Math.max(...baseCandidates.map((candidate) => candidate.volume24hUsd ?? 0), 0);
    const maxTx = Math.max(...baseCandidates.map((candidate) => candidate.txCount24h ?? 0), 0);

    const ranked = baseCandidates
        .map((candidate) => {
            const score =
                normalizeWeightedScore(candidate.marketCapValue, maxMarketCap) * 0.34 +
                normalizeWeightedScore(candidate.holderCount, maxHolders) * 0.18 +
                normalizeWeightedScore(candidate.volume24hUsd, maxVolume) * 0.28 +
                normalizeWeightedScore(candidate.txCount24h, maxTx) * 0.20;

            return {
                ...candidate,
                score: score * 100,
            };
        })
        .sort((a, b) =>
            b.score - a.score ||
            ((b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0)) ||
            ((b.txCount24h ?? 0) - (a.txCount24h ?? 0)) ||
            ((b.marketCapValue ?? 0) - (a.marketCapValue ?? 0))
        )
        .slice(0, 4);

    const leader = ranked[0];

    return withContext({
        intent: "leaderboard",
        title: "BAGS BEST-TOKEN SCREEN",
        priorityNotice: INVESTMENT_NOTICE,
        summary: "For a 'best on BAGS right now' question, I rank live Bags tokens with a blended screen across market cap, holder count, 24h volume, and 24h transaction count. This is a market heuristic, not investment advice.",
        bullets: [
            `${leader.pair.name ?? leader.pair.symbol ?? shortenAddress(leader.pair.tokenMint, 6)} currently leads this blended screen.`,
            "Market cap and live activity come from the current BAGS market board, while holder count is added when the official BAGS top-token surface exposes it.",
            "This is a transparent OpenClaw ranking model for comparing visible BAGS tokens right now.",
        ],
        cards: ranked.map((candidate, index) =>
            buildCompositeBestCard(candidate.pair, candidate.holderCount, candidate.score, `Rank #${index + 1}`)
        ),
        actions: [
            action("Open Live Bags Board", "https://dexscreener.com/solana/bags", "info"),
            action(`Open ${leader.pair.symbol ?? "Lead Token"}`, getBagsTokenHref(leader.pair.tokenMint)),
        ],
        suggestions: [
            "Show me the volume board",
            "Show me the market cap board",
            "Which token has the most transactions on BAGS?",
            "Which is the oldest token on BAGS?",
        ],
    }, buildTalkContext("leaderboard", leader.pair));
}

async function buildChronologyReply(scope: "oldest" | "newest"): Promise<TalkReply> {
    const livePairs = [...await loadDexBagsBoard()]
        .filter((pair) => pair.pairCreatedAt !== undefined)
        .sort((a, b) =>
            scope === "oldest"
                ? (a.pairCreatedAt ?? 0) - (b.pairCreatedAt ?? 0)
                : (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0)
        )
        .slice(0, 4);

    if (livePairs.length === 0) {
        return withContext({
            intent: "leaderboard",
            title: scope === "oldest" ? "OLDEST LIVE BAGS TOKENS" : "NEWEST LIVE BAGS TOKENS",
            summary: "I could not build a reliable Bags chronology board on this pass because the live Bags pair feed is not exposing enough creation timestamps.",
            bullets: [
                "This board uses live BAGS pair ages when they are available.",
                "If the live Bags board is too sparse, I avoid guessing which token came first.",
            ],
            cards: [],
            actions: [action("Open Live Bags Board", "https://dexscreener.com/solana/bags", "info")],
            suggestions: [
                "Show me recent launches on BAGS",
                "Show me the volume board",
                "Who created $HIVE?",
            ],
        });
    }

    const leader = livePairs[0];

    return withContext({
        intent: "leaderboard",
        title: scope === "oldest" ? "OLDEST LIVE BAGS TOKENS" : "NEWEST LIVE BAGS TOKENS",
        summary:
            scope === "oldest"
                ? "This board is ordered by the earliest live BAGS pair timestamps currently exposed."
                : "This board is ordered by the latest live BAGS pair timestamps currently exposed.",
        bullets: [
            `${leader.name ?? leader.symbol ?? shortenAddress(leader.tokenMint, 6)} is currently the ${scope === "oldest" ? "oldest" : "newest"} visible live Bags pair in this session.`,
            `Visible pair timestamp: ${formatUtcDateTime(leader.pairCreatedAt)} UTC.`,
            "This chronology answer uses live Bags pair age, so it reflects visible trading pairs rather than a guessed historical narrative.",
        ],
        cards: livePairs.map((pair, index) =>
            buildDexBoardCard(
                pair,
                index === 0
                    ? scope === "oldest"
                        ? "Oldest visible pair"
                        : "Newest visible pair"
                    : formatUtcDateTime(pair.pairCreatedAt)
            )
        ),
        actions: [
            action("Open Live Bags Board", "https://dexscreener.com/solana/bags", "info"),
            action(`Open ${leader.symbol ?? "Lead Token"}`, getBagsTokenHref(leader.tokenMint)),
        ],
        suggestions: [
            scope === "oldest" ? "Show me recent launches on BAGS" : "Which is the oldest token on BAGS?",
            "Show me the volume board",
            "Who created this token?",
        ],
    }, buildTalkContext("leaderboard", leader));
}

async function buildLeaderboardReply(scope: ParsedPrompt["leaderboardScope"]): Promise<TalkReply> {
    if (scope === "best") {
        return buildCompositeBestReply();
    }

    if (scope === "oldest" || scope === "newest") {
        return buildChronologyReply(scope);
    }

    const sorted = [...await loadDexBagsBoard()]
        .filter((pair) =>
            scope === "volume"
                ? pair.volume24hUsd !== undefined
                : scope === "txns"
                    ? pair.txCount24h !== undefined
                    : (pair.marketCap !== undefined || pair.fdvUsd !== undefined)
        )
        .sort((a, b) =>
            scope === "volume"
                ? ((b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0)) || ((b.txCount24h ?? 0) - (a.txCount24h ?? 0)) || ((b.marketCap ?? b.fdvUsd ?? 0) - (a.marketCap ?? a.fdvUsd ?? 0))
                : scope === "txns"
                    ? ((b.txCount24h ?? 0) - (a.txCount24h ?? 0)) || ((b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0)) || ((b.marketCap ?? b.fdvUsd ?? 0) - (a.marketCap ?? a.fdvUsd ?? 0))
                    : ((b.marketCap ?? b.fdvUsd ?? 0) - (a.marketCap ?? a.fdvUsd ?? 0)) || ((b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0))
        )
        .slice(0, 4);

    if (sorted.length === 0) {
        return withContext({
            intent: "leaderboard",
            title: scope === "volume" ? "BAGS VOLUME BOARD" : scope === "txns" ? "BAGS TRANSACTION BOARD" : "BAGS MARKET CAP BOARD",
            priorityNotice: INVESTMENT_NOTICE,
            summary:
                scope === "volume"
                    ? "I could not build a live Bags volume board on this pass because the BAGS market surface is not exposing enough current volume fields."
                    : scope === "txns"
                        ? "I could not build a live Bags transaction board on this pass because the BAGS market surface is not exposing enough transaction fields."
                        : "I could not build a live Bags market-cap board on this pass because the BAGS market surface is not exposing enough valuation fields.",
            bullets: [
                "This board uses the live BAGS market board for market ranking.",
                "If the live board is sparse, I avoid inventing a leaderboard.",
                "You can still ask about specific tokens, recent launches, or official creator and fee data.",
            ],
            cards: [],
            actions: [action("Open Live Bags Board", "https://dexscreener.com/solana/bags", "info")],
            suggestions: [
                scope === "volume"
                    ? "Show me recent launches on BAGS"
                    : scope === "txns"
                        ? "Show me the volume board"
                        : "Show me the live market flow",
                "Who created $HIVE?",
                "What fees has $SCAN earned?",
            ],
        });
    }

    return withContext({
        intent: "leaderboard",
        title: scope === "volume" ? "BAGS VOLUME BOARD" : scope === "txns" ? "BAGS TRANSACTION BOARD" : "BAGS MARKET CAP BOARD",
        priorityNotice: INVESTMENT_NOTICE,
        summary:
            scope === "volume"
                ? "This board is ranked directly by live BAGS 24h volume, with transaction count and market cap used as tie-break support."
                : scope === "txns"
                    ? "This board is ranked directly by live BAGS 24h transaction count, with volume and market cap used as tie-break support."
                    : "This board is ranked directly by live BAGS market cap, with FDV used when market cap is missing.",
        bullets: [
            `${formatNumber(sorted.length, false)} live Bags tokens are shown in this slice.`,
            sorted[0]
                ? `${sorted[0].name ?? sorted[0].symbol ?? shortenAddress(sorted[0].tokenMint, 6)} currently leads this official board.`
                : "No live Bags tokens matched this board.",
            "This is the live market-ranking lane. Token identity, fees, and claims still stay on official BAGS data.",
        ],
        cards: sorted.map((pair, index) => buildDexBoardCard(pair, `Rank #${index + 1}`)),
        actions: [
            action("Open Live Bags Board", "https://dexscreener.com/solana/bags", "info"),
            ...(sorted[0] ? [action(`Open ${sorted[0].symbol ?? "Lead Token"}`, getBagsTokenHref(sorted[0].tokenMint))] : []),
        ],
        suggestions: [
            scope === "volume"
                ? "Show me the market cap board"
                : scope === "txns"
                    ? "Show me the volume board"
                    : "Show me the volume board",
            "Show me recent launches on BAGS",
            "Tell me about this token",
            "Who created this token?",
        ],
    }, buildTalkContext("leaderboard", sorted[0]));
}

async function buildTokenReply(
    query: string,
    focus: NonNullable<ParsedPrompt["tokenFocus"]> = "overview"
): Promise<TalkReply> {
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

    const shouldLoadCreators = focus === "creator" || focus === "overview";
    const shouldLoadFees = focus === "fees" || focus === "overview";
    const shouldLoadClaims = focus === "claims" || focus === "fees" || focus === "overview";
    const shouldLoadPoolInfo = focus === "overview";

    const [poolInfoResult, creatorsResult, feesResult, claimStatsResult] = await Promise.all([
        shouldLoadPoolInfo
            ? loadTokenPoolInfo(pool.tokenMint)
            : Promise.resolve(missingFetchResult<Awaited<ReturnType<typeof getBagsPoolInfo>>>(null)),
        shouldLoadCreators
            ? loadTokenCreators(pool.tokenMint)
            : Promise.resolve(missingFetchResult<Awaited<ReturnType<typeof getCreatorsV3>>>([])),
        shouldLoadFees
            ? loadTokenLifetimeFees(pool.tokenMint)
            : Promise.resolve(missingFetchResult<Awaited<ReturnType<typeof getLifetimeFees>>>(null)),
        shouldLoadClaims
            ? loadTokenClaimStats(pool.tokenMint)
            : Promise.resolve(missingFetchResult<Awaited<ReturnType<typeof getClaimStatsDetailed>>>([])),
    ]);

    const primaryCreator = getPrimaryCreator(creatorsResult.data);
    const lifetimeFeesSol = lamportsToSol(feesResult.data);
    const claimStats = claimStatsResult.data;
    const totalClaimedSol = sumClaimedSol(claimStats);
    const valuation = getValuationMetric({ marketCap: pool.marketCap, fdvUsd: pool.fdvUsd });
    const socials = getOfficialProjectSocials(pool);
    const normalizedQuery = normalizeSearchKey(query);
    const normalizedName = normalizeSearchKey(pool.name);
    const normalizedSymbol = normalizeSearchKey(pool.symbol);
    const matchedViaProjectAlias =
        normalizedQuery.length >= 3 &&
        normalizedName.includes(normalizedQuery) &&
        normalizedQuery !== normalizedSymbol &&
        normalizedName !== normalizedQuery;
    const identity = getOfficialIdentityLabel(pool);
    const creatorLabel = getCreatorDisplayLabel(primaryCreator);
    const aliasResolutionLine =
        matchedViaProjectAlias && pool.symbol
            ? `Your query matched the official project name ${pool.name}; the official BAGS token symbol for this pool is $${pool.symbol}.`
            : undefined;
    const baseCards: TalkCard[] = [
        buildOfficialPoolCard(pool, "Official pool"),
        buildBubbleMapTalkCard(pool),
    ];
    const baseActions: TalkAction[] = [action("Open BAGS Token", getBagsTokenHref(pool.tokenMint), "info")];

    if (socials.website) baseActions.push(action("Open Website", socials.website));
    if (socials.xUrl) baseActions.push(action("Open X", socials.xUrl));
    if (socials.telegram) baseActions.push(action("Open Telegram", socials.telegram));

    if (focus === "creator") {
        return withContext({
            intent: "token",
            title: creatorLabel ? `${identity} // CREATOR` : `${identity} // CREATOR CHECK`,
            summary: primaryCreator
                ? creatorsResult.source === "stale"
                    ? `Using the most recent verified official creator snapshot, ${identity}${pool.symbol ? ` ($${pool.symbol})` : ""} was created by ${creatorLabel} on BAGS.`
                    : `${identity}${pool.symbol ? ` ($${pool.symbol})` : ""} was created by ${creatorLabel} on BAGS.`
                : creatorsResult.status === "rate_limited"
                    ? `I resolved ${identity}, but the official creator endpoint is rate-limited right now.`
                    : `I resolved ${identity}, but the official creator endpoint does not currently expose a creator profile for it.`,
            bullets: [
                ...(aliasResolutionLine ? [aliasResolutionLine] : []),
                ...(creatorsResult.source === "stale" ? [getStaleSnapshotMessage("creator")] : []),
                ...(primaryCreator
                    ? [
                        `Creator wallet: ${shortenAddress(primaryCreator.wallet, 6)}.`,
                        `Royalty is set to ${formatNumber(primaryCreator.royaltyBps ?? 0, false)} BPS (${((primaryCreator.royaltyBps ?? 0) / 100).toFixed(2)}%).`,
                        primaryCreator.isAdmin
                            ? "This creator profile is also marked as an admin in the official BAGS creator feed."
                            : "This creator profile is marked as the primary creator in the official BAGS feed.",
                    ]
                    : [
                        buildDataAvailabilityLine("creator", creatorsResult) ?? getMissingMessage("creator"),
                        socials.xHandle
                            ? `The official pool surface currently points to @${socials.xHandle} as the visible public project identity.`
                            : `The official pool still resolves cleanly to ${identity}.`,
                    ]),
            ],
            cards: [
                ...baseCards,
                {
                    id: `${pool.tokenMint}-creator`,
                    title: primaryCreator ? "Official Creator" : "Creator Verification",
                    subtitle: primaryCreator
                        ? [creatorLabel, primaryCreator.username].filter(Boolean).join(" • ")
                        : creatorsResult.status === "rate_limited"
                            ? "Creator endpoint throttled"
                            : "No creator profile returned",
                    eyebrow: "CREATOR",
                    description: primaryCreator
                        ? `Verified from the official BAGS creator surface for ${identity}.`
                        : creatorsResult.status === "rate_limited"
                            ? "The official creator endpoint is throttled right now, so only the pool identity can be shown."
                            : "The official creator endpoint did not return a profile for this token on this pass.",
                    metrics: [
                        metric("ROYALTY", primaryCreator?.royaltyBps !== undefined ? `${((primaryCreator.royaltyBps ?? 0) / 100).toFixed(2)}%` : "—", "default"),
                        metric("PRIMARY", primaryCreator?.isCreator ? "YES" : "—", "info"),
                        metric("ADMIN", primaryCreator?.isAdmin ? "YES" : "—", "default"),
                    ],
                },
            ],
            actions: baseActions.slice(0, 3),
            suggestions: [
                "What fees has this token earned?",
                "Show claim stats for this token",
                "Show me this token's official links",
            ],
        }, buildTalkContext("token", pool));
    }

    if (focus === "fees") {
        return withContext({
            intent: "token",
            title: `${identity} // FEES`,
            summary:
                feesResult.status === "ok" && lifetimeFeesSol !== undefined
                    ? feesResult.source === "stale"
                        ? `Using the most recent verified official fee snapshot, ${identity}${pool.symbol ? ` ($${pool.symbol})` : ""} has earned ${formatSolAmount(lifetimeFeesSol)} in official lifetime fees on BAGS.`
                        : `${identity}${pool.symbol ? ` ($${pool.symbol})` : ""} has earned ${formatSolAmount(lifetimeFeesSol)} in official lifetime fees on BAGS.`
                    : feesResult.status === "rate_limited"
                        ? `I resolved ${identity}, but the official lifetime-fees endpoint is rate-limited right now.`
                        : feesResult.status === "missing"
                            ? `I resolved ${identity}, but the official lifetime-fees endpoint is not exposing a value for it right now.`
                            : `I resolved ${identity}, but I could not verify official lifetime-fee data on this pass.`,
            bullets: [
                ...(aliasResolutionLine ? [aliasResolutionLine] : []),
                ...(feesResult.source === "stale" ? [getStaleSnapshotMessage("lifetime fees")] : []),
                ...(feesResult.status === "ok" && lifetimeFeesSol !== undefined
                    ? [`Official lifetime fees currently read ${formatSolAmount(lifetimeFeesSol)}.`]
                    : [buildDataAvailabilityLine("lifetime fees", feesResult) ?? getMissingMessage("lifetime fees")]),
                ...(claimStatsResult.source === "stale" ? [getStaleSnapshotMessage("claim stats")] : []),
                ...(claimStatsResult.status === "ok"
                    ? [`Official claim stats show ${formatNumber(claimStats.length, false)} visible claimers with ${formatSolAmount(totalClaimedSol)} claimed in total.`]
                    : [buildDataAvailabilityLine("claim stats", claimStatsResult) ?? getMissingMessage("claim stats")]),
                claimStatsResult.status === "ok" && feesResult.status === "ok" && lifetimeFeesSol !== undefined
                    ? `Net unclaimed remainder across the visible official surfaces is approximately ${formatSolAmount(Math.max(0, lifetimeFeesSol - totalClaimedSol))}.`
                    : "This fee answer stays inside official BAGS fee and claim endpoints only.",
            ],
            cards: [
                ...baseCards,
                {
                    id: `${pool.tokenMint}-fees`,
                    title: "Official Fee Surface",
                    subtitle: pool.symbol ? `$${pool.symbol}` : shortenAddress(pool.tokenMint, 5),
                    eyebrow: "FEES",
                    description: "Lifetime fees and claim stats from official BAGS fee-share endpoints.",
                    metrics: [
                        metric("FEES", lifetimeFeesSol !== undefined ? formatSolAmount(lifetimeFeesSol) : feesResult.status === "rate_limited" ? "THROTTLED" : "—", feesResult.status === "rate_limited" ? "warning" : "info"),
                        metric("CLAIMERS", claimStatsResult.status === "ok" ? formatNumber(claimStats.length, false) : claimStatsResult.status === "rate_limited" ? "THROTTLED" : "—", "default"),
                        metric("CLAIMED", claimStatsResult.status === "ok" ? formatSolAmount(totalClaimedSol) : claimStatsResult.status === "rate_limited" ? "THROTTLED" : "—", "default"),
                    ],
                },
            ],
            actions: baseActions.slice(0, 3),
            suggestions: [
                "Who created this token?",
                "Show claim stats for this token",
                "Tell me about this token",
            ],
        }, buildTalkContext("token", pool));
    }

    if (focus === "claims") {
        return withContext({
            intent: "token",
            title: `${identity} // CLAIMS`,
            summary:
                claimStatsResult.status === "ok"
                    ? claimStatsResult.source === "stale"
                        ? `Using the most recent verified official claims snapshot, ${identity}${pool.symbol ? ` ($${pool.symbol})` : ""} shows ${formatNumber(claimStats.length, false)} visible claimers in official BAGS claim stats.`
                        : `${identity}${pool.symbol ? ` ($${pool.symbol})` : ""} shows ${formatNumber(claimStats.length, false)} visible claimers in official BAGS claim stats.`
                    : claimStatsResult.status === "rate_limited"
                        ? `I resolved ${identity}, but the official claim-stats endpoint is rate-limited right now.`
                        : claimStatsResult.status === "missing"
                            ? `I resolved ${identity}, but no official claim stats are currently exposed for it.`
                            : `I resolved ${identity}, but I could not verify official claim stats on this pass.`,
            bullets: [
                ...(aliasResolutionLine ? [aliasResolutionLine] : []),
                ...(claimStatsResult.source === "stale" ? [getStaleSnapshotMessage("claim stats")] : []),
                ...(claimStatsResult.status === "ok"
                    ? [
                        `Official claim stats currently show ${formatNumber(claimStats.length, false)} visible claimers.`,
                        `Total claimed currently reads ${formatSolAmount(totalClaimedSol)} across those claimers.`,
                    ]
                    : [buildDataAvailabilityLine("claim stats", claimStatsResult) ?? getMissingMessage("claim stats")]),
                feesResult.status === "ok" && lifetimeFeesSol !== undefined
                    ? `Official lifetime fees for the same token currently read ${formatSolAmount(lifetimeFeesSol)}.`
                    : "This claims answer stays inside official BAGS claim and fee-share data only.",
            ],
            cards: [
                ...baseCards,
                {
                    id: `${pool.tokenMint}-claims`,
                    title: "Official Claim Stats",
                    subtitle: pool.symbol ? `$${pool.symbol}` : shortenAddress(pool.tokenMint, 5),
                    eyebrow: "CLAIMS",
                    description: claimStatsResult.status === "ok"
                        ? "Visible claimers and claimed totals from the official BAGS claim-stats endpoint."
                        : claimStatsResult.status === "rate_limited"
                            ? "The official claim-stats endpoint is throttled on this pass."
                            : "No official claim-stats entries were returned for this token.",
                    metrics: [
                        metric("CLAIMERS", claimStatsResult.status === "ok" ? formatNumber(claimStats.length, false) : claimStatsResult.status === "rate_limited" ? "THROTTLED" : "0", claimStatsResult.status === "ok" ? "info" : "warning"),
                        metric("CLAIMED", claimStatsResult.status === "ok" ? formatSolAmount(totalClaimedSol) : claimStatsResult.status === "rate_limited" ? "THROTTLED" : "—", "default"),
                    ],
                },
            ],
            actions: baseActions.slice(0, 3),
            suggestions: [
                "What fees has this token earned?",
                "Who created this token?",
                "Tell me about this token",
            ],
        }, buildTalkContext("token", pool));
    }

    if (focus === "socials") {
        const hasAnySocial = Boolean(socials.xHandle || socials.website || socials.telegram);
        return withContext({
            intent: "token",
            title: `${identity} // OFFICIAL LINKS`,
            summary: hasAnySocial
                ? `These are the public links currently exposed for ${identity} across official BAGS surfaces.`
                : `I resolved ${identity}, but official BAGS surfaces are not currently exposing public links for it.`,
            bullets: [
                ...(aliasResolutionLine ? [aliasResolutionLine] : []),
                socials.xHandle
                    ? `Official X handle: @${socials.xHandle}.`
                    : "No official X handle is currently exposed for this token.",
                socials.website
                    ? `Official website: ${normalizeWebsiteHost(socials.website) ?? socials.website}.`
                    : "No official website is currently exposed for this token.",
                socials.telegram
                    ? `Official Telegram: ${socials.telegram.replace(/^https?:\/\//i, "")}.`
                    : "No official Telegram link is currently exposed for this token.",
                pool.projectTwitterFollowers !== undefined
                    ? `Official follower count currently visible on BAGS-linked surfaces: ${formatNumber(pool.projectTwitterFollowers)}.`
                    : "No official follower count is currently exposed for the project account on this pass.",
            ],
            cards: [
                ...baseCards,
                {
                    id: `${pool.tokenMint}-socials`,
                    title: "Official Public Identity",
                    subtitle: socials.xHandle ? `@${socials.xHandle}` : "No handle exposed",
                    eyebrow: "LINKS",
                    description: hasAnySocial
                        ? "Only links exposed through official BAGS token or hackathon surfaces are shown here."
                        : "The resolved official token currently has no public links exposed on the available BAGS surfaces.",
                    metrics: [
                        metric("X", socials.xHandle ? `@${socials.xHandle}` : "—", "info"),
                        metric("FOLLOWERS", pool.projectTwitterFollowers !== undefined ? formatNumber(pool.projectTwitterFollowers) : "—", "default"),
                        metric("WEB", normalizeWebsiteHost(socials.website) ?? "—", "default"),
                        metric("TG", socials.telegram ? "YES" : "—", "default"),
                    ],
                },
            ],
            actions: baseActions.slice(0, 3),
            suggestions: [
                "Who created this token?",
                "Tell me about this token",
                "What fees has this token earned?",
            ],
        }, buildTalkContext("token", pool));
    }

    const overviewBullets: string[] = [];
    const rateLimitedOrErroredDetails = [creatorsResult, feesResult, claimStatsResult, poolInfoResult].filter(
        (result) => result.status === "rate_limited" || result.status === "error"
    ).length;

    if (aliasResolutionLine) {
        overviewBullets.push(aliasResolutionLine);
    }

    if (creatorLabel) {
        overviewBullets.push(`Official creator: ${creatorLabel}.`);
    } else if (socials.xHandle) {
        overviewBullets.push(`Official public identity currently points to @${socials.xHandle}.`);
    }

    if (lifetimeFeesSol !== undefined) {
        overviewBullets.push(`Official lifetime fees: ${formatSolAmount(lifetimeFeesSol)}.`);
    } else if (valuation.value !== undefined) {
        overviewBullets.push(`${valuation.longLabel} currently reads ${formatCurrency(valuation.value)}.`);
    }

    if (claimStatsResult.status === "ok" && claimStats.length > 0) {
        overviewBullets.push(`${formatNumber(claimStats.length, false)} visible claimers have claimed ${formatSolAmount(totalClaimedSol)} in total.`);
    }

    if (poolInfoResult.status === "ok" && poolInfoResult.data?.dammV2PoolKey) {
        overviewBullets.push("This pool shows a migrated DAMM v2 key.");
    }

    if (rateLimitedOrErroredDetails > 0) {
        overviewBullets.push("Some official detail endpoints are temporarily limited, so this snapshot is intentionally lighter right now.");
    }
    if ([creatorsResult, feesResult, claimStatsResult, poolInfoResult].some((result) => result.source === "stale")) {
        overviewBullets.push("Recent verified official snapshots were reused where live endpoints were temporarily busy.");
    }

    if (overviewBullets.length === 0) {
        overviewBullets.push("This token is resolved cleanly from official BAGS surfaces.");
    }

    return withContext({
        intent: "token",
        title: pool.name ?? pool.symbol ?? shortenAddress(pool.tokenMint, 6),
        summary: `${identity}${pool.symbol ? ` ($${pool.symbol})` : ""} is resolved from official BAGS surfaces.`,
        bullets: overviewBullets.slice(0, 3),
        cards: [
            ...baseCards,
            {
                id: `${pool.tokenMint}-snapshot`,
                title: "Official Snapshot",
                subtitle: pool.symbol ? `$${pool.symbol}` : shortenAddress(pool.tokenMint, 5),
                eyebrow: "TOKEN",
                description: "Overview generated only from official BAGS pool, creator, fee, and claim surfaces.",
                metrics: [
                    metric(valuation.shortLabel, valuation.value !== undefined ? formatCurrency(valuation.value) : "—", "info"),
                    metric("FEES", lifetimeFeesSol !== undefined ? formatSolAmount(lifetimeFeesSol) : feesResult.status === "rate_limited" ? "THROTTLED" : "—", "default"),
                    metric("CLAIMERS", claimStatsResult.status === "ok" ? formatNumber(claimStats.length, false) : claimStatsResult.status === "rate_limited" ? "THROTTLED" : "—", "default"),
                    metric("CREATOR", creatorLabel ?? (creatorsResult.status === "rate_limited" ? "THROTTLED" : "—"), creatorLabel ? "positive" : "default"),
                ],
            },
        ],
        actions: baseActions.slice(0, 3),
        suggestions: [
            "Who created this token?",
            "What fees has this token earned?",
            "Show me this token's official links",
            "Show claim stats for this token",
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
        case "docs":
            return buildDocsReply(parsed.docsTopicId);
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
            return resolvedTokenQuery ? await buildTokenReply(resolvedTokenQuery, parsed.tokenFocus ?? "overview") : buildNeedTokenReply(context);
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
