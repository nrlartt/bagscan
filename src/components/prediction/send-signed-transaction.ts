import { parseFetchResponseAsJson } from "@/lib/utils";

function uint8ArrayToBase64(bytes: Uint8Array) {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return btoa(binary);
}

/**
 * Posts to BagScan /api/rpc/send-transaction with backoff when RPCs return rate limits.
 */
export async function sendSignedTransactionWithRetry(serialized: Uint8Array) {
    const maxAttempts = 4;
    let lastErr = "Transaction could not be sent.";

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const sendRes = await fetch("/api/rpc/send-transaction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ signedTransaction: uint8ArrayToBase64(serialized) }),
        });
        const sendJson = await parseFetchResponseAsJson(sendRes);

        if (sendJson.success) return sendJson;

        lastErr = sendJson.error || lastErr;
        const retryable = /429|rate limit|too many requests|all rpc endpoints failed|502|503/i.test(
            String(lastErr)
        );
        if (!retryable || attempt === maxAttempts - 1) break;
        await new Promise((r) => setTimeout(r, Math.min(8000, 700 * 2 ** attempt)));
    }

    throw new Error(lastErr);
}
