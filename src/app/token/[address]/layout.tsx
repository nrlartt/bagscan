import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The detail view is a client component (live market data + wallet), so titles
 * and canonicals live here. Derived from the address alone — no upstream fetch —
 * to keep shared token links fast to open.
 */
export async function generateMetadata({
    params,
}: {
    params: Promise<{ address: string }>;
}): Promise<Metadata> {
    const { address } = await params;
    const value = (address ?? "").trim();
    const short = value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;

    return {
        title: `${short} · Robinhood Chain token`,
        description: `Live Robinhood Chain market data for ${short} on BagScan: price, curve progress, creator fees, trade flow and in-app trading.`,
        alternates: { canonical: `/token/${value}` },
        openGraph: {
            type: "website",
            title: `${short} · Robinhood Chain token — BagScan`,
            description: `Live Robinhood Chain market data for ${short} on BagScan.`,
            url: `/token/${value}`,
        },
    };
}

export default function TokenLayout({ children }: { children: ReactNode }) {
    return children;
}
