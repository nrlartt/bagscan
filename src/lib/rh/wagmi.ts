"use client";

import { createConfig, http, injected } from "wagmi";
import { defineChain } from "viem";
import {
    RH_CHAIN_ID,
    RH_CHAIN_NAME,
    RH_EXPLORER_URL,
    RH_NATIVE_CURRENCY,
    RH_RPC_URLS,
} from "./chain";

/** Robinhood Chain as a viem chain, built from the verified public endpoints. */
export const robinhoodChain = defineChain({
    id: RH_CHAIN_ID,
    name: RH_CHAIN_NAME,
    nativeCurrency: RH_NATIVE_CURRENCY,
    rpcUrls: {
        default: { http: [...RH_RPC_URLS] },
    },
    blockExplorers: {
        default: { name: "Blockscout", url: RH_EXPLORER_URL },
    },
});

/**
 * Injected-only on purpose: WalletConnect would need a project id and an
 * external relay, and every wallet that can reach a custom EVM chain today
 * (MetaMask, Rabby, Coinbase Wallet extension) injects.
 */
export const wagmiConfig = createConfig({
    chains: [robinhoodChain],
    connectors: [injected()],
    transports: {
        [robinhoodChain.id]: http(RH_RPC_URLS[0]),
    },
    ssr: true,
});

declare module "wagmi" {
    interface Register {
        config: typeof wagmiConfig;
    }
}
