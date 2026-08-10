import "server-only";
import { runAlertsEvaluation } from "./engine";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

let started = false;

/**
 * Optional in-process scheduler for single-instance deployments. Off unless
 * ENABLE_INTERNAL_ALERTS_RUNTIME is set — on multi-instance hosting prefer an
 * external cron hitting /api/alerts/cron so evaluations don't overlap.
 */
export function startInternalAlertsRuntime() {
    if (started) return;
    if (process.env.ENABLE_INTERNAL_ALERTS_RUNTIME !== "true") return;
    started = true;

    const interval = Math.max(
        60_000,
        Number(process.env.ALERTS_RUNTIME_INTERVAL_MS) || DEFAULT_INTERVAL_MS
    );

    const tick = async () => {
        try {
            const summary = await runAlertsEvaluation();
            if (summary.alertsCreated > 0) {
                console.log("[alerts] runtime created", summary.alertsCreated, "alerts");
            }
        } catch (error) {
            console.error("[alerts] runtime tick failed:", error);
        }
    };

    // Let the server finish booting before the first scan.
    setTimeout(() => void tick(), 30_000);
    setInterval(() => void tick(), interval).unref?.();
}
