import {
    encodeAbiParameters,
    encodePacked,
    getAddress,
    maxUint160,
    type Address,
    type Hex,
} from "viem";
import type { Abi } from "viem";
import { ROBINHOOD_LAUNCHPAD, ROBINHOOD_POOL } from "./addresses";

/** Robinhood-modified UniversalRouter — only this address accepts Bags v4 calldata. */
export const UNIVERSAL_ROUTER_ABI = [
    {
        type: "function",
        name: "execute",
        inputs: [
            { name: "commands", type: "bytes" },
            { name: "inputs", type: "bytes[]" },
            { name: "deadline", type: "uint256" },
        ],
        outputs: [],
        stateMutability: "payable",
    },
] as const satisfies Abi;

export const PERMIT2_ABI = [
    {
        type: "function",
        name: "approve",
        inputs: [
            { name: "token", type: "address" },
            { name: "spender", type: "address" },
            { name: "amount", type: "uint160" },
            { name: "expiration", type: "uint48" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "allowance",
        inputs: [
            { name: "owner", type: "address" },
            { name: "token", type: "address" },
            { name: "spender", type: "address" },
        ],
        outputs: [
            { name: "amount", type: "uint160" },
            { name: "expiration", type: "uint48" },
            { name: "nonce", type: "uint48" },
        ],
        stateMutability: "view",
    },
] as const satisfies Abi;

/** aeWETH proxy — WETH9-compatible interface. */
export const WETH_ABI = [
    {
        type: "function",
        name: "deposit",
        inputs: [],
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        name: "withdraw",
        inputs: [{ name: "amount", type: "uint256" }],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "balanceOf",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
    },
] as const satisfies Abi;

const V4_SWAP_COMMAND: Hex = "0x10";
const ROUTER_DEADLINE_SECONDS = 300;
export const PERMIT2_EXPIRY_SECONDS = 30 * 24 * 3600;

/** True when the token sorts below WETH and is therefore currency0. */
export function isTokenCurrency0(token: Address): boolean {
    return BigInt(token) < BigInt(ROBINHOOD_LAUNCHPAD.weth);
}

/** The v4 PoolKey the factory creates for a Bags token (token/WETH, dynamic fee, Bags hook). */
export function bagsPoolKey(token: Address) {
    const tokenAddress = getAddress(token);
    const weth = getAddress(ROBINHOOD_LAUNCHPAD.weth);
    const tokenIs0 = isTokenCurrency0(tokenAddress);
    return {
        currency0: tokenIs0 ? tokenAddress : weth,
        currency1: tokenIs0 ? weth : tokenAddress,
        fee: ROBINHOOD_POOL.dynamicFeeFlag,
        tickSpacing: ROBINHOOD_POOL.tickSpacing,
        hooks: getAddress(ROBINHOOD_LAUNCHPAD.hook),
    };
}

/** Buy = WETH -> token, sell = token -> WETH. zeroForOne is true when the INPUT is currency0. */
export function directionFor(token: Address, side: "buy" | "sell"): { zeroForOne: boolean } {
    const tokenIs0 = isTokenCurrency0(token);
    return { zeroForOne: side === "buy" ? !tokenIs0 : tokenIs0 };
}

/** Input ERC-20 for a pool swap: WETH on buys, the token on sells. */
export function poolInputToken(token: Address, side: "buy" | "sell"): Address {
    return side === "buy" ? getAddress(ROBINHOOD_LAUNCHPAD.weth) : getAddress(token);
}

/** Encode execute() calldata for an exact-in v4 swap through the Robinhood UniversalRouter. */
export function encodeV4SwapExecuteArgs(
    token: Address,
    side: "buy" | "sell",
    amountIn: bigint,
    minAmountOut: bigint
): { commands: Hex; inputs: Hex[]; deadline: bigint } {
    const poolKey = bagsPoolKey(token);
    const { zeroForOne } = directionFor(token, side);
    const inputCurrency = poolInputToken(token, side);
    const outputCurrency = side === "buy" ? getAddress(token) : getAddress(ROBINHOOD_LAUNCHPAD.weth);

    const v4Actions = encodePacked(["uint8", "uint8", "uint8"], [0x06, 0x0c, 0x0f]);

    const swapParams = encodeAbiParameters(
        [
            {
                type: "tuple",
                components: [
                    {
                        name: "poolKey",
                        type: "tuple",
                        components: [
                            { name: "currency0", type: "address" },
                            { name: "currency1", type: "address" },
                            { name: "fee", type: "uint24" },
                            { name: "tickSpacing", type: "int24" },
                            { name: "hooks", type: "address" },
                        ],
                    },
                    { name: "zeroForOne", type: "bool" },
                    { name: "amountIn", type: "uint128" },
                    { name: "amountOutMinimum", type: "uint128" },
                    // Robinhood-only field vs vanilla Uniswap — always 0 (disabled).
                    { name: "minHopPriceX36", type: "uint256" },
                    { name: "hookData", type: "bytes" },
                ],
            },
        ],
        [
            {
                poolKey,
                zeroForOne,
                amountIn,
                amountOutMinimum: minAmountOut,
                minHopPriceX36: 0n,
                hookData: "0x",
            },
        ]
    );

    const settleAll = encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        [inputCurrency, amountIn]
    );
    const takeAll = encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        [outputCurrency, minAmountOut]
    );
    const routerInput = encodeAbiParameters(
        [{ type: "bytes" }, { type: "bytes[]" }],
        [v4Actions, [swapParams, settleAll, takeAll]]
    );

    const deadline = BigInt(Math.floor(Date.now() / 1000) + ROUTER_DEADLINE_SECONDS);
    return { commands: V4_SWAP_COMMAND, inputs: [routerInput], deadline };
}

export type PoolTradeStep = "wrap" | "approve_erc20" | "approve_permit2" | "swap" | "unwrap";

/** Decide the next on-chain action required before a pool swap can execute. */
export function nextPoolTradeStep(params: {
    side: "buy" | "sell";
    amountIn: bigint;
    wethBalance: bigint;
    erc20ToPermit2: bigint;
    permit2Amount: bigint;
    permit2Expiration: number;
    nowSec?: number;
}): PoolTradeStep {
    const now = params.nowSec ?? Math.floor(Date.now() / 1000);

    if (params.side === "buy") {
        const wrapAmount =
            params.amountIn > params.wethBalance ? params.amountIn - params.wethBalance : 0n;
        if (wrapAmount > 0n) return "wrap";
    }

    if (params.erc20ToPermit2 < params.amountIn) return "approve_erc20";
    if (params.permit2Amount < params.amountIn || params.permit2Expiration <= now) {
        return "approve_permit2";
    }
    return "swap";
}

/** uint160 max for Permit2 approvals. */
export { maxUint160 };
