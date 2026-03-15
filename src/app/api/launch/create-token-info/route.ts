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

        const payload = {
            name: data.name,
            symbol: data.symbol,
            description: data.description,
            image: imageFile,
            imageUrl: data.imageUrl || undefined,
            metadataUrl: data.metadataUrl || undefined,
            website: data.website || undefined,
            twitter: data.twitter || undefined,
            telegram: data.telegram || undefined,
        };

        try {
            const result = await createTokenInfo(payload);
            return NextResponse.json({ success: true, data: result });
        } catch (primaryError) {
            // Fallback path: if direct file upload fails, host the image temporarily and retry via public URL.
            if (imageFile) {
                try {
                    const relativePath = await saveImageLocally(imageFile);
                    const hostedUrl = toAbsoluteUrl(req, relativePath);

                    if (hostedUrl) {
                        const fallbackResult = await createTokenInfo({
                            ...payload,
                            image: undefined,
                            imageUrl: hostedUrl,
                        });
                        return NextResponse.json({ success: true, data: fallbackResult });
                    }
                } catch (fallbackError) {
                    console.error("[api/launch/create-token-info] fallback upload error:", fallbackError);
                }
            }

            throw primaryError;
        }
    } catch (e) {
        console.error("[api/launch/create-token-info] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}
