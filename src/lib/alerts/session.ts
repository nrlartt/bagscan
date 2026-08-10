import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ALERTS_COOKIE = "bagscan_alerts_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret(): string {
    const value = process.env.ALERTS_SESSION_SECRET;
    if (!value || value.length < 16) {
        throw new Error("ALERTS_SESSION_SECRET is missing or too short");
    }
    return value;
}

function sign(payload: string): string {
    return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** `wallet.expiry.signature` — stateless, so sign-out just drops the cookie. */
export function createSessionToken(wallet: string): string {
    const payload = `${wallet.toLowerCase()}.${Date.now() + SESSION_TTL_MS}`;
    return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined | null): string | null {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [wallet, expiry, signature] = parts;
    const expected = sign(`${wallet}.${expiry}`);

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (!Number.isFinite(Number(expiry)) || Number(expiry) < Date.now()) return null;

    return wallet.toLowerCase();
}

/** The signed-in wallet for the current request, or null. */
export async function getSessionWallet(): Promise<string | null> {
    const store = await cookies();
    return readSessionToken(store.get(ALERTS_COOKIE)?.value);
}

export function newNonce(): string {
    return randomBytes(16).toString("hex");
}

/** The exact text the wallet signs — shown in the wallet UI, so keep it legible. */
export function buildSignInMessage(wallet: string, nonce: string): string {
    return [
        "BagScan alerts sign-in",
        "",
        `Wallet: ${wallet}`,
        `Nonce: ${nonce}`,
        "",
        "Signing proves you own this wallet. It authorizes no transaction and costs no gas.",
    ].join("\n");
}
