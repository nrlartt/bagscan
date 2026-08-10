import type { Metadata } from "next";
import { RhAlphaBoard } from "@/components/bagscan/RhAlphaBoard";

export const metadata: Metadata = {
    title: "Alpha",
    description:
        "Robinhood Chain flow intelligence: curve momentum, volume spikes, buy and sell pressure, whale prints and crowd formation, scored from indexed on-chain trades.",
    alternates: { canonical: "/alpha" },
};

export default function AlphaPage() {
    return <RhAlphaBoard />;
}
