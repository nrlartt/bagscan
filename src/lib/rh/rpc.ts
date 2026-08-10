import "server-only";
import { createPublicClient, http } from "viem";
import { defineChain } from "viem";
import { RH_CHAIN_ID, RH_CHAIN_NAME, RH_EXPLORER_URL, RH_NATIVE_CURRENCY, rhRpcUrl } from "./chain";

const robinhoodChain = defineChain({
    id: RH_CHAIN_ID,
    name: RH_CHAIN_NAME,
    nativeCurrency: RH_NATIVE_CURRENCY,
    rpcUrls: { default: { http: [rhRpcUrl()] } },
    blockExplorers: { default: { name: "Blockscout", url: RH_EXPLORER_URL } },
});

/** Server-side Robinhood Chain read client with multicall batching. */
export const rhPublicClient = createPublicClient({
    chain: robinhoodChain,
    transport: http(rhRpcUrl(), { batch: true, timeout: 25_000 }),
    batch: { multicall: true },
});
