import { z } from "zod";

// ── API query params ─────────────────────────
export const tokensQuerySchema = z.object({
    search: z.string().optional().default(""),
    tab: z
        .enum(["trending", "new", "hackathon", "leaderboard"])
        .optional()
        .default("trending"),
    sort: z
        .enum(["newest", "fdv-desc", "volume-desc", "liquidity-desc", "gainers", "losers", "fees-desc", "claims-desc", "name-asc"])
        .optional()
        .default("newest"),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(24),
});

export type TokensQuery = z.infer<typeof tokensQuerySchema>;

// ── Quote ────────────────────────────────────
export const quoteBodySchema = z.object({
    tokenMint: z.string().min(1),
    inputMint: z.string().optional(),
    amount: z.number().positive(),
    slippageBps: z.number().int().min(0).max(10000).optional(),
});

// ── Swap ─────────────────────────────────────
export const swapBodySchema = z.object({
    tokenMint: z.string().min(1),
    userPublicKey: z.string().min(1),
    amount: z.number().positive(),
    slippageBps: z.number().int().min(0).max(10000).optional(),
    inputMint: z.string().optional(),
});

// ── Launch: create token info ────────────────
export const createTokenInfoSchema = z.object({
    name: z.string().min(1).max(32),
    symbol: z.string().min(1).max(10),
    description: z.string().min(1).max(1000),
    imageUrl: z.string().url().optional().or(z.literal("")),
    website: z.string().url().optional().or(z.literal("")),
    twitter: z.string().optional(),
    telegram: z.string().optional(),
});

// ── Launch: fee share config (v2: /fee-share/config) ─
export const feeShareConfigSchema = z.object({
    payer: z.string().min(1),
    baseMint: z.string().min(1),
    claimersArray: z.array(z.string().min(1)).min(1).max(100),
    basisPointsArray: z.array(z.number().int().min(0).max(10000)).min(1).max(100),
    partner: z.string().optional(),
    partnerConfig: z.string().optional(),
});

// ── Launch: create launch transaction ────────
export const createLaunchSchema = z.object({
    ipfs: z.string().min(1),
    tokenMint: z.string().min(1),
    wallet: z.string().min(1),
    initialBuyLamports: z.number().int().min(0),
    configKey: z.string().min(1),
});

// ── Admin ────────────────────────────────────
export const adminSecretSchema = z.object({
    secret: z.string().min(1),
});

export const partnerClaimSchema = z.object({
    secret: z.string().min(1),
});
