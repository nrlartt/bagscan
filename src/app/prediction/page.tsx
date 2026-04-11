import type { Metadata } from "next";
import { PredictionBrowse } from "@/components/prediction/PredictionBrowse";

export const metadata: Metadata = {
    title: "Prediction - BagScan",
    description:
        "Open Jupiter Prediction positions through BagScan with $SCAN-funded routing, live event discovery, and wallet-linked position tracking.",
};

export default function PredictionPage() {
    return <PredictionBrowse />;
}
