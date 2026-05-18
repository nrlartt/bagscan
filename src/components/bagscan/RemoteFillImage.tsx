"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { normalizeRemoteImageUrl } from "@/lib/media/normalizeRemoteImageUrl";
import { cn } from "@/lib/utils";

/** Default for 1–4 column responsive token grids on the home feed. */
export const REMOTE_IMAGE_SIZES_GRID =
    "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw";

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
    quality = 82,
    fallback,
}: RemoteFillImageProps) {
    const normalized = normalizeRemoteImageUrl(src);
    const isClientLocal =
        Boolean(normalized) &&
        (normalized!.startsWith("blob:") || normalized!.startsWith("data:"));
    const [mode, setMode] = useState<LoadMode>(isClientLocal ? "direct" : "optimized");

    useEffect(() => {
        const local =
            Boolean(normalized) &&
            (normalized!.startsWith("blob:") || normalized!.startsWith("data:"));
        setMode(local ? "direct" : "optimized");
    }, [normalized]);

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
            onError={onOptimizedError}
        />
    );
}
