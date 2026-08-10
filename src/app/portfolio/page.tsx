"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RhPortfolioView } from "@/components/bagscan/RhPortfolioView";

/** `useSearchParams` needs a Suspense boundary for this statically shipped route. */
export default function PortfolioPage() {
    return (
        <Suspense
            fallback={
                <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
                    <div className="h-40 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
                </div>
            }
        >
            <PortfolioBody />
        </Suspense>
    );
}

function PortfolioBody() {
    const searchParams = useSearchParams();
    return <RhPortfolioView walletParam={searchParams.get("wallet")?.trim() ?? ""} />;
}
