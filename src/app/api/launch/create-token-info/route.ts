export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createTokenInfoSchema } from "@/lib/validators";
import { createTokenInfo } from "@/lib/bags/client";

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
                website: String(form.get("website") ?? ""),
                twitter: String(form.get("twitter") ?? ""),
                telegram: String(form.get("telegram") ?? ""),
            });

            if (image instanceof File && image.size > 0) {
                if (!image.type.startsWith("image/")) {
                    return NextResponse.json(
                        { success: false, error: `Invalid image type: ${image.type}` },
                        { status: 400 }
                    );
                }
                imageFile = image;
            }
        } else {
            const body = await req.json();
            data = createTokenInfoSchema.parse(body);
        }

        const result = await createTokenInfo({
            name: data.name,
            symbol: data.symbol,
            description: data.description,
            image: imageFile,
            imageUrl: data.imageUrl || undefined,
            website: data.website || undefined,
            twitter: data.twitter || undefined,
            telegram: data.telegram || undefined,
        });
        return NextResponse.json({ success: true, data: result });
    } catch (e) {
        console.error("[api/launch/create-token-info] error:", e);
        return NextResponse.json(
            { success: false, error: String(e) },
            { status: 500 }
        );
    }
}
