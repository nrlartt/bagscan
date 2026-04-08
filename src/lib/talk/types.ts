export interface TalkMetric {
    label: string;
    value: string;
    tone?: "default" | "positive" | "negative" | "info" | "warning";
}

export interface TalkCard {
    id: string;
    kind?: "default" | "bubblemap";
    title: string;
    subtitle?: string;
    eyebrow?: string;
    description?: string;
    href?: string;
    metrics?: TalkMetric[];
    mint?: string;
    symbol?: string;
}

export interface TalkAction {
    label: string;
    href: string;
    tone?: "default" | "info" | "warning";
}

export type TalkIntent =
    | "overview"
    | "docs"
    | "market"
    | "spotlight"
    | "new-launches"
    | "hackathon"
    | "leaderboard"
    | "token"
    | "portfolio"
    | "launch"
    | "alerts"
    | "trade";

export interface TalkContext {
    activeTokenMint?: string;
    activeTokenName?: string;
    activeTokenSymbol?: string;
    lastIntent?: TalkIntent;
}

export interface TalkAccessState {
    wallet: string;
    eligible: boolean;
    mint: string;
    balanceUi: string;
    requiredUi: string;
    shortfallUi: string;
    checkedAt: string;
}

export interface TalkHistoryTurn {
    role: "user" | "assistant";
    content: string;
    intent?: TalkIntent;
    timestamp?: string;
}

export interface TalkReply {
    intent: TalkIntent;
    title: string;
    summary: string;
    priorityNotice?: string;
    bullets: string[];
    cards: TalkCard[];
    actions: TalkAction[];
    suggestions: string[];
    context?: TalkContext;
}

export interface TalkResponse {
    reply: TalkReply;
    generatedAt: string;
}

export type TalkStreamPhase = "thinking" | "grounding" | "writing" | "complete";

export type TalkStreamEvent =
    | { type: "status"; phase: TalkStreamPhase; message: string }
    | { type: "reply-start"; intent: TalkIntent; generatedAt: string }
    | { type: "title-delta"; delta: string }
    | { type: "summary-delta"; delta: string }
    | { type: "bullet"; value: string }
    | {
        type: "details";
        cards: TalkCard[];
        actions: TalkAction[];
        suggestions: string[];
        context?: TalkContext;
    }
    | { type: "complete"; reply: TalkReply; generatedAt: string }
    | { type: "error"; error: string }
    | { type: "done" };
