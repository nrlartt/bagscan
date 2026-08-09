"use client";

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useSyncExternalStore,
    type ReactNode,
} from "react";
import {
    BAGSCAN_NETWORKS,
    DEFAULT_NETWORK,
    NETWORK_STORAGE_KEY,
    parseStoredNetwork,
    type BagScanNetwork,
} from "@/lib/networks";

interface NetworkContextValue {
    network: BagScanNetwork;
    setNetwork: (network: BagScanNetwork) => void;
    networkConfig: (typeof BAGSCAN_NETWORKS)[BagScanNetwork];
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

/** Same-tab notification channel — `storage` only fires in *other* tabs. */
const LOCAL_CHANGE_EVENT = "bagscan:network-change";

function subscribe(onChange: () => void) {
    const onStorage = (e: StorageEvent) => {
        if (e.key === null || e.key === NETWORK_STORAGE_KEY) onChange();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(LOCAL_CHANGE_EVENT, onChange);
    return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(LOCAL_CHANGE_EVENT, onChange);
    };
}

/** Fallback when localStorage is unavailable (private mode, blocked cookies). */
let memoryNetwork: BagScanNetwork = DEFAULT_NETWORK;

function getSnapshot(): BagScanNetwork {
    try {
        const stored = localStorage.getItem(NETWORK_STORAGE_KEY);
        if (stored !== null) return parseStoredNetwork(stored);
    } catch {
        /* fall through to the in-memory value */
    }
    return memoryNetwork;
}

/** Server and first client render agree on the default, so hydration stays stable. */
function getServerSnapshot(): BagScanNetwork {
    return DEFAULT_NETWORK;
}

export function NetworkProvider({ children }: { children: ReactNode }) {
    const network = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const setNetwork = useCallback((next: BagScanNetwork) => {
        memoryNetwork = next;
        try {
            localStorage.setItem(NETWORK_STORAGE_KEY, next);
        } catch {
            /* ignore — the in-memory value keeps this session consistent */
        }
        window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
    }, []);

    const value = useMemo(
        () => ({
            network,
            setNetwork,
            networkConfig: BAGSCAN_NETWORKS[network],
        }),
        [network, setNetwork]
    );

    return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
    const ctx = useContext(NetworkContext);
    if (!ctx) {
        throw new Error("useNetwork must be used within NetworkProvider");
    }
    return ctx;
}
