"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Zap, HelpCircle, Wallet, Menu, X, Search, ExternalLink, Bell } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { RhLogo } from "./RhLogo";
import { WalletButton } from "./WalletButton";
import { Footer } from "./Footer";
import { useDiscoverySearch } from "./DiscoverySearchContext";
import { RH_CHAIN_ID, RH_EXPLORER_URL, RH_THEME } from "@/lib/rh/chain";

const SIDEBAR_LINKS = [
    { href: "/", label: "DISCOVER", icon: Home },
    { href: "/alpha", label: "ALPHA", icon: Zap },
    { href: "/portfolio", label: "PORTFOLIO", icon: Wallet },
    { href: "/alerts", label: "ALERTS", icon: Bell },
    { href: "/about", label: "ABOUT", icon: HelpCircle },
] as const;

function HeaderSearch() {
    const pathname = usePathname();
    const { search, setSearch } = useDiscoverySearch();
    const onHome = pathname === "/";
    const placeholder = "Search Robinhood tokens or paste a 0x address…";

    if (!onHome) {
        return (
            <div className="mx-0 flex min-w-0 max-w-xl flex-1 items-center justify-center sm:mx-4 lg:mx-8">
                <Link
                    href="/"
                    className="w-full rounded-lg border border-[#00C805]/15 bg-[#0e130e]/90 py-2.5 text-center text-[10px] tracking-[0.12em] text-[#00C805]/35 transition-colors hover:border-[#00C805]/25 hover:text-[#00C805]/60"
                >
                    SEARCH ON DISCOVER →
                </Link>
            </div>
        );
    }

    return (
        <div className="relative mx-0 w-full min-w-0 max-w-none sm:mx-4 sm:max-w-xl lg:mx-8">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00C805]/25" />
            <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                autoComplete="off"
                className="w-full rounded-lg border border-white/[0.08] bg-[#0e130e] py-2 pl-10 pr-10 text-[11px] text-white/90 placeholder:text-white/25 focus:border-[#00C805]/50 focus:outline-none focus:ring-1 focus:ring-[#00C805]/30 sm:py-2.5 sm:text-[12px]"
            />
            {search ? (
                <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    aria-label="Clear search"
                >
                    <X className="h-4 w-4" />
                </button>
            ) : null}
        </div>
    );
}

function SidebarNavBody({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname();

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <Link href="/" onClick={onNavigate} className="mb-6 flex items-center gap-2.5 px-1">
                <span
                    className="flex h-9 w-9 items-center justify-center rounded-full"
                    style={{ backgroundColor: RH_THEME.greenDim, boxShadow: `0 0 16px ${RH_THEME.greenGlow}` }}
                >
                    <RhLogo size={20} />
                </span>
                <span className="flex flex-col leading-none">
                    <span className="text-[15px] font-medium tracking-tight" style={{ color: RH_THEME.green }}>
                        BagScan
                    </span>
                    <span className="mt-0.5 text-[8px] tracking-[0.16em] text-white/30">
                        ROBINHOOD CHAIN · {RH_CHAIN_ID}
                    </span>
                </span>
            </Link>

            <nav className="flex flex-col gap-0.5">
                {SIDEBAR_LINKS.map((item) => {
                    const active =
                        item.href === "/"
                            ? pathname === "/"
                            : pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onNavigate}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[11px] tracking-[0.14em] transition-all duration-200 motion-safe:hover:translate-x-0.5",
                                active
                                    ? "bg-white/[0.06] text-[#00C805]"
                                    : "text-white/45 hover:bg-white/[0.04] hover:text-white/75"
                            )}
                            style={active ? { textShadow: `0 0 12px ${RH_THEME.greenGlow}` } : undefined}
                        >
                            <item.icon className="h-4 w-4 shrink-0 opacity-80" />
                            <span className="flex-1">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-6 rounded-lg border border-white/10 bg-[#0e130e] p-3">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] tracking-[0.12em] text-white/40">CREATOR FEES</span>
                    <RhLogo size={13} />
                </div>
                <p className="mt-2 text-[10px] leading-snug text-white/35">
                    Every launch accrues fees to its creator fee-share contract. Track claimable and lifetime totals
                    from your portfolio.
                </p>
                <Link
                    href="/portfolio"
                    onClick={onNavigate}
                    className="mt-2 inline-flex text-[9px] tracking-[0.14em] hover:underline"
                    style={{ color: RH_THEME.green }}
                >
                    VIEW FEE POSITIONS
                </Link>
            </div>

            <a
                href={RH_EXPLORER_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onNavigate}
                className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-white/12 bg-[#0e130e] py-2.5 text-[10px] tracking-[0.16em] text-white/50 transition-colors hover:border-[#00C805]/35 hover:text-[#00C805] lg:mt-auto"
            >
                CHAIN EXPLORER
                <ExternalLink className="h-3 w-3" />
            </a>
        </div>
    );
}

export function BagScanShell({ children }: { children: ReactNode }) {
    const [mobileMenu, setMobileMenu] = useState(false);

    useEffect(() => {
        if (!mobileMenu) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [mobileMenu]);

    return (
        <div className="flex min-h-screen min-w-0 overflow-x-clip bg-[#070907] text-white/90">
            {/* Desktop sidebar */}
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-[240px] flex-col border-r border-white/[0.08] bg-[#070907] px-4 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))] lg:flex">
                <SidebarNavBody />
            </aside>

            {/* Mobile drawer */}
            <div
                className={cn(
                    "fixed inset-0 z-50 lg:hidden",
                    mobileMenu ? "pointer-events-auto" : "pointer-events-none"
                )}
                aria-hidden={!mobileMenu}
            >
                <button
                    type="button"
                    className={cn(
                        "absolute inset-0 bg-black/70 transition-opacity",
                        mobileMenu ? "opacity-100" : "opacity-0"
                    )}
                    onClick={() => setMobileMenu(false)}
                    aria-label="Close menu"
                />
                <aside
                    className={cn(
                        "absolute inset-y-0 left-0 flex w-[min(86vw,280px)] flex-col border-r border-white/10 bg-[#070907] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] transition-transform duration-200",
                        mobileMenu ? "translate-x-0" : "-translate-x-full"
                    )}
                >
                    <div className="mb-4 flex justify-end">
                        <button
                            type="button"
                            onClick={() => setMobileMenu(false)}
                            className="p-2 text-white/50 hover:text-white"
                            aria-label="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col pt-2">
                        <SidebarNavBody onNavigate={() => setMobileMenu(false)} />
                    </div>
                </aside>
            </div>

            <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-[240px]">
                <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#070907]/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
                    <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-2 px-2 py-2 sm:flex-nowrap sm:gap-2 sm:px-4">
                        <button
                            type="button"
                            className="order-1 shrink-0 rounded-lg p-2 text-white/60 hover:bg-white/5 lg:hidden"
                            onClick={() => setMobileMenu(true)}
                            aria-label="Open menu"
                        >
                            <Menu className="h-5 w-5" />
                        </button>

                        <div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-3 sm:ml-0">
                            <WalletButton />
                        </div>

                        <div className="order-3 w-full min-w-0 basis-full sm:order-2 sm:basis-auto sm:flex-1 sm:px-0">
                            <HeaderSearch />
                        </div>
                    </div>
                </header>

                <main className="relative z-10 min-w-0 flex-1 overflow-x-clip">{children}</main>
                <Footer />
            </div>
        </div>
    );
}
