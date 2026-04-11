import "server-only";

import bs58 from "bs58";
import { VersionedTransaction } from "@solana/web3.js";
import type { JupiterExecuteResponse, JupiterOrderResponse } from "./types";
import { SOL_MINT } from "@/lib/solana";
import { SCAN_MINT } from "@/lib/scan/constants";

const DEFAULT_JUP_SWAP_API_BASE_URL = "https://api.jup.ag/ultra/v1";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function getJupSwapApiBaseUrl() {
    return process.env.JUP_SWAP_API_BASE_URL?.trim() || DEFAULT_JUP_SWAP_API_BASE_URL;
}

function getJupHeaders() {
    const apiKey = process.env.JUP_API_KEY?.trim();
    return {
        Accept: "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
    };
}

function getJupJsonHeaders() {
    return {
        ...getJupHeaders(),
        "Content-Type": "application/json",
    };
}

function isAllowedBagsMint(mint: string) {
    return typeof mint === "string" && mint.endsWith("BAGS");
}

function assertAllowedBagsMint(mint: string) {
    if (!isAllowedBagsMint(mint)) {
        throw new Error("Quick Buy is limited to BAGS-minted tokens on BagScan.");
    }
}

function assertPredictionFundingPair(inputMint?: string, outputMint?: string) {
    if ((inputMint ?? SCAN_MINT) !== SCAN_MINT) {
        throw new Error("Prediction funding is limited to $SCAN.");
    }

    if ((outputMint ?? USDC_MINT) !== USDC_MINT) {
        throw new Error("Prediction funding currently routes only into USDC.");
    }
}

function assertPredictionSettlementPair(inputMint?: string, outputMint?: string) {
    if ((inputMint ?? USDC_MINT) !== USDC_MINT) {
        throw new Error("Prediction settlement currently exits from USDC only.");
    }

    if ((outputMint ?? SCAN_MINT) !== SCAN_MINT) {
        throw new Error("Prediction settlement currently returns into $SCAN only.");
    }
}

function normalizeJupiterOrderError(detail: string, inputMint?: string) {
    if (/insufficient funds/i.test(detail)) {
        if ((inputMint ?? SOL_MINT) === SCAN_MINT) {
            return "Not enough $SCAN in this wallet to fund this prediction.";
        }

        if ((inputMint ?? SOL_MINT) === SOL_MINT) {
            return "Not enough SOL in this wallet to build this Jupiter quote.";
        }
    }

    return detail;
}

function isAlreadyProcessedMessage(detail: string) {
    return /alreadyprocessed|already been processed/i.test(detail);
}

function deriveTransactionSignature(serializedTransaction: string) {
    try {
        const bytes = Buffer.from(serializedTransaction, "base64");
        const tx = VersionedTransaction.deserialize(bytes);
        const signature = tx.signatures[0];
        return signature ? bs58.encode(signature) : undefined;
    } catch {
        return undefined;
    }
}

function buildOrderUrl(params: {
    inputMint?: string;
    outputMint: string;
    amount: number;
    taker?: string;
    slippageBps?: number;
}) {
    const baseUrl = getJupSwapApiBaseUrl().replace(/\/+$/, "");
    const search = new URLSearchParams({
        inputMint: params.inputMint ?? SOL_MINT,
        outputMint: params.outputMint,
        amount: String(params.amount),
    });

    if (params.taker) search.set("taker", params.taker);
    if (typeof params.slippageBps === "number") {
        search.set("slippageBps", String(params.slippageBps));
    }

    return `${baseUrl}/order?${search.toString()}`;
}

async function fetchJupiterOrder(params: {
    outputMint: string;
    amount: number;
    taker?: string;
    inputMint?: string;
    slippageBps?: number;
}) {
    const response = await fetch(buildOrderUrl(params), {
        headers: getJupHeaders(),
        cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as JupiterOrderResponse | null;

    if (!response.ok) {
        const detail =
            (payload && (typeof payload.error === "string" ? payload.error : null)) ||
            (payload && (typeof payload.errorMessage === "string" ? payload.errorMessage : null)) ||
            `Jupiter order failed with status ${response.status}`;
        throw new Error(normalizeJupiterOrderError(detail, params.inputMint));
    }

    if (!payload?.transaction || !payload?.requestId) {
        const detail =
            (payload && (typeof payload.errorMessage === "string" ? payload.errorMessage : null)) ||
            "Jupiter did not return a signable order transaction.";
        throw new Error(normalizeJupiterOrderError(detail, params.inputMint));
    }

    return payload;
}

async function postJupiterExecute(params: {
    signedTransaction: string;
    requestId: string;
}) {
    const baseUrl = getJupSwapApiBaseUrl().replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/execute`, {
        method: "POST",
        headers: getJupJsonHeaders(),
        cache: "no-store",
        body: JSON.stringify({
            signedTransaction: params.signedTransaction,
            requestId: params.requestId,
        }),
    });

    const payload = (await response.json().catch(() => null)) as JupiterExecuteResponse | null;

    if (!response.ok) {
        const detail =
            (payload && (typeof payload.error === "string" ? payload.error : null)) ||
            `Jupiter execute failed with status ${response.status}`;
        if (isAlreadyProcessedMessage(detail)) {
            const signature = deriveTransactionSignature(params.signedTransaction);
            return {
                ...(payload ?? {}),
                status: payload?.status ?? "already_processed",
                signature: payload?.signature ?? payload?.txid ?? signature,
                txid: payload?.txid ?? payload?.signature ?? signature,
                alreadyProcessed: true,
            } satisfies JupiterExecuteResponse & { alreadyProcessed?: boolean };
        }
        throw new Error(detail);
    }

    return payload ?? {};
}

export async function getJupiterOrder(params: {
    outputMint: string;
    amount: number;
    taker?: string;
    inputMint?: string;
    slippageBps?: number;
}) {
    assertAllowedBagsMint(params.outputMint);
    return fetchJupiterOrder(params);
}

export async function executeJupiterOrder(params: {
    outputMint: string;
    signedTransaction: string;
    requestId: string;
}) {
    assertAllowedBagsMint(params.outputMint);
    return postJupiterExecute(params);
}

export async function getJupiterPredictionFundingOrder(params: {
    amount: number;
    taker?: string;
    inputMint?: string;
    outputMint?: string;
    slippageBps?: number;
}) {
    assertPredictionFundingPair(params.inputMint, params.outputMint);
    return fetchJupiterOrder({
        ...params,
        inputMint: params.inputMint ?? SCAN_MINT,
        outputMint: params.outputMint ?? USDC_MINT,
    });
}

export async function executeJupiterPredictionFundingOrder(params: {
    signedTransaction: string;
    requestId: string;
    inputMint?: string;
    outputMint?: string;
}) {
    assertPredictionFundingPair(params.inputMint, params.outputMint);
    return postJupiterExecute(params);
}

export async function getJupiterPredictionSettlementOrder(params: {
    amount: number;
    taker?: string;
    inputMint?: string;
    outputMint?: string;
    slippageBps?: number;
}) {
    assertPredictionSettlementPair(params.inputMint, params.outputMint);
    return fetchJupiterOrder({
        ...params,
        inputMint: params.inputMint ?? USDC_MINT,
        outputMint: params.outputMint ?? SCAN_MINT,
    });
}

export async function executeJupiterPredictionSettlementOrder(params: {
    signedTransaction: string;
    requestId: string;
    inputMint?: string;
    outputMint?: string;
}) {
    assertPredictionSettlementPair(params.inputMint, params.outputMint);
    return postJupiterExecute(params);
}
