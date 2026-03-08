"use client";

import { useQuery } from "@tanstack/react-query";
import { Flame, Lock, TrendingDown } from "lucide-react";

interface BuybackTrackerProps {
    tokenMint: string;
}

interface BurnData {
    totalBurned: number;
    totalSupply: number;
    burnPct: string;
    circulatingSupply: number;
}

async function fetchBurnData(tokenMint: string): Promise<BurnData> {
    const res = await fetch(`/api/tokenomics/${tokenMint}`);
    if (!res.ok) throw new Error("Failed to fetch burn data");
    const json = await res.json();
    return json.data;
}

function formatTokenAmount(n: number): string {
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toLocaleString();
}

export function BuybackTracker({ tokenMint }: BuybackTrackerProps) {
    const { data, isLoading } = useQuery<BurnData>({
        queryKey: ["burn-data", tokenMint],
        queryFn: () => fetchBurnData(tokenMint),
        refetchInterval: 60_000,
        staleTime: 30_000,
        retry: 2,
    });

    return (
        <div className="border border-[#ff4400]/15 bg-black/60 p-4">
            <div className="flex items-center gap-2 mb-3">
                <Flame className="w-3.5 h-3.5 text-[#ff4400]/60" />
                <span className="text-[9px] text-[#ff4400]/50 tracking-[0.2em]">LIVE BURN TRACKER</span>
                {isLoading && (
                    <span className="text-[8px] text-[#00ff41]/20 tracking-wider animate-pulse">LOADING...</span>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatBox
                    icon={<Flame className="w-4 h-4 text-[#ff4400]" />}
                    label="TOTAL BURNED"
                    value={data ? formatTokenAmount(data.totalBurned) : "—"}
                    sub={data ? `${data.burnPct}% OF SUPPLY` : ""}
                    color="#ff4400"
                    loading={isLoading}
                />
                <StatBox
                    icon={<TrendingDown className="w-4 h-4 text-[#ffaa00]" />}
                    label="CIRCULATING"
                    value={data ? formatTokenAmount(data.circulatingSupply) : "—"}
                    sub="AFTER BURNS"
                    color="#ffaa00"
                    loading={isLoading}
                />
                <StatBox
                    icon={<Lock className="w-4 h-4 text-[#00ff41]" />}
                    label="TOTAL SUPPLY"
                    value={data ? formatTokenAmount(data.totalSupply) : "—"}
                    sub="INITIAL MINT"
                    color="#00ff41"
                    loading={isLoading}
                />
            </div>

            {data && data.totalBurned > 0 && (
                <div className="mt-3">
                    <div className="flex items-center justify-between text-[8px] tracking-wider mb-1">
                        <span className="text-[#00ff41]/25">BURN PROGRESS</span>
                        <span className="text-[#ff4400]/60">{data.burnPct}%</span>
                    </div>
                    <div className="h-1.5 border border-[#ff4400]/10 bg-black/80 overflow-hidden">
                        <div
                            className="h-full bg-[#ff4400] transition-all duration-1000"
                            style={{
                                width: `${Math.min(parseFloat(data.burnPct), 100)}%`,
                                boxShadow: '0 0 8px rgba(255,68,0,0.4)',
                            }}
                        />
                    </div>
                </div>
            )}

            <div className="mt-3 text-center">
                <span className="text-[8px] text-[#00ff41]/15 tracking-wider">
                    ON-CHAIN DATA · AUTO-REFRESHING EVERY 60S
                </span>
            </div>
        </div>
    );
}

function StatBox({ icon, label, value, sub, color, loading }: {
    icon: React.ReactNode; label: string; value: string; sub: string; color: string; loading: boolean;
}) {
    return (
        <div className="p-3 border border-[#00ff41]/8 bg-black/40 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
                {icon}
                <span className="text-[8px] tracking-[0.15em]" style={{ color: `${color}80` }}>{label}</span>
            </div>
            <div
                className={`text-sm tracking-wider ${loading ? "animate-pulse" : ""}`}
                style={{ color, textShadow: `0 0 8px ${color}40` }}
            >
                {value}
            </div>
            {sub && (
                <div className="text-[8px] text-[#00ff41]/20 tracking-wider mt-0.5">{sub}</div>
            )}
        </div>
    );
}
