"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Filter, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    type ExploreMarketFilters,
    EXPLORE_MCAP_SLIDER_MAX,
    EXPLORE_MCAP_SLIDER_MIN,
    EXPLORE_VOL_SLIDER_MAX,
    EXPLORE_VOL_SLIDER_MIN,
    EXPLORE_FILTER_DEFAULTS,
    parseMoneyInput,
    draftToAppliedFilters,
    appliedFiltersToDraft,
    hasActiveMarketFilters,
} from "@/lib/explore-filters";

interface ExploreFiltersPopoverProps {
    applied: ExploreMarketFilters;
    onApply: (next: ExploreMarketFilters) => void;
    className?: string;
}

function compactUsdLabel(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
    return `$${Math.round(n)}`;
}

export function ExploreFiltersPopover({ applied, onApply, className }: ExploreFiltersPopoverProps) {
    const idBase = useId();
    const filterActive = hasActiveMarketFilters(applied);
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);

    const [mcapLo, setMcapLo] = useState<number>(EXPLORE_FILTER_DEFAULTS.mcapLo);
    const [mcapHi, setMcapHi] = useState<number>(EXPLORE_FILTER_DEFAULTS.mcapHi);
    const [volLo, setVolLo] = useState<number>(EXPLORE_FILTER_DEFAULTS.volLo);
    const [volHi, setVolHi] = useState<number>(EXPLORE_FILTER_DEFAULTS.volHi);

    const [mcapMinStr, setMcapMinStr] = useState("");
    const [mcapMaxStr, setMcapMaxStr] = useState("");
    const [volMinStr, setVolMinStr] = useState("");
    const [volMaxStr, setVolMaxStr] = useState("");

    useEffect(() => {
        if (!open) return;
        const d = appliedFiltersToDraft(applied);
        setMcapLo(d.mcapLo);
        setMcapHi(d.mcapHi);
        setVolLo(d.volLo);
        setVolHi(d.volHi);
        setMcapMinStr(d.mcapLo > 0 ? compactUsdLabel(d.mcapLo) : "");
        setMcapMaxStr(
            d.mcapHi < EXPLORE_MCAP_SLIDER_MAX - 50_000 ? compactUsdLabel(d.mcapHi) : ""
        );
        setVolMinStr(d.volLo > 0 ? compactUsdLabel(d.volLo) : "");
        setVolMaxStr(
            d.volHi < EXPLORE_VOL_SLIDER_MAX - 5_000 ? compactUsdLabel(d.volHi) : ""
        );
    }, [open, applied]);

    const syncRangeLabels = useCallback(() => {
        setMcapMinStr(mcapLo > 0 ? compactUsdLabel(mcapLo) : "");
        setMcapMaxStr(
            mcapHi < EXPLORE_MCAP_SLIDER_MAX - 50_000 ? compactUsdLabel(mcapHi) : ""
        );
        setVolMinStr(volLo > 0 ? compactUsdLabel(volLo) : "");
        setVolMaxStr(
            volHi < EXPLORE_VOL_SLIDER_MAX - 5_000 ? compactUsdLabel(volHi) : ""
        );
    }, [mcapLo, mcapHi, volLo, volHi]);

    useEffect(() => {
        if (!open) return;
        syncRangeLabels();
    }, [mcapLo, mcapHi, volLo, volHi, open, syncRangeLabels]);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            const t = e.target as Node;
            if (panelRef.current?.contains(t)) return;
            if (btnRef.current?.contains(t)) return;
            setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);

    const handleClear = () => {
        setMcapLo(EXPLORE_FILTER_DEFAULTS.mcapLo);
        setMcapHi(EXPLORE_FILTER_DEFAULTS.mcapHi);
        setVolLo(EXPLORE_FILTER_DEFAULTS.volLo);
        setVolHi(EXPLORE_FILTER_DEFAULTS.volHi);
        setMcapMinStr("");
        setMcapMaxStr("");
        setVolMinStr("");
        setVolMaxStr("");
        onApply({});
        setOpen(false);
    };

    const handleApply = () => {
        const parsedMin = parseMoneyInput(mcapMinStr);
        const parsedMax = parseMoneyInput(mcapMaxStr);
        const parsedVolMin = parseMoneyInput(volMinStr);
        const parsedVolMax = parseMoneyInput(volMaxStr);

        let lo = mcapLo;
        let hi = mcapHi;
        let vlo = volLo;
        let vhi = volHi;

        if (parsedMin !== undefined) {
            lo = Math.max(EXPLORE_MCAP_SLIDER_MIN, Math.min(parsedMin, EXPLORE_MCAP_SLIDER_MAX));
        }
        if (parsedMax !== undefined) {
            hi = Math.max(EXPLORE_MCAP_SLIDER_MIN, Math.min(parsedMax, EXPLORE_MCAP_SLIDER_MAX));
        }
        if (parsedVolMin !== undefined) {
            vlo = Math.max(EXPLORE_VOL_SLIDER_MIN, Math.min(parsedVolMin, EXPLORE_VOL_SLIDER_MAX));
        }
        if (parsedVolMax !== undefined) {
            vhi = Math.max(EXPLORE_VOL_SLIDER_MIN, Math.min(parsedVolMax, EXPLORE_VOL_SLIDER_MAX));
        }

        if (lo > hi) [lo, hi] = [hi, lo];
        if (vlo > vhi) [vlo, vhi] = [vhi, vlo];

        setMcapLo(lo);
        setMcapHi(hi);
        setVolLo(vlo);
        setVolHi(vhi);

        onApply(draftToAppliedFilters(lo, hi, vlo, vhi));
        setOpen(false);
    };

    const mcapRangeLabel = `${compactUsdLabel(mcapLo)} – ${compactUsdLabel(mcapHi)}+`;
    const volRangeLabel = `${compactUsdLabel(volLo)} – ${compactUsdLabel(volHi)}+`;

    const MC_STEP = 50_000;
    const VOL_STEP = 5_000;

    return (
        <div className={cn("relative", className)}>
            <div className="flex items-center gap-0.5">
                <button
                    ref={btnRef}
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className={cn(
                        "flex items-center gap-1.5 border border-white/[0.1] bg-[#121214] px-2.5 py-2 text-[10px] font-medium tracking-wide text-white/70 transition-colors hover:border-[#00ff41]/35 hover:text-white",
                        open && "border-[#00ff41]/40 text-[#00ff41]",
                        !open && filterActive && "border-[#00ff41]/28 text-[#00ff41]/90"
                    )}
                    aria-expanded={open}
                    aria-haspopup="dialog"
                >
                    <Filter className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Filter</span>
                </button>
                <button
                    type="button"
                    disabled
                    className="border border-white/[0.06] bg-[#121214] p-2 text-white/25"
                    title="Coming soon"
                    aria-label="Settings"
                >
                    <Settings className="h-3.5 w-3.5" />
                </button>
            </div>

            {open ? (
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-label="Market filters"
                    className="absolute right-0 top-full z-[80] mt-2 w-[min(100vw-2rem,20rem)] rounded-xl border border-white/[0.1] bg-[#141416] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
                >
                    <div className="mb-4">
                        <div className="mb-2 flex items-center justify-between text-[11px] text-white/80">
                            <span className="font-medium">Mcap</span>
                            <span className="text-[10px] tabular-nums text-white/45">{mcapRangeLabel}</span>
                        </div>
                        <div className="relative h-6">
                            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/10" />
                            <div
                                className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#00ff41]/75"
                                style={{
                                    left: `${((mcapLo - EXPLORE_MCAP_SLIDER_MIN) / (EXPLORE_MCAP_SLIDER_MAX - EXPLORE_MCAP_SLIDER_MIN)) * 100}%`,
                                    width: `${((mcapHi - mcapLo) / (EXPLORE_MCAP_SLIDER_MAX - EXPLORE_MCAP_SLIDER_MIN)) * 100}%`,
                                }}
                            />
                            <input
                                id={`${idBase}-mcap-lo`}
                                type="range"
                                min={EXPLORE_MCAP_SLIDER_MIN}
                                max={EXPLORE_MCAP_SLIDER_MAX}
                                step={MC_STEP}
                                value={mcapLo}
                                onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setMcapLo(Math.min(v, mcapHi - MC_STEP));
                                }}
                                className="absolute h-6 w-full cursor-pointer appearance-none bg-transparent opacity-100 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-0.35rem] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#00ff41] [&::-webkit-slider-thumb]:bg-[#0a0a0c]"
                            />
                            <input
                                id={`${idBase}-mcap-hi`}
                                type="range"
                                min={EXPLORE_MCAP_SLIDER_MIN}
                                max={EXPLORE_MCAP_SLIDER_MAX}
                                step={MC_STEP}
                                value={mcapHi}
                                onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setMcapHi(Math.max(v, mcapLo + MC_STEP));
                                }}
                                className="absolute h-6 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-0.35rem] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#00ff41] [&::-webkit-slider-thumb]:bg-[#0a0a0c]"
                            />
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <label className="block">
                                <span className="mb-0.5 block text-[9px] tracking-wide text-white/40"> Minimum </span>
                                <input
                                    value={mcapMinStr}
                                    onChange={(e) => setMcapMinStr(e.target.value)}
                                    placeholder="e.g., 10k, 1m"
                                    className="w-full rounded-md border border-white/[0.08] bg-black/50 px-2 py-1.5 text-[11px] text-white/90 placeholder:text-white/25 focus:border-[#00ff41]/40 focus:outline-none"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-0.5 block text-[9px] tracking-wide text-white/40"> Maximum </span>
                                <input
                                    value={mcapMaxStr}
                                    onChange={(e) => setMcapMaxStr(e.target.value)}
                                    placeholder="e.g., 500k, 5m"
                                    className="w-full rounded-md border border-white/[0.08] bg-black/50 px-2 py-1.5 text-[11px] text-white/90 placeholder:text-white/25 focus:border-[#00ff41]/40 focus:outline-none"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="mb-4">
                        <div className="mb-2 flex items-center justify-between text-[11px] text-white/80">
                            <span className="font-medium">24h Vol</span>
                            <span className="text-[10px] tabular-nums text-white/45">{volRangeLabel}</span>
                        </div>
                        <div className="relative h-6">
                            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/10" />
                            <div
                                className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#00ff41]/75"
                                style={{
                                    left: `${((volLo - EXPLORE_VOL_SLIDER_MIN) / (EXPLORE_VOL_SLIDER_MAX - EXPLORE_VOL_SLIDER_MIN)) * 100}%`,
                                    width: `${((volHi - volLo) / (EXPLORE_VOL_SLIDER_MAX - EXPLORE_VOL_SLIDER_MIN)) * 100}%`,
                                }}
                            />
                            <input
                                type="range"
                                min={EXPLORE_VOL_SLIDER_MIN}
                                max={EXPLORE_VOL_SLIDER_MAX}
                                step={VOL_STEP}
                                value={volLo}
                                onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setVolLo(Math.min(v, volHi - VOL_STEP));
                                }}
                                className="absolute h-6 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-0.35rem] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#00ff41] [&::-webkit-slider-thumb]:bg-[#0a0a0c]"
                            />
                            <input
                                type="range"
                                min={EXPLORE_VOL_SLIDER_MIN}
                                max={EXPLORE_VOL_SLIDER_MAX}
                                step={VOL_STEP}
                                value={volHi}
                                onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setVolHi(Math.max(v, volLo + VOL_STEP));
                                }}
                                className="absolute h-6 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-0.35rem] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#00ff41] [&::-webkit-slider-thumb]:bg-[#0a0a0c]"
                            />
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <label className="block">
                                <span className="mb-0.5 block text-[9px] tracking-wide text-white/40"> Minimum </span>
                                <input
                                    value={volMinStr}
                                    onChange={(e) => setVolMinStr(e.target.value)}
                                    placeholder="e.g., 5k, 100k"
                                    className="w-full rounded-md border border-white/[0.08] bg-black/50 px-2 py-1.5 text-[11px] text-white/90 placeholder:text-white/25 focus:border-[#00ff41]/40 focus:outline-none"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-0.5 block text-[9px] tracking-wide text-white/40"> Maximum </span>
                                <input
                                    value={volMaxStr}
                                    onChange={(e) => setVolMaxStr(e.target.value)}
                                    placeholder="e.g., 50k, 1m"
                                    className="w-full rounded-md border border-white/[0.08] bg-black/50 px-2 py-1.5 text-[11px] text-white/90 placeholder:text-white/25 focus:border-[#00ff41]/40 focus:outline-none"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-[11px] font-medium text-white/50 transition-colors hover:text-white"
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            onClick={handleApply}
                            className="rounded-md bg-[#00ff41] px-4 py-2 text-[11px] font-semibold tracking-wide text-black transition-opacity hover:opacity-90"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
