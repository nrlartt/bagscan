import type { RhPortfolioResponse, RhBalancesResponse, RhTokenListItem } from "./rh-types";
import { parseRhFixed18, parseWeiToEth } from "./rh-mappers";

const RH_TOTAL_SUPPLY = 1_000_000_000;

export interface RhPortfolioHoldingView {
    address: string;
    name?: string;
    symbol?: string;
    image?: string;
    /** Token balance in whole tokens. */
    balance: number;
    balanceWei: string;
    priceEth?: number;
    priceUsd?: number;
    valueEth?: number;
    valueUsd?: number;
    /** Share of the fixed 1B supply held by this wallet, in percent. */
    supplyPct?: number;
    fdvUsd?: number;
    bondingProgressPct?: number;
    isMigrated: boolean;
    createdAt?: string;
}

export interface RhEarningView {
    address: string;
    name?: string;
    symbol?: string;
    image?: string;
    feeShare: string;
    claimableEth: number;
    claimableUsd?: number;
    lifetimeEth: number;
    lifetimeUsd?: number;
    isMigrated: boolean;
}

export interface RhPortfolioSummary {
    tokenValueUsd: number;
    tokenValueEth: number;
    ethBalance: number;
    wethBalance: number;
    ethValueUsd?: number;
    totalValueUsd?: number;
    holdingsCount: number;
    pricedHoldingsCount: number;
    claimableEth: number;
    claimableUsd?: number;
    lifetimeEarnedEth: number;
    lifetimeEarnedUsd?: number;
    earningPositionsCount: number;
}

export interface RhPortfolioView {
    owner: string;
    generatedAt: string;
    ethUsd?: number;
    truncated: boolean;
    summary: RhPortfolioSummary;
    holdings: RhPortfolioHoldingView[];
    earnings: RhEarningView[];
}

function tokenImage(token: RhTokenListItem): string | undefined {
    return token.metadata?.image ?? undefined;
}

function usd(eth: number | undefined, ethUsd: number | undefined): number | undefined {
    if (eth == null || ethUsd == null) return undefined;
    return eth * ethUsd;
}

/**
 * Normalize the Bags `/evm/rh/portfolio` + `/evm/rh/balances` payloads into the
 * shape the portfolio UI renders. Values are derived from the curve/pool spot
 * price, so they are marks — not realized proceeds — and there is no cost basis
 * to compare against (the API exposes trades per token, not per wallet).
 */
export function buildRhPortfolioView(
    owner: string,
    portfolio: RhPortfolioResponse,
    balances: RhBalancesResponse | null,
    ethUsd?: number
): RhPortfolioView {
    const holdings: RhPortfolioHoldingView[] = (portfolio.holdings ?? []).map((entry) => {
        const balance = parseWeiToEth(entry.balanceWei) ?? 0;
        const priceEth = parseRhFixed18(entry.token.priceEthPerToken);
        const valueEth = priceEth != null ? balance * priceEth : undefined;
        const priceUsd = priceEth != null && ethUsd != null ? priceEth * ethUsd : undefined;

        return {
            address: entry.token.address,
            name: entry.token.name,
            symbol: entry.token.symbol,
            image: tokenImage(entry.token),
            balance,
            balanceWei: entry.balanceWei,
            priceEth,
            priceUsd,
            valueEth,
            valueUsd: usd(valueEth, ethUsd),
            supplyPct: balance > 0 ? (balance / RH_TOTAL_SUPPLY) * 100 : 0,
            fdvUsd: priceUsd != null ? priceUsd * RH_TOTAL_SUPPLY : undefined,
            bondingProgressPct: entry.token.bondingProgressPct,
            isMigrated: entry.token.migrated,
            createdAt: entry.token.createdAtTimestamp
                ? new Date(entry.token.createdAtTimestamp * 1000).toISOString()
                : undefined,
        };
    });

    holdings.sort((a, b) => {
        const diff = (b.valueEth ?? 0) - (a.valueEth ?? 0);
        if (diff !== 0) return diff;
        return b.balance - a.balance;
    });

    const earnings: RhEarningView[] = (portfolio.earnings ?? []).map((entry) => {
        const claimableEth = parseWeiToEth(entry.claimableWei) ?? 0;
        const lifetimeEth = parseWeiToEth(entry.lifetimeWei) ?? 0;
        return {
            address: entry.token.address,
            name: entry.token.name,
            symbol: entry.token.symbol,
            image: tokenImage(entry.token),
            feeShare: entry.feeShare,
            claimableEth,
            claimableUsd: usd(claimableEth, ethUsd),
            lifetimeEth,
            lifetimeUsd: usd(lifetimeEth, ethUsd),
            isMigrated: entry.token.migrated,
        };
    });

    earnings.sort((a, b) => b.claimableEth - a.claimableEth || b.lifetimeEth - a.lifetimeEth);

    const tokenValueEth = holdings.reduce((sum, h) => sum + (h.valueEth ?? 0), 0);
    const ethBalance = parseWeiToEth(balances?.ethWei) ?? 0;
    const wethBalance = parseWeiToEth(balances?.wethWei) ?? 0;
    const nativeEth = ethBalance + wethBalance;
    const claimableEth = earnings.reduce((sum, e) => sum + e.claimableEth, 0);
    const lifetimeEarnedEth = earnings.reduce((sum, e) => sum + e.lifetimeEth, 0);

    const tokenValueUsd = usd(tokenValueEth, ethUsd) ?? 0;
    const ethValueUsd = usd(nativeEth, ethUsd);

    return {
        owner,
        generatedAt: new Date().toISOString(),
        ethUsd,
        truncated: Boolean(portfolio.truncated),
        summary: {
            tokenValueEth,
            tokenValueUsd,
            ethBalance,
            wethBalance,
            ethValueUsd,
            totalValueUsd: ethUsd != null ? tokenValueUsd + (ethValueUsd ?? 0) : undefined,
            holdingsCount: holdings.length,
            pricedHoldingsCount: holdings.filter((h) => h.valueEth != null).length,
            claimableEth,
            claimableUsd: usd(claimableEth, ethUsd),
            lifetimeEarnedEth,
            lifetimeEarnedUsd: usd(lifetimeEarnedEth, ethUsd),
            earningPositionsCount: earnings.length,
        },
        holdings,
        earnings,
    };
}
