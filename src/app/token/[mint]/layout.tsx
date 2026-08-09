import type { Metadata } from "next";
import type { ReactNode } from "react";
import { isEvmAddress } from "@/lib/networks";

/**
 * The detail view itself is a client component (live wallet + market data), so
 * titles/canonicals are attached here. Deliberately derived from the address
 * only — no upstream fetch — to keep token links fast to open and share.
 */
export async function generateMetadata({
    params,
}: {
    params: Promise<{ mint: string }>;
}): Promise<Metadata> {
    const { mint } = await params;
    const address = (mint ?? "").trim();
    const short = address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
    const chain = isEvmAddress(address) ? "Robinhood Chain" : "Solana";

    return {
        title: `${short} · ${chain} token`,
        description: `Live ${chain} market data for ${short} on BagScan: valuation, price, curve progress, creator details and trading links.`,
        alternates: { canonical: `/token/${address}` },
        openGraph: {
            type: "website",
            title: `${short} · ${chain} token — BagScan`,
            description: `Live ${chain} market data for ${short} on BagScan.`,
            url: `/token/${address}`,
        },
    };
}

export default function TokenLayout({ children }: { children: ReactNode }) {
    return children;
}
