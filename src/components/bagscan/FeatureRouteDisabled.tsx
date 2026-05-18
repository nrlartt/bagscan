import Link from "next/link";

type FeatureRouteDisabledProps = {
    title: string;
    moduleId: string;
};

export function FeatureRouteDisabled({ title, moduleId }: FeatureRouteDisabledProps) {
    return (
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="crt-panel relative overflow-hidden p-6 sm:p-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,255,65,0.08),transparent_40%)]" />
                <div className="relative z-[1] space-y-6">
                    <div className="flex items-center gap-3 border-b border-[#00ff41]/15 pb-4">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-[#ffaa00] shadow-[0_0_12px_rgba(255,170,0,0.45)]" />
                        <span className="text-[11px] tracking-[0.28em] text-[#00ff41]/55">ROUTE SUSPENDED</span>
                    </div>

                    <h1
                        className="text-2xl tracking-[0.2em] text-[#d8ffe6] sm:text-3xl"
                        style={{ textShadow: "0 0 14px rgba(0,255,65,0.15)" }}
                    >
                        {title}
                    </h1>

                    <div className="border border-[#00ff41]/12 bg-black/50 p-4 text-[11px] leading-6 tracking-[0.14em] text-[#00ff41]/72">
                        <p className="whitespace-pre-wrap">{`> STATUS: OFFLINE
> MODULE: ${moduleId}
> REASON: PRODUCT FOCUS — CORE DISCOVERY + LAUNCH

This surface is temporarily disabled. Backend routes may remain for internal use; the public UI is paused.`}</p>
                    </div>

                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 border border-[#00ff41]/30 bg-[#00ff41]/10 px-4 py-2.5 text-xs tracking-[0.2em] text-[#9dffb8] transition-colors hover:border-[#00ff41]/50 hover:bg-[#00ff41]/14"
                    >
                        RETURN TO DISCOVER
                    </Link>
                </div>
            </div>
        </div>
    );
}
