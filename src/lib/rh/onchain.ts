import "server-only";
import { formatUnits, getAddress, parseAbiItem, type Address, type Hex } from "viem";
import type {
    RhBalancesResponse,
    RhPortfolioResponse,
    RhQuoteResponse,
    RhTokenDetailResponse,
    RhTokenListItem,
    RhTokenMetadata,
    RhTokenState,
    RhTokensQuery,
    RhTokensResponse,
    RhTrade,
    RhTradeSide,
    RhTradesResponse,
} from "./api-types";
import {
    RH_CURVE_READ_ABI,
    RH_FEE_SHARE_ABI,
    RH_LENS_ABI,
    RH_STATE_VIEW_ABI,
    RH_TOKEN_ABI,
    RH_V4_QUOTER_ABI,
    type RhLensState,
} from "./abi";
import {
    ROBINHOOD_DEPLOY_BLOCK,
    ROBINHOOD_LAUNCHPAD,
    RH_PORTFOLIO_SCAN_TOKENS,
    RH_REGISTRY_SCAN_CAP,
} from "./addresses";
import { bagsPoolKey, directionFor, isTokenCurrency0 } from "./pool";
import {
    ensureLaunchRegistry,
    getFactoryTokenTotal,
    getFactoryTokens,
    getLaunchRecord,
    getMigrationForCurve,
    getPartnerFeeBps,
} from "./registry";
import { rhPublicClient } from "./rpc";

const ZERO = "0x0000000000000000000000000000000000000000";
const metadataCache = new Map<string, RhTokenMetadata | null>();
const migrationTsCache = new Map<string, { block: number; timestamp: number }>();

const tokensBoughtEvent = parseAbiItem(
    "event TokensBought(address indexed buyer, address indexed recipient, uint256 grossQuoteIn, uint256 netQuoteIn, uint256 tokensOut, uint256 feeQuote, uint256 vaultFeeQuote, uint256 creatorFeeWETH, uint256 refundQuote, uint256 price, uint256 virtualTokenReserves, uint256 virtualQuoteReserves)"
);
const tokensSoldEvent = parseAbiItem(
    "event TokensSold(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 grossQuoteOut, uint256 netQuoteToRecipient, uint256 feeQuote, uint256 vaultFeeQuote, uint256 creatorFeeWETH, uint256 price, uint256 virtualTokenReserves, uint256 virtualQuoteReserves)"
);

function addr(value: string): Address {
    return getAddress(value);
}

function weiStr(value: bigint): string {
    return value.toString();
}

async function readPoolPriceWei(token: Address, poolId: Hex): Promise<bigint | null> {
    try {
        const [sqrtPriceX96] = await rhPublicClient.readContract({
            address: ROBINHOOD_LAUNCHPAD.stateView as Address,
            abi: RH_STATE_VIEW_ABI,
            functionName: "getSlot0",
            args: [poolId],
        });
        if (sqrtPriceX96 === 0n) return null;
        const Q96 = 2 ** 96;
        const ratio = (Number(sqrtPriceX96) / Q96) ** 2;
        const ethPerToken = isTokenCurrency0(token) ? ratio : 1 / ratio;
        if (!Number.isFinite(ethPerToken) || ethPerToken <= 0) return null;
        return BigInt(Math.floor(ethPerToken * 1e18));
    } catch {
        return null;
    }
}

async function resolvePriceWei(token: Address, state: RhLensState): Promise<string | null> {
    if (!state.migrated) {
        return state.priceQuotePerToken > 0n ? weiStr(state.priceQuotePerToken) : null;
    }
    const poolPrice = await readPoolPriceWei(token, state.poolId);
    return poolPrice != null && poolPrice > 0n ? weiStr(poolPrice) : null;
}

async function fetchMetadata(uri: string): Promise<RhTokenMetadata | null> {
    if (!uri) return null;
    const key = uri.trim();
    if (metadataCache.has(key)) return metadataCache.get(key) ?? null;

    let result: RhTokenMetadata | null = null;
    try {
        const url = key.startsWith("ipfs://")
            ? `https://ipfs.io/ipfs/${key.slice(7)}`
            : key;
        const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
        if (res.ok) {
            const json = (await res.json()) as { image?: string; description?: string };
            result = {
                image: typeof json.image === "string" ? json.image : null,
                description: typeof json.description === "string" ? json.description : null,
            };
        }
    } catch {
        result = null;
    }
    metadataCache.set(key, result);
    return result;
}

function lensToState(state: RhLensState): RhTokenState {
    return {
        exists: state.exists,
        migrated: state.migrated,
        curve: state.curve,
        feeShare: state.feeShare,
        poolId: state.poolId,
        thresholdQuoteWei: weiStr(state.thresholdQuote),
        realQuoteReservesWei: weiStr(state.realQuoteReserves),
        realTokenReservesWei: weiStr(state.realTokenReserves),
        virtualTokenReservesWei: weiStr(state.virtualTokenReserves),
        virtualQuoteReservesWei: weiStr(state.virtualQuoteReserves),
        priceEthPerToken: state.priceQuotePerToken > 0n ? weiStr(state.priceQuotePerToken) : null,
        bondingProgressPct: Number(state.bondingProgressPct),
        totalRaisedWei: weiStr(state.totalRaised),
    };
}

async function migrationMeta(curve: string): Promise<{ block: number | null; timestamp: number | null }> {
    const key = curve.toLowerCase();
    const cached = migrationTsCache.get(key);
    if (cached) return cached;

    let record = getMigrationForCurve(curve);
    if (!record) {
        const logs = await rhPublicClient.getLogs({
            address: addr(curve),
            event: parseAbiItem(
                "event Migrated(bytes32 indexed poolId, address indexed account, address indexed sender)"
            ),
            fromBlock: ROBINHOOD_DEPLOY_BLOCK,
            toBlock: "latest",
        });
        if (logs[0]) {
            const block = await rhPublicClient.getBlock({ blockNumber: logs[0].blockNumber });
            record = {
                blockNumber: Number(logs[0].blockNumber),
                timestamp: Number(block.timestamp),
                txHash: logs[0].transactionHash,
            };
        }
    }

    const meta = record
        ? { block: record.blockNumber, timestamp: record.timestamp }
        : { block: null, timestamp: null };
    if (record) migrationTsCache.set(key, { block: record.blockNumber, timestamp: record.timestamp });
    return meta;
}

async function readLensState(token: Address): Promise<RhLensState | null> {
    const state = await rhPublicClient.readContract({
        address: ROBINHOOD_LAUNCHPAD.lens as Address,
        abi: RH_LENS_ABI,
        functionName: "getTokenState",
        args: [token],
    });
    return state.exists ? state : null;
}

async function buildListItem(
    token: Address,
    state: RhLensState,
    partnerFeeBps: number
): Promise<RhTokenListItem | null> {
    await ensureLaunchRegistry();
    const launch = getLaunchRecord(token);
    const migration = state.migrated ? await migrationMeta(state.curve) : { block: null, timestamp: null };
    const price = await resolvePriceWei(token, state);

    let name = launch?.name ?? "";
    let symbol = launch?.symbol ?? "";
    let metadataURI = launch?.metadataURI ?? "";

    if (!name || !symbol) {
        const [n, s, uri] = await Promise.all([
            rhPublicClient.readContract({ address: token, abi: RH_TOKEN_ABI, functionName: "name" }).catch(() => ""),
            rhPublicClient.readContract({ address: token, abi: RH_TOKEN_ABI, functionName: "symbol" }).catch(() => ""),
            rhPublicClient
                .readContract({ address: token, abi: RH_TOKEN_ABI, functionName: "metadataURI" })
                .catch(() => ""),
        ]);
        name = name || n;
        symbol = symbol || s;
        metadataURI = metadataURI || uri;
    }

    const metadata = metadataURI ? await fetchMetadata(metadataURI) : null;
    const partner = launch?.partner && launch.partner !== ZERO ? launch.partner : null;

    return {
        address: token,
        name,
        symbol,
        metadataURI,
        metadata,
        curve: state.curve,
        feeShare: state.feeShare,
        poolId: state.poolId,
        creator: launch?.creator ?? ZERO,
        partner,
        partnerFeeBps,
        createdAtBlock: launch?.createdAtBlock ?? 0,
        createdAtTimestamp: launch?.createdAtTimestamp ?? 0,
        txHash: launch?.txHash ?? ZERO,
        migrated: state.migrated,
        migratedAtBlock: migration.block,
        migratedAtTimestamp: migration.timestamp,
        priceEthPerToken: price,
        bondingProgressPct: Number(state.bondingProgressPct),
        version: "v2",
    };
}

export async function getRhTokens(query: RhTokensQuery = {}): Promise<RhTokensResponse> {
    await ensureLaunchRegistry();
    const limit = Math.min(100, Math.max(1, query.limit ?? 48));
    const offset = Math.max(0, query.offset ?? 0);
    const partnerFeeBps = await getPartnerFeeBps();
    const total = await getFactoryTokenTotal();

    const collected: RhTokenListItem[] = [];
    let registryIndex = total - 1;
    let scanned = 0;

    while (collected.length < limit + offset && registryIndex >= 0 && scanned < RH_REGISTRY_SCAN_CAP) {
        const batchSize = Math.min(32, registryIndex + 1);
        const start = registryIndex - batchSize + 1;
        const addresses = await getFactoryTokens(start, batchSize);

        const states = await rhPublicClient.readContract({
            address: ROBINHOOD_LAUNCHPAD.lens as Address,
            abi: RH_LENS_ABI,
            functionName: "getTokenStates",
            args: [addresses],
        });

        for (let i = addresses.length - 1; i >= 0; i--) {
            const state = states[i];
            if (!state?.exists) continue;
            if (query.migrated === true && !state.migrated) continue;
            if (query.migrated === false && state.migrated) continue;
            if (query.creator && getLaunchRecord(addresses[i])?.creator.toLowerCase() !== query.creator.toLowerCase()) {
                continue;
            }

            const item = await buildListItem(addresses[i], state, partnerFeeBps);
            if (item) collected.push(item);
            if (collected.length >= limit + offset) break;
        }

        registryIndex = start - 1;
        scanned += batchSize;
    }

    if (query.migrated === true && query.orderBy === "migratedAtTimestamp") {
        collected.sort((a, b) => (b.migratedAtTimestamp ?? 0) - (a.migratedAtTimestamp ?? 0));
    } else if (query.orderDirection === "asc") {
        collected.sort((a, b) => a.createdAtTimestamp - b.createdAtTimestamp);
    } else {
        collected.sort((a, b) => b.createdAtTimestamp - a.createdAtTimestamp);
    }

    const page = collected.slice(offset, offset + limit);
    return {
        items: page,
        total,
        totalTruncated: total > scanned,
    };
}

export async function getRhToken(tokenAddress: string): Promise<RhTokenDetailResponse | null> {
    await ensureLaunchRegistry();
    const token = addr(tokenAddress);
    const state = await readLensState(token);
    if (!state) return null;

    const partnerFeeBps = await getPartnerFeeBps();
    const item = await buildListItem(token, state, partnerFeeBps);
    if (!item) return null;

    const livePrice = await resolvePriceWei(token, state);
    const apiState = lensToState(state);
    apiState.priceEthPerToken = livePrice;

    return { token: item, state: apiState };
}

export async function getRhQuote(
    tokenAddress: string,
    side: RhTradeSide,
    amountWei: string
): Promise<RhQuoteResponse> {
    const token = addr(tokenAddress);
    const amount = BigInt(amountWei);
    const block = await rhPublicClient.getBlockNumber();
    const state = await readLensState(token);
    if (!state) throw new Error("Not a launchpad token");

    if (!state.migrated) {
        if (side === "buy") {
            const [tokensOut, feeQuote] = await rhPublicClient.readContract({
                address: state.curve,
                abi: RH_CURVE_READ_ABI,
                functionName: "quoteBuy",
                args: [amount],
            });
            if (tokensOut <= 0n) throw new Error("Buy quote unavailable");
            return {
                side,
                venue: "curve",
                amountInWei: amountWei,
                amountOutWei: weiStr(tokensOut),
                feeWei: weiStr(feeQuote),
                asOfBlock: Number(block),
            };
        }

        const [quoteToSeller, feeQuote] = await rhPublicClient.readContract({
            address: state.curve,
            abi: RH_CURVE_READ_ABI,
            functionName: "quoteSell",
            args: [amount],
        });
        if (quoteToSeller <= 0n) throw new Error("Sell quote unavailable");
        return {
            side,
            venue: "curve",
            amountInWei: amountWei,
            amountOutWei: weiStr(quoteToSeller),
            feeWei: weiStr(feeQuote),
            asOfBlock: Number(block),
        };
    }

    const { result } = await rhPublicClient.simulateContract({
        account: "0x0000000000000000000000000000000000000001",
        address: ROBINHOOD_LAUNCHPAD.v4Quoter as Address,
        abi: RH_V4_QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [
            {
                poolKey: bagsPoolKey(token),
                zeroForOne: directionFor(token, side).zeroForOne,
                exactAmount: amount > (1n << 128n) - 1n ? (1n << 128n) - 1n : amount,
                hookData: "0x",
            },
        ],
    });
    const amountOut = result[0];
    if (amountOut <= 0n) throw new Error("Pool quote unavailable");

    return {
        side,
        venue: "pool",
        amountInWei: amountWei,
        amountOutWei: weiStr(amountOut),
        feeWei: null,
        asOfBlock: Number(block),
    };
}

function tradeFromBuyLog(log: {
    transactionHash: `0x${string}`;
    logIndex: number;
    blockNumber: bigint;
    args: Record<string, unknown>;
}): RhTrade {
    const grossQuoteIn = log.args.grossQuoteIn as bigint;
    const tokensOut = log.args.tokensOut as bigint;
    const price = log.args.price as bigint;
    const buyer = log.args.buyer as string;
    return {
        id: `${log.transactionHash}:${log.logIndex}`,
        kind: "buy",
        venue: "curve",
        account: buyer,
        ethWei: weiStr(grossQuoteIn),
        tokenWei: weiStr(tokensOut),
        priceEthPerToken: formatUnits(price, 18),
        blockNumber: Number(log.blockNumber),
        timestamp: 0,
        txHash: log.transactionHash,
        logIndex: log.logIndex,
    };
}

function tradeFromSellLog(log: {
    transactionHash: `0x${string}`;
    logIndex: number;
    blockNumber: bigint;
    args: Record<string, unknown>;
}): RhTrade {
    const tokensIn = log.args.tokensIn as bigint;
    const grossQuoteOut = log.args.grossQuoteOut as bigint;
    const price = log.args.price as bigint;
    const seller = log.args.seller as string;
    return {
        id: `${log.transactionHash}:${log.logIndex}`,
        kind: "sell",
        venue: "curve",
        account: seller,
        ethWei: weiStr(grossQuoteOut),
        tokenWei: weiStr(tokensIn),
        priceEthPerToken: formatUnits(price, 18),
        blockNumber: Number(log.blockNumber),
        timestamp: 0,
        txHash: log.transactionHash,
        logIndex: log.logIndex,
    };
}

export async function getRhTrades(tokenAddress: string, limit = 50): Promise<RhTradesResponse> {
    const token = addr(tokenAddress);
    const state = await readLensState(token);
    if (!state) return { trades: [], nextBeforeTs: null, nextBeforeId: null };

    const cap = Math.min(200, Math.max(1, limit));
    const [buyLogs, sellLogs] = await Promise.all([
        rhPublicClient.getLogs({
            address: state.curve,
            event: tokensBoughtEvent,
            fromBlock: ROBINHOOD_DEPLOY_BLOCK,
            toBlock: "latest",
        }),
        rhPublicClient.getLogs({
            address: state.curve,
            event: tokensSoldEvent,
            fromBlock: ROBINHOOD_DEPLOY_BLOCK,
            toBlock: "latest",
        }),
    ]);

    const trades: RhTrade[] = [
        ...buyLogs.map((log) => tradeFromBuyLog({ ...log, args: log.args as Record<string, unknown> })),
        ...sellLogs.map((log) => tradeFromSellLog({ ...log, args: log.args as Record<string, unknown> })),
    ];

    trades.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
    const slice = trades.slice(0, cap);

    const uniqueBlocks = [...new Set(slice.map((t) => t.blockNumber))];
    const tsByBlock = new Map<number, number>();
    await Promise.all(
        uniqueBlocks.map(async (bn) => {
            const block = await rhPublicClient.getBlock({ blockNumber: BigInt(bn) });
            tsByBlock.set(bn, Number(block.timestamp));
        })
    );
    for (const trade of slice) {
        trade.timestamp = tsByBlock.get(trade.blockNumber) ?? 0;
    }

    return { trades: slice, nextBeforeTs: null, nextBeforeId: null };
}

export async function getRhBalances(owner: string): Promise<RhBalancesResponse> {
    const address = addr(owner);
    const [ethWei, wethWei] = await Promise.all([
        rhPublicClient.getBalance({ address }),
        rhPublicClient.readContract({
            address: ROBINHOOD_LAUNCHPAD.weth as Address,
            abi: RH_TOKEN_ABI,
            functionName: "balanceOf",
            args: [address],
        }),
    ]);
    return { ethWei: weiStr(ethWei), wethWei: weiStr(wethWei), tokenWei: null };
}

export async function getRhPortfolio(owner: string): Promise<RhPortfolioResponse> {
    await ensureLaunchRegistry();
    const address = addr(owner);
    const total = await getFactoryTokenTotal();
    const scanCount = Math.min(RH_PORTFOLIO_SCAN_TOKENS, total);
    const partnerFeeBps = await getPartnerFeeBps();

    const holdings: RhPortfolioResponse["holdings"] = [];
    const earnings: RhPortfolioResponse["earnings"] = [];

    for (let start = total - scanCount; start < total; start += 32) {
        const batch = await getFactoryTokens(start, Math.min(32, total - start));
        const states = await rhPublicClient.readContract({
            address: ROBINHOOD_LAUNCHPAD.lens as Address,
            abi: RH_LENS_ABI,
            functionName: "getTokenStates",
            args: [batch],
        });

        const balances = await Promise.all(
            batch.map((token) =>
                rhPublicClient.readContract({
                    address: token,
                    abi: RH_TOKEN_ABI,
                    functionName: "balanceOf",
                    args: [address],
                })
            )
        );

        for (let i = 0; i < batch.length; i++) {
            const balance = balances[i];
            const state = states[i];
            if (!state?.exists) continue;

            const item = await buildListItem(batch[i], state, partnerFeeBps);
            if (!item) continue;

            if (balance > 0n) {
                holdings.push({ token: item, balanceWei: weiStr(balance) });
            }

            const [lensClaimable, feeShareClaimable] = await Promise.all([
                rhPublicClient
                    .readContract({
                        address: ROBINHOOD_LAUNCHPAD.lens as Address,
                        abi: RH_LENS_ABI,
                        functionName: "claimableOf",
                        args: [batch[i], address],
                    })
                    .catch(() => 0n),
                state.feeShare
                    ? rhPublicClient
                          .readContract({
                              address: state.feeShare,
                              abi: RH_FEE_SHARE_ABI,
                              functionName: "claimable",
                              args: [address],
                          })
                          .catch(() => 0n)
                    : Promise.resolve(0n),
            ]);

            const claimable = lensClaimable > feeShareClaimable ? lensClaimable : feeShareClaimable;
            if (claimable > 0n) {
                earnings.push({
                    token: item,
                    feeShare: state.feeShare,
                    claimableWei: weiStr(claimable),
                    lifetimeWei: weiStr(claimable),
                });
            }
        }
    }

    return {
        holdings,
        earnings,
        truncated: scanCount < total,
    };
}
