-- CreateTable
CREATE TABLE "TokenSnapshot" (
    "id" TEXT NOT NULL,
    "tokenMint" TEXT NOT NULL,
    "poolAddress" TEXT,
    "name" TEXT,
    "symbol" TEXT,
    "image" TEXT,
    "creatorWallet" TEXT,
    "creatorDisplay" TEXT,
    "provider" TEXT,
    "providerUser" TEXT,
    "fdvUsd" DOUBLE PRECISION,
    "priceUsd" DOUBLE PRECISION,
    "liquidityUsd" DOUBLE PRECISION,
    "volume24hUsd" DOUBLE PRECISION,
    "lifetimeFees" DOUBLE PRECISION,
    "claimCount" INTEGER,
    "claimVolume" DOUBLE PRECISION,
    "rawJson" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenRegistry" (
    "tokenMint" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "poolAddress" TEXT,
    "name" TEXT,
    "symbol" TEXT,
    "image" TEXT,
    "description" TEXT,
    "website" TEXT,
    "twitter" TEXT,
    "telegram" TEXT,
    "creatorWallet" TEXT,
    "creatorDisplay" TEXT,
    "provider" TEXT,
    "providerUser" TEXT,
    "launchSource" TEXT,
    "latestPriceUsd" DOUBLE PRECISION,
    "latestFdvUsd" DOUBLE PRECISION,
    "latestLiquidityUsd" DOUBLE PRECISION,
    "latestLifetimeFees" DOUBLE PRECISION,
    "latestClaimCount" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rawJson" TEXT,

    CONSTRAINT "TokenRegistry_pkey" PRIMARY KEY ("tokenMint")
);

-- CreateTable
CREATE TABLE "LaunchDraft" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "website" TEXT,
    "twitter" TEXT,
    "telegram" TEXT,
    "tokenMint" TEXT,
    "tokenMetadata" TEXT,
    "feeShareConfig" TEXT,
    "partnerIncluded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaunchDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerSnapshot" (
    "id" TEXT NOT NULL,
    "partnerWallet" TEXT NOT NULL,
    "claimedFees" DOUBLE PRECISION,
    "unclaimedFees" DOUBLE PRECISION,
    "rawJson" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TokenSnapshot_tokenMint_idx" ON "TokenSnapshot"("tokenMint");

-- CreateIndex
CREATE INDEX "TokenSnapshot_capturedAt_idx" ON "TokenSnapshot"("capturedAt");
