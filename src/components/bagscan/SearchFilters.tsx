"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, LayoutGrid, List, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchFiltersProps {
    search: string;
    onSearchChange: (v: string) => void;
    sort: string;
    onSortChange: (v: string) => void;
    viewMode: "grid" | "table";
    onViewModeChange: (v: "grid" | "table") => void;
    filters: {
        hasCreator: boolean;
        hasFees: boolean;
        hasClaims: boolean;
        enrichedOnly: boolean;
        provider: string;
    };
    onFiltersChange: (f: SearchFiltersProps["filters"]) => void;
    totalCount?: number;
}

export function SearchFilters({
    search,
    onSearchChange,
    sort,
    onSortChange,
    viewMode,
    onViewModeChange,
    filters,
    onFiltersChange,
    totalCount,
}: SearchFiltersProps) {
    const [showFilters, setShowFilters] = useState(false);

    const activeCount = [
        filters.hasCreator,
        filters.hasFees,
        filters.hasClaims,
        filters.enrichedOnly,
        !!filters.provider,
    ].filter(Boolean).length;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search by name, symbol, mint, or creator..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]
                       text-sm text-gray-200 placeholder-gray-600
                       focus:outline-none focus:ring-1 focus:ring-purple-500/40 focus:border-purple-500/40
                       transition-all duration-200"
                    />
                    {search && (
                        <button
                            onClick={() => onSearchChange("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Sort */}
                <select
                    value={sort}
                    onChange={(e) => onSortChange(e.target.value)}
                    className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]
                     text-sm text-gray-300
                     focus:outline-none focus:ring-1 focus:ring-purple-500/40
                     appearance-none cursor-pointer min-w-[140px]"
                >
                    <option value="newest">Newest</option>
                    <option value="fdv-desc">FDV ↓</option>
                    <option value="volume-desc">Volume ↓</option>
                    <option value="liquidity-desc">Liquidity ↓</option>
                    <option value="gainers">Top Gainers</option>
                    <option value="losers">Top Losers</option>
                    <option value="fees-desc">Fees ↓</option>
                    <option value="claims-desc">Claims ↓</option>
                    <option value="name-asc">Name A-Z</option>
                </select>

                {/* Filter toggle */}
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(
                        "p-2.5 rounded-xl border transition-all duration-200",
                        showFilters || activeCount > 0
                            ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                            : "bg-white/[0.03] border-white/[0.06] text-gray-500 hover:text-gray-300"
                    )}
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    {activeCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-[9px] rounded-full flex items-center justify-center">
                            {activeCount}
                        </span>
                    )}
                </button>

                {/* View toggle */}
                <div className="flex rounded-xl border border-white/[0.06] overflow-hidden">
                    <button
                        onClick={() => onViewModeChange("grid")}
                        className={cn(
                            "p-2.5 transition-colors",
                            viewMode === "grid"
                                ? "bg-white/[0.08] text-gray-200"
                                : "text-gray-600 hover:text-gray-400"
                        )}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onViewModeChange("table")}
                        className={cn(
                            "p-2.5 transition-colors",
                            viewMode === "table"
                                ? "bg-white/[0.08] text-gray-200"
                                : "text-gray-600 hover:text-gray-400"
                        )}
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Expanded filters */}
            {showFilters && (
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <FilterPill
                        active={filters.hasCreator}
                        label="Has Creator"
                        onClick={() =>
                            onFiltersChange({ ...filters, hasCreator: !filters.hasCreator })
                        }
                    />
                    <FilterPill
                        active={filters.hasFees}
                        label="Has Fees"
                        onClick={() =>
                            onFiltersChange({ ...filters, hasFees: !filters.hasFees })
                        }
                    />
                    <FilterPill
                        active={filters.hasClaims}
                        label="Has Claims"
                        onClick={() =>
                            onFiltersChange({ ...filters, hasClaims: !filters.hasClaims })
                        }
                    />
                    <FilterPill
                        active={filters.enrichedOnly}
                        label="With Market Data"
                        onClick={() =>
                            onFiltersChange({ ...filters, enrichedOnly: !filters.enrichedOnly })
                        }
                    />
                    <div className="h-4 w-px bg-white/[0.06] mx-1" />
                    <select
                        value={filters.provider}
                        onChange={(e) =>
                            onFiltersChange({ ...filters, provider: e.target.value })
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]
                       text-xs text-gray-400 focus:outline-none appearance-none cursor-pointer"
                    >
                        <option value="">All Providers</option>
                        <option value="twitter">Twitter / X</option>
                        <option value="tiktok">TikTok</option>
                        <option value="kick">Kick</option>
                        <option value="instagram">Instagram</option>
                        <option value="github">GitHub</option>
                        <option value="moltbook">Moltbook</option>
                        <option value="solana">Solana Wallet</option>
                    </select>
                    {activeCount > 0 && (
                        <button
                            onClick={() =>
                                onFiltersChange({
                                    hasCreator: false,
                                    hasFees: false,
                                    hasClaims: false,
                                    enrichedOnly: false,
                                    provider: "",
                                })
                            }
                            className="ml-auto text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
                        >
                            Clear all
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function FilterPill({
    active,
    label,
    onClick,
}: {
    active: boolean;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border",
                active
                    ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
                    : "bg-white/[0.02] border-white/[0.06] text-gray-500 hover:text-gray-300 hover:border-white/[0.1]"
            )}
        >
            {label}
        </button>
    );
}
