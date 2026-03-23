export const dynamic = "force-dynamic";
export const maxDuration = 25;

import { NextRequest, NextResponse } from "next/server";
import {
    Connection,
    ParsedAccountData,
    PublicKey,
} from "@solana/web3.js";
import {
    getClaimablePositions,
    getDexScreenerPairs,
    getHeliusAssetBatch,
    getSolPriceUsd,
} from "@/lib/bags/client";
import { getRpcUrl, SOL_MINT } from "@/lib/solana";
import { buildWalletCostBasis } from "@/lib/portfolio/cost-basis";
import type {
    PortfolioClaimablePosition,
    PortfolioHolding,
    PortfolioResponse,
    PortfolioSummary,
} from "@/lib/portfolio/types";

const TOKEN_PROGRAM_ID = new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

type DexPair = Awaited<ReturnType<typeof getDexScreenerPairs>>[number];

interface RawHolding {
    mint: string;
    tokenAccount: string;
    amount: number;
    rawAmount: string;
    decimals: number;
}

function isParsedTokenAccountData(data: unknown): data is ParsedAccountData {
    return typeof data === "object" && data !== null && "parsed" in data;
}

function toNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

function normalizeUsd(value: number | undefined): number | undefined {
    if (value === undefined || !Number.isFinite(value) || value <= 0) return undefined;
    return value;
}

function getPairScore(pair: DexPair) {
    return (
        (toNumber(pair.liquidity?.usd) ?? 0) * 10 +
        (toNumber(pair.volume?.h24) ?? 0) +
        (toNumber(pair.marketCap) ?? 0) * 0.01
    );
}

function pickBestPair(pairs: DexPair[]): DexPair | undefined {
    return [...pairs].sort((a, b) => getPairScore(b) - getPairScore(a))[0];
}

function calculateDailyPnl(valueUsd: number | undefined, priceChange24h: number | undefined) {
    if (valueUsd === undefined || priceChange24h === undefined) return undefined;
    const factor = 1 + priceChange24h / 100;
    if (!Number.isFinite(factor) || factor <= 0) return undefined;
    const previousValue = valueUsd / factor;
    return valueUsd - previousValue;
}

function compareHoldings(a: PortfolioHolding, b: PortfolioHolding) {
    const valueDiff = (b.valueUsd ?? 0) - (a.valueUsd ?? 0);
    if (valueDiff !== 0) return valueDiff;
    return b.amount - a.amount;
}

function aggregateHoldingsByMint(holdings: RawHolding[]) {
    const grouped = new Map<string, RawHolding>();

    for (const holding of holdings) {
        const existing = grouped.get(holding.mint);
        if (!existing) {
            grouped.set(holding.mint, { ...holding });
            continue;
        }

        existing.amount += holding.amount;
        try {
            existing.rawAmount = (BigInt(existing.rawAmount) + BigInt(holding.rawAmount)).toString();
        } catch {
            existing.rawAmount = String(Number(existing.rawAmount) + Number(holding.rawAmount));
        }
    }

    return Array.from(grouped.values());
}

async function getWalletHoldings(connection: Connection, owner: PublicKey): Promise<RawHolding[]> {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        owner,
        { programId: TOKEN_PROGRAM_ID },
        "confirmed"
    );

    const holdings: RawHolding[] = [];

    for (const entry of tokenAccounts.value) {
        if (!isParsedTokenAccountData(entry.account.data)) continue;
        const info = entry.account.data.parsed.info as {
            mint?: string;
            tokenAmount?: {
                amount?: string;
                decimals?: number;
                uiAmount?: number | null;
                uiAmountString?: string;
            };
        };

        const mint = info.mint;
        const tokenAmount = info.tokenAmount;
        if (!mint || !tokenAmount) continue;

        const amount = Number(tokenAmount.uiAmountString ?? tokenAmount.uiAmount ?? 0);
        const rawAmount = tokenAmount.amount ?? "0";
        const decimals = tokenAmount.decimals ?? 0;

        if (!Number.isFinite(amount) || amount <= 0) continue;

        holdings.push({
            mint,
            tokenAccount: entry.pubkey.toBase58(),
            amount,
            rawAmount,
            decimals,
        });
    }

    return holdings;
}

export async function GET(req: NextRequest) {
    const wallet = req.nextUrl.searchParams.get("wallet")?.trim();
    if (!wallet) {
        return NextResponse.json(
            { success: false, error: "Missing wallet query parameter" },
            { status: 400 }
        );
    }

    let owner: PublicKey;
    try {
        owner = new PublicKey(wallet);
    } catch {
        return NextResponse.json(
            { success: false, error: "Invalid Solana wallet address" },
            { status: 400 }
        );
    }

    try {
        const connection = new Connection(getRpcUrl(), "confirmed");

        const [solLamports, rawHoldingsResponse, claimablePositionsRaw, solPrice] = await Promise.all([
            connection.getBalance(owner, "confirmed"),
            getWalletHoldings(connection, owner),
            getClaimablePositions(owner.toBase58()),
            getSolPriceUsd(),
        ]);
        const rawHoldings = aggregateHoldingsByMint(rawHoldingsResponse);

        const claimPositionMints = claimablePositionsRaw.map((position) => position.baseMint).filter(Boolean);
        const metadataMints = Array.from(new Set(rawHoldings.map((holding) => holding.mint).concat(claimPositionMints)));

        const dexPairResults = await Promise.all(
            Array.from({ length: Math.ceil(rawHoldings.length / 30) }, (_, index) =>
                getDexScreenerPairs(rawHoldings.slice(index * 30, index * 30 + 30).map((holding) => holding.mint))
            )
        );

        const pairMap = new Map<string, DexPair>();
        for (const batch of dexPairResults) {
            const grouped = new Map<string, DexPair[]>();
            for (const pair of batch) {
                const mint = pair.baseToken?.address;
                if (!mint) continue;
                grouped.set(mint, [...(grouped.get(mint) ?? []), pair]);
            }
            for (const [mint, pairs] of grouped) {
                const best = pickBestPair(pairs);
                if (best) pairMap.set(mint, best);
            }
        }

        const assetMap = await getHeliusAssetBatch(metadataMints);

        const solBalance = solLamports / 1_000_000_000;
        const costBasis = await buildWalletCostBasis(
            owner.toBase58(),
            rawHoldings.map((holding) => ({ mint: holding.mint, amount: holding.amount })),
            solBalance,
            solPrice
        );

        const holdings = rawHoldings
            .map((holding): PortfolioHolding | null => {
                const asset = assetMap.get(holding.mint);
                const pair = pairMap.get(holding.mint);
                const position = costBasis.positions.get(holding.mint);
                const priceUsd = normalizeUsd(toNumber(pair?.priceUsd));
                const valueUsd = priceUsd !== undefined ? holding.amount * priceUsd : undefined;
                const priceChange24h = toNumber(pair?.priceChange?.h24);
                const pnl24hUsd = calculateDailyPnl(valueUsd, priceChange24h);
                const costBasisUsd = position?.costBasisUsd;
                const unrealizedPnlUsd =
                    valueUsd !== undefined && costBasisUsd !== undefined
                        ? valueUsd - costBasisUsd
                        : undefined;
                const unrealizedPnlPercent =
                    valueUsd !== undefined &&
                    costBasisUsd !== undefined &&
                    costBasisUsd > 0
                        ? (unrealizedPnlUsd! / costBasisUsd) * 100
                        : undefined;
                const name =
                    asset?.content?.metadata?.name ??
                    pair?.baseToken?.name ??
                    undefined;
                const symbol =
                    asset?.content?.metadata?.symbol ??
                    pair?.baseToken?.symbol ??
                    undefined;
                const image =
                    asset?.content?.links?.image ??
                    asset?.content?.files?.[0]?.cdn_uri ??
                    asset?.content?.files?.[0]?.uri ??
                    pair?.info?.imageUrl ??
                    undefined;

                const isLikelyNft = holding.decimals === 0 && priceUsd === undefined && !symbol;
                if (isLikelyNft) return null;

                return {
                    mint: holding.mint,
                    tokenAccount: holding.tokenAccount,
                    amount: holding.amount,
                    rawAmount: holding.rawAmount,
                    decimals: holding.decimals,
                    symbol,
                    name,
                    image,
                    priceUsd,
                    valueUsd,
                    costBasisUsd,
                    averageCostUsd: position?.averageCostUsd,
                    unrealizedPnlUsd,
                    unrealizedPnlPercent,
                    costBasisStatus: position?.costBasisStatus ?? "unknown",
                    priceChange24h,
                    pnl24hUsd,
                    liquidityUsd: normalizeUsd(toNumber(pair?.liquidity?.usd)),
                    volume24hUsd: normalizeUsd(toNumber(pair?.volume?.h24)),
                };
            })
            .filter((holding): holding is PortfolioHolding => holding !== null)
            .sort(compareHoldings);

        const claimablePositions: PortfolioClaimablePosition[] = claimablePositionsRaw
            .map((position) => {
                const asset = assetMap.get(position.baseMint);
                const claimableSol =
                    position.claimableDisplayAmount ??
                    position.totalClaimableLamportsUserShare / 1_000_000_000;

                return {
                    baseMint: position.baseMint,
                    symbol: asset?.content?.metadata?.symbol,
                    name: asset?.content?.metadata?.name,
                    image:
                        asset?.content?.links?.image ??
                        asset?.content?.files?.[0]?.cdn_uri ??
                        asset?.content?.files?.[0]?.uri ??
                        undefined,
                    claimableSol,
                    claimableUsd: claimableSol * solPrice,
                    userBps: position.userBps,
                    isMigrated: position.isMigrated,
                    isCustomFeeVault: position.isCustomFeeVault,
                };
            })
            .sort((a, b) => b.claimableUsd - a.claimableUsd);

        const solPosition = costBasis.positions.get(SOL_MINT);
        const solValueUsd = solBalance * solPrice;
        const tokenValueUsd = holdings.reduce((sum, holding) => sum + (holding.valueUsd ?? 0), 0);
        const totalValueUsd = tokenValueUsd + solValueUsd;
        const tokenCostBasisUsd = holdings.reduce((sum, holding) => sum + (holding.costBasisUsd ?? 0), 0);
        const solCostBasisUsd = solPosition?.costBasisUsd ?? 0;
        const totalCostBasisUsd = tokenCostBasisUsd + solCostBasisUsd;
        const totalUnrealizedPnlUsd = totalValueUsd - totalCostBasisUsd;
        const totalUnrealizedPnlPercent =
            totalCostBasisUsd > 0 ? (totalUnrealizedPnlUsd / totalCostBasisUsd) * 100 : 0;
        const totalPnl24hUsd = holdings.reduce((sum, holding) => sum + (holding.pnl24hUsd ?? 0), 0);
        const claimableFeesSol = claimablePositions.reduce((sum, position) => sum + position.claimableSol, 0);
        const claimableFeesUsd = claimablePositions.reduce((sum, position) => sum + position.claimableUsd, 0);
        const pricedBase = totalValueUsd - totalPnl24hUsd;
        const totalPnl24hPercent =
            pricedBase > 0 ? (totalPnl24hUsd / pricedBase) * 100 : 0;

        const summary: PortfolioSummary = {
            totalValueUsd,
            tokenValueUsd,
            solBalance,
            solValueUsd,
            totalCostBasisUsd,
            tokenCostBasisUsd,
            solCostBasisUsd,
            totalUnrealizedPnlUsd,
            totalUnrealizedPnlPercent,
            totalPnl24hUsd,
            totalPnl24hPercent,
            holdingsCount: holdings.length,
            pricedHoldingsCount: holdings.filter((holding) => holding.valueUsd !== undefined).length,
            costBasisHoldingsCount: holdings.filter((holding) => holding.costBasisUsd !== undefined).length,
            costBasisCompleteHoldingsCount: holdings.filter((holding) => holding.costBasisStatus === "complete").length,
            claimableFeesSol,
            claimableFeesUsd,
            claimablePositionsCount: claimablePositions.length,
        };

        const data: PortfolioResponse = {
            wallet: owner.toBase58(),
            generatedAt: new Date().toISOString(),
            summary,
            costBasis: costBasis.meta,
            holdings,
            claimablePositions,
        };

        return NextResponse.json(
            { success: true, data },
            {
                headers: {
                    "Cache-Control": "private, no-store",
                },
            }
        );
    } catch (error) {
        console.error("[api/portfolio] error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
