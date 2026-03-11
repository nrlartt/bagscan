import { NextRequest, NextResponse } from "next/server";

function readBearerToken(req: NextRequest): string | null {
    const auth = req.headers.get("authorization");
    if (!auth) return null;
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
}

function expectedAgentKey(): string | null {
    return (
        process.env.BAGSCAN_AGENT_API_KEY?.trim() ||
        process.env.BAGSCAN_ADMIN_SECRET?.trim() ||
        null
    );
}

export function requireAgentAuth(req: NextRequest): NextResponse | null {
    const expected = expectedAgentKey();
    if (!expected) {
        return NextResponse.json(
            {
                success: false,
                error: "Agent API key is not configured on server.",
            },
            { status: 500 }
        );
    }

    const provided =
        req.headers.get("x-agent-key")?.trim() ||
        readBearerToken(req) ||
        null;

    if (!provided || provided !== expected) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    return null;
}

