"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

interface BubbleMapEmbedProps {
    mint: string;
    symbol?: string;
}

const BUBBLEMAPS_BASE_URL = "https://iframe.bubblemaps.io/map";
const BUBBLEMAPS_APP_URL = "https://app.bubblemaps.io/sol/token";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
const CONFIGURED_PARTNER_ID = (process.env.NEXT_PUBLIC_BUBBLEMAPS_PARTNER_ID || "").trim();

function isLocalHostname(hostname: string) {
    return LOCAL_HOSTS.has(hostname) || hostname.endsWith(".local");
}

function getExternalBubbleMapUrl(mint: string) {
    return `${BUBBLEMAPS_APP_URL}/${mint}`;
}

function getResolvedPartnerId(hostname?: string) {
    if (CONFIGURED_PARTNER_ID && CONFIGURED_PARTNER_ID !== "demo") {
        return CONFIGURED_PARTNER_ID;
    }

    if (hostname && isLocalHostname(hostname)) {
        return "demo";
    }

    return "";
}

function getBubbleMapSrc(mint: string, partnerId: string) {
    return `${BUBBLEMAPS_BASE_URL}?chain=solana&address=${encodeURIComponent(mint)}&partnerId=${encodeURIComponent(partnerId)}`;
}

function BubbleMapUnavailable({
    mint,
    symbol,
    compact = false,
}: BubbleMapEmbedProps & { compact?: boolean }) {
    const href = getExternalBubbleMapUrl(mint);
    const hasProductionPartnerId = Boolean(CONFIGURED_PARTNER_ID && CONFIGURED_PARTNER_ID !== "demo");

    return (
        <div className={`overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(141,216,255,0.08),rgba(0,0,0,0.46))] ${compact ? "" : "shadow-[0_0_30px_rgba(141,216,255,0.06)]"}`}>
            <div className={compact ? "p-4" : "p-5 sm:p-6"}>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#8dd8ff]/58">
                    Bubblemap Preview
                </p>
                <h4 className={`mt-3 tracking-[0.1em] text-[#f3fbff] ${compact ? "text-base" : "text-lg"}`}>
                    {symbol ? `$${symbol}` : "Resolved token"} holder map
                </h4>
                <p className={`mt-3 max-w-2xl leading-relaxed tracking-[0.08em] text-[#d8ffe6]/58 ${compact ? "text-[11px]" : "text-[12px]"}`}>
                    {hasProductionPartnerId
                        ? "The embedded map is temporarily unavailable on this pass. You can still open the full Bubblemaps view in a new tab."
                        : "The embedded Bubblemaps view is not unlocked for this live domain yet. Open the full map now, then attach a production partner ID to enable inline viewing."}
                </p>
                <div className={`mt-4 flex flex-wrap gap-2 ${compact ? "" : "sm:mt-5"}`}>
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center border border-[#8dd8ff]/24 bg-[#8dd8ff]/10 px-3 py-2 text-[10px] tracking-[0.16em] text-[#8dd8ff]/82 transition-all hover:border-[#8dd8ff]/38 hover:bg-[#8dd8ff]/16 hover:text-[#d8f6ff]"
                    >
                        OPEN FULL MAP
                    </a>
                    {!hasProductionPartnerId ? (
                        <span className="inline-flex items-center border border-[#00ff41]/14 bg-[#00ff41]/[0.045] px-3 py-2 text-[10px] tracking-[0.16em] text-[#00ff41]/58">
                            COMING SOON
                        </span>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function useBubbleMapRuntime(mint: string) {
    const [iframeReady, setIframeReady] = useState(false);
    const hostname = useSyncExternalStore(
        () => () => undefined,
        () => (typeof window !== "undefined" ? window.location.hostname : ""),
        () => ""
    );

    const partnerId = useMemo(() => getResolvedPartnerId(hostname), [hostname]);
    const src = useMemo(() => (partnerId ? getBubbleMapSrc(mint, partnerId) : ""), [mint, partnerId]);

    return { partnerId, src, iframeReady, setIframeReady };
}

export function BubbleMapEmbed({ mint, symbol }: BubbleMapEmbedProps) {
    const { partnerId, src, iframeReady, setIframeReady } = useBubbleMapRuntime(mint);

    return (
        <div className="crt-panel animate-fade-in overflow-hidden border border-[#00ff41]/14 bg-[linear-gradient(180deg,rgba(0,255,65,0.05),rgba(0,0,0,0))] p-0 shadow-[0_0_36px_rgba(0,255,65,0.08)]">
            <div className="flex flex-col gap-3 border-b border-[#00ff41]/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
                <div className="min-w-0">
                    <div className="panel-header flex items-center gap-2">
                        <span className="text-[#ff4bd8]/70">o</span>
                        <span>HOLDERS BUBBLEMAP</span>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed tracking-[0.08em] text-[#00ff41]/42">
                        Holder clusters and wallet relationships for {symbol ? `$${symbol}` : "this token"} on Solana.
                    </p>
                </div>
                <a
                    href={getExternalBubbleMapUrl(mint)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full shrink-0 border border-[#8dd8ff]/18 bg-[#8dd8ff]/8 px-3 py-2 text-center text-[10px] tracking-[0.16em] text-[#8dd8ff]/75 transition-all hover:border-[#8dd8ff]/35 hover:bg-[#8dd8ff]/12 hover:text-[#8dd8ff] sm:w-auto"
                >
                    OPEN FULL MAP
                </a>
            </div>

            <div className="px-3 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-4">
                {!partnerId ? (
                    <BubbleMapUnavailable mint={mint} symbol={symbol} />
                ) : (
                    <div className="overflow-hidden border border-[#00ff41]/12 bg-[#02070a] shadow-[inset_0_0_0_1px_rgba(0,255,65,0.04),0_0_30px_rgba(0,255,65,0.05)]">
                        {!iframeReady ? (
                            <div className="flex h-[520px] w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(141,216,255,0.12),transparent_45%),linear-gradient(180deg,rgba(0,255,65,0.05),rgba(0,0,0,0.2))] text-[11px] tracking-[0.16em] text-[#8dd8ff]/55 sm:h-[620px] lg:h-[720px] xl:h-[780px]">
                                LOADING BUBBLEMAP SURFACE
                            </div>
                        ) : null}
                        <iframe
                            src={src}
                            title={`Bubblemaps holders map for ${symbol ?? mint}`}
                            className={`h-[520px] w-full border-0 bg-[#02070a] sm:h-[620px] lg:h-[720px] xl:h-[780px] ${iframeReady ? "block" : "hidden"}`}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            allowFullScreen
                            onLoad={() => setIframeReady(true)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export function BubbleMapInline({ mint, symbol }: BubbleMapEmbedProps) {
    const { partnerId, src, iframeReady, setIframeReady } = useBubbleMapRuntime(mint);

    if (!partnerId) {
        return <BubbleMapUnavailable mint={mint} symbol={symbol} compact />;
    }

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
                    href={getExternalBubbleMapUrl(mint)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center border border-[#8dd8ff]/18 bg-[#8dd8ff]/8 px-3 py-2 text-[10px] tracking-[0.16em] text-[#8dd8ff]/78 transition-all hover:border-[#8dd8ff]/35 hover:bg-[#8dd8ff]/12 hover:text-[#8dd8ff]"
                >
                    OPEN FULL MAP
                </a>
            </div>
            <div className="p-3 sm:p-4">
                <div className="overflow-hidden border border-white/8 bg-[#02070a] shadow-[inset_0_0_0_1px_rgba(255,75,216,0.06)]">
                    {!iframeReady ? (
                        <div className="flex h-[320px] w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,75,216,0.12),transparent_45%),linear-gradient(180deg,rgba(141,216,255,0.05),rgba(0,0,0,0.22))] text-[10px] tracking-[0.16em] text-[#ffb3f2]/58 sm:h-[360px]">
                            LOADING HOLDER MAP
                        </div>
                    ) : null}
                    <iframe
                        src={src}
                        title={`Bubblemap for ${symbol ?? mint}`}
                        className={`h-[320px] w-full border-0 bg-[#02070a] sm:h-[360px] ${iframeReady ? "block" : "hidden"}`}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        allowFullScreen
                        onLoad={() => setIframeReady(true)}
                    />
                </div>
            </div>
        </div>
    );
}
