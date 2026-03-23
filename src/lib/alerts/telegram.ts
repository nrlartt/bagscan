import { prisma } from "@/lib/db";
import { createTelegramConnectToken } from "./auth";

interface TelegramApiEnvelope<T> {
    ok: boolean;
    result?: T;
    description?: string;
}

interface TelegramBotProfile {
    id: number;
    is_bot: boolean;
    username?: string;
    first_name?: string;
}

interface TelegramChat {
    id: number;
    type: string;
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
}

interface TelegramMessage {
    text?: string;
    chat: TelegramChat;
}

interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
}

export interface TelegramConnectState {
    configured: boolean;
    connected: boolean;
    botUsername?: string | null;
    botUrl?: string | null;
    connectUrl?: string | null;
    expiresAt?: string | null;
    chatId?: string | null;
    chatLabel?: string | null;
    error?: string | null;
}

let cachedBotProfile:
    | {
        value: TelegramBotProfile | null;
        expiresAt: number;
    }
    | null = null;

export function getTelegramConfig() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    return {
        configured: Boolean(botToken),
        botToken,
    };
}

async function telegramApi<T>(method: string, body?: Record<string, unknown>) {
    const config = getTelegramConfig();
    if (!config.botToken) {
        throw new Error("Telegram is not configured on the server");
    }

    const response = await fetch(`https://api.telegram.org/bot${config.botToken}/${method}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
    });

    const payload = (await response.json().catch(() => ({}))) as TelegramApiEnvelope<T>;
    if (!response.ok || !payload.ok || payload.result === undefined) {
        throw new Error(payload.description || `Telegram ${method} failed`);
    }

    return payload.result;
}

async function getTelegramBotProfile() {
    if (cachedBotProfile && cachedBotProfile.expiresAt > Date.now()) {
        return cachedBotProfile.value;
    }

    try {
        const profile = await telegramApi<TelegramBotProfile>("getMe");
        cachedBotProfile = {
            value: profile,
            expiresAt: Date.now() + 5 * 60 * 1000,
        };
        return profile;
    } catch {
        cachedBotProfile = {
            value: null,
            expiresAt: Date.now() + 30_000,
        };
        return null;
    }
}

function extractTelegramStartPayload(text?: string) {
    if (!text) return null;
    const trimmed = text.trim();
    const patterns = [
        /^\/start(?:@\w+)?\s+(\S+)$/i,
        /^\/startgroup(?:@\w+)?\s+(\S+)$/i,
    ];

    for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match?.[1]) {
            return match[1];
        }
    }

    return null;
}

function getChatLabel(chat: TelegramChat) {
    if (chat.title) return chat.title;
    if (chat.username) return `@${chat.username}`;

    const name = [chat.first_name, chat.last_name].filter(Boolean).join(" ").trim();
    if (name) return name;

    return `${chat.type} chat`;
}

async function findChatByConnectToken(token: string) {
    const updates = await telegramApi<TelegramUpdate[]>("getUpdates", {
        offset: -100,
        limit: 100,
        allowed_updates: ["message"],
    }).catch(() => []);

    for (const update of [...updates].reverse()) {
        const payload = extractTelegramStartPayload(update.message?.text);
        if (payload === token && update.message?.chat) {
            return update.message.chat;
        }
    }

    return null;
}

export async function getTelegramConnectState(walletAddress: string): Promise<TelegramConnectState> {
    const config = getTelegramConfig();
    if (!config.configured) {
        return {
            configured: false,
            connected: false,
            error: "TELEGRAM_BOT_TOKEN is not configured.",
        };
    }

    const [preference, profile] = await Promise.all([
        prisma.alertPreference.findUnique({
            where: { walletAddress },
            select: {
                telegramChatId: true,
            },
        }),
        getTelegramBotProfile(),
    ]);

    const connect = createTelegramConnectToken(walletAddress);
    const botUsername = profile?.username ?? null;
    const botUrl = botUsername ? `https://t.me/${botUsername}` : null;
    const connectUrl = botUsername
        ? `https://t.me/${botUsername}?start=${encodeURIComponent(connect.token)}`
        : null;

    let chatId = preference?.telegramChatId ?? null;
    let chatLabel: string | null = null;

    if (!chatId) {
        const chat = await findChatByConnectToken(connect.token);
        if (chat) {
            chatId = String(chat.id);
            chatLabel = getChatLabel(chat);

            await prisma.alertPreference.upsert({
                where: { walletAddress },
                create: {
                    walletAddress,
                    telegramChatId: chatId,
                    telegramEnabled: true,
                },
                update: {
                    telegramChatId: chatId,
                    telegramEnabled: true,
                },
            });
        }
    }

    return {
        configured: true,
        connected: Boolean(chatId),
        botUsername,
        botUrl,
        connectUrl,
        expiresAt: new Date(connect.expiresAt).toISOString(),
        chatId,
        chatLabel,
        error:
            !botUsername
                ? "Telegram bot profile could not be loaded. Check TELEGRAM_BOT_TOKEN."
                : null,
    };
}
