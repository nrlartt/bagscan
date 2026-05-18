"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "bagscan-watchlist-v1";

export function useWatchlist() {
    const [mints, setMints] = useState<string[]>([]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as unknown;
            if (!Array.isArray(parsed)) return;
            setMints(parsed.filter((x): x is string => typeof x === "string" && x.length > 0));
        } catch {
            /* ignore */
        }
    }, []);

    const toggle = useCallback((mint: string) => {
        setMints((prev) => {
            const next = prev.includes(mint) ? prev.filter((m) => m !== mint) : [...prev, mint];
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
                /* ignore */
            }
            return next;
        });
    }, []);

    const has = useCallback((mint: string) => mints.includes(mint), [mints]);

    return {
        mints,
        toggle,
        has,
        watchlistParam: mints.join(","),
    };
}
