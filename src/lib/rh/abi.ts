import type { Abi } from "viem";

export const RH_FACTORY_ABI = [
    {
        type: "function",
        name: "allTokensLength",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "length", type: "uint256" }],
    },
    {
        type: "function",
        name: "getTokens",
        stateMutability: "view",
        inputs: [
            { name: "offset", type: "uint256" },
            { name: "limit", type: "uint256" },
        ],
        outputs: [{ name: "tokens", type: "address[]" }],
    },
    {
        type: "function",
        name: "partnerFeeBps",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint16" }],
    },
    {
        type: "event",
        name: "TokenCreated",
        inputs: [
            { name: "token", type: "address", indexed: true },
            { name: "curve", type: "address", indexed: true },
            { name: "creator", type: "address", indexed: true },
            { name: "feeShare", type: "address", indexed: false },
            { name: "partner", type: "address", indexed: false },
            { name: "poolId", type: "bytes32", indexed: false },
            { name: "name", type: "string", indexed: false },
            { name: "symbol", type: "string", indexed: false },
            { name: "metadataURI", type: "string", indexed: false },
        ],
    },
] as const satisfies Abi;

export const RH_LENS_ABI = [
    {
        type: "function",
        name: "getTokenState",
        stateMutability: "view",
        inputs: [{ name: "token", type: "address" }],
        outputs: [
            {
                name: "state",
                type: "tuple",
                components: [
                    { name: "exists", type: "bool" },
                    { name: "migrated", type: "bool" },
                    { name: "curve", type: "address" },
                    { name: "feeShare", type: "address" },
                    { name: "poolId", type: "bytes32" },
                    { name: "thresholdQuote", type: "uint256" },
                    { name: "realQuoteReserves", type: "uint256" },
                    { name: "realTokenReserves", type: "uint256" },
                    { name: "virtualTokenReserves", type: "uint256" },
                    { name: "virtualQuoteReserves", type: "uint256" },
                    { name: "priceQuotePerToken", type: "uint256" },
                    { name: "bondingProgressPct", type: "uint256" },
                    { name: "totalRaised", type: "uint256" },
                ],
            },
        ],
    },
    {
        type: "function",
        name: "getTokenStates",
        stateMutability: "view",
        inputs: [{ name: "tokens", type: "address[]" }],
        outputs: [
            {
                name: "states",
                type: "tuple[]",
                components: [
                    { name: "exists", type: "bool" },
                    { name: "migrated", type: "bool" },
                    { name: "curve", type: "address" },
                    { name: "feeShare", type: "address" },
                    { name: "poolId", type: "bytes32" },
                    { name: "thresholdQuote", type: "uint256" },
                    { name: "realQuoteReserves", type: "uint256" },
                    { name: "realTokenReserves", type: "uint256" },
                    { name: "virtualTokenReserves", type: "uint256" },
                    { name: "virtualQuoteReserves", type: "uint256" },
                    { name: "priceQuotePerToken", type: "uint256" },
                    { name: "bondingProgressPct", type: "uint256" },
                    { name: "totalRaised", type: "uint256" },
                ],
            },
        ],
    },
    {
        type: "function",
        name: "claimableOf",
        stateMutability: "view",
        inputs: [
            { name: "token", type: "address" },
            { name: "user", type: "address" },
        ],
        outputs: [{ name: "amount", type: "uint256" }],
    },
] as const satisfies Abi;

export const RH_TOKEN_ABI = [
    {
        type: "function",
        name: "name",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
    },
    {
        type: "function",
        name: "symbol",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
    },
    {
        type: "function",
        name: "metadataURI",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
    },
    {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const satisfies Abi;

export const RH_CURVE_READ_ABI = [
    {
        type: "function",
        name: "quoteBuy",
        stateMutability: "view",
        inputs: [{ name: "quoteIn", type: "uint256" }],
        outputs: [
            { name: "tokensOut", type: "uint256" },
            { name: "feeQuote", type: "uint256" },
            { name: "netQuoteIn", type: "uint256" },
            { name: "grossUsed", type: "uint256" },
            { name: "refundQuote", type: "uint256" },
        ],
    },
    {
        type: "function",
        name: "quoteSell",
        stateMutability: "view",
        inputs: [{ name: "tokensIn", type: "uint256" }],
        outputs: [
            { name: "quoteToSeller", type: "uint256" },
            { name: "feeQuote", type: "uint256" },
            { name: "grossQuoteOut", type: "uint256" },
        ],
    },
    {
        type: "event",
        name: "TokensBought",
        inputs: [
            { name: "buyer", type: "address", indexed: true },
            { name: "recipient", type: "address", indexed: true },
            { name: "grossQuoteIn", type: "uint256", indexed: false },
            { name: "netQuoteIn", type: "uint256", indexed: false },
            { name: "tokensOut", type: "uint256", indexed: false },
            { name: "feeQuote", type: "uint256", indexed: false },
            { name: "vaultFeeQuote", type: "uint256", indexed: false },
            { name: "creatorFeeWETH", type: "uint256", indexed: false },
            { name: "refundQuote", type: "uint256", indexed: false },
            { name: "price", type: "uint256", indexed: false },
            { name: "virtualTokenReserves", type: "uint256", indexed: false },
            { name: "virtualQuoteReserves", type: "uint256", indexed: false },
        ],
    },
    {
        type: "event",
        name: "TokensSold",
        inputs: [
            { name: "seller", type: "address", indexed: true },
            { name: "recipient", type: "address", indexed: true },
            { name: "tokensIn", type: "uint256", indexed: false },
            { name: "grossQuoteOut", type: "uint256", indexed: false },
            { name: "netQuoteToRecipient", type: "uint256", indexed: false },
            { name: "feeQuote", type: "uint256", indexed: false },
            { name: "vaultFeeQuote", type: "uint256", indexed: false },
            { name: "creatorFeeWETH", type: "uint256", indexed: false },
            { name: "price", type: "uint256", indexed: false },
            { name: "virtualTokenReserves", type: "uint256", indexed: false },
            { name: "virtualQuoteReserves", type: "uint256", indexed: false },
        ],
    },
    {
        type: "event",
        name: "Migrated",
        inputs: [
            { name: "poolId", type: "bytes32", indexed: true },
            { name: "account", type: "address", indexed: true },
            { name: "sender", type: "address", indexed: true },
        ],
    },
] as const satisfies Abi;

export const RH_FEE_SHARE_ABI = [
    {
        type: "function",
        name: "claimable",
        stateMutability: "view",
        inputs: [{ name: "user", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const satisfies Abi;

export const RH_STATE_VIEW_ABI = [
    {
        type: "function",
        name: "getSlot0",
        stateMutability: "view",
        inputs: [{ name: "poolId", type: "bytes32" }],
        outputs: [
            { name: "sqrtPriceX96", type: "uint160" },
            { name: "tick", type: "int24" },
            { name: "protocolFee", type: "uint24" },
            { name: "lpFee", type: "uint24" },
        ],
    },
] as const satisfies Abi;

export const RH_V4_QUOTER_ABI = [
    {
        type: "function",
        name: "quoteExactInputSingle",
        stateMutability: "nonpayable",
        inputs: [
            {
                name: "params",
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
                    { name: "exactAmount", type: "uint128" },
                    { name: "hookData", type: "bytes" },
                ],
            },
        ],
        outputs: [
            { name: "amountOut", type: "uint256" },
            { name: "gasEstimate", type: "uint256" },
        ],
    },
] as const satisfies Abi;

export type RhLensState = {
    exists: boolean;
    migrated: boolean;
    curve: `0x${string}`;
    feeShare: `0x${string}`;
    poolId: `0x${string}`;
    thresholdQuote: bigint;
    realQuoteReserves: bigint;
    realTokenReserves: bigint;
    virtualTokenReserves: bigint;
    virtualQuoteReserves: bigint;
    priceQuotePerToken: bigint;
    bondingProgressPct: bigint;
    totalRaised: bigint;
};
