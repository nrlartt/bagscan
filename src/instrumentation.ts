export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") {
        return;
    }

    const { startInternalAlertsRuntime } = await import("@/lib/alerts/runtime");
    startInternalAlertsRuntime();
}
