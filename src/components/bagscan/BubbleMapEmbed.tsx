"use client";

interface BubbleMapEmbedProps {
    mint: string;
    symbol?: string;
}

const BUBBLEMAPS_BASE_URL = "https://iframe.bubblemaps.io/map";

function getBubbleMapSrc(mint: string) {
    const partnerId = process.env.NEXT_PUBLIC_BUBBLEMAPS_PARTNER_ID || "demo";
    return `${BUBBLEMAPS_BASE_URL}?chain=solana&address=${encodeURIComponent(mint)}&partnerId=${encodeURIComponent(partnerId)}`;
}

export function BubbleMapEmbed({ mint, symbol }: BubbleMapEmbedProps) {
    const src = getBubbleMapSrc(mint);

    return (
        <div className="crt-panel animate-fade-in overflow-hidden border border-[#00ff41]/14 bg-[linear-gradient(180deg,rgba(0,255,65,0.05),rgba(0,0,0,0))] p-0 shadow-[0_0_36px_rgba(0,255,65,0.08)]">
            <div className="flex flex-col gap-3 border-b border-[#00ff41]/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
                <div className="min-w-0">
                    <div className="panel-header flex items-center gap-2">
                        <span className="text-[#ff4bd8]/70">◎</span>
                        <span>╔══ HOLDERS BUBBLEMAP ══╗</span>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed tracking-[0.08em] text-[#00ff41]/42">
                        Holder clusters and wallet relationships for {symbol ? `$${symbol}` : "this token"} on Solana.
                    </p>
                </div>
                <a
                    href={`https://app.bubblemaps.io/sol/token/${mint}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full shrink-0 border border-[#8dd8ff]/18 bg-[#8dd8ff]/8 px-3 py-2 text-center text-[10px] tracking-[0.16em] text-[#8dd8ff]/75 transition-all hover:border-[#8dd8ff]/35 hover:bg-[#8dd8ff]/12 hover:text-[#8dd8ff] sm:w-auto"
                >
                    OPEN FULL MAP ↗
                </a>
            </div>

            <div className="px-3 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-4">
                <div className="overflow-hidden border border-[#00ff41]/12 bg-[#02070a] shadow-[inset_0_0_0_1px_rgba(0,255,65,0.04),0_0_30px_rgba(0,255,65,0.05)]">
                    <iframe
                        src={src}
                        title={`Bubblemaps holders map for ${symbol ?? mint}`}
                        className="h-[520px] w-full border-0 bg-[#02070a] sm:h-[620px] lg:h-[720px] xl:h-[780px]"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        allowFullScreen
                    />
                </div>
            </div>
        </div>
    );
}

export function BubbleMapInline({ mint, symbol }: BubbleMapEmbedProps) {
    const src = getBubbleMapSrc(mint);

    return (
        <div className="overflow-hidden border border-[#ff4bd8]/18 bg-[linear-gradient(180deg,rgba(255,75,216,0.08),rgba(0,0,0,0.4))]">
            <div className="flex flex-col gap-3 border-b border-[#ff4bd8]/12 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#ff9aee]/58">Holder Bubblemap</p>
                    <h4 className="mt-2 text-base tracking-[0.1em] text-[#f8e7ff]">
                        {symbol ? `$${symbol}` : "Resolved token"} holder view
                    </h4>
                </div>
                <a
                    href={`https://app.bubblemaps.io/sol/token/${mint}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center border border-[#8dd8ff]/18 bg-[#8dd8ff]/8 px-3 py-2 text-[10px] tracking-[0.16em] text-[#8dd8ff]/78 transition-all hover:border-[#8dd8ff]/35 hover:bg-[#8dd8ff]/12 hover:text-[#8dd8ff]"
                >
                    OPEN FULL MAP ↗
                </a>
            </div>
            <div className="p-3 sm:p-4">
                <div className="overflow-hidden border border-white/8 bg-[#02070a] shadow-[inset_0_0_0_1px_rgba(255,75,216,0.06)]">
                    <iframe
                        src={src}
                        title={`Bubblemap for ${symbol ?? mint}`}
                        className="h-[320px] w-full border-0 bg-[#02070a] sm:h-[360px]"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        allowFullScreen
                    />
                </div>
            </div>
        </div>
    );
}
