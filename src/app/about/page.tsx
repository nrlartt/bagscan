import type { Metadata } from "next";
import Link from "next/link";
import { Scan, TrendingUp, Users, Coins, Shield, Zap, Rocket, ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/bagscan/CopyButton";

export const metadata: Metadata = {
    title: "About - BagScan",
    description: "Learn about BagScan, the Bags-native token discovery terminal. Powered by $SCAN.",
};

const SCAN_CA = "BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS";

export default function AboutPage() {
    return (
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 animate-fade-in">
            <div className="mb-12 text-center">
                <div
                    className="mx-auto mb-6 flex h-16 w-16 items-center justify-center border-2 border-[#00ff41]/40"
                    style={{ boxShadow: "0 0 20px rgba(0,255,65,0.1)" }}
                >
                    <Scan className="h-8 w-8 text-[#00ff41]" />
                </div>
                <h1
                    className="text-xl tracking-[0.2em] text-[#00ff41]"
                    style={{ textShadow: "0 0 10px rgba(0,255,65,0.3)" }}
                >
                    [ ABOUT BAGSCAN ]
                </h1>
                <p className="mx-auto mt-4 max-w-lg text-[11px] leading-relaxed tracking-wider text-[#00ff41]/30">
                    BAGSCAN IS A BAGS-NATIVE TOKEN DISCOVERY AND LAUNCH TERMINAL. BROWSE, ANALYZE,
                    AND TRADE TOKENS LAUNCHED ON THE BAGS PLATFORM WITH CREATOR-FIRST METRICS,
                    OFFICIAL MARKET DATA, AND TRANSPARENT FEE ANALYTICS.
                </p>
            </div>

            <div
                className="mb-12 overflow-hidden border-2 border-[#00ff41]/30 bg-black/80"
                style={{ boxShadow: "0 0 25px rgba(0,255,65,0.05)" }}
            >
                <div className="flex items-center gap-2 border-b border-[#00ff41]/20 bg-[#00ff41]/[0.03] px-6 py-3">
                    <Zap className="h-4 w-4 text-[#00ff41]/60" />
                    <span className="text-[11px] tracking-[0.2em] text-[#00ff41]/70">[ $SCAN TOKEN ]</span>
                </div>
                <div className="p-6">
                    <div className="mb-5 flex items-start gap-4">
                        <div
                            className="flex h-14 w-14 flex-shrink-0 items-center justify-center border-2 border-[#00ff41]/30 bg-[#00ff41]/[0.03]"
                            style={{ boxShadow: "0 0 12px rgba(0,255,65,0.1)" }}
                        >
                            <span className="text-lg text-[#00ff41]" style={{ textShadow: "0 0 8px rgba(0,255,65,0.4)" }}>
                                $
                            </span>
                        </div>
                        <div>
                            <h2
                                className="mb-1 text-sm tracking-[0.15em] text-[#00ff41]"
                                style={{ textShadow: "0 0 6px rgba(0,255,65,0.3)" }}
                            >
                                $SCAN
                            </h2>
                            <p className="text-[10px] leading-relaxed tracking-wider text-[#00ff41]/30">
                                THE NATIVE TOKEN OF THE BAGSCAN ECOSYSTEM. $SCAN CONNECTS DISCOVERY,
                                LAUNCH INFRASTRUCTURE, HOLDER ACCESS, AND COMMUNITY ALIGNMENT ACROSS
                                THE BAGS PLATFORM.
                            </p>
                        </div>
                    </div>

                    <div className="mb-5 border border-[#00ff41]/15 bg-black/60 p-3">
                        <div className="mb-1.5 text-[8px] tracking-[0.2em] text-[#00ff41]/30">CONTRACT ADDRESS</div>
                        <CopyableCA ca={SCAN_CA} />
                    </div>

                    <div className="mb-5 flex flex-wrap gap-2">
                        <a
                            href={`https://bags.fm/${SCAN_CA}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 border border-[#00ff41]/25 px-3 py-2 text-[10px] tracking-wider text-[#00ff41]/60 transition-all hover:border-[#00ff41]/50 hover:bg-[#00ff41]/5 hover:text-[#00ff41]"
                        >
                            <Rocket className="h-3 w-3" />
                            TRADE ON BAGS.FM
                            <ExternalLink className="h-2.5 w-2.5 opacity-40" />
                        </a>
                        <Link
                            href={`/token/${SCAN_CA}`}
                            className="flex items-center gap-1.5 border border-[#00ff41]/25 px-3 py-2 text-[10px] tracking-wider text-[#00ff41]/60 transition-all hover:border-[#00ff41]/50 hover:bg-[#00ff41]/5 hover:text-[#00ff41]"
                        >
                            <Scan className="h-3 w-3" />
                            VIEW ON BAGSCAN
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <InfoTile label="PLATFORM" value="Bags.fm (Solana)" />
                        <InfoTile label="UTILITY" value="Ecosystem Token" />
                        <InfoTile label="TICKER" value="$SCAN" />
                    </div>
                </div>
            </div>

            <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FeatureCard
                    icon={<TrendingUp className="h-5 w-5" />}
                    title="MCAP FIRST, FDV FALLBACK"
                    description="BagScan shows the official Bags market cap when available and falls back to clearly labeled FDV when the market-cap field is missing."
                />
                <FeatureCard
                    icon={<Users className="h-5 w-5" />}
                    title="CREATOR-FIRST METRICS"
                    description="See creator identity, royalty basis points, provider verification, and claim activity at a glance."
                />
                <FeatureCard
                    icon={<Coins className="h-5 w-5" />}
                    title="FEE AND CLAIM ANALYTICS"
                    description="Track lifetime fees, claim counts, claim events, and creator revenue directly from Bags APIs."
                />
                <FeatureCard
                    icon={<Shield className="h-5 w-5" />}
                    title="NATIVE MONETIZATION"
                    description="BagScan earns revenue through the Bags partner configuration with transparent, on-chain fee sharing."
                />
            </div>

            <div className="crt-panel mb-8 p-6">
                <div className="panel-header">[ ROADMAP ]</div>
                <div className="mt-2 space-y-3">
                    <RoadmapItem
                        phase="PHASE 1"
                        status="LIVE"
                        items={[
                            "Token Discovery Terminal",
                            "Real-time Trending and New Launches",
                            "Creator Analytics and Fee Tracking",
                            "Alpha Signal Feed",
                            "Token Launch Interface",
                            "$SCAN Buyback and Burn System",
                        ]}
                    />
                    <RoadmapItem
                        phase="PHASE 2"
                        status="IN DEVELOPMENT"
                        items={[
                            "Portfolio Tracker and PnL",
                            "Smart Alert Notifications",
                            "Wallet Tracking",
                            "Advanced Charting",
                        ]}
                    />
                    <RoadmapItem
                        phase="PHASE 3"
                        status="PLANNED"
                        items={[
                            "AI-Powered Token Scoring",
                            "Creator Reputation System",
                            "Mobile App",
                            "$SCAN Holder Benefits",
                        ]}
                    />
                </div>
            </div>

            <div className="crt-panel mb-8 p-6">
                <div className="panel-header">[ OFFICIAL MARKET DATA ]</div>
                <p className="text-[10px] leading-relaxed tracking-wider text-[#00ff41]/35">
                    BAGSCAN USES THE OFFICIAL <span className="text-[#00ff41]/60">MARKET CAP</span>
                    {" "}VALUE PUBLISHED BY BAGS WHEN IT IS AVAILABLE. IF THAT FIELD IS MISSING, BAGSCAN
                    FALLS BACK TO A CLEARLY LABELED <span className="text-[#00ff41]/60">FDV</span> METRIC SO
                    THE UI STAYS INFORMATIVE WITHOUT MISLABELING ESTIMATED VALUATION AS MARKET CAP.
                </p>
            </div>

            <div className="crt-panel mb-8 p-6">
                <div className="panel-header">[ MONETIZATION ]</div>
                <p className="text-[10px] leading-relaxed tracking-wider text-[#00ff41]/35">
                    BAGSCAN USES BAGS&apos; NATIVE PARTNER CONFIGURATION SYSTEM. WHEN A CREATOR LAUNCHES
                    A TOKEN THROUGH BAGSCAN, A PORTION OF ONGOING FEES ARE DIRECTED TO BAGSCAN&apos;S
                    PARTNER WALLET. <span className="text-[#ff4400]/50">40% OF ALL REVENUE IS ALLOCATED TO
                    $SCAN BUYBACK AND BURN</span>, CREATING CONTINUOUS DEFLATIONARY PRESSURE.
                </p>
            </div>

            <div className="crt-panel p-6">
                <div className="panel-header">[ BUILT WITH ]</div>
                <div className="mt-1 flex flex-wrap gap-2">
                    {[
                        "Next.js 14+",
                        "TypeScript",
                        "Tailwind CSS",
                        "Prisma + PostgreSQL",
                        "TanStack Query",
                        "Solana Wallet Adapter",
                        "Recharts",
                        "Zod",
                        "Lucide Icons",
                    ].map((tech) => (
                        <span
                            key={tech}
                            className="border border-[#00ff41]/15 bg-[#00ff41]/5 px-2 py-1 text-[9px] tracking-wider text-[#00ff41]/40"
                        >
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
            <code className="flex-1 select-all break-all text-[10px] tracking-wider text-[#00ff41]/60">
                {ca}
            </code>
            <CopyButton text={ca} />
        </div>
    );
}

function InfoTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="border border-[#00ff41]/10 bg-[#00ff41]/[0.02] p-3">
            <div className="mb-1 text-[9px] tracking-[0.15em] text-[#00ff41]/40">{label}</div>
            <div className="text-[10px] tracking-wider text-[#00ff41]/60">{value}</div>
        </div>
    );
}

function RoadmapItem({ phase, status, items }: { phase: string; status: string; items: string[] }) {
    const isLive = status === "LIVE";
    const isInDev = status === "IN DEVELOPMENT";

    return (
        <div className="flex gap-3">
            <div className="flex flex-col items-center">
                <div
                    className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${isLive ? "bg-[#00ff41]" : isInDev ? "bg-[#ffaa00] animate-pulse" : "bg-[#00ff41]/20"}`}
                    style={isLive ? { boxShadow: "0 0 6px #00ff41" } : isInDev ? { boxShadow: "0 0 6px #ffaa00" } : undefined}
                />
                <div className="mt-1 w-px flex-1 bg-[#00ff41]/10" />
            </div>
            <div className="pb-4">
                <div className="mb-1 flex items-center gap-2">
                    <span className="text-[10px] tracking-[0.15em] text-[#00ff41]/60">{phase}</span>
                    <span
                        className={`border px-1.5 py-0.5 text-[8px] tracking-[0.12em] ${isLive ? "border-[#00ff41]/30 bg-[#00ff41]/5 text-[#00ff41]" : isInDev ? "border-[#ffaa00]/30 bg-[#ffaa00]/5 text-[#ffaa00]" : "border-[#00ff41]/10 text-[#00ff41]/25"}`}
                    >
                        {status}
                    </span>
                </div>
                <ul className="space-y-0.5">
                    {items.map((item) => (
                        <li key={item} className="flex items-center gap-1.5 text-[9px] tracking-wider text-[#00ff41]/30">
                            <span className="text-[#00ff41]/15">-</span>
                            {item}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

function FeatureCard({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <div className="border border-[#00ff41]/15 bg-black/70 p-5 transition-colors hover:border-[#00ff41]/30">
            <div className="mb-3 flex h-10 w-10 items-center justify-center border border-[#00ff41]/20 text-[#00ff41]/40">
                {icon}
            </div>
            <h3 className="mb-1 text-[11px] tracking-[0.1em] text-[#00ff41]/70">{title}</h3>
            <p className="text-[10px] leading-relaxed tracking-wider text-[#00ff41]/25">{description}</p>
        </div>
    );
}
