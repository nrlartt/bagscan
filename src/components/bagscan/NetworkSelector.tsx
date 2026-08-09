"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BagScanNetwork } from "@/lib/networks";
import { useNetwork } from "./NetworkContext";
import { NetworkIcon } from "./NetworkIcons";

const NETWORK_OPTIONS: Array<{ id: BagScanNetwork; label: string }> = [
    { id: "solana", label: "Solana" },
    { id: "robinhood", label: "Robinhood" },
];

export function NetworkSelector() {
    const { network, setNetwork } = useNetwork();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const activeIndex = Math.max(
        0,
        NETWORK_OPTIONS.findIndex((o) => o.id === network)
    );
    const active = NETWORK_OPTIONS[activeIndex];

    const close = useCallback((refocus = true) => {
        setOpen(false);
        if (refocus) buttonRef.current?.focus();
    }, []);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: MouseEvent | TouchEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("touchstart", onPointerDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("touchstart", onPointerDown);
        };
    }, [open]);

    // Move focus into the list so arrow keys work as soon as it opens.
    useEffect(() => {
        if (!open) return;
        optionRefs.current[activeIndex]?.focus();
    }, [open, activeIndex]);

    const onListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const focused = optionRefs.current.findIndex((el) => el === document.activeElement);
        const current = focused >= 0 ? focused : activeIndex;

        if (e.key === "Escape") {
            e.preventDefault();
            close();
            return;
        }
        if (e.key === "Tab") {
            setOpen(false);
            return;
        }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const delta = e.key === "ArrowDown" ? 1 : -1;
            const next = (current + delta + NETWORK_OPTIONS.length) % NETWORK_OPTIONS.length;
            optionRefs.current[next]?.focus();
            return;
        }
        if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            optionRefs.current[e.key === "Home" ? 0 : NETWORK_OPTIONS.length - 1]?.focus();
        }
    };

    return (
        <div ref={rootRef} className="relative shrink-0">
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                onKeyDown={(e) => {
                    if (e.key === "ArrowDown" && !open) {
                        e.preventDefault();
                        setOpen(true);
                    }
                }}
                className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-2",
                    "bg-[#f3f3ee] text-[#2b2b2b] shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
                    "transition-colors hover:bg-[#ecece6]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20e3b2]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0e11]"
                )}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={`Network: ${active.label}`}
            >
                <NetworkIcon network={network} size={16} />
                {/* Narrow phones keep the icon only — the wallet button needs the room. */}
                <span className="hidden text-[13px] font-medium tracking-tight min-[400px]:inline">
                    {active.label}
                </span>
                <ChevronDown
                    className={cn("h-4 w-4 text-[#2b2b2b]/40 transition-transform", open && "rotate-180")}
                />
            </button>

            {open ? (
                <div
                    role="listbox"
                    aria-label="Network"
                    onKeyDown={onListKeyDown}
                    className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[200px] overflow-hidden rounded-2xl bg-[#f3f3ee] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
                >
                    {NETWORK_OPTIONS.map(({ id, label }, i) => {
                        const selected = id === network;
                        return (
                            <button
                                key={id}
                                ref={(el) => {
                                    optionRefs.current[i] = el;
                                }}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                onClick={() => {
                                    setNetwork(id);
                                    close();
                                }}
                                className={cn(
                                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                                    "text-[#2b2b2b] focus-visible:outline-none focus-visible:bg-[#e2e2dc]",
                                    selected ? "bg-[#e8e8e3]" : "hover:bg-[#ecece6]"
                                )}
                            >
                                <NetworkIcon network={id} size={18} />
                                <span className="flex-1 text-[13px] font-medium tracking-tight">{label}</span>
                                {selected ? <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} /> : null}
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}
