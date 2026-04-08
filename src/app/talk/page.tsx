import type { Metadata } from "next";
import { TalkToBagsTerminal } from "@/components/talk/TalkToBagsTerminal";

export const metadata: Metadata = {
    title: "Talk To Bags - BagScan",
    description:
        "OpenClaw-powered BAGS copilot inside BagScan, reserved for eligible $SCAN holders and grounded only in official BAGS market, creator, fee, claim, launch, and hackathon data.",
};

export default function TalkPage() {
    return <TalkToBagsTerminal />;
}
