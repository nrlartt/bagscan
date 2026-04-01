import type { Metadata } from "next";
import { TalkToBagsComingSoon } from "@/components/talk/TalkToBagsComingSoon";
import { TalkToBagsTerminal } from "@/components/talk/TalkToBagsTerminal";

const talkEnabled = process.env.ENABLE_TALK_TO_BAGS === "true";

export const metadata: Metadata = talkEnabled
    ? {
        title: "Talk To Bags - BagScan",
        description:
            "OpenClaw-powered BAGS copilot inside BagScan, grounded only in official BAGS market, creator, fee, claim, launch, and hackathon data.",
    }
    : {
        title: "Talk To Bags - Coming Soon - BagScan",
        description:
            "Talk To Bags is in private development while BagScan continues to harden the official BAGS copilot experience.",
    };

export default function TalkPage() {
    return talkEnabled ? <TalkToBagsTerminal /> : <TalkToBagsComingSoon />;
}
