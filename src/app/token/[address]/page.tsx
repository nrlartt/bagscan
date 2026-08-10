"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { RhTokenDetailView } from "@/components/bagscan/RhTokenDetailView";
import { isEvmAddress } from "@/lib/rh/chain";

export default function TokenDetailPage() {
    const params = useParams();
    const address = typeof params.address === "string" ? params.address : "";

    if (!isEvmAddress(address)) {
        return (
            <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-6 text-center">
                <h1 className="text-sm tracking-[0.18em] text-white/80">NOT A ROBINHOOD TOKEN</h1>
                <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                    Robinhood Chain contracts are EVM addresses — 42 characters starting with{" "}
                    <code className="text-[#00C805]/70">0x</code>. This route was given{" "}
                    <code className="break-all text-white/55">{address || "nothing"}</code>.
                </p>
                <Link
                    href="/"
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#00C805] px-4 py-2.5 text-[10px] font-semibold tracking-[0.16em] text-black transition-opacity hover:opacity-90"
                >
                    BACK TO DISCOVER
                </Link>
            </div>
        );
    }

    return <RhTokenDetailView address={address} />;
}
