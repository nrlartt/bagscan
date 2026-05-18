import type { Metadata } from "next";
import { FeatureRouteDisabled } from "@/components/bagscan/FeatureRouteDisabled";

export const metadata: Metadata = {
    title: "Prediction Event - BagScan",
    description:
        "Prediction event pages are temporarily disabled while BagScan focuses on core product surfaces.",
};

export default function PredictionEventPage() {
    return <FeatureRouteDisabled title="PREDICTION" moduleId="PREDICTION_EVENT" />;
}
