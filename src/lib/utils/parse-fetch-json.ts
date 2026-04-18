/** Common shape for BagScan `/api/*` JSON responses. */
export type BagScanApiJson = {
    success?: boolean;
    error?: string;
    data?: unknown;
};

/**
 * Parse a fetch Response as JSON. Servers often return HTML error pages (502, edge, WAF),
 * which breaks `response.json()` with "Unexpected token '<'".
 */
export async function parseFetchResponseAsJson(response: Response): Promise<BagScanApiJson> {
    const text = await response.text();
    const trimmed = text.trimStart();

    if (!trimmed) {
        throw new Error(`Empty API response (${response.status} ${response.statusText}).`);
    }

    if (trimmed.startsWith("<")) {
        const status = response.status;
        let hint: string;
        if (status === 404) {
            hint = "API route not found.";
        } else if (status >= 500) {
            hint = "Server error — the app may be redeploying or overloaded.";
        } else if (status === 401 || status === 403) {
            hint = "Request was not authorized.";
        } else {
            hint = "Received HTML instead of JSON (proxy, CDN, or middleware).";
        }
        throw new Error(`${hint} (HTTP ${status})`);
    }

    try {
        return JSON.parse(text) as BagScanApiJson;
    } catch {
        const preview = trimmed.slice(0, 96);
        throw new Error(
            `Invalid JSON from API (HTTP ${response.status}): ${preview}${trimmed.length > 96 ? "…" : ""}`
        );
    }
}
