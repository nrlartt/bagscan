"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Route-level boundary: keeps a failing board from blanking the whole terminal
 * and gives the user a retry that re-runs the segment's data fetching.
 */
export default function RouteError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[bagscan] route error", error);
    }, [error]);

    return (
        <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#ff5f5f]/25 bg-[#ff5f5f]/[0.06]">
                <AlertTriangle className="h-6 w-6 text-[#ff5f5f]/70" />
            </div>
            <h1 className="mt-5 text-sm tracking-[0.18em] text-white/80">SOMETHING BROKE</h1>
            <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                This surface failed to render. The rest of BagScan is still live — retry, or head back to
                Discover.
            </p>
            {error.digest ? (
                <code className="mt-3 rounded-lg bg-white/[0.04] px-2 py-1 font-mono text-[10px] text-white/30">
                    ref {error.digest}
                </code>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#20e3b2] px-4 py-2.5 text-[10px] font-semibold tracking-[0.16em] text-black transition-opacity hover:opacity-90"
                >
                    <RotateCw className="h-3.5 w-3.5" />
                    RETRY
                </button>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-4 py-2.5 text-[10px] tracking-[0.16em] text-white/55 transition-colors hover:border-[#20e3b2]/35 hover:text-[#20e3b2]"
                >
                    BACK TO DISCOVER
                </Link>
            </div>
        </div>
    );
}
