"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "bagscan-watchlist-v1";
const LOCAL_CHANGE_EVENT = "bagscan:watchlist-change";

const EMPTY: string[] = [];

/** Cached parse so `getSnapshot` returns a stable reference between renders. */
let cachedRaw: string | null = null;
let cachedMints: string[] = EMPTY;

function readMints(): string[] {
    let raw: string | null = null;
    try {
        raw = localStorage.getItem(STORAGE_KEY);
    } catch {
        return cachedMints;
    }

    if (raw === cachedRaw) return cachedMints;
    cachedRaw = raw;

    if (!raw) {
        cachedMints = EMPTY;
        return cachedMints;
    }

    try {
        const parsed = JSON.parse(raw) as unknown;
        cachedMints = Array.isArray(parsed)
            ? parsed.filter((x): x is string => typeof x === "string" && x.length > 0)
            : EMPTY;
    } catch {
        cachedMints = EMPTY;
    }
    return cachedMints;
}

function subscribe(onChange: () => void) {
    const onStorage = (e: StorageEvent) => {
        if (e.key === null || e.key === STORAGE_KEY) onChange();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(LOCAL_CHANGE_EVENT, onChange);
    return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(LOCAL_CHANGE_EVENT, onChange);
    };
}

/** Server render has no localStorage: start empty, then sync on the client. */
function getServerSnapshot(): string[] {
    return EMPTY;
}

/**
 * Watchlist backed by localStorage and shared across every consumer and browser
 * tab, rather than copied into component state on mount.
 */
export function useWatchlist() {
    const mints = useSyncExternalStore(subscribe, readMints, getServerSnapshot);

    const toggle = useCallback((mint: string) => {
        const current = readMints();
        const next = current.includes(mint)
            ? current.filter((m) => m !== mint)
            : [...current, mint];
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
            /* ignore — watchlist just won't persist in this browser */
        }
        window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
    }, []);

    const has = useCallback((mint: string) => mints.includes(mint), [mints]);
    const watchlistParam = useMemo(() => mints.join(","), [mints]);

    return { mints, toggle, has, watchlistParam };
}
