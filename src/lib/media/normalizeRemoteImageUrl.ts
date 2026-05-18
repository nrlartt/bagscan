/**
 * Prepare token/metadata image URLs for next/image or plain &lt;img&gt; (https, blob, IPFS, Arweave).
 */
export function normalizeRemoteImageUrl(url: string | null | undefined): string | undefined {
    if (url == null || typeof url !== "string") return undefined;
    const t = url.trim();
    if (!t) return undefined;
    /** Object URLs from file inputs — pass through for client-only &lt;img&gt; previews. */
    if (t.startsWith("blob:") || t.startsWith("data:")) return t;
    if (t.startsWith("//")) return `https:${t}`;
    if (/^ipfs:\/\//i.test(t)) {
        const path = t.replace(/^ipfs:\/\/(?:ipfs\/)?/i, "").replace(/^\/+/, "");
        return path ? `https://ipfs.io/ipfs/${path}` : undefined;
    }
    if (/^ar:\/\//i.test(t)) {
        const tx = t.replace(/^ar:\/\//i, "").replace(/^\/+/, "");
        return tx ? `https://arweave.net/${tx}` : undefined;
    }
    return t;
}
