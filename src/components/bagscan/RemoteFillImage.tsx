"use client";

import Image from "next/image";
import { useCallback, useState, type ReactNode } from "react";
import { normalizeRemoteImageUrl } from "@/lib/media/normalizeRemoteImageUrl";
import { cn } from "@/lib/utils";

/**
 * Home explore feed cards: `grid-cols-1` below `sm`, then 2–4 columns.
 */
export const REMOTE_IMAGE_SIZES_GRID =
    "(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1535px) 33vw, 25vw";

/** 2-column grids (e.g. featured hero on Bags) through `lg`. */
export const REMOTE_IMAGE_SIZES_GRID_2COL =
    "(max-width: 1023px) 50vw, (max-width: 1535px) 33vw, 25vw";

type LoadMode = "optimized" | "direct" | "failed";

type RemoteFillImageProps = {
    src: string | null | undefined;
    alt: string;
    className?: string;
    sizes: string;
    priority?: boolean;
    quality?: number;
    /** Shown when URL is missing or every load strategy fails. */
    fallback: ReactNode;
};

const imgFillClass = "absolute inset-0 h-full w-full object-cover";

/**
 * Token art: try Next.js optimizer first (smaller AVIF/WebP), then plain &lt;img&gt;
 * so browser hits IPFS/metadata CDNs directly when the image server cannot.
 * Parent must be `position: relative` with explicit dimensions for fill layout.
 */
export function RemoteFillImage({
    src,
    alt,
    className,
    sizes,
    priority = false,
    quality = 72,
    fallback,
}: RemoteFillImageProps) {
    const normalized = normalizeRemoteImageUrl(src);
    const isClientLocal =
        Boolean(normalized) &&
        (normalized!.startsWith("blob:") || normalized!.startsWith("data:"));
    const [mode, setMode] = useState<LoadMode>(isClientLocal ? "direct" : "optimized");

    // A new URL restarts the optimized → direct → fallback ladder. Adjusting during
    // render (instead of in an effect) avoids painting the previous image's state.
    const [lastSrc, setLastSrc] = useState(normalized);
    if (lastSrc !== normalized) {
        setLastSrc(normalized);
        setMode(isClientLocal ? "direct" : "optimized");
    }

    const onOptimizedError = useCallback(() => setMode("direct"), []);
    const onDirectError = useCallback(() => setMode("failed"), []);

    if (!normalized || mode === "failed") {
        return <>{fallback}</>;
    }

    if (mode === "direct") {
        return (
            // eslint-disable-next-line @next/next/no-img-element -- intentional fallback when /_next/image cannot fetch URL server-side
            <img
                src={normalized}
                alt={alt}
                className={cn(imgFillClass, className)}
                loading={priority ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={priority ? "high" : "auto"}
                referrerPolicy="no-referrer"
                onError={onDirectError}
            />
        );
    }

    return (
        <Image
            src={normalized}
            alt={alt}
            fill
            sizes={sizes}
            className={cn("object-cover", className)}
            priority={priority}
            quality={quality}
            fetchPriority={priority ? "high" : "low"}
            onError={onOptimizedError}
        />
    );
}
