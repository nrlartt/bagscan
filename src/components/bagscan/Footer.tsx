import Link from "next/link";
import { BagLogo } from "./BagLogo";

const SCAN_CA = "BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS";

export function Footer() {
    return (
        <footer className="relative z-10 mt-auto border-t-2 border-[#00ff41]/20 bg-black/80 pb-[env(safe-area-inset-bottom)]">
            <div className="w-full px-4 py-5 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
                {/* Token banner */}
                <div className="mb-4 flex flex-col items-center justify-center gap-2 border-b border-[#00ff41]/10 pb-4 sm:flex-row sm:gap-3">
                    <a
                        href={`https://bags.fm/${SCAN_CA}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex max-w-full flex-col items-center gap-2 border border-[#00ff41]/15 bg-[#00ff41]/[0.02] px-3 py-2.5 text-center transition-all hover:border-[#00ff41]/40 hover:bg-[#00ff41]/[0.05] sm:flex-row sm:gap-2.5 sm:px-4 sm:py-2 sm:text-left"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff41] opacity-30" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ff41]/60" />
                        </span>
                        <span className="text-[10px] text-[#00ff41]/60 tracking-[0.15em] group-hover:text-[#00ff41] transition-colors">
                            $SCAN
                        </span>
                        <span className="text-[8px] text-[#00ff41]/20 tracking-wider hidden sm:inline">
                            {SCAN_CA.slice(0, 4)}...{SCAN_CA.slice(-4)}
                        </span>
                        <span className="text-[8px] text-[#00ff41]/25 tracking-wider border border-[#00ff41]/15 px-1.5 py-px group-hover:text-[#00ff41]/50 transition-colors">
                            TRADE ON BAGS
                        </span>
                    </a>
                </div>

                <div className="flex w-full flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex shrink-0 items-center gap-2.5 text-[10px] text-[#00ff41]/50 tracking-[0.15em]">
                        <BagLogo size={16} className="opacity-40 shrink-0" />
                        <span className="text-left">BAGSCAN BETA — TOKEN DISCOVERY SYSTEM</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-[#00ff41]/30 tracking-wider sm:justify-end">
                        <Link href="/about" className="hover:text-[#00ff41]/70 transition-colors">
                            ABOUT
                        </Link>
                        <span className="text-[#00ff41]/10">│</span>
                        <a href="https://bags.fm" target="_blank" rel="noopener noreferrer" className="hover:text-[#00ff41]/70 transition-colors">
                            BAGS.FM
                        </a>
                        <span className="text-[#00ff41]/10">│</span>
                        <a href="https://x.com/nrlartt" target="_blank" rel="noopener noreferrer" className="hover:text-[#00ff41]/70 transition-colors">
                            X / TWITTER
                        </a>
                        <span className="text-[#00ff41]/10">│</span>
                        <span className="text-[#00ff41]/20">
                            NOT FINANCIAL ADVICE
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
