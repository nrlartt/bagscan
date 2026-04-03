export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { createTokenInfoSchema } from "@/lib/validators";
import { createTokenInfo } from "@/lib/bags/client";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const METADATA_DIR = path.join(process.cwd(), "public", "launch-metadata");
const RATE_LIMIT_BACKOFF_MS = 12_000;

let metadataQueue: Promise<void> = Promise.resolve();
let nextMetadataAttemptAt = 0;

function toAbsoluteUrl(req: NextRequest, relativePath: string): string | null {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (!host) return null;

    const proto =
        req.headers.get("x-forwarded-proto") ||
        (process.env.NODE_ENV === "development" ? "http" : "https");

    const safePath = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
    return `${proto}://${host}${safePath}`;
}

async function saveImageLocally(file: File): Promise<string> {
    await mkdir(UPLOAD_DIR, { recursive: true });

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const hash = crypto.randomBytes(12).toString("hex");
    const filename = `${hash}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    return `/uploads/${filename}`;
}

async function saveMetadataLocally(metadata: Record<string, unknown>): Promise<string> {
    await mkdir(METADATA_DIR, { recursive: true });

    const hash = crypto.randomBytes(12).toString("hex");
    const filename = `${hash}.json`;
    const filepath = path.join(METADATA_DIR, filename);

    await writeFile(filepath, JSON.stringify(metadata, null, 2), "utf8");

    return `/launch-metadata/${filename}`;
}

function normalizeSocialLink(value: string | undefined, kind: "twitter" | "telegram") {
    const trimmed = value?.trim();
    if (!trimmed) return undefined;

    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }

    const normalized = trimmed.replace(/^@+/, "").replace(/^\/+/, "");
    if (!normalized) return undefined;

    const base = kind === "twitter" ? "https://x.com/" : "https://t.me/";
    return `${base}${normalized}`;
}

function buildLaunchMetadataJson(input: {
    name: string;
    symbol: string;
    description: string;
    imageUrl?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
}) {
    const metadata: Record<string, unknown> = {
        name: input.name,
        symbol: input.symbol,
        description: input.description,
    };

    if (input.imageUrl) {
        metadata.image = input.imageUrl;
    }

    if (input.website) {
        metadata.external_url = input.website;
        metadata.website = input.website;
    }

    const twitter = normalizeSocialLink(input.twitter, "twitter");
    const telegram = normalizeSocialLink(input.telegram, "telegram");

    const extensions = {
        ...(twitter ? { twitter } : {}),
        ...(telegram ? { telegram } : {}),
        ...(input.website ? { website: input.website } : {}),
    };

    if (Object.keys(extensions).length > 0) {
        metadata.extensions = extensions;
    }

    if (twitter) {
        metadata.twitter = twitter;
    }

    if (telegram) {
        metadata.telegram = telegram;
    }

    return metadata;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function isRateLimitError(error: unknown) {
    return /rate limit|too many requests|status:\s*429|429/i.test(getErrorMessage(error));
}

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withMetadataThrottle<T>(task: () => Promise<T>) {
    const previous = metadataQueue;
    let release!: () => void;
    metadataQueue = new Promise<void>((resolve) => {
        release = resolve;
    });

    await previous;

    const delay = nextMetadataAttemptAt - Date.now();
    if (delay > 0) {
        await wait(delay);
    }

    try {
        return await task();
    } catch (error) {
        if (isRateLimitError(error)) {
            nextMetadataAttemptAt = Date.now() + RATE_LIMIT_BACKOFF_MS;
        }
        throw error;
    } finally {
        release();
    }
}

export async function POST(req: NextRequest) {
    try {
        const contentType = req.headers.get("content-type") || "";

        let data: ReturnType<typeof createTokenInfoSchema.parse>;
        let imageFile: File | undefined;

        if (contentType.includes("multipart/form-data")) {
            const form = await req.formData();
            const image = form.get("image");

            data = createTokenInfoSchema.parse({
                name: String(form.get("name") ?? ""),
                symbol: String(form.get("symbol") ?? ""),
                description: String(form.get("description") ?? ""),
                imageUrl: String(form.get("imageUrl") ?? ""),
                metadataUrl: String(form.get("metadataUrl") ?? ""),
                website: String(form.get("website") ?? ""),
                twitter: String(form.get("twitter") ?? ""),
                telegram: String(form.get("telegram") ?? ""),
            });

            if (image && typeof image !== "string") {
                const file = image as File;
                if (file.size > 0 && !ALLOWED_IMAGE_TYPES.has(file.type)) {
                    return NextResponse.json(
                        { success: false, error: `Invalid image type: ${file.type}. Use PNG, JPG, or WEBP.` },
                        { status: 400 }
                    );
                }
                if (file.size > MAX_IMAGE_BYTES) {
                    return NextResponse.json(
                        { success: false, error: "Image file exceeds 15MB limit." },
                        { status: 400 }
                    );
                }
                if (file.size > 0) imageFile = file;
            }
        } else {
            const body = await req.json();
            data = createTokenInfoSchema.parse(body);
        }

        let hostedImageUrl = data.imageUrl || undefined;

        if (imageFile) {
            const relativePath = await saveImageLocally(imageFile);
            hostedImageUrl = toAbsoluteUrl(req, relativePath) ?? hostedImageUrl;
        }

        let hostedMetadataUrl = data.metadataUrl || undefined;
        if (!hostedMetadataUrl && hostedImageUrl) {
            const relativeMetadataPath = await saveMetadataLocally(
                buildLaunchMetadataJson({
                    name: data.name,
                    symbol: data.symbol,
                    description: data.description,
                    imageUrl: hostedImageUrl,
                    website: data.website || undefined,
                    twitter: data.twitter || undefined,
                    telegram: data.telegram || undefined,
                })
            );
            hostedMetadataUrl = toAbsoluteUrl(req, relativeMetadataPath) ?? undefined;
        }

        const payload = {
            name: data.name,
            symbol: data.symbol,
            description: data.description,
            image: hostedImageUrl ? undefined : imageFile,
            imageUrl: hostedImageUrl,
            metadataUrl: hostedMetadataUrl,
            website: data.website || undefined,
            twitter: data.twitter || undefined,
            telegram: data.telegram || undefined,
        };

        if (!payload.metadataUrl && !payload.imageUrl && !payload.image) {
            throw new Error("USE AN IMAGE FILE, IMAGE URL, OR READY METADATA URL TO PREPARE TOKEN INFO");
        }

        try {
            const result = await withMetadataThrottle(() => createTokenInfo(payload));
            return NextResponse.json({ success: true, data: result });
        } catch (primaryError) {
            if (isRateLimitError(primaryError)) {
                try {
                    const result = await withMetadataThrottle(() => createTokenInfo(payload));
                    return NextResponse.json({ success: true, data: result });
                } catch (retryError) {
                    console.error("[api/launch/create-token-info] rate limit retry failed:", retryError);
                    return NextResponse.json(
                        {
                            success: false,
                            error: "BAGS IS THROTTLING TOKEN METADATA CREATION RIGHT NOW. WAIT A FEW SECONDS AND TRY AGAIN.",
                        },
                        { status: 429 }
                    );
                }
            }

            throw primaryError;
        }
    } catch (e) {
        console.error("[api/launch/create-token-info] error:", e);
        return NextResponse.json(
            {
                success: false,
                error: isRateLimitError(e)
                    ? "BAGS IS THROTTLING TOKEN METADATA CREATION RIGHT NOW. WAIT A FEW SECONDS AND TRY AGAIN."
                    : getErrorMessage(e),
            },
            { status: isRateLimitError(e) ? 429 : 500 }
        );
    }
}
