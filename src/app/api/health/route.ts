export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lightweight liveness probe for gateways (APISIX, k8s, Railway, etc.).
 * Does not touch the database — must stay fast.
 * Append `?rpc=1` to verify Robinhood Chain RPC reads from the server.
 */
export async function GET(req: Request) {
    const url = new URL(req.url);
    const payload: Record<string, unknown> = {
        ok: true,
        service: "bagscan",
        ts: new Date().toISOString(),
    };

    if (url.searchParams.get("rpc") === "1") {
        try {
            const { getFactoryTokenTotal } = await import("@/lib/rh/registry");
            const total = await getFactoryTokenTotal();
            payload.rpc = { ok: true, tokenTotal: total };
        } catch (err) {
            payload.ok = false;
            payload.rpc = {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }

    return Response.json(payload, {
        status: payload.ok === false ? 503 : 200,
        headers: { "Cache-Control": "no-store" },
    });
}
