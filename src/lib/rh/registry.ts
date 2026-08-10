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

const tokenCreatedEvent = parseAbiItem(
    "event TokenCreated(address indexed token, address indexed curve, address indexed creator, address feeShare, address partner, bytes32 poolId, string name, string symbol, string metadataURI)"
);
const migratedEvent = parseAbiItem(
    "event Migrated(bytes32 indexed poolId, address indexed account, address indexed sender)"
);

const launches = new Map<string, LaunchRecord>();
const migrations = new Map<string, MigrationRecord>();
const blockTimestamps = new Map<number, number>();

let registryReady: Promise<void> | null = null;
let lastScannedBlock = ROBINHOOD_DEPLOY_BLOCK - 1n;

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

async function syncRegistry(): Promise<void> {
    const latest = await rhPublicClient.getBlockNumber();
    const from = lastScannedBlock + 1n;
    if (from > latest) return;

    const chunk = 25_000n;
    for (let start = from; start <= latest; start += chunk) {
        const end = start + chunk - 1n > latest ? latest : start + chunk - 1n;
        await Promise.all([scanLaunches(start, end), scanMigrations(start, end)]);
    }
    lastScannedBlock = latest;
}

/** Load launch + migration metadata from chain logs (cached in-process). */
export function ensureLaunchRegistry(): Promise<void> {
    if (!registryReady) {
        registryReady = syncRegistry().catch((err) => {
            registryReady = null;
            throw err;
        });
    }
    return registryReady;
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

export async function getPartnerFeeBps(): Promise<number> {
    const bps = await rhPublicClient.readContract({
        address: ROBINHOOD_LAUNCHPAD.factory as Address,
        abi: RH_FACTORY_ABI,
        functionName: "partnerFeeBps",
    });
    return Number(bps);
}
