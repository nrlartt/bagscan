"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { RH_THEME } from "./NetworkIcons";

/** Clamp a raw curve percentage into 0–100 (the API can return >100 right at migration). */
export function rhClampPct(progress?: number | null): number | null {
    if (progress == null || !Number.isFinite(progress)) return null;
    return Math.min(100, Math.max(0, progress));
}

/** Curve progress as a short label — the API returns long fractions like 3.7241379. */
export function rhFormatPct(progress?: number | null): string {
    const pct = rhClampPct(progress);
    if (pct == null) return "—";
    if (pct > 0 && pct < 0.1) return "<0.1%";
    return `${pct >= 10 ? Math.round(pct) : Number(pct.toFixed(1))}%`;
}

export function RhBondingBar({
    progress,
    className,
    showLabel = true,
}: {
    progress?: number | null;
    className?: string;
    showLabel?: boolean;
}) {
    const pct = rhClampPct(progress);

    return (
        <div className={cn("space-y-1", className)}>
            {showLabel ? (
                <div className="flex items-center justify-between text-[9px] tracking-[0.12em]">
                    <span className="text-white/35">BONDING CURVE</span>
                    <span className="font-semibold tabular-nums" style={{ color: RH_THEME.green }}>
                        {rhFormatPct(progress)}
                    </span>
                </div>
            ) : null}
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                        width: pct != null ? `${pct}%` : "0%",
                        background: `linear-gradient(90deg, ${RH_THEME.green}99, ${RH_THEME.green})`,
                        boxShadow: pct != null && pct > 0 ? `0 0 12px ${RH_THEME.greenGlow}` : undefined,
                    }}
                />
            </div>
        </div>
    );
}

export function RhStatPill({
    label,
    value,
    accent,
}: {
    label: string;
    value: ReactNode;
    accent?: boolean;
}) {
    return (
        <div
            className={cn(
                "rounded-xl border px-3 py-2.5",
                accent
                    ? "border-[#00C805]/25 bg-[#00C805]/[0.06]"
                    : "border-white/10 bg-white/[0.02]"
            )}
        >
            <p className="text-[9px] tracking-[0.14em] text-white/35">{label}</p>
            <p
                className={cn(
                    "mt-1 text-sm font-semibold tabular-nums",
                    accent ? "text-[#00C805]" : "text-white/90"
                )}
            >
                {value}
            </p>
        </div>
    );
}

function timeAgoShort(dateStr?: string): string | null {
    if (!dateStr) return null;
    const ms = Date.now() - new Date(dateStr).getTime();
    if (ms < 0) return null;
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 48) return `${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 60) return `${day}d`;
    return `${Math.floor(day / 30)}mo`;
}

export { timeAgoShort as rhTimeAgoShort };
