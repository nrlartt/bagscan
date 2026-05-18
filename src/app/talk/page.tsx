import type { Metadata } from "next";
import { FeatureRouteDisabled } from "@/components/bagscan/FeatureRouteDisabled";

export const metadata: Metadata = {
    title: "Talk To Bags - BagScan",
    description:
        "Talk To Bags is temporarily disabled while BagScan aligns the product surface with core discovery and launch.",
};

export default function TalkPage() {
    return <FeatureRouteDisabled title="TALK TO BAGS" moduleId="TALK_TO_BAGS" />;
}
