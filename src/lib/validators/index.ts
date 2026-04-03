import { z } from "zod";

export const feeShareWalletProviderSchema = z.enum([
    "twitter",
    "x",
    "github",
    "kick",
    "instagram",
    "tiktok",
    "onlyfans",
    "bags",
    "telegram",
    "tg",
    "youtube",
    "facebook",
    "apple",
    "google",
    "email",
    "solana",
]);

export const bagsConfigTypeSchema = z.enum([
    "fa29606e-5e48-4c37-827f-4b03d58ee23d",
    "d16d3585-6488-4a6c-9a6f-e6c39ca0fda3",
    "a7c8e1f2-3d4b-5a6c-9e0f-1b2c3d4e5f6a",
    "48e26d2f-0a9d-4625-a3cc-c3987d874b9e",
]);

export const tokensQuerySchema = z.object({
    search: z.string().optional().default(""),
    tab: z
        .enum(["trending", "spotlight", "new", "hackathon", "leaderboard"])
        .optional()
        .default("trending"),
    scope: z
        .enum(["platform", "hackathon"])
        .optional()
        .default("platform"),
    mode: z
        .enum(["votes", "market"])
        .optional()
        .default("votes"),
    sort: z
        .enum([
            "newest",
            "fdv-desc",
            "volume-desc",
            "liquidity-desc",
            "gainers",
            "losers",
            "fees-desc",
            "claims-desc",
            "name-asc",
        ])
        .optional()
        .default("newest"),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(24),
});

export type TokensQuery = z.infer<typeof tokensQuerySchema>;

export const quoteBodySchema = z
    .object({
        tokenMint: z.string().min(1).optional(),
        outputMint: z.string().min(1).optional(),
        inputMint: z.string().optional(),
        amount: z.number().positive(),
        slippageBps: z.number().int().min(0).max(10000).optional(),
    })
    .refine((data) => Boolean(data.outputMint || data.tokenMint), {
        message: "outputMint or tokenMint is required",
        path: ["outputMint"],
    });

export const swapBodySchema = z
    .object({
        tokenMint: z.string().min(1).optional(),
        outputMint: z.string().min(1).optional(),
        userPublicKey: z.string().min(1),
        quoteRequestId: z.string().min(1).optional(),
        quoteResponse: z.record(z.string(), z.unknown()).optional(),
        amount: z.number().positive().optional(),
        slippageBps: z.number().int().min(0).max(10000).optional(),
        inputMint: z.string().optional(),
    })
    .refine((data) => Boolean(data.quoteResponse || data.quoteRequestId || data.outputMint || data.tokenMint), {
        message: "quoteResponse, quoteRequestId, or outputMint/tokenMint is required",
        path: ["quoteResponse"],
    })
    .refine((data) => Boolean(data.quoteResponse || data.quoteRequestId || typeof data.amount === "number"), {
        message: "amount is required when quoteResponse and quoteRequestId are missing",
        path: ["amount"],
    });

export const createTokenInfoSchema = z.object({
    name: z.string().min(1).max(32),
    symbol: z.string().min(1).max(10),
    description: z.string().min(1).max(1000),
    imageUrl: z.string().url().optional().or(z.literal("")),
    metadataUrl: z.string().url().optional().or(z.literal("")),
    website: z.string().url().optional().or(z.literal("")),
    twitter: z.string().optional(),
    telegram: z.string().optional(),
});

export const agentCreateTokenInfoSchema = createTokenInfoSchema;

export const feeShareConfigSchema = z
    .object({
        payer: z.string().min(1),
        baseMint: z.string().min(1),
        claimersArray: z.array(z.string().min(1)).min(1).max(100),
        basisPointsArray: z.array(z.number().int().min(0).max(10000)).min(1).max(100),
        partner: z.string().optional(),
        partnerConfig: z.string().optional(),
        admin: z.string().optional(),
        bagsConfigType: bagsConfigTypeSchema.optional(),
        includePartner: z.boolean().optional(),
        tipWallet: z.string().optional(),
        tipLamports: z.number().int().min(0).optional(),
    })
    .refine((data) => data.claimersArray.length === data.basisPointsArray.length, {
        message: "claimersArray and basisPointsArray must be the same length",
        path: ["basisPointsArray"],
    })
    .refine((data) => data.basisPointsArray.reduce((sum, value) => sum + value, 0) === 10000, {
        message: "basisPointsArray must total exactly 10,000 BPS",
        path: ["basisPointsArray"],
    });

export const createLaunchSchema = z.object({
    ipfs: z.string().min(1),
    tokenMint: z.string().min(1),
    wallet: z.string().min(1),
    initialBuyLamports: z.number().int().min(0),
    configKey: z.string().min(1),
    tipWallet: z.string().optional(),
    tipLamports: z.number().int().min(0).optional(),
    partnerIncluded: z.boolean().optional(),
});

export const resolveFeeShareWalletsSchema = z.object({
    items: z
        .array(
            z.object({
                provider: feeShareWalletProviderSchema,
                username: z.string().trim().min(1).max(64),
            })
        )
        .min(1)
        .max(100),
});

export const adminSecretSchema = z.object({
    secret: z.string().min(1),
});

export const partnerClaimSchema = z.object({
    secret: z.string().min(1),
});

export const incorporationCategorySchema = z.enum([
    "RWA",
    "AI",
    "DEFI",
    "INFRA",
    "DEPIN",
    "LEGAL",
    "GAMING",
    "NFT",
    "MEME",
]);

export const incorporationFounderSchema = z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z.string().trim().email(),
    nationalityCountry: z.string().trim().length(3),
    taxResidencyCountry: z.string().trim().length(3),
    residentialAddress: z.string().trim().min(5),
    shareBasisPoint: z.number().int().min(1).max(10000),
});

export const startIncorporationPaymentSchema = z.object({
    payerWallet: z.string().trim().min(32),
    payWithSol: z.boolean().optional(),
});

export const startIncorporationSchema = z.object({
    tokenAddress: z.string().trim().min(32),
});

export const incorporateCompanySchema = z.object({
    orderUUID: z.string().trim().min(1),
    paymentSignature: z.string().trim().min(1),
    projectName: z.string().trim().min(1),
    tokenAddress: z.string().trim().min(32),
    founders: z.array(incorporationFounderSchema).min(1).max(10),
    category: incorporationCategorySchema.optional(),
    twitterHandle: z.string().trim().optional(),
    incorporationShareBasisPoint: z.number().int().min(2000).max(3000),
    preferredCompanyNames: z.array(z.string().trim().min(1)).length(3),
}).refine(
    (data) =>
        data.founders.reduce((sum, founder) => sum + founder.shareBasisPoint, 0) +
        data.incorporationShareBasisPoint === 10000,
    {
        message: "Founder shareBasisPoint values plus incorporation share must total exactly 10,000 BPS",
        path: ["founders"],
    }
);
