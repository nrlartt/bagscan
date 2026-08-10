"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAccount, useConnect, useSignMessage } from "wagmi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Bell,
    BellRing,
    Check,
    Loader2,
    Plus,
    Trash2,
    Wallet,
} from "lucide-react";
import { cn, shortenAddress } from "@/lib/utils";
import { RH_THEME, isEvmAddress } from "@/lib/rh/chain";
import { RhLogo } from "./RhLogo";
import { ErrorState } from "./States";

interface WatchRow {
    id: string;
    tokenAddress: string;
    symbol: string | null;
    curveEnabled: boolean;
    gradEnabled: boolean;
    volumeEnabled: boolean;
    priceMovePct: number | null;
    whaleTradeEth: number | null;
}

interface NotificationRow {
    id: string;
    tokenAddress: string;
    kind: string;
    severity: "info" | "hot" | "critical";
    title: string;
    body: string;
    valueLabel: string | null;
    readAt: string | null;
    createdAt: string;
}

interface AlertsPayload {
    signedIn: boolean;
    wallet?: string;
    preferences?: {
        inAppEnabled: boolean;
        pushEnabled: boolean;
        telegramEnabled: boolean;
        telegramChatId: string | null;
    };
    watches?: WatchRow[];
    notifications?: NotificationRow[];
    unreadCount?: number;
}

const SEVERITY_STYLE: Record<string, string> = {
    critical: "border-[#00C805]/45 bg-[#00C805]/10 text-[#00C805]",
    hot: "border-[#00C805]/25 bg-[#00C805]/[0.05] text-[#00C805]/85",
    info: "border-white/10 bg-white/[0.03] text-white/60",
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
}

async function loadAlerts(): Promise<AlertsPayload> {
    const res = await fetch("/api/alerts", { cache: "no-store" });
    const json = await res.json();
    if (!json.success) throw new Error(json.error ?? "Failed to load alerts");
    return json.data as AlertsPayload;
}

export function RhAlertsView() {
    const queryClient = useQueryClient();
    const { address, isConnected } = useAccount();
    const { connectors, connect, isPending: isConnecting } = useConnect();
    const { signMessageAsync } = useSignMessage();

    const [tokenInput, setTokenInput] = useState("");
    const [authError, setAuthError] = useState<string | null>(null);

    const alertsQuery = useQuery({
        queryKey: ["alerts"],
        queryFn: loadAlerts,
        refetchInterval: 60_000,
    });

    const data = alertsQuery.data;
    const signedIn = Boolean(data?.signedIn);

    const signIn = useMutation({
        mutationFn: async () => {
            if (!address) throw new Error("Connect a wallet first");
            const challengeRes = await fetch("/api/alerts/auth/challenge", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ wallet: address }),
            });
            const challenge = await challengeRes.json();
            if (!challenge.success) throw new Error(challenge.error ?? "Challenge failed");

            const signature = await signMessageAsync({ message: challenge.data.message });

            const verifyRes = await fetch("/api/alerts/auth/verify", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ wallet: address, nonce: challenge.data.nonce, signature }),
            });
            const verify = await verifyRes.json();
            if (!verify.success) throw new Error(verify.error ?? "Verification failed");
        },
        onSuccess: () => {
            setAuthError(null);
            void queryClient.invalidateQueries({ queryKey: ["alerts"] });
        },
        onError: (err: Error) => {
            setAuthError(/user rejected|denied/i.test(err.message) ? null : err.message);
        },
    });

    const signOut = useMutation({
        mutationFn: async () => {
            await fetch("/api/alerts/auth/logout", { method: "POST" });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
    });

    const addWatch = useMutation({
        mutationFn: async (tokenAddress: string) => {
            const res = await fetch("/api/alerts/watch", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ tokenAddress }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error ?? "Failed to add watch");
        },
        onSuccess: () => {
            setTokenInput("");
            void queryClient.invalidateQueries({ queryKey: ["alerts"] });
        },
    });

    const removeWatch = useMutation({
        mutationFn: async (tokenAddress: string) => {
            await fetch(`/api/alerts/watch?tokenAddress=${encodeURIComponent(tokenAddress)}`, {
                method: "DELETE",
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
    });

    const markRead = useMutation({
        mutationFn: async (id?: string) => {
            await fetch("/api/alerts/read", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(id ? { id } : {}),
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
    });

    const [telegramChatId, setTelegramChatId] = useState("");
    const [prefsError, setPrefsError] = useState<string | null>(null);

    const savePreferences = useMutation({
        mutationFn: async (patch: {
            pushEnabled?: boolean;
            telegramEnabled?: boolean;
            telegramChatId?: string | null;
        }) => {
            const res = await fetch("/api/alerts/preferences", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(patch),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error ?? "Failed to save preferences");
        },
        onSuccess: () => {
            setPrefsError(null);
            void queryClient.invalidateQueries({ queryKey: ["alerts"] });
        },
        onError: (err: Error) => setPrefsError(err.message),
    });

    const enablePush = useMutation({
        mutationFn: async () => {
            const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapid) throw new Error("Push is not configured on this deployment");

            if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
                throw new Error("This browser does not support push notifications");
            }

            const permission = await Notification.requestPermission();
            if (permission !== "granted") throw new Error("Notification permission denied");

            const reg = await navigator.serviceWorker.register("/bagscan-alerts-sw.js");
            await reg.update().catch(() => undefined);

            const subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
            });

            const res = await fetch("/api/alerts/push-subscription", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ subscription: subscription.toJSON() }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error ?? "Failed to register push");

            await savePreferences.mutateAsync({ pushEnabled: true });
        },
        onError: (err: Error) => setPrefsError(err.message),
    });

    const tokenValid = isEvmAddress(tokenInput.trim());
    const prefs = data?.preferences;
    const pushConfigured = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);

    useEffect(() => {
        if (prefs?.telegramChatId) setTelegramChatId(prefs.telegramChatId);
    }, [prefs?.telegramChatId]);

    return (
        <div className="mx-auto w-full min-w-0 max-w-[1100px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
            <div className="mb-5 overflow-hidden rounded-2xl border border-[#00C805]/18 bg-gradient-to-br from-[#0c140c] via-[#0a0f0a] to-[#070907] p-4 sm:p-6">
                <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#00C805]/25 bg-[#00C805]/[0.08]">
                        <BellRing className="h-4 w-4 text-[#00C805]" />
                    </span>
                    <RhLogo size={16} />
                    <span className="text-[10px] tracking-[0.2em] text-[#00C805]/70">ROBINHOOD ALERTS</span>
                </div>
                <h1 className="mt-2 text-lg font-semibold tracking-tight text-white sm:text-xl">
                    Watch curves, catch graduations
                </h1>
                <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-white/45">
                    Track any Robinhood Chain token and get alerted when its curve crosses 25/50/75/90%, when it
                    graduates to the pool, on volume spikes, sharp price moves and whale trades.
                </p>
            </div>

            {alertsQuery.error ? (
                <ErrorState error="Failed to load alerts" onRetry={() => alertsQuery.refetch()} />
            ) : !signedIn ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
                    <Wallet className="mx-auto h-9 w-9 text-[#00C805]/25" />
                    <p className="mt-3 text-[12px] tracking-[0.12em] text-white/60">SIGN IN TO SET ALERTS</p>
                    <p className="mx-auto mt-1.5 max-w-sm text-[10px] leading-relaxed text-white/35">
                        Alerts are tied to your wallet. Signing a message proves ownership — it authorizes no
                        transaction and costs no gas.
                    </p>
                    <div className="mt-5 flex justify-center">
                        {!isConnected ? (
                            <button
                                type="button"
                                onClick={() => connectors[0] && connect({ connector: connectors[0] })}
                                disabled={isConnecting}
                                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-semibold tracking-[0.14em] text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                                style={{ backgroundColor: RH_THEME.green }}
                            >
                                <Wallet className="h-3.5 w-3.5" />
                                {isConnecting ? "CONNECTING…" : "CONNECT WALLET"}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => signIn.mutate()}
                                disabled={signIn.isPending}
                                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-semibold tracking-[0.14em] text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                                style={{ backgroundColor: RH_THEME.green }}
                            >
                                {signIn.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                {signIn.isPending ? "CHECK WALLET…" : `SIGN IN AS ${shortenAddress(address ?? "", 4)}`}
                            </button>
                        )}
                    </div>
                    {authError ? (
                        <p className="mt-3 text-[10px] text-[#ff8a8a]">{authError}</p>
                    ) : null}
                </div>
            ) : (
                <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
                    {/* Watches */}
                    <div className="space-y-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <p className="text-[10px] tracking-[0.16em] text-white/35">WATCHED TOKENS</p>
                                <button
                                    type="button"
                                    onClick={() => signOut.mutate()}
                                    className="text-[9px] tracking-[0.12em] text-white/30 hover:text-white/60"
                                >
                                    SIGN OUT
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <input
                                    value={tokenInput}
                                    onChange={(e) => setTokenInput(e.target.value)}
                                    placeholder="0x token address"
                                    spellCheck={false}
                                    className="min-w-0 flex-1 rounded-xl border border-white/[0.09] bg-black/50 px-3 py-2 font-mono text-[11px] text-white/90 placeholder:text-white/25 focus:border-[#00C805]/45 focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => addWatch.mutate(tokenInput.trim())}
                                    disabled={!tokenValid || addWatch.isPending}
                                    className="inline-flex shrink-0 items-center justify-center rounded-xl px-3 text-black transition-opacity hover:opacity-90 disabled:opacity-30"
                                    style={{ backgroundColor: RH_THEME.green }}
                                    aria-label="Add watch"
                                >
                                    {addWatch.isPending ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Plus className="h-3.5 w-3.5" />
                                    )}
                                </button>
                            </div>
                            {addWatch.error ? (
                                <p className="mt-2 text-[10px] text-[#ff8a8a]">
                                    {(addWatch.error as Error).message}
                                </p>
                            ) : null}

                            <div className="mt-3 space-y-1.5">
                                {(data?.watches ?? []).length === 0 ? (
                                    <p className="py-6 text-center text-[10px] text-white/25">
                                        No tokens watched yet.
                                    </p>
                                ) : (
                                    data?.watches?.map((watch) => (
                                        <div
                                            key={watch.id}
                                            className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2"
                                        >
                                            <Link
                                                href={`/token/${watch.tokenAddress}`}
                                                className="min-w-0 flex-1 truncate font-mono text-[10px] text-white/65 hover:text-[#00C805]"
                                            >
                                                {watch.symbol ? `$${watch.symbol} · ` : ""}
                                                {shortenAddress(watch.tokenAddress, 6)}
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => removeWatch.mutate(watch.tokenAddress)}
                                                className="shrink-0 text-white/25 transition-colors hover:text-[#ff8a8a]"
                                                aria-label="Remove watch"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                            <p className="mb-3 text-[10px] tracking-[0.16em] text-white/35">DELIVERY</p>
                            <div className="space-y-3">
                                <label className="flex items-center justify-between gap-3">
                                    <span className="text-[10px] text-white/55">In-app inbox</span>
                                    <span className="text-[9px] text-[#00C805]">ON</span>
                                </label>

                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[10px] text-white/55">Browser push</span>
                                    {prefs?.pushEnabled ? (
                                        <button
                                            type="button"
                                            onClick={() => savePreferences.mutate({ pushEnabled: false })}
                                            className="text-[9px] tracking-wider text-white/35 hover:text-[#ff8a8a]"
                                        >
                                            DISABLE
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => enablePush.mutate()}
                                            disabled={!pushConfigured || enablePush.isPending}
                                            className="rounded-lg px-2 py-1 text-[9px] tracking-wider text-black disabled:opacity-30"
                                            style={{ backgroundColor: RH_THEME.green }}
                                        >
                                            {enablePush.isPending ? "…" : "ENABLE"}
                                        </button>
                                    )}
                                </div>
                                {!pushConfigured ? (
                                    <p className="text-[9px] text-white/25">Push requires VAPID keys on the server.</p>
                                ) : null}

                                <div className="space-y-2 border-t border-white/[0.06] pt-3">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={prefs?.telegramEnabled ?? false}
                                            onChange={(e) =>
                                                savePreferences.mutate({
                                                    telegramEnabled: e.target.checked,
                                                    telegramChatId: telegramChatId.trim() || null,
                                                })
                                            }
                                            className="rounded border-white/20"
                                        />
                                        <span className="text-[10px] text-white/55">Telegram</span>
                                    </label>
                                    <input
                                        value={telegramChatId}
                                        onChange={(e) => setTelegramChatId(e.target.value)}
                                        placeholder="Numeric chat id"
                                        className="w-full rounded-xl border border-white/[0.09] bg-black/50 px-3 py-2 font-mono text-[11px] text-white/90 placeholder:text-white/25 focus:border-[#00C805]/45 focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            savePreferences.mutate({
                                                telegramEnabled: prefs?.telegramEnabled ?? false,
                                                telegramChatId: telegramChatId.trim() || null,
                                            })
                                        }
                                        disabled={savePreferences.isPending}
                                        className="w-full rounded-xl border border-white/10 py-2 text-[9px] tracking-wider text-white/45 hover:border-[#00C805]/30 hover:text-[#00C805]"
                                    >
                                        SAVE TELEGRAM ID
                                    </button>
                                </div>
                            </div>
                            {prefsError ? (
                                <p className="mt-2 text-[10px] text-[#ff8a8a]">{prefsError}</p>
                            ) : null}
                        </div>

                        <p className="px-1 text-[9px] leading-relaxed text-white/25">
                            Signed in as {shortenAddress(data?.wallet ?? "", 6)}. Each curve band alerts once, so a
                            token climbing past 50% will not re-notify on every tick.
                        </p>
                    </div>

                    {/* Inbox */}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-[10px] tracking-[0.16em] text-white/35">
                                INBOX
                                {data?.unreadCount ? (
                                    <span className="ml-2 rounded-full bg-[#00C805]/15 px-2 py-0.5 text-[9px] text-[#00C805]">
                                        {data.unreadCount} new
                                    </span>
                                ) : null}
                            </p>
                            {data?.unreadCount ? (
                                <button
                                    type="button"
                                    onClick={() => markRead.mutate(undefined)}
                                    className="text-[9px] tracking-[0.12em] text-white/35 hover:text-[#00C805]"
                                >
                                    MARK ALL READ
                                </button>
                            ) : null}
                        </div>

                        {(data?.notifications ?? []).length === 0 ? (
                            <div className="px-6 py-16 text-center">
                                <Bell className="mx-auto h-8 w-8 text-[#00C805]/20" />
                                <p className="mt-3 text-[11px] tracking-[0.12em] text-white/40">NO ALERTS YET</p>
                                <p className="mx-auto mt-1.5 max-w-xs text-[10px] leading-relaxed text-white/25">
                                    Watch a token and alerts land here as its curve, volume or price moves.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {data?.notifications?.map((n) => (
                                    <div
                                        key={n.id}
                                        className={cn(
                                            "rounded-xl border p-3 transition-colors",
                                            n.readAt
                                                ? "border-white/[0.06] bg-transparent"
                                                : "border-[#00C805]/20 bg-[#00C805]/[0.03]"
                                        )}
                                    >
                                        <div className="flex items-start gap-2">
                                            <span
                                                className={cn(
                                                    "shrink-0 rounded-lg border px-2 py-0.5 text-[8px] tracking-[0.1em]",
                                                    SEVERITY_STYLE[n.severity] ?? SEVERITY_STYLE.info
                                                )}
                                            >
                                                {n.kind.replace(/_/g, " ").toUpperCase()}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <Link
                                                    href={`/token/${n.tokenAddress}`}
                                                    className="block truncate text-[12px] font-semibold text-white/90 hover:text-[#00C805]"
                                                >
                                                    {n.title}
                                                </Link>
                                                <p className="mt-0.5 text-[10px] leading-relaxed text-white/40">
                                                    {n.body}
                                                </p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                {n.valueLabel ? (
                                                    <p className="text-[11px] font-semibold tabular-nums text-[#00C805]">
                                                        {n.valueLabel}
                                                    </p>
                                                ) : null}
                                                {!n.readAt ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => markRead.mutate(n.id)}
                                                        className="mt-1 text-white/25 hover:text-[#00C805]"
                                                        aria-label="Mark read"
                                                    >
                                                        <Check className="h-3.5 w-3.5" />
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
