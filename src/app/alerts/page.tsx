import type { Metadata } from "next";
import { RhAlertsView } from "@/components/bagscan/RhAlertsView";

export const metadata: Metadata = {
    title: "Alerts",
    description:
        "Watch Robinhood Chain tokens and get alerted on curve milestones, graduations, volume spikes, sharp price moves and whale trades.",
    alternates: { canonical: "/alerts" },
};

export default function AlertsPage() {
    return <RhAlertsView />;
}
