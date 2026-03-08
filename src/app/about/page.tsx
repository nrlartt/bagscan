import type { Metadata } from "next";
import Link from "next/link";
import { Scan, TrendingUp, Users, Coins, Shield, Zap, Rocket, ExternalLink, Flame, Lock, ArrowDownCircle, RefreshCw } from "lucide-react";
import { CopyButton } from "@/components/bagscan/CopyButton";
import { BuybackTracker } from "@/components/bagscan/BuybackTracker";

export const metadata: Metadata = {
    title: "About — BagScan",
    description: "Learn about BagScan, the Bags-native token discovery terminal. Powered by $SCAN.",
};

const SCAN_CA = "BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS";

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

            {/* $SCAN Token */}
            <div className="mb-12 border-2 border-[#00ff41]/30 bg-black/80 overflow-hidden" style={{ boxShadow: '0 0 25px rgba(0,255,65,0.05)' }}>
                <div className="px-6 py-3 border-b border-[#00ff41]/20 bg-[#00ff41]/[0.03] flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#00ff41]/60" />
                    <span className="text-[11px] text-[#00ff41]/70 tracking-[0.2em]">╔══ $SCAN TOKEN ══╗</span>
                </div>
                <div className="p-6">
                    <div className="flex items-start gap-4 mb-5">
                        <div className="w-14 h-14 border-2 border-[#00ff41]/30 flex items-center justify-center flex-shrink-0 bg-[#00ff41]/[0.03]" style={{ boxShadow: '0 0 12px rgba(0,255,65,0.1)' }}>
                            <span className="text-lg text-[#00ff41]" style={{ textShadow: '0 0 8px rgba(0,255,65,0.4)' }}>$</span>
                        </div>
                        <div>
                            <h2 className="text-sm text-[#00ff41] tracking-[0.15em] mb-1" style={{ textShadow: '0 0 6px rgba(0,255,65,0.3)' }}>
                                $SCAN
                            </h2>
                            <p className="text-[10px] text-[#00ff41]/30 tracking-wider leading-relaxed">
                                THE NATIVE TOKEN OF THE BAGSCAN ECOSYSTEM. $SCAN POWERS THE PLATFORM
                                AND ALIGNS INCENTIVES BETWEEN THE TEAM, USERS, AND THE BAGS COMMUNITY.
                            </p>
                        </div>
                    </div>

                    {/* CA */}
                    <div className="mb-5 p-3 border border-[#00ff41]/15 bg-black/60">
                        <div className="text-[8px] text-[#00ff41]/30 tracking-[0.2em] mb-1.5">CONTRACT ADDRESS</div>
                        <CopyableCA ca={SCAN_CA} />
                    </div>

                    {/* Links */}
                    <div className="flex flex-wrap gap-2 mb-5">
                        <a
                            href={`https://bags.fm/${SCAN_CA}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 border border-[#00ff41]/25 text-[10px] text-[#00ff41]/60 tracking-wider hover:text-[#00ff41] hover:border-[#00ff41]/50 hover:bg-[#00ff41]/5 transition-all"
                        >
                            <Rocket className="w-3 h-3" />
                            TRADE ON BAGS.FM
                            <ExternalLink className="w-2.5 h-2.5 opacity-40" />
                        </a>
                        <Link
                            href={`/token/${SCAN_CA}`}
                            className="flex items-center gap-1.5 px-3 py-2 border border-[#00ff41]/25 text-[10px] text-[#00ff41]/60 tracking-wider hover:text-[#00ff41] hover:border-[#00ff41]/50 hover:bg-[#00ff41]/5 transition-all"
                        >
                            <Scan className="w-3 h-3" />
                            VIEW ON BAGSCAN
                        </Link>
                    </div>

                    {/* Utility */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 border border-[#00ff41]/10 bg-[#00ff41]/[0.02]">
                            <div className="text-[9px] text-[#00ff41]/40 tracking-[0.15em] mb-1">PLATFORM</div>
                            <div className="text-[10px] text-[#00ff41]/60 tracking-wider">Bags.fm (Solana)</div>
                        </div>
                        <div className="p-3 border border-[#00ff41]/10 bg-[#00ff41]/[0.02]">
                            <div className="text-[9px] text-[#00ff41]/40 tracking-[0.15em] mb-1">UTILITY</div>
                            <div className="text-[10px] text-[#00ff41]/60 tracking-wider">Ecosystem Token</div>
                        </div>
                        <div className="p-3 border border-[#00ff41]/10 bg-[#00ff41]/[0.02]">
                            <div className="text-[9px] text-[#00ff41]/40 tracking-[0.15em] mb-1">TICKER</div>
                            <div className="text-[10px] text-[#00ff41]/60 tracking-wider">$SCAN</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Buyback & Burn */}
            <div className="mb-12 border-2 border-[#ff4400]/20 bg-black/80 overflow-hidden" style={{ boxShadow: '0 0 25px rgba(255,68,0,0.03)' }}>
                <div className="px-6 py-3 border-b border-[#ff4400]/15 bg-[#ff4400]/[0.02] flex items-center gap-2">
                    <Flame className="w-4 h-4 text-[#ff4400]/60" />
                    <span className="text-[11px] text-[#ff4400]/70 tracking-[0.2em]">╔══ BUYBACK &amp; BURN ══╗</span>
                </div>
                <div className="p-6">
                    <p className="text-[10px] text-[#00ff41]/35 leading-relaxed tracking-wider mb-6">
                        BAGSCAN ALLOCATES A PORTION OF ALL PLATFORM REVENUE (PARTNER FEE SHARE FROM TOKEN LAUNCHES)
                        TO SYSTEMATICALLY BUY BACK <span className="text-[#00ff41]/60">$SCAN</span> TOKENS FROM THE OPEN MARKET
                        AND PERMANENTLY BURN THEM. THIS CREATES CONTINUOUS DEFLATIONARY PRESSURE AND DIRECTLY
                        REWARDS HOLDERS.
                    </p>

                    {/* How it works */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                        <div className="p-4 border border-[#ff4400]/10 bg-[#ff4400]/[0.02] text-center">
                            <div className="w-10 h-10 mx-auto border border-[#ffaa00]/20 flex items-center justify-center text-[#ffaa00]/50 mb-2">
                                <ArrowDownCircle className="w-5 h-5" />
                            </div>
                            <div className="text-[9px] text-[#ffaa00]/60 tracking-[0.15em] mb-1">STEP 1</div>
                            <div className="text-[9px] text-[#00ff41]/35 tracking-wider">REVENUE COLLECTED FROM PARTNER FEE SHARE</div>
                        </div>
                        <div className="p-4 border border-[#ff4400]/10 bg-[#ff4400]/[0.02] text-center">
                            <div className="w-10 h-10 mx-auto border border-[#ffaa00]/20 flex items-center justify-center text-[#ffaa00]/50 mb-2">
                                <RefreshCw className="w-5 h-5" />
                            </div>
                            <div className="text-[9px] text-[#ffaa00]/60 tracking-[0.15em] mb-1">STEP 2</div>
                            <div className="text-[9px] text-[#00ff41]/35 tracking-wider">$SCAN BOUGHT FROM OPEN MARKET</div>
                        </div>
                        <div className="p-4 border border-[#ff4400]/10 bg-[#ff4400]/[0.02] text-center">
                            <div className="w-10 h-10 mx-auto border border-[#ff4400]/20 flex items-center justify-center text-[#ff4400]/50 mb-2">
                                <Flame className="w-5 h-5" />
                            </div>
                            <div className="text-[9px] text-[#ff4400]/60 tracking-[0.15em] mb-1">STEP 3</div>
                            <div className="text-[9px] text-[#00ff41]/35 tracking-wider">TOKENS SENT TO BURN ADDRESS — PERMANENTLY REMOVED</div>
                        </div>
                    </div>

                    {/* Live tracker */}
                    <BuybackTracker tokenMint={SCAN_CA} />

                    {/* Revenue allocation */}
                    <div className="mt-5 p-4 border border-[#00ff41]/10 bg-black/60">
                        <div className="text-[9px] text-[#00ff41]/40 tracking-[0.2em] mb-3">REVENUE ALLOCATION</div>
                        <div className="space-y-2">
                            <AllocationBar label="BUYBACK & BURN" pct={40} color="#ff4400" />
                            <AllocationBar label="DEVELOPMENT" pct={30} color="#00ff41" />
                            <AllocationBar label="OPERATIONS" pct={20} color="#ffaa00" />
                            <AllocationBar label="COMMUNITY" pct={10} color="#00aaff" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
                <FeatureCard icon={<TrendingUp className="w-5 h-5" />} title="FDV, NOT MARKET CAP" description="BagScan shows Fully Diluted Valuation (FDV) rather than market cap when circulating supply cannot be verified. FDV = price × total supply." />
                <FeatureCard icon={<Users className="w-5 h-5" />} title="CREATOR-FIRST METRICS" description="See creator identity, royalty basis points, provider verification, and claim activity at a glance." />
                <FeatureCard icon={<Coins className="w-5 h-5" />} title="FEE & CLAIM ANALYTICS" description="Track lifetime fees, claim counts, claim events, and creator revenue directly from Bags APIs." />
                <FeatureCard icon={<Shield className="w-5 h-5" />} title="NATIVE MONETIZATION" description="BagScan earns revenue through the Bags partner configuration with transparent, on-chain fee sharing." />
            </div>

            {/* Roadmap */}
            <div className="crt-panel p-6 mb-8">
                <div className="panel-header">╔══ ROADMAP ══╗</div>
                <div className="space-y-3 mt-2">
                    <RoadmapItem phase="PHASE 1" status="LIVE" items={["Token Discovery Terminal", "Real-time Trending & New Launches", "Creator Analytics & Fee Tracking", "Alpha Signal Feed", "Token Launch Interface", "$SCAN Buyback & Burn System"]} />
                    <RoadmapItem phase="PHASE 2" status="IN DEVELOPMENT" items={["Portfolio Tracker & PnL", "Smart Alert Notifications", "Wallet Tracking", "Advanced Charting"]} />
                    <RoadmapItem phase="PHASE 3" status="PLANNED" items={["AI-Powered Token Scoring", "Creator Reputation System", "Mobile App", "$SCAN Holder Benefits"]} />
                </div>
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
                    TO BAGSCAN&apos;S PARTNER WALLET. <span className="text-[#ff4400]/50">40% OF ALL REVENUE IS ALLOCATED TO
                    $SCAN BUYBACK &amp; BURN</span>, CREATING CONTINUOUS DEFLATIONARY PRESSURE.
                    TRANSPARENT, ON-CHAIN, FULLY NATIVE TO THE BAGS ECOSYSTEM.
                </p>
            </div>

            {/* Tech */}
            <div className="crt-panel p-6">
                <div className="panel-header">╔══ BUILT WITH ══╗</div>
                <div className="flex flex-wrap gap-2 mt-1">
                    {["Next.js 14+", "TypeScript", "Tailwind CSS", "Prisma + PostgreSQL", "TanStack Query", "Solana Wallet Adapter", "Recharts", "Zod", "Lucide Icons"].map((tech) => (
                        <span key={tech} className="px-2 py-1 text-[9px] tracking-wider text-[#00ff41]/40 border border-[#00ff41]/15 bg-[#00ff41]/5">
                            {tech}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

function CopyableCA({ ca }: { ca: string }) {
    return (
        <div className="flex items-center gap-2">
            <code className="text-[10px] text-[#00ff41]/60 tracking-wider break-all flex-1 select-all">
                {ca}
            </code>
            <CopyButton text={ca} />
        </div>
    );
}

function RoadmapItem({ phase, status, items }: { phase: string; status: string; items: string[] }) {
    const isLive = status === "LIVE";
    const isInDev = status === "IN DEVELOPMENT";
    return (
        <div className="flex gap-3">
            <div className="flex flex-col items-center">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${isLive ? "bg-[#00ff41]" : isInDev ? "bg-[#ffaa00] animate-pulse" : "bg-[#00ff41]/20"}`}
                    style={isLive ? { boxShadow: '0 0 6px #00ff41' } : isInDev ? { boxShadow: '0 0 6px #ffaa00' } : undefined} />
                <div className="w-px flex-1 bg-[#00ff41]/10 mt-1" />
            </div>
            <div className="pb-4">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-[#00ff41]/60 tracking-[0.15em]">{phase}</span>
                    <span className={`text-[8px] tracking-[0.12em] px-1.5 py-0.5 border ${isLive ? "text-[#00ff41] border-[#00ff41]/30 bg-[#00ff41]/5" : isInDev ? "text-[#ffaa00] border-[#ffaa00]/30 bg-[#ffaa00]/5" : "text-[#00ff41]/25 border-[#00ff41]/10"}`}>
                        {status}
                    </span>
                </div>
                <ul className="space-y-0.5">
                    {items.map((item) => (
                        <li key={item} className="text-[9px] text-[#00ff41]/30 tracking-wider flex items-center gap-1.5">
                            <span className="text-[#00ff41]/15">▸</span> {item}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

function AllocationBar({ label, pct, color }: { label: string; pct: number; color: string }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-[9px] text-[#00ff41]/30 tracking-wider w-28 flex-shrink-0">{label}</span>
            <div className="flex-1 h-2 border border-[#00ff41]/10 bg-black/60 overflow-hidden">
                <div
                    className="h-full transition-all duration-1000"
                    style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}40` }}
                />
            </div>
            <span className="text-[9px] tracking-wider w-8 text-right" style={{ color }}>{pct}%</span>
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
