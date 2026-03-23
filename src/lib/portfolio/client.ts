"use client";

import type { PortfolioResponse } from "@/lib/portfolio/types";

export interface PortfolioApiResponse {
    success: boolean;
    data?: PortfolioResponse;
    error?: string;
}

export async function fetchPortfolio(wallet: string): Promise<PortfolioResponse> {
    const response = await fetch(`/api/portfolio?wallet=${encodeURIComponent(wallet)}`, {
        cache: "no-store",
    });
    const payload = (await response.json()) as PortfolioApiResponse;

    if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Failed to load portfolio");
    }

    return payload.data;
}
