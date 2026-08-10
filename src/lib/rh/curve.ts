import type { Abi } from "viem";

/**
 * Robinhood Chain bonding curve interface.
 *
 * No ABI is published for these contracts, so this was recovered from live
 * mainnet transactions against a token's `curve` address:
 *
 *   buy  → selector 0xd96a094a, one uint256 arg, ETH sent as msg.value
 *          (matches `buy(uint256)`; the arg is the minimum tokens out)
 *   sell → selector 0xd79875eb, two uint256 args, zero value
 *          (matches `sell(uint256,uint256)`: token amount, minimum ETH out)
 *
 * Each token deploys its own curve contract, so the target address always comes
 * from the token payload — never hard-code one.
 */
export const RH_CURVE_ABI = [
    {
        type: "function",
        name: "buy",
        stateMutability: "payable",
        inputs: [{ name: "minTokensOut", type: "uint256" }],
        outputs: [],
    },
    {
        type: "function",
        name: "sell",
        stateMutability: "nonpayable",
        inputs: [
            { name: "tokenAmount", type: "uint256" },
            { name: "minEthOut", type: "uint256" },
        ],
        outputs: [],
    },
] as const satisfies Abi;

/** Minimal ERC-20 surface needed to size and approve a sell. */
export const ERC20_ABI = [
    {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        type: "function",
        name: "allowance",
        stateMutability: "view",
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
        ],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        type: "function",
        name: "approve",
        stateMutability: "nonpayable",
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        type: "function",
        name: "decimals",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint8" }],
    },
] as const satisfies Abi;

/** Slippage choices offered in the trade widget, in basis points. */
export const SLIPPAGE_OPTIONS_BPS = [50, 100, 300, 500] as const;

export const DEFAULT_SLIPPAGE_BPS = 100;

/** Apply slippage tolerance to a quoted output to get the on-chain minimum. */
export function applySlippage(amountOutWei: bigint, slippageBps: number): bigint {
    const bps = BigInt(Math.max(0, Math.min(10_000, Math.round(slippageBps))));
    return (amountOutWei * (10_000n - bps)) / 10_000n;
}

/** Parse a human decimal string into wei without floating-point drift. */
export function parseUnitsSafe(value: string, decimals = 18): bigint | null {
    const trimmed = value.trim();
    if (!trimmed || !/^\d*\.?\d*$/.test(trimmed)) return null;
    const [whole = "0", frac = ""] = trimmed.split(".");
    if (frac.length > decimals) return null;
    const padded = frac.padEnd(decimals, "0");
    try {
        return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
    } catch {
        return null;
    }
}

/** Format wei as a readable decimal string, trimming trailing zeros. */
export function formatUnitsSafe(value: bigint, decimals = 18, maxFractionDigits = 6): string {
    const negative = value < 0n;
    const abs = negative ? -value : value;
    const base = 10n ** BigInt(decimals);
    const whole = abs / base;
    const frac = abs % base;

    let fracStr = frac.toString().padStart(decimals, "0").slice(0, maxFractionDigits);
    fracStr = fracStr.replace(/0+$/, "");

    const body = fracStr ? `${whole}.${fracStr}` : whole.toString();
    return negative ? `-${body}` : body;
}
