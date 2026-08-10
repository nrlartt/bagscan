import "server-only";
import { createPublicClient, fallback, http } from "viem";
import { defineChain } from "viem";
import {
    RH_CHAIN_ID,
    RH_CHAIN_NAME,
    RH_EXPLORER_URL,
    RH_NATIVE_CURRENCY,
    RH_RPC_URLS,
    rhRpcUrl,
} from "./chain";

const robinhoodChain = defineChain({
    id: RH_CHAIN_ID,
    name: RH_CHAIN_NAME,
    nativeCurrency: RH_NATIVE_CURRENCY,
    rpcUrls: { default: { http: [...RH_RPC_URLS] } },
    blockExplorers: { default: { name: "Blockscout", url: RH_EXPLORER_URL } },
});

const configured = rhRpcUrl();
const transports = [
    configured,
    ...RH_RPC_URLS.filter((url) => url !== configured),
].map((url) => http(url, { batch: true, timeout: 20_000 }));

/** Server-side Robinhood Chain read client with RPC failover + multicall batching. */
export const rhPublicClient = createPublicClient({
    chain: robinhoodChain,
    transport: fallback(transports, { rank: false, retryCount: 1 }),
    batch: { multicall: true },
});
