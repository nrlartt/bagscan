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
    fetchAlertAccess,
    fetchAlertState,
    fetchTelegramConnectState,
    logoutAlertSession,
    markAlertsAsRead,
    requestAlertSession,
    sendTestAlert,
    subscribeBrowserPush,
    syncAlertState,
    unsubscribeBrowserPush,
    updateAlertSettings,
} from "@/lib/alerts/client";
import type {
    AlertAccessState,
    AlertNotificationItem,
    AlertPreferenceState,
    AlertStateResponse,
    AlertTelegramConnectState,
} from "@/lib/alerts/types";
import { cn, shortenAddress } from "@/lib/utils";

type PushStatus = "unknown" | "unsupported" | "permission-denied" | "not-subscribed" | "subscribed";

const QUERY_KEY_BASE = "bagscan-alert-center";
const SCAN_MINT = "BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS";
const SCAN_BAGS_URL = `https://bags.fm/${SCAN_MINT}`;

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
    const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const connectedTelegramChatIdRef = useRef<string | null>(null);
    const accessQuery = useQuery<AlertAccessState>({
        queryKey: [QUERY_KEY_BASE, "access", walletAddress],
        enabled: connected && Boolean(walletAddress) && (open || sessionState === "authorized"),
        queryFn: async () => fetchAlertAccess(walletAddress),
        retry: false,
        staleTime: 20_000,
        refetchInterval: open || sessionState === "authorized" ? 60_000 : false,
        refetchOnWindowFocus: false,
    });
    const alertAccess = accessQuery.data;
    const alertAccessEligible = alertAccess?.eligible ?? false;

    const alertsQuery = useQuery<AlertStateResponse>({
        queryKey: [QUERY_KEY_BASE, walletAddress],
        enabled:
            connected &&
            Boolean(walletAddress) &&
            (open || sessionState === "authorized") &&
            alertAccessEligible,
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

    const telegramConnectQuery = useQuery<AlertTelegramConnectState>({
        queryKey: [QUERY_KEY_BASE, "telegram-connect", walletAddress],
        enabled: open && signedIn && alertAccessEligible && Boolean(walletAddress),
        queryFn: async () => fetchTelegramConnectState(walletAddress),
        retry: false,
        staleTime: 0,
        refetchInterval:
            open &&
            signedIn &&
            Boolean(walletAddress) &&
            Boolean(alertsQuery.data?.config.telegramConfigured) &&
            !(draft ?? alertsQuery.data?.preference ?? null)?.telegramChatId
                ? 5_000
                : false,
        refetchOnWindowFocus: false,
    });
    const activeDraft = (() => {
        const nextDraft = draft ?? alertsQuery.data?.preference ?? null;
        const telegramChatId = telegramConnectQuery.data?.chatId?.trim();

        if (!nextDraft || !telegramChatId || nextDraft.telegramChatId === telegramChatId) {
            return nextDraft;
        }

        return {
            ...nextDraft,
            telegramChatId,
            telegramEnabled: true,
        };
    })();

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

    useEffect(() => {
        const chatId = telegramConnectQuery.data?.chatId?.trim();
        if (!chatId || connectedTelegramChatIdRef.current === chatId) {
            return;
        }

        connectedTelegramChatIdRef.current = chatId;
        void queryClient.invalidateQueries({ queryKey: [QUERY_KEY_BASE, walletAddress] });
    }, [
        queryClient,
        telegramConnectQuery.data?.chatId,
        walletAddress,
    ]);

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
            setFeedback({ tone: "success", text: "Alert settings saved." });
            queryClient.setQueryData([QUERY_KEY_BASE, walletAddress], state);
        },
        onError: (error) => {
            setFeedback({
                tone: "error",
                text: error instanceof Error ? error.message : "Failed to save alert settings.",
            });
        },
    });

    const syncMutation = useMutation({
        mutationFn: async () => syncAlertState(walletAddress),
        onSuccess: ({ state }) => {
            setFeedback({ tone: "success", text: "Alert scan completed." });
            queryClient.setQueryData([QUERY_KEY_BASE, walletAddress], state);
        },
        onError: (error) => {
            setFeedback({
                tone: "error",
                text: error instanceof Error ? error.message : "Alert sync failed.",
            });
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
            setFeedback({ tone: "success", text: "Alerts authorized for this wallet." });
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
            connectedTelegramChatIdRef.current = null;
            setFeedback({ tone: "success", text: "Alert session cleared." });
            setDraft(null);
            await queryClient.removeQueries({ queryKey: [QUERY_KEY_BASE, walletAddress] });
        },
    });

    const markAllMutation = useMutation({
        mutationFn: async () => markAlertsAsRead(walletAddress, { all: true }),
        onSuccess: async () => {
            setFeedback({ tone: "success", text: "All notifications marked as read." });
            await queryClient.invalidateQueries({ queryKey: [QUERY_KEY_BASE, walletAddress] });
        },
        onError: (error) => {
            setFeedback({
                tone: "error",
                text: error instanceof Error ? error.message : "Failed to update notifications.",
            });
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
            setFeedback({
                tone: "success",
                text: state.preference.browserPushEnabled
                    ? "Browser push enabled."
                    : "Browser push disabled.",
            });
            queryClient.setQueryData([QUERY_KEY_BASE, walletAddress], state);
        },
        onError: (error) => {
            setFeedback({
                tone: "error",
                text: error instanceof Error ? error.message : "Failed to update browser push.",
            });
        },
    });

    const testMutation = useMutation({
        mutationFn: async (channel: "inbox" | "push" | "telegram") =>
            sendTestAlert(walletAddress, channel),
        onSuccess: async ({ message }) => {
            setFeedback({ tone: "success", text: message });
            await queryClient.invalidateQueries({ queryKey: [QUERY_KEY_BASE, walletAddress] });
        },
        onError: (error) => {
            setFeedback({
                tone: "error",
                text: error instanceof Error ? error.message : "Test alert failed.",
            });
        },
    });

    const unreadCount = alertsQuery.data?.unreadCount ?? 0;
    const notifications = alertsQuery.data?.notifications ?? [];
    const checkingAccess =
        connected &&
        Boolean(walletAddress) &&
        (open || sessionState === "authorized") &&
        accessQuery.isLoading &&
        !alertAccess;
    const accessBlocked = connected && Boolean(walletAddress) && Boolean(alertAccess) && !alertAccessEligible;
    const accessError = accessQuery.error instanceof Error ? accessQuery.error.message : null;

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
                    <div className="fixed inset-x-3 top-[4.5rem] z-50 max-h-[calc(100vh-6rem)] overflow-y-auto border border-[#00ff41]/18 bg-[#021109]/96 shadow-[0_30px_90px_rgba(0,0,0,0.55),0_0_40px_rgba(0,255,65,0.08)] backdrop-blur-xl sm:absolute sm:right-0 sm:left-auto sm:top-[calc(100%+14px)] sm:w-[680px] sm:max-w-[94vw] sm:max-h-[80vh]">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,255,65,0.1),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(0,170,255,0.1),transparent_40%)]" />
                        <div className="relative">
                            <div className="flex items-start justify-between gap-3 border-b border-[#00ff41]/12 px-4 py-4">
                                <div>
                                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#00ff41]/55">
                                        <Bell className="h-3.5 w-3.5" />
                                        Notification Center
                                    </div>
                                    <h3 className="mt-2 text-lg tracking-[0.16em] text-[#d8ffe6]">
                                        {!connected
                                            ? "NOTIFICATIONS"
                                            : checkingAccess
                                                ? "VERIFYING ACCESS"
                                                : accessBlocked
                                                    ? "ALERT ACCESS LOCKED"
                                                    : signedIn
                                                        ? "SMART ALERTS"
                                                        : "AUTHORIZE ALERTS"}
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
                            ) : checkingAccess ? (
                                <div className="space-y-4 px-4 py-5">
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <SmallStat label="ACCESS" value="CHECKING" icon={<Shield className="h-4 w-4" />} />
                                        <SmallStat label="MIN" value="2.5M" icon={<Sparkles className="h-4 w-4" />} />
                                        <SmallStat label="TOKEN" value="$SCAN" icon={<Bell className="h-4 w-4" />} />
                                    </div>
                                    <div className="border border-[#00ff41]/14 bg-[#00ff41]/8 p-4 text-sm leading-6 text-[#9dffb8]">
                                        Verifying whether this wallet meets the 2.5 million $SCAN holder requirement for Smart Alerts.
                                    </div>
                                </div>
                            ) : accessQuery.isError ? (
                                <div className="space-y-4 px-4 py-5">
                                    <div className="border border-[#ff8f70]/20 bg-[#ff8f70]/8 p-4 text-sm leading-6 text-[#ffb39f]">
                                        {accessError ?? "BagScan could not verify your $SCAN balance right now. Try refreshing in a moment."}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <ActionButton
                                            label={accessQuery.isFetching ? "CHECKING..." : "RETRY ACCESS CHECK"}
                                            icon={<RefreshCw className={cn("h-3.5 w-3.5", accessQuery.isFetching && "animate-spin")} />}
                                            onClick={() => void accessQuery.refetch()}
                                            disabled={accessQuery.isFetching}
                                        />
                                    </div>
                                </div>
                            ) : accessBlocked && alertAccess ? (
                                <AlertAccessLockedPanel
                                    access={alertAccess}
                                    onRefresh={() => void accessQuery.refetch()}
                                    checking={accessQuery.isFetching}
                                />
                            ) : !signedIn ? (
                                <div className="space-y-4 px-4 py-5">
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <SmallStat label="IN-APP" value="INBOX" icon={<Sparkles className="h-4 w-4" />} />
                                        <SmallStat label="BROWSER" value="PUSH" icon={<Smartphone className="h-4 w-4" />} />
                                        <SmallStat label="TELEGRAM" value="BOT" icon={<Send className="h-4 w-4" />} />
                                    </div>
                                    {alertAccess ? (
                                        <div className="border border-[#00aaff]/18 bg-[#00aaff]/10 p-4 text-sm leading-6 text-[#8dd8ff]">
                                            Holder access verified. {alertAccess.balanceUi} $SCAN detected against the {alertAccess.requiredUi} $SCAN requirement.
                                        </div>
                                    ) : null}
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
                                    access={alertsQuery.data?.config.access ?? alertAccess ?? null}
                                    draft={activeDraft}
                                    setDraft={setDraft}
                                    setFeedback={setFeedback}
                                    pushStatus={pushStatus}
                                    alertsQuery={alertsQuery}
                                    telegramConnectQuery={telegramConnectQuery}
                                    notifications={notifications}
                                    unreadCount={unreadCount}
                                    feedback={feedback}
                                    savePending={saveMutation.isPending}
                                    syncPending={syncMutation.isPending}
                                    pushPending={pushMutation.isPending}
                                    logoutPending={logoutMutation.isPending}
                                    markAllPending={markAllMutation.isPending}
                                    testPending={testMutation.isPending}
                                    onSave={() => activeDraft ? saveMutation.mutate(activeDraft) : undefined}
                                    onSync={() => syncMutation.mutate()}
                                    onTogglePush={() => activeDraft ? pushMutation.mutate(!activeDraft.browserPushEnabled) : undefined}
                                    onMarkAll={() => markAllMutation.mutate()}
                                    onResetSession={() => logoutMutation.mutate()}
                                    onSendTest={(channel) => testMutation.mutate(channel)}
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
    access,
    draft,
    setDraft,
    setFeedback,
    pushStatus,
    alertsQuery,
    telegramConnectQuery,
    notifications,
    unreadCount,
    feedback,
    savePending,
    syncPending,
    pushPending,
    logoutPending,
    markAllPending,
    testPending,
    onSave,
    onSync,
    onTogglePush,
    onMarkAll,
    onResetSession,
    onSendTest,
    onRefresh,
}: {
    walletAddress: string;
    access: AlertAccessState | null;
    draft: AlertPreferenceState | null;
    setDraft: Dispatch<SetStateAction<AlertPreferenceState | null>>;
    setFeedback: Dispatch<SetStateAction<{ tone: "success" | "error"; text: string } | null>>;
    pushStatus: PushStatus;
    alertsQuery: UseQueryResult<AlertStateResponse, Error>;
    telegramConnectQuery: UseQueryResult<AlertTelegramConnectState, Error>;
    notifications: AlertNotificationItem[];
    unreadCount: number;
    feedback: { tone: "success" | "error"; text: string } | null;
    savePending: boolean;
    syncPending: boolean;
    pushPending: boolean;
    logoutPending: boolean;
    markAllPending: boolean;
    testPending: boolean;
    onSave: () => void;
    onSync: () => void;
    onTogglePush: () => void;
    onMarkAll: () => void;
    onResetSession: () => void;
    onSendTest: (channel: "inbox" | "push" | "telegram") => void;
    onRefresh: () => Promise<void>;
}) {
    const [sectionOpen, setSectionOpen] = useState({
        setup: false,
        rules: false,
        inbox: false,
    });
    const telegramConfigured = Boolean(alertsQuery.data?.config.telegramConfigured);
    const browserPushConfigured = Boolean(alertsQuery.data?.config.browserPushConfigured);
    const telegramConnected = Boolean(telegramConnectQuery.data?.connected && draft?.telegramChatId?.trim());
    const telegramChatLabel = telegramConnectQuery.data?.chatLabel?.trim() || "Telegram connected";
    const telegramConnectCommand = telegramConnectQuery.data?.connectCommand?.trim() || "";
    const unreadLabel = unreadCount === 1 ? "1 unread" : `${unreadCount} unread`;
    const pushSummary =
        !browserPushConfigured
            ? "Server off"
            : pushStatus === "subscribed"
                ? "Armed"
                : pushStatus === "permission-denied"
                    ? "Blocked"
                    : pushStatus === "unsupported"
                        ? "Unsupported"
                        : "Off";
    const telegramSummary =
        !telegramConfigured ? "Bot off" : telegramConnected ? "Connected" : "Needs setup";
    const armedRulesCount = [
        draft?.alphaHotEnabled,
        draft?.alphaCriticalEnabled,
        draft?.portfolioProfitEnabled,
        draft?.portfolioDrawdownEnabled,
        draft?.feesEnabled,
    ].filter(Boolean).length;

    return (
        <div className="space-y-5 px-4 py-5">
            {access ? (
                <div className="border border-[#00aaff]/18 bg-[#00aaff]/10 px-3 py-3 text-sm leading-6 text-[#8dd8ff]">
                    Alerts unlocked. {access.balanceUi} $SCAN verified for this wallet.
                </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
                <StatusSummary
                    label="INBOX"
                    value={draft?.inAppEnabled ? "ON" : "OFF"}
                    note={unreadLabel}
                    icon={<Bell className="h-4 w-4" />}
                />
                <StatusSummary
                    label="BROWSER PUSH"
                    value={pushSummary}
                    note={browserPushConfigured ? "notification delivery" : "server setup missing"}
                    icon={<Smartphone className="h-4 w-4" />}
                />
                <StatusSummary
                    label="TELEGRAM"
                    value={telegramSummary}
                    note={telegramConnected ? telegramChatLabel : "connect once, then test"}
                    icon={<Send className="h-4 w-4" />}
                />
            </div>

            {feedback ? (
                <div
                    className={cn(
                        "border px-3 py-3 text-sm leading-6",
                        feedback.tone === "success"
                            ? "border-[#00ff41]/16 bg-[#00ff41]/8 text-[#9dffb8]"
                            : "border-[#ff8f70]/20 bg-[#ff8f70]/8 text-[#ffb39f]"
                    )}
                >
                    {feedback.text}
                </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-3">
                <button
                    type="button"
                    onClick={onSave}
                    disabled={!draft || savePending}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 border border-[#00ff41]/26 bg-[linear-gradient(180deg,rgba(0,255,65,0.14),rgba(0,255,65,0.06))] px-4 text-[11px] tracking-[0.18em] text-[#c9ffd8] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_18px_rgba(0,255,65,0.08)] transition-all hover:border-[#00ff41]/44 hover:bg-[linear-gradient(180deg,rgba(0,255,65,0.18),rgba(0,255,65,0.08))] disabled:cursor-not-allowed disabled:opacity-45"
                >
                    <Sparkles className="h-4 w-4" />
                    {savePending ? "SAVING..." : "SAVE SETTINGS"}
                </button>
                <button
                    type="button"
                    onClick={onSync}
                    disabled={syncPending}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 border border-[#00aaff]/22 bg-[linear-gradient(180deg,rgba(0,170,255,0.14),rgba(0,170,255,0.06))] px-4 text-[11px] tracking-[0.18em] text-[#b7ebff] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_18px_rgba(0,170,255,0.08)] transition-all hover:border-[#00aaff]/40 hover:bg-[linear-gradient(180deg,rgba(0,170,255,0.18),rgba(0,170,255,0.08))] disabled:cursor-not-allowed disabled:opacity-45"
                >
                    <RefreshCw className={cn("h-4 w-4", syncPending && "animate-spin")} />
                    {syncPending ? "SYNCING..." : "SYNC NOW"}
                </button>
                <button
                    type="button"
                    onClick={onResetSession}
                    disabled={logoutPending}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 border border-[#ff8f70]/24 bg-[linear-gradient(180deg,rgba(255,143,112,0.14),rgba(255,143,112,0.06))] px-4 text-[11px] tracking-[0.18em] text-[#ffbea8] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_18px_rgba(255,143,112,0.08)] transition-all hover:border-[#ff8f70]/40 hover:bg-[linear-gradient(180deg,rgba(255,143,112,0.18),rgba(255,143,112,0.08))] disabled:cursor-not-allowed disabled:opacity-45"
                >
                    <BellOff className="h-4 w-4" />
                    RESET SESSION
                </button>
            </div>

            {draft ? (
                <section className="border border-[#00ff41]/12 bg-black/35 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff41]/52">Setup</p>
                            <h4 className="mt-1 text-base tracking-[0.08em] text-[#d8ffe6]">Choose channels and keep them tested</h4>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSectionOpen((current) => ({ ...current, setup: !current.setup }))}
                            className="inline-flex h-8 items-center justify-center border border-white/10 bg-white/[0.03] px-3 text-[10px] tracking-[0.16em] text-white/68 transition-all hover:bg-white/[0.07]"
                        >
                            {sectionOpen.setup ? "HIDE" : "SHOW"}
                        </button>
                    </div>
                    {sectionOpen.setup ? (
                    <div className="mt-4 grid gap-4">
                        <ChannelCard
                            title="In-app inbox"
                            status={draft.inAppEnabled ? "ACTIVE" : "PAUSED"}
                            description="Keep your alert history inside BagScan."
                        >
                            <InlineToggle
                                label="Store alerts in BagScan"
                                checked={draft.inAppEnabled}
                                onChange={(checked) => setDraft({ ...draft, inAppEnabled: checked })}
                            />
                            <div className="mt-4 flex items-center justify-between text-[10px] tracking-[0.16em] text-white/42">
                                <span>{unreadLabel}</span>
                                <button
                                    type="button"
                                    onClick={() => onSendTest("inbox")}
                                    disabled={testPending}
                                    className="text-[#8dd8ff] transition-colors hover:text-[#b7ebff] disabled:opacity-45"
                                >
                                    {testPending ? "SENDING..." : "TEST INBOX"}
                                </button>
                            </div>
                        </ChannelCard>

                        <ChannelCard
                            title="Browser push"
                            status={pushSummary.toUpperCase()}
                            description={
                                !browserPushConfigured
                                    ? "Push is not configured on the server yet."
                                    : pushStatus === "permission-denied"
                                        ? "Browser permission is blocked. Allow notifications and try again."
                                        : "Enable push for alerts outside the active tab."
                            }
                        >
                            <button
                                type="button"
                                onClick={onTogglePush}
                                disabled={pushPending || !browserPushConfigured}
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
                            <div className="mt-4 flex items-center justify-between text-[10px] tracking-[0.16em] text-white/42">
                                <span>{draft.browserPushEnabled ? "ready to deliver" : "not armed yet"}</span>
                                <button
                                    type="button"
                                    onClick={() => onSendTest("push")}
                                    disabled={testPending || pushPending || !browserPushConfigured || !draft.browserPushEnabled}
                                    className="text-[#8dd8ff] transition-colors hover:text-[#b7ebff] disabled:opacity-45"
                                >
                                    {testPending ? "SENDING..." : "TEST PUSH"}
                                </button>
                            </div>
                        </ChannelCard>

                        <ChannelCard
                            title="Telegram"
                            status={telegramSummary.toUpperCase()}
                            description={
                                telegramConnected
                                    ? `Connected to ${telegramChatLabel}.`
                                    : telegramConnectQuery.data?.error
                                        ? telegramConnectQuery.data.error
                                        : "Connect once, then BagScan can deliver alerts directly to your Telegram chat."
                            }
                        >
                            {telegramConnected ? (
                                <>
                                    <InlineToggle
                                        label="Send alerts to Telegram"
                                        checked={draft.telegramEnabled}
                                        disabled={!telegramConfigured}
                                        onChange={(checked) => setDraft({ ...draft, telegramEnabled: checked })}
                                    />
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {telegramConnectQuery.data?.botUrl ? (
                                            <a
                                                href={telegramConnectQuery.data.botUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex h-9 items-center gap-2 border border-[#00aaff]/18 bg-[#00aaff]/10 px-3 text-[10px] tracking-[0.16em] text-[#8dd8ff] transition-all hover:bg-[#00aaff]/14"
                                            >
                                                OPEN BOT
                                            </a>
                                        ) : null}
                                        <button
                                            type="button"
                                            onClick={() => onSendTest("telegram")}
                                            disabled={testPending || !telegramConfigured || !draft.telegramEnabled || !draft.telegramChatId?.trim()}
                                            className="inline-flex h-9 items-center gap-2 border border-[#ffaa00]/18 bg-[#ffaa00]/10 px-3 text-[10px] tracking-[0.16em] text-[#ffd37a] transition-all hover:bg-[#ffaa00]/14 disabled:cursor-not-allowed disabled:opacity-45"
                                        >
                                            <Send className="h-3.5 w-3.5" />
                                            {testPending ? "SENDING..." : "TEST TG"}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-2 border border-[#00ff41]/10 bg-black/30 px-3 py-3 text-[11px] leading-6 text-white/56">
                                        <p>1. Press <span className="text-[#9dffb8]">CONNECT TELEGRAM</span>.</p>
                                        <p>2. If the bot opens without linking, use <span className="text-[#ffd37a]">COPY COMMAND</span> and send it once.</p>
                                        <p>3. Come back and press <span className="text-[#8dd8ff]">CHECK STATUS</span>.</p>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {telegramConnectQuery.data?.connectUrl ? (
                                            <a
                                                href={telegramConnectQuery.data.connectUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex h-9 items-center gap-2 border border-[#00aaff]/18 bg-[#00aaff]/10 px-3 text-[10px] tracking-[0.16em] text-[#8dd8ff] transition-all hover:bg-[#00aaff]/14"
                                            >
                                                <Send className="h-3.5 w-3.5" />
                                                CONNECT TELEGRAM
                                            </a>
                                        ) : null}
                                        {telegramConnectCommand ? (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        await navigator.clipboard.writeText(telegramConnectCommand);
                                                        setFeedback({ tone: "success", text: "Telegram connect command copied." });
                                                    } catch {
                                                        setFeedback({ tone: "error", text: "Could not copy Telegram connect command." });
                                                    }
                                                }}
                                                className="inline-flex h-9 items-center justify-center border border-[#ffaa00]/18 bg-[#ffaa00]/10 px-3 text-[10px] tracking-[0.16em] text-[#ffd37a] transition-all hover:bg-[#ffaa00]/14"
                                            >
                                                COPY COMMAND
                                            </button>
                                        ) : null}
                                        <button
                                            type="button"
                                            onClick={() => void telegramConnectQuery.refetch()}
                                            disabled={telegramConnectQuery.isFetching}
                                            className="inline-flex h-9 items-center gap-2 border border-white/10 bg-white/[0.03] px-3 text-[10px] tracking-[0.16em] text-white/72 transition-all hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-45"
                                        >
                                            <RefreshCw className={cn("h-3.5 w-3.5", telegramConnectQuery.isFetching && "animate-spin")} />
                                            {telegramConnectQuery.isFetching ? "CHECKING..." : "CHECK STATUS"}
                                        </button>
                                    </div>
                                    {telegramConnectQuery.data?.expiresAt ? (
                                        <p className="mt-3 text-[11px] leading-6 text-white/42">
                                            Connect link refreshes {formatDistanceToNowStrict(new Date(telegramConnectQuery.data.expiresAt), { addSuffix: true })}.
                                        </p>
                                    ) : null}
                                    <details className="mt-3 border border-white/8 bg-white/[0.02] px-3 py-3">
                                        <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-white/48">
                                            Advanced manual chat id
                                        </summary>
                                        <div className="mt-3">
                                            <TextField
                                                label="Telegram Chat ID"
                                                value={draft.telegramChatId ?? ""}
                                                placeholder="123456789 or -100..."
                                                onChange={(value) => setDraft({ ...draft, telegramChatId: value })}
                                            />
                                        </div>
                                    </details>
                                </>
                            )}
                        </ChannelCard>
                    </div>
                    ) : (
                        <p className="mt-4 text-[11px] leading-6 tracking-[0.14em] text-white/42">
                            Setup hidden. Use SHOW in this header to bring it back.
                        </p>
                    )}
                </section>
            ) : null}

            {draft ? (
                <section className="border border-[#00ff41]/12 bg-black/35 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff41]/52">Rules</p>
                            <h4 className="mt-1 text-base tracking-[0.08em] text-[#d8ffe6]">Choose what should wake you up</h4>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] tracking-[0.16em] text-white/42">{armedRulesCount} active</span>
                            <button
                                type="button"
                                onClick={() => setSectionOpen((current) => ({ ...current, rules: !current.rules }))}
                                className="inline-flex h-8 items-center justify-center border border-white/10 bg-white/[0.03] px-3 text-[10px] tracking-[0.16em] text-white/68 transition-all hover:bg-white/[0.07]"
                            >
                                {sectionOpen.rules ? "HIDE" : "SHOW"}
                            </button>
                        </div>
                    </div>
                    {sectionOpen.rules ? (
                    <div className="mt-4 grid gap-4">
                        <RuleCard title="Alpha">
                            <div className="space-y-3">
                                <InlineToggle
                                    label="Trending alpha"
                                    checked={draft.alphaHotEnabled}
                                    onChange={(checked) => setDraft({ ...draft, alphaHotEnabled: checked })}
                                />
                                <InlineToggle
                                    label="Critical alpha"
                                    checked={draft.alphaCriticalEnabled}
                                    onChange={(checked) => setDraft({ ...draft, alphaCriticalEnabled: checked })}
                                />
                            </div>
                        </RuleCard>
                        <RuleCard title="Profit target">
                            <InlineToggle
                                label="Notify above target"
                                checked={draft.portfolioProfitEnabled}
                                onChange={(checked) => setDraft({ ...draft, portfolioProfitEnabled: checked })}
                            />
                            <div className="mt-4">
                                <NumberField
                                    label="Threshold %"
                                    value={draft.profitThresholdPercent}
                                    onChange={(value) => setDraft({ ...draft, profitThresholdPercent: value })}
                                />
                            </div>
                        </RuleCard>
                        <RuleCard title="Drawdown protection">
                            <InlineToggle
                                label="Notify below floor"
                                checked={draft.portfolioDrawdownEnabled}
                                onChange={(checked) => setDraft({ ...draft, portfolioDrawdownEnabled: checked })}
                            />
                            <div className="mt-4">
                                <NumberField
                                    label="Threshold %"
                                    value={draft.drawdownThresholdPercent}
                                    onChange={(value) => setDraft({ ...draft, drawdownThresholdPercent: value })}
                                />
                            </div>
                        </RuleCard>
                        <RuleCard title="Claimable fees">
                            <InlineToggle
                                label="Notify on claimable SOL"
                                checked={draft.feesEnabled}
                                onChange={(checked) => setDraft({ ...draft, feesEnabled: checked })}
                            />
                            <div className="mt-4">
                                <NumberField
                                    label="Threshold SOL"
                                    value={draft.claimableFeesThresholdSol}
                                    step="0.05"
                                    onChange={(value) => setDraft({ ...draft, claimableFeesThresholdSol: value })}
                                />
                            </div>
                        </RuleCard>
                    </div>
                    ) : (
                        <p className="mt-4 text-[11px] leading-6 tracking-[0.14em] text-white/42">
                            Rules hidden. Use SHOW in this header whenever you want to edit triggers again.
                        </p>
                    )}
                </section>
            ) : null}

            <section className="border border-[#00ff41]/12 bg-black/35">
                <div className="flex items-center justify-between gap-3 border-b border-[#00ff41]/10 px-4 py-3">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff41]/52">Inbox</p>
                        <h4 className="mt-1 text-sm tracking-[0.16em] text-[#d8ffe6]">Recent notifications</h4>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] tracking-[0.16em] text-white/42">{notifications.length} items</span>
                        <button
                            type="button"
                            onClick={onMarkAll}
                            disabled={markAllPending || unreadCount === 0}
                            className="inline-flex items-center gap-1 text-[10px] tracking-[0.16em] text-[#8dd8ff] transition-colors hover:text-[#b7ebff] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                            <CheckCheck className="h-3 w-3" />
                            {markAllPending ? "UPDATING..." : "MARK ALL READ"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setSectionOpen((current) => ({ ...current, inbox: !current.inbox }))}
                            className="inline-flex h-8 items-center justify-center border border-white/10 bg-white/[0.03] px-3 text-[10px] tracking-[0.16em] text-white/68 transition-all hover:bg-white/[0.07]"
                        >
                            {sectionOpen.inbox ? "HIDE" : "SHOW"}
                        </button>
                    </div>
                </div>

                {sectionOpen.inbox ? (
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
                ) : (
                    <div className="px-4 py-4 text-[11px] leading-6 tracking-[0.14em] text-white/42">
                        Inbox hidden. Use SHOW in this header to review notifications again.
                    </div>
                )}
            </section>
        </div>
    );
}

function AlertAccessLockedPanel({
    access,
    onRefresh,
    checking,
}: {
    access: AlertAccessState;
    onRefresh: () => void;
    checking: boolean;
}) {
    return (
        <div className="space-y-4 px-4 py-5">
            <div className="grid gap-3 sm:grid-cols-3">
                <SmallStat label="ACCESS" value="LOCKED" icon={<Shield className="h-4 w-4" />} />
                <SmallStat label="BALANCE" value={access.balanceUi} icon={<Bell className="h-4 w-4" />} />
                <SmallStat label="REQUIRED" value={access.requiredUi} icon={<Sparkles className="h-4 w-4" />} />
            </div>
            <div className="border border-[#ffaa00]/20 bg-[#ffaa00]/10 p-4 text-sm leading-6 text-[#ffd37a]">
                Smart Alerts are reserved for wallets holding at least {access.requiredUi} $SCAN. This wallet currently holds {access.balanceUi} $SCAN and needs {access.shortfallUi} more to unlock in-app inbox, browser push, and Telegram delivery.
            </div>
            <div className="flex flex-wrap gap-2">
                <a
                    href={SCAN_BAGS_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center border border-[#00ff41]/24 bg-[#00ff41]/10 px-4 text-[11px] tracking-[0.18em] text-[#9dffb8] transition-all hover:bg-[#00ff41]/14"
                >
                    BUY $SCAN
                </a>
                <Link
                    href={`/token/${SCAN_MINT}`}
                    className="inline-flex h-10 items-center justify-center border border-[#00aaff]/18 bg-[#00aaff]/10 px-4 text-[11px] tracking-[0.18em] text-[#8dd8ff] transition-all hover:bg-[#00aaff]/14"
                >
                    OPEN $SCAN PAGE
                </Link>
                <ActionButton
                    label={checking ? "CHECKING..." : "REFRESH ACCESS"}
                    icon={<RefreshCw className={cn("h-3.5 w-3.5", checking && "animate-spin")} />}
                    onClick={onRefresh}
                    disabled={checking}
                />
            </div>
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

function StatusSummary({
    label,
    value,
    note,
    icon,
}: {
    label: string;
    value: string;
    note: string;
    icon: React.ReactNode;
}) {
    return (
        <div className="border border-[#00ff41]/12 bg-black/35 p-3">
            <div className="flex items-center justify-between gap-3 text-[#9dffb8]">
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/46">{label}</span>
                {icon}
            </div>
            <p className="mt-3 text-lg tracking-[0.08em] text-[#f3fff6]">{value}</p>
            <p className="mt-2 text-[10px] leading-5 tracking-[0.12em] text-white/38">{note}</p>
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

function ChannelCard({
    title,
    status,
    description,
    children,
}: {
    title: string;
    status: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <div className="border border-white/8 bg-white/[0.02] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#d8ffe6]">{title}</p>
                    <p className="mt-2 max-w-[42ch] text-sm leading-6 text-white/58">{description}</p>
                </div>
                <span className="shrink-0 border border-[#00ff41]/14 bg-[#00ff41]/8 px-2 py-1 text-[9px] tracking-[0.16em] text-[#9dffb8]">
                    {status}
                </span>
            </div>
            <div className="mt-5 space-y-4">{children}</div>
        </div>
    );
}

function RuleCard({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="border border-white/8 bg-white/[0.02] p-4 sm:p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#d8ffe6]">{title}</p>
            <div className="mt-4 space-y-4">{children}</div>
        </div>
    );
}

function InlineToggle({
    label,
    checked,
    onChange,
    disabled,
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <label className="flex items-center justify-between gap-4 border border-white/8 bg-black/30 px-3 py-3.5">
            <p className="pr-3 text-[12px] leading-5 tracking-[0.04em] text-[#d8ffe6]">{label}</p>
            <input
                type="checkbox"
                className="h-4 w-4 accent-[#00ff41]"
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
