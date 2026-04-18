/**
 * Retries HTTP requests when the upstream signals backoff (429 / 503).
 * Uses Retry-After when present, otherwise exponential delay with a cap.
 */

function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(headerValue: string | null): number | undefined {
    if (!headerValue?.trim()) return undefined;
    const asSeconds = Number(headerValue);
    if (Number.isFinite(asSeconds) && asSeconds >= 0) {
        return Math.min(Math.round(asSeconds * 1000), 60_000);
    }
    const dateMs = Date.parse(headerValue);
    if (Number.isFinite(dateMs)) {
        const delta = dateMs - Date.now();
        return delta > 0 ? Math.min(delta, 60_000) : undefined;
    }
    return undefined;
}

export type FetchWithRateLimitRetryOptions = {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
};

/**
 * @param url Request URL
 * @param initFactory Fresh RequestInit per attempt (required for POST bodies)
 */
export async function fetchWithRateLimitRetry(
    url: string,
    initFactory: () => RequestInit,
    options?: FetchWithRateLimitRetryOptions
): Promise<Response> {
    const maxAttempts = Math.max(1, options?.maxAttempts ?? 5);
    const baseDelayMs = options?.baseDelayMs ?? 400;
    const maxDelayMs = options?.maxDelayMs ?? 10_000;

    let lastResponse: Response | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const response = await fetch(url, initFactory());
        lastResponse = response;

        if (response.ok || (response.status !== 429 && response.status !== 503)) {
            return response;
        }

        if (attempt < maxAttempts - 1) {
            const fromHeader =
                parseRetryAfterMs(response.headers.get("retry-after")) ??
                parseRetryAfterMs(response.headers.get("Retry-After"));
            const backoff = Math.min(
                maxDelayMs,
                fromHeader ?? Math.round(baseDelayMs * 2 ** attempt)
            );
            await sleep(backoff);
        }
    }

    return lastResponse as Response;
}
