import type { Metadata } from "next";
import { Scan, TrendingUp, Users, Coins, Shield } from "lucide-react";

export const metadata: Metadata = {
    title: "About — BagScan",
    description: "Learn about BagScan, the Bags-native token discovery terminal.",
};

export default function AboutPage() {
    return (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
            {/* Hero */}
            <div className="text-center mb-12">
                <div className="mx-auto w-16 h-16 border-2 border-[#00ff41]/40 flex items-center justify-center mb-6" style={{ boxShadow: '0 0 20px rgba(0,255,65,0.1)' }}>
                    <Scan className="w-8 h-8 text-[#00ff41]" />
                </div>
                <h1 className="text-xl tracking-[0.2em] text-[#00ff41]" style={{ textShadow: '0 0 10px rgba(0,255,65,0.3)' }}>
                    ╔══ ABOUT BAGSCAN ══╗
                </h1>
                <p className="text-[11px] text-[#00ff41]/30 mt-4 leading-relaxed max-w-lg mx-auto tracking-wider">
                    BAGSCAN IS A BAGS-NATIVE TOKEN DISCOVERY AND LAUNCH TERMINAL. BROWSE,
                    ANALYZE, AND TRADE TOKENS LAUNCHED ON THE BAGS PLATFORM WITH CREATOR-FIRST
                    METRICS AND TRANSPARENT FEE ANALYTICS.
                </p>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
                <FeatureCard icon={<TrendingUp className="w-5 h-5" />} title="FDV, NOT MARKET CAP" description="BagScan shows Fully Diluted Valuation (FDV) rather than market cap when circulating supply cannot be verified. FDV = price × total supply." />
                <FeatureCard icon={<Users className="w-5 h-5" />} title="CREATOR-FIRST METRICS" description="See creator identity, royalty basis points, provider verification, and claim activity at a glance." />
                <FeatureCard icon={<Coins className="w-5 h-5" />} title="FEE & CLAIM ANALYTICS" description="Track lifetime fees, claim counts, claim events, and creator revenue directly from Bags APIs." />
                <FeatureCard icon={<Shield className="w-5 h-5" />} title="NATIVE MONETIZATION" description="BagScan earns revenue through the Bags partner configuration with transparent, on-chain fee sharing." />
            </div>

            {/* FDV note */}
            <div className="crt-panel p-6 mb-8">
                <div className="panel-header">╔══ FDV VS MARKET CAP ══╗</div>
                <p className="text-[10px] text-[#00ff41]/35 leading-relaxed tracking-wider">
                    MARKET CAP = PRICE × CIRCULATING SUPPLY. MANY BAGS TOKENS DO NOT HAVE VERIFIABLE
                    CIRCULATING SUPPLY DATA. BAGSCAN DISPLAYS <span className="text-[#00ff41]/60">FDV (FULLY DILUTED VALUATION)</span> =
                    PRICE × TOTAL SUPPLY. WHEN NEITHER PRICE NOR SUPPLY ARE AVAILABLE, THE METRIC IS
                    SHOWN AS &ldquo;UNAVAILABLE&rdquo;.
                </p>
            </div>

            {/* Monetization */}
            <div className="crt-panel p-6 mb-8">
                <div className="panel-header">╔══ MONETIZATION ══╗</div>
                <p className="text-[10px] text-[#00ff41]/35 leading-relaxed tracking-wider">
                    BAGSCAN USES BAGS&apos; NATIVE PARTNER CONFIGURATION SYSTEM. WHEN A CREATOR
                    LAUNCHES A TOKEN THROUGH BAGSCAN, A PORTION OF ONGOING FEES ARE DIRECTED
                    TO BAGSCAN&apos;S PARTNER WALLET. TRANSPARENT, ON-CHAIN, FULLY NATIVE TO THE
                    BAGS ECOSYSTEM.
                </p>
            </div>

            {/* Tech */}
            <div className="crt-panel p-6">
                <div className="panel-header">╔══ BUILT WITH ══╗</div>
                <div className="flex flex-wrap gap-2 mt-1">
                    {["Next.js 14+", "TypeScript", "Tailwind CSS", "Prisma + SQLite", "TanStack Query", "Solana Wallet Adapter", "Recharts", "Zod", "Lucide Icons"].map((tech) => (
                        <span key={tech} className="px-2 py-1 text-[9px] tracking-wider text-[#00ff41]/40 border border-[#00ff41]/15 bg-[#00ff41]/5">
                            {tech}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="border border-[#00ff41]/15 bg-black/70 p-5 hover:border-[#00ff41]/30 transition-colors">
            <div className="w-10 h-10 border border-[#00ff41]/20 flex items-center justify-center text-[#00ff41]/40 mb-3">
                {icon}
            </div>
            <h3 className="text-[11px] text-[#00ff41]/70 mb-1 tracking-[0.1em]">{title}</h3>
            <p className="text-[10px] text-[#00ff41]/25 leading-relaxed tracking-wider">{description}</p>
        </div>
    );
}
