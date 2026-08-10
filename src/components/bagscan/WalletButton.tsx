"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { ChevronDown, LogOut, Wallet, Wallet2, AlertTriangle } from "lucide-react";
import { cn, formatCompactDecimal, shortenAddress } from "@/lib/utils";
import { RH_CHAIN_ID, RH_CHAIN_NAME, RH_THEME, rhExplorerAddressUrl } from "@/lib/rh/chain";

export function WalletButton() {
    const { address, isConnected, chainId } = useAccount();
    const { connectors, connect, isPending } = useConnect();
    const { disconnect } = useDisconnect();
    const { switchChain, isPending: isSwitching } = useSwitchChain();
    const { data: balance } = useBalance({
        address,
        chainId: RH_CHAIN_ID,
        query: { enabled: Boolean(address), refetchInterval: 30_000 },
    });

    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const injectedConnector = connectors.find((c) => c.type === "injected") ?? connectors[0];
    const wrongChain = isConnected && chainId !== RH_CHAIN_ID;

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    if (!isConnected) {
        return (
            <button
                type="button"
                onClick={() => injectedConnector && connect({ connector: injectedConnector })}
                disabled={isPending || !injectedConnector}
                className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-[11px] font-semibold tracking-[0.1em] text-black transition-opacity hover:opacity-90 disabled:opacity-50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C805]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070907]"
                )}
                style={{ backgroundColor: RH_THEME.green }}
            >
                <Wallet className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isPending ? "CONNECTING…" : "CONNECT"}</span>
            </button>
        );
    }

    if (wrongChain) {
        return (
            <button
                type="button"
                onClick={() => switchChain({ chainId: RH_CHAIN_ID })}
                disabled={isSwitching}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#ffb800]/40 bg-[#ffb800]/10 px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-[#ffb800] transition-colors hover:bg-[#ffb800]/15 disabled:opacity-50"
            >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isSwitching ? "SWITCHING…" : "WRONG NETWORK"}</span>
            </button>
        );
    }

    return (
        <div ref={rootRef} className="relative shrink-0">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-haspopup="menu"
                className="inline-flex items-center gap-2 rounded-full border border-[#00C805]/25 bg-[#00C805]/[0.06] px-3 py-2 text-[11px] font-medium text-white/85 transition-colors hover:bg-[#00C805]/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C805]/50"
            >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: RH_THEME.green }} />
                <span className="tabular-nums">{shortenAddress(address ?? "", 4)}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-white/40 transition-transform", open && "rotate-180")} />
            </button>

            {open ? (
                <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[230px] overflow-hidden rounded-2xl border border-white/10 bg-[#0d110d] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
                >
                    <div className="px-3 py-2.5">
                        <p className="text-[9px] tracking-[0.14em] text-white/35">{RH_CHAIN_NAME}</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-white/90">
                            {balance
                                ? `${formatCompactDecimal(Number(balance.value) / 10 ** balance.decimals, {
                                      significant: 4,
                                  })} ${balance.symbol}`
                                : "—"}
                        </p>
                    </div>
                    <Link
                        href={`/portfolio?wallet=${address}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11px] text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white"
                        role="menuitem"
                    >
                        <Wallet2 className="h-3.5 w-3.5" />
                        My portfolio
                    </Link>
                    <a
                        href={rhExplorerAddressUrl(address ?? "")}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11px] text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white"
                        role="menuitem"
                    >
                        <Wallet className="h-3.5 w-3.5" />
                        View on explorer
                    </a>
                    <button
                        type="button"
                        onClick={() => {
                            disconnect();
                            setOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[11px] text-white/55 transition-colors hover:bg-[#ff5f5f]/10 hover:text-[#ff8a8a]"
                        role="menuitem"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        Disconnect
                    </button>
                </div>
            ) : null}
        </div>
    );
}
