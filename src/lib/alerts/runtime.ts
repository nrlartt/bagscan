import { runAlertsCron } from "./engine";

const DEFAULT_RUNTIME_INTERVAL_MS = 60_000;

const globalForAlertsRuntime = globalThis as {
    bagscanAlertsRuntimeStarted?: boolean;
    bagscanAlertsRuntimeRunning?: boolean;
    bagscanAlertsRuntimeTimer?: ReturnType<typeof setInterval>;
};

function shouldEnableInternalAlertsRuntime() {
    if (process.env.ENABLE_INTERNAL_ALERTS_RUNTIME === "false") {
        return false;
    }

    if (process.env.NODE_ENV === "test") {
        return false;
    }

    if (process.env.NEXT_PHASE === "phase-production-build") {
        return false;
    }

    return Boolean(process.env.DATABASE_URL);
}

function getRuntimeIntervalMs() {
    const value = Number(process.env.ALERTS_RUNTIME_INTERVAL_MS ?? DEFAULT_RUNTIME_INTERVAL_MS);
    return Number.isFinite(value) && value >= 30_000 ? value : DEFAULT_RUNTIME_INTERVAL_MS;
}

async function runAlertsRuntimeTick() {
    if (globalForAlertsRuntime.bagscanAlertsRuntimeRunning) {
        return;
    }

    globalForAlertsRuntime.bagscanAlertsRuntimeRunning = true;

    try {
        const result = await runAlertsCron();

        if (!result.skipped) {
            console.log(
                `[alerts/runtime] processed ${result.walletsProcessed} wallets, created ${result.createdCount} alerts, broadcasts ${result.telegramBroadcasts.broadcastsSent}`
            );
        }
    } catch (error) {
        console.error("[alerts/runtime] tick failed:", error);
    } finally {
        globalForAlertsRuntime.bagscanAlertsRuntimeRunning = false;
    }
}

export function startInternalAlertsRuntime() {
    if (!shouldEnableInternalAlertsRuntime()) {
        return false;
    }

    if (globalForAlertsRuntime.bagscanAlertsRuntimeStarted) {
        return true;
    }

    globalForAlertsRuntime.bagscanAlertsRuntimeStarted = true;

    void runAlertsRuntimeTick();

    const timer = setInterval(() => {
        void runAlertsRuntimeTick();
    }, getRuntimeIntervalMs());

    timer.unref?.();
    globalForAlertsRuntime.bagscanAlertsRuntimeTimer = timer;

    console.log("[alerts/runtime] internal scheduler started");
    return true;
}
