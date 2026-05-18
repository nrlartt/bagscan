import type { Metadata } from "next";
import { FeatureRouteDisabled } from "@/components/bagscan/FeatureRouteDisabled";

export const metadata: Metadata = {
    title: "Prediction - BagScan",
    description:
        "Prediction markets UI is temporarily disabled while BagScan focuses on discovery and launch parity.",
};

export default function PredictionPage() {
    return <FeatureRouteDisabled title="PREDICTION" moduleId="PREDICTION" />;
}
