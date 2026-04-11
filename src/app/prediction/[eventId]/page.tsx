import type { Metadata } from "next";
import { PredictionEventTerminal } from "@/components/prediction/PredictionEventTerminal";

export const metadata: Metadata = {
    title: "Prediction Event - BagScan",
    description:
        "Inspect a live Jupiter prediction event inside BagScan and enter YES / NO positions funded with $SCAN.",
};

interface PredictionEventPageProps {
    params: Promise<{
        eventId: string;
    }>;
}

export default async function PredictionEventPage({ params }: PredictionEventPageProps) {
    const { eventId } = await params;
    return <PredictionEventTerminal eventId={eventId} />;
}
