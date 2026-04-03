import bs58 from "bs58";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import type {
    TradeQuoteResponse,
    TokenLaunchCreator,
    TokenLaunchCreatorV3WithClaimStats,
} from "@bagsfm/bags-sdk/dist/types";
import type {
    BagsApiResponse,
    BagsPoolsResponse,
    BagsPool,
    BagsPoolInfo,
    BagsCreatorV3,
    BagsCreatorResponse,
    BagsClaimStatsResponse,
    BagsClaimStatEntry,
    BagsClaimEventsResponse,
    BagsClaimablePosition,
    BagsFeeShareWalletLookupRequest,
    BagsFeeShareWalletLookupResponse,
    BagsQuoteRequest,
    BagsQuoteResponse,
    BagsSwapRequest,
    BagsSwapResponse,
    BagsCreateTokenInfoRequest,
    BagsCreateTokenInfoResponse,
    BagsFeeShareConfigRequest,
    BagsFeeShareConfigResponse,
    BagsLaunchRequest,
    BagsLaunchResponse,
    BagsPartnerStatsResponse,
    BagsPartnerClaimResponse,
    BagsIncorporateCompanyRequest,
    BagsIncorporationPaymentResponse,
    BagsIncorporationProject,
    BagsStartIncorporationResponse,
    HeliusAsset,
    BagsConfigType,
} from "./types";
import { getBagsSdk } from "./sdk";
import { getRpcUrl, SOL_MINT } from "@/lib/solana";

const BASE = () => {
    const url = process.env.BAGS_API_BASE_URL || "https://public-api-v2.bags.fm/api/v1";
    return url.endsWith("/") ? url.slice(0, -1) : url;
};

function headers(): HeadersInit {
    const h: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
    };
    const key = process.env.BAGS_API_KEY;
    if (key) h["x-api-key"] = key;
    return h;
}

async function unwrap<T>(res: Response): Promise<T> {
    const text = await res.text().catch(() => "");
    let json: BagsApiResponse<T> | null = null;

    if (text) {
        try {
            json = JSON.parse(text) as BagsApiResponse<T>;
        } catch {
            json = null;
        }
    }

    if (!res.ok) {
        const detail =
            typeof json?.error === "string"
                ? json.error
                : typeof json?.response === "string"
                    ? json.response
                    : text;
        throw new Error(`Bags API ${res.status}: ${detail || "unknown error"}`);
    }

    if (!json) {
        throw new Error("Bags API returned an empty or invalid JSON response");
    }

    if (!json.success) {
        const detail =
            typeof json.error === "string"
                ? json.error
                : typeof json.response === "string"
                    ? json.response
                    : JSON.stringify(json.error) ?? "unknown";
        throw new Error(`Bags API error: ${detail}`);
    }

    return json.response as T;
}

async function fetchWithRetry(
    url: string,
    init: RequestInit,
    retries = 2,
    delayMs = 500
): Promise<Response> {
    let lastError: Error | null = null;

    for (let i = 0; i <= retries; i += 1) {
        try {
            const res = await fetch(url, init);
            if (res.ok || res.status < 500) return res;
            lastError = new Error(`HTTP ${res.status}`);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }

        if (i < retries) {
            await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
        }
    }

    throw lastError ?? new Error("fetchWithRetry failed");
}

async function bagsGet<T>(
    path: string,
    opts?: { revalidate?: number; tags?: string[]; cache?: RequestCache; timeoutMs?: number }
): Promise<T> {
    const url = `${BASE()}${path}`;
    const init: RequestInit = {
        method: "GET",
        headers: headers(),
        signal: AbortSignal.timeout(opts?.timeoutMs ?? 15_000),
    };

    if (opts?.cache) {
        init.cache = opts.cache;
    } else {
        init.next = {
            revalidate: opts?.revalidate ?? 60,
            tags: opts?.tags,
        };
    }

    const res = await fetchWithRetry(url, init);
    return unwrap<T>(res);
}

async function bagsPost<T>(path: string, body: unknown): Promise<T> {
    const url = `${BASE()}${path}`;
    const res = await fetchWithRetry(
        url,
        {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(body),
            cache: "no-store",
        },
        2,
        400
    );
    return unwrap<T>(res);
}

function toPublicKey(value: string, label = "public key") {
    try {
        return new PublicKey(value);
    } catch {
        throw new Error(`Invalid ${label}: ${value}`);
    }
}

function encodeTransaction(tx: VersionedTransaction) {
    return bs58.encode(tx.serialize());
}

function encodeTransactionBase64(tx: VersionedTransaction) {
    return Buffer.from(tx.serialize()).toString("base64");
}

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiErrorDetail(error: unknown) {
    if (!error || typeof error !== "object") return error instanceof Error ? error.message : String(error);

    const maybeError = error as {
        message?: string;
        status?: number;
        data?: unknown;
    };

    if (maybeError.data && typeof maybeError.data === "object") {
        const payload = maybeError.data as Record<string, unknown>;
        if (typeof payload.error === "string") return payload.error;
        if (typeof payload.message === "string") return payload.message;
        if (payload.error && typeof payload.error === "object") {
            const nested = payload.error as Record<string, unknown>;
            if (typeof nested.message === "string") return nested.message;
        }
    }

    return maybeError.message ?? String(error);
}

function buildTxBlockhash(tx: VersionedTransaction) {
    return {
        blockhash: tx.message.recentBlockhash,
        lastValidBlockHeight: 0,
    };
}

function normalizeCreator(creator: TokenLaunchCreator): BagsCreatorV3 {
    return {
        username: creator.username,
        pfp: creator.pfp,
        royaltyBps: creator.royaltyBps,
        isCreator: creator.isCreator,
        wallet: creator.wallet,
        provider: creator.provider,
        providerUsername: creator.providerUsername,
        twitterUsername: creator.twitterUsername,
        bagsUsername: creator.bagsUsername,
        isAdmin: creator.isAdmin,
    };
}

function normalizeClaimStatEntry(entry: TokenLaunchCreatorV3WithClaimStats): BagsClaimStatEntry {
    return {
        username: entry.username,
        pfp: entry.pfp,
        royaltyBps: entry.royaltyBps,
        isCreator: entry.isCreator,
        wallet: entry.wallet,
        provider: entry.provider,
        providerUsername: entry.providerUsername,
        twitterUsername: entry.twitterUsername,
        bagsUsername: entry.bagsUsername,
        isAdmin: entry.isAdmin,
        totalClaimed: entry.totalClaimed,
    };
}

function normalizeClaimablePosition(position: Record<string, unknown>): BagsClaimablePosition {
    const customFeeVaultBps =
        typeof position.customFeeVaultBps === "number" ? position.customFeeVaultBps : null;

    return {
        programId: typeof position.programId === "string" ? position.programId : undefined,
        isCustomFeeVault: Boolean(position.isCustomFeeVault),
        baseMint: String(position.baseMint ?? ""),
        quoteMint: typeof position.quoteMint === "string" ? position.quoteMint : null,
        virtualPool:
            typeof position.virtualPool === "string"
                ? position.virtualPool
                : typeof position.virtualPoolAddress === "string"
                    ? position.virtualPoolAddress
                    : undefined,
        isMigrated: Boolean(position.isMigrated),
        totalClaimableLamportsUserShare: Number(position.totalClaimableLamportsUserShare ?? 0),
        claimableDisplayAmount:
            typeof position.claimableDisplayAmount === "number"
                ? position.claimableDisplayAmount
                : null,
        user: typeof position.user === "string" ? position.user : null,
        claimerIndex:
            typeof position.claimerIndex === "number" ? position.claimerIndex : null,
        userBps:
            typeof position.userBps === "number"
                ? position.userBps
                : customFeeVaultBps,
    };
}

function isSdkFeeShareWalletProvider(provider: string) {
    return ["twitter", "x", "github", "kick", "tiktok"].includes(provider.toLowerCase());
}

function toSdkFeeShareWalletProvider(provider: string) {
    const lowered = provider.toLowerCase();
    if (lowered === "x") return "twitter";
    if (lowered === "tg") return "telegram";
    return lowered;
}

async function createTokenInfoViaApi(
    req: BagsCreateTokenInfoRequest
): Promise<BagsCreateTokenInfoResponse> {
    const url = `${BASE()}/token-launch/create-token-info`;
    const form = new FormData();
    form.append("name", req.name);
    form.append("symbol", req.symbol);
    form.append("description", req.description);
    if (req.image) form.append("image", req.image);
    if (req.imageUrl) form.append("imageUrl", req.imageUrl);
    if (req.metadataUrl) form.append("metadataUrl", req.metadataUrl);
    if (req.website) form.append("website", req.website);
    if (req.twitter) form.append("twitter", req.twitter);
    if (req.telegram) form.append("telegram", req.telegram);

    const uploadHeaders: Record<string, string> = { Accept: "application/json" };
    const key = process.env.BAGS_API_KEY;
    if (key) uploadHeaders["x-api-key"] = key;

    const res = await fetchWithRetry(
        url,
        { method: "POST", headers: uploadHeaders, body: form, cache: "no-store" },
        2,
        400
    );

    return unwrap<BagsCreateTokenInfoResponse>(res);
}

async function createFeeShareConfigViaApi(
    req: BagsFeeShareConfigRequest
): Promise<BagsFeeShareConfigResponse> {
    return bagsPost<BagsFeeShareConfigResponse>("/fee-share/config", req);
}

export async function getBagsPools(): Promise<BagsPool[]> {
    const data = await bagsGet<BagsPool[] | BagsPoolsResponse>("/solana/bags/pools", {
        cache: "no-store",
        timeoutMs: 25_000,
    });
    if (Array.isArray(data)) return data;
    return data.pools ?? data.tokens ?? data.data ?? [];
}

export async function getBagsPoolInfo(tokenMint: string): Promise<BagsPoolInfo | null> {
    try {
        return await bagsGet<BagsPoolInfo>(
            `/solana/bags/pools/token-mint?tokenMint=${tokenMint}`,
            { revalidate: 60 }
        );
    } catch {
        return null;
    }
}

export async function getBagsPool(tokenMint: string): Promise<BagsPool | null> {
    try {
        const data = await bagsGet<BagsPool>(
            `/solana/bags/pools/token-mint?tokenMint=${tokenMint}`,
            { revalidate: 15 }
        );
        return data ?? null;
    } catch {
        return null;
    }
}

export async function getCreatorsV3(tokenMint: string): Promise<BagsCreatorV3[]> {
    try {
        const creators = await getBagsSdk().state.getTokenCreators(toPublicKey(tokenMint, "token mint"));
        return creators.map(normalizeCreator);
    } catch {
        return [];
    }
}

export async function getCreatorInfo(tokenMint: string): Promise<BagsCreatorResponse | null> {
    const creators = await getCreatorsV3(tokenMint);
    const primaryCreator = creators.find((creator) => creator.isCreator) ?? creators[0];

    if (!primaryCreator) return null;

    return {
        creatorWallet: primaryCreator.wallet,
        creatorDisplayName:
            primaryCreator.providerUsername ??
            primaryCreator.twitterUsername ??
            primaryCreator.bagsUsername ??
            primaryCreator.username,
        creatorUsername: primaryCreator.username,
        creatorPfp: primaryCreator.pfp,
        provider: primaryCreator.provider ?? undefined,
        providerUsername: primaryCreator.providerUsername ?? undefined,
        royaltyBps: primaryCreator.royaltyBps,
        isCreator: primaryCreator.isCreator,
        isAdmin: primaryCreator.isAdmin,
    };
}

export async function getLifetimeFees(tokenMint: string): Promise<string | null> {
    try {
        const lamports = await getBagsSdk().state.getTokenLifetimeFees(toPublicKey(tokenMint, "token mint"));
        return String(lamports);
    } catch {
        return null;
    }
}

export async function getClaimStatsDetailed(tokenMint: string): Promise<BagsClaimStatEntry[]> {
    try {
        const stats = await getBagsSdk().state.getTokenClaimStats(toPublicKey(tokenMint, "token mint"));
        return stats.map(normalizeClaimStatEntry);
    } catch {
        return [];
    }
}

export async function getClaimStats(tokenMint: string): Promise<BagsClaimStatsResponse | null> {
    try {
        const stats = await getClaimStatsDetailed(tokenMint);
        const claimVolume = stats.reduce((sum, entry) => {
            const parsed = Number(entry.totalClaimed);
            return sum + (Number.isFinite(parsed) ? parsed : 0);
        }, 0);

        return {
            claimCount: stats.length,
            claimVolume,
        };
    } catch {
        return null;
    }
}

export async function getClaimEvents(
    tokenMint: string,
    opts?: { mode?: "offset" | "time"; limit?: number; offset?: number; from?: number; to?: number }
): Promise<BagsClaimEventsResponse | null> {
    try {
        const params = new URLSearchParams({ tokenMint });
        if (opts?.mode) params.set("mode", opts.mode);
        if (opts?.limit) params.set("limit", String(opts.limit));
        if (opts?.offset !== undefined) params.set("offset", String(opts.offset));
        if (opts?.from !== undefined) params.set("from", String(opts.from));
        if (opts?.to !== undefined) params.set("to", String(opts.to));

        return await bagsGet<BagsClaimEventsResponse>(`/fee-share/token/claim-events?${params}`, {
            revalidate: 30,
        });
    } catch {
        return null;
    }
}

export async function getClaimablePositions(wallet: string): Promise<BagsClaimablePosition[]> {
    try {
        const positions = await getBagsSdk().fee.getAllClaimablePositions(toPublicKey(wallet, "wallet"));
        return positions.map((position) =>
            normalizeClaimablePosition(position as unknown as Record<string, unknown>)
        );
    } catch {
        return [];
    }
}

export async function getFeeShareWallet(
    req: BagsFeeShareWalletLookupRequest
): Promise<BagsFeeShareWalletLookupResponse | null> {
    if (!isSdkFeeShareWalletProvider(req.provider)) {
        try {
            const params = new URLSearchParams({
                provider: req.provider,
                username: req.username,
            });
            return await bagsGet<BagsFeeShareWalletLookupResponse>(
                `/fee-share/wallet/v2?${params}`,
                { revalidate: 0, cache: "no-store" }
            );
        } catch {
            return null;
        }
    }

    try {
        const result = await getBagsSdk().state.getLaunchWalletV2(
            req.username,
            toSdkFeeShareWalletProvider(req.provider) as "twitter" | "github" | "kick" | "tiktok"
        );

        const wallet = result.wallet.toBase58();
        return {
            provider: req.provider,
            username: req.username,
            wallet,
            address: wallet,
        };
    } catch {
        return null;
    }
}

export async function getFeeShareWalletsBulk(
    items: BagsFeeShareWalletLookupRequest[]
): Promise<BagsFeeShareWalletLookupResponse[]> {
    if (items.length === 0) return [];

    const supported = items.filter((item) => isSdkFeeShareWalletProvider(item.provider));
    const unsupported = items.filter((item) => !isSdkFeeShareWalletProvider(item.provider));

    const sdkPromise = (async () => {
        if (supported.length === 0) return [] as BagsFeeShareWalletLookupResponse[];
        try {
            const resolved = await getBagsSdk().state.getLaunchWalletV2Bulk(
                supported.map((item) => ({
                    provider: toSdkFeeShareWalletProvider(item.provider) as "twitter" | "github" | "kick" | "tiktok",
                    username: item.username,
                }))
            );

            return resolved.map((entry) => ({
                provider: entry.provider,
                username: entry.username,
                wallet: entry.wallet?.toBase58() ?? null,
                address: entry.wallet?.toBase58() ?? null,
            }));
        } catch {
            return [] as BagsFeeShareWalletLookupResponse[];
        }
    })();

    const apiPromise = (async () => {
        if (unsupported.length === 0) return [] as BagsFeeShareWalletLookupResponse[];
        const attempts: unknown[] = [unsupported, { items: unsupported }, { wallets: unsupported }];

        for (const body of attempts) {
            try {
                const data = await bagsPost<
                    BagsFeeShareWalletLookupResponse[] | {
                        wallets?: BagsFeeShareWalletLookupResponse[];
                        items?: BagsFeeShareWalletLookupResponse[];
                    }
                >("/fee-share/wallet/v2/bulk", body);

                if (Array.isArray(data)) return data;
                return data.wallets ?? data.items ?? [];
            } catch {
                continue;
            }
        }

        return [] as BagsFeeShareWalletLookupResponse[];
    })();

    const [sdkResolved, apiResolved] = await Promise.all([sdkPromise, apiPromise]);
    return [...sdkResolved, ...apiResolved];
}

export async function getQuote(req: BagsQuoteRequest): Promise<BagsQuoteResponse> {
    const outputMint = req.outputMint ?? req.tokenMint;
    if (!outputMint) {
        throw new Error("Missing outputMint (or legacy tokenMint) for quote request");
    }

    const inputMint = req.inputMint ?? SOL_MINT;
    const amount = normalizeTradeAmount(req.amount, inputMint);
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
        throw new Error("Trade amount must be a positive number");
    }

    const quote = await getBagsSdk().trade.getQuote({
        inputMint: toPublicKey(inputMint, "input mint"),
        outputMint: toPublicKey(outputMint, "output mint"),
        amount,
        slippageMode: req.slippageBps !== undefined ? "manual" : "auto",
        slippageBps: req.slippageBps,
    });

    return quote as unknown as BagsQuoteResponse;
}

export async function createSwapTransaction(
    req: BagsSwapRequest
): Promise<BagsSwapResponse> {
    const userPublicKey = toPublicKey(req.userPublicKey, "user public key");
    let quoteResponse = req.quoteResponse as TradeQuoteResponse | undefined;

    if (!quoteResponse) {
        const outputMint = req.outputMint ?? req.tokenMint;
        if (!outputMint) {
            throw new Error("Missing outputMint (or legacy tokenMint) for swap request");
        }

        if (req.quoteRequestId) {
            return bagsPost<BagsSwapResponse>("/trade/swap", {
                quoteRequestId: req.quoteRequestId,
                userPublicKey: req.userPublicKey,
            });
        }

        const inputMint = req.inputMint ?? SOL_MINT;
        const amount = normalizeTradeAmount(req.amount, inputMint);
        if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
            throw new Error("Missing amount for swap request");
        }

        quoteResponse = (await getQuote({
            inputMint,
            outputMint,
            amount,
            slippageBps: req.slippageBps,
        })) as unknown as TradeQuoteResponse;
    }

    const swap = await getBagsSdk().trade.createSwapTransaction({
        quoteResponse,
        userPublicKey,
    });

    const encoded = encodeTransaction(swap.transaction);
    return {
        transaction: encoded,
        serializedTransaction: encodeTransactionBase64(swap.transaction),
        swapTransaction: encoded,
        computeUnitLimit: swap.computeUnitLimit,
        lastValidBlockHeight: swap.lastValidBlockHeight,
        prioritizationFeeLamports: swap.prioritizationFeeLamports,
    };
}

function normalizeTradeAmount(amount: number | undefined, inputMint: string): number | undefined {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
        return amount;
    }

    if (inputMint === SOL_MINT && !Number.isInteger(amount)) {
        return Math.floor(amount * 1_000_000_000);
    }

    return amount;
}

export async function createTokenInfo(
    req: BagsCreateTokenInfoRequest
): Promise<BagsCreateTokenInfoResponse> {
    if (req.metadataUrl) {
        return createTokenInfoViaApi(req);
    }

    if (!req.image && !req.imageUrl) {
        throw new Error("Official Bags SDK token metadata flow requires an image or image URL");
    }

    const result = req.image
        ? await getBagsSdk().tokenLaunch.createTokenInfoAndMetadata({
            image: req.image,
            name: req.name,
            symbol: req.symbol,
            description: req.description,
            metadataUrl: req.metadataUrl,
            telegram: req.telegram,
            twitter: req.twitter,
            website: req.website,
        })
        : await getBagsSdk().tokenLaunch.createTokenInfoAndMetadata({
            imageUrl: req.imageUrl!,
            name: req.name,
            symbol: req.symbol,
            description: req.description,
            metadataUrl: req.metadataUrl,
            telegram: req.telegram,
            twitter: req.twitter,
            website: req.website,
        });

    return result as unknown as BagsCreateTokenInfoResponse;
}

export async function createFeeShareConfig(
    req: BagsFeeShareConfigRequest
): Promise<BagsFeeShareConfigResponse> {
    try {
        const result = await getBagsSdk().config.createBagsFeeShareConfig(
            {
                payer: toPublicKey(req.payer, "payer"),
                baseMint: toPublicKey(req.baseMint, "base mint"),
                feeClaimers: req.claimersArray.map((wallet, index) => ({
                    user: toPublicKey(wallet, `claimer ${index + 1}`),
                    userBps: req.basisPointsArray[index] ?? 0,
                })),
                partner: req.partner ? toPublicKey(req.partner, "partner") : undefined,
                partnerConfig: req.partnerConfig ? toPublicKey(req.partnerConfig, "partner config") : undefined,
                additionalLookupTables: req.additionalLookupTables?.map((lookupTable) =>
                    toPublicKey(lookupTable, "lookup table")
                ),
                admin: req.admin ? toPublicKey(req.admin, "admin") : undefined,
                bagsConfigType: req.bagsConfigType as BagsConfigType | undefined,
            },
            req.tipWallet && req.tipLamports
                ? {
                    tipWallet: toPublicKey(req.tipWallet, "tip wallet"),
                    tipLamports: req.tipLamports,
                }
                : undefined
        );

        return {
            needsCreation: true,
            feeShareAuthority: result.meteoraConfigKey.toBase58(),
            meteoraConfigKey: result.meteoraConfigKey.toBase58(),
            transactions: (result.transactions ?? []).map((transaction) => ({
                transaction: encodeTransaction(transaction),
                blockhash: buildTxBlockhash(transaction),
            })),
            bundles: (result.bundles ?? []).map((bundle) =>
                bundle.map((transaction) => ({
                    transaction: encodeTransaction(transaction),
                    blockhash: buildTxBlockhash(transaction),
                }))
            ),
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/config already exists/i.test(message)) {
            return createFeeShareConfigViaApi(req);
        }
        throw error;
    }
}

export async function createLaunchTransaction(
    req: BagsLaunchRequest
): Promise<BagsLaunchResponse> {
    const launchArgs = {
        metadataUrl: req.ipfs,
        tokenMint: toPublicKey(req.tokenMint, "token mint"),
        launchWallet: toPublicKey(req.wallet, "launch wallet"),
        initialBuyLamports: req.initialBuyLamports,
        configKey: toPublicKey(req.configKey, "config key"),
        tipConfig:
            req.tipWallet && req.tipLamports
                ? {
                    tipWallet: toPublicKey(req.tipWallet, "tip wallet"),
                    tipLamports: req.tipLamports,
                }
                : undefined,
    };

    let lastError: unknown;
    const retryDelays = [0, 1800, 3200, 5000];

    for (const delay of retryDelays) {
        if (delay > 0) {
            await wait(delay);
        }

        try {
            const transaction = await getBagsSdk().tokenLaunch.createLaunchTransaction(launchArgs);
            return encodeTransaction(transaction);
        } catch (error) {
            lastError = error;
            const detail = getApiErrorDetail(error);
            const status =
                error && typeof error === "object" && "status" in error
                    ? Number((error as { status?: number }).status)
                    : undefined;
            const shouldRetry = status === 400 || status === 429;

            if (!shouldRetry || delay === retryDelays[retryDelays.length - 1]) {
                throw new Error(detail);
            }
        }
    }

    throw new Error(getApiErrorDetail(lastError));
}

export async function getPartnerStats(
    partnerWallet: string
): Promise<BagsPartnerStatsResponse | null> {
    try {
        const stats = await getBagsSdk().partner.getPartnerConfigClaimStats(
            toPublicKey(partnerWallet, "partner wallet")
        );

        return {
            partnerWallet,
            partner: partnerWallet,
            claimedFees: stats.claimedFees,
            unclaimedFees: stats.unclaimedFees,
            claimableFees: stats.unclaimedFees,
        };
    } catch {
        return null;
    }
}

export async function createPartnerClaimTx(
    partnerWallet: string
): Promise<BagsPartnerClaimResponse> {
    const transactions = await getBagsSdk().partner.getPartnerConfigClaimTransactions(
        toPublicKey(partnerWallet, "partner wallet")
    );

    return {
        transactions: transactions.map((entry) => ({
            transaction: encodeTransaction(entry.transaction),
            serializedTransaction: encodeTransactionBase64(entry.transaction),
            blockhash: entry.blockhash,
        })),
    };
}

export interface HackathonApp {
    _id: string;
    uuid: string;
    name: string;
    description: string;
    category: string;
    status?: string;
    icon: string;
    tokenAddress: string;
    twitterUrl?: string;
    upvotes?: number;
    downvotes?: number;
    twitterUser?: {
        username?: string;
        name?: string;
        verified?: boolean;
        verified_type?: string;
        public_metrics?: {
            followers_count?: number;
            tweet_count?: number;
        };
    } | null;
}

export interface HackathonListResponse {
    applications: HackathonApp[];
    currentPage: number;
    totalItems: number;
    totalPages: number;
}

const HACKATHON_BASE = "https://api.bags.fm/api/v1";

export async function getHackathonApps(page = 1): Promise<HackathonListResponse> {
    try {
        const res = await fetch(`${HACKATHON_BASE}/hackathon/list?page=${page}`, {
            cache: "no-store",
            headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`Hackathon API ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error("Hackathon API error");
        return json.response as HackathonListResponse;
    } catch (error) {
        console.error("[hackathon] list error:", error);
        return { applications: [], currentPage: page, totalItems: 0, totalPages: 0 };
    }
}

interface DexScreenerPair {
    chainId?: string;
    dexId?: string;
    pairCreatedAt?: number | null;
    baseToken: {
        address?: string;
        name?: string;
        symbol?: string;
    };
    info?: {
        imageUrl?: string;
    };
    priceUsd?: string | number | null;
    fdv?: string | number | null;
    marketCap?: string | number | null;
    liquidity?: {
        usd?: string | number | null;
    };
    volume?: {
        h24?: string | number | null;
    };
    priceChange?: {
        h24?: string | number | null;
    };
    txns?: {
        h24?: {
            buys?: string | number | null;
            sells?: string | number | null;
        };
    };
    [key: string]: unknown;
}

export async function getDexScreenerPairs(mints: string[]): Promise<DexScreenerPair[]> {
    if (mints.length === 0) return [];
    try {
        const url = `https://api.dexscreener.com/latest/dex/tokens/${mints.join(",")}`;
        const res = await fetchWithRetry(url, {
            cache: "no-store",
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return [];
        const json = await res.json();
        return json.pairs || [];
    } catch (error) {
        console.error("[dexscreener] error:", error);
        return [];
    }
}

export const getDexScreenerMetadata = getDexScreenerPairs;

export async function getDexScreenerSearch(query: string): Promise<DexScreenerPair[]> {
    try {
        const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
        const res = await fetchWithRetry(
            url,
            {
                cache: "no-store",
                signal: AbortSignal.timeout(10_000),
            },
            2,
            300
        );
        if (!res.ok) return [];
        const json = await res.json();
        const pairs = Array.isArray(json.pairs) ? (json.pairs as DexScreenerPair[]) : [];
        return pairs.filter((pair) => pair.chainId === "solana");
    } catch (error) {
        console.error("[dexscreener] search error:", error);
        return [];
    }
}

export async function getDexScreenerNewBagsPairs(): Promise<DexScreenerPair[]> {
    try {
        const pairs = await getDexScreenerSearch("bags");
        return pairs
            .filter((pair) => pair.dexId === "bags" && pair.baseToken?.address && pair.pairCreatedAt)
            .sort((a, b) => (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0));
    } catch (error) {
        console.error("[dexscreener] new bags pairs error:", error);
        return [];
    }
}

function heliusRpcUrl(): string {
    const key = process.env.HELIUS_API_KEY;
    if (key) return `https://mainnet.helius-rpc.com/?api-key=${key}`;
    return getRpcUrl();
}

const HOLDER_COUNT_TTL_MS = 2 * 60_000;
const HOLDER_PAGE_LIMIT = 1000;
const HOLDER_MAX_PAGES = 30;
const holderCountCache = new Map<string, { count: number; ts: number }>();

interface EnhancedTokenAccount {
    owner?: string;
    amount?: string | number | null;
}

interface HeliusRpcResult {
    token_accounts?: EnhancedTokenAccount[];
    cursor?: string;
    [key: string]: unknown;
}

async function heliusRpc(method: string, params: unknown): Promise<HeliusRpcResult> {
    const res = await fetch(heliusRpcUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: `bagscan-${method}`,
            method,
            params,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
        const reason = json.error?.message ?? `HTTP ${res.status}`;
        throw new Error(`[helius:${method}] ${reason}`);
    }
    return json.result;
}

function parseRawTokenAmount(value: unknown): bigint | null {
    if (typeof value === "string") {
        try {
            return BigInt(value);
        } catch {
            return null;
        }
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        return BigInt(Math.max(0, Math.floor(value)));
    }

    return null;
}

export async function getHeliusAsset(mint: string): Promise<HeliusAsset | null> {
    try {
        const res = await fetch(heliusRpcUrl(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: "bagscan",
                method: "getAsset",
                params: { id: mint },
            }),
            cache: "no-store",
        });
        const json = await res.json();
        return json.result ?? null;
    } catch {
        return null;
    }
}

export async function getHeliusAssetBatch(
    mints: string[]
): Promise<Map<string, HeliusAsset>> {
    const result = new Map<string, HeliusAsset>();
    if (mints.length === 0) return result;

    const BATCH_SIZE = 1000;
    for (let i = 0; i < mints.length; i += BATCH_SIZE) {
        const batch = mints.slice(i, i + BATCH_SIZE);
        try {
            const res = await fetch(heliusRpcUrl(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: "bagscan-batch",
                    method: "getAssetBatch",
                    params: { ids: batch },
                }),
                cache: "no-store",
            });
            const json = await res.json();
            const assets: HeliusAsset[] = json.result ?? [];
            for (const asset of assets) {
                if (asset.id) result.set(asset.id, asset);
            }
        } catch (error) {
            console.error("[helius] getAssetBatch error:", error);
        }
    }

    return result;
}

export async function getHeliusHolderCount(mint: string): Promise<number | null> {
    const cached = holderCountCache.get(mint);
    if (cached && Date.now() - cached.ts < HOLDER_COUNT_TTL_MS) {
        return cached.count;
    }

    try {
        const holders = new Set<string>();
        let cursor: string | undefined;

        for (let page = 0; page < HOLDER_MAX_PAGES; page += 1) {
            const params: Record<string, unknown> = {
                mint,
                limit: HOLDER_PAGE_LIMIT,
                options: { showZeroBalance: false },
            };
            if (cursor) params.cursor = cursor;

            const result = await heliusRpc("getTokenAccounts", params);
            const accounts = Array.isArray(result?.token_accounts) ? result.token_accounts : [];

            for (const acc of accounts as EnhancedTokenAccount[]) {
                const owner = acc.owner;
                const amount = parseRawTokenAmount(acc.amount);
                if (!owner || amount === null || amount <= BigInt(0)) continue;
                holders.add(owner);
            }

            const nextCursor =
                typeof result?.cursor === "string" && result.cursor.length > 0
                    ? result.cursor
                    : undefined;

            if (!nextCursor) break;
            cursor = nextCursor;
        }

        if (holders.size > 0) {
            holderCountCache.set(mint, { count: holders.size, ts: Date.now() });
            return holders.size;
        }
    } catch (error) {
        console.warn("[helius] holder count fetch failed:", error);
    }

    return null;
}

let cachedSolPrice: { price: number; ts: number } | null = null;

export async function getSolPriceUsd(): Promise<number> {
    if (cachedSolPrice && Date.now() - cachedSolPrice.ts < 60_000) {
        return cachedSolPrice.price;
    }

    try {
        const res = await fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
            { cache: "no-store" }
        );
        const json = await res.json();
        const price = json.solana?.usd ?? 150;
        cachedSolPrice = { price, ts: Date.now() };
        return price;
    } catch {
        return cachedSolPrice?.price ?? 150;
    }
}

export async function startIncorporationPayment(params: {
    payerWallet: string;
    payWithSol?: boolean;
}): Promise<BagsIncorporationPaymentResponse> {
    const result = await getBagsSdk().incorporation.startPayment({
        payerWallet: toPublicKey(params.payerWallet, "payer wallet"),
        payWithSol: params.payWithSol,
    });

    return {
        orderUUID: result.orderUUID,
        recipientWallet: result.recipientWallet,
        priceUSDC: result.priceUSDC,
        transaction: encodeTransaction(result.transaction),
        lastValidBlockHeight: result.lastValidBlockHeight,
    };
}

export async function incorporateCompany(
    params: BagsIncorporateCompanyRequest
): Promise<BagsIncorporationProject> {
    const result = await getBagsSdk().incorporation.incorporate({
        orderUUID: params.orderUUID,
        paymentSignature: params.paymentSignature,
        projectName: params.projectName,
        tokenAddress: toPublicKey(params.tokenAddress, "token address"),
        founders: params.founders,
        category: params.category,
        twitterHandle: params.twitterHandle,
        incorporationShareBasisPoint: params.incorporationShareBasisPoint,
        preferredCompanyNames: params.preferredCompanyNames,
    });

    return result;
}

export async function startTokenIncorporation(
    tokenAddress: string
): Promise<BagsStartIncorporationResponse> {
    return getBagsSdk().incorporation.startIncorporation({
        tokenAddress: toPublicKey(tokenAddress, "token address"),
    });
}

export async function listIncorporatedCompanies(): Promise<BagsIncorporationProject[]> {
    return getBagsSdk().incorporation.list();
}

export async function getCompanyTokenDetails(
    tokenAddress: string
): Promise<BagsIncorporationProject | null> {
    try {
        return await getBagsSdk().incorporation.getDetails({
            tokenAddress: toPublicKey(tokenAddress, "token address"),
        });
    } catch {
        return null;
    }
}
