"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
    ArrowUpRight,
    Bot,
    Cpu,
    Loader2,
    RotateCcw,
    SendHorizontal,
    ShieldCheck,
    Wallet,
} from "lucide-react";
import type { TalkContext, TalkHistoryTurn, TalkReply, TalkResponse, TalkStreamEvent, TalkStreamPhase } from "@/lib/talk/types";
import { cn, shortenAddress } from "@/lib/utils";

type ChatMessage =
    | { id: string; role: "user"; content: string; timestamp: string }
    | { id: string; role: "assistant"; reply: TalkReply; timestamp: string };

interface StreamingAssistantState {
    id: string;
    timestamp: string;
    phase: TalkStreamPhase;
    status: string;
    reply: TalkReply;
}

const DEFAULT_PROMPTS = [
    "Show me the official market board",
    "Show me recent launches on BAGS",
    "Who created $HIVE?",
    "What fees has this token earned?",
    "Show me accepted hackathon projects",
    "How do I launch a token on Bags?",
];

const WELCOME_REPLY: TalkReply = {
    intent: "overview",
    title: "TALK TO BAGS",
    summary:
        "OpenClaw-powered chat grounded only in official BAGS pools, creators, fees, claims, launch, and hackathon data.",
    bullets: [],
    cards: [],
    actions: [],
    suggestions: [],
};

const THINKING_STEPS = [
    "Reading official BAGS feeds",
    "Checking token, creator, and hackathon matches",
    "Writing a cleaner reply",
];

function isExternalHref(href: string) {
    return /^https?:\/\//i.test(href);
}

function formatTimestamp(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function useTypewriter(text: string, enabled: boolean, speed = 16, startDelay = 0) {
    const [display, setDisplay] = useState(enabled ? "" : text);

    useEffect(() => {
        if (!enabled) return;

        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let intervalId: ReturnType<typeof setInterval> | null = null;
        let index = 0;

        timeoutId = setTimeout(() => {
            intervalId = setInterval(() => {
                index += 1;
                setDisplay(text.slice(0, index));
                if (index >= text.length && intervalId) {
                    clearInterval(intervalId);
                }
            }, speed);
        }, startDelay);

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (intervalId) clearInterval(intervalId);
        };
    }, [enabled, speed, startDelay, text]);

    const resolvedDisplay = enabled ? display : text;

    return {
        display: resolvedDisplay,
        done: !enabled || resolvedDisplay.length >= text.length,
    };
}

function createFallbackReply(message: string): TalkReply {
    return {
        intent: "overview",
        title: "TALK TO BAGS OFFLINE",
        summary: "OpenClaw was unavailable for this request, so the chat could not complete cleanly.",
        bullets: [
            message,
            "Try again in a moment or use an official BAGS surface while the route recovers.",
        ],
        cards: [],
        actions: [
            { label: "Open BAGS", href: "https://bags.fm", tone: "info" },
            { label: "Open Hackathon", href: "https://bags.fm/hackathon/apps" },
        ],
        suggestions: DEFAULT_PROMPTS.slice(0, 4),
    };
}

function buildTalkHistory(messages: ChatMessage[]): TalkHistoryTurn[] {
    return messages
        .slice(-6)
        .map((message) =>
            message.role === "user"
                ? {
                    role: "user" as const,
                    content: message.content,
                    timestamp: message.timestamp,
                }
                : {
                    role: "assistant" as const,
                    content: `${message.reply.title}: ${message.reply.summary}`,
                    intent: message.reply.intent,
                    timestamp: message.timestamp,
                }
        );
}

function createStreamingReply(context?: TalkContext): TalkReply {
    return {
        intent: "overview",
        title: "",
        summary: "",
        bullets: [],
        cards: [],
        actions: [],
        suggestions: [],
        context,
    };
}

export function TalkToBagsTerminal() {
    const { connected, publicKey } = useWallet();
    const walletAddress = publicKey?.toBase58() ?? "";
    const [input, setInput] = useState("");
    const [includeWallet, setIncludeWallet] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [talkContext, setTalkContext] = useState<TalkContext | undefined>(WELCOME_REPLY.context);
    const [streamingMessage, setStreamingMessage] = useState<StreamingAssistantState | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: "welcome",
            role: "assistant",
            reply: WELCOME_REPLY,
            timestamp: new Date().toISOString(),
        },
    ]);
    const scrollerRef = useRef<HTMLDivElement | null>(null);

    const activeWallet = connected && includeWallet ? walletAddress : undefined;

    useEffect(() => {
        if (!scrollerRef.current) return;
        scrollerRef.current.scrollTo({
            top: scrollerRef.current.scrollHeight,
            behavior: "smooth",
        });
    }, [messages, isSending, streamingMessage]);

    async function runPrompt(prompt: string) {
        const cleaned = prompt.trim();
        if (!cleaned || isSending) return;

        const now = new Date().toISOString();
        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content: cleaned,
            timestamp: now,
        };
        const nextMessages = [...messages, userMessage];
        setMessages((current) => [...current, userMessage]);
        setStreamingMessage({
            id: `stream-${Date.now()}`,
            timestamp: now,
            phase: "thinking",
            status: "Reading official BAGS feeds",
            reply: createStreamingReply(talkContext),
        });
        setInput("");
        setIsSending(true);

        try {
            const response = await fetch("/api/talk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: cleaned,
                    wallet: activeWallet,
                    context: talkContext,
                    history: buildTalkHistory(nextMessages),
                    stream: true,
                }),
            });

            if (!response.ok || !response.body) {
                const data = (await response.json().catch(() => ({}))) as Partial<TalkResponse> & { error?: string };
                throw new Error(data.error || "Talk to Bags failed to resolve the request.");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let finalReply: TalkReply | null = null;
            let finalTimestamp = new Date().toISOString();

            const applyEvent = (event: TalkStreamEvent) => {
                switch (event.type) {
                    case "status":
                        setStreamingMessage((current) =>
                            current
                                ? {
                                    ...current,
                                    phase: event.phase,
                                    status: event.message,
                                }
                                : current
                        );
                        break;
                    case "reply-start":
                        finalTimestamp = event.generatedAt;
                        setStreamingMessage((current) =>
                            current
                                ? {
                                    ...current,
                                    timestamp: event.generatedAt,
                                    phase: "writing",
                                    status: "Writing the answer",
                                    reply: {
                                        ...current.reply,
                                        intent: event.intent,
                                    },
                                }
                                : current
                        );
                        break;
                    case "title-delta":
                        setStreamingMessage((current) =>
                            current
                                ? {
                                    ...current,
                                    reply: {
                                        ...current.reply,
                                        title: current.reply.title + event.delta,
                                    },
                                }
                                : current
                        );
                        break;
                    case "summary-delta":
                        setStreamingMessage((current) =>
                            current
                                ? {
                                    ...current,
                                    reply: {
                                        ...current.reply,
                                        summary: current.reply.summary + event.delta,
                                    },
                                }
                                : current
                        );
                        break;
                    case "bullet":
                        setStreamingMessage((current) =>
                            current
                                ? {
                                    ...current,
                                    reply: {
                                        ...current.reply,
                                        bullets: [...current.reply.bullets, event.value],
                                    },
                                }
                                : current
                        );
                        break;
                    case "details":
                        setStreamingMessage((current) =>
                            current
                                ? {
                                    ...current,
                                    reply: {
                                        ...current.reply,
                                        cards: event.cards,
                                        actions: event.actions,
                                        suggestions: event.suggestions,
                                        context: event.context ?? current.reply.context,
                                    },
                                }
                                : current
                        );
                        break;
                    case "complete":
                        finalReply = event.reply;
                        finalTimestamp = event.generatedAt;
                        setStreamingMessage((current) =>
                            current
                                ? {
                                    ...current,
                                    timestamp: event.generatedAt,
                                    phase: "complete",
                                    status: "Answer ready",
                                    reply: event.reply,
                                }
                                : current
                        );
                        break;
                    case "error":
                        throw new Error(event.error);
                    case "done":
                    default:
                        break;
                }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    applyEvent(JSON.parse(trimmed) as TalkStreamEvent);
                }
            }

            if (buffer.trim()) {
                applyEvent(JSON.parse(buffer.trim()) as TalkStreamEvent);
            }

            if (!finalReply) {
                throw new Error("Talk to Bags stream ended before the reply completed.");
            }

            const completedReply = finalReply as TalkReply;

            setMessages((current) => [
                ...current,
                {
                    id: `assistant-${Date.now()}`,
                    role: "assistant",
                    reply: completedReply,
                    timestamp: finalTimestamp,
                },
            ]);
            setTalkContext((current) => completedReply.context ?? current);
            setStreamingMessage(null);
        } catch (error) {
            setStreamingMessage(null);
            setMessages((current) => [
                ...current,
                {
                    id: `assistant-error-${Date.now()}`,
                    role: "assistant",
                    reply: createFallbackReply(error instanceof Error ? error.message : "Talk to Bags failed to resolve the request."),
                    timestamp: new Date().toISOString(),
                },
            ]);
        } finally {
            setIsSending(false);
        }
    }

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        void runPrompt(input);
    }

    return (
        <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
            <section className="crt-panel relative overflow-hidden p-6 sm:p-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,255,65,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(0,170,255,0.10),transparent_30%)]" />
                <div className="relative z-[1] grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-5">
                        <div className="flex items-start gap-4">
                            <div className="flex h-14 w-14 items-center justify-center border border-[#00ff41]/25 bg-[#00ff41]/10 shadow-[0_0_28px_rgba(0,255,65,0.16)]">
                                <Bot className="h-7 w-7 text-[#00ff41]" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] uppercase tracking-[0.34em] text-[#00ff41]/55">OpenClaw Session</p>
                                <h1 className="mt-2 text-3xl tracking-[0.16em] text-[#d8ffe6] sm:text-5xl" style={{ textShadow: "0 0 18px rgba(0,255,65,0.18)" }}>
                                    TALK TO BAGS
                                </h1>
                                <p className="mt-4 max-w-3xl text-sm leading-7 text-[#d8ffe6]/72 sm:text-[15px]">
                                    A simpler OpenClaw chat surface for official BAGS answers only. Ask about tokens, creators, fees, claims, hackathon apps, or the launch flow.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2.5">
                            <SessionChip icon={<Cpu className="h-3.5 w-3.5" />} label="OPENCLAW" tone="blue" />
                            <SessionChip icon={<ShieldCheck className="h-3.5 w-3.5" />} label="OFFICIAL BAGS ONLY" tone="green" />
                            <SessionChip
                                icon={<Wallet className="h-3.5 w-3.5" />}
                                label={activeWallet ? `CLAIMS ${shortenAddress(activeWallet, 6)}` : "NO WALLET CONTEXT"}
                                tone={activeWallet ? "green" : "neutral"}
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {DEFAULT_PROMPTS.map((prompt) => (
                                <button
                                    key={prompt}
                                    type="button"
                                    onClick={() => void runPrompt(prompt)}
                                    className="border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] tracking-[0.18em] text-white/60 transition-all hover:border-[#00ff41]/18 hover:bg-[#00ff41]/8 hover:text-[#9dffb8]"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="border border-white/10 bg-black/55 p-5">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-[#00ff41]/48">Session</p>
                        <div className="mt-4 space-y-3">
                            <SessionRow label="Mode" value="OpenClaw + official BAGS context" />
                            <SessionRow label="Scope" value="Pools, creators, fees, claims, hackathon, launch" />
                            <SessionRow label="Wallet" value={activeWallet ? shortenAddress(activeWallet, 6) : "Not included"} />
                        </div>

                        <div className="mt-5 flex flex-col gap-2">
                            {connected ? (
                                <button
                                    type="button"
                                    onClick={() => setIncludeWallet((current) => !current)}
                                    className={cn(
                                        "inline-flex items-center justify-center gap-2 border px-3 py-3 text-[10px] tracking-[0.2em] transition-all",
                                        includeWallet
                                            ? "border-[#00ff41]/25 bg-[#00ff41]/10 text-[#9dffb8]"
                                            : "border-white/10 bg-white/[0.03] text-white/55"
                                    )}
                                >
                                    <Wallet className="h-4 w-4" />
                                    {includeWallet ? "REMOVE WALLET CONTEXT" : "ADD WALLET CONTEXT"}
                                </button>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => {
                                    setStreamingMessage(null);
                                    setMessages([
                                        {
                                            id: "welcome",
                                            role: "assistant",
                                            reply: WELCOME_REPLY,
                                            timestamp: new Date().toISOString(),
                                        },
                                    ]);
                                    setTalkContext(WELCOME_REPLY.context);
                                }}
                                className="inline-flex items-center justify-center gap-2 border border-white/10 bg-white/[0.03] px-3 py-3 text-[10px] tracking-[0.2em] text-white/60 transition-all hover:border-[#00ff41]/18 hover:bg-[#00ff41]/8 hover:text-[#9dffb8]"
                            >
                                <RotateCcw className="h-4 w-4" />
                                RESET SESSION
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <section className="crt-panel mt-6 overflow-hidden">
                <div className="border-b border-[#00ff41]/12 px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.28em] text-[#00ff41]/55">Live Thread</p>
                            <h2 className="mt-1 text-lg tracking-[0.16em] text-[#d8ffe6] sm:text-xl">TALK TO BAGS</h2>
                        </div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/42">
                            Keep prompts direct for the cleanest official answer
                        </p>
                    </div>
                </div>

                <div ref={scrollerRef} className="h-[62vh] min-h-[520px] space-y-4 overflow-y-auto px-4 py-5 pr-3 sm:px-5">
                        {messages.map((message) =>
                            message.role === "user" ? (
                                <div key={message.id} className="ml-auto max-w-2xl border border-[#00ff41]/18 bg-[#00ff41]/8 p-4">
                                    <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.24em] text-[#9dffb8]">
                                        <span>User prompt</span>
                                        <span>{formatTimestamp(message.timestamp)}</span>
                                    </div>
                                    <p className="mt-3 text-sm leading-7 text-[#d8ffe6]">{message.content}</p>
                                </div>
                            ) : (
                                <AssistantBubble
                                    key={message.id}
                                    reply={message.reply}
                                    timestamp={message.timestamp}
                                    onPrompt={runPrompt}
                                    animate={message.id !== "welcome"}
                                />
                            )
                        )}

                        {streamingMessage ? (
                            <StreamingAssistantBubble
                                state={streamingMessage}
                                onPrompt={runPrompt}
                            />
                        ) : null}
                </div>

                <form onSubmit={handleSubmit} className="border-t border-[#00ff41]/12 bg-black/45 px-4 py-5 sm:px-5">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_200px] xl:items-end">
                        <div>
                        <label className="block text-[11px] uppercase tracking-[0.24em] text-[#00ff41]/52">Prompt</label>
                        <textarea
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    void runPrompt(input);
                                }
                            }}
                            rows={4}
                            placeholder="Ask OpenClaw about the official market board, a token creator, claimable fees, hackathon apps, or the launch flow..."
                            className="mt-3 w-full resize-none border border-[#00ff41]/15 bg-black/60 px-4 py-3 text-sm leading-7 text-[#d8ffe6] placeholder:text-[#00ff41]/18 focus:border-[#00ff41]/38 focus:outline-none focus:shadow-[0_0_12px_rgba(0,255,65,0.08)]"
                        />
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                type="submit"
                                disabled={!input.trim() || isSending}
                                className="inline-flex min-h-[56px] items-center justify-center gap-2 border border-[#00ff41]/25 bg-[#00ff41]/10 px-4 py-3 text-[11px] tracking-[0.24em] text-[#9dffb8] transition-all hover:bg-[#00ff41]/16 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                                ASK OPENCLAW
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-white/40">
                        <span>OpenClaw answers stay inside official BAGS data.</span>
                        <span>Use a mint, token name, or $symbol for the cleanest lookup.</span>
                    </div>
                </form>
            </section>
        </div>
    );
}

function StreamingAssistantBubble({
    state,
    onPrompt,
}: {
    state: StreamingAssistantState;
    onPrompt: (prompt: string) => Promise<void>;
}) {
    const [stepIndex, setStepIndex] = useState(0);

    useEffect(() => {
        if (state.phase === "writing" || state.phase === "complete") return;
        const intervalId = setInterval(() => {
            setStepIndex((current) => (current + 1) % THINKING_STEPS.length);
        }, 1150);
        return () => clearInterval(intervalId);
    }, [state.phase]);

    const isWriting = state.phase === "writing";
    const isReady = state.phase === "complete";
    const hasDetails = state.reply.cards.length > 0 || state.reply.actions.length > 0;

    return (
        <div className="border border-[#00ff41]/12 bg-black/55 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-[0.24em] text-[#00ff41]/48">
                <span className="inline-flex items-center gap-2">
                    <Bot className="h-4 w-4 text-[#00ff41]" />
                    Bags response // {state.reply.intent.toUpperCase()}
                </span>
                <span>{formatTimestamp(state.timestamp)}</span>
            </div>

            <div className="mt-4 space-y-4">
                {!state.reply.title ? (
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#00ff41]/52">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {state.status}
                        </div>
                        <p className="text-sm leading-7 text-[#d8ffe6]/62">{THINKING_STEPS[stepIndex]}</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-3">
                            <h3 className="text-lg tracking-[0.14em] text-[#d8ffe6] sm:text-xl">
                                {state.reply.title}
                                {!isReady ? <span className="ml-1 inline-block h-5 w-[2px] animate-pulse bg-[#00ff41]/85 align-middle" /> : null}
                            </h3>
                            <p className="text-sm leading-7 text-[#d8ffe6]/72">
                                {state.reply.summary}
                                {isWriting ? <span className="ml-1 inline-block h-4 w-[2px] animate-pulse bg-[#00ff41]/75 align-middle" /> : null}
                            </p>
                        </div>

                        {!isReady ? (
                            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#00ff41]/44">
                                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#00ff41]/80" />
                                {state.status}
                            </div>
                        ) : null}

                        {state.reply.bullets.length > 0 ? (
                            <div className="space-y-2">
                                {state.reply.bullets.map((bullet) => (
                                    <div key={bullet} className="flex gap-3 text-sm leading-7 text-[#d8ffe6]/62">
                                        <span className="mt-[10px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#00ff41]/75" />
                                        <span>{bullet}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        {hasDetails ? (
                            <div className="border-t border-[#00ff41]/10 pt-4">
                                <div className="inline-flex items-center gap-2 border border-[#00ff41]/15 bg-[#00ff41]/[0.04] px-3 py-2 text-[10px] tracking-[0.2em] text-[#9dffb8]/85">
                                    {isReady ? "VERIFIED DETAILS READY" : "DETAILS LOADING"}
                                </div>
                            </div>
                        ) : null}

                        {isReady && state.reply.suggestions.length > 0 ? (
                            <div className="border-t border-[#00ff41]/10 pt-4">
                                <p className="text-[10px] uppercase tracking-[0.22em] text-[#00ff41]/42">Try next</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {state.reply.suggestions.map((suggestion) => (
                                        <button
                                            key={suggestion}
                                            type="button"
                                            onClick={() => void onPrompt(suggestion)}
                                            className="border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] tracking-[0.18em] text-white/60 transition-all hover:border-[#00ff41]/18 hover:bg-[#00ff41]/8 hover:text-[#9dffb8]"
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
}

function AssistantBubble({
    reply,
    timestamp,
    onPrompt,
    animate,
}: {
    reply: TalkReply;
    timestamp: string;
    onPrompt: (prompt: string) => Promise<void>;
    animate?: boolean;
}) {
    const shouldAnimate = Boolean(animate);
    const isClarifier = reply.title === "WHICH TOKEN?" || reply.title === "TOKEN NOT FOUND" || reply.title === "OFFICIAL TOKEN NOT FOUND";
    const titleTyping = useTypewriter(reply.title, shouldAnimate, 18, 0);
    const summaryTyping = useTypewriter(reply.summary, shouldAnimate, 11, shouldAnimate ? Math.max(180, reply.title.length * 18 * 0.55) : 0);
    const [visibleBullets, setVisibleBullets] = useState(shouldAnimate ? 0 : reply.bullets.length);
    const [detailsReady, setDetailsReady] = useState(!shouldAnimate);
    const [detailsOpen, setDetailsOpen] = useState(false);

    useEffect(() => {
        if (!shouldAnimate) return;

        if (!summaryTyping.done) {
            return;
        }

        if (reply.bullets.length === 0) {
            const timeoutId = setTimeout(() => setDetailsReady(true), 180);
            return () => clearTimeout(timeoutId);
        }

        let revealed = 0;
        const intervalId = setInterval(() => {
            revealed += 1;
            setVisibleBullets(Math.min(revealed, reply.bullets.length));
            if (revealed >= reply.bullets.length) {
                clearInterval(intervalId);
                setTimeout(() => setDetailsReady(true), 160);
            }
        }, 180);

        return () => clearInterval(intervalId);
    }, [reply.bullets.length, shouldAnimate, summaryTyping.done]);

    const visibleSuggestions = reply.suggestions.slice(0, isClarifier ? 3 : 4);
    const hasDetailBlock = reply.cards.length > 0 || reply.actions.length > 0;
    const showWriterHint = shouldAnimate && (!summaryTyping.done || visibleBullets < reply.bullets.length);

    return (
        <div className={cn("border border-[#00ff41]/12 bg-black/55 p-4 sm:p-5", isClarifier && "bg-[#021107]/90")}>
            <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-[0.24em] text-[#00ff41]/48">
                <span className="inline-flex items-center gap-2">
                    <Bot className="h-4 w-4 text-[#00ff41]" />
                    Bags response // {reply.intent.toUpperCase()}
                </span>
                <span>{formatTimestamp(timestamp)}</span>
            </div>

            <div className="mt-4 space-y-4">
                <div className="space-y-3">
                    <h3 className="text-lg tracking-[0.14em] text-[#d8ffe6] sm:text-xl">
                        {titleTyping.display}
                        {shouldAnimate && !titleTyping.done ? <span className="ml-1 inline-block h-5 w-[2px] animate-pulse bg-[#00ff41]/85 align-middle" /> : null}
                    </h3>
                    <p className={cn("text-sm leading-7 text-[#d8ffe6]/72", isClarifier && "max-w-3xl text-[#d8ffe6]/78")}>
                        {summaryTyping.display}
                        {shouldAnimate && titleTyping.done && !summaryTyping.done ? <span className="ml-1 inline-block h-4 w-[2px] animate-pulse bg-[#00ff41]/75 align-middle" /> : null}
                    </p>
                </div>

                {showWriterHint ? (
                    <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#00ff41]/44">
                        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#00ff41]/80" />
                        Writing response
                    </div>
                ) : null}

                {reply.bullets.length > 0 ? (
                    <div className="space-y-2">
                        {reply.bullets.slice(0, visibleBullets).map((bullet) => (
                            <div key={bullet} className="flex gap-3 text-sm leading-7 text-[#d8ffe6]/62">
                                <span className="mt-[10px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#00ff41]/75" />
                                <span>{bullet}</span>
                            </div>
                        ))}
                    </div>
                ) : null}

                {detailsReady && hasDetailBlock ? (
                    <div className="border-t border-[#00ff41]/10 pt-4">
                        <button
                            type="button"
                            onClick={() => setDetailsOpen((current) => !current)}
                            className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] tracking-[0.2em] text-white/60 transition-all hover:border-[#00ff41]/18 hover:bg-[#00ff41]/8 hover:text-[#9dffb8]"
                        >
                            {detailsOpen ? "HIDE VERIFIED DETAILS" : "SHOW VERIFIED DETAILS"}
                        </button>

                        {detailsOpen ? (
                            <div className="mt-4 space-y-4">
                                {reply.cards.length > 0 ? (
                                    <div className="grid gap-3 lg:grid-cols-2 stagger-children">
                                        {reply.cards.map((card) => (
                                            <ResultCard key={card.id} card={card} />
                                        ))}
                                    </div>
                                ) : null}

                                {reply.actions.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {reply.actions.map((action) => (
                                            <ActionLink key={action.label} action={action} />
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {detailsReady && visibleSuggestions.length > 0 ? (
                    <div className="border-t border-[#00ff41]/10 pt-4">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-[#00ff41]/42">
                            {isClarifier ? "Try a cleaner lookup" : "Try next"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {visibleSuggestions.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => void onPrompt(suggestion)}
                                    className="border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] tracking-[0.18em] text-white/60 transition-all hover:border-[#00ff41]/18 hover:bg-[#00ff41]/8 hover:text-[#9dffb8]"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function ResultCard({ card }: { card: TalkReply["cards"][number] }) {
    const content = (
        <div className="border border-white/10 bg-black/60 p-4 transition-all hover:border-[#00ff41]/22 hover:bg-[#00ff41]/[0.03]">
            <div className="flex items-start justify-between gap-3">
                <div>
                    {card.eyebrow ? <p className="text-[10px] uppercase tracking-[0.22em] text-[#00ff41]/48">{card.eyebrow}</p> : null}
                    <h4 className="mt-2 text-base tracking-[0.1em] text-[#d8ffe6]">{card.title}</h4>
                    {card.subtitle ? <p className="mt-1 text-[11px] tracking-[0.18em] text-[#00ff41]/46">{card.subtitle}</p> : null}
                </div>
                {card.href ? <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-[#8dd8ff]" /> : null}
            </div>

            {card.description ? <p className="mt-3 text-sm leading-6 text-[#d8ffe6]/62">{card.description}</p> : null}

            {card.metrics && card.metrics.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                    {card.metrics.map((item) => (
                        <div key={`${card.id}-${item.label}`} className="border border-[#00ff41]/10 bg-black/45 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[#00ff41]/34">{item.label}</p>
                            <p
                                className={cn(
                                    "mt-1 text-sm tracking-[0.08em]",
                                    item.tone === "positive" && "text-[#9dffb8]",
                                    item.tone === "negative" && "text-[#ff8f70]",
                                    item.tone === "warning" && "text-[#ffd37a]",
                                    item.tone === "info" && "text-[#8dd8ff]",
                                    (!item.tone || item.tone === "default") && "text-[#d8ffe6]/82"
                                )}
                            >
                                {item.value}
                            </p>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );

    if (!card.href) {
        return content;
    }

    return isExternalHref(card.href) ? (
        <a href={card.href} target="_blank" rel="noopener noreferrer">
            {content}
        </a>
    ) : (
        <Link href={card.href}>{content}</Link>
    );
}

function ActionLink({
    action,
    compact = false,
}: {
    action: TalkReply["actions"][number];
    compact?: boolean;
}) {
    const className = cn(
        "inline-flex items-center justify-center gap-2 border px-3 py-2 text-[10px] tracking-[0.2em] transition-all",
        action.tone === "info" && "border-[#00aaff]/22 bg-[#00aaff]/10 text-[#8dd8ff] hover:bg-[#00aaff]/16",
        action.tone === "warning" && "border-[#ffaa00]/22 bg-[#ffaa00]/10 text-[#ffd37a] hover:bg-[#ffaa00]/16",
        (!action.tone || action.tone === "default") && "border-[#00ff41]/20 bg-[#00ff41]/8 text-[#9dffb8] hover:bg-[#00ff41]/14",
        compact && "w-full"
    );

    const content = (
        <span className={className}>
            {action.label}
            <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
    );

    return isExternalHref(action.href) ? (
        <a href={action.href} target="_blank" rel="noopener noreferrer">
            {content}
        </a>
    ) : (
        <Link href={action.href}>{content}</Link>
    );
}

function SessionChip({
    icon,
    label,
    tone,
}: {
    icon: ReactNode;
    label: string;
    tone: "green" | "blue" | "neutral";
}) {
    return (
        <div
            className={cn(
                "inline-flex items-center gap-2 border px-3 py-2 text-[11px] tracking-[0.18em]",
                tone === "green" && "border-[#00ff41]/20 bg-[#00ff41]/10 text-[#9dffb8]",
                tone === "blue" && "border-[#00aaff]/20 bg-[#00aaff]/10 text-[#8dd8ff]",
                tone === "neutral" && "border-white/10 bg-white/[0.03] text-white/60"
            )}
        >
            {icon}
            {label}
        </div>
    );
}

function SessionRow({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="border border-[#00ff41]/10 bg-[#00ff41]/[0.03] px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#00ff41]/40">{label}</p>
            <p className="mt-1 text-sm tracking-[0.12em] text-[#d8ffe6]/82">{value}</p>
        </div>
    );
}
