/**
 * Explore grid filters (MCAP / 24h volume) — passed as API query params.
 */

export type ExploreMarketFilters = {
    mcapMin?: number;
    mcapMax?: number;
    volMin?: number;
    volMax?: number;
};

/** Slider / UI caps (USD). */
export const EXPLORE_MCAP_SLIDER_MAX = 50_000_000;
export const EXPLORE_VOL_SLIDER_MAX = 10_000_000;
export const EXPLORE_MCAP_SLIDER_MIN = 0;
export const EXPLORE_VOL_SLIDER_MIN = 0;

/** Defaults: no server filter (full range). */
export const EXPLORE_FILTER_DEFAULTS = {
    mcapLo: 0,
    mcapHi: EXPLORE_MCAP_SLIDER_MAX,
    volLo: 0,
    volHi: EXPLORE_VOL_SLIDER_MAX,
} as const;

/** Parse "10k", "1.5m", "$50000" → USD number. */
export function parseMoneyInput(raw: string): number | undefined {
    const s = raw.trim().toLowerCase().replace(/[$,\s]/g, "");
    if (!s) return undefined;
    const m = s.match(/^([\d.]+)\s*([kmb])?$/);
    if (!m) {
        const n = Number(s);
        return Number.isFinite(n) && n >= 0 ? n : undefined;
    }
    let n = parseFloat(m[1]);
    if (!Number.isFinite(n) || n < 0) return undefined;
    const suf = m[2];
    if (suf === "k") n *= 1e3;
    if (suf === "m") n *= 1e6;
    if (suf === "b") n *= 1e9;
    return n;
}

export function draftToAppliedFilters(
    mcapLo: number,
    mcapHi: number,
    volLo: number,
    volHi: number
): ExploreMarketFilters {
    const MC_EPS = 50_000;
    const VOL_EPS = 5_000;
    return {
        mcapMin: mcapLo <= 0 ? undefined : Math.round(mcapLo),
        mcapMax:
            mcapHi >= EXPLORE_MCAP_SLIDER_MAX - MC_EPS
                ? undefined
                : Math.round(mcapHi),
        volMin: volLo <= 0 ? undefined : Math.round(volLo),
        volMax:
            volHi >= EXPLORE_VOL_SLIDER_MAX - VOL_EPS
                ? undefined
                : Math.round(volHi),
    };
}

export function appliedFiltersToDraft(
    applied: ExploreMarketFilters
): { mcapLo: number; mcapHi: number; volLo: number; volHi: number } {
    return {
        mcapLo: applied.mcapMin ?? EXPLORE_FILTER_DEFAULTS.mcapLo,
        mcapHi: applied.mcapMax ?? EXPLORE_FILTER_DEFAULTS.mcapHi,
        volLo: applied.volMin ?? EXPLORE_FILTER_DEFAULTS.volLo,
        volHi: applied.volMax ?? EXPLORE_FILTER_DEFAULTS.volHi,
    };
}

export function hasActiveMarketFilters(f: ExploreMarketFilters): boolean {
    return (
        f.mcapMin !== undefined ||
        f.mcapMax !== undefined ||
        f.volMin !== undefined ||
        f.volMax !== undefined
    );
}
