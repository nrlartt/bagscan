import {
    Connection,
    ParsedTransactionWithMeta,
    PublicKey,
} from "@solana/web3.js";
import { SOL_MINT } from "@/lib/solana";
import { getRpcUrl } from "@/lib/solana";
import type { PortfolioCostBasisMeta, PortfolioHolding } from "@/lib/portfolio/types";

const HeliusMainnetBase = "https://api-mainnet.helius-rpc.com/v0";
const CoinGeckoBase = "https://api.coingecko.com/api/v3";
const HISTORY_LIMIT = 100;
const HISTORY_MAX_PAGES = 15;
const DAY_IN_SECONDS = 24 * 60 * 60;
const YEAR_IN_SECONDS = 365 * DAY_IN_SECONDS;
const POSITION_EPSILON = 1e-9;
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD3iT1F2Y7V7czJb7hqkF4";

interface EnhancedRawTokenAmount {
    tokenAmount?: string;
    decimals?: number;
}

interface EnhancedSwapTokenEntry {
    userAccount?: string;
    tokenAccount?: string;
    mint?: string;
    rawTokenAmount?: EnhancedRawTokenAmount;
}

interface EnhancedSwapNativeEntry {
    account?: string;
    amount?: string;
}

interface EnhancedSwapEvent {
    nativeInput?: EnhancedSwapNativeEntry;
    nativeOutput?: EnhancedSwapNativeEntry;
    tokenInputs?: EnhancedSwapTokenEntry[];
    tokenOutputs?: EnhancedSwapTokenEntry[];
    tokenFees?: EnhancedSwapTokenEntry[];
    nativeFees?: EnhancedSwapNativeEntry[];
}

interface EnhancedTokenTransfer {
    fromUserAccount?: string;
    toUserAccount?: string;
    tokenAmount?: number;
    mint?: string;
}

interface EnhancedNativeTransfer {
    fromUserAccount?: string;
    toUserAccount?: string;
    amount?: number;
}

interface EnhancedTransaction {
    signature: string;
    timestamp?: number;
    fee?: number;
    feePayer?: string;
    tokenTransfers?: EnhancedTokenTransfer[];
    nativeTransfers?: EnhancedNativeTransfer[];
    events?: {
        swap?: EnhancedSwapEvent;
    };
}

interface PricePoint {
    timestampMs: number;
    priceUsd: number;
}

interface AssetState {
    quantity: number;
    totalCostUsd: number;
    unknownQuantity: number;
}

interface AssetFlow {
    mint: string;
    amount: number;
    usdValue?: number;
}

export interface CostBasisPosition {
    amount: number;
    costBasisUsd: number;
    averageCostUsd?: number;
    costBasisStatus: PortfolioHolding["costBasisStatus"];
}

export interface WalletCostBasisResult {
    positions: Map<string, CostBasisPosition>;
    meta: PortfolioCostBasisMeta;
}

function isStableMint(mint: string) {
    return mint === USDC_MINT || mint === USDT_MINT;
}

function parseUiTokenAmount(entry?: EnhancedRawTokenAmount | null) {
    if (!entry?.tokenAmount) return 0;
    const decimals = entry.decimals ?? 0;
    const raw = Number(entry.tokenAmount);
    if (!Number.isFinite(raw)) return 0;
    return raw / 10 ** decimals;
}

function parseLamports(raw?: string | number | null) {
    const amount = typeof raw === "string" ? Number(raw) : raw;
    if (amount === null || amount === undefined || !Number.isFinite(amount)) return 0;
    return amount / 1_000_000_000;
}

function getOrCreateState(states: Map<string, AssetState>, mint: string): AssetState {
    const existing = states.get(mint);
    if (existing) return existing;
    const state: AssetState = { quantity: 0, totalCostUsd: 0, unknownQuantity: 0 };
    states.set(mint, state);
    return state;
}

function addKnownPosition(states: Map<string, AssetState>, mint: string, quantity: number, costUsd: number) {
    if (!Number.isFinite(quantity) || quantity <= POSITION_EPSILON) return;
    const state = getOrCreateState(states, mint);
    state.quantity += quantity;
    state.totalCostUsd += Math.max(0, costUsd);
}

function addUnknownPosition(states: Map<string, AssetState>, mint: string, quantity: number) {
    if (!Number.isFinite(quantity) || quantity <= POSITION_EPSILON) return;
    const state = getOrCreateState(states, mint);
    state.quantity += quantity;
    state.unknownQuantity += quantity;
}

function removePosition(states: Map<string, AssetState>, mint: string, quantity: number) {
    if (!Number.isFinite(quantity) || quantity <= POSITION_EPSILON) {
        return { removedCostUsd: 0 };
    }

    const state = getOrCreateState(states, mint);
    if (state.quantity <= POSITION_EPSILON) {
        return { removedCostUsd: 0 };
    }

    const removable = Math.min(quantity, state.quantity);
    const unknownRatio = state.quantity > POSITION_EPSILON ? state.unknownQuantity / state.quantity : 0;
    const unknownRemoved = Math.min(state.unknownQuantity, removable * unknownRatio);
    const knownQuantity = Math.max(0, state.quantity - state.unknownQuantity);
    const knownRemoved = Math.max(0, removable - unknownRemoved);
    const averageKnownCost = knownQuantity > POSITION_EPSILON ? state.totalCostUsd / knownQuantity : 0;
    const removedCostUsd = averageKnownCost * knownRemoved;

    state.quantity = Math.max(0, state.quantity - removable);
    state.unknownQuantity = Math.max(0, state.unknownQuantity - unknownRemoved);
    state.totalCostUsd = Math.max(0, state.totalCostUsd - removedCostUsd);

    if (state.quantity <= POSITION_EPSILON) {
        state.quantity = 0;
        state.totalCostUsd = 0;
        state.unknownQuantity = 0;
    }

    return { removedCostUsd };
}

function allocateCostByWeights(outputs: AssetFlow[], totalCostUsd: number) {
    if (outputs.length === 0) return [];
    const explicitWeight = outputs.reduce((sum, output) => sum + (output.usdValue ?? 0), 0);
    const fallbackWeight = outputs.reduce((sum, output) => sum + output.amount, 0);
    const totalWeight = explicitWeight > POSITION_EPSILON ? explicitWeight : fallbackWeight;

    return outputs.map((output, index) => {
        if (totalWeight <= POSITION_EPSILON) {
            return index === 0 ? totalCostUsd : 0;
        }
        const weight = explicitWeight > POSITION_EPSILON ? (output.usdValue ?? 0) : output.amount;
        if (index === outputs.length - 1) {
            const allocatedSoFar = outputs
                .slice(0, index)
                .reduce((sum, _, outputIndex) => sum + (explicitWeight > POSITION_EPSILON ? ((outputs[outputIndex].usdValue ?? 0) / totalWeight) * totalCostUsd : (outputs[outputIndex].amount / totalWeight) * totalCostUsd), 0);
            return Math.max(0, totalCostUsd - allocatedSoFar);
        }
        return (weight / totalWeight) * totalCostUsd;
    });
}

async function fetchTransactionHistory(wallet: string) {
    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
        return fetchTransactionHistoryFromRpc(wallet);
    }

    const transactions: EnhancedTransaction[] = [];
    let afterSignature: string | undefined;
    let pagesScanned = 0;

    try {
        for (let page = 0; page < HISTORY_MAX_PAGES; page += 1) {
            const params = new URLSearchParams({
                "api-key": apiKey,
                limit: String(HISTORY_LIMIT),
                "sort-order": "asc",
                "token-accounts": "balanceChanged",
                commitment: "confirmed",
            });
            if (afterSignature) {
                params.set("after-signature", afterSignature);
            }

            const response = await fetch(`${HeliusMainnetBase}/addresses/${wallet}/transactions?${params}`, {
                cache: "no-store",
                signal: AbortSignal.timeout(20_000),
            });

            if (!response.ok) {
                throw new Error(`Helius history request failed with HTTP ${response.status}`);
            }

            const batch = (await response.json()) as EnhancedTransaction[];
            pagesScanned += 1;

            if (!Array.isArray(batch) || batch.length === 0) {
                return { transactions, historyComplete: true, pagesScanned };
            }

            transactions.push(...batch);
            afterSignature = batch[batch.length - 1]?.signature;

            if (batch.length < HISTORY_LIMIT) {
                return { transactions, historyComplete: true, pagesScanned };
            }
        }
    } catch {
        return fetchTransactionHistoryFromRpc(wallet);
    }

    return { transactions, historyComplete: false, pagesScanned };
}

function readAccountKey(value: unknown): string | null {
    if (typeof value === "string") return value;
    if (typeof value === "object" && value !== null && "pubkey" in value) {
        const pubkey = (value as { pubkey?: unknown }).pubkey;
        if (typeof pubkey === "string") return pubkey;
        if (pubkey && typeof pubkey === "object" && "toBase58" in pubkey && typeof (pubkey as { toBase58?: unknown }).toBase58 === "function") {
            return (pubkey as { toBase58: () => string }).toBase58();
        }
    }
    return null;
}

function readUiTokenAmount(value: unknown) {
    if (typeof value !== "object" || value === null) return 0;
    const uiAmountString = (value as { uiAmountString?: unknown }).uiAmountString;
    if (typeof uiAmountString === "string") {
        const parsed = Number(uiAmountString);
        if (Number.isFinite(parsed)) return parsed;
    }
    const uiAmount = (value as { uiAmount?: unknown }).uiAmount;
    if (typeof uiAmount === "number" && Number.isFinite(uiAmount)) return uiAmount;
    const amount = (value as { amount?: unknown }).amount;
    const decimals = (value as { decimals?: unknown }).decimals;
    if (typeof amount === "string" && typeof decimals === "number") {
        const parsed = Number(amount);
        if (Number.isFinite(parsed)) return parsed / 10 ** decimals;
    }
    return 0;
}

function parsedTransactionToEnhanced(
    wallet: string,
    transaction: ParsedTransactionWithMeta,
    signature: string
): EnhancedTransaction | null {
    const meta = transaction.meta;
    const message = transaction.transaction.message;
    if (!meta || !message) return null;

    const accountKeys = "accountKeys" in message && Array.isArray(message.accountKeys)
        ? message.accountKeys
        : [];
    const walletIndex = accountKeys.findIndex((entry) => readAccountKey(entry) === wallet);

    const tokenDeltas = new Map<string, number>();
    for (const balance of meta.preTokenBalances ?? []) {
        if (balance.owner !== wallet || !balance.mint) continue;
        tokenDeltas.set(balance.mint, (tokenDeltas.get(balance.mint) ?? 0) - readUiTokenAmount(balance.uiTokenAmount));
    }
    for (const balance of meta.postTokenBalances ?? []) {
        if (balance.owner !== wallet || !balance.mint) continue;
        tokenDeltas.set(balance.mint, (tokenDeltas.get(balance.mint) ?? 0) + readUiTokenAmount(balance.uiTokenAmount));
    }

    const nativeDeltaLamports =
        walletIndex >= 0 &&
        walletIndex < (meta.preBalances?.length ?? 0) &&
        walletIndex < (meta.postBalances?.length ?? 0)
            ? (meta.postBalances[walletIndex] ?? 0) - (meta.preBalances[walletIndex] ?? 0)
            : 0;

    const inputs: EnhancedSwapTokenEntry[] = [];
    const outputs: EnhancedSwapTokenEntry[] = [];

    for (const [mint, delta] of tokenDeltas) {
        if (delta > POSITION_EPSILON) {
            outputs.push({
                userAccount: wallet,
                mint,
                rawTokenAmount: {
                    tokenAmount: String(delta),
                    decimals: 0,
                },
            });
        } else if (delta < -POSITION_EPSILON) {
            inputs.push({
                userAccount: wallet,
                mint,
                rawTokenAmount: {
                    tokenAmount: String(Math.abs(delta)),
                    decimals: 0,
                },
            });
        }
    }

    const nativeInput = nativeDeltaLamports < 0
        ? {
            account: wallet,
            amount: String(Math.abs(nativeDeltaLamports)),
        }
        : undefined;
    const nativeOutput = nativeDeltaLamports > 0
        ? {
            account: wallet,
            amount: String(nativeDeltaLamports),
        }
        : undefined;

    const hasInputs = inputs.length > 0 || Boolean(nativeInput);
    const hasOutputs = outputs.length > 0 || Boolean(nativeOutput);

    if (hasInputs && hasOutputs) {
        return {
            signature,
            timestamp: transaction.blockTime ?? undefined,
            fee: 0,
            tokenTransfers: [],
            nativeTransfers: [],
            events: {
                swap: {
                    nativeInput,
                    nativeOutput,
                    tokenInputs: inputs,
                    tokenOutputs: outputs,
                },
            },
        };
    }

    const tokenTransfers: EnhancedTokenTransfer[] = [];
    for (const [mint, delta] of tokenDeltas) {
        if (delta > POSITION_EPSILON) {
            tokenTransfers.push({ toUserAccount: wallet, tokenAmount: delta, mint });
        } else if (delta < -POSITION_EPSILON) {
            tokenTransfers.push({ fromUserAccount: wallet, tokenAmount: Math.abs(delta), mint });
        }
    }

    const nativeTransfers: EnhancedNativeTransfer[] = [];
    if (nativeDeltaLamports > 0) {
        nativeTransfers.push({ toUserAccount: wallet, amount: nativeDeltaLamports });
    } else if (nativeDeltaLamports < 0) {
        nativeTransfers.push({ fromUserAccount: wallet, amount: Math.abs(nativeDeltaLamports) });
    }

    return {
        signature,
        timestamp: transaction.blockTime ?? undefined,
        fee: 0,
        tokenTransfers,
        nativeTransfers,
    };
}

async function fetchTransactionHistoryFromRpc(wallet: string) {
    const connection = new Connection(getRpcUrl(), "confirmed");
    const owner = new PublicKey(wallet);
    const signatures: string[] = [];
    let before: string | undefined;
    let pagesScanned = 0;
    let historyComplete = true;

    for (let page = 0; page < HISTORY_MAX_PAGES; page += 1) {
        const batch = await connection.getSignaturesForAddress(
            owner,
            { before, limit: HISTORY_LIMIT },
            "confirmed"
        );
        pagesScanned += 1;

        if (batch.length === 0) break;
        signatures.push(...batch.map((entry) => entry.signature));
        before = batch[batch.length - 1]?.signature;

        if (batch.length < HISTORY_LIMIT) {
            historyComplete = true;
            break;
        }
        if (page === HISTORY_MAX_PAGES - 1) {
            historyComplete = false;
        }
    }

    const ascendingSignatures = [...signatures].reverse();
    const transactions: EnhancedTransaction[] = [];

    for (let index = 0; index < ascendingSignatures.length; index += 50) {
        const batch = ascendingSignatures.slice(index, index + 50);
        const parsedBatch = await connection.getParsedTransactions(batch, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
        });

        parsedBatch.forEach((parsedTransaction, batchIndex) => {
            if (!parsedTransaction) return;
            const enhanced = parsedTransactionToEnhanced(wallet, parsedTransaction, batch[batchIndex]);
            if (enhanced) transactions.push(enhanced);
        });
    }

    return { transactions, historyComplete, pagesScanned };
}

async function fetchHistoricalSolPrices(transactions: EnhancedTransaction[], fallbackPrice: number) {
    if (transactions.length === 0) return [] as PricePoint[];

    const timestamps = transactions
        .map((transaction) => transaction.timestamp)
        .filter((timestamp): timestamp is number => typeof timestamp === "number" && Number.isFinite(timestamp));

    if (timestamps.length === 0) return [] as PricePoint[];

    const oldest = Math.min(...timestamps);
    const newest = Math.max(...timestamps);
    const now = Math.floor(Date.now() / 1000);
    const from = Math.max(oldest, now - YEAR_IN_SECONDS);

    const params = new URLSearchParams({
        vs_currency: "usd",
        from: String(from),
        to: String(Math.max(newest, from + 3600)),
        precision: "full",
    });

    const headers: HeadersInit = {};
    const demoKey = process.env.COINGECKO_API_KEY;
    if (demoKey) {
        headers["x-cg-demo-api-key"] = demoKey;
    }

    try {
        const response = await fetch(`${CoinGeckoBase}/coins/solana/market_chart/range?${params}`, {
            cache: "no-store",
            headers,
            signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) {
            return [] as PricePoint[];
        }
        const payload = (await response.json()) as { prices?: number[][] };
        return (payload.prices ?? [])
            .map((point) => {
                const [timestampMs, priceUsd] = point;
                if (!Number.isFinite(timestampMs) || !Number.isFinite(priceUsd)) return null;
                return { timestampMs, priceUsd } satisfies PricePoint;
            })
            .filter((point): point is PricePoint => point !== null && point.priceUsd > 0);
    } catch {
        return [{ timestampMs: now * 1000, priceUsd: fallbackPrice }];
    }
}

function findNearestSolPrice(pricePoints: PricePoint[], timestampSeconds: number, fallbackPrice: number) {
    if (pricePoints.length === 0) return fallbackPrice;
    const target = timestampSeconds * 1000;

    let low = 0;
    let high = pricePoints.length - 1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const point = pricePoints[mid];
        if (point.timestampMs === target) return point.priceUsd;
        if (point.timestampMs < target) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    const candidates = [pricePoints[Math.max(0, high)], pricePoints[Math.min(pricePoints.length - 1, low)]]
        .filter((point): point is PricePoint => Boolean(point));
    if (candidates.length === 0) return fallbackPrice;

    return candidates.reduce((best, point) => {
        const bestDistance = Math.abs(best.timestampMs - target);
        const currentDistance = Math.abs(point.timestampMs - target);
        return currentDistance < bestDistance ? point : best;
    }).priceUsd;
}

function processSwapTransaction(
    wallet: string,
    transaction: EnhancedTransaction,
    states: Map<string, AssetState>,
    solPriceAtTx: number
) {
    const swap = transaction.events?.swap;
    if (!swap) return;

    const inputs: AssetFlow[] = [];
    const outputs: AssetFlow[] = [];

    if (transaction.feePayer === wallet && (transaction.fee ?? 0) > 0) {
        removePosition(states, SOL_MINT, (transaction.fee ?? 0) / 1_000_000_000);
    }

    if (swap.nativeInput?.account === wallet) {
        const amount = parseLamports(swap.nativeInput.amount);
        if (amount > 0) inputs.push({ mint: SOL_MINT, amount, usdValue: amount * solPriceAtTx });
    }
    if (swap.nativeOutput?.account === wallet) {
        const amount = parseLamports(swap.nativeOutput.amount);
        if (amount > 0) outputs.push({ mint: SOL_MINT, amount, usdValue: amount * solPriceAtTx });
    }

    for (const entry of swap.nativeFees ?? []) {
        if (entry.account !== wallet) continue;
        const amount = parseLamports(entry.amount);
        if (amount > 0) inputs.push({ mint: SOL_MINT, amount, usdValue: amount * solPriceAtTx });
    }

    for (const entry of swap.tokenInputs ?? []) {
        if (entry.userAccount !== wallet || !entry.mint) continue;
        const amount = parseUiTokenAmount(entry.rawTokenAmount);
        if (amount <= 0) continue;
        inputs.push({
            mint: entry.mint,
            amount,
            usdValue: isStableMint(entry.mint) ? amount : undefined,
        });
    }

    for (const entry of swap.tokenFees ?? []) {
        if (entry.userAccount !== wallet || !entry.mint) continue;
        const amount = parseUiTokenAmount(entry.rawTokenAmount);
        if (amount <= 0) continue;
        inputs.push({
            mint: entry.mint,
            amount,
            usdValue: isStableMint(entry.mint) ? amount : undefined,
        });
    }

    for (const entry of swap.tokenOutputs ?? []) {
        if (entry.userAccount !== wallet || !entry.mint) continue;
        const amount = parseUiTokenAmount(entry.rawTokenAmount);
        if (amount <= 0) continue;
        outputs.push({
            mint: entry.mint,
            amount,
            usdValue: isStableMint(entry.mint) ? amount : undefined,
        });
    }

    if (inputs.length === 0 && outputs.length === 0) return;

    let removedCostUsd = 0;
    let knownInputUsd = 0;
    for (const input of inputs) {
        knownInputUsd += input.usdValue ?? 0;
        removedCostUsd += removePosition(states, input.mint, input.amount).removedCostUsd;
    }

    const knownOutputUsd = outputs.reduce((sum, output) => sum + (output.usdValue ?? 0), 0);
    const basisPoolUsd = Math.max(knownInputUsd, knownOutputUsd, removedCostUsd, 0);

    const hasNonCashOutput = outputs.some((output) => output.mint !== SOL_MINT && !isStableMint(output.mint));
    const networkFeeUsd =
        transaction.feePayer === wallet && (transaction.fee ?? 0) > 0
            ? ((transaction.fee ?? 0) / 1_000_000_000) * solPriceAtTx
            : 0;

    const allocatedCosts = allocateCostByWeights(
        outputs,
        basisPoolUsd + (hasNonCashOutput ? networkFeeUsd : 0)
    );

    outputs.forEach((output, index) => {
        addKnownPosition(states, output.mint, output.amount, allocatedCosts[index] ?? 0);
    });
}

function processTransferTransaction(
    wallet: string,
    transaction: EnhancedTransaction,
    states: Map<string, AssetState>,
    solPriceAtTx: number
) {
    const tokenDeltas = new Map<string, number>();
    let nativeDelta = 0;

    for (const transfer of transaction.tokenTransfers ?? []) {
        if (!transfer.mint || !Number.isFinite(transfer.tokenAmount)) continue;
        if (transfer.fromUserAccount === wallet) {
            tokenDeltas.set(transfer.mint, (tokenDeltas.get(transfer.mint) ?? 0) - (transfer.tokenAmount ?? 0));
        }
        if (transfer.toUserAccount === wallet) {
            tokenDeltas.set(transfer.mint, (tokenDeltas.get(transfer.mint) ?? 0) + (transfer.tokenAmount ?? 0));
        }
    }

    for (const transfer of transaction.nativeTransfers ?? []) {
        const amount = parseLamports(transfer.amount);
        if (transfer.fromUserAccount === wallet) nativeDelta -= amount;
        if (transfer.toUserAccount === wallet) nativeDelta += amount;
    }

    if (transaction.feePayer === wallet && (transaction.fee ?? 0) > 0) {
        nativeDelta -= (transaction.fee ?? 0) / 1_000_000_000;
    }

    for (const [mint, delta] of tokenDeltas) {
        if (delta > POSITION_EPSILON) {
            if (isStableMint(mint)) {
                addKnownPosition(states, mint, delta, delta);
            } else {
                addUnknownPosition(states, mint, delta);
            }
        } else if (delta < -POSITION_EPSILON) {
            removePosition(states, mint, Math.abs(delta));
        }
    }

    if (nativeDelta > POSITION_EPSILON) {
        addKnownPosition(states, SOL_MINT, nativeDelta, nativeDelta * solPriceAtTx);
    } else if (nativeDelta < -POSITION_EPSILON) {
        removePosition(states, SOL_MINT, Math.abs(nativeDelta));
    }
}

function reconcileCurrentBalance(
    state: AssetState,
    currentAmount: number,
    historyComplete: boolean
): CostBasisPosition {
    const current = Math.max(0, currentAmount);
    let costBasisUsd = Math.max(0, state.totalCostUsd);
    let unknownQuantity = Math.max(0, state.unknownQuantity);
    let trackedQuantity = Math.max(0, state.quantity);

    if (trackedQuantity < current - POSITION_EPSILON) {
        unknownQuantity += current - trackedQuantity;
        trackedQuantity = current;
    } else if (trackedQuantity > current + POSITION_EPSILON && trackedQuantity > POSITION_EPSILON) {
        const scale = current / trackedQuantity;
        costBasisUsd *= scale;
        unknownQuantity *= scale;
        trackedQuantity = current;
    } else {
        trackedQuantity = current;
    }

    const effectiveKnownQuantity = Math.max(0, trackedQuantity - unknownQuantity);
    const averageCostUsd = effectiveKnownQuantity > POSITION_EPSILON ? costBasisUsd / effectiveKnownQuantity : undefined;
    let costBasisStatus: PortfolioHolding["costBasisStatus"] = "unknown";

    if (trackedQuantity <= POSITION_EPSILON) {
        costBasisStatus = historyComplete ? "complete" : "partial";
    } else if (effectiveKnownQuantity > POSITION_EPSILON && unknownQuantity <= POSITION_EPSILON && historyComplete) {
        costBasisStatus = "complete";
    } else if (effectiveKnownQuantity > POSITION_EPSILON || unknownQuantity > POSITION_EPSILON) {
        costBasisStatus = unknownQuantity > POSITION_EPSILON || !historyComplete ? "partial" : "complete";
    }

    return {
        amount: trackedQuantity,
        costBasisUsd,
        averageCostUsd,
        costBasisStatus,
    };
}

export async function buildWalletCostBasis(
    wallet: string,
    currentAssets: Array<{ mint: string; amount: number }>,
    solBalance: number,
    currentSolPrice: number
): Promise<WalletCostBasisResult> {
    const { transactions, historyComplete: historyFromPagination, pagesScanned } = await fetchTransactionHistory(wallet);
    const pricePoints = await fetchHistoricalSolPrices(transactions, currentSolPrice);

    const states = new Map<string, AssetState>();
    for (const transaction of transactions) {
        const solPriceAtTx = findNearestSolPrice(
            pricePoints,
            transaction.timestamp ?? Math.floor(Date.now() / 1000),
            currentSolPrice
        );

        if (transaction.events?.swap) {
            processSwapTransaction(wallet, transaction, states, solPriceAtTx);
        } else {
            processTransferTransaction(wallet, transaction, states, solPriceAtTx);
        }
    }

    const priceRangeComplete =
        transactions.length === 0 ||
        Math.min(...transactions.map((transaction) => transaction.timestamp ?? Math.floor(Date.now() / 1000))) >= Math.floor(Date.now() / 1000) - YEAR_IN_SECONDS;
    const historyComplete = historyFromPagination && priceRangeComplete;

    const positions = new Map<string, CostBasisPosition>();
    for (const asset of currentAssets) {
        positions.set(
            asset.mint,
            reconcileCurrentBalance(
                states.get(asset.mint) ?? { quantity: 0, totalCostUsd: 0, unknownQuantity: 0 },
                asset.amount,
                historyComplete
            )
        );
    }

    positions.set(
        SOL_MINT,
        reconcileCurrentBalance(
            states.get(SOL_MINT) ?? { quantity: 0, totalCostUsd: 0, unknownQuantity: 0 },
            solBalance,
            historyComplete
        )
    );

    const timestamps = transactions
        .map((transaction) => transaction.timestamp)
        .filter((timestamp): timestamp is number => typeof timestamp === "number" && Number.isFinite(timestamp));

    const meta: PortfolioCostBasisMeta = {
        method: "average-cost",
        historyComplete,
        transactionsScanned: transactions.length,
        pagesScanned,
        oldestTimestamp: timestamps.length > 0 ? new Date(Math.min(...timestamps) * 1000).toISOString() : undefined,
        newestTimestamp: timestamps.length > 0 ? new Date(Math.max(...timestamps) * 1000).toISOString() : undefined,
    };

    return { positions, meta };
}
