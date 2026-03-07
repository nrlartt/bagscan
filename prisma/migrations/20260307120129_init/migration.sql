-- CreateTable
CREATE TABLE "TokenSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenMint" TEXT NOT NULL,
    "poolAddress" TEXT,
    "name" TEXT,
    "symbol" TEXT,
    "image" TEXT,
    "creatorWallet" TEXT,
    "creatorDisplay" TEXT,
    "provider" TEXT,
    "providerUser" TEXT,
    "fdvUsd" REAL,
    "priceUsd" REAL,
    "liquidityUsd" REAL,
    "volume24hUsd" REAL,
    "lifetimeFees" REAL,
    "claimCount" INTEGER,
    "claimVolume" REAL,
    "rawJson" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TokenRegistry" (
    "tokenMint" TEXT NOT NULL PRIMARY KEY,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL,
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
    "latestPriceUsd" REAL,
    "latestFdvUsd" REAL,
    "latestLiquidityUsd" REAL,
    "latestLifetimeFees" REAL,
    "latestClaimCount" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rawJson" TEXT
);

-- CreateTable
CREATE TABLE "LaunchDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PartnerSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partnerWallet" TEXT NOT NULL,
    "claimedFees" REAL,
    "unclaimedFees" REAL,
    "rawJson" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "TokenSnapshot_tokenMint_idx" ON "TokenSnapshot"("tokenMint");

-- CreateIndex
CREATE INDEX "TokenSnapshot_capturedAt_idx" ON "TokenSnapshot"("capturedAt");
