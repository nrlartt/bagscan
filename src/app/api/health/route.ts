export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lightweight liveness probe for gateways (APISIX, k8s, Railway, etc.).
 * Does not touch the database — must stay fast.
 */
export async function GET() {
    return Response.json(
        {
            ok: true,
            service: "bagscan",
            ts: new Date().toISOString(),
        },
        {
            status: 200,
            headers: {
                "Cache-Control": "no-store",
            },
        }
    );
}
