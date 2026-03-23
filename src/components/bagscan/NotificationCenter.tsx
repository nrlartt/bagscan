"use client";

import {
    useEffect,
    useRef,
    useState,
    type Dispatch,
    type SetStateAction,
} from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseQueryResult,
} from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import {
    Bell,
    BellOff,
    CheckCheck,
    RefreshCw,
    Send,
    Shield,
    Smartphone,
    Sparkles,
    X,
} from "lucide-react";
import {
    ensureAlertServiceWorker,
    fetchAlertState,
    logoutAlertSession,
    markAlertsAsRead,
    requestAlertSession,
    subscribeBrowserPush,
    syncAlertState,
    unsubscribeBrowserPush,
    updateAlertSettings,
} from "@/lib/alerts/client";
import type {
    AlertNotificationItem,
    AlertPreferenceState,
    AlertStateResponse,
} from "@/lib/alerts/types";
import { cn, shortenAddress } from "@/lib/utils";

type PushStatus = "unknown" | "unsupported" | "permission-denied" | "not-subscribed" | "subscribed";

const QUERY_KEY_BASE = "bagscan-alert-center";

export function NotificationCenter() {
    const { connected, publicKey, signMessage } = useWallet();
    const walletAddress = publicKey?.toBase58() ?? "";

    return (
        <NotificationCenterInner
            key={walletAddress || "disconnected"}
            connected={connected}
            walletAddress={walletAddress}
            signMessage={signMessage}
        />
    );
}

function NotificationCenterInner({
    connected,
    walletAddress,
    signMessage,
}: {
    connected: boolean;
    walletAddress: string;
    signMessage: ReturnType<typeof useWallet>["signMessage"];
}) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [sessionState, setSessionState] = useState<"unknown" | "authorized" | "unauthorized">("unknown");
    const [authError, setAuthError] = useState<string | null>(null);
    const [pushStatus, setPushStatus] = useState<PushStatus>("unknown");
    const [draft, setDraft] = useState<AlertPreferenceState | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const alertsQuery = useQuery<AlertStateResponse>({
        queryKey: [QUERY_KEY_BASE, walletAddress],
        enabled: connected && Boolean(walletAddress) && (open || sessionState === "authorized"),
        queryFn: async () => {
            try {
                const data = await fetchAlertState(walletAddress);
                setSessionState("authorized");
                return data;
            } catch (error) {
                if (error instanceof Error && /alert session required/i.test(error.message)) {
                    setSessionState("unauthorized");
                }
                throw error;
            }
        },
        retry: false,
        staleTime: 20_000,
        refetchInterval: sessionState === "authorized" ? 60_000 : false,
        refetchOnWindowFocus: false,
    });
    const signedIn = sessionState === "authorized" || Boolean(alertsQuery.data);
    const activeDraft = draft ?? alertsQuery.data?.preference ?? null;

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [open]);

    useEffect(() => {
        if (!open || !signedIn || !alertsQuery.data?.config.vapidPublicKey) return;
        let cancelled = false;

        const inspectPush = async () => {
            if (!("Notification" in window) || !("serviceWorker" in navigator)) {
                if (!cancelled) setPushStatus("unsupported");
                return;
            }
            if (Notification.permission === "denied") {
                if (!cancelled) setPushStatus("permission-denied");
                return;
            }
            const registration = await ensureAlertServiceWorker();
            const subscription = await registration?.pushManager.getSubscription();
            if (!cancelled) setPushStatus(subscription ? "subscribed" : "not-subscribed");
        };

        void inspectPush();
        return () => {
            cancelled = true;
        };
    }, [open, signedIn, alertsQuery.data?.config.vapidPublicKey]);

    const saveMutation = useMutation({
        mutationFn: async (nextDraft: AlertPreferenceState) =>
            updateAlertSettings(walletAddress, {
                inAppEnabled: nextDraft.inAppEnabled,
                browserPushEnabled: nextDraft.browserPushEnabled,
                telegramEnabled: nextDraft.telegramEnabled,
                alphaHotEnabled: nextDraft.alphaHotEnabled,
                alphaCriticalEnabled: nextDraft.alphaCriticalEnabled,
                portfolioProfitEnabled: nextDraft.portfolioProfitEnabled,
                portfolioDrawdownEnabled: nextDraft.portfolioDrawdownEnabled,
                feesEnabled: nextDraft.feesEnabled,
                profitThresholdPercent: nextDraft.profitThresholdPercent,
                drawdownThresholdPercent: nextDraft.drawdownThresholdPercent,
                claimableFeesThresholdSol: nextDraft.claimableFeesThresholdSol,
                telegramChatId: nextDraft.telegramChatId ?? null,
            }),
        onSuccess: (state) => {
            setDraft(state.preference);
            queryClient.setQueryData([QUERY_KEY_BASE, walletAddress], state);
        },
    });

    const syncMutation = useMutation({
        mutationFn: async () => syncAlertState(walletAddress),
        onSuccess: ({ state }) => {
            queryClient.setQueryData([QUERY_KEY_BASE, walletAddress], state);
        },
    });

    const signInMutation = useMutation({
        mutationFn: async () => {
            if (!signMessage) throw new Error("This wallet does not support message signing");
            await requestAlertSession(walletAddress, signMessage);
        },
        onSuccess: async () => {
            setSessionState("authorized");
            setAuthError(null);
            setDraft(null);
            await queryClient.invalidateQueries({ queryKey: [QUERY_KEY_BASE, walletAddress] });
        },
        onError: (error) => {
            setAuthError(error instanceof Error ? error.message : "Alert sign-in failed");
        },
    });

    const logoutMutation = useMutation({
        mutationFn: async () => logoutAlertSession(),
        onSuccess: async () => {
            setSessionState("unauthorized");
            setDraft(null);
            await queryClient.removeQueries({ queryKey: [QUERY_KEY_BASE, walletAddress] });
        },
    });

    const markAllMutation = useMutation({
        mutationFn: async () => markAlertsAsRead(walletAddress, { all: true }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: [QUERY_KEY_BASE, walletAddress] });
        },
    });

    const pushMutation = useMutation({
        mutationFn: async (enable: boolean) => {
            if (enable) {
                const vapidPublicKey = alertsQuery.data?.config.vapidPublicKey;
                if (!vapidPublicKey) throw new Error("Browser push is not configured on the server");
                if (!window.isSecureContext && window.location.hostname !== "localhost") {
                    throw new Error("Browser push requires HTTPS in production");
                }
                await subscribeBrowserPush(walletAddress, vapidPublicKey);
                return updateAlertSettings(walletAddress, { browserPushEnabled: true });
            }

            await unsubscribeBrowserPush(walletAddress);
            return updateAlertSettings(walletAddress, { browserPushEnabled: false });
        },
        onSuccess: (state) => {
            setPushStatus(state.preference.browserPushEnabled ? "subscribed" : "not-subscribed");
            setDraft(state.preference);
            queryClient.setQueryData([QUERY_KEY_BASE, walletAddress], state);
        },
    });

    const unreadCount = alertsQuery.data?.unreadCount ?? 0;
    const notifications = alertsQuery.data?.notifications ?? [];

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className={cn(
                    "relative inline-flex h-9 items-center gap-2 border-2 px-3 text-[#00ff41] transition-all",
                    open
                        ? "border-[#00ff41]/70 bg-[#00ff41]/10 shadow-[0_0_18px_rgba(0,255,65,0.12)]"
                        : "border-[#00ff41]/32 bg-black/80 hover:border-[#00ff41]/60 hover:bg-[#00ff41]/8"
                )}
            >
                <Bell className="h-3.5 w-3.5" />
                <span className="hidden text-[10px] tracking-[0.16em] text-[#d8ffe6] sm:inline">ALERTS</span>
                {unreadCount > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-[#ffaa00]/40 bg-[#ffaa00]/14 px-1.5 text-[9px] tracking-[0.12em] text-[#ffd37a]">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                ) : null}
            </button>

            {open ? (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px] sm:hidden"
                        onClick={() => setOpen(false)}
                    />
                    <div className="fixed inset-x-3 top-[4.5rem] z-50 max-h-[calc(100vh-6rem)] overflow-y-auto border border-[#00ff41]/18 bg-[#021109]/96 shadow-[0_30px_90px_rgba(0,0,0,0.55),0_0_40px_rgba(0,255,65,0.08)] backdrop-blur-xl sm:absolute sm:right-0 sm:left-auto sm:top-[calc(100%+14px)] sm:w-[520px] sm:max-w-[92vw] sm:max-h-[80vh]">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,255,65,0.1),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(0,170,255,0.1),transparent_40%)]" />
                        <div className="relative">
                            <div className="flex items-start justify-between gap-3 border-b border-[#00ff41]/12 px-4 py-4">
                                <div>
                                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#00ff41]/55">
                                        <Bell className="h-3.5 w-3.5" />
                                        Notification Center
                                    </div>
                                    <h3 className="mt-2 text-lg tracking-[0.16em] text-[#d8ffe6]">
                                        {!connected ? "NOTIFICATIONS" : signedIn ? "SMART ALERTS" : "AUTHORIZE ALERTS"}
                                    </h3>
                                    <p className="mt-2 text-[11px] tracking-[0.16em] text-[#9dffb8]/70">
                                        {connected ? shortenAddress(walletAddress, 6) : "Connect a wallet to personalize alerts"}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="inline-flex h-9 w-9 items-center justify-center border border-white/10 bg-white/[0.03] text-white/65 transition-colors hover:bg-white/[0.07]"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {!connected ? (
                                <div className="space-y-4 px-4 py-5">
                                    <div className="border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-white/70">
                                        Connect a wallet first. Alerts are wallet-scoped and use a one-time signed message for secure preferences.
                                    </div>
                                </div>
                            ) : !signedIn ? (
                                <div className="space-y-4 px-4 py-5">
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <SmallStat label="IN-APP" value="INBOX" icon={<Sparkles className="h-4 w-4" />} />
                                        <SmallStat label="BROWSER" value="PUSH" icon={<Smartphone className="h-4 w-4" />} />
                                        <SmallStat label="TELEGRAM" value="BOT" icon={<Send className="h-4 w-4" />} />
                                    </div>
                                    <div className="border border-[#00ff41]/14 bg-[#00ff41]/8 p-4 text-sm leading-6 text-[#9dffb8]">
                                        Sign once with your wallet to manage alert rules. No transaction is created and no funds can move.
                                    </div>
                                    {authError ? (
                                        <div className="border border-[#ff8f70]/20 bg-[#ff8f70]/8 p-3 text-sm leading-6 text-[#ffb39f]">
                                            {authError}
                                        </div>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={() => signInMutation.mutate()}
                                        disabled={signInMutation.isPending || !signMessage}
                                        className="inline-flex h-11 items-center justify-center gap-2 border border-[#00ff41]/24 bg-[#00ff41]/10 px-4 text-[11px] tracking-[0.18em] text-[#9dffb8] transition-all hover:bg-[#00ff41]/14 disabled:cursor-not-allowed disabled:opacity-45"
                                    >
                                        <Shield className="h-4 w-4" />
                                        {signInMutation.isPending ? "WAITING FOR SIGNATURE..." : "SIGN IN FOR ALERTS"}
                                    </button>
                                    {!signMessage ? (
                                        <p className="text-[11px] leading-6 text-white/55">
                                            This wallet adapter does not expose `signMessage`. Use Phantom or Solflare for alert authorization.
                                        </p>
                                    ) : null}
                                </div>
                            ) : (
                                <AlertCenterBody
                                    walletAddress={walletAddress}
                                    draft={activeDraft}
                                    setDraft={setDraft}
                                    pushStatus={pushStatus}
                                    alertsQuery={alertsQuery}
                                    notifications={notifications}
                                    unreadCount={unreadCount}
                                    savePending={saveMutation.isPending}
                                    syncPending={syncMutation.isPending}
                                    pushPending={pushMutation.isPending}
                                    logoutPending={logoutMutation.isPending}
                                    markAllPending={markAllMutation.isPending}
                                    onSave={() => draft ? saveMutation.mutate(draft) : undefined}
                                    onSync={() => syncMutation.mutate()}
                                    onTogglePush={() => draft ? pushMutation.mutate(!draft.browserPushEnabled) : undefined}
                                    onMarkAll={() => markAllMutation.mutate()}
                                    onResetSession={() => logoutMutation.mutate()}
                                    onRefresh={async () => {
                                        await queryClient.invalidateQueries({ queryKey: [QUERY_KEY_BASE, walletAddress] });
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}

function AlertCenterBody({
    walletAddress,
    draft,
    setDraft,
    pushStatus,
    alertsQuery,
    notifications,
    unreadCount,
    savePending,
    syncPending,
    pushPending,
    logoutPending,
    markAllPending,
    onSave,
    onSync,
    onTogglePush,
    onMarkAll,
    onResetSession,
    onRefresh,
}: {
    walletAddress: string;
    draft: AlertPreferenceState | null;
    setDraft: Dispatch<SetStateAction<AlertPreferenceState | null>>;
    pushStatus: PushStatus;
    alertsQuery: UseQueryResult<AlertStateResponse, Error>;
    notifications: AlertNotificationItem[];
    unreadCount: number;
    savePending: boolean;
    syncPending: boolean;
    pushPending: boolean;
    logoutPending: boolean;
    markAllPending: boolean;
    onSave: () => void;
    onSync: () => void;
    onTogglePush: () => void;
    onMarkAll: () => void;
    onResetSession: () => void;
    onRefresh: () => Promise<void>;
}) {
    return (
        <div className="space-y-5 px-4 py-5">
            <div className="grid gap-3 sm:grid-cols-3">
                <SmallStat label="UNREAD" value={String(unreadCount)} icon={<Bell className="h-4 w-4" />} />
                <SmallStat label="PUSH" value={pushStatus === "subscribed" ? "ARMED" : "OFF"} icon={<Smartphone className="h-4 w-4" />} />
                <SmallStat label="TG" value={draft?.telegramEnabled ? "ARMED" : "OFF"} icon={<Send className="h-4 w-4" />} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <ActionButton
                    label={syncPending ? "SYNCING..." : "SYNC NOW"}
                    icon={<RefreshCw className={cn("h-3.5 w-3.5", syncPending && "animate-spin")} />}
                    onClick={onSync}
                    disabled={syncPending}
                />
                <ActionButton
                    label="MARK ALL READ"
                    icon={<CheckCheck className="h-3.5 w-3.5" />}
                    onClick={onMarkAll}
                    disabled={markAllPending || unreadCount === 0}
                />
                <ActionButton
                    label="RESET SESSION"
                    icon={<BellOff className="h-3.5 w-3.5" />}
                    onClick={onResetSession}
                    disabled={logoutPending}
                    tone="danger"
                />
            </div>

            <section className="border border-[#00ff41]/12 bg-black/35 p-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff41]/52">Delivery Channels</p>
                        <h4 className="mt-1 text-sm tracking-[0.16em] text-[#d8ffe6]">Where alerts should go</h4>
                    </div>
                    {draft?.updatedAt ? (
                        <span className="text-[10px] tracking-[0.16em] text-white/42">
                            updated {formatDistanceToNowStrict(new Date(draft.updatedAt), { addSuffix: true })}
                        </span>
                    ) : null}
                </div>

                {draft ? (
                    <div className="mt-4 space-y-4">
                        <ToggleRow
                            label="In-app inbox"
                            description="Keep alert history directly inside BagScan."
                            checked={draft.inAppEnabled}
                            onChange={(checked) => setDraft({ ...draft, inAppEnabled: checked })}
                        />
                        <div className="flex flex-col gap-3 border border-white/8 bg-white/[0.02] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.18em] text-[#d8ffe6]">Browser push</p>
                                <p className="mt-2 text-sm leading-6 text-white/52">
                                    {!alertsQuery.data?.config.browserPushConfigured
                                        ? "Server VAPID keys are not configured yet."
                                        : pushStatus === "permission-denied"
                                            ? "Browser notification permission is currently blocked."
                                            : "Push alerts can fire even when the tab is not focused."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onTogglePush}
                                disabled={pushPending || !alertsQuery.data?.config.browserPushConfigured}
                                className={cn(
                                    "inline-flex h-9 items-center gap-2 border px-3 text-[10px] tracking-[0.16em] transition-all disabled:cursor-not-allowed disabled:opacity-45",
                                    draft.browserPushEnabled
                                        ? "border-[#ffaa00]/20 bg-[#ffaa00]/10 text-[#ffd37a]"
                                        : "border-[#00aaff]/18 bg-[#00aaff]/10 text-[#8dd8ff]"
                                )}
                            >
                                <Smartphone className="h-3.5 w-3.5" />
                                {pushPending ? "UPDATING..." : draft.browserPushEnabled ? "DISABLE PUSH" : "ENABLE PUSH"}
                            </button>
                        </div>
                        <ToggleRow
                            label="Telegram alerts"
                            description={
                                alertsQuery.data?.config.telegramConfigured
                                    ? "Send alerts to your Telegram chat or group."
                                    : "Set TELEGRAM_BOT_TOKEN first to enable Telegram delivery."
                            }
                            checked={draft.telegramEnabled}
                            disabled={!alertsQuery.data?.config.telegramConfigured}
                            onChange={(checked) => setDraft({ ...draft, telegramEnabled: checked })}
                        />
                        <TextField
                            label="Telegram Chat ID"
                            value={draft.telegramChatId ?? ""}
                            placeholder="123456789 or -100..."
                            onChange={(value) => setDraft({ ...draft, telegramChatId: value })}
                        />
                    </div>
                ) : null}
            </section>

            <section className="border border-[#00ff41]/12 bg-black/35 p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff41]/52">Alert Rules</p>
                <h4 className="mt-1 text-sm tracking-[0.16em] text-[#d8ffe6]">What should trigger</h4>
                {draft ? (
                    <div className="mt-4 space-y-4">
                        <ToggleRow
                            label="Trending alpha"
                            description="Notify when a Bags token becomes hot right now."
                            checked={draft.alphaHotEnabled}
                            onChange={(checked) => setDraft({ ...draft, alphaHotEnabled: checked })}
                        />
                        <ToggleRow
                            label="Critical alpha"
                            description="Notify when alpha score or signals turn critical."
                            checked={draft.alphaCriticalEnabled}
                            onChange={(checked) => setDraft({ ...draft, alphaCriticalEnabled: checked })}
                        />
                        <ToggleRow
                            label="Profit target"
                            description="Notify when a holding rises above your unrealized PnL target."
                            checked={draft.portfolioProfitEnabled}
                            onChange={(checked) => setDraft({ ...draft, portfolioProfitEnabled: checked })}
                        />
                        <NumberField
                            label="Profit threshold %"
                            value={draft.profitThresholdPercent}
                            onChange={(value) => setDraft({ ...draft, profitThresholdPercent: value })}
                        />
                        <ToggleRow
                            label="Drawdown protection"
                            description="Notify when a holding drops below your unrealized PnL floor."
                            checked={draft.portfolioDrawdownEnabled}
                            onChange={(checked) => setDraft({ ...draft, portfolioDrawdownEnabled: checked })}
                        />
                        <NumberField
                            label="Drawdown threshold %"
                            value={draft.drawdownThresholdPercent}
                            onChange={(value) => setDraft({ ...draft, drawdownThresholdPercent: value })}
                        />
                        <ToggleRow
                            label="Claimable Bags fees"
                            description="Notify when claimable fee-share crosses your SOL threshold."
                            checked={draft.feesEnabled}
                            onChange={(checked) => setDraft({ ...draft, feesEnabled: checked })}
                        />
                        <NumberField
                            label="Claimable SOL threshold"
                            value={draft.claimableFeesThresholdSol}
                            step="0.05"
                            onChange={(value) => setDraft({ ...draft, claimableFeesThresholdSol: value })}
                        />
                    </div>
                ) : null}
            </section>

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={onSave}
                    disabled={!draft || savePending}
                    className="inline-flex h-11 items-center gap-2 border border-[#00ff41]/22 bg-[#00ff41]/10 px-4 text-[11px] tracking-[0.18em] text-[#9dffb8] transition-all hover:bg-[#00ff41]/14 disabled:cursor-not-allowed disabled:opacity-45"
                >
                    <Sparkles className="h-4 w-4" />
                    {savePending ? "SAVING..." : "SAVE SETTINGS"}
                </button>
                <button
                    type="button"
                    onClick={() => void onRefresh()}
                    className="inline-flex h-11 items-center gap-2 border border-white/10 bg-white/[0.03] px-4 text-[11px] tracking-[0.18em] text-white/72 transition-all hover:bg-white/[0.07]"
                >
                    REFRESH
                </button>
                <Link
                    href="/alpha"
                    className="inline-flex h-11 items-center gap-2 border border-[#00aaff]/18 bg-[#00aaff]/10 px-4 text-[11px] tracking-[0.18em] text-[#8dd8ff] transition-all hover:bg-[#00aaff]/14"
                >
                    OPEN ALPHA
                </Link>
                <Link
                    href={`/portfolio?wallet=${walletAddress}`}
                    className="inline-flex h-11 items-center gap-2 border border-[#ffaa00]/18 bg-[#ffaa00]/10 px-4 text-[11px] tracking-[0.18em] text-[#ffd37a] transition-all hover:bg-[#ffaa00]/14"
                >
                    OPEN PORTFOLIO
                </Link>
            </div>

            <section className="border border-[#00ff41]/12 bg-black/35">
                <div className="flex items-center justify-between gap-3 border-b border-[#00ff41]/10 px-4 py-3">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff41]/52">Inbox</p>
                        <h4 className="mt-1 text-sm tracking-[0.16em] text-[#d8ffe6]">Recent notifications</h4>
                    </div>
                    <span className="text-[10px] tracking-[0.16em] text-white/42">{notifications.length} items</span>
                </div>

                <div className="max-h-[320px] overflow-y-auto">
                    {alertsQuery.isLoading ? (
                        <div className="space-y-3 p-4">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <div key={index} className="animate-pulse border border-[#00ff41]/10 bg-black/45 p-3">
                                    <div className="h-3 w-32 bg-[#00ff41]/10" />
                                    <div className="mt-3 h-3 w-full bg-[#00ff41]/8" />
                                </div>
                            ))}
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="p-4 text-sm leading-6 text-[#00ff41]/42">
                            No alerts yet. Use Sync Now after saving your rules to generate your first notifications.
                        </div>
                    ) : (
                        <div className="divide-y divide-[#00ff41]/8">
                            {notifications.map((notification) => (
                                <NotificationRow
                                    key={notification.id}
                                    wallet={walletAddress}
                                    notification={notification}
                                    onMarked={onRefresh}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

function SmallStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
    return (
        <div className="border border-[#00ff41]/12 bg-black/35 p-3">
            <div className="flex items-center justify-between gap-3 text-[#9dffb8]">
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/46">{label}</span>
                {icon}
            </div>
            <p className="mt-3 text-lg tracking-[0.1em] text-[#f3fff6]">{value}</p>
        </div>
    );
}

function ActionButton({
    label,
    icon,
    onClick,
    disabled,
    tone = "default",
}: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    tone?: "default" | "danger";
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "inline-flex h-9 items-center gap-2 border px-3 text-[10px] tracking-[0.16em] transition-all disabled:cursor-not-allowed disabled:opacity-45",
                tone === "default"
                    ? "border-[#00ff41]/16 bg-[#00ff41]/8 text-[#9dffb8] hover:bg-[#00ff41]/12"
                    : "border-[#ff8f70]/20 bg-[#ff8f70]/10 text-[#ffb39f] hover:bg-[#ff8f70]/14"
            )}
        >
            {icon}
            {label}
        </button>
    );
}

function ToggleRow({
    label,
    description,
    checked,
    onChange,
    disabled,
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <label className="flex items-start justify-between gap-4 border border-white/8 bg-white/[0.02] px-3 py-3">
            <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#d8ffe6]">{label}</p>
                <p className="mt-2 text-sm leading-6 text-white/52">{description}</p>
            </div>
            <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[#00ff41]"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
            />
        </label>
    );
}

function TextField({
    label,
    value,
    placeholder,
    onChange,
}: {
    label: string;
    value: string;
    placeholder: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="space-y-2">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-white/48">{label}</label>
            <input
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
                className="h-10 w-full border border-white/12 bg-black/45 px-3 text-sm text-[#d8ffe6] outline-none transition-colors focus:border-[#00ff41]/36"
            />
        </div>
    );
}

function NumberField({
    label,
    value,
    onChange,
    step = "1",
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    step?: string;
}) {
    return (
        <div className="space-y-2">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-white/48">{label}</label>
            <input
                type="number"
                step={step}
                value={Number.isFinite(value) ? value : 0}
                onChange={(event) => onChange(Number(event.target.value))}
                className="h-10 w-full border border-white/12 bg-black/45 px-3 text-sm text-[#d8ffe6] outline-none transition-colors focus:border-[#00ff41]/36"
            />
        </div>
    );
}

function NotificationRow({
    wallet,
    notification,
    onMarked,
}: {
    wallet: string;
    notification: AlertNotificationItem;
    onMarked: () => Promise<void>;
}) {
    const markMutation = useMutation({
        mutationFn: async () => markAlertsAsRead(wallet, { ids: [notification.id] }),
        onSuccess: onMarked,
    });

    const severityClass =
        notification.severity === "critical"
            ? "border-[#ff8f70]/18 bg-[#ff8f70]/10 text-[#ffb39f]"
            : notification.severity === "hot"
                ? "border-[#ffaa00]/18 bg-[#ffaa00]/10 text-[#ffd37a]"
                : "border-[#00aaff]/18 bg-[#00aaff]/10 text-[#8dd8ff]";

    return (
        <div className="flex gap-3 px-4 py-3">
            <div className="pt-1">
                <span
                    className={cn(
                        "block h-2.5 w-2.5 rounded-full",
                        notification.readAt ? "bg-white/18" : "bg-[#00ff41] shadow-[0_0_10px_rgba(0,255,65,0.6)]"
                    )}
                />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("border px-1.5 py-0.5 text-[9px] tracking-[0.18em]", severityClass)}>
                        {notification.severity.toUpperCase()}
                    </span>
                    <p className="text-sm tracking-[0.08em] text-[#d8ffe6]">{notification.title}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/58">{notification.message}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] tracking-[0.16em] text-white/40">
                        {formatDistanceToNowStrict(new Date(notification.createdAt), { addSuffix: true })}
                    </span>
                    {notification.actionUrl ? (
                        <Link
                            href={notification.actionUrl}
                            className="text-[10px] tracking-[0.16em] text-[#8dd8ff] underline-offset-4 hover:underline"
                        >
                            OPEN
                        </Link>
                    ) : null}
                    {!notification.readAt ? (
                        <button
                            type="button"
                            onClick={() => markMutation.mutate()}
                            disabled={markMutation.isPending}
                            className="text-[10px] tracking-[0.16em] text-[#9dffb8] underline-offset-4 hover:underline disabled:opacity-40"
                        >
                            MARK READ
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
