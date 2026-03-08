"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { Rocket, Info, Menu, X, Zap, Scan } from "lucide-react";
import { useState, useEffect } from "react";
import { BagLogo } from "./BagLogo";

const WalletMultiButtonDynamic = dynamic(
    async () =>
        (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
    { ssr: false }
);

const NAV_ITEMS = [
    { href: "/", label: "DISCOVER", icon: Scan },
    { href: "/alpha", label: "ALPHA", icon: Zap, highlight: true },
    { href: "/launch", label: "LAUNCH", icon: Rocket },
    { href: "/about", label: "ABOUT", icon: Info },
];

export function TopNav() {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [time, setTime] = useState("");
    const [alertState, setAlertState] = useState(true);

    useEffect(() => {
        const tick = () => {
            const now = new Date();
            setTime(now.toLocaleTimeString("en-GB", { hour12: false }));
        };
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const blink = setInterval(() => setAlertState((s) => !s), 3000);
        return () => clearInterval(blink);
    }, []);

    return (
        <header className="sticky top-0 z-30 border-b-2 border-[#00ff41]/50 bg-black/90 backdrop-blur-sm">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-14 items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2.5 group">
                        <div className="relative flex items-center justify-center group-hover:scale-105 transition-transform duration-300" style={{ filter: 'drop-shadow(0 0 6px rgba(0,255,65,0.25))' }}>
                            <BagLogo size={30} />
                        </div>
                        <div className="hidden sm:flex flex-col">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[13px] text-[#00ff41] tracking-[0.18em]" style={{ textShadow: '0 0 8px rgba(0,255,65,0.35)' }}>
                                    BAGSCAN
                                </span>
                                <span className="text-[9px] text-[#ffaa00]/40 tracking-[0.1em] border border-[#ffaa00]/25 px-1.5 py-px leading-tight">
                                    BETA
                                </span>
                            </div>
                            <span className="text-[8px] text-[#00ff41]/35 tracking-[0.22em] mt-px">
                                TOKEN DISCOVERY SYSTEM
                            </span>
                        </div>
                    </Link>

                    {/* Desktop nav */}
                    <nav className="hidden md:flex items-center gap-0.5">
                        {NAV_ITEMS.map((item) => {
                            const active = pathname === item.href;
                            const isHighlight = "highlight" in item && item.highlight;
                            const color = isHighlight ? "#ffaa00" : "#00ff41";
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "relative px-3 py-1.5 text-xs tracking-[0.15em] transition-all duration-300 flex items-center gap-1.5 border",
                                        active
                                            ? isHighlight
                                                ? "border-[#ffaa00]/60 bg-[#ffaa00]/10 text-[#ffaa00]"
                                                : "border-[#00ff41]/60 bg-[#00ff41]/10 text-[#00ff41]"
                                            : "border-transparent text-[#00ff41]/50 hover:text-[#00ff41] hover:border-[#00ff41]/30 hover:bg-[#00ff41]/5"
                                    )}
                                    style={active ? { textShadow: `0 0 6px ${color}` } : undefined}
                                >
                                    <item.icon className={cn("w-3 h-3", isHighlight && !active && "animate-pulse")} />
                                    {item.label}
                                    {active && (
                                        <span className="absolute -bottom-[11px] left-1/2 -translate-x-1/2 w-full h-0.5" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Right section */}
                    <div className="flex items-center gap-3">
                        {/* $BGSCAN token link */}
                        <a
                            href="https://bags.fm/BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 border border-[#00ff41]/20 hover:border-[#00ff41]/50 bg-[#00ff41]/[0.03] hover:bg-[#00ff41]/[0.08] transition-all group"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41]/50 group-hover:bg-[#00ff41] transition-colors" style={{ boxShadow: '0 0 4px rgba(0,255,65,0.3)' }} />
                            <span className="text-[9px] text-[#00ff41]/50 group-hover:text-[#00ff41] tracking-[0.12em] transition-colors">$BGSCAN</span>
                        </a>
                        {/* Alert status — fixed width to prevent layout shift */}
                        <div className={cn(
                            "hidden lg:flex items-center gap-2 px-3 py-1 border text-[9px] tracking-[0.15em] transition-colors duration-500",
                            alertState
                                ? "border-[#00ff41]/40 text-[#00ff41]/70"
                                : "border-[#ffaa00]/40 text-[#ffaa00]/70"
                        )} style={{ minWidth: '160px' }}>
                            <span className={cn(
                                "w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse",
                                alertState ? "bg-[#00ff41]" : "bg-[#ffaa00]"
                            )} style={{ boxShadow: alertState ? '0 0 4px #00ff41' : '0 0 4px #ffaa00' }} />
                            <span className="whitespace-nowrap">
                                {alertState ? "SYSTEMS NOMINAL" : "SCANNING..."}
                            </span>
                        </div>

                        {/* Ship time */}
                        <div className="hidden sm:block text-right">
                            <div className="text-[10px] text-[#00ff41] tracking-[0.2em] font-medium" style={{ textShadow: '0 0 6px rgba(0,255,65,0.3)' }}>
                                {time}
                            </div>
                            <div className="text-[8px] text-[#00ff41]/40 tracking-[0.15em]">
                                SHIP TIME [GMT]
                            </div>
                        </div>

                        <WalletMultiButtonDynamic />
                        <button
                            className="md:hidden p-2 text-[#00ff41]/60 hover:text-[#00ff41] transition-colors border border-[#00ff41]/30"
                            onClick={() => setMobileOpen(!mobileOpen)}
                        >
                            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile nav */}
            {mobileOpen && (
                <div className="md:hidden border-t-2 border-[#00ff41]/30 bg-black/95 animate-slide-up">
                    <nav className="px-4 py-3 space-y-1">
                        {NAV_ITEMS.map((item) => {
                            const active = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setMobileOpen(false)}
                                    className={cn(
                                        "block px-3 py-2.5 text-xs tracking-[0.15em] transition-colors border",
                                        active
                                            ? "border-[#00ff41]/50 bg-[#00ff41]/10 text-[#00ff41]"
                                            : "border-transparent text-[#00ff41]/50 hover:text-[#00ff41] hover:bg-[#00ff41]/5"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <item.icon className="w-4 h-4" />
                                        {item.label}
                                    </div>
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            )}
        </header>
    );
}
