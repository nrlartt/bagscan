import Link from "next/link";
import { BagLogo } from "./BagLogo";

const SCAN_CA = "BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS";

export function Footer() {
    return (
        <footer className="border-t-2 border-[#00ff41]/20 mt-auto bg-black/80 relative z-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
                {/* Token banner */}
                <div className="flex items-center justify-center gap-3 mb-4 pb-4 border-b border-[#00ff41]/10">
                    <a
                        href={`https://bags.fm/${SCAN_CA}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-2.5 px-4 py-2 border border-[#00ff41]/15 hover:border-[#00ff41]/40 bg-[#00ff41]/[0.02] hover:bg-[#00ff41]/[0.05] transition-all"
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

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 text-[10px] text-[#00ff41]/50 tracking-[0.15em]">
                        <BagLogo size={16} className="opacity-40" />
                        <span>BAGSCAN BETA — TOKEN DISCOVERY SYSTEM</span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-[#00ff41]/30 tracking-wider">
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
