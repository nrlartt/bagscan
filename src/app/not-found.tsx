import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
    return (
        <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00C805]/20 bg-[#00C805]/[0.05]">
                <Compass className="h-6 w-6 text-[#00C805]/70" />
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white/90">404</h1>
            <p className="mt-1 text-sm tracking-[0.16em] text-white/55">PAGE NOT FOUND</p>
            <p className="mt-3 text-[11px] leading-relaxed text-white/35">
                That route does not exist. Token pages live at{" "}
                <code>/token/&lt;0x-address&gt;</code> for Robinhood Chain contracts.
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
