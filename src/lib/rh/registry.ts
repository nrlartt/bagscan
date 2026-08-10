import "server-only";
import { parseAbiItem, type Address } from "viem";
import { RH_FACTORY_ABI } from "./abi";
import { ROBINHOOD_DEPLOY_BLOCK, ROBINHOOD_LAUNCHPAD } from "./addresses";
import { rhPublicClient } from "./rpc";

export interface LaunchRecord {
    address: Address;
    curve: Address;
    creator: Address;
    feeShare: Address;
    partner: Address;
    poolId: `0x${string}`;
    name: string;
    symbol: string;
    metadataURI: string;
    createdAtBlock: number;
    createdAtTimestamp: number;
    txHash: `0x${string}`;
}

interface MigrationRecord {
    blockNumber: number;
    timestamp: number;
    txHash: `0x${string}`;
}

/** Only scan this many blocks synchronously on cold start — enough for recent launches. */
const BOOTSTRAP_BLOCK_WINDOW = 120_000n;
/** Background sync chunk size — keep small; some public RPCs reject wide eth_getLogs ranges. */
const SYNC_CHUNK = 5_000n;
/** Max chunks per background tick so we don't starve request handlers. */
const SYNC_CHUNKS_PER_TICK = 2;

const tokenCreatedEvent = parseAbiItem(
    "event TokenCreated(address indexed token, address indexed curve, address indexed creator, address feeShare, address partner, bytes32 poolId, string name, string symbol, string metadataURI)"
);
const migratedEvent = parseAbiItem(
    "event Migrated(bytes32 indexed poolId, address indexed account, address indexed sender)"
);

const launches = new Map<string, LaunchRecord>();
const migrations = new Map<string, MigrationRecord>();
const blockTimestamps = new Map<number, number>();

let lastScannedBlock = ROBINHOOD_DEPLOY_BLOCK - 1n;
let bootstrapDone = false;
let syncRunning = false;

async function blockTimestamp(blockNumber: bigint | number): Promise<number> {
    const n = Number(blockNumber);
    const cached = blockTimestamps.get(n);
    if (cached != null) return cached;
    const block = await rhPublicClient.getBlock({ blockNumber: BigInt(n) });
    const ts = Number(block.timestamp);
    blockTimestamps.set(n, ts);
    return ts;
}

async function scanLaunches(fromBlock: bigint, toBlock: bigint): Promise<void> {
    const logs = await rhPublicClient.getLogs({
        address: ROBINHOOD_LAUNCHPAD.factory as Address,
        event: tokenCreatedEvent,
        fromBlock,
        toBlock,
    });

    for (const log of logs) {
        const args = log.args;
        if (!args.token || !args.curve || !args.creator) continue;
        const ts = await blockTimestamp(log.blockNumber);
        launches.set(args.token.toLowerCase(), {
            address: args.token,
            curve: args.curve,
            creator: args.creator,
            feeShare: args.feeShare ?? ("0x0000000000000000000000000000000000000000" as Address),
            partner: args.partner ?? ("0x0000000000000000000000000000000000000000" as Address),
            poolId: (args.poolId ?? "0x") as `0x${string}`,
            name: args.name ?? "",
            symbol: args.symbol ?? "",
            metadataURI: args.metadataURI ?? "",
            createdAtBlock: Number(log.blockNumber),
            createdAtTimestamp: ts,
            txHash: log.transactionHash,
        });
    }
}

async function scanMigrations(fromBlock: bigint, toBlock: bigint): Promise<void> {
    const logs = await rhPublicClient.getLogs({
        event: migratedEvent,
        fromBlock,
        toBlock,
    });

    for (const log of logs) {
        if (!log.address) continue;
        const curve = log.address.toLowerCase();
        if (migrations.has(curve)) continue;
        const ts = await blockTimestamp(log.blockNumber);
        migrations.set(curve, {
            blockNumber: Number(log.blockNumber),
            timestamp: ts,
            txHash: log.transactionHash,
        });
    }
}

async function scanRange(fromBlock: bigint, toBlock: bigint): Promise<void> {
    if (fromBlock > toBlock) return;
    for (let start = fromBlock; start <= toBlock; start += SYNC_CHUNK) {
        const end = start + SYNC_CHUNK - 1n > toBlock ? toBlock : start + SYNC_CHUNK - 1n;
        await Promise.all([scanLaunches(start, end), scanMigrations(start, end)]);
        lastScannedBlock = end;
    }
}

async function bootstrapRegistry(): Promise<void> {
    const latest = await rhPublicClient.getBlockNumber();
    const from = latest > BOOTSTRAP_BLOCK_WINDOW ? latest - BOOTSTRAP_BLOCK_WINDOW : ROBINHOOD_DEPLOY_BLOCK;
    await scanRange(from, latest);
    bootstrapDone = true;
}

async function continueRegistrySync(): Promise<void> {
    if (syncRunning) return;
    syncRunning = true;
    try {
        const latest = await rhPublicClient.getBlockNumber();
        const backlogStart = ROBINHOOD_DEPLOY_BLOCK;
        const gapEnd = lastScannedBlock >= latest ? null : lastScannedBlock + 1n;

        // Fill historical gap in small slices (oldest first).
        if (lastScannedBlock + 1n < latest - BOOTSTRAP_BLOCK_WINDOW) {
            const histEnd = latest - BOOTSTRAP_BLOCK_WINDOW;
            const histFrom = lastScannedBlock + 1n < backlogStart ? backlogStart : lastScannedBlock + 1n;
            if (histFrom <= histEnd) {
                const span = histEnd - histFrom;
                const maxSpan = SYNC_CHUNK * BigInt(SYNC_CHUNKS_PER_TICK);
                await scanRange(histFrom, histFrom + (span > maxSpan ? maxSpan : span));
            }
        }

        if (gapEnd != null && gapEnd <= latest) {
            const span = latest - gapEnd;
            const maxSpan = SYNC_CHUNK * BigInt(SYNC_CHUNKS_PER_TICK);
            await scanRange(gapEnd, gapEnd + (span > maxSpan ? maxSpan : span));
        }
    } catch (err) {
        console.error("[rh/registry] background sync error:", err);
    } finally {
        syncRunning = false;
    }
}

/** Fast bootstrap for recent launches, then keep syncing older history in the background. */
export function kickRegistrySync(): void {
    if (!bootstrapDone) {
        void bootstrapRegistry()
            .catch((err) => console.error("[rh/registry] bootstrap error:", err))
            .finally(() => {
                void continueRegistrySync();
            });
        return;
    }
    void continueRegistrySync();
}

export function getLaunchRecord(token: string): LaunchRecord | undefined {
    return launches.get(token.toLowerCase());
}

export function getMigrationForCurve(curve: string): MigrationRecord | undefined {
    return migrations.get(curve.toLowerCase());
}

export async function getFactoryTokenTotal(): Promise<number> {
    const total = await rhPublicClient.readContract({
        address: ROBINHOOD_LAUNCHPAD.factory as Address,
        abi: RH_FACTORY_ABI,
        functionName: "allTokensLength",
    });
    return Number(total);
}

export async function getFactoryTokens(offset: number, limit: number): Promise<Address[]> {
    if (limit <= 0) return [];
    return [...(await rhPublicClient.readContract({
        address: ROBINHOOD_LAUNCHPAD.factory as Address,
        abi: RH_FACTORY_ABI,
        functionName: "getTokens",
        args: [BigInt(offset), BigInt(limit)],
    }))];
}

let partnerFeeBpsCache: { ts: number; value: number } | null = null;

export async function getPartnerFeeBps(): Promise<number> {
    const now = Date.now();
    if (partnerFeeBpsCache && now - partnerFeeBpsCache.ts < 60_000) {
        return partnerFeeBpsCache.value;
    }
    const bps = await rhPublicClient.readContract({
        address: ROBINHOOD_LAUNCHPAD.factory as Address,
        abi: RH_FACTORY_ABI,
        functionName: "partnerFeeBps",
    });
    partnerFeeBpsCache = { ts: now, value: Number(bps) };
    return partnerFeeBpsCache.value;
}

/** Fetch TokenCreated for one token when it is missing from the in-memory registry. */
export async function hydrateLaunchRecord(token: Address): Promise<LaunchRecord | undefined> {
    const cached = getLaunchRecord(token);
    if (cached) return cached;

    const logs = await rhPublicClient.getLogs({
        address: ROBINHOOD_LAUNCHPAD.factory as Address,
        event: tokenCreatedEvent,
        args: { token },
        fromBlock: ROBINHOOD_DEPLOY_BLOCK,
        toBlock: "latest",
    });
    const log = logs[0];
    if (!log?.args.token || !log.args.curve || !log.args.creator) return undefined;

    const ts = await blockTimestamp(log.blockNumber);
    const record: LaunchRecord = {
        address: log.args.token,
        curve: log.args.curve,
        creator: log.args.creator,
        feeShare: log.args.feeShare ?? ("0x0000000000000000000000000000000000000000" as Address),
        partner: log.args.partner ?? ("0x0000000000000000000000000000000000000000" as Address),
        poolId: (log.args.poolId ?? "0x") as `0x${string}`,
        name: log.args.name ?? "",
        symbol: log.args.symbol ?? "",
        metadataURI: log.args.metadataURI ?? "",
        createdAtBlock: Number(log.blockNumber),
        createdAtTimestamp: ts,
        txHash: log.transactionHash,
    };
    launches.set(token.toLowerCase(), record);
    return record;
}
