export type AlertSeverity = "info" | "hot" | "critical";
export type AlertKind =
    | "alpha_hot"
    | "alpha_critical"
    | "portfolio_profit"
    | "portfolio_drawdown"
    | "fee_claim"
    | "system";
export type AlertTestChannel = "inbox" | "push" | "telegram";

export interface AlertAccessState {
    wallet: string;
    eligible: boolean;
    mint: string;
    balanceUi: string;
    requiredUi: string;
    shortfallUi: string;
    checkedAt: string;
}

export interface AlertPreferenceState {
    walletAddress: string;
    inAppEnabled: boolean;
    browserPushEnabled: boolean;
    telegramEnabled: boolean;
    alphaHotEnabled: boolean;
    alphaCriticalEnabled: boolean;
    portfolioProfitEnabled: boolean;
    portfolioDrawdownEnabled: boolean;
    feesEnabled: boolean;
    profitThresholdPercent: number;
    drawdownThresholdPercent: number;
    claimableFeesThresholdSol: number;
    telegramChatId?: string | null;
    lastEvaluatedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AlertNotificationItem {
    id: string;
    kind: AlertKind;
    severity: AlertSeverity;
    title: string;
    message: string;
    tokenMint?: string | null;
    actionUrl?: string | null;
    imageUrl?: string | null;
    createdAt: string;
    readAt?: string | null;
}

export interface AlertStateResponse {
    wallet: string;
    unreadCount: number;
    preference: AlertPreferenceState;
    notifications: AlertNotificationItem[];
    config: {
        access: AlertAccessState;
        browserPushConfigured: boolean;
        telegramConfigured: boolean;
        vapidPublicKey?: string;
        requiresSecureOrigin: boolean;
        backgroundRuntimeEnabled: boolean;
    };
}

export interface AlertTelegramConnectState {
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

export interface AlertSyncResponse {
    state: AlertStateResponse;
    createdCount: number;
}

export interface AlertPreferenceUpdateInput {
    inAppEnabled?: boolean;
    browserPushEnabled?: boolean;
    telegramEnabled?: boolean;
    alphaHotEnabled?: boolean;
    alphaCriticalEnabled?: boolean;
    portfolioProfitEnabled?: boolean;
    portfolioDrawdownEnabled?: boolean;
    feesEnabled?: boolean;
    profitThresholdPercent?: number;
    drawdownThresholdPercent?: number;
    claimableFeesThresholdSol?: number;
    telegramChatId?: string | null;
}

export interface AlertTestResponse {
    message: string;
}
