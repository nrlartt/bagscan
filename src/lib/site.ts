/** Canonical public origin, used for metadata, robots and the sitemap. */
export const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || "https://bagscan.app";

export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "BagScan";

export const SITE_TITLE = "BagScan — Robinhood Chain Token Terminal";

export const SITE_DESCRIPTION =
    "Discover, track and trade Robinhood Chain launches: live bonding-curve boards, flow intelligence, wallet portfolios with creator fees, curve trading and on-chain alerts.";

/** Static, crawlable surfaces. Token pages are excluded — they are market driven. */
export const PUBLIC_ROUTES = [
    { path: "/", changeFrequency: "hourly" as const, priority: 1 },
    { path: "/alpha", changeFrequency: "hourly" as const, priority: 0.8 },
    { path: "/portfolio", changeFrequency: "weekly" as const, priority: 0.6 },
    { path: "/alerts", changeFrequency: "weekly" as const, priority: 0.5 },
    { path: "/about", changeFrequency: "monthly" as const, priority: 0.4 },
];
