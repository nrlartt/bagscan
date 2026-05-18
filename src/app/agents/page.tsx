import type { Metadata } from "next";
import { FeatureRouteDisabled } from "@/components/bagscan/FeatureRouteDisabled";

export const metadata: Metadata = {
    title: "AI Agents - BagScan",
    description:
        "AI Agents hackathon view is temporarily disabled while BagScan aligns with core discovery and launch.",
};

export default function AgentsPage() {
    return <FeatureRouteDisabled title="AI AGENTS" moduleId="AGENTS" />;
}
