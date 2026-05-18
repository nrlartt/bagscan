"use client";

import { useId } from "react";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

interface SnapshotPoint {
    capturedAt: string;
    priceUsd?: number | null;
    liquidityUsd?: number | null;
    lifetimeFees?: number | null;
}

interface SnapshotChartProps {
    data: SnapshotPoint[];
    className?: string;
    /** `pump` uses mint green chart styling; `terminal` keeps legacy CRT amber accent. */
    variant?: "terminal" | "pump";
    height?: number;
}

export function SnapshotChart({ data, className, variant = "terminal", height = 200 }: SnapshotChartProps) {
    const rid = useId().replace(/:/g, "");
    const gradId = `snap-grad-${rid}`;
    const isPump = variant === "pump";
    const stroke = isPump ? "#53ffb2" : "#ffbf00";
    const fillTop = isPump ? "#53ffb2" : "#ffbf00";
    const axisFill = isPump ? "rgba(255,255,255,0.35)" : "rgba(0,255,65,0.3)";
    const gridStroke = isPump ? "rgba(255,255,255,0.06)" : "rgba(0,255,65,0.05)";
    const axisStroke = isPump ? "rgba(255,255,255,0.08)" : "rgba(0,255,65,0.08)";

    if (!data || data.length < 2) {
        return (
            <div className={className}>
                <div
                    className={`flex h-48 items-center justify-center text-[11px] ${isPump ? "text-white/30" : "text-[#00ff41]/25 tracking-wider"}`}
                >
                    {isPump
                        ? "Not enough history yet — check back after more snapshots."
                        : "NOT ENOUGH DATA POINTS. VISIT AGAIN TO COLLECT MORE SNAPSHOTS."}
                </div>
            </div>
        );
    }

    const chartData = data.map((d) => ({
        time: new Date(d.capturedAt).getTime(),
        price: d.priceUsd ?? null,
    }));

    const hasPrice = chartData.some((d) => d.price !== null);

    const timeSpanMs =
        chartData.length >= 2 ? chartData[chartData.length - 1].time - chartData[0].time : 0;
    const timeFormat =
        timeSpanMs > 48 * 3600_000 ? "MMM d" : timeSpanMs > 3600_000 ? "MMM d, HH:mm" : "HH:mm";

    return (
        <div className={className}>
            <ResponsiveContainer width="100%" height={height}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 4 }}>
                    <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={fillTop} stopOpacity={isPump ? 0.25 : 0.2} />
                            <stop offset="95%" stopColor={fillTop} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis
                        dataKey="time"
                        type="number"
                        domain={["auto", "auto"]}
                        tickFormatter={(v: number) => format(new Date(v), timeFormat)}
                        tick={{ fill: axisFill, fontSize: 10 }}
                        stroke={axisStroke}
                    />
                    <YAxis
                        tickFormatter={(v: number) => formatCurrency(v)}
                        tick={{ fill: axisFill, fontSize: 10 }}
                        stroke={axisStroke}
                        width={72}
                    />
                    <Tooltip
                        contentStyle={
                            isPump
                                ? {
                                      background: "rgba(20,22,28,0.96)",
                                      border: "1px solid rgba(83,255,178,0.25)",
                                      borderRadius: "8px",
                                      fontSize: 12,
                                      color: "#e8fff4",
                                  }
                                : {
                                      background: "rgba(0,0,0,0.95)",
                                      border: "1px solid rgba(0,255,65,0.3)",
                                      borderRadius: 0,
                                      fontSize: 11,
                                      fontFamily: "'Share Tech Mono', monospace",
                                      color: "#00ff41",
                                  }
                        }
                        labelFormatter={(value) => format(new Date(Number(value)), "MMM d, HH:mm")}
                        formatter={(value, name) => [
                            formatCurrency(Number(value)),
                            name === "price" ? "Price" : String(name),
                        ]}
                    />
                    {hasPrice && (
                        <Area
                            type="monotone"
                            dataKey="price"
                            stroke={stroke}
                            strokeWidth={isPump ? 2.5 : 2}
                            fill={`url(#${gradId})`}
                            dot={chartData.length <= 10}
                            connectNulls
                        />
                    )}
                </AreaChart>
            </ResponsiveContainer>
            {chartData.length <= 5 && (
                <div
                    className={`mt-1 text-center text-[9px] ${isPump ? "text-white/25" : "text-[#00ff41]/20 tracking-wider"}`}
                >
                    {isPump
                        ? "Sparse snapshot series — line tightens as more data arrives."
                        : "ESTIMATED FROM DEXSCREENER — MORE DATA POINTS WILL APPEAR OVER TIME"}
                </div>
            )}
        </div>
    );
}
