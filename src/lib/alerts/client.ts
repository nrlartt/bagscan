"use client";

import type {
    AlertPreferenceUpdateInput,
    AlertStateResponse,
    AlertSyncResponse,
} from "./types";

interface ApiEnvelope<T> {
    success: boolean;
    data?: T;
    error?: string;
}

type SignMessageFn = (message: Uint8Array) => Promise<Uint8Array>;

function bytesToBase64(bytes: Uint8Array) {
    let binary = "";
    bytes.forEach((value) => {
        binary += String.fromCharCode(value);
    });
    return btoa(binary);
}

function base64UrlToUint8Array(value: string) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const binary = atob(normalized + padding);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function parseApiResponse<T>(response: Response): Promise<T> {
    const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
    if (!response.ok || !payload.success || payload.data === undefined) {
        throw new Error(payload.error ?? "Request failed");
    }
    return payload.data;
}

function buildAuthHeaders(wallet: string) {
    return {
        "x-wallet-address": wallet,
    };
}

export async function fetchAlertState(wallet: string) {
    const response = await fetch("/api/alerts", {
        cache: "no-store",
        headers: buildAuthHeaders(wallet),
    });
    return parseApiResponse<AlertStateResponse>(response);
}

export async function syncAlertState(wallet: string) {
    const response = await fetch("/api/alerts/sync", {
        method: "POST",
        headers: buildAuthHeaders(wallet),
    });
    return parseApiResponse<AlertSyncResponse>(response);
}

export async function updateAlertSettings(
    wallet: string,
    input: AlertPreferenceUpdateInput
) {
    const response = await fetch("/api/alerts", {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            ...buildAuthHeaders(wallet),
        },
        body: JSON.stringify(input),
    });
    return parseApiResponse<AlertStateResponse>(response);
}

export async function markAlertsAsRead(
    wallet: string,
    input: { ids?: string[]; all?: boolean }
) {
    const response = await fetch("/api/alerts/read", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...buildAuthHeaders(wallet),
        },
        body: JSON.stringify(input),
    });

    const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<null>;
    if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to mark alerts as read");
    }
}

export async function requestAlertSession(wallet: string, signMessage: SignMessageFn) {
    const challengeResponse = await fetch(`/api/alerts/auth/challenge?wallet=${encodeURIComponent(wallet)}`, {
        cache: "no-store",
    });

    const challengePayload = (await challengeResponse.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        message?: string;
    };

    if (!challengeResponse.ok || !challengePayload.success || !challengePayload.message) {
        throw new Error(challengePayload.error ?? "Failed to create alert sign-in challenge");
    }

    const encodedMessage = new TextEncoder().encode(challengePayload.message);
    const signature = await signMessage(encodedMessage);

    const loginResponse = await fetch("/api/alerts/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            wallet,
            message: challengePayload.message,
            signature: bytesToBase64(signature),
        }),
    });

    const loginPayload = (await loginResponse.json().catch(() => ({}))) as ApiEnvelope<{ wallet: string }>;
    if (!loginResponse.ok || !loginPayload.success) {
        throw new Error(loginPayload.error ?? "Alert sign-in failed");
    }
}

export async function logoutAlertSession() {
    await fetch("/api/alerts/auth/logout", {
        method: "POST",
    });
}

export async function ensureAlertServiceWorker() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
        return null;
    }

    return navigator.serviceWorker.register("/bagscan-alerts-sw.js");
}

export async function subscribeBrowserPush(wallet: string, vapidPublicKey: string) {
    const registration = await ensureAlertServiceWorker();
    if (!registration) {
        throw new Error("Service workers are not available in this browser");
    }

    const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
        }));

    const response = await fetch("/api/alerts/push-subscription", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...buildAuthHeaders(wallet),
        },
        body: JSON.stringify({
            subscription: subscription.toJSON(),
        }),
    });

    const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<null>;
    if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to save browser push subscription");
    }
}

export async function unsubscribeBrowserPush(wallet: string) {
    const registration = await ensureAlertServiceWorker();
    const subscription = await registration?.pushManager.getSubscription();

    if (!subscription) {
        return;
    }

    await fetch("/api/alerts/push-subscription", {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            ...buildAuthHeaders(wallet),
        },
        body: JSON.stringify({
            endpoint: subscription.endpoint,
        }),
    });

    await subscription.unsubscribe();
}
