import { NextResponse } from "next/server";
import {
    clearAlertChallengeCookie,
    clearAlertSessionCookie,
} from "@/lib/alerts/auth";

export async function POST() {
    const response = NextResponse.json({ success: true });
    clearAlertChallengeCookie(response);
    clearAlertSessionCookie(response);
    return response;
}
