"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/rh/wagmi";

export function Providers({ children }: { children: ReactNode }) {
    // One client per browser session; created in state so SSR and the client
    // never share a cache.
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: { staleTime: 30_000, retry: 2 },
                },
            })
    );

    return (
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </WagmiProvider>
    );
}
