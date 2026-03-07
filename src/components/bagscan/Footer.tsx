import Link from "next/link";
import { BagLogo } from "./BagLogo";

export function Footer() {
    return (
        <footer className="border-t-2 border-[#00ff41]/20 mt-auto bg-black/80 relative z-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
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
