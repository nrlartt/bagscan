"use client";

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

export type DiscoverySearchContextValue = {
    search: string;
    setSearch: (value: string) => void;
    debouncedSearch: string;
};

const DiscoverySearchContext = createContext<DiscoverySearchContextValue | null>(null);

export function DiscoverySearchProvider({ children }: { children: ReactNode }) {
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(search), 350);
        return () => window.clearTimeout(t);
    }, [search]);

    const value = useMemo(
        () => ({ search, setSearch, debouncedSearch }),
        [search, debouncedSearch]
    );

    return (
        <DiscoverySearchContext.Provider value={value}>
            {children}
        </DiscoverySearchContext.Provider>
    );
}

export function useDiscoverySearch(): DiscoverySearchContextValue {
    const ctx = useContext(DiscoverySearchContext);
    if (!ctx) {
        throw new Error("useDiscoverySearch must be used within DiscoverySearchProvider");
    }
    return ctx;
}
