import { prisma } from "@/lib/db";
import {
    TELEGRAM_CONNECT_TTL_MS,
    createTelegramConnectToken,
} from "./auth";
import { generateAlphaFeed } from "@/lib/alpha/engine";
import { syncHackathonApps, syncNewLaunches } from "@/lib/sync";

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
    connectCommand?: string | null;
    expiresAt?: string | null;
    chatId?: string | null;
    chatLabel?: string | null;
    error?: string | null;
}

interface TelegramBroadcastTargetRecord {
    chatId: string;
    chatType: string;
    title?: string | null;
    username?: string | null;
    isActive: boolean;
    trendingEnabled: boolean;
    launchesEnabled: boolean;
    digestEnabled: boolean;
    lastTrendingSentAt?: Date | null;
    lastLaunchesSentAt?: Date | null;
    lastDigestSentAt?: Date | null;
}

interface TelegramBotStateRecord {
    key: string;
    lastUpdateId: number;
}

interface TelegramBroadcastCronResult {
    processedUpdates: number;
    activeTargets: number;
    broadcastsSent: number;
}

type BroadcastChannelKey = "trending" | "launches" | "digest";
type BroadcastCommand =
    | { kind: "help" | "status" | "on" | "off" }
    | { kind: "toggle"; channel: BroadcastChannelKey; enabled: boolean };

let cachedBotProfile:
    | {
        value: TelegramBotProfile | null;
        expiresAt: number;
    }
    | null = null;

const TELEGRAM_BOT_STATE_KEY = "telegram-broadcast";
const TRENDING_INTERVAL_MS = 3 * 60 * 60 * 1000;
const LAUNCHES_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DIGEST_INTERVAL_MS = 24 * 60 * 60 * 1000;
const prismaAlerts = prisma as typeof prisma & {
    telegramBroadcastTarget: {
        findMany: (args?: unknown) => Promise<TelegramBroadcastTargetRecord[]>;
        upsert: (args: unknown) => Promise<TelegramBroadcastTargetRecord>;
        update: (args: unknown) => Promise<TelegramBroadcastTargetRecord>;
    };
    telegramBotState: {
        upsert: (args: unknown) => Promise<TelegramBotStateRecord>;
    };
};

export function getTelegramConfig() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    return {
        configured: Boolean(botToken),
        botToken,
    };
}

function formatCompact(value: number) {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(value >= 10 ? 0 : 2);
}

function formatPercent(value?: number) {
    if (value === undefined || !Number.isFinite(value)) return "n/a";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
}

function isGroupChat(chat?: TelegramChat) {
    return chat?.type === "group" || chat?.type === "supergroup";
}

function stripBotMention(text: string, botUsername?: string | null) {
    if (!botUsername) return text.trim();
    return text.replace(new RegExp(`@${botUsername}\\b`, "ig"), "").trim();
}

function parseBroadcastCommand(text?: string, botUsername?: string | null): BroadcastCommand | null {
    if (!text) return null;
    const cleaned = stripBotMention(text, botUsername);
    const lowered = cleaned.toLowerCase().trim();

    if (/^\/bagscan(?:\s+help)?$/i.test(cleaned)) return { kind: "help" };
    if (/^\/bagscan\s+status$/i.test(cleaned)) return { kind: "status" };
    if (/^\/bagscan\s+on$/i.test(cleaned)) return { kind: "on" };
    if (/^\/bagscan\s+off$/i.test(cleaned)) return { kind: "off" };

    const toggleMatch = cleaned.match(/^\/bagscan\s+(trending|launches|digest)\s+(on|off)$/i);
    if (toggleMatch) {
        return {
            kind: "toggle",
            channel: toggleMatch[1].toLowerCase() as BroadcastChannelKey,
            enabled: toggleMatch[2].toLowerCase() === "on",
        };
    }

    const subscribeMatch = lowered.match(/^\/subscribe\s+(trending|launches|digest|daily)$/i);
    if (subscribeMatch) {
        return {
            kind: "toggle",
            channel: subscribeMatch[1].toLowerCase() === "daily" ? "digest" : subscribeMatch[1].toLowerCase() as BroadcastChannelKey,
            enabled: true,
        };
    }

    const unsubscribeMatch = lowered.match(/^\/unsubscribe\s+(trending|launches|digest|daily)$/i);
    if (unsubscribeMatch) {
        return {
            kind: "toggle",
            channel: unsubscribeMatch[1].toLowerCase() === "daily" ? "digest" : unsubscribeMatch[1].toLowerCase() as BroadcastChannelKey,
            enabled: false,
        };
    }

    return null;
}

async function sendTelegramText(chatId: string, text: string) {
    return telegramApi("sendMessage", {
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
    });
}

function buildBroadcastHelp(botUsername?: string | null) {
    const mention = botUsername ? `@${botUsername}` : "";
    return [
        "BagScan group broadcasts",
        "",
        `Use /bagscan${mention ? `@${botUsername}` : ""} on to enable regular posts in this group.`,
        "Commands:",
        "• /bagscan on",
        "• /bagscan off",
        "• /bagscan status",
        "• /bagscan trending on|off",
        "• /bagscan launches on|off",
        "• /bagscan digest on|off",
    ].join("\n");
}

function formatTargetStatus(target: TelegramBroadcastTargetRecord) {
    return [
        "BagScan group status",
        "",
        `Group delivery: ${target.isActive ? "ON" : "OFF"}`,
        `Trending posts: ${target.trendingEnabled ? "ON" : "OFF"}`,
        `Launch posts: ${target.launchesEnabled ? "ON" : "OFF"}`,
        `Daily digest: ${target.digestEnabled ? "ON" : "OFF"}`,
    ].join("\n");
}

async function upsertBroadcastTarget(chat: TelegramChat) {
    return prismaAlerts.telegramBroadcastTarget.upsert({
        where: { chatId: String(chat.id) },
        create: {
            chatId: String(chat.id),
            chatType: chat.type,
            title: chat.title ?? null,
            username: chat.username ?? null,
            isActive: true,
            trendingEnabled: true,
            launchesEnabled: true,
            digestEnabled: true,
        },
        update: {
            chatType: chat.type,
            title: chat.title ?? null,
            username: chat.username ?? null,
        },
    });
}

async function getBotState() {
    return prismaAlerts.telegramBotState.upsert({
        where: { key: TELEGRAM_BOT_STATE_KEY },
        create: { key: TELEGRAM_BOT_STATE_KEY, lastUpdateId: 0 },
        update: {},
    });
}

async function setBotState(lastUpdateId: number) {
    return prismaAlerts.telegramBotState.upsert({
        where: { key: TELEGRAM_BOT_STATE_KEY },
        create: { key: TELEGRAM_BOT_STATE_KEY, lastUpdateId },
        update: { lastUpdateId },
    });
}

async function processGroupCommand(update: TelegramUpdate, botUsername?: string | null) {
    const message = update.message;
    if (!message?.chat || !isGroupChat(message.chat)) {
        return false;
    }

    const command = parseBroadcastCommand(message.text, botUsername);
    if (!command) {
        return false;
    }

    const target = await upsertBroadcastTarget(message.chat);

    switch (command.kind) {
        case "help":
            await sendTelegramText(target.chatId, buildBroadcastHelp(botUsername));
            break;
        case "status":
            await sendTelegramText(target.chatId, formatTargetStatus(target));
            break;
        case "on": {
            const updated = await prismaAlerts.telegramBroadcastTarget.update({
                where: { chatId: target.chatId },
                data: { isActive: true },
            });
            await sendTelegramText(updated.chatId, "BagScan group broadcasts are now ON for this chat.");
            break;
        }
        case "off": {
            const updated = await prismaAlerts.telegramBroadcastTarget.update({
                where: { chatId: target.chatId },
                data: { isActive: false },
            });
            await sendTelegramText(updated.chatId, "BagScan group broadcasts are now OFF for this chat.");
            break;
        }
        case "toggle": {
            const field =
                command.channel === "trending"
                    ? "trendingEnabled"
                    : command.channel === "launches"
                        ? "launchesEnabled"
                        : "digestEnabled";

            const updated = await prismaAlerts.telegramBroadcastTarget.update({
                where: { chatId: target.chatId },
                data: { [field]: command.enabled },
            });
            await sendTelegramText(
                updated.chatId,
                `BagScan ${command.channel} broadcasts are now ${command.enabled ? "ON" : "OFF"} in this group.`
            );
            break;
        }
    }

    return true;
}

function isDue(lastSentAt: Date | null | undefined, intervalMs: number) {
    if (!lastSentAt) return true;
    return Date.now() - new Date(lastSentAt).getTime() >= intervalMs;
}

async function buildTrendingBroadcast() {
    const feed = await generateAlphaFeed();
    const leaders = feed.tokens
        .filter((token) => token.isTrendingNow || (token.alphaScore ?? 0) >= 70)
        .slice(0, 3);

    if (leaders.length === 0) return null;

    const lines = [
        "BagScan Trending Update",
        "",
        ...leaders.map((token, index) =>
            `${index + 1}. ${token.symbol ? `$${token.symbol}` : token.name ?? token.tokenMint.slice(0, 6)} | ${formatPercent(token.priceChange24h)} | ${token.volume24hUsd ? `$${formatCompact(token.volume24hUsd)} vol` : "vol n/a"}`
        ),
        "",
        "bagscan.app/alpha",
    ];

    return lines.join("\n");
}

async function buildLaunchesBroadcast() {
    const launches = await syncNewLaunches();
    const fresh = launches.slice(0, 3);
    if (fresh.length === 0) return null;

    const lines = [
        "BagScan New Launches",
        "",
        ...fresh.map((token, index) =>
            `${index + 1}. ${token.name ?? token.symbol ?? token.tokenMint.slice(0, 6)}${token.symbol ? ` ($${token.symbol})` : ""}${token.volume24hUsd ? ` | $${formatCompact(token.volume24hUsd)} vol` : ""}`
        ),
        "",
        "bagscan.app/launch",
    ];

    return lines.join("\n");
}

async function buildDailyDigestBroadcast() {
    const [alpha, hackathonApps, launches] = await Promise.all([
        generateAlphaFeed(),
        syncHackathonApps(),
        syncNewLaunches(),
    ]);

    const top = alpha.tokens[0];
    const acceptedCount = hackathonApps.filter((app) => (app.status ?? "").toLowerCase() === "accepted").length;

    const lines = [
        "BagScan Daily Digest",
        "",
        top
            ? `Top signal: ${top.symbol ? `$${top.symbol}` : top.name ?? top.tokenMint.slice(0, 6)} | ${formatPercent(top.priceChange24h)} | score ${top.alphaScore ?? 0}`
            : "Top signal: no alpha leader available right now",
        `Hackathon accepted: ${acceptedCount}`,
        `Recent launches tracked: ${launches.length}`,
        "",
        "bagscan.app",
    ];

    return lines.join("\n");
}

export async function syncTelegramBroadcastTargets() {
    const config = getTelegramConfig();
    if (!config.configured) {
        return { processedUpdates: 0 };
    }

    const [profile, state] = await Promise.all([getTelegramBotProfile(), getBotState()]);
    const updates = await telegramApi<TelegramUpdate[]>("getUpdates", {
        offset: state.lastUpdateId + 1,
        limit: 100,
        allowed_updates: ["message"],
    }).catch(() => []);

    let processedUpdates = 0;
    let maxUpdateId = state.lastUpdateId;

    for (const update of updates) {
        maxUpdateId = Math.max(maxUpdateId, update.update_id);
        const processed = await processGroupCommand(update, profile?.username ?? null).catch((error) => {
            console.error("[alerts/telegram] group command error:", error);
            return false;
        });
        if (processed) {
            processedUpdates += 1;
        }
    }

    if (maxUpdateId !== state.lastUpdateId) {
        await setBotState(maxUpdateId);
    }

    return { processedUpdates };
}

export async function runTelegramBroadcastCron(): Promise<TelegramBroadcastCronResult> {
    const config = getTelegramConfig();
    if (!config.configured) {
        return { processedUpdates: 0, activeTargets: 0, broadcastsSent: 0 };
    }

    const { processedUpdates } = await syncTelegramBroadcastTargets();
    const targets = await prismaAlerts.telegramBroadcastTarget.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
    });

    let broadcastsSent = 0;
    const trendingMessage = await buildTrendingBroadcast().catch((error) => {
        console.error("[alerts/telegram] trending broadcast build error:", error);
        return null;
    });
    const launchesMessage = await buildLaunchesBroadcast().catch((error) => {
        console.error("[alerts/telegram] launches broadcast build error:", error);
        return null;
    });
    const digestMessage = await buildDailyDigestBroadcast().catch((error) => {
        console.error("[alerts/telegram] digest broadcast build error:", error);
        return null;
    });

    for (const target of targets) {
        if (target.trendingEnabled && trendingMessage && isDue(target.lastTrendingSentAt, TRENDING_INTERVAL_MS)) {
            try {
                await sendTelegramText(target.chatId, trendingMessage);
                await prismaAlerts.telegramBroadcastTarget.update({
                    where: { chatId: target.chatId },
                    data: { lastTrendingSentAt: new Date() },
                });
                broadcastsSent += 1;
            } catch (error) {
                console.error("[alerts/telegram] trending broadcast send error:", error);
            }
        }

        if (target.launchesEnabled && launchesMessage && isDue(target.lastLaunchesSentAt, LAUNCHES_INTERVAL_MS)) {
            try {
                await sendTelegramText(target.chatId, launchesMessage);
                await prismaAlerts.telegramBroadcastTarget.update({
                    where: { chatId: target.chatId },
                    data: { lastLaunchesSentAt: new Date() },
                });
                broadcastsSent += 1;
            } catch (error) {
                console.error("[alerts/telegram] launches broadcast send error:", error);
            }
        }

        if (target.digestEnabled && digestMessage && isDue(target.lastDigestSentAt, DIGEST_INTERVAL_MS)) {
            try {
                await sendTelegramText(target.chatId, digestMessage);
                await prismaAlerts.telegramBroadcastTarget.update({
                    where: { chatId: target.chatId },
                    data: { lastDigestSentAt: new Date() },
                });
                broadcastsSent += 1;
            } catch (error) {
                console.error("[alerts/telegram] digest broadcast send error:", error);
            }
        }
    }

    return {
        processedUpdates,
        activeTargets: targets.length,
        broadcastsSent,
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
        /^\/connect(?:@\w+)?\s+(\S+)$/i,
        /^\/link(?:@\w+)?\s+(\S+)$/i,
        /^connect\s+(\S+)$/i,
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

async function findChatByConnectToken(tokens: string[]) {
    const tokenSet = new Set(tokens);
    const updates = await telegramApi<TelegramUpdate[]>("getUpdates", {
        offset: -100,
        limit: 100,
        allowed_updates: ["message"],
    }).catch(() => []);

    for (const update of [...updates].reverse()) {
        const payload = extractTelegramStartPayload(update.message?.text);
        if (payload && tokenSet.has(payload) && update.message?.chat) {
            return update.message.chat;
        }
    }

    return null;
}

async function findRecentPlainStartChat() {
    const updates = await telegramApi<TelegramUpdate[]>("getUpdates", {
        offset: -100,
        limit: 100,
        allowed_updates: ["message"],
    }).catch(() => []);

    for (const update of [...updates].reverse()) {
        const message = update.message;
        const text = message?.text?.trim();
        if (!message?.chat || message.chat.type !== "private") {
            continue;
        }

        if (/^\/start(?:@\w+)?$/i.test(text ?? "")) {
            return message.chat;
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
    const previousConnect = createTelegramConnectToken(
        walletAddress,
        Date.now() - TELEGRAM_CONNECT_TTL_MS
    );
    const botUsername = profile?.username ?? null;
    const botUrl = botUsername ? `https://t.me/${botUsername}` : null;
    const connectUrl = botUsername
        ? `https://t.me/${botUsername}?start=${encodeURIComponent(connect.token)}`
        : null;
    const connectCommand = `/connect ${connect.token}`;

    let chatId = preference?.telegramChatId ?? null;
    let chatLabel: string | null = null;
    let error: string | null = null;

    if (!chatId) {
        const chat = await findChatByConnectToken([
            connect.token,
            previousConnect.token,
        ]);
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
        } else {
            const plainStartChat = await findRecentPlainStartChat();
            if (plainStartChat) {
                error = "Telegram bot was opened without the BagScan connect token. Use CONNECT TELEGRAM, then tap Start in the bot.";
            }
        }
    }

    return {
        configured: true,
        connected: Boolean(chatId),
        botUsername,
        botUrl,
        connectUrl,
        connectCommand,
        expiresAt: new Date(connect.expiresAt).toISOString(),
        chatId,
        chatLabel,
        error:
            !botUsername
                ? "Telegram bot profile could not be loaded. Check TELEGRAM_BOT_TOKEN."
                : error,
    };
}
