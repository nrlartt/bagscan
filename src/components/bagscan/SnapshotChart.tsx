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
    fdvUsd?: number | null;
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
        fdv: d.fdvUsd ?? null,
        price: d.priceUsd ?? null,
    }));

    return (
        <div className={className}>
            <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <defs>
                        <linearGradient id="fdvGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00ff41" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#00ff41" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,65,0.05)" />
                    <XAxis
                        dataKey="time"
                        type="number"
                        domain={["auto", "auto"]}
                        tickFormatter={(v: number) => format(new Date(v), "HH:mm")}
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
                        labelFormatter={(v: any) => format(new Date(v as number), "MMM d, HH:mm")}
                        formatter={(v: any) => [formatCurrency(v as number), "FDV"]}
                    />
                    <Area
                        type="monotone"
                        dataKey="fdv"
                        stroke="#00ff41"
                        strokeWidth={2}
                        fill="url(#fdvGrad)"
                        dot={false}
                        connectNulls
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
