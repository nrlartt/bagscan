import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateTalkReply } from "@/lib/talk/service";
import type { TalkResponse, TalkReply, TalkStreamEvent } from "@/lib/talk/types";

const talkIntentSchema = z.enum(["overview", "market", "spotlight", "new-launches", "hackathon", "leaderboard", "token", "portfolio", "launch", "alerts", "trade"]);

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const talkBodySchema = z.object({
    message: z.string().trim().min(1).max(1200),
    wallet: z.string().trim().optional().or(z.literal("")),
    context: z.object({
        activeTokenMint: z.string().trim().optional(),
        activeTokenName: z.string().trim().optional(),
        activeTokenSymbol: z.string().trim().optional(),
        lastIntent: talkIntentSchema.optional(),
    }).optional(),
    history: z.array(
        z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string().trim().min(1).max(900),
            intent: talkIntentSchema.optional(),
            timestamp: z.string().trim().optional(),
        })
    ).max(8).optional(),
    stream: z.boolean().optional(),
});

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkText(text: string, maxChunkLength: number) {
    if (!text.trim()) return [];
    const parts = text.split(/(\s+)/).filter(Boolean);
    const chunks: string[] = [];
    let current = "";

    for (const part of parts) {
        if (!current) {
            current = part;
            continue;
        }

        if ((current + part).length > maxChunkLength) {
            chunks.push(current);
            current = part;
            continue;
        }

        current += part;
    }

    if (current) chunks.push(current);
    return chunks;
}

function streamReply(reply: TalkReply, generatedAt: string) {
    const encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
        start(controller) {
            const send = (event: TalkStreamEvent) => {
                controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
            };

            const close = () => controller.close();

            void (async () => {
                try {
                    send({ type: "status", phase: "writing", message: "Writing the answer" });
                    await wait(140);

                    send({ type: "reply-start", intent: reply.intent, generatedAt });

                    for (const chunk of chunkText(reply.title, 12)) {
                        send({ type: "title-delta", delta: chunk });
                        await wait(24);
                    }

                    await wait(90);

                    for (const chunk of chunkText(reply.summary, 28)) {
                        send({ type: "summary-delta", delta: chunk });
                        await wait(20);
                    }

                    await wait(90);

                    for (const bullet of reply.bullets) {
                        send({ type: "bullet", value: bullet });
                        await wait(120);
                    }

                    send({
                        type: "details",
                        cards: reply.cards,
                        actions: reply.actions,
                        suggestions: reply.suggestions,
                        context: reply.context,
                    });

                    await wait(60);

                    send({ type: "complete", reply, generatedAt });
                    send({ type: "done" });
                    close();
                } catch (error) {
                    send({
                        type: "error",
                        error: error instanceof Error ? error.message : "Talk to Bags streaming failed.",
                    });
                    close();
                }
            })();
        },
    });
}

export async function POST(req: NextRequest) {
    try {
        const json = await req.json();
        const body = talkBodySchema.parse(json);
        if (body.stream) {
            const encoder = new TextEncoder();
            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
                    const send = (event: TalkStreamEvent) => {
                        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
                    };

                    const close = () => controller.close();

                    void (async () => {
                        try {
                            send({ type: "status", phase: "thinking", message: "Reading official BAGS feeds" });
                            await wait(220);
                            send({ type: "status", phase: "grounding", message: "Checking token, creator, and hackathon matches" });

                            const reply = await generateTalkReply(body.message, body.wallet || undefined, body.context, body.history);
                            const generatedAt = new Date().toISOString();
                            const replyStream = streamReply(reply, generatedAt);
                            const reader = replyStream.getReader();

                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                if (value) controller.enqueue(value);
                            }

                            close();
                        } catch (error) {
                            console.error("[api/talk] stream error:", error);
                            send({
                                type: "error",
                                error: "Talk to Bags is temporarily unavailable.",
                            });
                            close();
                        }
                    })();
                },
            });

            return new Response(stream, {
                headers: {
                    "Content-Type": "application/x-ndjson; charset=utf-8",
                    "Cache-Control": "no-store",
                    Connection: "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            });
        }

        const reply = await generateTalkReply(body.message, body.wallet || undefined, body.context, body.history);

        const response: TalkResponse = {
            reply,
            generatedAt: new Date().toISOString(),
        };

        return NextResponse.json(response, {
            headers: {
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("[api/talk] error:", error);
        return NextResponse.json(
            {
                error: "Talk to Bags is temporarily unavailable.",
            },
            { status: 500 }
        );
    }
}
