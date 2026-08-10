import Link from "next/link";
import { RhLogo } from "./RhLogo";
import { RH_CHAIN_ID, RH_EXPLORER_URL } from "@/lib/rh/chain";

export function Footer() {
    return (
        <footer className="relative z-10 mt-auto border-t border-[#00C805]/15 bg-black/80 pb-[env(safe-area-inset-bottom)]">
            <div className="w-full px-4 py-5 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
                {/* Chain banner */}
                <div className="mb-4 flex flex-col items-center justify-center gap-2 border-b border-[#00C805]/10 pb-4 sm:flex-row sm:gap-3">
                    <a
                        href={RH_EXPLORER_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex max-w-full flex-col items-center gap-2 rounded-lg border border-[#00C805]/15 bg-[#00C805]/[0.02] px-3 py-2.5 text-center transition-all hover:border-[#00C805]/40 hover:bg-[#00C805]/[0.05] sm:flex-row sm:gap-2.5 sm:px-4 sm:py-2 sm:text-left"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00C805] opacity-30" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00C805]/60" />
                        </span>
                        <span className="text-[10px] tracking-[0.15em] text-[#00C805]/60 transition-colors group-hover:text-[#00C805]">
                            ROBINHOOD CHAIN
                        </span>
                        <span className="hidden text-[8px] tracking-wider text-[#00C805]/25 sm:inline">
                            ID {RH_CHAIN_ID}
                        </span>
                        <span className="rounded border border-[#00C805]/15 px-1.5 py-px text-[8px] tracking-wider text-[#00C805]/25 transition-colors group-hover:text-[#00C805]/50">
                            EXPLORER
                        </span>
                    </a>
                </div>

                <div className="flex w-full flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-2.5 text-[10px] tracking-[0.12em] text-[#00C805]/50 sm:items-center">
                        <RhLogo size={14} className="shrink-0 opacity-60" />
                        <span className="min-w-0 break-words text-left leading-snug">
                            BAGSCAN — ROBINHOOD CHAIN TERMINAL
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] tracking-wider text-white/30 sm:justify-end">
                        <Link href="/about" className="transition-colors hover:text-[#00C805]/70">
                            ABOUT
                        </Link>
                        <span className="text-white/10">│</span>
                        <Link href="/alerts" className="transition-colors hover:text-[#00C805]/70">
                            ALERTS
                        </Link>
                        <span className="text-white/10">│</span>
                        <a
                            href="https://x.com/nrlartt"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition-colors hover:text-[#00C805]/70"
                        >
                            X / TWITTER
                        </a>
                        <span className="text-white/10">│</span>
                        <span className="text-white/20">NOT FINANCIAL ADVICE</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
