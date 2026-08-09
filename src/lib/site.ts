/** Canonical public origin, used for metadata, robots and the sitemap. */
export const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || "https://bagscan.app";

export const SITE_NAME = "BagScan";

export const SITE_TITLE = "BagScan — Bags-Native Token Discovery Terminal";

export const SITE_DESCRIPTION =
    "Discover Bags launches across Solana and Robinhood Chain: live boards, bonding-curve progress, creator details, market cap or clearly labeled FDV, portfolio tracking, alerts, and Bags-native launching.";

/** Static, crawlable surfaces. Token pages are excluded — they are wallet/market driven. */
export const PUBLIC_ROUTES = [
    { path: "/", changeFrequency: "hourly" as const, priority: 1 },
    { path: "/alpha", changeFrequency: "hourly" as const, priority: 0.8 },
    { path: "/agents", changeFrequency: "daily" as const, priority: 0.7 },
    { path: "/launch", changeFrequency: "weekly" as const, priority: 0.7 },
    { path: "/portfolio", changeFrequency: "weekly" as const, priority: 0.5 },
    { path: "/prediction", changeFrequency: "daily" as const, priority: 0.6 },
    { path: "/about", changeFrequency: "monthly" as const, priority: 0.4 },
];
