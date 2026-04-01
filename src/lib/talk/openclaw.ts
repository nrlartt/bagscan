import type { TalkAction, TalkCard, TalkContext, TalkHistoryTurn, TalkIntent, TalkMetric, TalkReply } from "@/lib/talk/types";
import { generateTalkReplyLocal } from "./engine";

const BASE58_MINT_REGEX = /\b[1-9A-HJ-NP-Za-km-z]{32,48}\b/;
const TOKEN_SYMBOL_REGEX = /\$([A-Za-z0-9._-]{2,20})/;

interface OpenClawConfig {
    enabled: boolean;
    rawBaseUrl: string;
    endpoint: string;
    token?: string;
    model: string;
    agentId: string;
    source: "http" | "gateway";
}

interface ChatCompletionChoice {
    message?: {
        content?: string | Array<{ type?: string; text?: string }>;
    };
}

interface ChatCompletionResponse {
    choices?: ChatCompletionChoice[];
}

function getOpenClawConfig(): OpenClawConfig {
    const baseUrl = process.env.OPENCLAW_BASE_URL?.trim();
    const token = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();
    const requestedModel = process.env.OPENCLAW_MODEL?.trim();
    const agentId = process.env.OPENCLAW_AGENT_ID?.trim() || "main";
    const model =
        requestedModel && /^openclaw(?:\/[^/\s]+)?$/i.test(requestedModel)
            ? requestedModel
            : `openclaw/${agentId}`;

    if (!baseUrl || !token) {
        return {
            enabled: false,
            rawBaseUrl: baseUrl || "",
            endpoint: "",
            token,
            model,
            agentId,
            source: "http",
        };
    }

    const trimmedBaseUrl = baseUrl.replace(/\/$/, "");
    const usesGatewayUrl = /^wss?:\/\//i.test(trimmedBaseUrl);
    const normalizedBaseUrl = usesGatewayUrl
        ? trimmedBaseUrl.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:")
        : trimmedBaseUrl;
    const endpoint = /\/v1\/chat\/completions\/?$/i.test(normalizedBaseUrl)
        ? normalizedBaseUrl
        : `${normalizedBaseUrl}/v1/chat/completions`;

    return {
        enabled: true,
        rawBaseUrl: baseUrl,
        endpoint,
        token,
        model,
        agentId,
        source: usesGatewayUrl ? "gateway" : "http",
    };
}

export function isOpenClawTalkEnabled() {
    return getOpenClawConfig().enabled;
}

function referencesActiveToken(message: string) {
    return /\b(this token|that token|this coin|that coin|this project|that project|this one|that one|it)\b/i.test(message);
}

function extractExplicitTokenReference(message: string) {
    const mint = message.match(BASE58_MINT_REGEX)?.[0];
    if (mint) return mint;

    const symbol = message.match(TOKEN_SYMBOL_REGEX)?.[1];
    if (symbol) return `$${symbol}`;

    return undefined;
}

function hasActiveTokenContext(context?: TalkContext) {
    return Boolean(context?.activeTokenMint || context?.activeTokenName || context?.activeTokenSymbol);
}

function resolveConversationToken(message: string, context?: TalkContext) {
    const explicit = extractExplicitTokenReference(message);
    if (explicit) return explicit;

    if (referencesActiveToken(message) && context?.activeTokenMint) {
        return context.activeTokenMint;
    }

    return context?.activeTokenMint ?? context?.activeTokenSymbol ?? context?.activeTokenName;
}

function detectPromptMode(message: string) {
    const lowered = message.toLowerCase();

    if (/\b(popular|top|most active|highest volume|biggest|largest|right now|market board|market)\b/.test(lowered)) {
        return "market";
    }
    if (/\b(hackathon|accepted|ai agents|app store|votes)\b/.test(lowered)) {
        return "hackathon";
    }
    if (/\b(launch|deploy|create token|token launch)\b/.test(lowered)) {
        return "launch";
    }
    if (/\b(claim|claimable|wallet)\b/.test(lowered)) {
        return "claims";
    }
    if (/\b(creator|who created|fees|earned|royalty|token)\b/.test(lowered)) {
        return "token";
    }
    return "general";
}

function needsTokenClarification(message: string, context?: TalkContext) {
    const lowered = message.toLowerCase();
    const explicitToken = extractExplicitTokenReference(message);
    if (explicitToken || hasActiveTokenContext(context)) {
        return false;
    }

    if (referencesActiveToken(message)) {
        return true;
    }

    return /\b(who created it|who created this|what fees has it earned|what fees has this|claim stats for it|tell me about this token|show me this token)\b/i.test(lowered);
}

function buildConversationHistory(history?: TalkHistoryTurn[]) {
    if (!history || history.length === 0) return [];

    return history.slice(-6).map((turn) => ({
        role: turn.role,
        intent: turn.intent ?? null,
        content: turn.content,
        timestamp: turn.timestamp ?? null,
    }));
}

function buildOpenClawInput(message: string, wallet?: string, context?: TalkContext, history?: TalkHistoryTurn[]) {
    const tokenRef = resolveConversationToken(message, context);
    const promptMode = detectPromptMode(message);

    return {
        userQuestion: message,
        bagscanMode: "openclaw-only",
        wallet: wallet ?? null,
        activeContext: context ?? null,
        recentHistory: buildConversationHistory(history),
        hints: {
            tokenReference: tokenRef ?? null,
            walletContextEnabled: Boolean(wallet),
            hasContext: hasActiveTokenContext(context),
            promptMode,
            requiresTokenClarification: needsTokenClarification(message, context),
        },
    };
}

function compactReply(reply: TalkReply) {
    return {
        intent: reply.intent,
        title: reply.title,
        summary: reply.summary,
        bullets: reply.bullets.slice(0, 5),
        cards: reply.cards.slice(0, 3).map((card) => ({
            id: card.id,
            title: card.title,
            subtitle: card.subtitle,
            eyebrow: card.eyebrow,
            description: card.description,
            href: card.href,
            metrics: (card.metrics ?? []).slice(0, 4).map((metric) => ({
                label: metric.label,
                value: metric.value,
                tone: metric.tone,
            })),
        })),
        actions: reply.actions.slice(0, 3),
        suggestions: reply.suggestions.slice(0, 4),
        context: reply.context,
    };
}

function buildClarificationReply(context?: TalkContext): TalkReply {
    return {
        intent: "token",
        title: "WHICH TOKEN?",
        summary: "I need a token name, $symbol, or mint before I can answer that reliably.",
        bullets: [
            "You can send a mint address, a $symbol like $HIVE, or the token name.",
            "Once a token is active in the conversation, follow-up questions like 'who created this token?' work much better.",
        ],
        cards: [],
        actions: [],
        suggestions: [
            "Who created $HIVE?",
            "Tell me about 6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS",
            "What fees has $MILADY.AI earned?",
        ],
        context,
    };
}

function shouldBypassOpenClaw(groundedReply: TalkReply) {
    return (
        groundedReply.title === "WHICH TOKEN?" ||
        groundedReply.title === "TOKEN NOT FOUND" ||
        groundedReply.title === "OFFICIAL TOKEN NOT FOUND" ||
        groundedReply.title === "MULTIPLE OFFICIAL MATCHES"
    );
}

function asksForCreatorFact(message: string) {
    return /\b(who created|creator of|who is behind|who built)\b/i.test(message);
}

function asksForFeeFact(message: string) {
    return /\b(what fees|how much.*earned|fees?.*earned|lifetime fees)\b/i.test(message);
}

function groundedReplyHasMissingCreatorData(reply: TalkReply) {
    return reply.bullets.some((bullet) => /no creator profile is currently exposed/i.test(bullet));
}

function groundedReplyHasMissingFeeData(reply: TalkReply) {
    return reply.bullets.some((bullet) => /official lifetime fees are not currently exposed/i.test(bullet));
}

function getChatContent(payload: ChatCompletionResponse) {
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
        return content.map((item) => item.text ?? "").join("").trim();
    }
    return "";
}

function extractJson(raw: string) {
    const fenced = raw.match(/```json\s*([\s\S]*?)```/i)?.[1];
    if (fenced) return fenced.trim();

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
        return raw.slice(start, end + 1);
    }

    return raw.trim();
}

function sanitizeAction(action: unknown): TalkAction | null {
    if (!action || typeof action !== "object") return null;
    const candidate = action as Partial<TalkAction>;
    if (!candidate.label || !candidate.href) return null;
    return {
        label: String(candidate.label),
        href: String(candidate.href),
        tone:
            candidate.tone === "info" || candidate.tone === "warning" || candidate.tone === "default"
                ? candidate.tone
                : "default",
    };
}

function sanitizeCard(card: unknown, fallbackId: string): TalkCard | null {
    if (!card || typeof card !== "object") return null;
    const candidate = card as Partial<TalkCard>;
    if (!candidate.title) return null;

    return {
        id: typeof candidate.id === "string" && candidate.id ? candidate.id : fallbackId,
        title: String(candidate.title),
        subtitle: candidate.subtitle ? String(candidate.subtitle) : undefined,
        eyebrow: candidate.eyebrow ? String(candidate.eyebrow) : undefined,
        description: candidate.description ? String(candidate.description) : undefined,
        href: candidate.href ? String(candidate.href) : undefined,
        metrics: Array.isArray(candidate.metrics)
            ? candidate.metrics
                .map((metric) => {
                    if (!metric || typeof metric !== "object") return null;
                    const typed = metric as { label?: unknown; value?: unknown; tone?: unknown };
                    if (!typed.label || typed.value === undefined) return null;
                    const tone: TalkMetric["tone"] =
                        typed.tone === "positive" ||
                        typed.tone === "negative" ||
                        typed.tone === "info" ||
                        typed.tone === "warning" ||
                        typed.tone === "default"
                            ? typed.tone
                            : undefined;
                    return {
                        label: String(typed.label),
                        value: String(typed.value),
                        tone,
                    };
                })
                .filter((metric): metric is NonNullable<typeof metric> => metric !== null)
            : undefined,
    };
}

function sanitizeReply(raw: unknown, fallbackContext?: TalkContext): TalkReply {
    if (!raw || typeof raw !== "object") {
        throw new Error("OpenClaw returned an invalid reply payload.");
    }

    const candidate = raw as Partial<TalkReply>;
    const validIntents: TalkIntent[] = [
        "overview",
        "market",
        "spotlight",
        "new-launches",
        "hackathon",
        "leaderboard",
        "token",
        "portfolio",
        "launch",
        "alerts",
        "trade",
    ];

    return {
        intent: validIntents.includes(candidate.intent as TalkIntent) ? (candidate.intent as TalkIntent) : "overview",
        title: candidate.title ? String(candidate.title) : "TALK TO BAGS",
        summary: candidate.summary ? String(candidate.summary) : "Official BAGS response.",
        bullets: Array.isArray(candidate.bullets) ? candidate.bullets.slice(0, 5).map(String) : [],
        cards: Array.isArray(candidate.cards)
            ? candidate.cards
                .map((card, index) => sanitizeCard(card, `openclaw-card-${index + 1}`))
                .filter((card): card is TalkCard => card !== null)
                .slice(0, 3)
            : [],
        actions: Array.isArray(candidate.actions)
            ? candidate.actions
                .map(sanitizeAction)
                .filter((action): action is TalkAction => action !== null)
                .slice(0, 3)
            : [],
        suggestions: Array.isArray(candidate.suggestions) ? candidate.suggestions.slice(0, 4).map(String) : [],
        context: candidate.context && typeof candidate.context === "object"
            ? {
                activeTokenMint: typeof candidate.context.activeTokenMint === "string" ? candidate.context.activeTokenMint : fallbackContext?.activeTokenMint,
                activeTokenName: typeof candidate.context.activeTokenName === "string" ? candidate.context.activeTokenName : fallbackContext?.activeTokenName,
                activeTokenSymbol: typeof candidate.context.activeTokenSymbol === "string" ? candidate.context.activeTokenSymbol : fallbackContext?.activeTokenSymbol,
                lastIntent: validIntents.includes(candidate.context.lastIntent as TalkIntent)
                    ? (candidate.context.lastIntent as TalkIntent)
                    : fallbackContext?.lastIntent,
            }
            : fallbackContext,
    };
}

function mergeReplies(groundedReply: TalkReply, modelReply: TalkReply): TalkReply {
    const title = modelReply.title?.trim() ? modelReply.title : groundedReply.title;
    const summary = modelReply.summary?.trim() ? modelReply.summary : groundedReply.summary;
    const bullets = modelReply.bullets.length > 0 ? modelReply.bullets : groundedReply.bullets;
    const cards = modelReply.cards.length > 0 ? modelReply.cards : groundedReply.cards;
    const actions = modelReply.actions.length > 0 ? modelReply.actions : groundedReply.actions;
    const suggestions = modelReply.suggestions.length > 0 ? modelReply.suggestions : groundedReply.suggestions;

    return {
        intent: groundedReply.intent,
        title,
        summary,
        bullets,
        cards,
        actions,
        suggestions,
        context: modelReply.context ?? groundedReply.context,
    };
}

const SYSTEM_PROMPT = [
    "You are TALK TO BAGS inside BagScan.",
    "You are an OpenClaw reasoning layer sitting on top of a grounded official BAGS API draft.",
    "The groundedDraft is canonical. Do not contradict it, replace it with unrelated facts, or invent new Bags data.",
    "Your job is to improve clarity, tone, and usefulness while staying faithful to the groundedDraft.",
    "Use recentHistory and activeContext to understand follow-up questions like 'this token' or 'that one'.",
    "If groundedDraft is already a clarification or not-found answer, preserve that behavior.",
    "Do not give the same generic token-style answer to unrelated prompts.",
    "For market-wide questions, keep the answer market-wide. Do not collapse into a single token profile.",
    "For creator, fees, and claim questions, stay tightly scoped to the grounded token or wallet subject.",
    "Prefer concise, useful answers with direct facts and next actions.",
    "You may rewrite titles, summaries, bullets, cards, actions, and suggestions, but keep them consistent with groundedDraft.",
    "Return ONLY valid JSON with the shape:",
    '{"intent":"overview|market|spotlight|new-launches|hackathon|leaderboard|token|portfolio|launch|alerts|trade","title":"string","summary":"string","bullets":["string"],"cards":[{"id":"string","title":"string","subtitle":"string","eyebrow":"string","description":"string","href":"string","metrics":[{"label":"string","value":"string","tone":"default|positive|negative|info|warning"}]}],"actions":[{"label":"string","href":"string","tone":"default|info|warning"}],"suggestions":["string"],"context":{"activeTokenMint":"string","activeTokenName":"string","activeTokenSymbol":"string","lastIntent":"overview|market|spotlight|new-launches|hackathon|leaderboard|token|portfolio|launch|alerts|trade"}}',
].join("\n");

export async function generateTalkReplyWithOpenClaw(message: string, wallet?: string, context?: TalkContext, history?: TalkHistoryTurn[]): Promise<TalkReply> {
    const config = getOpenClawConfig();
    if (!config.enabled || !config.token) {
        throw new Error("OpenClaw is not configured.");
    }

    if (needsTokenClarification(message, context)) {
        return buildClarificationReply(context);
    }

    const groundedReply = await generateTalkReplyLocal(message, wallet, context);
    if (
        shouldBypassOpenClaw(groundedReply) ||
        (asksForCreatorFact(message) && groundedReplyHasMissingCreatorData(groundedReply)) ||
        (asksForFeeFact(message) && groundedReplyHasMissingFeeData(groundedReply))
    ) {
        return groundedReply;
    }

    const openClawInput = {
        request: buildOpenClawInput(message, wallet, context, history),
        groundedDraft: compactReply(groundedReply),
    };
    const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.token}`,
            "x-openclaw-agent-id": config.agentId,
        },
        body: JSON.stringify({
            model: config.model,
            temperature: 0.15,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                    role: "user",
                    content: JSON.stringify(openClawInput),
                },
            ],
        }),
        cache: "no-store",
    });

    if (!response.ok) {
        const body = await response.text().catch(() => "");
        const gatewayHint =
            response.status === 404 && config.source === "gateway"
                ? " OpenClaw gateway reached, but the OpenAI-compatible /v1/chat/completions endpoint is likely disabled on that gateway."
                : "";
        throw new Error(`OpenClaw request failed (${response.status}): ${body || "unknown error"}${gatewayHint}`);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = getChatContent(payload);
    const json = extractJson(content);
    const parsed = JSON.parse(json) as TalkReply;
    const sanitized = sanitizeReply(parsed, groundedReply.context ?? context);

    return mergeReplies(groundedReply, sanitized);
}
