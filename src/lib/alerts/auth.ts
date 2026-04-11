import "server-only";
import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";
import type { NextRequest, NextResponse } from "next/server";

// Keep Node built-ins out of the webpack graph for server-only alert auth.
const runtimeRequire = eval("require") as NodeJS.Require;
const {
    createHmac,
    randomBytes,
    timingSafeEqual,
} = runtimeRequire("crypto") as typeof import("crypto");

const CHALLENGE_COOKIE = "bagscan_alerts_challenge";
const SESSION_COOKIE = "bagscan_alerts_session";
const CHALLENGE_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const TELEGRAM_CONNECT_TTL_MS = 15 * 60 * 1000;

interface SignedPayload {
    exp: number;
}

interface ChallengePayload extends SignedPayload {
    wallet: string;
    nonce: string;
    issuedAt: number;
}

interface SessionPayload extends SignedPayload {
    wallet: string;
}

interface TelegramConnectPayload extends SignedPayload {
    wallet: string;
    purpose: "telegram-connect";
}

function getAlertsSecret() {
    return process.env.ALERTS_SESSION_SECRET || "dev-alerts-secret-change-me";
}

function base64UrlEncode(value: string | Uint8Array) {
    return Buffer.from(value)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function signValue(value: string) {
    return base64UrlEncode(createHmac("sha256", getAlertsSecret()).update(value).digest());
}

function sealPayload(payload: SignedPayload) {
    const body = base64UrlEncode(JSON.stringify(payload));
    const signature = signValue(body);
    return `${body}.${signature}`;
}

function unsealPayload<T extends SignedPayload>(token?: string | null): T | null {
    if (!token) return null;
    const [body, signature] = token.split(".");
    if (!body || !signature) return null;

    const expected = signValue(body);
    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (providedBuffer.length !== expectedBuffer.length) return null;
    if (!timingSafeEqual(providedBuffer, expectedBuffer)) return null;

    try {
        const payload = JSON.parse(base64UrlDecode(body)) as T;
        if (!payload.exp || payload.exp < Date.now()) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

function getCookieBaseOptions(maxAge: number) {
    return {
        httpOnly: true,
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge,
    };
}

export function buildAlertSignInMessage(wallet: string, nonce: string, issuedAt: number) {
    return [
        "BagScan Alerts Authorization",
        "",
        `Wallet: ${wallet}`,
        `Nonce: ${nonce}`,
        `Issued At: ${new Date(issuedAt).toISOString()}`,
        "",
        "Authorize BagScan to manage alert preferences and notifications for this wallet.",
        "No transaction will be created and no funds can move.",
    ].join("\n");
}

export function createAlertChallenge(wallet: string) {
    const nonce = randomBytes(16).toString("hex");
    const issuedAt = Date.now();
    const payload: ChallengePayload = {
        wallet,
        nonce,
        issuedAt,
        exp: issuedAt + CHALLENGE_TTL_SECONDS * 1000,
    };

    return {
        message: buildAlertSignInMessage(wallet, nonce, issuedAt),
        token: sealPayload(payload),
        issuedAt,
    };
}

export function setAlertChallengeCookie(response: NextResponse, token: string) {
    response.cookies.set(CHALLENGE_COOKIE, token, getCookieBaseOptions(CHALLENGE_TTL_SECONDS));
}

export function clearAlertChallengeCookie(response: NextResponse) {
    response.cookies.set(CHALLENGE_COOKIE, "", {
        ...getCookieBaseOptions(0),
        expires: new Date(0),
    });
}

export function readAlertChallenge(request: NextRequest) {
    return unsealPayload<ChallengePayload>(request.cookies.get(CHALLENGE_COOKIE)?.value);
}

export function verifyAlertSignature(wallet: string, message: string, signatureBase64: string) {
    const signature = Buffer.from(signatureBase64, "base64");
    const publicKey = bs58.decode(wallet);
    return ed25519.verify(signature, new TextEncoder().encode(message), publicKey);
}

export function setAlertSessionCookie(response: NextResponse, wallet: string) {
    const payload: SessionPayload = {
        wallet,
        exp: Date.now() + SESSION_TTL_SECONDS * 1000,
    };
    response.cookies.set(SESSION_COOKIE, sealPayload(payload), getCookieBaseOptions(SESSION_TTL_SECONDS));
}

export function clearAlertSessionCookie(response: NextResponse) {
    response.cookies.set(SESSION_COOKIE, "", {
        ...getCookieBaseOptions(0),
        expires: new Date(0),
    });
}

export function readAlertSession(request: NextRequest) {
    return unsealPayload<SessionPayload>(request.cookies.get(SESSION_COOKIE)?.value);
}

export function requireAlertSessionWallet(request: NextRequest) {
    const session = readAlertSession(request);
    if (!session?.wallet) {
        return null;
    }

    const requestedWallet = request.headers.get("x-wallet-address")?.trim();
    if (requestedWallet && requestedWallet !== session.wallet) {
        return null;
    }

    return session.wallet;
}

export function createTelegramConnectToken(wallet: string, now = Date.now()) {
    const bucketStart = Math.floor(now / TELEGRAM_CONNECT_TTL_MS) * TELEGRAM_CONNECT_TTL_MS;
    const expiresAt = bucketStart + (2 * TELEGRAM_CONNECT_TTL_MS);
    const payload: TelegramConnectPayload = {
        wallet,
        purpose: "telegram-connect",
        exp: expiresAt,
    };

    return {
        token: sealPayload(payload),
        expiresAt,
    };
}

export function readTelegramConnectToken(token?: string | null) {
    const payload = unsealPayload<TelegramConnectPayload>(token);
    if (!payload || payload.purpose !== "telegram-connect") {
        return null;
    }

    return payload;
}
