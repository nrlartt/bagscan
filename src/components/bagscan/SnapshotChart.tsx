"use client";

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
}

export function SnapshotChart({ data, className }: SnapshotChartProps) {
    if (!data || data.length < 2) {
        return (
            <div className={className}>
                <div className="flex items-center justify-center h-48 text-[10px] text-[#00ff41]/25 tracking-wider">
                    NOT ENOUGH DATA POINTS. VISIT AGAIN TO COLLECT MORE SNAPSHOTS.
                </div>
            </div>
        );
    }

    const chartData = data.map((d) => ({
        time: new Date(d.capturedAt).getTime(),
        price: d.priceUsd ?? null,
    }));

    const hasPrice = chartData.some((d) => d.price !== null);

    const timeSpanMs = chartData.length >= 2
        ? chartData[chartData.length - 1].time - chartData[0].time
        : 0;
    const timeFormat = timeSpanMs > 48 * 3600_000 ? "MMM d" : timeSpanMs > 3600_000 ? "MMM d, HH:mm" : "HH:mm";

    return (
        <div className={className}>
            <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <defs>
                        <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ffbf00" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#ffbf00" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,65,0.05)" />
                    <XAxis
                        dataKey="time"
                        type="number"
                        domain={["auto", "auto"]}
                        tickFormatter={(v: number) => format(new Date(v), timeFormat)}
                        tick={{ fill: "rgba(0,255,65,0.3)", fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}
                        stroke="rgba(0,255,65,0.08)"
                    />
                    <YAxis
                        tickFormatter={(v: number) => formatCurrency(v)}
                        tick={{ fill: "rgba(0,255,65,0.3)", fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}
                        stroke="rgba(0,255,65,0.08)"
                        width={70}
                    />
                    <Tooltip
                        contentStyle={{
                            background: "rgba(0,0,0,0.95)",
                            border: "1px solid rgba(0,255,65,0.3)",
                            borderRadius: 0,
                            fontSize: 11,
                            fontFamily: "'Share Tech Mono', monospace",
                            color: "#00ff41",
                        }}
                        labelFormatter={(value) => format(new Date(Number(value)), "MMM d, HH:mm")}
                        formatter={(value, name) => [
                            formatCurrency(Number(value)),
                            name === "price" ? "PRICE" : String(name).toUpperCase(),
                        ]}
                    />
                    {hasPrice && (
                        <Area
                            type="monotone"
                            dataKey="price"
                            stroke="#ffbf00"
                            strokeWidth={2}
                            fill="url(#priceGrad)"
                            dot={chartData.length <= 10}
                            connectNulls
                        />
                    )}
                </AreaChart>
            </ResponsiveContainer>
            {chartData.length <= 5 && (
                <div className="text-center text-[9px] text-[#00ff41]/20 mt-1 tracking-wider">
                    ESTIMATED FROM DEXSCREENER — MORE DATA POINTS WILL APPEAR OVER TIME
                </div>
            )}
        </div>
    );
}
